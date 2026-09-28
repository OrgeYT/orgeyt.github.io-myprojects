        // --- MIDI PROCESSING ---
        document.getElementById('midi-upload').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            stopPlayback(); 
            initAudio();

            const reader = new FileReader();
            reader.onload = function(e) {
                const arrayBuffer = e.target.result;
                try {
                    midiData = new Midi(arrayBuffer);
                    midiFileName = file.name.replace(/\.[^.]+$/, '');
                    document.getElementById('btn-export-wav').disabled = false;
                    processMidiData();
                } catch (err) {
                    console.error("Error parsing MIDI", err);
                    alert("Could not parse midi file.");
                }
            };
            reader.readAsArrayBuffer(file);
        });

        function guessInstrumentType(programNumber, trackName = '') {
            const t = trackName.toLowerCase();
            if (t.includes('noise') || t.includes('drum') || t.includes('perc') || t.includes('boom') || t.includes('crash')) return 'drums';
            if (programNumber >= 0 && programNumber <= 3) return 'synth_piano';
            if (programNumber >= 4 && programNumber <= 7) return 'electric_piano';
            if (programNumber >= 8 && programNumber <= 11) return 'marimba';
            if (programNumber >= 12 && programNumber <= 15) return 'bell';
            if (programNumber >= 16 && programNumber <= 23) return 'organ';
            if (programNumber >= 24 && programNumber <= 31) return 'pluck';
            if (programNumber >= 32 && programNumber <= 39) return 'bass';
            if (programNumber >= 40 && programNumber <= 51) return 'strings';
            if (programNumber >= 52 && programNumber <= 55) return 'choir';
            if (programNumber >= 56 && programNumber <= 63) return 'brass';
            if (programNumber >= 64 && programNumber <= 79) return 'woodwind';
            if (programNumber >= 80 && programNumber <= 87) return 'sqsaw';
            if (programNumber >= 88 && programNumber <= 95) return 'fat_saw';
            return 'square'; 
        }

        function midiPitchBendValue(bend, rangeSemitones = 2) {
            const normalizedValue = Number(bend.value) || 0;
            return Math.max(-1, Math.min(1, normalizedValue)) * rangeSemitones;
        }

        function getTrackPitchBendEvents(track, trackId) {
            const sensitivityControls = new Set([6, 38, 98, 99, 100, 101]);
            const controlEvents = Object.entries(track.controlChanges || {})
                .filter(([controller]) => sensitivityControls.has(Number(controller)))
                .flatMap(([controller, events]) => (events || []).map(event => {
                    const rawValue = Number(event.value) || 0;
                    const value = rawValue >= 0 && rawValue <= 1
                        ? Math.round(rawValue * 127)
                        : Math.round(rawValue);
                    return {
                        time: event.time,
                        controller: Number(controller),
                        value: Math.max(0, Math.min(127, value))
                    };
                }))
                .sort((a, b) => {
                    if (a.time !== b.time) return a.time - b.time;
                    const selectorRank = controller =>
                        [101, 100, 99, 98].includes(controller) ? 0 : 1;
                    return selectorRank(a.controller) - selectorRank(b.controller);
                });
            const bends = [...track.pitchBends].sort((a, b) => a.time - b.time);

            let controlIndex = 0;
            let selectedRpnMsb = 127;
            let selectedRpnLsb = 127;
            let bendRangeSemitones = 2;
            let bendRangeCents = 0;
            const events = [];

            bends.forEach(bend => {
                while (controlIndex < controlEvents.length &&
                    controlEvents[controlIndex].time <= bend.time) {
                    const control = controlEvents[controlIndex++];
                    if (control.controller === 101) {
                        selectedRpnMsb = control.value;
                    } else if (control.controller === 100) {
                        selectedRpnLsb = control.value;
                    } else if (control.controller === 99 || control.controller === 98) {
                        selectedRpnMsb = 127;
                        selectedRpnLsb = 127;
                    } else if (selectedRpnMsb === 0 && selectedRpnLsb === 0) {
                        if (control.controller === 6) {
                            bendRangeSemitones = control.value;
                        } else if (control.controller === 38) {
                            bendRangeCents = control.value;
                        }
                    }
                }

                events.push({
                    time: bend.time,
                    value: midiPitchBendValue(
                        bend,
                        bendRangeSemitones + bendRangeCents / 100
                    ),
                    trackId
                });
            });
            return events;
        }

        function detectDrumTrack(track) {
            const trackName = (track.name || '').toLowerCase();
            const instrumentName = (track.instrument?.name || '').toLowerCase();
            const namedAsDrums = /\b(drums?|percussion|perc|kick|snare|hi.?hat|cymbal|tom|noise|boom|crash)\b/.test(
                `${trackName} ${instrumentName}`
            );

            // MIDI channels are zero-based in @tonejs/midi, so channel 9 is
            // General MIDI channel 10, reserved for percussion.
            return track.instrument?.percussion === true ||
                Number(track.channel) === 9 ||
                namedAsDrums;
        }

        function processMidiData() {
            playbackEvents = [];
            pitchBendEvents = [];
            pitchBendsByTrack = {};
            tracksConfig = {};
            duration = midiData.duration;
            applyMidiLayerKey(midiData.header.keySignatures?.[0], midiData);
            
            document.getElementById('seek-bar').max = duration;
            document.getElementById('duration-display').innerText = formatTime(duration);

            const trackListEl = document.getElementById('track-list');
            trackListEl.innerHTML = '';

            midiData.tracks.forEach((track, index) => {
                if (track.notes.length === 0) return;
                
                const tName = (track.name || '').toLowerCase();
                const isDrumTrack = detectDrumTrack(track);
                const guessedInst = isDrumTrack ? 'drums' : guessInstrumentType(track.instrument.number, tName);
                const guessedInstLabel = guessedInst
                    .replaceAll('_', ' ')
                    .replace(/^./, letter => letter.toUpperCase());
                
                tracksConfig[index] = {
                    muted: false,
                    instrument: 'auto', 
                    autoInstrument: guessedInst,
                    isDrumTrack: isDrumTrack
                };

                track.notes.forEach(note => {
                    playbackEvents.push({
                        time: note.time, duration: note.duration,
                        midi: note.midi, velocity: note.velocity, trackId: index
                    });
                });
                if (!isDrumTrack && Array.isArray(track.pitchBends)) {
                    pitchBendEvents.push(...getTrackPitchBendEvents(track, index));
                    pitchBendsByTrack[index] = 0;
                }

                const trackRow = document.createElement('div');
                trackRow.className = "track-row bg-gray-900 p-2 rounded border border-gray-700";
                
                const instOptions = `
                    <option value="auto">Auto (${guessedInstLabel})</option>
                    ${synthOptionsHTML}
                    <optgroup label="Drum kits">
                        ${drumOptionsHTML}
                    </optgroup>
                `;

                trackRow.innerHTML = `
                    <div class="text-[9px] truncate text-gray-300" title="${track.name || 'Track '+index}">
                        ${track.name || 'Track ' + index}
                    </div>
                    <select class="text-[8px] bg-black p-1 instrument-override" data-track="${index}">
                        ${instOptions}
                    </select>
                    <button class="text-[8px] px-2 py-1 bg-gray-800 mute-btn" data-track="${index}">Mute</button>
                `;
                trackListEl.appendChild(trackRow);
            });

            playbackEvents.sort((a, b) => a.time - b.time);
            pitchBendEvents.sort((a, b) => a.time - b.time);
            
            document.querySelectorAll('.mute-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const tId = e.target.getAttribute('data-track');
                    tracksConfig[tId].muted = !tracksConfig[tId].muted;
                    e.target.style.background = tracksConfig[tId].muted ? '#f00' : '#1f2937';
                });
            });
            document.querySelectorAll('.instrument-override').forEach(sel => {
                sel.addEventListener('change', (e) => {
                    const tId = e.target.getAttribute('data-track');
                    tracksConfig[tId].instrument = e.target.value;
                });
            });

            resetPlayback();
            drawPianoRollBackground(); 
        }

        function formatTime(seconds) {
            const m = Math.floor(seconds / 60);
            const s = Math.floor(seconds % 60);
            return `${m}:${s.toString().padStart(2, '0')}`;
        }

        function getMidiEnvelopeOptions(config) {
            const autoManagesEnvelope = config.instrument === 'auto' &&
                document.getElementById('auto-envelope-toggle').checked;
            if (autoManagesEnvelope) return {};
            return {
                envelopeAttack: synthState.attack,
                envelopeRelease: synthState.release
            };
        }

        function playMidiNoteEvent(event) {
            const config = tracksConfig[event.trackId];
            if (config && config.muted) return;

            const keyEl = document.getElementById(`key-${event.midi}`);

            let inst = config.instrument;
            if (inst === 'auto') inst = config.autoInstrument;

            const drumKits = ['drums', 'normal', 'rock', 'vibe', '8bit', 'techno', 'synthwave'];
            const isDrumsNow = drumKits.includes(inst);

            if (isDrumsNow) {
                let kit = (inst === 'drums') ? 'normal' : inst;
                playDrum(event.midi, kit, event.velocity, masterGain);
                
                if (keyEl) {
                    keyEl.classList.add('midi-active');
                    const tid = setTimeout(() => {
                        if (keyEl) keyEl.classList.remove('midi-active');
                    }, 80);
                    scheduledTimeouts.push(tid);
                }
                return;
            }

            const freq = 440 * Math.pow(2, (event.midi - 69) / 12);
            const voice = createVoice(freq, inst, event.velocity, {
                layerIntervals: getLayerIntervalsForMidi(event.midi),
                ...getMidiEnvelopeOptions(config)
            });
            if (voice.setPitchBend) voice.setPitchBend(pitchBendsByTrack[event.trackId] || 0);
            const eventId = `${event.midi}_${event.time}_${event.trackId}`;
            activeMidiNotes[eventId] = voice;

            if (keyEl) keyEl.classList.add('midi-active');

            const tid = setTimeout(() => {
                if (activeMidiNotes[eventId]) {
                    releaseVoice(activeMidiNotes[eventId]);
                    delete activeMidiNotes[eventId];
                }
                
                let stillPlaying = false;
                for (let key in activeMidiNotes) {
                    if (key.startsWith(`${event.midi}_`)) { stillPlaying = true; break; }
                }
                if (!stillPlaying && keyEl) keyEl.classList.remove('midi-active');
            }, event.duration * 1000);
            scheduledTimeouts.push(tid);
        }

        function playMidiPitchBendEvent(event) {
            pitchBendsByTrack[event.trackId] = event.value;
            const now = audioCtx.currentTime;
            Object.entries(activeMidiNotes).forEach(([id, voice]) => {
                if (id.endsWith(`_${event.trackId}`) && voice?.setPitchBend) {
                    voice.setPitchBend(event.value, now);
                }
            });
        }

        function scheduleTimelineEvent(event, callback) {
            const delay = (event.time - currentPlaybackTime) * 1000;
            if (delay <= 0) {
                callback(event);
            } else {
                const tid = setTimeout(() => callback(event), delay);
                scheduledTimeouts.push(tid);
            }
        }

        function sequencerLoop() {
            if (!isPlaying) return;

            const now = audioCtx.currentTime;
            currentPlaybackTime = pausedAtTime + (now - playbackStartTime);

            document.getElementById('time-display').innerText = formatTime(currentPlaybackTime);
            document.getElementById('seek-bar').value = currentPlaybackTime;
            drawPianoRoll(currentPlaybackTime);

            const scheduleAhead = 0.1; 
            
            while (nextEventIndex < playbackEvents.length) {
                const event = playbackEvents[nextEventIndex];
                if (event.time <= currentPlaybackTime + scheduleAhead) {
                    scheduleTimelineEvent(event, playMidiNoteEvent);
                    nextEventIndex++;
                } else {
                    break;
                }
            }
            while (nextPitchBendIndex < pitchBendEvents.length) {
                const event = pitchBendEvents[nextPitchBendIndex];
                if (event.time <= currentPlaybackTime + scheduleAhead) {
                    scheduleTimelineEvent(event, playMidiPitchBendEvent);
                    nextPitchBendIndex++;
                } else {
                    break;
                }
            }

            if (currentPlaybackTime >= duration) {
                stopPlayback();
            } else {
                animationFrameId = requestAnimationFrame(sequencerLoop);
            }
        }

        // --- PANIC / AUDIO CLEANUP ---
        function stopAllAudio() {
            // Cancel all scheduled future timeouts
            scheduledTimeouts.forEach(clearTimeout);
            scheduledTimeouts = [];

            // Brute force stop and delete all playing Web Audio nodes across the entire session
            activeVoicesSet.forEach(voice => {
                if (voice && typeof voice.stop === 'function') {
                    voice.stop();
                }
            });
            activeVoicesSet.clear();

            for (let k in activeNotes) delete activeNotes[k];
            for (let k in activeMidiNotes) delete activeMidiNotes[k];

            document.querySelectorAll('.key').forEach(el => {
                el.classList.remove('active', 'midi-active');
            });
        }

        function resetPlayback() {
            stopAllAudio();
            currentPlaybackTime = 0;
            pausedAtTime = 0;
            nextEventIndex = 0;
            nextPitchBendIndex = 0;
            pitchBendsByTrack = Object.fromEntries(
                Object.keys(tracksConfig).map(trackId => [trackId, 0])
            );
            document.getElementById('time-display').innerText = '0:00';
            document.getElementById('seek-bar').value = 0;
            drawPianoRoll(0);
        }

        function startPlayback() {
            if (!midiData) return;
            initAudio();
            if (isPlaying) return;
            
            isPlaying = true;
            playbackStartTime = audioCtx.currentTime;
            
            while (nextEventIndex < playbackEvents.length && playbackEvents[nextEventIndex].time < currentPlaybackTime) {
                nextEventIndex++;
            }
            pitchBendsByTrack = Object.fromEntries(
                Object.keys(tracksConfig).map(trackId => [trackId, 0])
            );
            nextPitchBendIndex = 0;
            while (nextPitchBendIndex < pitchBendEvents.length &&
                pitchBendEvents[nextPitchBendIndex].time < currentPlaybackTime) {
                const bend = pitchBendEvents[nextPitchBendIndex++];
                pitchBendsByTrack[bend.trackId] = bend.value;
            }
            sequencerLoop();
        }

        function pausePlayback() {
            if (!isPlaying) return;
            isPlaying = false;
            cancelAnimationFrame(animationFrameId);
            pausedAtTime = currentPlaybackTime;
            stopAllAudio();
        }

        function stopPlayback() {
            isPlaying = false;
            cancelAnimationFrame(animationFrameId);
            resetPlayback();
        }

        document.getElementById('btn-play').addEventListener('click', startPlayback);
        document.getElementById('btn-pause').addEventListener('click', pausePlayback);
        document.getElementById('btn-stop').addEventListener('click', stopPlayback);

        document.getElementById('seek-bar').addEventListener('input', (e) => {
            const wasPlaying = isPlaying;
            if (wasPlaying) pausePlayback();
            
            const seekTime = parseFloat(e.target.value);
            currentPlaybackTime = seekTime;
            pausedAtTime = seekTime;
            document.getElementById('time-display').innerText = formatTime(seekTime);
            
            nextEventIndex = 0;
            while (nextEventIndex < playbackEvents.length && playbackEvents[nextEventIndex].time < currentPlaybackTime) {
                nextEventIndex++;
            }
            nextPitchBendIndex = 0;
            while (nextPitchBendIndex < pitchBendEvents.length &&
                pitchBendEvents[nextPitchBendIndex].time < currentPlaybackTime) {
                nextPitchBendIndex++;
            }
            
            stopAllAudio(); // Clear hanging notes on scrub
            drawPianoRoll(currentPlaybackTime);
            if (wasPlaying) startPlayback();
        });
