import { Midi } from 'https://esm.sh/@tonejs/midi';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const loadingOverlay = document.getElementById('loading');
const animLabel = document.getElementById('anim-label');
const altToggle = document.getElementById('alt-toggle');
const doubleToggle = document.getElementById('double-toggle');
// sound toggle & audio map
const soundToggle = document.getElementById('sound-toggle');
const spamToggle = document.getElementById('spam-toggle');
const spamSpeedInput = document.getElementById('spam-speed');
const spamSpeedNum = document.getElementById('spam-speed-num');
const spamSpeedLabel = document.getElementById('spam-speed-label');

/* Use WebAudio and decoded AudioBuffers to avoid HTMLAudio playback stalls when spamming.
   We fetch and decode each source once and create short BufferSource nodes on demand. */
const audioSrcMap = {
    singleft: './bfsingleft.mp3',
    singleftAlt: './bfsingleftalt.mp3',
    singdown: './bfsingdown.mp3',
    singdownAlt: './bfsingdownalt.mp3',
    singright: './bfsingright.mp3',
    singrightAlt: './bfsingrightalt.mp3',
    singup: './bfsingup.mp3',
    singupAlt: './bfsingupalt.mp3',
    hey: './bfhey.wav',
    bfnote: './bfnotesingFnote.wav' // voice sample tuned to F for MIDI playback
};

// WebAudio setup
let audioCtx = null;
const audioBuffers = {}; // map name -> AudioBuffer
const audioGain = {}; // per-sound gain nodes (optional volume control)

// preload and decode all sounds asynchronously
async function initAudio() {
    if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } else {
        audioCtx = null;
        return;
    }

    const names = Object.keys(audioSrcMap);
    await Promise.all(names.map(async name => {
        try {
            const res = await fetch(audioSrcMap[name]);
            const arrayBuffer = await res.arrayBuffer();
            const decoded = await audioCtx.decodeAudioData(arrayBuffer);
            audioBuffers[name] = decoded;
            // create a gain node per sound so we can set relative volume easily
            const g = audioCtx.createGain();
            g.gain.value = 0.85;
            g.connect(audioCtx.destination);
            audioGain[name] = g;
        } catch (err) {
            console.warn('Failed to load or decode', name, err);
        }
    }));
}

// play by creating a BufferSource, connecting to its gain and starting immediately
let _currentAudioSource = null;
function playSoundForAnim(animName) {
    if (!soundToggle || !soundToggle.checked) return;
    if (!animName) return;
    if (!audioCtx) return;
    const buf = audioBuffers[animName];
    if (!buf) return;
    try {
        if (audioCtx.state === 'suspended' && typeof audioCtx.resume === 'function') {
            audioCtx.resume().catch(() => {});
        }

        // If something is already playing, stop & disconnect it so the new sound interrupts immediately
        if (_currentAudioSource) {
            try { _currentAudioSource.stop(0); } catch (e) {}
            try { _currentAudioSource.disconnect(); } catch (e) {}
            _currentAudioSource = null;
        }

        const src = audioCtx.createBufferSource();
        src.buffer = buf;

        // Prefer per-sound gain if available, otherwise create a temporary gain connected to destination
        const gainNode = audioGain[animName] || audioCtx.createGain();
        if (!audioGain[animName]) {
            gainNode.gain.value = 0.85;
            gainNode.connect(audioCtx.destination);
        } else {
            // ensure the stored gain is connected to destination
            try { audioGain[animName].connect(audioCtx.destination); } catch (e) {}
        }

        src.connect(gainNode);

        // remember the currently-playing source so it can be stopped by the next call
        _currentAudioSource = src;

        src.onended = () => {
            // clear reference when finished (only clear if it's the same source)
            if (_currentAudioSource === src) _currentAudioSource = null;
            try { src.disconnect(); } catch (e) {}
        };

        src.start(0);
    } catch (e) {
        // ignore playback errors
    }
}

 // start audio loading early
initAudio();

/* MIDI playback support:
   - uses @tonejs/midi to parse uploaded .mid
   - user can pick a channel/track (or "All")
   - basic scheduler uses setTimeout to trigger notes via playNoteAt (plays bfnote buffer and animates BF)
   - mapping: note pitch mapped into quartiles across the file's note range -> left / down / up / right
   - MIDI-triggered sings always use non-alt animations
*/

const midiFileInput = document.getElementById('midi-file');
const midiChannelSelect = document.getElementById('midi-channel');
const midiStartBtn = document.getElementById('midi-start');
const midiPauseBtn = document.getElementById('midi-pause');
const midiStopBtn = document.getElementById('midi-stop');

let midiNotes = []; // {time, midi, velocity, duration, track, channel}
let midiTimers = []; // active timeout IDs (for ons and offs)
let midiStartTime = 0; // performance.now() when started
let midiPausedAt = 0; // ms offset into song when paused
let midiDuration = 0;
let midiPlaying = false;
let midiNoteBuffer = null; // AudioBuffer for bfnote voice
let midiNoteMapping = null; // function(note) => dir string
let midiLoaded = false;

// track active MIDI-driven directions so note-offs can end presses and animations properly
const midiActiveDirs = { left: 0, down: 0, up: 0, right: 0 };

// load the bfnote buffer into audioBuffers after initAudio completes (audioBuffers may not be ready yet)
async function ensureMidiBuffer() {
    if (audioBuffers.bfnote) { midiNoteBuffer = audioBuffers.bfnote; return; }
    // if audioCtx exists and audioSrcMap entry exists, decode it (initAudio may have done this already)
    if (!audioCtx) return;
    try {
        const res = await fetch(audioSrcMap.bfnote);
        const ab = await res.arrayBuffer();
        const decoded = await audioCtx.decodeAudioData(ab);
        audioBuffers.bfnote = decoded;
        midiNoteBuffer = decoded;
    } catch (e) {
        console.warn('Failed to load BF note sample for MIDI', e);
    }
}

  // helper to play bfnote immediately (allowing polyphonic MIDI notes)
