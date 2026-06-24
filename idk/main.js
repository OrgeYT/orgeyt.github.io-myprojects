import Game from "./game.js";

const canvas = document.getElementById("game");
const hudLevel = document.getElementById("level");
const hudStatus = document.getElementById("status");
canvas.width = innerWidth;
canvas.height = innerHeight;

// Simple WebAudio synth for effects
const AudioCtx = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioCtx();
let masterGain = audioCtx.createGain();
masterGain.gain.value = 0.14;
masterGain.connect(audioCtx.destination);

// small helper to play a short tone
function playTone(freq, time = 0.06, type = "sawtooth", release = 0.06){
  const now = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = 0.0001;
  o.connect(g);
  g.connect(masterGain);
  o.start(now);
  g.gain.exponentialRampToValueAtTime(0.9, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + time + release);
  o.stop(now + time + release + 0.02);
}

// percussive noise burst for crashes
function playCrash(duration = 0.18, vol = 0.18){
  const now = audioCtx.currentTime;
  const b = audioCtx.createBufferSource();
  const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * duration, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for(let i=0;i<data.length;i++){
    // white-ish noise with decay and randomness
    data[i] = (Math.random()*2-1) * Math.exp(-3 * i/data.length);
  }
  b.buffer = buf;
  const g = audioCtx.createGain();
  g.gain.value = vol;
  b.connect(g);
  g.connect(masterGain);
  b.start(now);
  b.stop(now + duration);
}

// keep a subtle ambient rumble (low oscillator) to increase chaos intensity, controllable by game
const ambient = audioCtx.createOscillator();
const ambientGain = audioCtx.createGain();
ambient.frequency.value = 40;
ambient.type = "sine";
ambientGain.gain.value = 0.02;
ambient.connect(ambientGain);
ambientGain.connect(masterGain);
ambient.start();

// cursed background music: slow evolving detuned trio + sub + occasional noise burps
const music = {
  oscA: audioCtx.createOscillator(),
  oscB: audioCtx.createOscillator(),
  oscC: audioCtx.createOscillator(),
  gain: audioCtx.createGain(),
  lfo: audioCtx.createOscillator(),
  lfoGain: audioCtx.createGain(),
  noiseGain: audioCtx.createGain()
};
// simple mixer
music.gain.gain.value = 0.06;
music.gain.connect(masterGain);

// detuned saw trio
music.oscA.type = "sawtooth";
music.oscB.type = "sawtooth";
music.oscC.type = "sine";
music.oscA.frequency.value = 40;
music.oscB.frequency.value = 40 * 1.003;
music.oscC.frequency.value = 80;
music.oscA.connect(music.gain);
music.oscB.connect(music.gain);
music.oscC.connect(music.gain);

// subtle LFO for slow filter-like amplitude wobble
music.lfo.type = "sine";
music.lfo.frequency.value = 0.08;
music.lfoGain.gain.value = 0.015;
music.lfo.connect(music.lfoGain);
music.lfoGain.connect(music.gain.gain);

// occasional noise burps for cursed texture
music.noiseGain.gain.value = 0;
music.noiseGain.connect(masterGain);
// create a short noise buffer and a scheduler for bursts
const noiseBuf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.5, audioCtx.sampleRate);
const nb = noiseBuf.getChannelData(0);
for(let i=0;i<nb.length;i++) nb[i] = (Math.random()*2-1) * Math.exp(-3 * i/nb.length);

// start oscillators
music.oscA.start();
music.oscB.start();
music.oscC.start();
music.lfo.start();

// schedule looping noise burps with slight randomness
function cursedNoiseBurst(time, dur=0.18, vol=0.04){
  const src = audioCtx.createBufferSource();
  src.buffer = noiseBuf;
  const g = audioCtx.createGain();
  g.gain.value = vol;
  src.connect(g);
  g.connect(music.noiseGain);
  src.start(time);
  src.stop(time + dur);
}
(function scheduleBurps(){
  const now = audioCtx.currentTime;
  const offset = 0.9 + Math.random()*1.6;
  cursedNoiseBurst(now + offset, 0.12 + Math.random()*0.24, 0.018 + Math.random()*0.06);
  setTimeout(scheduleBurps, 1100 + Math.random()*2400);
})();

