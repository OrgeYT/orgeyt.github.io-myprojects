        // --- GLOBAL UI LISTENERS ---
        document.getElementById('mode-select').addEventListener('change', (e) => {
            synthState.mode = e.target.value;
            const instSelect = document.getElementById('instrument-select');
            const instLabel = document.getElementById('instrument-label');
            
            if (synthState.mode === 'drums') {
                instSelect.innerHTML = drumOptionsHTML;
                instLabel.innerText = "DRUM KIT";
                synthState.drumKit = instSelect.value;
            } else {
                instSelect.innerHTML = synthOptionsHTML;
                instLabel.innerText = "WAVEFORM";
                synthState.instrument = instSelect.value;
            }
        });

        document.getElementById('instrument-select').addEventListener('change', (e) => {
            if (synthState.mode === 'drums') synthState.drumKit = e.target.value;
            else synthState.instrument = e.target.value;
        });

        document.getElementById('volume-slider').addEventListener('input', (e) => {
            synthState.volume = parseFloat(e.target.value);
            if (masterGain) masterGain.gain.setTargetAtTime(synthState.volume, audioCtx.currentTime, 0.05);
        });

        window.addEventListener('keydown', (e) => {
            if (e.repeat) return;
            const keyStr = e.key.toLowerCase();
            const midiNumber = keyMapToMidi[keyStr];
            if (midiNumber) startNote(midiNumber);
        });

        window.addEventListener('keyup', (e) => {
            const keyStr = e.key.toLowerCase();
            const midiNumber = keyMapToMidi[keyStr];
            if (midiNumber) stopNote(midiNumber);
        });

