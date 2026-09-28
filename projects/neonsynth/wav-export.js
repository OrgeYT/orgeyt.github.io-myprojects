        function createExportPeriodicWave(context, dutyCycle) {
            const terms = 64;
            const real = new Float32Array(terms);
            const imag = new Float32Array(terms);
            for (let i = 1; i < terms; i++) {
                real[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * dutyCycle);
            }
            return context.createPeriodicWave(real, imag);
        }

        function createExportNoiseBuffer(context) {
            const length = context.sampleRate;
            const buffer = context.createBuffer(1, length, context.sampleRate);
            const samples = buffer.getChannelData(0);
            for (let i = 0; i < length; i++) samples[i] = Math.random() * 2 - 1;
            return buffer;
        }

        function scheduleExportRelease(voice, context, releaseAt) {
            const releaseTime = voice.releaseTime || 0.1;
            try {
                voice.noteGain.gain.cancelScheduledValues(releaseAt);
                voice.noteGain.gain.setTargetAtTime(0, releaseAt, releaseTime / 5);
                voice.osc1.stop(releaseAt + releaseTime + 0.3);
                if (voice.osc2) voice.osc2.stop(releaseAt + releaseTime + 0.3);
                (voice.layerVoices || []).forEach(layer => {
                    scheduleExportRelease(layer, context, releaseAt);
                });
            } catch (error) {
                console.warn('Could not schedule a MIDI note release.', error);
            }
        }

        let exportInProgress = false;
        let exportCancellationRequested = false;

        function createExportCancelledError() {
            const error = new Error('Export cancelled');
            error.name = 'ExportCancelledError';
            return error;
        }

        async function encodeWav(audioBuffer, onProgress, shouldCancel) {
            const channelCount = audioBuffer.numberOfChannels;
            const frameCount = audioBuffer.length;
            const bytesPerSample = 2;
            const dataSize = frameCount * channelCount * bytesPerSample;
            const wavBuffer = new ArrayBuffer(44 + dataSize);
            const view = new DataView(wavBuffer);
            const writeText = (offset, text) => {
                for (let i = 0; i < text.length; i++) {
                    view.setUint8(offset + i, text.charCodeAt(i));
                }
            };

            writeText(0, 'RIFF');
            view.setUint32(4, 36 + dataSize, true);
            writeText(8, 'WAVE');
            writeText(12, 'fmt ');
            view.setUint32(16, 16, true);
            view.setUint16(20, 1, true);
            view.setUint16(22, channelCount, true);
            view.setUint32(24, audioBuffer.sampleRate, true);
            view.setUint32(28, audioBuffer.sampleRate * channelCount * bytesPerSample, true);
            view.setUint16(32, channelCount * bytesPerSample, true);
            view.setUint16(34, 16, true);
            writeText(36, 'data');
            view.setUint32(40, dataSize, true);

            const pcmSamples = new Int16Array(wavBuffer, 44);
            const channels = Array.from(
                { length: channelCount },
                (_, channel) => audioBuffer.getChannelData(channel)
            );
            const chunkSize = Math.max(1, Math.ceil(frameCount / 16));
            for (let chunkStart = 0; chunkStart < frameCount; chunkStart += chunkSize) {
                if (shouldCancel()) throw createExportCancelledError();
                const chunkEnd = Math.min(frameCount, chunkStart + chunkSize);
                for (let frame = chunkStart; frame < chunkEnd; frame++) {
                    const outputIndex = frame * channelCount;
                    for (let channel = 0; channel < channelCount; channel++) {
                        const sample = Math.max(-1, Math.min(1, channels[channel][frame]));
                        pcmSamples[outputIndex + channel] = sample < 0
                            ? sample * 0x8000
                            : sample * 0x7fff;
                    }
                }
                onProgress(90 + Math.floor((chunkEnd / frameCount) * 9));
                await new Promise(resolve => setTimeout(resolve, 0));
            }

            return new Blob([wavBuffer], { type: 'audio/wav' });
        }

        function setExportProgress(percent) {
            const button = document.getElementById('btn-export-wav');
            button.textContent = `Render ${percent}%`;
        }

        async function exportMidiWav() {
            if (!midiData) return;
            if (!window.confirm('Are you sure you want to export this midi as a wav file?')) return;

            const button = document.getElementById('btn-export-wav');
            const cancelButton = document.getElementById('btn-cancel-export');
            const originalLabel = button.textContent;
            exportInProgress = true;
            exportCancellationRequested = false;
            button.disabled = true;
            cancelButton.hidden = false;
            setExportProgress(0);

            try {
                const sampleRate = 44100;
                const lastEventEnd = playbackEvents.reduce(
                    (latest, event) => Math.max(latest, event.time + event.duration),
                    0
                );
                const renderDuration = Math.max(duration, lastEventEnd) + 2.5;
                const OfflineContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
                if (!OfflineContext) throw new Error('Offline audio rendering is not supported here.');

                const context = new OfflineContext(
                    2,
                    Math.ceil(renderDuration * sampleRate),
                    sampleRate
                );

                const master = context.createGain();
                master.gain.value = synthState.volume;
                const exportCompressor = context.createDynamicsCompressor();
                exportCompressor.threshold.setValueAtTime(-18, 0);
                exportCompressor.knee.setValueAtTime(6, 0);
                exportCompressor.ratio.setValueAtTime(12, 0);
                exportCompressor.attack.setValueAtTime(0.002, 0);
                exportCompressor.release.setValueAtTime(0.1, 0);

                const exportLimiter = context.createDynamicsCompressor();
                exportLimiter.threshold.setValueAtTime(-1, 0);
                exportLimiter.knee.setValueAtTime(0, 0);
                exportLimiter.ratio.setValueAtTime(20, 0);
                exportLimiter.attack.setValueAtTime(0.0005, 0);
                exportLimiter.release.setValueAtTime(0.05, 0);
                exportCompressor.connect(exportLimiter);
                exportLimiter.connect(context.destination);
                createEffectsGraph(context, master, exportCompressor, synthState.effects);

                const pulse14 = createExportPeriodicWave(context, 0.25);
                const pulse18 = createExportPeriodicWave(context, 0.125);
                const exportNoise = createExportNoiseBuffer(context);
                const drumKits = ['drums', 'normal', 'rock', 'vibe', '8bit', 'techno', 'synthwave'];

                const exportEvents = [
                    ...playbackEvents.map(event => ({ ...event, eventType: 'note' })),
                    ...pitchBendEvents.map(event => ({ ...event, eventType: 'pitchBend' }))
                ].sort((a, b) => a.time - b.time || (
                    a.eventType === b.eventType ? 0 : a.eventType === 'pitchBend' ? -1 : 1
                ));
                const bendState = {};
                const voicesByTrack = {};
                Object.keys(tracksConfig).forEach(trackId => {
                    bendState[trackId] = 0;
                    voicesByTrack[trackId] = [];
                });

                exportEvents.forEach((event) => {
                    const config = tracksConfig[event.trackId];
                    if (!config || config.muted) return;

                    if (event.eventType === 'pitchBend') {
                        bendState[event.trackId] = event.value;
                        const bendTime = event.time;
                        voicesByTrack[event.trackId].forEach(({ voice, endTime }) => {
                            if (bendTime < endTime && voice.setPitchBend) {
                                voice.setPitchBend(event.value, bendTime);
                            }
                        });
                        return;
                    }

                    let instrument = config.instrument;
                    if (instrument === 'auto') instrument = config.autoInstrument;

                    if (drumKits.includes(instrument)) {
                        const kit = instrument === 'drums' ? 'normal' : instrument;
                        playDrum(event.midi, kit, event.velocity, master, {
                            context,
                            noiseBuffer: exportNoise,
                            startTime: event.time,
                            trackActive: false
                        });
                        return;
                    }

                    const frequency = 440 * Math.pow(2, (event.midi - 69) / 12);
                    const voice = createVoice(frequency, instrument, event.velocity, {
                        context,
                        destination: master,
                        startTime: event.time,
                        pulseWave14: pulse14,
                        pulseWave18: pulse18,
                        layerIntervals: getLayerIntervalsForMidi(event.midi),
                        ...getMidiEnvelopeOptions(config),
                        trackActive: false
                    });
                    if (voice.setPitchBend) voice.setPitchBend(bendState[event.trackId], event.time);
                    scheduleExportRelease(
                        voice,
                        context,
                        event.time + Math.max(0, event.duration)
                    );
                    voicesByTrack[event.trackId].push({
                        voice,
                        endTime: event.time + Math.max(0, event.duration)
                    });
                });

                const checkpointCount = Math.min(120, Math.max(20, Math.ceil(renderDuration * 2)));
                const checkpoints = Array.from({ length: checkpointCount }, (_, index) => {
                    const time = renderDuration * ((index + 1) / (checkpointCount + 1));
                    return context.suspend(time);
                });
                const rendering = context.startRendering();
                for (let index = 0; index < checkpoints.length; index++) {
                    await checkpoints[index];
                    if (exportCancellationRequested) {
                        // OfflineAudioContext has no stop method. Resume it so
                        // the pending render can settle, then discard its result.
                        rendering.catch(() => {});
                        context.resume().catch(() => {});
                        throw createExportCancelledError();
                    }
                    setExportProgress(Math.floor(((index + 1) / checkpointCount) * 85));
                    await context.resume();
                }
                const rendered = await rendering;
                if (exportCancellationRequested) throw createExportCancelledError();
                setExportProgress(90);
                const wav = await encodeWav(
                    rendered,
                    setExportProgress,
                    () => exportCancellationRequested
                );
                if (exportCancellationRequested) throw createExportCancelledError();
                const objectUrl = URL.createObjectURL(wav);
                const link = document.createElement('a');
                link.href = objectUrl;
                link.download = `${midiFileName || 'midi'}-neon-synth.wav`.toLowerCase();
                document.body.appendChild(link);
                setExportProgress(100);
                link.click();
                link.remove();
                setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
            } catch (error) {
                if (error.name !== 'ExportCancelledError') {
                    console.error('Wav export failed.', error);
                    alert(`Could not export wav: ${error.message}`);
                }
            } finally {
                exportInProgress = false;
                exportCancellationRequested = false;
                button.disabled = false;
                button.textContent = originalLabel;
                cancelButton.hidden = true;
                cancelButton.textContent = 'Cancel export';
            }
        }

        document.getElementById('btn-export-wav').addEventListener('click', exportMidiWav);
        document.getElementById('btn-cancel-export').addEventListener('click', () => {
            if (!exportInProgress || exportCancellationRequested) return;
            if (!window.confirm('Are you sure you want to cancel this export?')) return;
            exportCancellationRequested = true;
            document.getElementById('btn-cancel-export').textContent = 'Canceling…';
        });
