import { MidiParser } from 'midi-parser-js';
import { audioBufferToWav, parseTimecodeToSeconds, formatTime } from './midi-utils.js';
import { buildTrackInstrumentRoutingUI } from './midi-ui-helpers.js';
import { renderMidiToWavBlob as renderMidiToWavBlobExternal } from './midi-export.js';

const baseKeys = [
  { note: '1', key: 'q' },
  { note: '2', key: 'w' },
  { note: '3', key: 'e' },
  { note: '4', key: 'r' },
  { note: '5', key: 't' },
  { note: '6', key: 'y' },
  { note: '7', key: 'u' },
  { note: '8', key: 'i' },
  { note: '9', key: 'o' },
  { note: '10', key: 'p' },
  { note: '11', key: 'a' },
  { note: '12', key: 's' },
  { note: '13', key: 'd' },
  { note: '14', key: 'f' },
  { note: '15', key: 'g' },
  { note: '16', key: 'h' },
  { note: '17', key: 'j' },
  { note: '18', key: 'k' },
  { note: '19', key: 'l' },
  { note: '20', key: 'z' },
  { note: '21', key: 'x' },
  { note: '22', key: 'c' },
  { note: '23', key: 'v' },
  { note: '24', key: 'b' },
  { note: '25', key: 'n' },
  { note: '26', key: 'm' },
  { note: '27', key: ',' },
  { note: '28', key: '.' },
  { note: '29', key: '/' },
  { note: '30', key: "'" },
  { note: '31', key: '1' }
];

// BF2 uses only 11 notes mapped to qwertyuiopa
const bf2KeyLayout = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', 'a'];

// Current key layout (changes when instrument changes)
let currentKeys = [...baseKeys];
let currentInstrument = 'boyfriend'; // default instrument

const piano = document.querySelector('.piano');
const noteToKeyElementMap = new Map(); // Cache for key elements
let audioContext = null; // Initialize as null

const loadingIndicator = document.getElementById('loading-indicator');
const loadingText = document.getElementById('loading-text');

// Export progress UI elements
const exportProgressContainer = document.getElementById('export-progress-container');
const exportProgressBar = document.getElementById('export-progress-bar');
const exportProgressText = document.getElementById('export-progress-text');

// Separate render progress UI elements (for actual audio rendering phase)
const renderProgressContainer = document.getElementById('render-progress-container');
const renderProgressBar = document.getElementById('render-progress-bar');
const renderProgressText = document.getElementById('render-progress-text');

function setExportProgress(progress) {
  if (!exportProgressContainer || !exportProgressBar || !exportProgressText) return;
  const clamped = Math.max(0, Math.min(1, progress || 0));
  exportProgressContainer.style.display = 'block';
  exportProgressText.style.display = 'block';
  exportProgressBar.style.width = (clamped * 100).toFixed(1) + '%';
  exportProgressText.textContent = `${(clamped * 100).toFixed(1)}%`;
}

function resetExportProgress() {
  if (!exportProgressContainer || !exportProgressBar || !exportProgressText) return;
  exportProgressBar.style.width = '0%';
  exportProgressText.textContent = '0%';
  exportProgressContainer.style.display = 'none';
  exportProgressText.style.display = 'none';
}

function setRenderProgress(progress) {
  if (!renderProgressContainer || !renderProgressBar || !renderProgressText) return;
  const clamped = Math.max(0, Math.min(1, progress || 0));
  renderProgressContainer.style.display = 'block';
  renderProgressText.style.display = 'block';
  renderProgressBar.style.width = (clamped * 100).toFixed(1) + '%';
  renderProgressText.textContent = `${(clamped * 100).toFixed(1)}% (rendering)`;
}

function resetRenderProgress() {
  if (!renderProgressContainer || !renderProgressBar || !renderProgressText) return;
  renderProgressBar.style.width = '0%';
  renderProgressText.textContent = '0% (rendering)';
  renderProgressContainer.style.display = 'none';
  renderProgressText.style.display = 'none';
}

 // Separate buffers for each instrument
const boyfriendBuffers = {};
const orgeBuffers = {};
const bambiBuffers = {};
const banduBuffers = {};
const bf2Buffers = {};
const cedricBuffers = {};
const burgerBuffers = {};
const helloBuffers = {};
const freshBuffers = {};
const redmungusBuffers = {};
// Procedural "Piano" synth buffers (generated in JS, no audio files)
const pianoBuffers = {};

// Per-note active instruments for visual state
// Map: note(string) -> Set of instrument ids ('boyfriend','orge','bambi','bandu')
const keyNoteActiveInstruments = new Map();

// Visual state tracking for slide notes
// Map<trackIndex, { currentBend: number, activeNotes: Map<originalNote, {visualNote: string, instrument: string}> }>
let visualTrackState = new Map();

function getInstrumentKeyCount(instrumentId) {
  if (instrumentId === 'bambi') return 80;
  if (instrumentId === 'bandu') return 61;
  if (instrumentId === 'bf2') return 11;
  if (instrumentId === 'cedric') return 48;
  if (instrumentId === 'hello') return 48; // Hello Penguin instrument (approx size)
  if (instrumentId === 'burger') return 48;
  if (instrumentId === 'fresh') return 39;
  if (instrumentId === 'redmungus') return 60; // approximate upper bound for the uploaded redmungus markers
  // Catto uses 31 input keys mapped to different samples
  return 31;
}

function getBentNote(originalNote, bendSemitones, instrumentId) {
  const originalIndex = parseInt(originalNote, 10);
  if (isNaN(originalIndex)) return originalNote;
  
  const shift = Math.round(bendSemitones);
  if (shift === 0) return originalNote;
  
  let newIndex = originalIndex + shift;
  const maxKeys = getInstrumentKeyCount(instrumentId);
  
  if (instrumentId === 'bf2') {
    // BF2 wrapping logic (1-11)
    // Use modulo arithmetic for robust wrapping in both directions to support slide notes
    const wrappedIndex = ((newIndex - 1) % 11 + 11) % 11 + 1;
    return String(wrappedIndex);
  }
  
  // Clamp for others
  newIndex = Math.max(1, Math.min(maxKeys, newIndex));
  return String(newIndex);
}

// Instrument display names and visual styles
const instrumentDisplayNames = {
  boyfriend: 'Boyfriend',
  orge: 'Orge',
  bambi: 'Bambi',
  bandu: 'Bandu',
  daddy: 'Daddy Dearest',
  piano: 'Piano',
  bf2: 'BF2',
  cedric: 'Cedric',
  hello: 'Hello Penguin',
  fresh: 'Fresh BF',
  redmungus: 'Red Mungus'
};

const instrumentVisuals = {
  boyfriend: {
    background: 'linear-gradient(180deg, #a78bfa 0%, #7c3aed 100%)',
    boxShadow: '0 2px 8px rgba(0, 242, 255, 0.7)',
    color: '#ffffff'
  },
  piano: {
    background: 'linear-gradient(180deg, #ffd54f 0%, #ff9800 100%)',
    boxShadow: '0 2px 8px rgba(255, 152, 0, 0.8)',
    color: '#1b1307'
  },
  orge: {
    background: 'linear-gradient(180deg, #ffb74d 0%, #ff8a00 100%)',
    boxShadow: '0 2px 8px rgba(255, 167, 38, 0.8)',
    color: '#1b1307'
  },
  bambi: {
    background: 'linear-gradient(180deg, #81c784 0%, #388e3c 100%)',
    boxShadow: '0 2px 8px rgba(102, 187, 106, 0.8)',
    color: '#ffffff'
  },
  bandu: {
    background: 'linear-gradient(180deg, #81c784 0%, #a78bfa 100%)',
    boxShadow: '0 2px 10px rgba(0, 242, 255, 0.8)',
    color: '#ffffff'
  },
  daddy: {
    background: 'linear-gradient(180deg, #ba68c8 0%, #7b1fa2 100%)',
    boxShadow: '0 2px 8px rgba(186,104,200,0.9)',
    color: '#ffffff'
  },
  bf2: {
    background: 'linear-gradient(180deg, #fff59d 0%, #ffeb3b 100%)',
    boxShadow: '0 2px 10px rgba(255,235,59,0.9)',
    color: '#3a3a00'
  },
  cedric: {
    background: 'linear-gradient(180deg, #8d6e63 0%, #5d4037 100%)',
    boxShadow: '0 2px 10px rgba(93,64,55,0.9)',
    color: '#fff3e0'
  },
  hello: {
    background: 'linear-gradient(180deg, #b3e5fc 0%, #81d4fa 100%)',
    boxShadow: '0 2px 10px rgba(129,212,250,0.8)',
    color: '#052a36'
  },
  fresh: {
    background: 'linear-gradient(180deg, #ff4081 0%, #7c4dff 100%)',
    boxShadow: '0 2px 8px rgba(255, 64, 129, 0.8)',
    color: '#ffffff'
  },
  burger: {
    background: 'linear-gradient(180deg, #8b6b45 0%, #6f552f 100%)', /* dark tan -> deeper tan gradient */
    boxShadow: '0 2px 8px rgba(111,85,47,0.85)',
    color: '#fff7ec'
  },
  redmungus: {
    background: 'linear-gradient(180deg, #8b3b3b 0%, #4a2a2a 100%)',
    boxShadow: '0 2px 8px rgba(138,56,56,0.85)',
    color: '#fff3f3'
  }
};

function getOrCreateInstrumentSetForNote(note) {
  if (!keyNoteActiveInstruments.has(note)) {
    keyNoteActiveInstruments.set(note, new Set());
  }
  return keyNoteActiveInstruments.get(note);
}

function applyVisualForInstrumentsOnKey(keyElement, instrumentsSet) {
  if (!keyElement) return;
  const labelEl = keyElement.querySelector('.key-label');
  const baseLabel = keyElement.dataset.baseLabel || '';

  const instruments = Array.from(instrumentsSet || []);
  if (instruments.length === 0) {
    // Reset to default visual
    keyElement.style.background = '';
    keyElement.style.boxShadow = '';
    keyElement.style.color = '';
    keyElement.classList.remove('white-key', 'black-key');
    if (labelEl) {
      labelEl.textContent = baseLabel;
    }
    keyElement.classList.remove('midi-active');
    return;
  }

  // Special handling for Piano: random white/black key appearance
  if (instruments.includes('piano')) {
    // Clear any inline styles so CSS classes control the look
    keyElement.style.background = '';
    keyElement.style.boxShadow = '';
    keyElement.style.color = '';

    // Randomly choose white or black each time the piano is active on this key
    keyElement.classList.remove('white-key', 'black-key');
    const randomClass = Math.random() < 0.5 ? 'white-key' : 'black-key';
    keyElement.classList.add(randomClass);
  } else {
    // Choose visual based on first instrument in the set
    const primaryInstrument = instruments[0];
    const vis = instrumentVisuals[primaryInstrument];
    if (vis) {
      keyElement.style.background = vis.background;
      keyElement.style.boxShadow = vis.boxShadow;
      keyElement.style.color = vis.color;
    }
    // Ensure piano-specific classes are removed when not using piano
    keyElement.classList.remove('white-key', 'black-key');
  }

  // Label text: show instruments when multiple, otherwise keep base label
  if (labelEl) {
    const primaryInstrument =
      instruments.includes('piano') && instruments.length === 1
        ? 'piano'
        : instruments[0];

    if (instruments.length === 1) {
      labelEl.textContent = baseLabel || instrumentDisplayNames[primaryInstrument] || '';
    } else {
      const names = instruments.map(id => instrumentDisplayNames[id] || id);
      if (names.length === 2) {
        labelEl.textContent = `(${names[0]} and ${names[1]})`;
      } else {
        // For 3+ instruments, join with commas and 'and'
        const last = names.pop();
        labelEl.textContent = `(${names.join(', ')} and ${last})`;
      }
    }
  }

  // Keep midi-active class while any instruments are active
  keyElement.classList.add('midi-active');
}

function resetAllKeyVisuals() {
  keyNoteActiveInstruments.clear();
  document.querySelectorAll('.key').forEach(keyElement => {
    keyElement.style.background = '';
    keyElement.style.boxShadow = '';
    keyElement.style.color = '';
    const labelEl = keyElement.querySelector('.key-label');
    if (labelEl && keyElement.dataset.baseLabel !== undefined) {
      labelEl.textContent = keyElement.dataset.baseLabel;
    }
    keyElement.classList.remove('midi-active');
  });
}

function registerInstrumentOnNote(note, instrumentId) {
  const set = getOrCreateInstrumentSetForNote(note);
  set.add(instrumentId);
  const keyElement = piano.querySelector(`[data-note="${note}"]`);
  applyVisualForInstrumentsOnKey(keyElement, set);
}

function unregisterInstrumentOnNote(note, instrumentId) {
  if (!keyNoteActiveInstruments.has(note)) return;
  const set = keyNoteActiveInstruments.get(note);
  set.delete(instrumentId);
  if (set.size === 0) {
    keyNoteActiveInstruments.delete(note);
  }
  const keyElement = piano.querySelector(`[data-note="${note}"]`);
  applyVisualForInstrumentsOnKey(keyElement, set);
}