const midiSources = new Set();
/*
 playNoteBufferAtTime:
  - buffer: AudioBuffer to play
  - when: when to start (in seconds offset for AudioContext)
  - gain: linear gain for volume
  - semitoneShift: optional number of semitones to transpose the sample (positive = up)
*/
function playNoteBufferAtTime(buffer, when = 0, gain = 1.0, semitoneShift = 0, midiNum = null) {
    if (!audioCtx || !buffer) return null;
    try {
        if (audioCtx.state === 'suspended' && typeof audioCtx.resume === 'function') audioCtx.resume().catch(()=>{});
        // create a dedicated source for this note so chords overlap correctly
        const src = audioCtx.createBufferSource();
        src.buffer = buffer;
        // apply coarse pitch shift by changing playbackRate (2^(semitones/12))
        const rate = Math.pow(2, (semitoneShift || 0) / 12);
        // Ensure playbackRate is within a safe range to avoid extreme stretches
        src.playbackRate.value = Math.max(0.125, Math.min(4.0, rate));

        const g = audioCtx.createGain();
        g.gain.value = gain;
        src.connect(g);
        g.connect(audioCtx.destination);

        // attach midi metadata for note-off matching
        if (typeof midiNum === 'number') src._midi = midiNum;

        // track this source so multiple note-ons don't cancel each other and so we can stop specific notes
        midiSources.add(src);
        src.onended = () => {
            try { src.disconnect(); } catch(e) {}
            try { g.disconnect(); } catch(e) {}
            midiSources.delete(src);
        };

        // 'when' here is in seconds for AudioContext; allow passing 0 to start now
        try {
            src.start(when > 0 ? audioCtx.currentTime + when : 0);
        } catch(e) {
            // fallback: start immediately
            try { src.start(0); } catch(e) {}
        }
        return src;
    } catch (e) {
        // ignore
        return null;
    }
}

// convert uploaded file to midiNotes and populate channel select
midiFileInput.addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const arr = await f.arrayBuffer();
    try {
        const midi = new Midi(arr);
        // collect all notes across tracks with channel info where possible
        const notes = [];
        midi.tracks.forEach((t, ti) => {
            (t.notes || []).forEach(n => {
                // tonejs Midi note.time and note.duration are in seconds
                notes.push({
                    time: Math.round(n.time * 1000),
                    midi: n.midi,
                    velocity: n.velocity || 1,
                    duration: Math.round((typeof n.duration === 'number' ? n.duration : 0) * 1000),
                    track: ti,
                    channel: typeof n.channel === 'number' ? n.channel : null
                });
            });
        });
        if (!notes.length) {
            console.warn('No notes found in MIDI file');
            midiNotes = [];
            midiLoaded = false;
            midiChannelSelect.innerHTML = '<option value="all">All</option>';
            return;
        }
        // sort by time
        notes.sort((a,b) => a.time - b.time);
        midiNotes = notes;
        midiDuration = notes[notes.length -1].time;
        midiLoaded = true;

        // Determine channels/tracks present and populate select
        const channels = new Set();
        const tracks = new Set();
        notes.forEach(n => { if (n.channel !== null) channels.add(n.channel); tracks.add(n.track); });
        midiChannelSelect.innerHTML = '<option value="all">All</option>';
        // prefer listing channels if present, otherwise list tracks
        if (channels.size) {
            Array.from(channels).sort((a,b)=>a-b).forEach(ch => {
                const o = document.createElement('option');
                o.value = `ch:${ch}`;
                o.textContent = `Channel ${ch}`;
                midiChannelSelect.appendChild(o);
            });
        } else {
            Array.from(tracks).sort((a,b)=>a-b).forEach(tr => {
                const o = document.createElement('option');
                o.value = `tr:${tr}`;
                o.textContent = `Track ${tr}`;
                midiChannelSelect.appendChild(o);
            });
        }

        // build mapping from note pitch to 4 directions:
        const pmin = Math.min(...notes.map(n=>n.midi));
        const pmax = Math.max(...notes.map(n=>n.midi));
        const range = Math.max(1, pmax - pmin + 1);
        // mapping quartiles across range
        midiNoteMapping = (midiNum) => {
            const t = (midiNum - pmin) / range;
            if (t < 0.25) return 'left';
            if (t < 0.5) return 'down';
            if (t < 0.75) return 'up';
            return 'right';
        };

        // ensure sample buffer is ready
        await ensureMidiBuffer();
    } catch (err) {
        console.warn('Failed to parse MIDI:', err);
        midiLoaded = false;
    }
});

// schedule and control playback
function midiNoteOn(n) {
    if (!n) return;
    const dir = midiNoteMapping ? midiNoteMapping(n.midi) : 'down';
    // increment active count for this dir
    midiActiveDirs[dir] = (midiActiveDirs[dir] || 0) + 1;
    // audio: play buffer for this note (interrupts previous midi voice)
    const referenceMidi = 65;
    const semitoneShift = n.midi - referenceMidi;
    // play the sample and get a reference to the source so it can be stopped on note-off
    const src = playNoteBufferAtTime(midiNoteBuffer, 0, Math.max(0.12, n.velocity), semitoneShift, n.midi);
    // store reference optionally on the note object (not required but useful for debugging)
    if (src) {
        // tag the scheduled note instance so we can correlate note-ons/offs if needed
        if (!n._sources) n._sources = [];
        n._sources.push(src);
    }
    // visual: trigger arrow press and recompute host/ghost
    triggerArrowPress(dir);
    recomputeMidiHostGhost();
}

