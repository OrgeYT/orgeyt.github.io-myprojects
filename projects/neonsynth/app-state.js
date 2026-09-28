        let audioCtx = null;
        let masterGain = null;
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
            volume: 0.5
        };

        const synthOptionsHTML = `
            <optgroup label="8-Bit Classics">
                <option value="square">Square</option>
                <option value="pulse14">1/4 Pulse (25%)</option>
                <option value="pulse18">1/8 Pulse (12.5%)</option>
                <option value="triangle">Triangle</option>
                <option value="nes_triangle">NES Triangle</option>
                <option value="sawtooth">Sawtooth</option>
                <option value="sine">Sine</option>
            </optgroup>
            <optgroup label="Music Lab">
                <option value="marimba">Marimba</option>
                <option value="synth_piano">Piano</option>
                <option value="strings">Strings</option>
                <option value="woodwind">Woodwind</option>
            </optgroup>
            <optgroup label="Synths">
                <option value="sqsaw">SqSaw (Mix)</option>
                <option value="fat_saw">Fat Saw</option>
            </optgroup>
        `;
        const drumOptionsHTML = `
            <option value="normal">Normal Kit</option>
            <option value="rock">Rock Kit</option>
            <option value="vibe">Vibe Kit</option>
            <option value="8bit">8-Bit Kit</option>
            <option value="techno">Techno Kit</option>
            <option value="synthwave">Synthwave Kit</option>
        `;

        // --- MIDI SEQUENCER STATE ---
        let midiData = null;
        let midiFileName = '';
        let playbackEvents = [];
        let isPlaying = false;
        let playbackStartTime = 0;
        let pausedAtTime = 0;
        let currentPlaybackTime = 0;
        let nextEventIndex = 0;
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
        const keyMapToMidi = {};

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
            
            if (noteObj.keyMapped) {
                keyMapToMidi[noteObj.keyMapped] = i;
            }
        }