// MIDI-level state
let parsedMidiData = null;          // Parsed MIDI object for current file
let rawMidiBuffer = null;            // Raw MIDI bytes of currently loaded file
const trackInstrumentMap = {};      // trackIndex -> instrument id
const trackVolumeMap = {};          // trackIndex -> volume (1–200, default 100)
const trackPitchShiftMap = {};      // trackIndex -> pitch shift (semitones)

// Track active sound sources for manual playing
const activeSources = {};

// Current instrument: 'boyfriend' (default) or 'orge'
const speedUpButton = document.getElementById('speedup-loading-btn');

let audioLoadingStarted = false;
let speedUpRequested = false;

// Global variable to store the name of the loaded MIDI file
let currentMidiFileName = '';
// Global variable for pitch shift
let pitchShift = 0; // In semitones
let userTempoMap = null; // Store user-defined tempo changes

// Pitch shift control elements
const pitchShiftSlider = document.getElementById('pitch-shift-slider');
const pitchShiftValueSpan = document.getElementById('pitch-shift-value');

let playbackSpeed = 1;

// Instrumental playback state
let instrumentalBuffer = null;
let instrumentalGainNode = null;
let instrumentalSource = null;
let instrumentalVolume = 100; // 0–200 UI, mapped to 0–2 gain
let instrumentalStartTime = 0;
let instrumentalOffsetAtPause = 0; // stored as song time (seconds)
let instrumentalOffsetMs = 0; // additional offset applied to instrumental relative to MIDI (milliseconds, can be negative)
let isInstrumentalPlaying = false;
let totalMidiDuration = 0;
let progressUpdateInterval = null;
let isDraggingProgress = false;

// Optimize progress update frequency for better performance
const PROGRESS_UPDATE_INTERVAL = 100; // Increased from 50ms to 100ms for less frequent updates

const speedSlider = document.getElementById('speed-slider');
const speedInput = document.getElementById('speed-input');

// Instrumental controls
const instrumentalFileInput = document.getElementById('instrumental-file-input');
const instrumentalVolumeSlider = document.getElementById('instrumental-volume-slider');
const instrumentalVolumeValue = document.getElementById('instrumental-volume-value');
const instrumentalOffsetSlider = document.getElementById('instrumental-offset-slider');
const instrumentalOffsetValue = document.getElementById('instrumental-offset-value');
speedSlider.setAttribute('max', '5');  // Keep max at 5
speedSlider.setAttribute('step', '0.001');  // Change step from 0.125 to 0.05 for finer control

const progressBar = document.querySelector('.progress-bar');
const progressContainer = document.querySelector('.progress-container');

// Initialize audio context on first user interaction
function initAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
}

// --- MIDI Playback State ---
let isMidiPaused = false;
let scheduledSources = []; // To hold sources for the current MIDI playback
let scheduledEvents = []; // For visualizing MIDI events (using RAF)
let animationFrameId = null; // For the animation frame of MIDI visual events
let finalVisualTimeout = null; // Timeout for the final state reset after MIDI playback

// Global variable to store the absolute time when MIDI playback started (or resumed)
let midiPlaybackAbsoluteStartTime = null;
// Global variable to store the relative time into the MIDI when it was paused
let midiPlaybackRelativePauseTime = 0;

// --- Audio Loading ---
loadingIndicator.style.display = 'block';

// Wait for user interaction before loading audio
document.addEventListener('click', loadAudioOnFirstClick, { once: true });
document.addEventListener('keydown', loadAudioOnFirstClick, { once: true });

function loadAudioOnFirstClick() {
  if (audioLoadingStarted) return;
  audioLoadingStarted = true;
  initAudioContext();
  ensurePianoBuffers();
  loadAllAudio();
}

// Speed up loading button: request faster load and trigger a random key once ready
if (speedUpButton) {
  speedUpButton.addEventListener('click', (e) => {
    e.stopPropagation();
    speedUpRequested = true;
    loadAudioOnFirstClick();
  });
}

function triggerRandomKeyPress() {
  const randomKey = currentKeys[Math.floor(Math.random() * currentKeys.length)];
  const keyElement = piano.querySelector(`[data-note="${randomKey.note}"]`);
  if (!keyElement) return;

  keyElement.classList.add('active');
  playNote(randomKey.note);
  setTimeout(() => {
    keyElement.classList.remove('active');
    stopNote(randomKey.note);
  }, 200);
}

function ensurePianoBuffers() {
  if (!audioContext) return;
  // Generate simple voiced-piano style buffers for notes 1–31
  for (let i = 1; i <= 31; i++) {
    const key = String(i);
    if (pianoBuffers[key]) continue;

    const sampleRate = audioContext.sampleRate || 44100;
    const duration = 1.6; // seconds
    const length = Math.floor(sampleRate * duration);
    const buffer = audioContext.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    // Map our note index to a MIDI note (same base as Boyfriend)
    const midiNote = 48 + (i - 1); // C3 = 48
    const freq = 440 * Math.pow(2, (midiNote - 69) / 12);

    const attack = 0.01;
    const decay = 0.25;
    const sustain = 0.55;
    const release = 0.4;

    // Cycle through 4 “vowel” flavours across the keyboard
    const vowelIndex = (i - 1) % 4;

    for (let n = 0; n < length; n++) {
      const t = n / sampleRate;

      // ADSR envelope
      let env;
      if (t < attack) {
        env = t / attack;
      } else if (t < attack + decay) {
        const d = (t - attack) / decay;
        env = 1 + (sustain - 1) * d;
      } else if (t < duration - release) {
        env = sustain;
      } else {
        const r = (t - (duration - release)) / release;
        env = sustain * Math.max(0, 1 - r);
      }

      // Base “piano” harmonics
      const w = 2 * Math.PI * freq * t;
      let sample =
        0.7 * Math.sin(w) +
        0.25 * Math.sin(2 * w) +
        0.12 * Math.sin(3 * w);

      // Simple vowel-ish coloration by tweaking higher partials
      if (vowelIndex === 0) {
        // "oooo" – darker
        sample += 0.08 * Math.sin(4 * w);
      } else if (vowelIndex === 1) {
        // "eeee" – brighter
        sample += 0.18 * Math.sin(4 * w) + 0.08 * Math.sin(5 * w);
      } else if (vowelIndex === 2) {
        // "aaaa" – mid-forward
        sample += 0.14 * Math.sin(4 * w) + 0.06 * Math.sin(6 * w);
      } else {
        // "uuuu" – rounded
        sample += 0.1 * Math.sin(4 * w);
      }

      // Gentle non-linearity for a bit of character
      sample = Math.tanh(sample * 1.2);

      data[n] = sample * env * 0.9; // final level
    }

    pianoBuffers[key] = buffer;
  }
}

// Generic audio loader that supports .ogg, .mp3, .wav, etc.
function loadAudioBuffer(path) {
  return fetch(path)
    .then(response => {
      if (!response.ok) {
        console.error(`Failed to load sound (HTTP ${response.status}): ${path}`);
        // Resolve with null so other sounds can still load
        return null;
      }
      return response.arrayBuffer();
    })
    .then(buffer => {
      if (!buffer) return null;
      return audioContext.decodeAudioData(buffer).catch(err => {
        console.error(`Failed to decode sound: ${path}`, err);
        // Resolve with null on decode error instead of throwing
        return null;
      });
    })
    .catch(err => {
      console.error(`Unexpected error loading sound: ${path}`, err);
      // Swallow errors so Promise.all doesn't reject
      return null;
    });
}

function loadAllAudio() {
  // Boyfriend samples (per key, mostly .ogg)
  const boyfriendPromises = baseKeys.map(key => {
    const note = (key.note === '31') ? '30' : key.note;
    const path = `/markers/boyfriend/marker ${note} boyfriend.ogg`;
    return loadAudioBuffer(path).then(decodedBuffer => {
      boyfriendBuffers[key.note] = decodedBuffer;
    });
  });

  // Orge voice samples (keys k to x => notes 18–21)
  const orgeFiles = [
    { id: 'ee',  path: '/markers/orge/marker ee orge.mp3'  },
    { id: 'aah', path: '/markers/orge/marker aah orge.mp3' },
    { id: 'uu',  path: '/markers/orge/marker uu orge.mp3'  },
    { id: 'ooh', path: '/markers/orge/marker ooh orge.mp3' }
  ];

  const orgePromises = orgeFiles.map(f =>
    loadAudioBuffer(f.path).then(decodedBuffer => {
      orgeBuffers[f.id] = decodedBuffer;
    })
  );

  // Bambi markers 1–80 (all .wav)
  const bambiPromises = [];
  for (let i = 1; i <= 80; i++) {
    const path = `/markers/bambi/marker ${i} bambi.wav`;
    bambiPromises.push(
      loadAudioBuffer(path).then(decodedBuffer => {
        bambiBuffers[String(i)] = decodedBuffer;
      })
    );
  }

  // Bandu markers 1–61 (all .wav)
  const banduPromises = [];
  for (let i = 1; i <= 61; i++) {
    const path = `/markers/bandu/marker ${i} bandu.wav`;
    banduPromises.push(
      loadAudioBuffer(path).then(decodedBuffer => {
        banduBuffers[String(i)] = decodedBuffer;
      })
    );
  }

  // BF2 markers 1–11 (all .wav)
  const bf2Promises = [];
  for (let i = 1; i <= 11; i++) {
    const path = `/markers/bf2/marker ${i} bf2.wav`;
    bf2Promises.push(
      loadAudioBuffer(path).then(decodedBuffer => {
        bf2Buffers[String(i)] = decodedBuffer;
      })
    );
  }

  // Cedric markers 1–48 (all .wav)
  const cedricPromises = [];
  for (let i = 1; i <= 48; i++) {
    const path = `/markers/cedric/marker ${i} cedric.wav`;
    cedricPromises.push(
      loadAudioBuffer(path).then(decodedBuffer => {
        cedricBuffers[String(i)] = decodedBuffer;
      })
    );
  }


  // Hello Penguin samples
  const helloPromises = [];
  for (let i = 1; i <= 48; i++) {
    const path = `/markers/hello/marker ${i} hello.wav`;
    helloPromises.push(
      loadAudioBuffer(path).then(decodedBuffer => {
        if (decodedBuffer) helloBuffers[String(i)] = decodedBuffer;
      })
    );
  }

  // Fresh BF markers 1–39
  const freshPromises = [];
  for (let i = 1; i <= 39; i++) {
    const path = `/markers/fresh/marker ${i} fresh.wav`;
    freshPromises.push(
      loadAudioBuffer(path).then(decodedBuffer => {
        freshBuffers[String(i)] = decodedBuffer;
      })
    );
  }

  // Burger markers
  const burgerPromises = [];
  for (let i = 1; i <= 48; i++) {
    const path = `/markers/burger/marker ${i} burger.wav`;
    burgerPromises.push(
      loadAudioBuffer(path).then(decodedBuffer => {
        burgerBuffers[String(i)] = decodedBuffer;
      })
    );
  }

  // Red Mungus markers
  const redmungusPromises = [];
  const redCount = 60;
  for (let i = 1; i <= redCount; i++) {
    const path = `/markers/redmungus/marker ${i} redmungus.wav`;
    redmungusPromises.push(
      loadAudioBuffer(path).then(decodedBuffer => {
        redmungusBuffers[String(i)] = decodedBuffer || null;
      })
    );
  }

  Promise.all([...boyfriendPromises, ...orgePromises, ...bambiPromises, ...banduPromises, ...bf2Promises, ...cedricPromises, ...burgerPromises, ...redmungusPromises, ...helloPromises, ...freshPromises])
    .then(() => {
      if (speedUpRequested) {
        triggerRandomKeyPress();
      }
      loadingIndicator.style.display = 'none';
      console.log("All sounds loaded (Boyfriend + Orge + Bambi + Burger + Red Mungus + Hello samples).");
    })
    .catch(error => {
      loadingText.textContent = "Error loading sounds. Please refresh and try again.";
      console.error("Error loading sounds:", error);
    });
}