function midiNoteOff(n) {
    if (!n) return;
    const dir = midiNoteMapping ? midiNoteMapping(n.midi) : 'down';
    // decrement active count
    midiActiveDirs[dir] = Math.max(0, (midiActiveDirs[dir] || 0) - 1);

    // Stop any audio sources that were created for this MIDI note instance.
    // n._sources is populated in midiNoteOn when playNoteBufferAtTime returns a source.
    if (n._sources && Array.isArray(n._sources)) {
        n._sources.forEach(src => {
            try {
                // stop the source if it's still playing
                if (typeof src.stop === 'function') src.stop(0);
            } catch (e) {}
            try { src.disconnect(); } catch (e) {}
            // also remove it from the global midiSources set if present
            try { midiSources.delete(src); } catch (e) {}
        });
        // clear the sources list for this note so repeated offs do nothing
        n._sources = [];
    } else {
        // As a fallback, try to stop any global midiSources that match this midi number
        // (sources created via playNoteBufferAtTime tag _midi property)
        midiSources.forEach(src => {
            try {
                if (src && src._midi === n.midi) {
                    try { if (typeof src.stop === 'function') src.stop(0); } catch (e) {}
                    try { src.disconnect(); } catch (e) {}
                    midiSources.delete(src);
                }
            } catch(e){}
        });
    }

    // return that arrow to receptor immediately
    const a = arrowsState[dir];
    if (a) {
        if (a.idleTimer) { clearTimeout(a.idleTimer); a.idleTimer = null; }
        a.mode = 'receptor';
        a.frameIndex = 0;
        a.frozen = false;
    }
    // recompute host/ghost after note off
    recomputeMidiHostGhost();
}

function recomputeMidiHostGhost() {
    // build list of active dirs (counts > 0)
    const active = [];
    ['left','down','up','right'].forEach(d => { if (midiActiveDirs[d] > 0) active.push(d); });
    if (active.length === 0) {
        // stop MIDI-driven animation and return to idle (but don't cancel manual key state)
        currentAnimation = 'idle';
        currentFrameIndex = 0;
        ghostAnimation = null;
        ghostFrameIndex = 0;
        animLabel.innerText = 'IDLE';
        return;
    }
    if (active.length === 1) {
        const hostDir = active[0];
        const hostAnim = singNameForKey(hostDir, false);
        ghostAnimation = null;
        setAnimation(hostAnim);
        return;
    }
    // multiple simultanous -> set one as host and another as ghost (deterministic: pick first two)
    const hostDir = active[0];
    const ghostDir = active[1];
    const hostAnim = singNameForKey(hostDir, false);
    const ghostAnimName = singNameForKey(ghostDir, false);
    ghostAnimation = ghostAnimName;
    ghostFrameIndex = 0;
    setAnimation(hostAnim);
}

function scheduleMidiFrom(offsetMs = 0) {
    // clear any existing timers (both ons and offs)
    midiTimers.forEach(id => clearTimeout(id));
    midiTimers = [];
    // reset active dirs
    ['left','down','up','right'].forEach(d => midiActiveDirs[d] = 0);
    if (!midiLoaded || !midiNotes.length) return;
    const selected = midiChannelSelect ? midiChannelSelect.value : 'all';
    const base = performance.now() - offsetMs;
    midiStartTime = base - offsetMs;
    midiNotes.forEach(n => {
        // filter by selection
        if (selected !== 'all') {
            if (selected.startsWith('ch:')) {
                const ch = parseInt(selected.split(':')[1],10);
                if (n.channel !== ch) return;
            } else if (selected.startsWith('tr:')) {
                const tr = parseInt(selected.split(':')[1],10);
                if (n.track !== tr) return;
            }
        }
        // schedule note on
        const whenOn = base + n.time - offsetMs;
        const delayOn = Math.max(0, whenOn - performance.now());
        const idOn = setTimeout(() => {
            midiNoteOn(n);
        }, delayOn);
        midiTimers.push(idOn);

        // schedule note off if duration provided
        const dur = typeof n.duration === 'number' ? n.duration : 0;
        if (dur > 0) {
            const whenOff = whenOn + dur;
            const delayOff = Math.max(0, whenOff - performance.now());
            const idOff = setTimeout(() => {
                midiNoteOff(n);
            }, delayOff);
            midiTimers.push(idOff);
        } else {
            // fallback: if no duration, schedule a safe automatic release after 700ms
            const fallbackOff = whenOn + 700;
            const delayOff = Math.max(0, fallbackOff - performance.now());
            const idOff = setTimeout(() => {
                midiNoteOff(n);
            }, delayOff);
            midiTimers.push(idOff);
        }
    });
    midiPlaying = true;
}

// start / pause / stop handlers
midiStartBtn.addEventListener('click', () => {
    if (!midiLoaded) return;
    // if paused, resume from paused offset
    const startOffset = midiPausedAt || 0;
    scheduleMidiFrom(startOffset);
    midiPausedAt = 0;
});

midiPauseBtn.addEventListener('click', () => {
    if (!midiPlaying) return;
    // compute elapsed from start
    const elapsed = performance.now() - midiStartTime;
    midiPausedAt = Math.max(0, elapsed);
    midiTimers.forEach(id => clearTimeout(id));
    midiTimers = [];
    midiPlaying = false;
});

midiStopBtn.addEventListener('click', () => {
    midiTimers.forEach(id => clearTimeout(id));
    midiTimers = [];
    midiPlaying = false;
    midiPausedAt = 0;
    // return BF to idle
    currentAnimation = 'idle';
    currentFrameIndex = 0;
    ghostAnimation = null;
});

/* NPS (notes-per-second) tracking
   We'll record timestamps (ms) of every sing animation start and compute
   the count inside the last 1000ms as the NPS value. This naturally
   includes spam-mode triggers because setAnimation is called for each sing. */
const npsLabel = document.getElementById('nps-label');
const pressTimestamps = []; // ms timestamps of sing starts

function updateNPS() {
    const now = performance.now();
    // remove old entries (>1s)
    while (pressTimestamps.length && (now - pressTimestamps[0]) > 1000) pressTimestamps.shift();
    const nps = pressTimestamps.length;
    // display with one decimal by scaling to per-second with fractional precision
    const display = (nps).toFixed(1);
    if (npsLabel) npsLabel.innerText = display;
}
// update display regularly (200ms)
setInterval(updateNPS, 200);

// central setter for currentAnimation to keep UI, offsets & sound in sync
function setAnimation(anim) {
    currentAnimation = anim;
    currentFrameIndex = 0;
    returnToIdleTime = 0;
    lastFrameTime = 0;
    animLabel.innerText = currentAnimation ? currentAnimation.toUpperCase() : '';
    const v = offsets[currentAnimation] || [0, 0];
    offsetXInput.value = v[0];
    offsetYInput.value = v[1];
    offsetSelect.value = currentAnimation;
    // If this is a sing animation, record a press timestamp for NPS counting
    if (currentAnimation && currentAnimation.startsWith('sing')) {
        try {
            pressTimestamps.push(performance.now());
        } catch (e) {}
    }
    // play associated sound
    playSoundForAnim(currentAnimation);
}

