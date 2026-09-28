        let audioCtx = null;
        let masterGain = null;
        let effectsGraph = null;
        let compressor = null;
        let hardLimiter = null;
        let waveformAnalyser = null;
        let waveformAnimationFrameId = null;
        let waveformSamples = null;
        let pulseWave = null;
        let pulse18Wave = null;
        let noiseBuffer = null;
        
        const activeNotes = {}; 
        const activeMidiNotes = {}; 
        const activeVoicesSet = new Set(); // Global tracker for hard panic stops
        
        const synthState = {
            mode: 'synth', 
            instrument: 'square', 
            drumKit: 'normal', 
            volume: 0.5,
            attack: 0.015,
            release: 0.12,
            effects: {
                reverb: false,
                bitCrush: false,
                layer: false
            },
            layerKey: { root: 0, mode: 'major' }
        };

        const layerScaleIntervals = {
            major: [0, 2, 4, 5, 7, 9, 11],
            minor: [0, 2, 3, 5, 7, 8, 10]
        };
        const layerTriadIntervals = {
            major: [[4, 7], [3, 7], [3, 7], [4, 7], [4, 7], [3, 7], [3, 6]],
            minor: [[3, 7], [3, 6], [4, 7], [3, 7], [3, 7], [4, 7], [4, 7]]
        };

        function getLayerIntervalsForMidi(midi) {
            const mode = synthState.layerKey.mode;
            const scale = layerScaleIntervals[mode] || layerScaleIntervals.major;
            const triads = layerTriadIntervals[mode] || layerTriadIntervals.major;
            const pitchClass = ((midi % 12) + 12) % 12;
            const degreeDistances = scale.map((step, degree) => {
                const scalePitch = (synthState.layerKey.root + step) % 12;
                const distance = ((pitchClass - scalePitch + 18) % 12) - 6;
                return { degree, distance: Math.abs(distance) };
            });
            degreeDistances.sort((a, b) => a.distance - b.distance);
            return triads[degreeDistances[0].degree];
        }

        const synthOptionsHTML = `
            <optgroup label="8-bit classics">
                <option value="square">Square</option>
                <option value="pulse14">1/4 Pulse (25%)</option>
                <option value="pulse18">1/8 Pulse (12.5%)</option>
                <option value="triangle">Triangle</option>
                <option value="nes_triangle">NES Triangle</option>
                <option value="sawtooth">Sawtooth</option>
                <option value="sine">Sine</option>
            </optgroup>
            <optgroup label="Music lab">
                <option value="marimba">Marimba</option>
                <option value="synth_piano">Piano</option>
                <option value="electric_piano">Electric piano</option>
                <option value="bell">Bell</option>
                <option value="pluck">Plucked synth</option>
                <option value="strings">Strings</option>
                <option value="woodwind">Woodwind</option>
                <option value="brass">Brass</option>
                <option value="choir">Choir</option>
            </optgroup>
            <optgroup label="Synths">
                <option value="sqsaw">Sqsaw (mix)</option>
                <option value="fat_saw">Fat saw</option>
                <option value="organ">Organ</option>
                <option value="bass">Synth bass</option>
            </optgroup>
        `;
        const drumOptionsHTML = `
            <option value="normal">Normal kit</option>
            <option value="rock">Rock kit</option>
            <option value="vibe">Vibe kit</option>
            <option value="8bit">8-bit kit</option>
            <option value="techno">Techno kit</option>
            <option value="synthwave">Synthwave kit</option>
        `;

        // --- MIDI SEQUENCER STATE ---
        let midiData = null;
        let midiFileName = '';
        let playbackEvents = [];
        let pitchBendEvents = [];
        let pitchBendsByTrack = {};
        let isPlaying = false;
        let playbackStartTime = 0;
        let pausedAtTime = 0;
        let currentPlaybackTime = 0;
        let nextEventIndex = 0;
        let nextPitchBendIndex = 0;
        let animationFrameId = null;
        let duration = 0;
        let scheduledTimeouts = [];
        let tracksConfig = {}; 

        // --- PIANO GENERATION LOGIC (88 Keys) ---
        const notes = [];
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        
        const keyboardMap = {
           48: 'z', 49: 's', 50: 'x', 51: 'd', 52: 'c', 53: 'v', 54: 'g', 55: 'b',
           56: 'h', 57: 'n', 58: 'j', 59: 'm', 
           60: 'q', 61: '2', 62: 'w', 63: '3', 64: 'e', 65: 'r', 66: '5', 67: 't',
           68: '6', 69: 'y', 70: '7', 71: 'u', 
           72: 'i', 73: '9', 74: 'o', 75: '0', 76: 'p' 
        };
        const keyboardKeyOrder = Object.values(keyboardMap);
        const keyMapToMidi = {};
        const heldKeyboardNotes = new Map();
        let keyboardRangeStart = 48;

        for (let i = 21; i <= 108; i++) {
            const noteIndex = i % 12;
            const octave = Math.floor(i / 12) - 1;
            const isBlack = noteNames[noteIndex].includes('#');
            const freq = 440 * Math.pow(2, (i - 69) / 12);
            
            const noteObj = {
                midi: i,
                name: `${noteNames[noteIndex]}${octave}`,
                freq: freq,
                type: isBlack ? 'black' : 'white',
                keyMapped: keyboardMap[i] || null
            };
            notes.push(noteObj);
        }

        function setKeyboardRange(startMidi) {
            const lastStart = 108 - keyboardKeyOrder.length + 1;
            keyboardRangeStart = Math.max(21, Math.min(lastStart, Number(startMidi)));
            Object.keys(keyMapToMidi).forEach(key => delete keyMapToMidi[key]);
            notes.forEach(note => { note.keyMapped = null; });

            keyboardKeyOrder.forEach((key, index) => {
                const midi = keyboardRangeStart + index;
                const note = notes[midi - 21];
                if (!note) return;
                note.keyMapped = key;
                keyMapToMidi[key] = midi;
            });

            notes.forEach(note => {
                const keyEl = document.getElementById(`key-${note.midi}`);
                if (keyEl) keyEl.textContent = note.keyMapped || '';
            });

            const rangeDisplay = document.getElementById('keyboard-range-display');
            if (rangeDisplay) {
                const firstNote = notes[keyboardRangeStart - 21];
                const lastNote = notes[keyboardRangeStart + keyboardKeyOrder.length - 1 - 21];
                rangeDisplay.textContent = `${firstNote.name}–${lastNote.name}`;
                document.getElementById('keyboard-range-slider')?.setAttribute(
                    'aria-valuetext',
                    `${firstNote.name} to ${lastNote.name}`
                );
            }
        }

        setKeyboardRange(keyboardRangeStart);