// Helper to choose buffer + playbackRate based on current instrument
// Helper that can target a specific instrument (used for MIDI routing)
function getInstrumentBufferAndRateForInstrument(note, instrumentId, basePlaybackRate = 1) {
  const noteIndex = parseInt(note, 10);

  // Helper: read current Orge offset (ms) from inputs and convert to seconds
  function getOrgeOffsetSecondsForId(id) {
    let inputEl = null;
    if (id === 'aah') inputEl = document.getElementById('orge-offset-aah');
    else if (id === 'ee') inputEl = document.getElementById('orge-offset-ee');
    else if (id === 'ooh') inputEl = document.getElementById('orge-offset-ooh');
    else if (id === 'uu') inputEl = document.getElementById('orge-offset-uu');

    if (!inputEl) return 0;
    const ms = parseFloat(inputEl.value);
    if (isNaN(ms) || ms < 0) return 0;
    return ms / 1000;
  }

  if (instrumentId === 'piano') {
    const buffer = pianoBuffers[note] || null;
    // Piano buffers are already rendered at the target pitch, so basePlaybackRate stays 1
    return { buffer, playbackRate: basePlaybackRate, offsetSeconds: 0 };
  }

  if (instrumentId === 'orge') {
    // Loop through Orge sounds in order: aah → ee → ooh → uu → aah → ...
    const pattern = ['aah', 'ee', 'ooh', 'uu'];
    const patternIndex = (noteIndex - 1) % pattern.length;
    const bufferId = pattern[patternIndex];
    const buffer = orgeBuffers[bufferId] || null;

    // Make each higher key strictly higher in pitch than the previous one.
    // Key 1 keeps its current pitch, and every next key goes up by 1 semitone.
    const firstKeySemitoneOffset = -15; // matches the old pitch of key 1 (1 - centerKey where centerKey = 16)
    const semitoneDiffFromKey1 = (noteIndex - 1); // 0 for key 1, +1 for key 2, etc.
    const totalSemitoneDiff = firstKeySemitoneOffset + semitoneDiffFromKey1;
    const playbackRate = basePlaybackRate * Math.pow(2, totalSemitoneDiff / 12);

    const offsetSeconds = getOrgeOffsetSecondsForId(bufferId);

    return { buffer, playbackRate, offsetSeconds };
  }

  if (instrumentId === 'daddy') {
    // Daddy Dearest: reuse Boyfriend samples at 0.5 pitch
    const buffer = boyfriendBuffers[note] || null;
    return { buffer, playbackRate: basePlaybackRate * 0.5, offsetSeconds: 0 };
  }

  if (instrumentId === 'bambi') {
    const buffer = bambiBuffers[note] || null;
    return { buffer, playbackRate: basePlaybackRate, offsetSeconds: 0 };
  }

  if (instrumentId === 'bandu') {
    const buffer = banduBuffers[note] || null;
    return { buffer, playbackRate: basePlaybackRate, offsetSeconds: 0 };
  }

  if (instrumentId === 'bf2') {
    const buffer = bf2Buffers[note] || null;
    // BF2 should never be pitched up or down at playback time; always use rate 1
    return { buffer, playbackRate: 1, offsetSeconds: 0 };
  }

  if (instrumentId === 'cedric') {
    const buffer = cedricBuffers[note] || null;
    return { buffer, playbackRate: basePlaybackRate, offsetSeconds: 0 };
  }

  if (instrumentId === 'hello') {
    // Map note indices into the Hello Penguin marker set.
    // Shift the mapping upward so notes target a higher "average" region of markers.
    const maxHello = 48; // safe default for number of Hello samples
    const mappingOffset = 8; // shift notes upward by this many markers to bias toward higher markers
    // Map the incoming note index (1..31) into the Hello marker range, applying the offset,
    // then clamp so we never exceed available markers.
    let idx = noteIndex + mappingOffset;
    idx = Math.max(1, Math.min(maxHello, idx));
    const fileKey = String(idx);
    const buffer = helloBuffers[fileKey] || null;
    return { buffer, playbackRate: basePlaybackRate, offsetSeconds: 0 }; // start at sample start
  }

  if (instrumentId === 'burger') {
    // Map note indices into the Burger marker set (1–48).
    // Bias mapping toward middle markers so center keys target middle Burger samples.
    const maxBurger = 48;
    // center shift: map key 16 -> ~24 (middle), using an offset of +8
    let idx = noteIndex + 8;
    idx = Math.max(1, Math.min(maxBurger, idx));
    const buffer = burgerBuffers[String(idx)] || null;
    return { buffer, playbackRate: basePlaybackRate, offsetSeconds: 0 };
  }

  if (instrumentId === 'redmungus') {
    // Map note indices into the Red Mungus marker set (1..approx redCount)
    const maxRed = 60;
    // Give a mild upward bias so middle keys hit middle-range samples
    let idx = noteIndex + 6;
    idx = Math.max(1, Math.min(maxRed, idx));
    const buffer = redmungusBuffers[String(idx)] || null;
    return { buffer, playbackRate: basePlaybackRate, offsetSeconds: 0 };
  }

  if (instrumentId === 'fresh') {
    const buffer = freshBuffers[note] || null;
    return { buffer, playbackRate: basePlaybackRate, offsetSeconds: 0 };
  }

  // Default Boyfriend instrument
  const buffer = boyfriendBuffers[note] || null;
  return { buffer, playbackRate: basePlaybackRate, offsetSeconds: 0 };
}

// Existing helper kept for manual piano (uses currentInstrument)
function getInstrumentBufferAndRate(note, basePlaybackRate = 1) {
  const noteIndex = parseInt(note, 10);
  return getInstrumentBufferAndRateForInstrument(note, currentInstrument, basePlaybackRate);
}

function playNote(note) {
  initAudioContext(); // Ensure audio context is ready
  
  // Stop any existing sound for this note
  stopNote(note);

  const { buffer, playbackRate, offsetSeconds } = getInstrumentBufferAndRate(note, 1);
  if (buffer) {
    const source = audioContext.createBufferSource();
    const gainNode = audioContext.createGain();
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;
    
    source.connect(gainNode); // Connect directly to gainNode
    gainNode.connect(audioContext.destination);
    // Start at current time, applying Orge offset (if any) as the buffer playback offset
    try {
      source.start(0, offsetSeconds || 0);
    } catch (e) {
      // Fallback without offset if something goes wrong
      source.start();
    }
    
    // Store nodes for release, including the instrument used
    activeSources[note] = {
      source,
      gainNode,
      startTime: audioContext.currentTime,
      instrument: currentInstrument
    };
  }
}

function stopNote(note) {
  if (activeSources[note]) {
    const { source, gainNode, startTime, instrument } = activeSources[note];
    
    // Immediately update visual state (audio tail may still play during release)
    if (instrument) {
      unregisterInstrumentOnNote(note, instrument);
    }

    if (releaseTime > 0) {
      const now = audioContext.currentTime;
      gainNode.gain.setValueAtTime(1, now);
      gainNode.gain.linearRampToValueAtTime(0, now + releaseTime);
      setTimeout(() => {
        try {
          source.stop();
        } catch(e) {}
        delete activeSources[note];
      }, releaseTime * 1000);
    } else {
      try {
        source.stop();
      } catch(e) {}
      delete activeSources[note];
    }
  }
}

// Add UI controls for reverb and release
const releaseSlider = document.getElementById('release-slider');
const releaseValue = document.getElementById('release-value');

let releaseTime = 0;

releaseSlider.addEventListener('input', () => {
  releaseTime = parseFloat(releaseSlider.value);
  releaseValue.textContent = releaseTime.toFixed(2) + 's';
});

// --- Key Creation & Manual Controls ---
function createKeyElement(keyData) {
  const keyElement = document.createElement('div');
  keyElement.className = 'key';
  keyElement.dataset.note = keyData.note;
  
  const label = document.createElement('div');
  label.className = 'key-label';
  label.textContent = keyData.key || '';
  // Remember the base label for later restoration when instruments change
  keyElement.dataset.baseLabel = label.textContent;
  keyElement.appendChild(label);

  // Mouse events
  keyElement.addEventListener('mousedown', () => {
    keyElement.classList.add('active');
    playNote(keyData.note);
    // Register current instrument visually on mouse press
    registerInstrumentOnNote(keyData.note, currentInstrument);
  });

  keyElement.addEventListener('mouseup', () => {
    keyElement.classList.remove('active');
    stopNote(keyData.note);
  });

  keyElement.addEventListener('mouseleave', () => {
    if (keyElement.classList.contains('active')) {
      keyElement.classList.remove('active');
      stopNote(keyData.note);
    }
  });

  // Touch events
  keyElement.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Prevent default touch behavior
    keyElement.classList.add('active');
    playNote(keyData.note);
    // Register current instrument visually on touch press
    registerInstrumentOnNote(keyData.note, currentInstrument);
  }, { passive: false });

  keyElement.addEventListener('touchend', (e) => {
    e.preventDefault();
    keyElement.classList.remove('active');
    stopNote(keyData.note);
  }, { passive: false });

  keyElement.addEventListener('touchcancel', (e) => {
    e.preventDefault();
    keyElement.classList.remove('active');
    stopNote(keyData.note);
  }, { passive: false });

  return keyElement;
}

function buildPianoLayout() {
  piano.innerHTML = '';
  noteToKeyElementMap.clear();
  piano.classList.toggle('bambi-layout', currentInstrument === 'bambi' || currentInstrument === 'bandu' || currentInstrument === 'fresh');
  // Mark when we're in Piano mode so CSS can avoid Boyfriend-style coloring
  piano.classList.toggle('piano-mode', currentInstrument === 'piano');

  if (currentInstrument === 'bambi') {
    // 80-note Bambi piano; reuse existing key labels for first 31 keys, then unlabeled
    const labelMap = {};
    baseKeys.forEach(k => { labelMap[k.note] = k.key; });

    currentKeys = [];
    for (let i = 1; i <= 80; i++) {
      const noteStr = String(i);
      const label = labelMap[noteStr] || '';
      const keyData = { note: noteStr, key: label };
      currentKeys.push(keyData);
      const el = createKeyElement(keyData);
      piano.appendChild(el);
      noteToKeyElementMap.set(noteStr, el);
    }
  } else if (currentInstrument === 'bandu') {
    // 61-note Bandu piano; reuse existing key labels for first 31 keys, then unlabeled
    const labelMap = {};
    baseKeys.forEach(k => { labelMap[k.note] = k.key; });

    currentKeys = [];
    for (let i = 1; i <= 61; i++) {
      const noteStr = String(i);
      const label = labelMap[noteStr] || '';
      const keyData = { note: noteStr, key: label };
      currentKeys.push(keyData);
      const el = createKeyElement(keyData);
      piano.appendChild(el);
      noteToKeyElementMap.set(noteStr, el);
    }
  } else if (currentInstrument === 'fresh') {
    // 39-note Fresh BF piano
    const labelMap = {};
    baseKeys.forEach(k => { labelMap[k.note] = k.key; });

    currentKeys = [];
    for (let i = 1; i <= 39; i++) {
      const noteStr = String(i);
      const label = labelMap[noteStr] || '';
      const keyData = { note: noteStr, key: label };
      currentKeys.push(keyData);
      const el = createKeyElement(keyData);
      piano.appendChild(el);
      noteToKeyElementMap.set(noteStr, el);
    }
  } else if (currentInstrument === 'bf2') {
    // BF2: only 11 notes, mapped to qwertyuiopa
    currentKeys = [];
    for (let i = 1; i <= 11; i++) {
      const noteStr = String(i);
      const label = bf2KeyLayout[i - 1] || '';
      const keyData = { note: noteStr, key: label };
      currentKeys.push(keyData);
      const el = createKeyElement(keyData);
      piano.appendChild(el);
      noteToKeyElementMap.set(noteStr, el);
    }
  } else {
    // Boyfriend / Orge / Daddy / Piano use the original 31-key layout
    currentKeys = [...baseKeys];
    currentKeys.forEach(keyData => {
      const el = createKeyElement(keyData);
      piano.appendChild(el);
      noteToKeyElementMap.set(keyData.note, el);
    });
  }
}

// Initial build
buildPianoLayout();

// Keyboard controls
document.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  
  const keyData = currentKeys.find(k => k.key === e.key.toLowerCase());
  if (keyData) {
    const keyElement = piano.querySelector(`[data-note="${keyData.note}"]`);
    if (keyElement) { // Check if element exists
      keyElement.classList.add('active');
      playNote(keyData.note);
      registerInstrumentOnNote(keyData.note, currentInstrument);
    }
  }
});

document.addEventListener('keyup', (e) => {
  const keyData = currentKeys.find(k => k.key === e.key.toLowerCase());
  if (keyData) {
    const keyElement = piano.querySelector(`[data-note="${keyData.note}"]`);
    if (keyElement) { // Check if element exists
      keyElement.classList.remove('active');
      stopNote(keyData.note);
    }
  }
});

// Add export button reference
const exportBtn = document.getElementById('export-btn');
exportBtn.addEventListener('click', triggerWavDownload);

// New button for commenting

// Pitch shift control event listener
pitchShiftSlider.addEventListener('input', () => {
    pitchShift = parseInt(pitchShiftSlider.value, 10);
    pitchShiftValueSpan.textContent = pitchShift;

    // If MIDI is loaded and not explicitly stopped, re-schedule playback with new pitch
    if (rawMidiBuffer && midiPlaybackAbsoluteStartTime !== null) {
        const currentRelativeTime = (audioContext.currentTime - midiPlaybackAbsoluteStartTime) * playbackSpeed;
        // Force a re-schedule with the new pitch
        playMidi(currentRelativeTime); 
        // Maintain 'playing' state if it was playing, or 'loaded' if it was stopped/paused
        updateMidiControlState(isMidiPaused ? 'paused' : 'playing'); // This state needs to be carefully managed
    } else if (rawMidiBuffer) {
        // MIDI is loaded but not playing (e.g., stopped or paused).
        // No need to restart, just update the state of controls.
        updateMidiControlState(isMidiPaused ? 'paused' : 'loaded');
    }
});

// Add speed control event listeners
speedSlider.addEventListener('input', () => {
    playbackSpeed = parseFloat(speedSlider.value);
    speedInput.value = playbackSpeed.toFixed(3);
    
    updatePlaybackSpeed();
});