const SPRITE_URL = './bfsheet.png';
const ARROW_SHEET = './arrowssheet.png';
const COLS = 8;
const ROWS = 7;
const DEFAULT_FPS = 24;
const SING_FPS = 12;

let spriteSheet = new Image();
let arrowSheet = new Image();
let isLoaded = false;
let frameWidth = 0;
let frameHeight = 0;
let arrowFrameWidth = 0;
let arrowFrameHeight = 0;

const animations = {
    singdown: [0, 1], singdownAlt: [2, 3], singleft: [4, 5], singleftAlt: [6, 7],
    singright: [8, 9], singrightAlt: [10, 11], singup: [12, 13], singupAlt: [14, 15],
    hey: Array.from({length: 26}, (_, i) => i + 16),
    idle: Array.from({length: 14}, (_, i) => i + 42)
};

let offsets = {}; // will be loaded from offsets.json

let currentAnimation = 'idle';
let currentFrameIndex = 0;
let lastFrameTime = 0;
let isHeyPlaying = false;
let returnToIdleTime = 0;
const keys = { up: false, down: false, left: false, right: false };
const keysAlt = { up: false, down: false, left: false, right: false }; // per-key alt inputs (Q/W/I/O)

// New: ghost state for double notes
let ghostAnimation = null;
let ghostFrameIndex = 0;

// Arrow mapping and state
// arrow sheet info: 3 rows x 8 cols (frames indexed left-to-right, top-to-bottom from 0)
const ARROW_COLS = 8;
const ARROW_ROWS = 3;
// We'll store sequences (global frame indices on arrow sheet) for receptors and presses.
// Frame mapping provided in prompt (1-based). Convert to 0-based indices.
const arrowFrames = {
    downReceptor: 0, // 1 -> frame 0
    leftReceptor: 1, // 2 -> frame 1
    rightReceptor: 2, // 3 -> frame 2
    upReceptor: 3, // 4 -> frame 3
    // key presses (grouped): down press = frames 5,6,7 -> indices 4,5,6
    downPress: [4,5,6],
    downMiss: [7,8],
    leftPress: [9,10,11],
    leftMiss: [12,13],
    rightPress: [14,15,16],
    rightMiss: [17,18],
    upPress: [19,20,21],
    upMiss: [22,23]
};
// We'll map logical order of receptors above BF: left, down, up, right
const receptorOrder = ['left','down','up','right'];

// Per-direction arrow runtime state
const arrowsState = {
    left: { mode: 'receptor', pressSeq: arrowFrames.leftPress, frameIndex: 0, frozen: false },
    down: { mode: 'receptor', pressSeq: arrowFrames.downPress, frameIndex: 0, frozen: false },
    up: { mode: 'receptor', pressSeq: arrowFrames.upPress, frameIndex: 0, frozen: false },
    right: { mode: 'receptor', pressSeq: arrowFrames.rightPress, frameIndex: 0, frozen: false }
};

const offsetSelect = document.getElementById('offset-anim-select');
const offsetXInput = document.getElementById('offset-x');
const offsetYInput = document.getElementById('offset-y');
const saveJsonBtn = document.getElementById('btn-save-json');
const offsetFileInput = document.getElementById('offset-file');

// arrow placement controls
const arrowSpacingInput = document.getElementById('arrow-spacing');
const arrowStartXInput = document.getElementById('arrow-startx');
const arrowYInput = document.getElementById('arrow-y');

function populateOffsetSelect() {
    offsetSelect.innerHTML = '';
    Object.keys(animations).forEach(anim => {
        const option = document.createElement('option');
        option.value = anim;
        option.textContent = anim.toUpperCase();
        offsetSelect.appendChild(option);
    });
    // set default selection and inputs
    offsetSelect.value = currentAnimation;
    if (offsets[currentAnimation]) {
        offsetXInput.value = offsets[currentAnimation][0];
        offsetYInput.value = offsets[currentAnimation][1];
    } else {
        offsetXInput.value = 0;
        offsetYInput.value = 0;
    }
}

fetch('offsets.json')
    .then(res => {
        if (!res.ok) throw new Error('Failed to load offsets.json');
        return res.json();
    })
    .then(data => {
        offsets = data;
        populateOffsetSelect();
    })
    .catch(err => {
        console.warn('Could not load offsets.json, using empty offsets:', err);
        offsets = {};
        populateOffsetSelect();
    });

offsetSelect.addEventListener('change', () => {
    const val = offsets[offsetSelect.value] || [0,0];
    offsetXInput.value = val[0];
    offsetYInput.value = val[1];
});

const saveOffsets = () => {
    offsets[offsetSelect.value] = [parseInt(offsetXInput.value) || 0, parseInt(offsetYInput.value) || 0];
    // ensure arrows container exists
    offsets.arrows = offsets.arrows || {};
    offsets.arrows.spacing = parseInt(arrowSpacingInput.value) || 0;
    offsets.arrows.startX = parseInt(arrowStartXInput.value) || 0;
    offsets.arrows.y = parseInt(arrowYInput.value) || 0;
};
[offsetXInput, offsetYInput, arrowSpacingInput, arrowStartXInput, arrowYInput].forEach(el => el.addEventListener('input', saveOffsets));

saveJsonBtn.addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(offsets, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "offsets.json");
    dlAnchorElem.click();
});

// load offsets JSON from a user-selected file
if (offsetFileInput) {
    offsetFileInput.addEventListener('change', (e) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const data = JSON.parse(reader.result);
                if (typeof data === 'object' && data !== null) {
                    offsets = data;
                    populateOffsetSelect();
                } else {
                    console.warn('Offset file did not contain an object');
                }
            } catch (err) {
                console.warn('Failed to parse offsets JSON:', err);
            }
        };
        reader.readAsText(f);
        // clear input so same file can be reloaded later if needed
        offsetFileInput.value = '';
    });
}

