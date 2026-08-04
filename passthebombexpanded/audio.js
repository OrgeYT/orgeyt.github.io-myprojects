const sounds = {
  tick: new Audio('countdownbomb.mp3'),
  jump: new Audio('cartoon-jump.mp3'),
  explode: new Audio('medium-explosion.mp3'),
  bgm: new Audio('bgm.mp3'),
  land: new Audio('land.mp3'),
  win: new Audio('victory-chime.mp3')
};
sounds.bgm.loop = true;
sounds.bgm.volume = 0.4;

const audioSettings = {
  sfxMuted: false,
  musicMuted: false
};

export function playSound(name) {
  try {
    if (audioSettings.sfxMuted) return;
    const s = sounds[name].cloneNode();
    s.volume = sounds[name].volume || 1;
    s.play().catch(e => {});
  } catch(e) {}
}

export function toggleSfx() {
  audioSettings.sfxMuted = !audioSettings.sfxMuted;
  return audioSettings.sfxMuted;
}

export function toggleMusic() {
  audioSettings.musicMuted = !audioSettings.musicMuted;
  sounds.bgm.muted = audioSettings.musicMuted;
  return audioSettings.musicMuted;
}

export function isSfxMuted() { return audioSettings.sfxMuted; }
export function isMusicMuted() { return audioSettings.musicMuted; }

export { sounds };