speedInput.addEventListener('input', () => {
    let value = parseFloat(speedInput.value);
    
    // Clamp value between min and max
    value = Math.max(0.25, Math.min(5, value));
    
    playbackSpeed = value;
    speedSlider.value = value;
    
    updatePlaybackSpeed();
});

speedInput.addEventListener('blur', () => {
    // Ensure the displayed value is properly formatted with 3 decimal places
    speedInput.value = parseFloat(speedInput.value).toFixed(3);
});

function updatePlaybackSpeed() {
    // If MIDI is playing, restart from current position with new speed
    if (rawMidiBuffer && midiPlaybackAbsoluteStartTime !== null) {
        const currentRelativeTime = (audioContext.currentTime - midiPlaybackAbsoluteStartTime) * playbackSpeed;
        playMidi(currentRelativeTime);

        // Also restart instrumental at matching position with updated speed
        if (!isMidiPaused && instrumentalBuffer) {
          startInstrumental(currentRelativeTime);
        }

        updateMidiControlState(isMidiPaused ? 'paused' : 'playing');
    }
}

// Add progress bar event listeners
progressContainer.addEventListener('mousedown', (e) => {
    if (!rawMidiBuffer) return;
    isDraggingProgress = true;
    progressBar.classList.add('seeking');
    updateProgressFromMouse(e);
});

document.addEventListener('mousemove', (e) => {
    if (isDraggingProgress) {
        updateProgressFromMouse(e);
    }
});

document.addEventListener('mouseup', () => {
    if (isDraggingProgress) {
        isDraggingProgress = false;
        progressBar.classList.remove('seeking');
        if (rawMidiBuffer) {
            const progress = parseFloat(progressBar.style.width) / 100;
            const seekTime = totalMidiDuration * progress;
            seekToPosition(seekTime);
        }
    }
});

function updateProgressFromMouse(e) {
    const rect = progressContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const progress = Math.max(0, Math.min(1, x / width)) * 100;
    progressBar.style.width = progress + '%';
}

function seekToPosition(seekTime) {
    if (!rawMidiBuffer) return;
    
    // Always re-schedule playback from the new seek time
    stopCurrentPlayback();
    playMidi(seekTime);

    // Handle instrumental sync on seek
    if (instrumentalBuffer) {
      if (isMidiPaused) {
        // Just remember the song-time position; don't start playback
        instrumentalOffsetAtPause = seekTime;
      } else {
        startInstrumental(seekTime);
      }
    }
    
    // If we were paused before seeking, remain paused at new position
    if (isMidiPaused) {
        audioContext.suspend(); // Re-suspend if it was paused
        midiPlaybackRelativePauseTime = seekTime; // Update pause time to reflect seek
        updateMidiControlState('paused');
    } else {
        updateMidiControlState('playing');
    }
}

function stopCurrentPlayback() {
    // Stop all currently scheduled sources
    scheduledSources.forEach(source => {
        try {
            source.stop(); // Stop sources immediately
        } catch(e) { /* ignore errors if source is already stopped */ }
    });
    scheduledSources = [];
    
    // Clear visual updates
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    if (finalVisualTimeout) {
        clearTimeout(finalVisualTimeout);
        finalVisualTimeout = null;
    }
    if (progressUpdateInterval) {
        clearInterval(progressUpdateInterval);
        progressUpdateInterval = null;
    }
    
    // Clear all visual states immediately
    document.querySelectorAll('.key.active, .key.midi-active').forEach(k => {
        k.classList.remove('active', 'midi-active');
    });
    resetAllKeyVisuals();
    visualTrackState.clear(); // Reset visual state
    scheduledEvents = []; // Clear any pending visual events
}

function updateProgressBar(progress) {
    progressBar.style.width = (progress * 100) + '%';
}

// Visual processing function
const visualProcessing = () => {
  const now = audioContext.currentTime;
  // Process events only if not paused
  if (!isMidiPaused && scheduledEvents.length > 0) {
    // Process all events that are due. We must process all to maintain state for pitch bends.
    while (scheduledEvents.length > 0 && scheduledEvents[0].time <= now) {
      const event = scheduledEvents.shift();
      const { type, note, trackIndex, instrument, value } = event;
      
      // Ensure state object for this track exists
      if (!visualTrackState.has(trackIndex)) {
        visualTrackState.set(trackIndex, { currentBend: 0, activeNotes: new Map() });
      }
      const trackState = visualTrackState.get(trackIndex);

      if (type === 'on') {
        const currentBend = trackState.currentBend;
        const visualNote = getBentNote(note, currentBend, instrument);
        
        trackState.activeNotes.set(note, { visualNote, instrument });
        
        registerInstrumentOnNote(visualNote, instrument);

      } else if (type === 'off') {
        if (trackState.activeNotes.has(note)) {
          const { visualNote: oldVisualNote, instrument: oldInstrument } = trackState.activeNotes.get(note);
          unregisterInstrumentOnNote(oldVisualNote, oldInstrument);
          trackState.activeNotes.delete(note);
        }

      } else if (type === 'pitchBend') {
        const newBend = value;
        trackState.currentBend = newBend;

        // Update all active notes on this track
        trackState.activeNotes.forEach((state, originalNote) => {
          const oldVisualNote = state.visualNote;
          const inst = state.instrument;
          
          const newVisualNote = getBentNote(originalNote, newBend, inst);
          
          if (newVisualNote !== oldVisualNote) {
            unregisterInstrumentOnNote(oldVisualNote, inst);
            registerInstrumentOnNote(newVisualNote, inst);
            state.visualNote = newVisualNote;
          }
        });
      }
    }

    if (scheduledEvents.length > 0) {
      animationFrameId = requestAnimationFrame(visualProcessing);
    } else {
      // No more events, just stop loop. Do NOT reset keys here, as note-offs might still be pending in future.
      animationFrameId = null;
    }
  } else {
    animationFrameId = null;
  }
};

function playMidi(startOffsetSeconds = 0) {
    if (!rawMidiBuffer) return;
    
    stopCurrentPlayback(); // Ensure clean state before starting

    // Set the absolute start time for progress tracking
    midiPlaybackAbsoluteStartTime = audioContext.currentTime - (startOffsetSeconds / playbackSpeed);

    const midiData = parsedMidiData || MidiParser.parse(rawMidiBuffer);
    let { events, totalDuration } = parseMidiNotes(
      midiData,
      userTempoMap,
      trackInstrumentMap,
      currentInstrument,
      trackPitchShiftMap,
      null
    );
    parsedMidiData = midiData;
    totalMidiDuration = totalDuration;

    // Keep track of active note sources with better cleanup
    // Keyed by `${trackIndex}:${instrumentId}:${note}` so different instruments/tracks don't conflict
    // Each entry is a Set of sources so rapid re-triggers won't clobber earlier scheduled/still-playing voices.
    const activeNoteSources = new Map(); // Map<string, Set<AudioBufferSourceNode>>
    // Also track active sources per track for pitch bending: trackIndex -> Set<{source, baseRate}>
    const activeTrackSources = new Map();
    const trackPitchBendStates = new Map(); // trackIndex -> currentSemitoneBend
    const trackGains = new Map(); // trackIndex -> GainNode for volume control

    // Helpers to manage multiple active sources per logical sourceKey
    function addActiveNoteSource(key, source) {
      if (!activeNoteSources.has(key)) activeNoteSources.set(key, new Set());
      activeNoteSources.get(key).add(source);
      // remove from set when ended to avoid memory leaks
      source.onended = () => {
        removeActiveNoteSource(key, source);
      };
    }

    function removeActiveNoteSource(key, source) {
      if (!activeNoteSources.has(key)) return;
      const set = activeNoteSources.get(key);
      set.delete(source);
      if (set.size === 0) activeNoteSources.delete(key);
    }

    function stopActiveNoteSources(key, when = null) {
      if (!activeNoteSources.has(key)) return;
      const set = activeNoteSources.get(key);
      for (const src of Array.from(set)) {
        try {
          if (when != null) src.stop(when); else src.stop();
        } catch (e) { /* ignore already-stopped */ }
        set.delete(src);
      }
      activeNoteSources.delete(key);
    }

    // Filter and adjust events based on start offset
    events = events.filter(event => event.time >= startOffsetSeconds)
        .map(event => ({
            ...event,
            time: (event.time - startOffsetSeconds) / playbackSpeed + audioContext.currentTime + 0.02 // Reduced buffer from 0.05 to 0.02
        }));

    // Optimize scheduling by grouping events by time
    const eventGroups = new Map();
    events.forEach(event => {
        const roundedTime = Math.round(event.time * 1000) / 1000; // Round to nearest millisecond
        if (!eventGroups.has(roundedTime)) {
            eventGroups.set(roundedTime, []);
        }
        eventGroups.get(roundedTime).push(event);
    });

    // Schedule events
    eventGroups.forEach((eventGroup, time) => {
        eventGroup.forEach(({ note, type, playbackRate, instrument, trackIndex, value }) => {
            const instId = instrument || currentInstrument;
            const tIndex = typeof trackIndex === 'number' ? trackIndex : 0;
            const sourceKey = `${tIndex}:${instId}:${note}`;

            // Ensure we have a gain node per track for volume control
            if (!trackGains.has(tIndex)) {
                const gainNode = audioContext.createGain();
                const vol = (trackVolumeMap[tIndex] != null ? trackVolumeMap[tIndex] : 100) / 100;
                gainNode.gain.value = vol;
                gainNode.connect(audioContext.destination);
                trackGains.set(tIndex, gainNode);
            }
            const trackGainNode = trackGains.get(tIndex);

            if (type === 'pitchBend') {
                const bendSemitones = value;
                trackPitchBendStates.set(tIndex, bendSemitones);
                
                // Schedule visual event for pitch bend
                scheduledEvents.push({
                  time,
                  type: 'pitchBend',
                  trackIndex: tIndex,
                  value: bendSemitones,
                  instrument: instId
                });
                
                // Apply to all active audio sources on this track
                if (activeTrackSources.has(tIndex)) {
                    const sources = activeTrackSources.get(tIndex);
                    const bendFactor = Math.pow(2, bendSemitones / 12);
                    sources.forEach(item => {
                        // item is { source, baseRate }
                        try {
                            item.source.playbackRate.setValueAtTime(item.baseRate * bendFactor, time);
                        } catch(e) {}
                    });
                }

            } else if (type === 'on') {
                const { buffer, playbackRate: baseRateRaw, offsetSeconds } =
                  getInstrumentBufferAndRateForInstrument(note, instId, playbackRate || 1);
                
                if (buffer) {
                    // Stop any existing sources for this note+instrument+track first (prevent orphaned voices)
                    if (activeNoteSources.has(sourceKey)) {
                        try {
                            // Stop all previously scheduled sources for this logical key
                            stopActiveNoteSources(sourceKey);
                            // Also cleanup from activeTrackSources (if present) by removing any items whose source was stopped
                            if (activeTrackSources.has(tIndex)) {
                                const set = activeTrackSources.get(tIndex);
                                for (const item of Array.from(set)) {
                                    // If this source belonged to the stopped key it will have been stopped and removed by onended;
                                    // but be defensive and remove matching references now
                                    // (no reliable unique id existed before, so we just keep consistent cleanup)
                                    // There is no reliable mapping here so we leave activeTrackSources items intact unless their source ends.
                                }
                            }
                        } catch (e) { /* ignore */ }
                    }
                    
                    const source = audioContext.createBufferSource();
                    source.buffer = buffer;
                    
                    // Calculate initial rate with current pitch bend
                    const currentBend = trackPitchBendStates.get(tIndex) || 0;
                    const bendFactor = Math.pow(2, currentBend / 12);
                    const finalRate = baseRateRaw * bendFactor;

                    source.playbackRate.value = finalRate; 
                    
                    source.connect(trackGainNode);

                    try {
                      source.start(time, offsetSeconds || 0);
                    } catch (e) {
                      source.start(time);
                    }
                    scheduledSources.push(source);
                    // Track multiple simultaneous sources for the same logical key
                    addActiveNoteSource(sourceKey, source);

                    // Add to track sources for pitch bending
                    if (!activeTrackSources.has(tIndex)) {
                        activeTrackSources.set(tIndex, new Set());
                    }
                    const trackSet = activeTrackSources.get(tIndex);
                    const sourceItem = { source, baseRate: baseRateRaw };
                    trackSet.add(sourceItem);

                    // Cleanup from track set on ended
                    source.onended = () => {
                        if (activeTrackSources.has(tIndex)) {
                            activeTrackSources.get(tIndex).delete(sourceItem);
                        }
                    };
                    
                    // Schedule visual event
                    scheduledEvents.push({
                      time,
                      type: 'on',
                      note,
                      trackIndex: tIndex,
                      instrument: instId
                    });
                }
            } else if (type === 'off') {
                // Handle note-off by stopping the corresponding source
                if (activeNoteSources.has(sourceKey)) {
                    try {
                        // Stop all active sources scheduled for this logical key at the correct time
                        stopActiveNoteSources(sourceKey, time);
                    } catch (e) {
                        // Ignore errors for sources that are already stopped
                    }
                }
                
                // Schedule visual event
                scheduledEvents.push({
                  time,
                  type: 'off',
                  note,
                  trackIndex: tIndex,
                  instrument: instId
                });
            }
        });
    });

    // Start progress updates with optimized frequency
    if (progressUpdateInterval) clearInterval(progressUpdateInterval);
    progressUpdateInterval = setInterval(() => {
        if (!isMidiPaused && midiPlaybackAbsoluteStartTime !== null) {
            const currentTime = (audioContext.currentTime - midiPlaybackAbsoluteStartTime) * playbackSpeed;
            const progress = Math.min(1, currentTime / totalMidiDuration);
            if (!isDraggingProgress) {
                updateProgressBar(progress);
            }
        }
    }, PROGRESS_UPDATE_INTERVAL);

    // Sort visual events only once for better performance
    scheduledEvents.sort((a, b) => a.time - b.time);
    
    // Start visual processing loop
    if (scheduledEvents.length > 0 && !animationFrameId) {
        animationFrameId = requestAnimationFrame(visualProcessing);
    }

    // Schedule final cleanup when playback is expected to end
    const remainingDuration = Math.max(0, totalDuration - startOffsetSeconds);
    if (remainingDuration > 0) {
        finalVisualTimeout = setTimeout(() => {
            // Only stop/reset state if not currently paused
            if (!isMidiPaused) {
                stopMidiPlayback(); // Use the comprehensive stop function
            }
        }, (remainingDuration / playbackSpeed) * 1000 + 200); // Reduced buffer from 500ms to 200ms
    } else {
        // If no events remaining after offset (e.g., end of song), just stop/reset state
        if (!isMidiPaused) {
            stopMidiPlayback();
        }
    }
}

 // ==== EXPORT FUNCTIONALITY ====

