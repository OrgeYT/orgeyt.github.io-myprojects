import { audioBufferToWav } from './midi-utils.js';

// params: {
//   audioContext,
//   events,
//   totalDuration,
//   playbackSpeed,
//   trackVolumeMap,
//   getInstrumentBufferAndRateForInstrument,
//   onScheduleProgress(progress 0-1),
//   onRenderProgress(progress 0-1)
// }
export async function renderMidiToWavBlob(params) {
  const {
    audioContext,
    events,
    totalDuration,
    playbackSpeed,
    trackVolumeMap,
    getInstrumentBufferAndRateForInstrument,
    onScheduleProgress,
    onRenderProgress,
    cattoPluckEnabled = true,
    cattoPluckLoudness = 2.5, // use provided pluck loudness (was previously hardcoded)
    cattoFadeToZero = false, // new option: fade Catto samples to near-zero before note-off for MIDI export
    cattoFadeBeforeNoteOffMs = 10 // how many ms before note-off to start fading
  } = params;

  if (!audioContext) {
    throw new Error("No AudioContext provided for export.");
  }
  if (!events || !Array.isArray(events) || events.length === 0) {
    throw new Error("No MIDI events provided for export.");
  }

  let renderProgressInterval = null;

  // Helper wrappers so we never falsely show 100% before the real end
  const reportScheduleProgress = (p) => {
    if (typeof onScheduleProgress === 'function') {
      // Clamp scheduling progress so it never reaches 1.0 during scheduling
      const clamped = Math.max(0, Math.min(0.9, p || 0));
      onScheduleProgress(clamped);
    }
  };

  const reportRenderProgress = (p) => {
    if (typeof onRenderProgress === 'function') {
      // During approximate render timing, don't go to 1.0; that happens only after render completes
      const clamped = Math.max(0, Math.min(0.95, p || 0));
      onRenderProgress(clamped);
    }
  };

  try {
    const sampleRate = audioContext.sampleRate || 44100;
    // Length is based on slowed/fast playback duration plus a tiny tail
    const length = Math.round((totalDuration / playbackSpeed + 2) * sampleRate);

    const offlineCtx = new OfflineAudioContext({
      numberOfChannels: 2,
      sampleRate,
      length
    });

    const offlineScheduledSources = new Map(); // key: `${trackIndex}:${instrumentId}:${note}`
    // Track active sources per track for pitch bending in offline render
    // Map<trackIndex, Set<{source, baseRate}>>
    const offlineActiveTrackSources = new Map();
    const offlineTrackPitchBends = new Map(); // trackIndex -> currentSemtiones
    const offlineTrackGains = new Map();      // trackIndex -> GainNode

    const totalEvents = events.length;
    const USE_CHUNKED_SCHEDULING = totalEvents > 50000;
    const BATCH_SIZE = 5000;

    // Precompute first corresponding note-off times for each note+track+instrument so we can schedule fades
    const firstOffTimeMap = new Map();
    events.forEach(ev => {
      if (ev.type === 'off') {
        const key = `${ev.trackIndex}:${ev.instrument}:${ev.note}`;
        if (!firstOffTimeMap.has(key)) firstOffTimeMap.set(key, ev.time);
      }
    });

    const scheduleEventIntoOffline = (event) => {
      const { time, note, type, playbackRate, instrument, trackIndex, value } = event;
      const adjustedTime = time / playbackSpeed;
      const instId = instrument;
      const tIndex = typeof trackIndex === 'number' ? trackIndex : 0;
      const sourceKey = `${tIndex}:${instId}:${note}`;

      // Ensure per-track gain for offline render
      if (!offlineTrackGains.has(tIndex)) {
        const gainNode = offlineCtx.createGain();
        const vol = (trackVolumeMap && trackVolumeMap[tIndex] != null
          ? trackVolumeMap[tIndex]
          : 100) / 100;
        gainNode.gain.value = vol;
        gainNode.connect(offlineCtx.destination);
        offlineTrackGains.set(tIndex, gainNode);
      }
      const trackGainNode = offlineTrackGains.get(tIndex);

      if (type === 'pitchBend') {
        const bendSemitones = value;
        offlineTrackPitchBends.set(tIndex, bendSemitones);
        
        if (offlineActiveTrackSources.has(tIndex)) {
            const bendFactor = Math.pow(2, bendSemitones / 12);
            const sources = offlineActiveTrackSources.get(tIndex);
            sources.forEach(item => {
                try {
                    item.source.playbackRate.setValueAtTime(item.baseRate * bendFactor, adjustedTime);
                } catch(e) {}
            });
        }
      } else if (type === 'on') {
        const { buffer, playbackRate: baseRateRaw, offsetSeconds } =
          getInstrumentBufferAndRateForInstrument(note, instId, playbackRate || 1);
        
        if (buffer) {
          const source = offlineCtx.createBufferSource();
          source.buffer = buffer;
          
          const currentBend = offlineTrackPitchBends.get(tIndex) || 0;
          const bendFactor = Math.pow(2, currentBend / 12);
          source.playbackRate.value = baseRateRaw * bendFactor;
          
          // Add per-note gain for pluck effect if instrument is Catto/Bigboi and pluck is enabled
          if ((instId === 'catto' || instId === 'bigboi') && cattoPluckEnabled) {
            const noteGain = offlineCtx.createGain();
            // Pluck effect: Start loud and decay using configured loudness
            noteGain.gain.setValueAtTime(cattoPluckLoudness, adjustedTime);
            noteGain.gain.exponentialRampToValueAtTime(1.0, adjustedTime + 0.1);
            source.connect(noteGain);
            noteGain.connect(trackGainNode);
          } else {
            source.connect(trackGainNode);
          }

          try {
            source.start(adjustedTime, offsetSeconds || 0);
          } catch {
            source.start(adjustedTime);
          }
          offlineScheduledSources.set(sourceKey, source);
          
          // Track for bending
          if (!offlineActiveTrackSources.has(tIndex)) {
              offlineActiveTrackSources.set(tIndex, new Set());
          }
          const sourceItem = { source, baseRate: baseRateRaw };
          offlineActiveTrackSources.get(tIndex).add(sourceItem);
        }
      } else if (type === 'off') {
        if (offlineScheduledSources.has(sourceKey)) {
          try {
            const source = offlineScheduledSources.get(sourceKey);
            source.stop(adjustedTime);
            
            // Remove from active bend tracking
            if (offlineActiveTrackSources.has(tIndex)) {
                const set = offlineActiveTrackSources.get(tIndex);
                for (const item of set) {
                    if (item.source === source) {
                        set.delete(item);
                        break;
                    }
                }
            }
          } catch {
            // ignore
          }
          offlineScheduledSources.delete(sourceKey);
        }
      }
    };

    if (USE_CHUNKED_SCHEDULING) {
      reportScheduleProgress(0);
      for (let i = 0; i < totalEvents; i += BATCH_SIZE) {
        const end = Math.min(totalEvents, i + BATCH_SIZE);
        for (let j = i; j < end; j++) {
          scheduleEventIntoOffline(events[j]);
        }
        const rawProgress = end / totalEvents;
        // Keep below 1.0 until after rendering is complete
        reportScheduleProgress(rawProgress);
        // Yield to UI so progress bars can update
        // eslint-disable-next-line no-await-in-loop
        await new Promise(r => setTimeout(r, 0));
      }
    } else {
      events.forEach(scheduleEventIntoOffline);
      // Scheduling complete; but still keep <1 until render finishes
      reportScheduleProgress(0.9);
    }

    // Start "rendering" progress: approximate based on elapsed wall time vs song length
    if (typeof onRenderProgress === 'function') {
      const renderStartTime = performance.now();
      const expectedRenderDurationMs = Math.max(1, (totalDuration / playbackSpeed) * 1000);
      renderProgressInterval = setInterval(() => {
        const elapsedMs = performance.now() - renderStartTime;
        const approx = Math.min(1, elapsedMs / expectedRenderDurationMs);
        reportRenderProgress(approx);
      }, 100);
    }

    // Do the offline render (this is where the heavy lifting happens)
    const renderedBuffer = await offlineCtx.startRendering();

    // Only now is rendering truly finished: mark both bars as 100%
    if (typeof onRenderProgress === 'function') {
      onRenderProgress(1);
    }
    if (typeof onScheduleProgress === 'function') {
      onScheduleProgress(1);
    }

    return audioBufferToWav(renderedBuffer);
  } finally {
    if (renderProgressInterval !== null) {
      clearInterval(renderProgressInterval);
      renderProgressInterval = null;
    }
  }
}