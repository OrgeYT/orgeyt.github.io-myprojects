/** WebAudio click / hold / release sounds */

import { SOUND_PATHS } from './config.js';

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const AUDIO_VOLUME = 0.5;

const buffers = {
  keyboardClick: null,
  keyboardLetGo: null,
  classicMouseClick: null,
  classicMouseLetGo: null,
  softMouseClick: null,
  softMouseLetGo: null,
  pop: null,
  loudHit: null,
  clap: null,
  tap: null,
  hold: null,
  letGo: null,
};

let activeClickSource = null;
let audioResumeRequested = false;
let audioUnlocked = false;

async function loadAudioBuffer(url) {
  try {
    const res = await fetch(url);
    const arrayBuffer = await res.arrayBuffer();
    return await new Promise((resolve, reject) => {
      audioCtx.decodeAudioData(arrayBuffer.slice(0), (buf) => resolve(buf), () => {
        audioCtx.decodeAudioData(arrayBuffer).then(resolve).catch(reject);
      });
    });
  } catch (e) {
    console.warn('Failed to load audio', url, e);
    return null;
  }
}

// Preload all sound profiles
loadAudioBuffer(SOUND_PATHS.keyboardClick).then((b) => { buffers.keyboardClick = b; });
loadAudioBuffer(SOUND_PATHS.keyboardLetGo).then((b) => { buffers.keyboardLetGo = b; });
loadAudioBuffer(SOUND_PATHS.classicMouseClick).then((b) => { buffers.classicMouseClick = b; });
loadAudioBuffer(SOUND_PATHS.classicMouseLetGo).then((b) => { buffers.classicMouseLetGo = b; });
loadAudioBuffer(SOUND_PATHS.softMouseClick).then((b) => { buffers.softMouseClick = b; });
loadAudioBuffer(SOUND_PATHS.softMouseLetGo).then((b) => { buffers.softMouseLetGo = b; });
loadAudioBuffer(SOUND_PATHS.pop).then((b) => { buffers.pop = b; });
loadAudioBuffer(SOUND_PATHS.loudHit).then((b) => { buffers.loudHit = b; });
loadAudioBuffer(SOUND_PATHS.clap).then((b) => { buffers.clap = b; });
loadAudioBuffer(SOUND_PATHS.tap).then((b) => { buffers.tap = b; });
loadAudioBuffer(SOUND_PATHS.hold).then((b) => { buffers.hold = b; });
loadAudioBuffer(SOUND_PATHS.letGo).then((b) => { buffers.letGo = b; });

export function tryResumeAudioContext() {
  if (audioUnlocked) return;
  if (!audioCtx) return;
  if (audioCtx.state === 'running') {
    audioUnlocked = true;
    return;
  }
  audioCtx.resume().then(() => {
    try {
      const silentBuf = audioCtx.createBuffer(1, 1, audioCtx.sampleRate);
      const src = audioCtx.createBufferSource();
      src.buffer = silentBuf;
      const g = audioCtx.createGain();
      g.gain.value = 0;
      src.connect(g);
      g.connect(audioCtx.destination);
      src.start(0);
    } catch (_) {
      /* ignore */
    }
    audioUnlocked = true;
  }).catch(() => {});
}

// Unlock on first gesture
window.addEventListener('pointerdown', tryResumeAudioContext, { once: true, capture: true });
window.addEventListener('keydown', tryResumeAudioContext, { once: true, capture: true });

export function stopClickSound() {
  if (activeClickSource) {
    try {
      activeClickSource.stop(audioCtx.currentTime);
    } catch (_) {
      /* ignore */
    }
    activeClickSource = null;
  }
}

function playBuffer(buffer, volume = 1.0, when = audioCtx.currentTime) {
  if (!buffer) return;
  try {
    if (audioCtx.state === 'suspended' && !audioResumeRequested) {
      audioResumeRequested = true;
      audioCtx.resume()
        .then(() => { audioResumeRequested = false; })
        .catch(() => { audioResumeRequested = false; });
    }
    if (activeClickSource) {
      try {
        activeClickSource.stop(when);
      } catch (_) {
        /* ignore */
      }
    }
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)) * AUDIO_VOLUME, when);
    src.connect(gain);
    gain.connect(audioCtx.destination);
    src.onended = () => {
      if (activeClickSource === src) activeClickSource = null;
    };
    src.start(when);
    activeClickSource = src;
  } catch (_) {
    // Audio is best-effort
  }
}

/**
 * Play the configured click profile.
 * @param {boolean} holding - true = press / hold start, false = release / let go
 */
export function playClickSound(holding) {
  const modeSel = document.getElementById('sound-select')?.value || 'classic-mouse';

  switch (modeSel) {
    case 'keyboard':
      playBuffer(holding ? buffers.keyboardClick : buffers.keyboardLetGo);
      break;
    case 'classic-mouse':
      playBuffer(holding ? buffers.classicMouseClick : buffers.classicMouseLetGo);
      break;
    case 'soft-mouse':
      playBuffer(holding ? buffers.softMouseClick : buffers.softMouseLetGo);
      break;
    case 'pop':
      // one-shot on press only
      if (holding) playBuffer(buffers.pop);
      break;
    case 'loud-hit':
      if (holding) playBuffer(buffers.loudHit);
      break;
    case 'clap':
      if (holding) playBuffer(buffers.clap);
      break;
    case 'tap':
      if (holding) playBuffer(buffers.tap);
      break;
    case 'hold-let-go':
      playBuffer(holding ? buffers.hold : buffers.letGo);
      break;
    default:
      playBuffer(holding ? buffers.classicMouseClick : buffers.classicMouseLetGo);
  }
}