spriteSheet.crossOrigin = "anonymous";
arrowSheet.crossOrigin = "anonymous";
let resourcesLoaded = 0;
function tryStart() {
    resourcesLoaded++;
    if (resourcesLoaded >= 2) {
        isLoaded = true;
        frameWidth = spriteSheet.width / COLS;
        frameHeight = spriteSheet.height / ROWS;
        arrowFrameWidth = arrowSheet.width / ARROW_COLS;
        arrowFrameHeight = arrowSheet.height / ARROW_ROWS;
        loadingOverlay.style.display = 'none';
        // initialize arrow placement inputs from offsets (if present)
        if (offsets.arrows) {
            arrowSpacingInput.value = offsets.arrows.spacing || 0;
            arrowStartXInput.value = offsets.arrows.startX || 0;
            arrowYInput.value = offsets.arrows.y || 0;
        } else {
            // defaults
            arrowSpacingInput.value = 0;
            arrowStartXInput.value = 0;
            arrowYInput.value = 0;
            offsets.arrows = { spacing: 0, startX: 0, y: 0 };
        }
        resizeCanvas();
        requestAnimationFrame(gameLoop);
    }
}
spriteSheet.onload = tryStart;
arrowSheet.onload = tryStart;
spriteSheet.src = SPRITE_URL;
arrowSheet.src = ARROW_SHEET;

function resizeCanvas() {
    const container = document.getElementById('canvas-container');
    // fixed internal canvas pixel size to keep scaling crisp; adjust as needed
    canvas.width = 1200;
    canvas.height = Math.round(canvas.width * (container.clientHeight / container.clientWidth));
}

window.addEventListener('resize', resizeCanvas);

// Helper to map key flags to sing anim names
function singNameForKey(key, isAlt) {
    if (key === 'left') return isAlt ? 'singleftAlt' : 'singleft';
    if (key === 'down') return isAlt ? 'singdownAlt' : 'singdown';
    if (key === 'up') return isAlt ? 'singupAlt' : 'singup';
    if (key === 'right') return isAlt ? 'singrightAlt' : 'singright';
    return null;
}

// trigger arrow press for a direction: start press sequence and don't loop; freeze on last frame after sequence completes
function triggerArrowPress(dir) {
    const a = arrowsState[dir];
    if (!a) return;
    // clear any pending idle timer so it won't cancel the press prematurely
    if (a.idleTimer) { clearTimeout(a.idleTimer); a.idleTimer = null; }
    a.mode = 'press';
    a.frameIndex = 0;
    a.frozen = false;

    // Ensure the arrow timing accumulator exists and give a small negative headroom
    // so a large deltaTime won't immediately advance past the first press frame.
    // (Use half a frame duration as safe buffer.)
    const arrowFrameDuration = 1000 / SING_FPS;
    if (!updateArrows._acc) updateArrows._acc = { left:0, down:0, up:0, right:0 };
    updateArrows._acc[dir] = -Math.floor(arrowFrameDuration / 2);
}

// update arrows progression - advance press animation frames at SING_FPS, freeze on last
function updateArrows(deltaTime) {
    const arrowFrameDuration = 1000 / SING_FPS;
    // store a per-arrow accumulator
    if (!updateArrows._acc) updateArrows._acc = { left:0, down:0, up:0, right:0 };
    ['left','down','up','right'].forEach(dir => {
        const a = arrowsState[dir];
        updateArrows._acc[dir] += deltaTime;
        if (a.mode === 'press' && !a.frozen) {
            if (updateArrows._acc[dir] >= arrowFrameDuration) {
                updateArrows._acc[dir] = 0;
                a.frameIndex++;
                if (a.frameIndex >= a.pressSeq.length) {
                    a.frameIndex = a.pressSeq.length - 1;
                    a.frozen = true; // freeze at last frame
                    // schedule return to receptor (idle) after 0.7s
                    if (a.idleTimer) clearTimeout(a.idleTimer);
                    a.idleTimer = setTimeout(() => {
                        a.mode = 'receptor';
                        a.frameIndex = 0;
                        a.frozen = false;
                        a.idleTimer = null;
                    }, 700);
                }
            }
        }
    });
}

function updateAnimationState(forceRestart = false) {
    const globalAlt = altToggle.checked; // fallback global alt toggle
    const allowDouble = doubleToggle ? doubleToggle.checked : true;

    // collect active sing keys with per-key alt preference (keysAlt overrides keys for that direction)
    const active = [];
    ['left','down','up','right'].forEach(dir => {
        if (keysAlt[dir]) active.push({dir, alt: true});
        else if (keys[dir]) active.push({dir, alt: false});
    });

    if (active.length >= 2 && allowDouble) {
        // double note: choose host randomly from the active keys, the other becomes ghost
        const pickIndex = Math.floor(Math.random() * active.length);
        const host = active[pickIndex];
        const ghost = active.find((_, i) => i !== pickIndex) || active[(pickIndex+1)%active.length];

        const hostAnim = singNameForKey(host.dir, host.alt || globalAlt);
        const ghostAnim = singNameForKey(ghost.dir, ghost.alt || globalAlt);

        isHeyPlaying = false;
        ghostAnimation = ghostAnim;
        ghostFrameIndex = 0;

        if (currentAnimation !== hostAnim || forceRestart) {
            setAnimation(hostAnim);
            // trigger arrow press for host (press animation always uses normal press sequence)
            triggerArrowPress(host.dir);
        }
        return;
    }

    // if doubles are disabled but multiple keys are held, treat as single using the first active key
    if (active.length >= 2 && !allowDouble) {
        const first = active[0];
        const activeSingAnim = singNameForKey(first.dir, first.alt || globalAlt);
        ghostAnimation = null;
        isHeyPlaying = false;
        if (currentAnimation !== activeSingAnim || forceRestart) {
            setAnimation(activeSingAnim);
            triggerArrowPress(first.dir);
        }
        return;
    }

    // no double, clear ghost
    ghostAnimation = null;

    // single active key handling: prefer per-key alt, then global toggle
    let activeSingAnim = null;
    if (keysAlt.left || keys.left) activeSingAnim = singNameForKey('left', keysAlt.left || globalAlt && keys.left);
    if (!activeSingAnim && (keysAlt.down || keys.down)) activeSingAnim = singNameForKey('down', keysAlt.down || globalAlt && keys.down);
    if (!activeSingAnim && (keysAlt.up || keys.up)) activeSingAnim = singNameForKey('up', keysAlt.up || globalAlt && keys.up);
    if (!activeSingAnim && (keysAlt.right || keys.right)) activeSingAnim = singNameForKey('right', keysAlt.right || globalAlt && keys.right);

    if (activeSingAnim) {
        isHeyPlaying = false;
        if (currentAnimation !== activeSingAnim || forceRestart) {
            // determine which dir triggered it so we can play arrow press
            const triggeredDir = (keysAlt.left || keys.left) ? 'left' :
                                 (keysAlt.down || keys.down) ? 'down' :
                                 (keysAlt.up || keys.up) ? 'up' :
                                 (keysAlt.right || keys.right) ? 'right' : null;

            setAnimation(activeSingAnim);
            if (triggeredDir) triggerArrowPress(triggeredDir);
        }
    }
}