// create the game and hook sounds to its events
const game = new Game(canvas, {
  onLevel(level, total){
    // show game name "idk" in HUD
    hudLevel.textContent = `idk — Level ${level} / ${total}`;
    hudStatus.textContent = "";
    // small ascending jingle on level-up
    playTone(420 + (level%12)*6, 0.06, "sawtooth");
    playTone(540 + (level%8)*8, 0.09, "square", 0.06);
    // tiny burst/flash by nudging ambient and music slightly
    ambientGain.gain.cancelScheduledValues(audioCtx.currentTime);
    ambientGain.gain.setValueAtTime(0.04, audioCtx.currentTime);
    ambientGain.gain.exponentialRampToValueAtTime(0.02, audioCtx.currentTime + 0.6);
    // nudge cursed music trio detune briefly for a "celebratory" wobble
    music.oscB.frequency.cancelScheduledValues(audioCtx.currentTime);
    music.oscB.frequency.setValueAtTime(music.oscB.frequency.value * 1.012, audioCtx.currentTime);
    music.oscB.frequency.exponentialRampToValueAtTime(40 * 1.003, audioCtx.currentTime + 0.6);
  },
  onStatus(text, danger=false){
    // if a dangerous reset occurs, replace the status with a random curse word for flavor
    const curses = ["damn", "hell", "crap", "bloody", "shit", "sh*t", "f*ck", "fuck", "goddamn", "asshole"];
    if(danger && text.toLowerCase().includes("reset")){
      const curse = curses[Math.floor(Math.random() * curses.length)];
      hudStatus.textContent = curse;
      hudStatus.style.color = "#ff6b6b";
      // harsher crash plus a nasty low-tone stab
      playCrash(0.32, 0.32);
      playTone(120, 0.22, "sine", 0.08);
      // quick detuned stab on the cursed music for bite
      const t = audioCtx.currentTime;
      music.oscA.frequency.cancelScheduledValues(t);
      music.oscA.frequency.setValueAtTime(40 * (0.95 + Math.random()*0.06), t);
      music.oscA.frequency.exponentialRampToValueAtTime(40, t + 0.4);
      return;
    }
    hudStatus.textContent = text;
    hudStatus.style.color = danger ? "#ff6b6b" : "#ffb86b";
  },
  // optional hook: let Game call this when a chaotic event occurs (particle burst)
  onChaosBurst: (x,y,intensity=1)=>{
    // light click + small noise tuned to intensity
    playTone(220 * Math.min(6,1+intensity), 0.08, "triangle");
    playCrash(0.12 + intensity*0.06, 0.06 + intensity*0.06);
    // small cursed noise burst synced to chaos intensity
    cursedNoiseBurst(audioCtx.currentTime + 0.02, 0.06 + intensity*0.04, 0.01 + intensity*0.02);
  }
});

game.start();

// Resize handling (one-screen, keep stretch)
addEventListener("resize", ()=>{
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  game.resize();
});

// resume audio on first interaction if suspended
const resumeAudio = ()=>{
  if(audioCtx.state === "suspended") audioCtx.resume();
  removeEventListener("pointerdown", resumeAudio);
  removeEventListener("touchstart", resumeAudio);
};
addEventListener("pointerdown", resumeAudio, {passive:true});
addEventListener("touchstart", resumeAudio, {passive:true});

// Desktop controls: WASD/arrow keys
addEventListener("keydown", (e)=>{
  if(e.repeat) return;
  if(e.key === "ArrowLeft" || e.key === "a") game.input.left = true;
  if(e.key === "ArrowRight" || e.key === "d") game.input.right = true;
  if(e.key === "ArrowUp" || e.key === "w" || e.key === " ") game.input.jump = true;
});
addEventListener("keyup", (e)=>{
  if(e.key === "ArrowLeft" || e.key === "a") game.input.left = false;
  if(e.key === "ArrowRight" || e.key === "d") game.input.right = false;
  if(e.key === "ArrowUp" || e.key === "w" || e.key === " ") game.input.jump = false;
});

// Touch button bindings
const leftBtn = document.getElementById("left");
const rightBtn = document.getElementById("right");
const jumpBtn = document.getElementById("jump");

const bindButton = (btn, key) => {
  btn.addEventListener("touchstart", (e)=>{ e.preventDefault(); game.input[key]=true; });
  btn.addEventListener("touchend", (e)=>{ e.preventDefault(); game.input[key]=false; });
  btn.addEventListener("mousedown", (e)=>{ e.preventDefault(); game.input[key]=true; });
  btn.addEventListener("mouseup", (e)=>{ e.preventDefault(); game.input[key]=false; });
  btn.addEventListener("mouseleave", (e)=>{ e.preventDefault(); game.input[key]=false; });
};
bindButton(leftBtn, "left");
bindButton(rightBtn, "right");
bindButton(jumpBtn, "jump");