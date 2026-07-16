const ctxHolder = {
  ctx: null,
  masterGain: null
};

function ensureAudio() {
  if (ctxHolder.ctx) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioContext();
  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.08; // softer overall
  masterGain.connect(ctx.destination);
  ctxHolder.ctx = ctx;
  ctxHolder.masterGain = masterGain;
}

function playBeep({ freq = 440, duration = 0.06, type = 'square', volume = 0.5 } = {}) {
  ensureAudio();
  const ctx = ctxHolder.ctx;
  const g = ctx.createGain();
  g.gain.value = volume;
  g.connect(ctxHolder.masterGain);

  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;

  const now = ctx.currentTime;
  // simple linear envelope
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(volume, now + 0.005);
  g.gain.linearRampToValueAtTime(0, now + duration);

  o.connect(g);
  o.start(now);
  o.stop(now + duration + 0.02);
}

export function initSounds() {
  // lazy audio context creation; try to create but no heavy layering
  try {
    ensureAudio();
  } catch (e) {
    // ignore; will create on first user gesture
  }
}

export function playEat() {
  // simple single short beep (square wave)
  playBeep({ freq: 880, duration: 0.06, type: 'square', volume: 0.6 });
}

export function playGameOver() {
  // single lower beep for game over (square wave)
  playBeep({ freq: 240, duration: 0.18, type: 'square', volume: 0.7 });
}

export function playMove() {
  // very short subtle click (square wave)
  playBeep({ freq: 1200, duration: 0.03, type: 'square', volume: 0.35 });
}