// Render MIDI to WAV (returns Blob, no download)
async function renderMidiToWavBlob() {
    if (!rawMidiBuffer) throw new Error("No MIDI data loaded for export.");
    
    // Reset and show both scheduling and rendering progress bars
    resetExportProgress();
    resetRenderProgress();
    let renderProgressInterval = null;

    try {
        // Parse MIDI using current pitch shift
        const midiData = parsedMidiData || MidiParser.parse(rawMidiBuffer);
        const { events, totalDuration } = parseMidiNotes(
          midiData,
          userTempoMap,
          trackInstrumentMap,
          currentInstrument,
          trackPitchShiftMap,
          null
        );
        parsedMidiData = midiData;

        // Create offline context with adjusted duration based on playback speed
        const offlineCtx = new OfflineAudioContext({
            numberOfChannels: 2,
            sampleRate: audioContext.sampleRate,
            length: Math.round((totalDuration / playbackSpeed + 2) * audioContext.sampleRate) // Adjust duration by speed
        });

        // Store active sources for each note+instrument+track in the offline context to handle note-off events
        const offlineScheduledSources = new Map();
        const offlineTrackGains = new Map(); // trackIndex -> GainNode for volume control

        const totalEvents = events.length;
        const USE_CHUNKED_SCHEDULING = totalEvents > 50000; // Threshold for "insane" MIDIs
        const BATCH_SIZE = 5000;

        // Helper to schedule a single event into the offline context
        const scheduleEventIntoOffline = (event) => {
            const { time, note, type, playbackRate, instrument, trackIndex } = event;
            const adjustedTime = time / playbackSpeed; // Adjust time based on playback speed
            const instId = instrument || currentInstrument;
            const tIndex = typeof trackIndex === 'number' ? trackIndex : 0;
            const sourceKey = `${tIndex}:${instId}:${note}`;

            // Ensure per-track gain for offline render
            if (!offlineTrackGains.has(tIndex)) {
                const gainNode = offlineCtx.createGain();
                const vol = (trackVolumeMap[tIndex] != null ? trackVolumeMap[tIndex] : 100) / 100;
                gainNode.gain.value = vol;
                gainNode.connect(offlineCtx.destination);
                offlineTrackGains.set(tIndex, gainNode);
            }
            const trackGainNode = offlineTrackGains.get(tIndex);

            if (type === 'on') {
                const { buffer, playbackRate: finalRate, offsetSeconds } =
                  getInstrumentBufferAndRateForInstrument(note, instId, playbackRate || 1);
                if (buffer) {
                    const source = offlineCtx.createBufferSource();
                    source.buffer = buffer;
                    source.playbackRate.value = finalRate; // Apply pitch shift and instrument mapping
                    source.connect(trackGainNode);
                    try {
                      source.start(adjustedTime, offsetSeconds || 0);
                    } catch (e) {
                      source.start(adjustedTime);
                    }
                    offlineScheduledSources.set(sourceKey, source); // Store the source for this note+instrument+track
                }
            } else if (type === 'off') {
                if (offlineScheduledSources.has(sourceKey)) {
                    try {
                        // Stop the previously scheduled note-on source at the adjusted time
                        offlineScheduledSources.get(sourceKey).stop(adjustedTime);
                    } catch (e) {
                        console.warn(`Could not stop source for note ${note} at time ${adjustedTime}:`, e.message);
                    }
                    offlineScheduledSources.delete(sourceKey); // Remove from tracking
                }
            }
        };

        if (USE_CHUNKED_SCHEDULING) {
            // Chunked scheduling for huge note counts with visible progress
            // This progress reflects "event scheduling" only, not final WAV rendering.
            setExportProgress(0);
            updateProgressBar(0);
            for (let i = 0; i < totalEvents; i += BATCH_SIZE) {
                const end = Math.min(totalEvents, i + BATCH_SIZE);
                for (let j = i; j < end; j++) {
                    scheduleEventIntoOffline(events[j]);
                }
                // Clamp scheduling progress to 0–0.99 so we never show 100%
                // until the actual render is fully finished.
                const rawProgress = end / totalEvents;
                const clampedProgress = Math.min(rawProgress, 0.99);
                setExportProgress(clampedProgress);
                updateProgressBar(clampedProgress);
                // Yield back to the browser so UI (progress) can update
                // and avoid long blocking loops on insanely spammy MIDIs.
                // eslint-disable-next-line no-await-in-loop
                await new Promise(r => setTimeout(r, 0));
            }
            // Leave bar just under 100% while OfflineAudioContext does the heavy render work.
        } else {
            // Normal scheduling path for smaller / typical files
            events.forEach(scheduleEventIntoOffline);
            // For smaller files, show quick scheduling completion
            setExportProgress(1);
        }

        // Render audio - show separate rendering progress bar
        // Approximate progress by how close we are (in simulated time) to the last note.
        setRenderProgress(0);
        const renderStartTime = performance.now();
        const expectedRenderDurationMs = Math.max(1, (totalDuration / playbackSpeed) * 1000);

        renderProgressInterval = setInterval(() => {
            const elapsedMs = performance.now() - renderStartTime;
            const progress = Math.min(1, elapsedMs / expectedRenderDurationMs);
            setRenderProgress(progress);
        }, 100);

        const renderedBuffer = await offlineCtx.startRendering();

        // Rendering is now truly finished; set progress to 100%.
        if (renderProgressInterval !== null) {
            clearInterval(renderProgressInterval);
            renderProgressInterval = null;
        }
        setRenderProgress(1);
        setExportProgress(1);
        updateProgressBar(1);
        return audioBufferToWav(renderedBuffer);
    } catch (error) {
        console.error("Error rendering MIDI to WAV blob:", error);
        throw error; // Re-throw for caller to handle
    } finally {
        // Ensure progress UI is reset for next time
        if (renderProgressInterval !== null) {
            clearInterval(renderProgressInterval);
            renderProgressInterval = null;
        }
        resetExportProgress();
        resetRenderProgress();
    }
}

// Update triggerWavDownload function to include speed in filename
async function triggerWavDownload() {
    if (!rawMidiBuffer || !audioContext) return;

    exportBtn.disabled = true;
    exportBtn.textContent = "Exporting...";
    loadingText.textContent = "Exporting WAV...";
    loadingIndicator.style.display = "block";
    resetExportProgress();
    resetRenderProgress();
    setExportProgress(0);
    updateProgressBar(0);

    try {
        // Parse MIDI to event list for export
        const midiData = parsedMidiData || MidiParser.parse(rawMidiBuffer);
        const { events, totalDuration } = parseMidiNotes(
            midiData,
            userTempoMap,
            trackInstrumentMap,
            currentInstrument,
            trackPitchShiftMap,
            null
        );
        parsedMidiData = midiData;

        const wavBlob = await renderMidiToWavBlobExternal({
            audioContext,
            events,
            totalDuration,
            playbackSpeed,
            trackVolumeMap,
            getInstrumentBufferAndRateForInstrument,
            onScheduleProgress: (progress) => {
                setExportProgress(progress);
                updateProgressBar(progress);
            },
            onRenderProgress: (progress) => {
                setRenderProgress(progress);
            }
        });

        const url = URL.createObjectURL(wavBlob);
        const a = document.createElement('a');
        a.href = url;
        
        // Add both pitch shift and speed to filename if they're different from default
        let modifiers = [];
        if (pitchShift !== 0) modifiers.push(`pitched_${pitchShift}`);
        if (playbackSpeed !== 1) modifiers.push(`speed_${playbackSpeed.toFixed(3).replace('.', '_')}`);
        
        const modifierString = modifiers.length > 0 ? `_${modifiers.join('_')}` : '';
        a.download = `${currentMidiFileName.replace(/\.midi?$/i, '') || 'bf-performance'}${modifierString}.wav`;
        
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
        alert("WAV export complete!");
    } catch (error) {
        alert("Export failed: " + error.message);
    } finally {
        loadingIndicator.style.display = 'none';
        resetExportProgress();
        resetRenderProgress();
        exportBtn.disabled = false;
        exportBtn.textContent = "Export as WAV";
    }
}

// Update handleCommentAndExport to include precise speed info in comment
async function handleCommentAndExport() {
    if (!rawMidiBuffer || !audioContext) {
        alert("Please load a MIDI file first to comment your export.");
        return;
    }

    // comment export removed
    // comment export removed
    loadingText.textContent = "Exporting and preparing comment...";
    loadingIndicator.style.display = "block";
    resetExportProgress();
    resetRenderProgress();
    setExportProgress(0);
    updateProgressBar(0);

    try {
        const defaultMidiName = currentMidiFileName.replace(/\.midi?$/i, '') || 'My FNF Performance';
        const userMidiName = prompt("Please enter a name for your performance:", defaultMidiName);

        if (userMidiName === null) {
            loadingIndicator.style.display = 'none';
            // comment export removed
            // comment export removed
            return;
        }

        const finalMidiName = userMidiName.trim() === '' ? defaultMidiName : userMidiName.trim();

        // Parse MIDI to event list for export
        const midiData = parsedMidiData || MidiParser.parse(rawMidiBuffer);
        const { events, totalDuration } = parseMidiNotes(
            midiData,
            userTempoMap,
            trackInstrumentMap,
            currentInstrument,
            trackPitchShiftMap,
            null
        );
        parsedMidiData = midiData;

        const wavBlob = await renderMidiToWavBlobExternal({
            audioContext,
            events,
            totalDuration,
            playbackSpeed,
            trackVolumeMap,
            getInstrumentBufferAndRateForInstrument,
            onScheduleProgress: (progress) => {
                setExportProgress(progress);
                updateProgressBar(progress);
            },
            onRenderProgress: (progress) => {
                setRenderProgress(progress);
            }
        });

        loadingText.textContent = "Uploading exported audio...";
        const uploadedWavUrl = await window.websim.upload(wavBlob);

        // Add modifiers info to comment with precise speed
        let modifiers = [];
        if (pitchShift !== 0) modifiers.push(`Pitch Shift: ${pitchShift} semitones`);
        if (playbackSpeed !== 1) modifiers.push(`Speed: ${playbackSpeed.toFixed(3)}x`);
        
        let commentContent = `Check out my BF performance "${finalMidiName}"`;
        if (modifiers.length > 0) {
            commentContent += ` (${modifiers.join(', ')})`;
        }
        commentContent += `\n\n${uploadedWavUrl}`;

        loadingText.textContent = "Posting comment...";
        const postResult = await window.websim.postComment({
            content: commentContent
        });

        if (postResult && postResult.error) {
            throw new Error(postResult.error);
        }
        
        alert("Your performance has been commented and shared!");

    } catch (error) {
        console.error("Error during comment & export:", error);
        alert("Failed to comment and share: " + error.message);
    } finally {
        loadingIndicator.style.display = 'none';
        resetExportProgress();
        resetRenderProgress();
        // comment export removed
        // comment export removed
    }
}

