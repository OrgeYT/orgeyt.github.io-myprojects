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
                    alert("Could not parse MIDI file.");
                }
            };
            reader.readAsArrayBuffer(file);
        });

        function guessInstrumentType(programNumber, trackName = '') {
            const t = trackName.toLowerCase();
            if (t.includes('noise') || t.includes('drum') || t.includes('perc') || t.includes('boom') || t.includes('crash')) return 'drums';
            if (programNumber >= 0 && programNumber <= 7) return 'synth_piano';
            if (programNumber >= 8 && programNumber <= 15) return 'marimba';
            if (programNumber >= 16 && programNumber <= 23) return 'square';
            if (programNumber >= 24 && programNumber <= 31) return 'pulse14';
            if (programNumber >= 32 && programNumber <= 39) return 'nes_triangle';
            if (programNumber >= 40 && programNumber <= 55) return 'strings';
            if (programNumber >= 56 && programNumber <= 79) return 'woodwind';
            if (programNumber >= 80 && programNumber <= 87) return 'sqsaw';
            if (programNumber >= 88 && programNumber <= 95) return 'fat_saw';
            return 'square'; 
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
            tracksConfig = {};
            duration = midiData.duration;
            
            document.getElementById('seek-bar').max = duration;
            document.getElementById('duration-display').innerText = formatTime(duration);

            const trackListEl = document.getElementById('track-list');
            trackListEl.innerHTML = '';

            midiData.tracks.forEach((track, index) => {
                if (track.notes.length === 0) return;
                
                const tName = (track.name || '').toLowerCase();
                const isDrumTrack = detectDrumTrack(track);
                const guessedInst = isDrumTrack ? 'drums' : guessInstrumentType(track.instrument.number, tName);
                
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

                const trackRow = document.createElement('div');
                trackRow.className = "track-row bg-gray-900 p-2 rounded border border-gray-700";
                
                const instOptions = `
                    <option value="auto">AUTO (${guessedInst.substring(0,5).toUpperCase()})</option>
                    <optgroup label="Synths">
                        ${synthOptionsHTML}
                    </optgroup>
                    <optgroup label="Drum Kits">
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
                    <button class="text-[8px] px-2 py-1 bg-gray-800 mute-btn" data-track="${index}">MUTE</button>
                `;
                trackListEl.appendChild(trackRow);
            });

            playbackEvents.sort((a, b) => a.time - b.time);
            
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
            const voice = createVoice(freq, inst, event.velocity);
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
                    const delay = (event.time - currentPlaybackTime) * 1000;
                    if (delay <= 0) {
                        playMidiNoteEvent(event);
                    } else {
                        const tid = setTimeout(() => playMidiNoteEvent(event), delay);
                        scheduledTimeouts.push(tid);
                    }
                    nextEventIndex++;
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
            
            stopAllAudio(); // Clear hanging notes on scrub
            drawPianoRoll(currentPlaybackTime);
            if (wasPlaying) startPlayback();
        });
