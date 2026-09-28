        // --- PIANO ROLL DRAWING ---
        const canvas = document.getElementById('piano-roll');
        const ctx = canvas.getContext('2d');
        const audioWaveCanvas = document.getElementById('audio-wave');
        const audioWaveCtx = audioWaveCanvas.getContext('2d');

        function resizeAudioWaveCanvas() {
            const pixelRatio = window.devicePixelRatio || 1;
            const width = Math.round(audioWaveCanvas.clientWidth * pixelRatio);
            const height = Math.round(audioWaveCanvas.clientHeight * pixelRatio);
            if (audioWaveCanvas.width !== width || audioWaveCanvas.height !== height) {
                audioWaveCanvas.width = width;
                audioWaveCanvas.height = height;
            }
            audioWaveCtx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        }

        function drawAudioWaveform() {
            resizeAudioWaveCanvas();
            const width = audioWaveCanvas.clientWidth;
            const height = audioWaveCanvas.clientHeight;
            audioWaveCtx.clearRect(0, 0, width, height);
            audioWaveCtx.fillStyle = '#080b0b';
            audioWaveCtx.fillRect(0, 0, width, height);

            const centerY = height / 2;
            audioWaveCtx.strokeStyle = '#183131';
            audioWaveCtx.lineWidth = 1;
            audioWaveCtx.beginPath();
            audioWaveCtx.moveTo(0, centerY);
            audioWaveCtx.lineTo(width, centerY);
            audioWaveCtx.stroke();

            if (waveformAnalyser) {
                waveformAnalyser.getByteTimeDomainData(waveformSamples);
                audioWaveCtx.strokeStyle = '#00ffff';
                audioWaveCtx.shadowColor = '#00ffff';
                audioWaveCtx.shadowBlur = 7;
                audioWaveCtx.lineWidth = 2;
                audioWaveCtx.beginPath();
                for (let i = 0; i < waveformSamples.length; i++) {
                    const x = (i / (waveformSamples.length - 1)) * width;
                    const y = (waveformSamples[i] / 255) * height;
                    if (i === 0) audioWaveCtx.moveTo(x, y);
                    else audioWaveCtx.lineTo(x, y);
                }
                audioWaveCtx.stroke();
                audioWaveCtx.shadowBlur = 0;
                waveformAnimationFrameId = requestAnimationFrame(drawAudioWaveform);
            }
        }

        function resizeCanvas() {
            if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
                canvas.width = canvas.clientWidth;
                canvas.height = canvas.clientHeight;
                drawPianoRollBackground(); 
            }
        }
        window.addEventListener('resize', resizeCanvas);
        window.addEventListener('resize', () => {
            resizeAudioWaveCanvas();
            if (!waveformAnalyser) drawAudioWaveform();
        });

        function drawPianoRollBackground() {
            ctx.fillStyle = '#0a0a0a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for(let i=1; i<8; i++) {
                const y = canvas.height - (i * 12 * (canvas.height/88));
                ctx.moveTo(0, y); ctx.lineTo(canvas.width, y);
            }
            ctx.stroke();
        }

        function drawPianoRoll(currentTime) {
            resizeCanvas(); 
            if (!playbackEvents || playbackEvents.length === 0) return;

            ctx.fillStyle = '#0a0a0a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for(let i=1; i<8; i++) {
                const y = canvas.height - (i * 12 * (canvas.height/88));
                ctx.moveTo(0, y); ctx.lineTo(canvas.width, y);
            }
            ctx.stroke();

            const timeWindow = 4;
            const pixelsPerSecond = canvas.width / timeWindow;
            const pixelsPerKey = canvas.height / 88;
            const xOffset = 0.1 * canvas.width; 

            ctx.strokeStyle = '#0ff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(xOffset, 0); ctx.lineTo(xOffset, canvas.height);
            ctx.stroke();

            const viewStart = currentTime - (xOffset / pixelsPerSecond);
            const viewEnd = viewStart + timeWindow;

            let startIndex = 0;
            const maxDurationAssumed = 10;
            const searchTime = viewStart - maxDurationAssumed;
            
            let low = 0, high = playbackEvents.length - 1;
            while(low <= high) {
                let mid = Math.floor((low + high) / 2);
                if (playbackEvents[mid].time < searchTime) {
                    low = mid + 1;
                } else {
                    startIndex = mid;
                    high = mid - 1;
                }
            }

            for (let i = startIndex; i < playbackEvents.length; i++) {
                const ev = playbackEvents[i];
                if (ev.time + ev.duration < viewStart) continue; 
                if (ev.time > viewEnd) break; 

                const trackConfig = tracksConfig[ev.trackId];
                if (trackConfig && trackConfig.muted) continue;

                const x = xOffset + ((ev.time - currentTime) * pixelsPerSecond);
                const width = trackConfig.isDrumTrack ? (0.1 * pixelsPerSecond) : (ev.duration * pixelsPerSecond);
                const y = canvas.height - ((ev.midi - 21) * pixelsPerKey) - pixelsPerKey;

                if (trackConfig.isDrumTrack) {
                    ctx.fillStyle = '#ff3333';
                } else {
                    const hue = (ev.trackId * 40) % 360;
                    ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
                }
                
                ctx.fillRect(x, y, Math.max(width, 2), pixelsPerKey);
            }
        }

