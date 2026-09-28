        function createBitCrushCurve() {
            const curve = new Float32Array(4096);
            const levels = Math.pow(2, 5 - 1);
            for (let i = 0; i < curve.length; i++) {
                const input = (i * 2) / (curve.length - 1) - 1;
                curve[i] = Math.round(input * levels) / levels;
            }
            return curve;
        }

        function createReverbImpulse(context) {
            const length = Math.floor(context.sampleRate * 1.8);
            const impulse = context.createBuffer(2, length, context.sampleRate);
            for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
                const samples = impulse.getChannelData(channel);
                for (let i = 0; i < length; i++) {
                    const fade = Math.pow(1 - i / length, 3.2);
                    samples[i] = (Math.random() * 2 - 1) * fade;
                }
            }
            return impulse;
        }

        function createEffectsGraph(context, input, destination, settings) {
            const bitCrusherDry = context.createGain();
            const bitCrusherWet = context.createGain();
            const bitCrusher = context.createWaveShaper();
            bitCrusher.curve = createBitCrushCurve();
            bitCrusher.oversample = 'none';

            const reverbInput = context.createGain();
            const reverbDry = context.createGain();
            const convolver = context.createConvolver();
            const reverbWet = context.createGain();
            convolver.buffer = createReverbImpulse(context);

            input.connect(bitCrusherDry);
            bitCrusherDry.connect(reverbInput);
            input.connect(bitCrusher);
            bitCrusher.connect(bitCrusherWet);
            bitCrusherWet.connect(reverbInput);

            reverbInput.connect(reverbDry);
            reverbDry.connect(destination);
            reverbInput.connect(convolver);
            convolver.connect(reverbWet);
            reverbWet.connect(destination);

            const now = context.currentTime;
            bitCrusherDry.gain.setValueAtTime(settings.bitCrush ? 0 : 1, now);
            bitCrusherWet.gain.setValueAtTime(settings.bitCrush ? 1 : 0, now);
            reverbDry.gain.setValueAtTime(settings.reverb ? 0.82 : 1, now);
            reverbWet.gain.setValueAtTime(settings.reverb ? 0.32 : 0, now);

            return { bitCrusherDry, bitCrusherWet, reverbDry, reverbWet };
        }

        function setAudioEffect(effect, enabled) {
            synthState.effects[effect] = enabled;
            if (!effectsGraph || !audioCtx) return;

            const now = audioCtx.currentTime;
            if (effect === 'bitCrush') {
                effectsGraph.bitCrusherDry.gain.setTargetAtTime(enabled ? 0 : 1, now, 0.015);
                effectsGraph.bitCrusherWet.gain.setTargetAtTime(enabled ? 1 : 0, now, 0.015);
            } else if (effect === 'reverb') {
                effectsGraph.reverbDry.gain.setTargetAtTime(enabled ? 0.82 : 1, now, 0.025);
                effectsGraph.reverbWet.gain.setTargetAtTime(enabled ? 0.32 : 0, now, 0.025);
            }
        }

        function initAudio() {
            if (audioCtx) return;
            
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioContext();
            
            // Dynamics Compressor to tame loud peaks
            compressor = audioCtx.createDynamicsCompressor();
            compressor.threshold.setValueAtTime(-18, audioCtx.currentTime);
            compressor.knee.setValueAtTime(6, audioCtx.currentTime);
            compressor.ratio.setValueAtTime(12, audioCtx.currentTime);
            compressor.attack.setValueAtTime(0.002, audioCtx.currentTime);
            compressor.release.setValueAtTime(0.1, audioCtx.currentTime);

            // Brickwall Limiter to guarantee no speaker blowout
            hardLimiter = audioCtx.createDynamicsCompressor();
            hardLimiter.threshold.setValueAtTime(-1, audioCtx.currentTime);
            hardLimiter.knee.setValueAtTime(0, audioCtx.currentTime);
            hardLimiter.ratio.setValueAtTime(20, audioCtx.currentTime);
            hardLimiter.attack.setValueAtTime(0.0005, audioCtx.currentTime);
            hardLimiter.release.setValueAtTime(0.05, audioCtx.currentTime);
            
            compressor.connect(hardLimiter);
            waveformAnalyser = audioCtx.createAnalyser();
            waveformAnalyser.fftSize = 2048;
            waveformAnalyser.smoothingTimeConstant = 0.72;
            waveformSamples = new Uint8Array(waveformAnalyser.fftSize);
            hardLimiter.connect(waveformAnalyser);
            waveformAnalyser.connect(audioCtx.destination);

            masterGain = audioCtx.createGain();
            masterGain.gain.value = synthState.volume;
            effectsGraph = createEffectsGraph(
                audioCtx,
                masterGain,
                compressor,
                synthState.effects
            );

            const dutyCycle = 0.25;
            const terms = 64; 
            const real = new Float32Array(terms);
            const imag = new Float32Array(terms);
            for (let i = 1; i < terms; i++) {
                real[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * dutyCycle);
            }
            pulseWave = audioCtx.createPeriodicWave(real, imag);

            const dutyCycle18 = 0.125;
            const real18 = new Float32Array(terms);
            const imag18 = new Float32Array(terms);
            for (let i = 1; i < terms; i++) {
                real18[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * dutyCycle18);
            }
            pulse18Wave = audioCtx.createPeriodicWave(real18, imag18);

            const bufferSize = audioCtx.sampleRate * 2;
            noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const output = noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1;
            }

            drawAudioWaveform();
        }

        // --- SYNTH VOICES ---
        function createVoice(freq, instrumentType, velocity = 1, options = {}) {
            const context = options.context || audioCtx;
            const destination = options.destination || masterGain;
            const startTime = options.startTime ?? context.currentTime;
            const trackActive = options.trackActive !== false;
            const wave14 = options.pulseWave14 || pulseWave;
            const wave18 = options.pulseWave18 || pulse18Wave;
            const noteGain = context.createGain();
            // Capped base volume specifically scaled down to prevent clipping when chords stack
            let baseVol = 0.12 * velocity; 
            let attack = 0.015;
            let releaseTime = 0.12;
            let decay = null;
            let sustainVol = baseVol;

            let osc1 = context.createOscillator();
            let osc2 = null;
            let osc2Mix = 0.4;
            let detune2 = 0;
            let osc2Ratio = 1;
            let filterSettings = null;

            switch(instrumentType) {
                case 'pulse14': osc1.setPeriodicWave(wave14); break;
                case 'pulse18': osc1.setPeriodicWave(wave18); break;
                case 'sqsaw':
                    osc1.type = 'square';
                    osc2 = context.createOscillator();
                    osc2.type = 'sawtooth';
                    baseVol *= 0.7;
                    sustainVol = baseVol;
                    break;
                case 'strings':
                    osc1.type = 'sawtooth';
                    osc2 = context.createOscillator();
                    osc2.type = 'sawtooth';
                    detune2 = 12;
                    attack = 0.2; releaseTime = 0.4; baseVol *= 0.6; sustainVol = baseVol;
                    break;
                case 'marimba':
                    osc1.type = 'sine';
                    attack = 0.005; releaseTime = 0.15; decay = 0.1; sustainVol = 0.001;
                    break;
                case 'woodwind':
                    osc1.type = 'triangle';
                    attack = 0.1; releaseTime = 0.2;
                    break;
                case 'synth_piano':
                    osc1.type = 'triangle';
                    osc2 = context.createOscillator();
                    osc2.type = 'sawtooth';
                    attack = 0.01; releaseTime = 0.3; decay = 0.6;
                    baseVol *= 0.7; sustainVol = baseVol * 0.2; osc2Mix = 0.25;
                    break;
                case 'electric_piano':
                    osc1.type = 'sine';
                    osc2 = context.createOscillator();
                    osc2.type = 'triangle';
                    osc2Ratio = 2;
                    attack = 0.004; releaseTime = 0.35; decay = 0.22;
                    baseVol *= 0.75; sustainVol = baseVol * 0.14; osc2Mix = 0.22;
                    break;
                case 'bell':
                    osc1.type = 'sine';
                    osc2 = context.createOscillator();
                    osc2.type = 'sine';
                    osc2Ratio = 2.72;
                    attack = 0.002; releaseTime = 0.65; decay = 0.32;
                    baseVol *= 0.75; sustainVol = 0.0001; osc2Mix = 0.28;
                    break;
                case 'pluck':
                    osc1.type = 'sawtooth';
                    osc2 = context.createOscillator();
                    osc2.type = 'triangle';
                    detune2 = 7;
                    attack = 0.003; releaseTime = 0.22; decay = 0.12;
                    baseVol *= 0.65; sustainVol = baseVol * 0.04; osc2Mix = 0.22;
                    filterSettings = { type: 'lowpass', frequency: 2600, endFrequency: 500, decay: 0.16 };
                    break;
                case 'brass':
                    osc1.type = 'sawtooth';
                    osc2 = context.createOscillator();
                    osc2.type = 'square';
                    detune2 = 8;
                    attack = 0.07; releaseTime = 0.2;
                    baseVol *= 0.52; sustainVol = baseVol; osc2Mix = 0.25;
                    filterSettings = { type: 'lowpass', frequency: 1900 };
                    break;
                case 'choir':
                    osc1.type = 'triangle';
                    osc2 = context.createOscillator();
                    osc2.type = 'sine';
                    detune2 = -9;
                    attack = 0.16; releaseTime = 0.35;
                    baseVol *= 0.6; sustainVol = baseVol; osc2Mix = 0.32;
                    break;
                case 'organ':
                    osc1.type = 'sine';
                    osc2 = context.createOscillator();
                    osc2.type = 'triangle';
                    osc2Ratio = 2;
                    attack = 0.012; releaseTime = 0.12;
                    baseVol *= 0.68; sustainVol = baseVol; osc2Mix = 0.24;
                    break;
                case 'bass':
                    osc1.type = 'square';
                    osc2 = context.createOscillator();
                    osc2.type = 'sawtooth';
                    osc2Ratio = 0.5;
                    attack = 0.008; releaseTime = 0.16;
                    baseVol *= 0.58; sustainVol = baseVol; osc2Mix = 0.3;
                    filterSettings = { type: 'lowpass', frequency: 900 };
                    break;
                case 'fat_saw':
                    osc1.type = 'sawtooth';
                    osc2 = context.createOscillator();
                    osc2.type = 'sawtooth';
                    detune2 = -18; baseVol *= 0.5; sustainVol = baseVol; releaseTime = 0.25;
                    break;
                case 'nes_triangle':
                    osc1.type = 'triangle'; attack = 0.01; releaseTime = 0.04;
                    break;
                default: osc1.type = instrumentType || 'square';
            }

            if (Number.isFinite(options.envelopeAttack)) attack = options.envelopeAttack;
            if (Number.isFinite(options.envelopeRelease)) releaseTime = options.envelopeRelease;

            osc1.frequency.value = freq;
            let voiceOutput = noteGain;
            let voiceFilter = null;
            if (filterSettings) {
                voiceFilter = context.createBiquadFilter();
                voiceFilter.type = filterSettings.type;
                voiceFilter.frequency.setValueAtTime(filterSettings.frequency, startTime);
                if (filterSettings.endFrequency) {
                    voiceFilter.frequency.setTargetAtTime(
                        filterSettings.endFrequency,
                        startTime + attack,
                        filterSettings.decay
                    );
                }
                voiceFilter.connect(noteGain);
                voiceOutput = voiceFilter;
            }
            if (osc2) {
                osc2.frequency.value = freq * osc2Ratio;
                osc2.detune.value = detune2;
                const mixGain1 = context.createGain();
                mixGain1.gain.value = 1 - osc2Mix;
                osc1.connect(mixGain1); mixGain1.connect(voiceOutput);
                
                const mixGain2 = context.createGain();
                mixGain2.gain.value = osc2Mix;
                osc2.connect(mixGain2); mixGain2.connect(voiceOutput);
                osc2.start(startTime);
            } else {
                osc1.connect(voiceOutput);
            }
            
            osc1.start(startTime);
            noteGain.connect(destination);

            noteGain.gain.setValueAtTime(0, startTime);
            noteGain.gain.linearRampToValueAtTime(baseVol, startTime + attack);
            if (decay) { noteGain.gain.setTargetAtTime(sustainVol, startTime + attack, decay); }

            const voice = {
                osc1, osc2, noteGain, releaseTime, released: false,
                layerVoices: [],
                setPitchBend: function(semitones, time = context.currentTime) {
                    const cents = semitones * 100;
                    [this.osc1, this.osc2].filter(Boolean).forEach((osc, index) => {
                        const param = osc.detune;
                        const base = index === 1 ? detune2 : 0;
                        try {
                            param.cancelScheduledValues(time);
                            param.setValueAtTime(base + cents, time);
                        } catch (e) {}
                    });
                    this.layerVoices.forEach(layer => layer.setPitchBend(semitones, time));
                },
                stop: function() {
                    if (this.stopped) return;
                    this.stopped = true;
                    this.layerVoices.forEach(layer => layer.stop());
                    const t = context.currentTime;
                    try {
                        this.noteGain.gain.cancelScheduledValues(t);
                        this.noteGain.gain.setValueAtTime(0, t);
                    } catch(e){}
                    try { this.osc1.stop(); } catch(e){}
                    try { if (this.osc2) this.osc2.stop(); } catch(e){}
                }
            };
            if (synthState.effects.layer && !options.disableLayer) {
                const baseMidi = Math.round(69 + 12 * Math.log2(freq / 440));
                const intervals = options.layerIntervals || getLayerIntervalsForMidi(baseMidi);
                intervals.forEach(interval => {
                    const layerVoice = createVoice(
                        freq * Math.pow(2, interval / 12),
                        instrumentType,
                        velocity * 0.34,
                        { ...options, trackActive: false, disableLayer: true }
                    );
                    voice.layerVoices.push(layerVoice);
                });
            }
            if (trackActive) activeVoicesSet.add(voice);
            return voice;
        }

        function releaseVoice(voice, delay = 0) {
            if (!voice || voice.released) return;
            voice.released = true;
            const stopTime = audioCtx.currentTime + delay;
            const rel = voice.releaseTime || 0.1;

            try {
                voice.noteGain.gain.cancelScheduledValues(stopTime);
                voice.noteGain.gain.setTargetAtTime(0, stopTime, rel / 5);
            } catch(e){}
            (voice.layerVoices || []).forEach(layer => releaseVoice(layer, delay));

            setTimeout(() => {
                voice.stop();
                activeVoicesSet.delete(voice);
            }, (rel + 0.3) * 1000);
        }

        // --- DRUM VOICES ---
        function playDrum(midi, kit, velocity = 1, outNode, options = {}) {
            const context = options.context || audioCtx;
            const drumNoiseBuffer = options.noiseBuffer || noiseBuffer;
            const startTime = options.startTime ?? context.currentTime;
            const trackActive = options.trackActive !== false;
            const now = startTime;
            const baseVol = velocity * 0.25; 
            
            const drumGain = context.createGain();
            drumGain.connect(outNode);
            drumGain.gain.setValueAtTime(baseVol, now);

            let oscType = 'triangle';
            let osc2Type = null;
            let osc2Ratio = 1.48;
            let startFreq = 150, endFreq = 20;
            let pitchDecay = 0.1, volDecay = 0.12;
            let useNoise = false;
            let noiseFilterType = 'highpass', noiseFilterFreq = 2000, noiseVol = 0.4;

            let drumType = 'perc';
            if ([35, 36].includes(midi)) drumType = 'kick';
            else if ([38, 40].includes(midi)) drumType = 'snare';
            else if ([37, 39].includes(midi)) drumType = 'clap';
            else if ([42, 44].includes(midi)) drumType = 'hat_closed';
            else if ([46].includes(midi)) drumType = 'hat_open';
            else if ([49, 51, 52, 55, 57, 59].includes(midi)) drumType = 'cymbal';
            else if ([41, 43, 45, 47, 48, 50].includes(midi)) drumType = 'tom';
            else if ([56].includes(midi)) drumType = 'cowbell';
            else if ([54, 69, 70].includes(midi)) drumType = 'shaker';
            else if ([60, 61, 62, 63, 64].includes(midi)) drumType = 'bongo';
            else if ([75, 76, 77].includes(midi)) drumType = 'clave';
            else if ([80, 81].includes(midi)) drumType = 'triangle';

            // Support for Ultrabox pitched noise/boom/crash stacking
            if (drumType === 'perc') {
                useNoise = true;
                noiseFilterType = 'bandpass';
                noiseFilterFreq = 800 * Math.pow(2, (midi - 60) / 12);
                if (noiseFilterFreq < 80) noiseFilterFreq = 80;
                if (noiseFilterFreq > 12000) noiseFilterFreq = 12000;
                noiseVol = 0.4;
                volDecay = 0.2;
            }

            if (drumType === 'kick') { startFreq=140; endFreq=20; pitchDecay=0.08; volDecay=0.12; }
            else if (drumType === 'snare') { startFreq=220; endFreq=130; pitchDecay=0.08; volDecay=0.12; useNoise=true; noiseFilterType='highpass'; noiseFilterFreq=2000; noiseVol=0.35; }
            else if (drumType === 'hat_closed') { useNoise=true; noiseFilterType='highpass'; noiseFilterFreq=5000; noiseVol=0.35; volDecay=0.04; }
            else if (drumType === 'hat_open') { useNoise=true; noiseFilterType='highpass'; noiseFilterFreq=5000; noiseVol=0.35; volDecay=0.2; }
            else if (drumType === 'tom') { startFreq=200 - (midi-41)*10; endFreq=70; pitchDecay=0.12; volDecay=0.2; }
            else if (drumType === 'cymbal') { useNoise=true; noiseFilterType='highpass'; noiseFilterFreq=3000; noiseVol=0.3; volDecay=0.4; }
            else if (drumType === 'clap') { useNoise=true; noiseFilterType='bandpass'; noiseFilterFreq=1200; noiseVol=0.35; volDecay=0.08; }
            else if (drumType === 'cowbell') { oscType='square'; osc2Type='square'; startFreq=540; endFreq=540; pitchDecay=0.01; volDecay=0.15; }
            else if (drumType === 'shaker') { useNoise=true; noiseFilterType='bandpass'; noiseFilterFreq=6000; noiseVol=0.25; volDecay=0.06; }
            else if (drumType === 'bongo') { oscType='sine'; startFreq=320 - (midi-60)*12; endFreq=startFreq*0.8; pitchDecay=0.08; volDecay=0.12; }
            else if (drumType === 'clave') { oscType='sine'; startFreq=2400; endFreq=2400; pitchDecay=0.01; volDecay=0.04; }
            else if (drumType === 'triangle') { oscType='triangle'; startFreq=2800; endFreq=2800; pitchDecay=0.01; volDecay=0.5; }

            if (kit === 'vibe') { 
                if (drumType === 'kick') { oscType='sine'; startFreq=90; endFreq=35; pitchDecay=0.2; volDecay=0.5; }
                else if (drumType === 'snare') { startFreq=180; endFreq=90; useNoise=true; noiseFilterType='highpass'; noiseFilterFreq=3000; noiseVol=0.25; }
            } else if (kit === 'rock') { 
                if (drumType === 'kick') { oscType='square'; startFreq=110; endFreq=20; pitchDecay=0.04; volDecay=0.12; }
                else if (drumType === 'snare') { oscType='square'; startFreq=190; endFreq=90; useNoise=true; noiseFilterType='lowpass'; noiseFilterFreq=3500; noiseVol=0.5; }
            } else if (kit === '8bit') {
                oscType = 'square'; osc2Type = null;
                if (drumType === 'kick') { startFreq=90; endFreq=20; pitchDecay=0.04; volDecay=0.08; }
                else if (drumType === 'snare') { useNoise=true; noiseFilterType='bandpass'; noiseFilterFreq=1500; noiseVol=0.5; }
            } else if (kit === 'techno') {
                if (drumType === 'kick') { oscType='sine'; startFreq=95; endFreq=20; pitchDecay=0.15; volDecay=0.2; }
            } else if (kit === 'synthwave') {
                if (drumType === 'kick') { oscType='triangle'; startFreq=110; endFreq=25; pitchDecay=0.12; volDecay=0.2; }
            }

            try {
                drumGain.gain.exponentialRampToValueAtTime(0.001, now + volDecay);
            } catch(e){}

            let osc, osc2, noise;
            if (!['hat_closed', 'hat_open', 'cymbal', 'clap', 'shaker', 'perc'].includes(drumType)) {
                osc = context.createOscillator();
                osc.type = oscType;
                osc.frequency.setValueAtTime(startFreq, now);
                osc.frequency.exponentialRampToValueAtTime(endFreq, now + pitchDecay);
                osc.connect(drumGain);
                osc.start(now);
                osc.stop(now + volDecay + 0.05);

                if (osc2Type) {
                    osc2 = context.createOscillator();
                    osc2.type = osc2Type;
                    osc2.frequency.setValueAtTime(startFreq * osc2Ratio, now);
                    osc2.frequency.exponentialRampToValueAtTime(endFreq * osc2Ratio, now + pitchDecay);
                    osc2.connect(drumGain);
                    osc2.start(now);
                    osc2.stop(now + volDecay + 0.05);
                }
            }

            if (useNoise && drumNoiseBuffer) {
                noise = context.createBufferSource();
                noise.buffer = drumNoiseBuffer;
                const filter = context.createBiquadFilter();
                filter.type = noiseFilterType;
                filter.frequency.value = noiseFilterFreq;
                const nGain = context.createGain();
                nGain.gain.value = noiseVol;
                
                noise.connect(filter);
                filter.connect(nGain);
                nGain.connect(drumGain);
                noise.start(now);
                noise.stop(now + volDecay + 0.05);
            }

            const drumVoice = {
                stop: function() {
                    try {
                        drumGain.gain.cancelScheduledValues(context.currentTime);
                        drumGain.gain.setValueAtTime(0, context.currentTime);
                    } catch(e){}
                    try { if (osc) osc.stop(); } catch(e){}
                    try { if (osc2) osc2.stop(); } catch(e){}
                    try { if (noise) noise.stop(); } catch(e){}
                }
            };
            if (trackActive) {
                activeVoicesSet.add(drumVoice);
                setTimeout(() => activeVoicesSet.delete(drumVoice), (volDecay + 0.2) * 1000);
            }
            return { ...drumVoice, duration: volDecay };
        }

        // --- KEYBOARD INTERACTIONS ---
        function startNote(midiNumber) {
            initAudio();
            if (synthState.mode === 'drums') {
                playDrum(midiNumber, synthState.drumKit, 1, masterGain);
                const keyEl = document.getElementById(`key-${midiNumber}`);
                if (keyEl) {
                    keyEl.classList.add('active');
                    setTimeout(() => keyEl.classList.remove('active'), 120);
                }
                return;
            }

            if (activeNotes[midiNumber]) return;
            const note = notes.find(n => n.midi === midiNumber);
            if (!note) return;

            const voice = createVoice(note.freq, synthState.instrument, 1, {
                layerIntervals: getLayerIntervalsForMidi(midiNumber),
                envelopeAttack: synthState.attack,
                envelopeRelease: synthState.release
            });
            activeNotes[midiNumber] = voice;
            
            const keyEl = document.getElementById(`key-${midiNumber}`);
            if (keyEl) keyEl.classList.add('active');
        }

        function stopNote(midiNumber) {
            if (synthState.mode === 'drums') return;
            
            const voice = activeNotes[midiNumber];
            if (!voice) return;

            releaseVoice(voice);
            delete activeNotes[midiNumber];

            const keyEl = document.getElementById(`key-${midiNumber}`);
            if (keyEl) keyEl.classList.remove('active');
        }

        function renderKeyboard() {
            const container = document.getElementById('keyboard');
            
            const whiteKeys = notes.filter(n => n.type === 'white');
            const totalWhiteKeys = whiteKeys.length;
            const whiteKeyWidthPercent = 100 / totalWhiteKeys;
            
            let currentWhiteIndex = 0;

            notes.forEach((note) => {
                const keyEl = document.createElement('div');
                keyEl.id = `key-${note.midi}`;
                keyEl.className = `key key-${note.type}`;
                
                if (note.keyMapped) keyEl.innerText = note.keyMapped.toUpperCase();

                if (note.type === 'white') {
                    currentWhiteIndex++;
                } else {
                    const blackKeyWidth = whiteKeyWidthPercent * 0.65; 
                    const leftOffset = (currentWhiteIndex * whiteKeyWidthPercent) - (blackKeyWidth / 2);
                    keyEl.style.width = `${blackKeyWidth}%`;
                    keyEl.style.left = `${leftOffset}%`;
                }

                const startEvent = (e) => { e.preventDefault(); startNote(note.midi); };
                const stopEvent = (e) => { e.preventDefault(); stopNote(note.midi); };

                keyEl.addEventListener('mousedown', startEvent);
                keyEl.addEventListener('touchstart', startEvent, {passive: false});
                
                keyEl.addEventListener('mouseup', stopEvent);
                keyEl.addEventListener('mouseleave', stopEvent);
                keyEl.addEventListener('touchend', stopEvent);
                keyEl.addEventListener('touchcancel', stopEvent);

                container.appendChild(keyEl);
            });
            
            setTimeout(() => {
                const wrapper = document.getElementById('keyboard-wrapper');
                const middleC = document.getElementById('key-60');
                if (wrapper && middleC) wrapper.scrollLeft = middleC.offsetLeft - (wrapper.clientWidth / 2);
            }, 100);
        }