// ==== MIDI PARSING ====
function parseMidiNotes(midi, customTempoMap = null, trackInstrumentMapParam = null, defaultInstrumentId = 'boyfriend', trackPitchShiftMapParam = null, onProgress = null) {
  const notes = [];
  // timeDivision is PPQN for most files; if SMPTE (negative/high bit) fall back to 480
  let ticksPerQuarterNote = midi.timeDivision;
  if (!ticksPerQuarterNote || ticksPerQuarterNote <= 0 || ticksPerQuarterNote > 0x7FFF) {
    ticksPerQuarterNote = 480;
  }
  const MIDI_NOTE_OFFSET = 48; // Map MIDI note 48 (C3) to our first sample
  const PITCH_BEND_RANGE = 12; // Semitone range for pitch bend (+/-)

  // For progress reporting while parsing large MIDIs
  let totalEvents = 0;
  let processedEvents = 0;
  if (onProgress && midi && Array.isArray(midi.track)) {
    midi.track.forEach(track => {
      if (track && Array.isArray(track.event)) {
        totalEvents += track.event.length;
      }
    });
  }
  const PROGRESS_REPORT_INTERVAL = 500; // report every N events to avoid UI spam

  // Cache for better performance during intensive sequences
  // Keyed by `${instrumentId}:${midiNote}`
  const noteCache = new Map();

  // Tempo is handled via globalTempoMap + ticksToSeconds below


  // Build global tempo map from ALL tracks (MIDI tempo is song-wide)
  // Entry: { tick, usPerQuarter }
  const globalTempoMap = [{ tick: 0, usPerQuarter: 500000 }]; // default 120 BPM
  if (midi && Array.isArray(midi.track)) {
    midi.track.forEach(tr => {
      let absTick = 0;
      if (!tr || !Array.isArray(tr.event)) return;
      tr.event.forEach(ev => {
        absTick += (ev.deltaTime || 0);
        if (ev.type === 255 && ev.metaType === 81 && ev.data != null) {
          let us;
          if (typeof ev.data === 'number') {
            us = ev.data;
          } else if (Array.isArray(ev.data) && ev.data.length >= 3) {
            us = (ev.data[0] << 16) | (ev.data[1] << 8) | ev.data[2];
          } else if (Array.isArray(ev.data) && ev.data.length === 1) {
            us = ev.data[0];
          }
          if (us && us > 0) {
            globalTempoMap.push({ tick: absTick, usPerQuarter: us });
          }
        }
      });
    });
  }
  globalTempoMap.sort((a, b) => a.tick - b.tick);
  // dedupe same-tick entries (keep last)
  for (let i = globalTempoMap.length - 1; i > 0; i--) {
    if (globalTempoMap[i].tick === globalTempoMap[i - 1].tick) {
      globalTempoMap.splice(i - 1, 1);
    }
  }

  // Absolute tick -> seconds, correctly handling mid-song tempo changes
  function ticksToSeconds(absTick) {
    let time = 0;
    let lastTick = 0;
    let usPerQuarter = globalTempoMap[0].usPerQuarter;
    for (let i = 1; i < globalTempoMap.length; i++) {
      const entry = globalTempoMap[i];
      if (entry.tick >= absTick) break;
      const secondsPerTick = (usPerQuarter / ticksPerQuarterNote) / 1e6;
      time += (entry.tick - lastTick) * secondsPerTick;
      lastTick = entry.tick;
      usPerQuarter = entry.usPerQuarter;
    }
    if (absTick > lastTick) {
      const secondsPerTick = (usPerQuarter / ticksPerQuarterNote) / 1e6;
      time += (absTick - lastTick) * secondsPerTick;
    }
    return time;
  }

  // Log detected tempos for debugging
  try {
    const bpms = globalTempoMap.map(e => ({
      tick: e.tick,
      bpm: Math.round((60000000 / e.usPerQuarter) * 100) / 100
    }));
    console.log('MIDI tempo map:', bpms);
  } catch (e) {}

  midi.track.forEach((track, trackIndex) => {
    let tickTime = 0;
    let currentPitchBendSemitones = 0; // Per-track pitch bend in semitones

    const trackInstrumentId = (trackInstrumentMapParam && trackInstrumentMapParam[trackIndex] !== undefined)
      ? trackInstrumentMapParam[trackIndex]
      : defaultInstrumentId;

    const trackPitchShift = (trackPitchShiftMapParam && trackPitchShiftMapParam[trackIndex] != null)
      ? trackPitchShiftMapParam[trackIndex]
      : 0;

    // If this track is explicitly set to "none", skip all its events
    if (trackInstrumentId === 'none') {
      return;
    }
    const sampleCountForTrack =
      trackInstrumentId === 'bambi'
        ? 80
        : trackInstrumentId === 'bandu'
          ? 61
          : trackInstrumentId === 'bf2'
            ? 11
            : trackInstrumentId === 'cedric'
              ? 48
              : trackInstrumentId === 'hello'
                ? 48
                : trackInstrumentId === 'fresh'
                  ? 39
                  : trackInstrumentId === 'burger'
                    ? 48
                    : trackInstrumentId === 'redmungus'
                      ? 60
                      : 31;
    const MIDI_NOTE_FOR_SAMPLE_1 = MIDI_NOTE_OFFSET;
    const MIDI_NOTE_FOR_SAMPLE_MAX = MIDI_NOTE_OFFSET + sampleCountForTrack - 1;

    track.event.forEach(event => {
      tickTime += event.deltaTime;

      // Progress reporting per event (for "loading every note" visualization)
      if (onProgress && totalEvents > 0) {
        processedEvents++;
        if (processedEvents % PROGRESS_REPORT_INTERVAL === 0 || processedEvents === totalEvents) {
          try {
            onProgress(processedEvents / totalEvents);
          } catch (e) {
            // Ignore callback errors so parsing keeps working
          }
        }
      }
      
      let eventTimeSeconds;
      if (customTempoMap && customTempoMap.length > 0) {
          // Manual BPM override (Change BPM button) — times are in seconds
          let timeOffset = 0;
          let tickOffset = 0;
          const sortedMap = [...customTempoMap].sort((a, b) => a.time - b.time);
          let lastBpm = sortedMap.length > 0 ? sortedMap[0].bpm : 120;
          if (sortedMap.length > 0 && sortedMap[0].time > 0) lastBpm = 120;

          for (const change of sortedMap) {
              const secondsPerTick = 60 / (lastBpm * ticksPerQuarterNote);
              const timeForTicks = (tickTime - tickOffset) * secondsPerTick;
              if (timeOffset + timeForTicks < change.time) {
                  eventTimeSeconds = timeOffset + timeForTicks;
                  break;
              }
              const ticksToChange = (change.time - timeOffset) / secondsPerTick;
              tickOffset += ticksToChange;
              timeOffset = change.time;
              lastBpm = change.bpm;
          }
          if (eventTimeSeconds === undefined) {
              const secondsPerTick = 60 / (lastBpm * ticksPerQuarterNote);
              eventTimeSeconds = timeOffset + (tickTime - tickOffset) * secondsPerTick;
          }
      } else {
          // Default: use the MIDI file's own tempo events (global map)
          eventTimeSeconds = ticksToSeconds(tickTime);
      }


      // Handle pitch bend (slide) events: type 14, data = [lsb, msb]
      if (event.type === 14 && event.data && event.data.length >= 2) {
        const lsb = event.data[0] & 0x7F;
        const msb = event.data[1] & 0x7F;
        const value14bit = (msb << 7) | lsb;      // 0–16383
        const centered = value14bit - 8192;       // -8192–+8191
        const semitones = (centered / 8192) * PITCH_BEND_RANGE;
        
        notes.push({
          time: eventTimeSeconds,
          type: 'pitchBend',
          value: semitones,
          trackIndex,
          instrument: trackInstrumentId
        });
      }

      if (event.type === 9) { // Note on
        const midiNote = event.data[0];
        const velocity = event.data[1];

        // Include pitchShift in cache key (pitch bend is now applied dynamically)
        const effectivePitchShift = pitchShift + trackPitchShift;
        const cacheKey = `${trackInstrumentId}:${midiNote}:${effectivePitchShift}`;
        let noteData;
        if (noteCache.has(cacheKey)) {
          noteData = noteCache.get(cacheKey);
        } else {
          // Apply global pitchShift + track shift (but NOT pitch bend, which is now dynamic)
          const shiftedMidiNote = midiNote + effectivePitchShift;
          let sampleNote;
          let playbackRate = 1.0;

          if (trackInstrumentId === 'bf2') {
              // BF2: wrap notes cyclically through its 11-note range (loop to start/end)
              const relative = shiftedMidiNote - MIDI_NOTE_FOR_SAMPLE_1;
              const wrappedIndex = ((relative % sampleCountForTrack) + sampleCountForTrack) % sampleCountForTrack;
              sampleNote = wrappedIndex + 1;
              // Always keep BF2 at its original pitch (no playbackRate/octave adjustments)
              playbackRate = 1;
          } else if (shiftedMidiNote < MIDI_NOTE_FOR_SAMPLE_1) {
              sampleNote = 1;
              const semitoneDiff = shiftedMidiNote - MIDI_NOTE_FOR_SAMPLE_1;
              playbackRate = Math.pow(2, semitoneDiff / 12);
          } else if (shiftedMidiNote > MIDI_NOTE_FOR_SAMPLE_MAX) {
              sampleNote = sampleCountForTrack;
              const semitoneDiff = shiftedMidiNote - MIDI_NOTE_FOR_SAMPLE_MAX;
              playbackRate = Math.pow(2, semitoneDiff / 12);
          } else {
              sampleNote = shiftedMidiNote - MIDI_NOTE_OFFSET + 1;
          }
          noteData = { sampleNote: Math.round(sampleNote), playbackRate };
          noteCache.set(cacheKey, noteData);
        }
        
        if (velocity > 0) {
          notes.push({
            time: eventTimeSeconds,
            note: noteData.sampleNote.toString(),
            type: 'on',
            midiNote: midiNote,
            playbackRate: noteData.playbackRate,
            instrument: trackInstrumentId,
            trackIndex
          });
        } else { // Note on with velocity 0 is a note off
          notes.push({
            time: eventTimeSeconds,
            note: noteData.sampleNote.toString(),
            type: 'off',
            midiNote: midiNote,
            instrument: trackInstrumentId
          });
        }
      } else if (event.type === 8) { // Note off
        const midiNote = event.data[0];

        // Match cache key used for note-on (same bend / pitchShift combo)
        const effectivePitchShift = pitchShift + trackPitchShift;
        const cacheKey = `${trackInstrumentId}:${midiNote}:${effectivePitchShift}:${currentPitchBendSemitones.toFixed(3)}`;
        let noteData;
        if (noteCache.has(cacheKey)) {
          noteData = noteCache.get(cacheKey);
        } else {
            const shiftedMidiNote = midiNote + effectivePitchShift + currentPitchBendSemitones;
            let sampleNote;
            let playbackRate = 1.0;

            if (trackInstrumentId === 'bf2') {
                // BF2: cyclic wrap for note-offs too (loop to start/end)
                const relative = shiftedMidiNote - MIDI_NOTE_FOR_SAMPLE_1;
                const wrappedIndex = ((relative % sampleCountForTrack) + sampleCountForTrack) % sampleCountForTrack;
                sampleNote = wrappedIndex + 1;
                // Ensure BF2 note-offs do not alter playback rate
                playbackRate = 1;
            } else if (shiftedMidiNote < MIDI_NOTE_FOR_SAMPLE_1) {
                sampleNote = 1;
                const semitoneDiff = shiftedMidiNote - MIDI_NOTE_FOR_SAMPLE_1;
                playbackRate = Math.pow(2, semitoneDiff / 12);
            } else if (shiftedMidiNote > MIDI_NOTE_FOR_SAMPLE_MAX) {
                sampleNote = sampleCountForTrack;
                const semitoneDiff = shiftedMidiNote - MIDI_NOTE_FOR_SAMPLE_MAX;
                playbackRate = Math.pow(2, semitoneDiff / 12);
            } else {
                sampleNote = shiftedMidiNote - MIDI_NOTE_OFFSET + 1;
            }
            noteData = { sampleNote: Math.round(sampleNote), playbackRate };
            noteCache.set(cacheKey, noteData);
        }
        
        notes.push({
          time: eventTimeSeconds,
          note: noteData.sampleNote.toString(),
          type: 'off',
          midiNote: midiNote,
          instrument: trackInstrumentId,
          trackIndex
        });
      }
    });
  });

  // Sort events by time, as tracks can be interleaved
  notes.sort((a, b) => a.time - b.time);
  const totalDuration = notes.length > 0 ? Math.max(...notes.map(n => n.time)) : 0;

  if (onProgress && totalEvents > 0) {
    // Ensure we finish at 100%
    try {
      onProgress(1);
    } catch (e) {
      // ignore
    }
  }

  return { events: notes, totalDuration };
}

// --- MIDI Functionality ---
const midiFileInput = document.getElementById('midi-file-input');
const startMidiBtn = document.getElementById('start-midi-btn');
const pauseResumeMidiBtn = document.getElementById('pause-resume-midi-btn');
const stopMidiBtn = document.getElementById('stop-midi-btn');
const editBpmBtn = document.getElementById('edit-bpm-btn');

midiFileInput.addEventListener('change', handleMidiFile);
startMidiBtn.addEventListener('click', startMidi);
pauseResumeMidiBtn.addEventListener('click', pauseResumeMidi);
stopMidiBtn.addEventListener('click', stopMidiPlayback);
editBpmBtn.addEventListener('click', () => {
  if (!rawMidiBuffer) return;
  stopMidiPlayback();
  showSetBpmModal();
});