function playHey() {
    isHeyPlaying = true;
    setAnimation('hey');
    ghostAnimation = null;
    document.getElementById('btn-hey').classList.add('active');
    setTimeout(() => document.getElementById('btn-hey').classList.remove('active'), 150);
}

window.addEventListener('keydown', (e) => {
    if (!isLoaded || e.repeat || e.target.tagName === 'INPUT') return;
    const key = e.key.toLowerCase();
    // standard arrow / WASD
    if (key === 'arrowleft' || key === 'a') { keys.left = true; document.getElementById('btn-left').classList.add('active'); if (spamToggle && spamToggle.checked) startSpam('left'); }
    if (key === 'arrowdown' || key === 's') { keys.down = true; document.getElementById('btn-down').classList.add('active'); if (spamToggle && spamToggle.checked) startSpam('down'); }
    if (key === 'arrowup') { keys.up = true; document.getElementById('btn-up').classList.add('active'); if (spamToggle && spamToggle.checked) startSpam('up'); }
    /* D is explicitly disabled (does nothing). */
    if (key === 'arrowright') { keys.right = true; document.getElementById('btn-right').classList.add('active'); if (spamToggle && spamToggle.checked) startSpam('right'); }

    // K/L map to Up/Right (normal)
    if (key === 'k') { keys.up = true; document.getElementById('btn-up').classList.add('active'); if (spamToggle && spamToggle.checked) startSpam('up'); }
    if (key === 'l') { keys.right = true; document.getElementById('btn-right').classList.add('active'); if (spamToggle && spamToggle.checked) startSpam('right'); }

    // Q/W/I/O map to per-key alt (Q=left, W=down, I=up, O=right)
    if (key === 'q') { keysAlt.left = true; document.getElementById('btn-left').classList.add('active'); if (spamToggle && spamToggle.checked) startSpam('left'); }
    if (key === 'w') { keysAlt.down = true; document.getElementById('btn-down').classList.add('active'); if (spamToggle && spamToggle.checked) startSpam('down'); }
    if (key === 'i') { keysAlt.up = true; document.getElementById('btn-up').classList.add('active'); if (spamToggle && spamToggle.checked) startSpam('up'); }
    if (key === 'o') { keysAlt.right = true; document.getElementById('btn-right').classList.add('active'); if (spamToggle && spamToggle.checked) startSpam('right'); }

    if (key === ' ' && !isHeyPlaying) playHey();
    // if spam mode is on, starting was already handled per-key; otherwise refresh state
    if (!(spamToggle && spamToggle.checked)) updateAnimationState(true);
});

window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (key === 'arrowleft' || key === 'a') { keys.left = false; document.getElementById('btn-left').classList.remove('active'); stopSpam('left'); }
    if (key === 'arrowdown' || key === 's') { keys.down = false; document.getElementById('btn-down').classList.remove('active'); stopSpam('down'); }
    if (key === 'arrowup') { keys.up = false; document.getElementById('btn-up').classList.remove('active'); stopSpam('up'); }
    /* D is disabled, so only handle ArrowRight here. */
    if (key === 'arrowright') { keys.right = false; document.getElementById('btn-right').classList.remove('active'); stopSpam('right'); }

    // K/L
    if (key === 'k') { keys.up = false; document.getElementById('btn-up').classList.remove('active'); stopSpam('up'); }
    if (key === 'l') { keys.right = false; document.getElementById('btn-right').classList.remove('active'); stopSpam('right'); }

    // Q/W/I/O per-key alt releases
    if (key === 'q') { keysAlt.left = false; document.getElementById('btn-left').classList.remove('active'); stopSpam('left'); }
    if (key === 'w') { keysAlt.down = false; document.getElementById('btn-down').classList.remove('active'); stopSpam('down'); }
    if (key === 'i') { keysAlt.up = false; document.getElementById('btn-up').classList.remove('active'); stopSpam('up'); }
    if (key === 'o') { keysAlt.right = false; document.getElementById('btn-right').classList.remove('active'); stopSpam('right'); }

    updateAnimationState();
});

/* Spam mode implementation:
   - spamToggle enables repeated triggering while a key/button is held
   - spamSpeedInput controls interval in ms (label updated)
   - spamTimers holds per-direction intervals so each direction can spam independently
*/
const spamTimers = { left: null, down: null, up: null, right: null };
function currentSpamInterval() {
    // prefer the typed numeric input if available; fallback to range value; default 200ms
    let v = 200;
    if (spamSpeedNum && spamSpeedNum.value !== '') v = parseInt(spamSpeedNum.value, 10) || 200;
    else if (spamSpeedInput && spamSpeedInput.value !== '') v = parseInt(spamSpeedInput.value, 10) || 200;
    // clamp between 1ms and 800ms
    return Math.max(1, Math.min(800, v));
}

