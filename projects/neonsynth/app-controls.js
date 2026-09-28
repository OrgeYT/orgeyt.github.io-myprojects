        // --- GLOBAL UI LISTENERS ---
        document.getElementById('mode-select').addEventListener('change', (e) => {
            synthState.mode = e.target.value;
            const instSelect = document.getElementById('instrument-select');
            const instLabel = document.getElementById('instrument-label');
            
            if (synthState.mode === 'drums') {
                instSelect.innerHTML = drumOptionsHTML;
                instLabel.innerText = "Drum kit";
                synthState.drumKit = instSelect.value;
            } else {
                instSelect.innerHTML = synthOptionsHTML;
                instLabel.innerText = "Waveform";
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

        function formatEnvelopeValue(seconds) {
            return seconds < 1
                ? `${Math.round(seconds * 1000)} ms`
                : `${seconds.toFixed(1)} s`;
        }

        document.getElementById('attack-slider').addEventListener('input', (e) => {
            synthState.attack = Number(e.target.value);
            document.getElementById('attack-value').textContent = formatEnvelopeValue(synthState.attack);
        });

        document.getElementById('release-slider').addEventListener('input', (e) => {
            synthState.release = Number(e.target.value);
            document.getElementById('release-value').textContent = formatEnvelopeValue(synthState.release);
        });

        const commonChords = [
            { name: 'C', root: 48, intervals: [0, 4, 7] },
            { name: 'Dm', root: 50, intervals: [0, 3, 7] },
            { name: 'Em', root: 52, intervals: [0, 3, 7] },
            { name: 'F', root: 53, intervals: [0, 4, 7] },
            { name: 'G', root: 55, intervals: [0, 4, 7] },
            { name: 'Am', root: 57, intervals: [0, 3, 7] },
            { name: 'Bdim', root: 59, intervals: [0, 3, 6] },
            { name: 'C7', root: 48, intervals: [0, 4, 7, 10] },
            { name: 'Dm7', root: 50, intervals: [0, 3, 7, 10] },
            { name: 'Fmaj7', root: 53, intervals: [0, 4, 7, 11] },
            { name: 'G7', root: 55, intervals: [0, 4, 7, 10] },
            { name: 'Am7', root: 57, intervals: [0, 3, 7, 10] }
        ];
        const chordButtons = document.getElementById('chord-buttons');
        commonChords.forEach(chord => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'chord-button text-[10px] px-3 py-2';
            button.textContent = chord.name;
            button.addEventListener('click', () => {
                initAudio();
                const voices = chord.intervals.map(interval => {
                    const midi = chord.root + interval;
                    const freq = 440 * Math.pow(2, (midi - 69) / 12);
                    return createVoice(freq, synthState.instrument, 1, {
                        layerIntervals: getLayerIntervalsForMidi(midi),
                        envelopeAttack: synthState.attack,
                        envelopeRelease: synthState.release
                    });
                });
                const timer = setTimeout(() => voices.forEach(releaseVoice), 1000);
                scheduledTimeouts.push(timer);
            });
            chordButtons.appendChild(button);
        });

        document.getElementById('keyboard-range-slider').addEventListener('input', (e) => {
            heldKeyboardNotes.forEach(midiNumber => stopNote(midiNumber));
            heldKeyboardNotes.clear();
            setKeyboardRange(e.target.value);
        });

        document.querySelectorAll('.effect-toggle').forEach(button => {
            button.addEventListener('click', () => {
                const effect = button.dataset.effect;
                const enabled = button.getAttribute('aria-pressed') !== 'true';
                setAudioEffect(effect, enabled);
                button.setAttribute('aria-pressed', String(enabled));
            });
        });

        const layerKeySelect = document.getElementById('layer-key');
        const layerKeyNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        layerKeySelect.innerHTML = layerKeyNames.map((name, root) => `
            <option value="${root}-major">${name} major</option>
            <option value="${root}-minor">${name} minor</option>
        `).join('');
        layerKeySelect.addEventListener('change', () => {
            const [root, mode] = layerKeySelect.value.split('-');
            synthState.layerKey = { root: Number(root), mode };
        });

        function inferMidiLayerKey(midi) {
            if (!midi?.tracks?.length) return null;
            const histogram = Array(12).fill(0);
            midi.tracks.forEach(track => {
                if (track.instrument?.percussion || Number(track.channel) === 9) return;
                (track.notes || []).forEach(note => {
                    const pitchClass = ((note.midi % 12) + 12) % 12;
                    const durationWeight = Math.min(2, Math.max(0.15, note.duration || 0.15));
                    histogram[pitchClass] += durationWeight * (0.5 + (note.velocity || 0.5));
                });
            });
            if (!histogram.some(value => value > 0)) return null;

            const profiles = {
                major: [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
                minor: [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
            };
            let best = null;
            Object.entries(profiles).forEach(([mode, profile]) => {
                for (let root = 0; root < 12; root++) {
                    const observed = profile.map((_, degree) => histogram[(root + degree) % 12]);
                    const observedMean = observed.reduce((sum, value) => sum + value, 0) / 12;
                    const profileMean = profile.reduce((sum, value) => sum + value, 0) / 12;
                    let numerator = 0;
                    let observedPower = 0;
                    let profilePower = 0;
                    for (let i = 0; i < 12; i++) {
                        const observedDelta = observed[i] - observedMean;
                        const profileDelta = profile[i] - profileMean;
                        numerator += observedDelta * profileDelta;
                        observedPower += observedDelta * observedDelta;
                        profilePower += profileDelta * profileDelta;
                    }
                    const score = numerator / Math.sqrt(observedPower * profilePower || 1);
                    if (!best || score > best.score) best = { root, mode, score };
                }
            });
            return best;
        }

        function applyMidiLayerKey(signature, midi) {
            const keyNames = {
                C: 0, 'B#': 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3,
                E: 4, Fb: 4, 'E#': 5, F: 5, 'F#': 6, Gb: 6, G: 7,
                'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11, Cb: 11
            };
            let root = signature ? keyNames[signature.key] : undefined;
            let mode = signature && String(signature.scale || '').toLowerCase().includes('minor')
                ? 'minor'
                : 'major';
            if (root === undefined) {
                const inferred = inferMidiLayerKey(midi);
                if (!inferred) return;
                root = inferred.root;
                mode = inferred.mode;
            }
            const value = `${root}-${mode}`;
            layerKeySelect.value = value;
            synthState.layerKey = { root, mode };
        }

        window.addEventListener('keydown', (e) => {
            if (e.repeat) return;
            const keyStr = e.key.toLowerCase();
            const midiNumber = keyMapToMidi[keyStr];
            if (midiNumber) {
                heldKeyboardNotes.set(keyStr, midiNumber);
                startNote(midiNumber);
            }
        });

        window.addEventListener('keyup', (e) => {
            const keyStr = e.key.toLowerCase();
            const midiNumber = heldKeyboardNotes.get(keyStr);
            if (midiNumber !== undefined) {
                stopNote(midiNumber);
                heldKeyboardNotes.delete(keyStr);
            }
        });