function updateMidiControlState(state) {
    // states: 'loaded', 'playing', 'paused', 'stopped', 'initial'
    switch(state) {
        case 'loaded':
            startMidiBtn.disabled = false;
            startMidiBtn.textContent = 'Start';
            pauseResumeMidiBtn.disabled = true;
            pauseResumeMidiBtn.textContent = 'Pause';
            stopMidiBtn.disabled = true;
            // comment export removed
            isMidiPaused = false;
            speedSlider.disabled = false; // Enable speed slider
            editBpmBtn.disabled = false;
            break;
        case 'playing':
            startMidiBtn.disabled = true;
            pauseResumeMidiBtn.disabled = false;
            pauseResumeMidiBtn.textContent = 'Pause';
            stopMidiBtn.disabled = false;
            // comment export removed
            isMidiPaused = false;
            speedSlider.disabled = false; // Keep speed slider enabled
            editBpmBtn.disabled = false;
            break;
        case 'paused':
            startMidiBtn.disabled = true;
            pauseResumeMidiBtn.disabled = true;
            pauseResumeMidiBtn.textContent = 'Resume';
            stopMidiBtn.disabled = false;
            // comment export removed
            isMidiPaused = true;
            speedSlider.disabled = false; // Enable speed slider when paused
            editBpmBtn.disabled = false;
            break;
        case 'stopped':
        case 'initial':
        default:
            startMidiBtn.disabled = true;
            startMidiBtn.textContent = 'Start';
            pauseResumeMidiBtn.disabled = true;
            pauseResumeMidiBtn.textContent = 'Pause';
            stopMidiBtn.disabled = true;
            // comment export removed
            isMidiPaused = false;
            currentMidiFileName = ''; // Clear filename
            editBpmBtn.disabled = true;
            break;
    }
    exportBtn.disabled = (state === 'initial' || state === 'stopped' || rawMidiBuffer === null); // Keep export button consistent

    // Progress bar state
    if (progressContainer) {
        progressContainer.style.opacity = (state === 'initial' || state === 'stopped') ? '0.5' : '1';
        progressContainer.style.pointerEvents = (state === 'initial' || state === 'stopped') ? 'none' : 'auto';
    }
    
    if (state === 'initial' || state === 'stopped') {
        if (!isDraggingProgress) {
            updateProgressBar(0);
        }
        if (progressUpdateInterval) {
            clearInterval(progressUpdateInterval);
            progressUpdateInterval = null;
        }
    }
}

function handleMidiFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  currentMidiFileName = file.name; // Store the file name
  userTempoMap = null; // Reset custom tempo map
  parsedMidiData = null; // Clear previous parsed data
  Object.keys(trackInstrumentMap).forEach(k => delete trackInstrumentMap[k]); // Reset track routing
  Object.keys(trackPitchShiftMap).forEach(k => delete trackPitchShiftMap[k]); // Reset track pitch shifts
  
  initAudioContext(); // Ensure audio context is ready
  stopMidiPlayback(); // Stop anything currently playing

  loadingIndicator.style.display = 'block';
  loadingText.textContent = 'Loading MIDI file...';

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      rawMidiBuffer = new Uint8Array(e.target.result);

      // Parse once now so we can build track instrument routing UI
      try {
        parsedMidiData = MidiParser.parse(rawMidiBuffer);
        buildTrackInstrumentRoutingUI(
          parsedMidiData,
          trackInstrumentsContainer,
          trackInstrumentMap,
          trackVolumeMap,
          trackPitchShiftMap,
          currentInstrument
        );

        // Parse notes once to "load" every note and show progress in the loading bar
        try {
          if (progressContainer) {
            progressContainer.style.opacity = '1';
            progressContainer.style.pointerEvents = 'none';
          }
          parseMidiNotes(
            parsedMidiData,
            null,
            trackInstrumentMap,
            currentInstrument,
            trackPitchShiftMap,
            (progress) => {
              if (!isDraggingProgress && typeof progress === 'number') {
                updateProgressBar(Math.max(0, Math.min(1, progress)));
              }
            }
          );
        } catch (e) {
          console.error('Error while pre-parsing MIDI notes for progress:', e);
        }
      } catch (err) {
        console.error("Error parsing MIDI for track routing:", err);
        parsedMidiData = null;
      }

      // Use the MIDI file tempo by default (no popup)
      userTempoMap = null;
      finishMidiLoad();
    } catch (error) {
      console.error("Error reading MIDI file:", error);
      loadingText.textContent = `Could not read MIDI file. Details: ${error.message || error}`;
      setTimeout(() => {
        loadingIndicator.style.display = 'none';
      }, 3000);
      updateMidiControlState('initial');
    }
  };
  reader.readAsArrayBuffer(file);
}

// --- BPM Modal Logic ---
const bpmModal = document.getElementById('bpm-modal-container');
const bpmInputModal = document.getElementById('bpm-input-modal-container');
const bpmNoBtn = document.getElementById('bpm-no-btn');
const bpmYesBtn = document.getElementById('bpm-yes-btn');
const bpmSubmitBtn = document.getElementById('bpm-submit-btn');
const bpmCancelBtn = document.getElementById('bpm-cancel-btn');
const bpmInputTextarea = document.getElementById('bpm-input-textarea');

// --- BPM Preview Player State and Elements ---
const bpmPreviewPlayPauseBtn = document.getElementById('bpm-preview-play-pause-btn');
const bpmPreviewTimeDisplay = document.getElementById('bpm-preview-time');
const bpmPreviewProgressContainer = document.getElementById('bpm-preview-progress-container');
const bpmPreviewProgressBar = document.getElementById('bpm-preview-progress-bar');

let previewPlayer = {
  audioContext: null,
  isPlaying: false,
  sources: [],
  startTime: 0,
  startOffset: 0,
  totalDuration: 0,
  animationFrameId: null,
  events: [],
  sampleBuffer: null, // To store the loaded C4 piano note
  activeSources: new Map() // To track individual notes for stopping them
};



function updatePreviewTime() {
  if (!previewPlayer.isPlaying) return;
  const elapsedTime = previewPlayer.audioContext.currentTime - previewPlayer.startTime + previewPlayer.startOffset;
  const progress = Math.min(1, elapsedTime / previewPlayer.totalDuration);
  
  bpmPreviewProgressBar.style.width = `${progress * 100}%`;
  bpmPreviewTimeDisplay.textContent = `${formatTime(elapsedTime)} / ${formatTime(previewPlayer.totalDuration)}`;
  
  if (elapsedTime >= previewPlayer.totalDuration) {
      stopBpmPreview();
  } else {
      previewPlayer.animationFrameId = requestAnimationFrame(updatePreviewTime);
  }
}

function stopBpmPreview(reset = true) {
    if (previewPlayer.animationFrameId) {
        cancelAnimationFrame(previewPlayer.animationFrameId);
        previewPlayer.animationFrameId = null;
    }
    if (previewPlayer.sources) {
        previewPlayer.sources.forEach(source => {
            try { source.stop(); } catch(e) {}
        });
        previewPlayer.sources = [];
    }
    // Also clear any active sources that were scheduled but not yet stopped
    previewPlayer.activeSources.forEach(source => {
        try { source.stop(); } catch(e) {}
    });
    previewPlayer.activeSources.clear();

    previewPlayer.isPlaying = false;
    bpmPreviewPlayPauseBtn.textContent = 'Pause' === 'Pause' ? 'Play' : 'Play';

    if(reset) {
        previewPlayer.startOffset = 0;
        bpmPreviewProgressBar.style.width = '0%';
        bpmPreviewTimeDisplay.textContent = `${formatTime(0)} / ${formatTime(previewPlayer.totalDuration)}`;
    }
}

function playBpmPreview(offset = 0) {
    if (!previewPlayer.sampleBuffer) {
        console.error("Preview sample not loaded yet.");
        return;
    }
    stopBpmPreview(false); // Stop current playback without resetting position
    
    previewPlayer.startOffset = offset;
    previewPlayer.isPlaying = true;
    bpmPreviewPlayPauseBtn.textContent = 'Pause';
    previewPlayer.startTime = previewPlayer.audioContext.currentTime;
    
    const eventsToPlay = previewPlayer.events.filter(e => e.time >= offset);
    const C4_MIDI_NOTE = 60;

    eventsToPlay.forEach(event => {
        const playTime = previewPlayer.startTime + (event.time - offset);
        
        if (event.type === 'on') {
            const source = previewPlayer.audioContext.createBufferSource();
            source.buffer = previewPlayer.sampleBuffer;
            
            // Pitch shifting using playbackRate
            const semitone_shift = event.midiNote - C4_MIDI_NOTE;
            source.playbackRate.value = Math.pow(2, semitone_shift / 12);

            source.connect(previewPlayer.audioContext.destination);
            source.start(playTime);
            previewPlayer.activeSources.set(event.midiNote, source); // Track by MIDI note
            previewPlayer.sources.push(source); // Add to general sources list for cleanup
        
        } else if (event.type === 'off') {
            if (previewPlayer.activeSources.has(event.midiNote)) {
                const sourceToStop = previewPlayer.activeSources.get(event.midiNote);
                try {
                    // Stop the note at the scheduled time.
                    sourceToStop.stop(playTime);
                } catch (e) {
                    // Ignore if it's already stopped
                }
                previewPlayer.activeSources.delete(event.midiNote);
            }
        }
    });

    // Add a final stop event for any lingering notes
    const endTimeout = (previewPlayer.totalDuration - offset);
    if(endTimeout > 0) {
         const finalStopTime = previewPlayer.startTime + endTimeout;
         const finalSource = previewPlayer.audioContext.createBufferSource(); // Dummy source
         finalSource.start(finalStopTime);
         finalSource.onended = () => {
             if(previewPlayer.isPlaying) stopBpmPreview();
         };
         previewPlayer.sources.push(finalSource); // Use the general sources array for this dummy
    }

    updatePreviewTime();
}

bpmPreviewPlayPauseBtn.addEventListener('click', () => {
    if (!previewPlayer.audioContext) return;
    if(previewPlayer.audioContext.state === 'suspended') {
        previewPlayer.audioContext.resume();
    }

    if (previewPlayer.isPlaying) {
        previewPlayer.startOffset += previewPlayer.audioContext.currentTime - previewPlayer.startTime;
        stopBpmPreview(false); // Pauses at current position
    } else {
        playBpmPreview(previewPlayer.startOffset);
    }
});

bpmPreviewProgressContainer.addEventListener('click', (e) => {
    if(!previewPlayer.totalDuration) return;
    const rect = bpmPreviewProgressContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const progress = Math.max(0, Math.min(1, x / rect.width));
    const seekTime = previewPlayer.totalDuration * progress;

    const wasPlaying = previewPlayer.isPlaying;
    stopBpmPreview(false);
    previewPlayer.startOffset = seekTime;
    
    // Update UI immediately
    bpmPreviewProgressBar.style.width = `${progress * 100}%`;
    bpmPreviewTimeDisplay.textContent = `${formatTime(seekTime)} / ${formatTime(previewPlayer.totalDuration)}`;

    if(wasPlaying) {
       playBpmPreview(seekTime);
    }
});

function showBpmModal() {
    loadingIndicator.style.display = 'none';
    bpmModal.style.display = 'flex';
}

function hideBpmModals() {
    stopBpmPreview(); // Stop the preview player when closing modals
    bpmModal.style.display = 'none';
    bpmInputModal.style.display = 'none';
}

function finishMidiLoad() {
    try { hideBpmModals(); } catch (e) {}
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    updateMidiControlState('loaded');
}

bpmNoBtn.addEventListener('click', () => {
    userTempoMap = null; // Ensure no custom map is used
    finishMidiLoad();
});

bpmYesBtn.addEventListener('click', () => {
    bpmModal.style.display = 'none';
    bpmInputTextarea.value = ''; // Clear previous input
    bpmInputModal.style.display = 'flex';

    // Initialize BPM preview player
    if (rawMidiBuffer) {
        try {
            // Use a separate, dedicated AudioContext for the preview player
            previewPlayer.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Load the new preview sample
            fetch('/BPMSAMPLENOTEC4.mp3')
                .then(response => response.arrayBuffer())
                .then(buffer => previewPlayer.audioContext.decodeAudioData(buffer))
                .then(decodedBuffer => {
                    previewPlayer.sampleBuffer = decodedBuffer;
                    console.log("BPM Preview sample loaded.");
                })
                .catch(e => console.error("Failed to load BPM preview sample:", e));

            const midiData = parsedMidiData || MidiParser.parse(rawMidiBuffer);
            // Parse with default tempo (null for customTempoMap, default instrument)
            const { events, totalDuration } = parseMidiNotes(midiData, null, null, 'boyfriend', null, null);
            parsedMidiData = midiData;
            previewPlayer.events = events;
            previewPlayer.totalDuration = totalDuration;
            
            // Reset player state
            stopBpmPreview();
            bpmPreviewTimeDisplay.textContent = `${formatTime(0)} / ${formatTime(previewPlayer.totalDuration)}`;

        } catch(e) {
            console.error("Failed to initialize BPM preview player:", e);
            bpmPreviewTimeDisplay.textContent = 'Error loading preview';
        }
    }
});

bpmCancelBtn.addEventListener('click', () => {
    // If user cancels, treat as "no"
    userTempoMap = null;
    finishMidiLoad();
});