// keep the range and numeric inputs and label in sync
if (spamSpeedInput && spamSpeedLabel) {
    const syncFromRange = () => {
        const val = parseInt(spamSpeedInput.value, 10) || 200;
        if (spamSpeedNum) spamSpeedNum.value = val;
        spamSpeedLabel.textContent = `${val}ms`;
    };
    const syncFromNum = () => {
        let val = parseInt(spamSpeedNum.value, 10) || 200;
        val = Math.max(1, Math.min(800, val));
        spamSpeedNum.value = val;
        if (spamSpeedInput) spamSpeedInput.value = val;
        spamSpeedLabel.textContent = `${val}ms`;
        // if timers are running, adjust their intervals immediately
        ['left','down','up','right'].forEach(dir => {
            const s = spamTimers[dir];
            if (s && s.intervalId) {
                clearInterval(s.intervalId);
                s.intervalId = setInterval(() => spamTick(dir), currentSpamInterval());
            }
        });
    };

    spamSpeedInput.addEventListener('input', syncFromRange);
    if (spamSpeedNum) {
        spamSpeedNum.addEventListener('input', syncFromNum);
        // also sync when losing focus to enforce clamping
        spamSpeedNum.addEventListener('change', syncFromNum);
    }

    // initialize label
    syncFromRange();
}

// unified tick used by setInterval; keeps timing consistent and avoids recursive timeouts piling up
function spamTick(dir) {
    // only trigger if still held (key or alt) or button pressed
    const stillHeld = (dir === 'left' && (keys.left || keysAlt.left)) ||
                      (dir === 'down' && (keys.down || keysAlt.down)) ||
                      (dir === 'up' && (keys.up || keysAlt.up)) ||
                      (dir === 'right' && (keys.right || keysAlt.right));
    if (!stillHeld) {
        // stop this dir's interval if nothing is held
        stopSpam(dir);
        return;
    }
    const anim = singNameForKey(dir, (dir === 'left' ? keysAlt.left : dir === 'down' ? keysAlt.down : dir === 'up' ? keysAlt.up : keysAlt.right) || altToggle.checked);
    if (anim) {
        setAnimation(anim);
        triggerArrowPress(dir);
    }
}

 // start spamming for a direction: use setInterval so browser won't queue lots of nested timeouts
function startSpam(dir) {
    if (!spamToggle || !spamToggle.checked) {
        updateAnimationState(true);
        return;
    }
    // don't start if already spamming
    const s = spamTimers[dir] = spamTimers[dir] || {};
    if (s.running) return;

    // immediate trigger once
    spamTick(dir);

    s.running = true;
    // create an interval and store its id so we can clear/replace later
    s.intervalId = setInterval(() => {
        spamTick(dir);
    }, currentSpamInterval());
}

 // stop spamming for a direction
function stopSpam(dir) {
    const s = spamTimers[dir];
    if (s) {
        s.running = false;
        if (s.intervalId) {
            clearInterval(s.intervalId);
            s.intervalId = null;
        }
        if (s.timerId) { clearTimeout(s.timerId); s.timerId = null; }
    }
    // after stopping spam, refresh normal animation state
    updateAnimationState();
}

// allow quick keyboard toggle for spam mode via '1'
window.addEventListener('keydown', (ev) => {
    if (ev.key === '1' && ev.target && ev.target.tagName !== 'INPUT') {
        if (spamToggle) {
            spamToggle.checked = !spamToggle.checked;
            // when toggling off, ensure any active spam loops are stopped
            if (!spamToggle.checked) {
                ['left','down','up','right'].forEach(stopSpam);
            }
        }
    }
});

// touch / button support for mobile
['left','down','up','right'].forEach(dir => {
    const btn = document.getElementById(`btn-${dir}`);
    if (!btn) return;
    btn.addEventListener('pointerdown', () => {
        keys[dir] = true; btn.classList.add('active');
        // start spam if enabled, otherwise just update once
        if (spamToggle && spamToggle.checked) startSpam(dir);
        else updateAnimationState(true);
    });
    btn.addEventListener('pointerup', () => {
        keys[dir] = false; btn.classList.remove('active');
        stopSpam(dir);
    });
    btn.addEventListener('pointercancel', () => {
        keys[dir] = false; btn.classList.remove('active');
        stopSpam(dir);
    });
});

document.getElementById('btn-hey').addEventListener('click', () => { if (!isHeyPlaying) playHey(); });