bpmSubmitBtn.addEventListener('click', () => {
    const text = bpmInputTextarea.value.trim();
    if (text === '') {
        userTempoMap = null;
        finishMidiLoad();
        return;
    }

    try {
        const lines = text.split('\n');
        const map = lines.map(line => {
            const parts = line.split(',');
            if (parts.length !== 2) throw new Error(`Invalid line format: "${line}"`);
            
            const time = parseTimecodeToSeconds(parts[0]);
            const bpm = parseFloat(parts[1].trim());

            if (isNaN(time) || isNaN(bpm) || time < 0 || bpm <= 0) {
                throw new Error(`Invalid values in line: "${line}"`);
            }
            return { time, bpm };
        });
        
        // Sort by time to ensure correctness
        userTempoMap = map.sort((a, b) => a.time - b.time);
        finishMidiLoad();

    } catch (error) {
        alert(`Error parsing BPM changes: ${error.message}. Please check the format and try again.`);
    }
});

function startMidi() {
    if (!rawMidiBuffer) return;
    
    initAudioContext(); // Ensure audio context is ready
    
    // Always start from beginning for 'Start' button
    const offset = 0;
    
    // Clear pause state, as we are starting fresh
    isMidiPaused = false;
    instrumentalOffsetAtPause = 0;
    
    const doStart = () => {
      midiPlaybackAbsoluteStartTime = audioContext.currentTime - offset;
      playMidi(offset); // Start playback from the calculated offset

      // Start instrumental in sync if loaded
      if (instrumentalBuffer) {
        startInstrumental(offset);
      }

      updateMidiControlState('playing');
    };

    if (audioContext.state === 'suspended') {
        audioContext.resume().then(doStart);
    } else {
        doStart();
    }
}

function pauseResumeMidi() {
    if (!rawMidiBuffer) return;

    if (isMidiPaused) {
        // Resume: from stored pause time (song time)
        isMidiPaused = false;
        initAudioContext(); // Ensure context is ready
        playMidi(midiPlaybackRelativePauseTime);

        // Resume instrumental from stored song-time position
        if (instrumentalBuffer) {
          startInstrumental(instrumentalOffsetAtPause || midiPlaybackRelativePauseTime);
        }

        updateMidiControlState('playing');
    } else {
        // Pause: stop the playback and remember the time
        if (midiPlaybackAbsoluteStartTime !== null) {
            midiPlaybackRelativePauseTime = (audioContext.currentTime - midiPlaybackAbsoluteStartTime) * playbackSpeed;
        } else {
            midiPlaybackRelativePauseTime = 0;
        }

        // Store song-time position for instrumental resume
        instrumentalOffsetAtPause = midiPlaybackRelativePauseTime;

        // Pause instrumental
        if (instrumentalBuffer && isInstrumentalPlaying) {
          pauseInstrumental();
        }

        stopCurrentPlayback(); // Stop scheduled sources without suspending context
        isMidiPaused = true;
        updateMidiControlState('paused');
    }
}

// ==== Stop Midi Playback ====
function stopMidiPlayback() {
  // If context is suspended (e.g., paused), resume it first to ensure sources can be stopped properly
  if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume();
  }

  scheduledSources.forEach(source => {
    try {
      source.stop(); // Stop sources immediately
    } catch(e) { /* ignore errors if source is already stopped */ }
  });
  scheduledSources = []; // Clear the list of scheduled sources

  // Stop instrumental playback as well
  stopInstrumental();
  instrumentalOffsetAtPause = 0;
  
  // Clear visual system
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  scheduledEvents = []; // Clear visual event queue
  
  // Clear the final timeout
  if (finalVisualTimeout) {
    clearTimeout(finalVisualTimeout);
    finalVisualTimeout = null;
  }
  
  // Clear any active keys on the piano
  document.querySelectorAll('.key.active, .key.midi-active').forEach(k => k.classList.remove('active', 'midi-active'));
  resetAllKeyVisuals();
  
  // Only clear the file input if we're fully resetting (i.e., no MIDI buffer)
  if (!rawMidiBuffer) {
    midiFileInput.value = '';
  }

  // Reset playback tracking variables
  midiPlaybackAbsoluteStartTime = null;
  midiPlaybackRelativePauseTime = 0;
  isMidiPaused = false; // Ensure pause state is reset
  
  // Update control buttons state
  updateMidiControlState(rawMidiBuffer ? 'loaded' : 'initial');
}

// Initialize control state on page load
updateMidiControlState('initial');

// New Set BPM Modal
const setBpmModal = document.getElementById('set-bpm-modal-container');
const setBpmInput = document.getElementById('set-bpm-input');
const setBpmApplyBtn = document.getElementById('set-bpm-apply-btn');
const setBpmCancelBtn = document.getElementById('set-bpm-cancel-btn');

// Instrument selector logic
const instrumentSelect = document.getElementById('instrument-select');
const orgeOffsetControls = document.getElementById('orge-offset-controls');
const trackInstrumentsContainer = document.getElementById('track-instruments-container');
instrumentSelect.addEventListener('change', () => {
    if (instrumentSelect.value === 'piano') {
  currentInstrument = 'piano';
  orgeOffsetControls.style.display = 'none';
  ensurePianoBuffers();
} else if (instrumentSelect.value === 'bf2') {
  currentInstrument = 'bf2';
  orgeOffsetControls.style.display = 'none';
} else if (instrumentSelect.value === 'orge') {
  currentInstrument = 'orge';
  orgeOffsetControls.style.display = 'block';
} else if (instrumentSelect.value === 'bambi') {
  currentInstrument = 'bambi';
  orgeOffsetControls.style.display = 'none';
} else if (instrumentSelect.value === 'bandu') {
  currentInstrument = 'bandu';
  orgeOffsetControls.style.display = 'none';
} else if (instrumentSelect.value === 'daddy') {
  currentInstrument = 'daddy';
  orgeOffsetControls.style.display = 'none';
} else if (instrumentSelect.value === 'cedric') {
  currentInstrument = 'cedric';
  orgeOffsetControls.style.display = 'none';
} else if (instrumentSelect.value === 'hello') {
  currentInstrument = 'hello';
  orgeOffsetControls.style.display = 'none';
} else if (instrumentSelect.value === 'fresh') {
  currentInstrument = 'fresh';
  orgeOffsetControls.style.display = 'none';
} else if (instrumentSelect.value === 'burger') {
  currentInstrument = 'burger';
  orgeOffsetControls.style.display = 'none';
} else if (instrumentSelect.value === 'redmungus') {
  currentInstrument = 'redmungus';
  orgeOffsetControls.style.display = 'none';
} else {
  currentInstrument = 'boyfriend';
  orgeOffsetControls.style.display = 'none';
}
buildPianoLayout();
    // Clear any existing per-note visual state since layout changed
    resetAllKeyVisuals();
});



 // Initialize Orge controls visibility and piano based on default select value
if (instrumentSelect.value === 'piano') {
  currentInstrument = 'piano';
  orgeOffsetControls.style.display = 'none';
  ensurePianoBuffers();
} else if (instrumentSelect.value === 'bf2') {
  currentInstrument = 'bf2';
  orgeOffsetControls.style.display = 'none';
} else if (instrumentSelect.value === 'orge') {
  currentInstrument = 'orge';
  orgeOffsetControls.style.display = 'block';
} else if (instrumentSelect.value === 'bambi') {
  currentInstrument = 'bambi';
  orgeOffsetControls.style.display = 'none';
} else if (instrumentSelect.value === 'bandu') {
  currentInstrument = 'bandu';
  orgeOffsetControls.style.display = 'none';
} else if (instrumentSelect.value === 'daddy') {
  currentInstrument = 'daddy';
  orgeOffsetControls.style.display = 'none';
} else if (instrumentSelect.value === 'cedric') {
  currentInstrument = 'cedric';
  orgeOffsetControls.style.display = 'none';
} else if (instrumentSelect.value === 'hello') {
  currentInstrument = 'hello';
  orgeOffsetControls.style.display = 'none';
} else if (instrumentSelect.value === 'fresh') {
  currentInstrument = 'fresh';
  orgeOffsetControls.style.display = 'none';
} else if (instrumentSelect.value === 'burger') {
  currentInstrument = 'burger';
  orgeOffsetControls.style.display = 'none';
} else if (instrumentSelect.value === 'redmungus') {
  currentInstrument = 'redmungus';
  orgeOffsetControls.style.display = 'none';
} else {
  currentInstrument = 'boyfriend';
  orgeOffsetControls.style.display = 'none';
}
buildPianoLayout();


// --- Instrumental helper functions and listeners ---

function ensureInstrumentalGainNode() {
  if (!audioContext) return;
  if (!instrumentalGainNode) {
    instrumentalGainNode = audioContext.createGain();
    instrumentalGainNode.connect(audioContext.destination);
  }
  const gainValue = (instrumentalVolume / 100) * 2; // 0–200 -> 0–2
  instrumentalGainNode.gain.value = gainValue;
}

// songTimeSeconds: position in the MIDI/song timeline (seconds)
function startInstrumental(songTimeSeconds = 0) {
  if (!audioContext || !instrumentalBuffer) return;

  const duration = instrumentalBuffer.duration || 0;

  // Apply user offset (ms) to map song time -> instrumental buffer position
  const bufferPosition = songTimeSeconds + (instrumentalOffsetMs / 1000);
  const clampedOffset = Math.max(0, Math.min(bufferPosition, Math.max(0, duration - 0.05)));

  stopInstrumental();
  ensureInstrumentalGainNode();

  const source = audioContext.createBufferSource();
  source.buffer = instrumentalBuffer;
  source.playbackRate.value = playbackSpeed || 1;
  source.connect(instrumentalGainNode);

  const startAt = audioContext.currentTime + 0.02;
  try {
    source.start(startAt, clampedOffset);
  } catch (e) {
    source.start(startAt);
  }

  instrumentalSource = source;
  instrumentalStartTime = startAt;
  // Keep stored song-time position for resume/seek
  instrumentalOffsetAtPause = songTimeSeconds;
  isInstrumentalPlaying = true;

  source.onended = () => {
    isInstrumentalPlaying = false;
  };
}

function stopInstrumental() {
  if (instrumentalSource) {
    try {
      instrumentalSource.stop();
    } catch (e) {}
    try {
      instrumentalSource.disconnect();
    } catch (e) {}
    instrumentalSource = null;
  }
  isInstrumentalPlaying = false;
}

function pauseInstrumental() {
  if (!audioContext || !instrumentalSource || !instrumentalBuffer) return;
  // We only need to stop; song-time position is tracked via midiPlaybackRelativePauseTime
  stopInstrumental();
}

// Instrumental file loading
if (instrumentalFileInput) {
  instrumentalFileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) {
      instrumentalBuffer = null;
      stopInstrumental();
      instrumentalOffsetAtPause = 0;
      return;
    }

    initAudioContext();
    const reader = new FileReader();
    reader.onload = function(ev) {
      const arrayBuffer = ev.target.result;
      audioContext.decodeAudioData(arrayBuffer)
        .then(decoded => {
          instrumentalBuffer = decoded;
          instrumentalOffsetAtPause = 0;
        })
        .catch(err => {
          console.error('Failed to decode instrumental file:', err);
          instrumentalBuffer = null;
          instrumentalOffsetAtPause = 0;
          stopInstrumental();
          alert('Could not load instrumental audio. Please try a different file.');
        });
    };
    reader.readAsArrayBuffer(file);
  });
}

// Instrumental volume control
if (instrumentalVolumeSlider && instrumentalVolumeValue) {
  instrumentalVolumeSlider.addEventListener('input', () => {
    const val = Math.max(0, Math.min(200, parseInt(instrumentalVolumeSlider.value, 10) || 0));
    instrumentalVolume = val;
    instrumentalVolumeSlider.value = val.toString();
    instrumentalVolumeValue.textContent = val.toString();
    if (audioContext) {
      ensureInstrumentalGainNode();
    }
  });
  // Initialize label
  instrumentalVolumeValue.textContent = instrumentalVolumeSlider.value;
}

// Instrumental offset control (ms)
if (instrumentalOffsetSlider && instrumentalOffsetValue) {
  instrumentalOffsetSlider.addEventListener('input', () => {
    const val = Math.max(-5000, Math.min(5000, parseInt(instrumentalOffsetSlider.value, 10) || 0));
    instrumentalOffsetMs = val;
    instrumentalOffsetSlider.value = val.toString();
    instrumentalOffsetValue.textContent = `${val} ms`;
  });
  instrumentalOffsetValue.textContent = `${instrumentalOffsetSlider.value} ms`;
}

function showSetBpmModal() {
    setBpmInput.value = '';
    setBpmModal.style.display = 'flex';
}

function hideSetBpmModal() {
    setBpmModal.style.display = 'none';
}

setBpmApplyBtn.addEventListener('click', () => {
    const val = parseFloat(setBpmInput.value);
    if (isNaN(val) || val <= 0) { 
        alert('Please enter a valid BPM.'); 
        return; 
    }
    userTempoMap = [{ time: 0, bpm: val }]; // overwrite custom changes
    hideSetBpmModal();
    updateMidiControlState('loaded');
});

setBpmCancelBtn.addEventListener('click', () => {
    hideSetBpmModal();
});