function gameLoop(timestamp) {
    if (!lastFrameTime) lastFrameTime = timestamp;
    const deltaTime = timestamp - lastFrameTime;
    // use host animation for determining FPS
    const hostAnim = currentAnimation || 'idle';
    const frameDuration = (hostAnim.startsWith('sing')) ? 1000 / SING_FPS : 1000 / DEFAULT_FPS;

    if (deltaTime >= frameDuration) {
        const seq = animations[currentAnimation] || animations['idle'];
        currentFrameIndex++;
        // advance ghost frame in sync if present
        if (ghostAnimation) ghostFrameIndex++;

        if (currentAnimation === 'hey' && currentFrameIndex >= seq.length) {
            isHeyPlaying = false;
            currentAnimation = (keys.left || keys.down || keys.up || keys.right) ? currentAnimation : 'idle';
            currentFrameIndex = 0;
            ghostAnimation = null;
            ghostFrameIndex = 0;
        } else if (currentAnimation && currentAnimation.startsWith('sing')) {
            if (currentFrameIndex >= seq.length) {
                currentFrameIndex = seq.length - 1;
                if (returnToIdleTime === 0) returnToIdleTime = timestamp + 700;
                if (timestamp >= returnToIdleTime) {
                    returnToIdleTime = 0;
                    if (!(keys.left || keys.down || keys.up || keys.right)) { currentAnimation = 'idle'; currentFrameIndex = 0; ghostAnimation = null; ghostFrameIndex = 0; }
                }
            }
        } else if (currentFrameIndex >= seq.length) currentFrameIndex = 0;

        // clamp ghost frame to its sequence
        if (ghostAnimation) {
            const gseq = animations[ghostAnimation] || [];
            if (ghostFrameIndex >= gseq.length) ghostFrameIndex = gseq.length - 1;
        }

        lastFrameTime = timestamp;
    }

    // update arrows with the delta time (for their own timing)
    updateArrows(deltaTime);

    draw();
    requestAnimationFrame(gameLoop);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scale = (canvas.height * 0.8) / frameHeight;

    // draw ghost first (behind) if present
    if (ghostAnimation) {
        const gseq = animations[ghostAnimation] || animations['idle'];
        const gidx = Math.max(0, Math.min(ghostFrameIndex, gseq.length - 1));
        const globalGFrame = gseq[gidx];
        const gcol = globalGFrame % COLS, grow = Math.floor(globalGFrame / COLS);
        const [goffX, goffY] = offsets[ghostAnimation] || [0, 0];

        ctx.save();
        ctx.globalAlpha = 0.45;
        // draw slightly offset behind host for depth
        const ghostShift = -12 * scale;
        ctx.drawImage(spriteSheet, gcol * frameWidth, grow * frameHeight, frameWidth, frameHeight,
            ((canvas.width - frameWidth * scale) / 2) + (goffX * scale) + ghostShift,
            ((canvas.height - frameHeight * scale) / 2) + (canvas.height * 0.1) + (goffY * scale),
            frameWidth * scale, frameHeight * scale);
        ctx.restore();
    }

    // draw host
    const seq = animations[currentAnimation] || animations['idle'];
    const idx = Math.max(0, Math.min(currentFrameIndex, seq.length - 1));
    const globalFrame = seq[idx];
    const col = globalFrame % COLS, row = Math.floor(globalFrame / COLS);
    const [offX, offY] = offsets[currentAnimation] || [0, 0];
    // Before drawing host, draw arrows above BF: receptors then press frames if active
    drawArrowsAboveBF(scale, frameWidth, frameHeight);

    ctx.drawImage(spriteSheet, col * frameWidth, row * frameHeight, frameWidth, frameHeight,
        ((canvas.width - frameWidth * scale) / 2) + (offX * scale),
        ((canvas.height - frameHeight * scale) / 2) + (canvas.height * 0.1) + (offY * scale),
        frameWidth * scale, frameHeight * scale);
}

 // Draw receptors and arrow presses above BF
function drawArrowsAboveBF(scale, bfFrameW, bfFrameH) {
    // only draw arrows once resources and frame dimensions are available
    if (!isLoaded || !arrowFrameWidth || !arrowFrameHeight) return;
    // scale arrows smaller so they fit reliably above BF regardless of canvas size
    const arrowScale = Math.max(0.18, scale * 0.45); // clamp minimum so they remain visible
    // position the receptor line centered horizontally above BF.
    const bfW = bfFrameW * scale;
    const bfH = bfFrameH * scale;
    const centerX = canvas.width / 2;
    // place the receptor row slightly above BF top with a safe gap
    const bfTopY = ((canvas.height - bfH) / 2) + (canvas.height * 0.1);
    // allow user-controlled receptor Y offset (in pixels)
    const userArrowY = (offsets.arrows && typeof offsets.arrows.y === 'number') ? offsets.arrows.y : 0;
    const receptorY = Math.max(6, bfTopY - (arrowFrameHeight * arrowScale) - 12 + userArrowY); // ensure it doesn't go offscreen
    // spacing: choose spacing based on BF width but allow user override
    const userSpacing = (offsets.arrows && typeof offsets.arrows.spacing === 'number') ? offsets.arrows.spacing : 0;
    const totalWidth = Math.max(bfW * 0.55, arrowFrameWidth * arrowScale * 4 + 20) + userSpacing;
    const spacing = totalWidth / 3;
    const userStartX = (offsets.arrows && typeof offsets.arrows.startX === 'number') ? offsets.arrows.startX : 0;
    const startX = centerX - totalWidth / 2 + userStartX;

    // receptor mapping order: left, down, up, right
    receptorOrder.forEach((dir, i) => {
        // determine receptor frame index from mapping (explicit fallbacks)
        let receptorFrameIdx = 0;
        if (dir === 'left') receptorFrameIdx = (typeof arrowFrames.leftReceptor === 'number') ? arrowFrames.leftReceptor : 1;
        if (dir === 'down') receptorFrameIdx = (typeof arrowFrames.downReceptor === 'number') ? arrowFrames.downReceptor : 0;
        if (dir === 'up') receptorFrameIdx = (typeof arrowFrames.upReceptor === 'number') ? arrowFrames.upReceptor : 3;
        if (dir === 'right') receptorFrameIdx = (typeof arrowFrames.rightReceptor === 'number') ? arrowFrames.rightReceptor : 2;
        // receptor global frame -> col,row for arrow sheet
        const gIdx = receptorFrameIdx;
        const acol = gIdx % ARROW_COLS;
        const arow = Math.floor(gIdx / ARROW_COLS);
        // allow tiny per-direction X shifts via offsets.arrows.perDir if present (optional)
        const perDirShift = (offsets.arrows && offsets.arrows.perDir && offsets.arrows.perDir[dir]) ? offsets.arrows.perDir[dir] : 0;
        const x = startX + i * spacing - (arrowFrameWidth * arrowScale / 2) + perDirShift * arrowScale;
        const y = receptorY;
        ctx.drawImage(arrowSheet, acol * arrowFrameWidth, arow * arrowFrameHeight, arrowFrameWidth, arrowFrameHeight,
            x, y, arrowFrameWidth * arrowScale, arrowFrameHeight * arrowScale);

        // overlay press frame if in press mode
        const astate = arrowsState[dir];
        if (astate && (astate.mode === 'press' || astate.mode === 'receptor')) {
            // if press, draw press frame; otherwise receptor already drawn
            if (astate.mode === 'press') {
                const seq = astate.pressSeq || [];
                const idx = Math.max(0, Math.min(astate.frameIndex, seq.length - 1));
                const gf = seq[idx];
                const acol2 = gf % ARROW_COLS;
                const arow2 = Math.floor(gf / ARROW_COLS);
                ctx.drawImage(arrowSheet, acol2 * arrowFrameWidth, arow2 * arrowFrameHeight, arrowFrameWidth, arrowFrameHeight,
                    x, y, arrowFrameWidth * arrowScale, arrowFrameHeight * arrowScale);
            }
        }
    });
}