/* Game core: manages state, input handling, HUD, playfield rendering */
export let NOTE_SPACING = 100;
export let RECEPTOR_OFFSET = 60;

let gameState = 'playing'; // playing, settings, result
export let settings = {};
export let chart = [];
export let currentRow = 0;
export let currentRequiredLanes = [];
export let currentLives = 0;
export let combo = 0;
export let startTime = 0;
let botInterval = null;
let botHasStarted = false;

// per-lane timestamp history for KPS calculation
const keyPressHistory = [[], [], [], []];

import { audioFiles as ASSETS_AUDIO } from './assets.js';

/* Sound system using Web Audio API to avoid initial playback delay */
const audioFiles = ASSETS_AUDIO;
let audioCtx = null;
let audioBuffers = {}; // name -> AudioBuffer
let masterGain = null;

async function ensureAudioContext() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.9;
  masterGain.connect(audioCtx.destination);
  // start decoding all files (no user gesture required to fetch/decode)
  const entries = Object.entries(audioFiles);
  await Promise.all(entries.map(async ([name, url])=>{
    try {
      const res = await fetch(url);
      const ab = await res.arrayBuffer();
      const buf = await audioCtx.decodeAudioData(ab.slice(0));
      audioBuffers[name] = buf;
    } catch (e) {
      // fallback: leave undefined; code will gracefully fallback to HTMLAudio if needed
      audioBuffers[name] = null;
    }
  }));
}

function playSound(name) {
  // Prefer WebAudio buffer playback for low-latency start
  try {
    if (audioCtx && audioBuffers[name]) {
      const src = audioCtx.createBufferSource();
      src.buffer = audioBuffers[name];
      src.connect(masterGain);
      src.start(0);
      return;
    }
  } catch(e) {
    // continue to fallback below
  }
  // Fallback: quick HTMLAudio instance (avoid reusing same Audio element)
  try {
    const a = new Audio(audioFiles[name]);
    a.volume = 0.9;
    a.preload = 'auto';
    a.play().catch(()=>{ /* ignore */ });
  } catch(e) {}
}

const els = {
  track: document.getElementById('track'),
  receptors: document.getElementById('receptors'),
  lives: document.getElementById('hud-lives'),
  progress: document.getElementById('hud-progress'),
  combo: document.getElementById('hud-combo'),
  botInd: document.getElementById('bot-indicator'),
  screens: {
    settings: document.getElementById('settings-screen'),
    game: document.getElementById('game-screen'),
    result: document.getElementById('result-screen')
  }
};

import { generateChart } from './chart.js';
import { startBot as botStart, stopBot as botStop } from './bot.js';
import { getColorFromKey, formatKeyDisplay } from './ui.js';

export function switchScreen(screenName) {
  Object.values(els.screens).forEach(s => s.classList.remove('active'));
  els.screens[screenName].classList.add('active');
  gameState = screenName === 'game' ? 'playing' : screenName;
}

export function initGame() {
  // prepare audio decoding asap
  ensureAudioContext().catch(()=>{ /* ignore */ });

  // wire key handling & auto-start
  document.addEventListener('keydown', async (e) => {
    if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) {
      if (gameState === 'playing') e.preventDefault();
    }

    // Resume audio context on first user interaction to satisfy browsers that require a gesture
    if (audioCtx && audioCtx.state === 'suspended') {
      try { await audioCtx.resume(); } catch(e) {}
    }
  
    if (gameState !== 'playing') return;
  
    if (settings.bot) {
      if (!botHasStarted && !e.repeat) {
        botHasStarted = true;
        els.botInd.innerText = 'BOT MODE';
        els.botInd.style.fontSize = '3rem';
        botStart(() => processHit);
      }
      return;
    }
  
    if (e.repeat) return;
    let key = e.key.toUpperCase();
    let laneIndex = settings.keys.indexOf(key);
    if (laneIndex !== -1) {
      // visually mark the box instantly and keep it until keyup
      const box = document.getElementById(`side-box-${laneIndex}`);
      if (box) box.classList.add('pressed');
      processHit(laneIndex);
    }
  });

  // remove 'pressed' class on keyup so the box stays lit while key is held
  document.addEventListener('keyup', (e) => {
    if (gameState !== 'playing') return;
    let key = e.key.toUpperCase();
    let laneIndex = settings.keys.indexOf(key);
    if (laneIndex !== -1) {
      const box = document.getElementById(`side-box-${laneIndex}`);
      if (box) box.classList.remove('pressed');
    }
  });

  // auto-start on load
  window.addEventListener('load', ()=> startGame());
}

export function startGame(presetSettings) {
  // read settings from DOM if no preset passed
  settings = presetSettings || {
    keys: [
      document.getElementById('kb-0').dataset.key || 'D',
      document.getElementById('kb-1').dataset.key || 'F',
      document.getElementById('kb-2').dataset.key || 'J',
      document.getElementById('kb-3').dataset.key || 'K'
    ],
    scroll: document.getElementById('setting-scroll').value,
    length: parseInt(document.getElementById('setting-length').value) || 50,
    lives: parseInt(document.getElementById('setting-lives').value) || 10,
    botNPS: parseInt(document.getElementById('setting-botNPS').value) || 10,
    doubles: document.getElementById('setting-doubles').checked,
    multis: document.getElementById('setting-multis').checked,
    jacks: document.getElementById('setting-jacks').checked,
    wave: document.getElementById('setting-wave') ? document.getElementById('setting-wave').checked : false,
    bot: document.getElementById('setting-bot').checked,
    noteSkin: document.getElementById('setting-noteSkin') ? document.getElementById('setting-noteSkin').value : 'squares',
    noteColor: document.getElementById('setting-noteColor') ? document.getElementById('setting-noteColor').value : 'default'
  };

  currentLives = settings.lives;
  currentRow = 0;
  combo = 0;
  botHasStarted = false;
  if (botInterval) clearInterval(botInterval);

  chart = generateChart(settings);
  // mark exact start time for accurate NPS calculation
  startTime = performance.now();
  currentRequiredLanes = [...chart[0]];
  setupPlayfield();
  updateHUD();

  gameState = 'playing';

  if (settings.bot) {
    els.botInd.style.display = 'block';
    els.botInd.style.fontSize = '2rem';
    els.botInd.innerText = 'BOT MODE\n(PRESS ANY KEY TO START)';
    els.botInd.style.textAlign = 'center';
  } else {
    els.botInd.style.display = 'none';
  }
}

export function processHit(laneIndex) {
  // record press timestamp for KPS (include both hits and misses)
  try { keyPressHistory[laneIndex].push(performance.now()); } catch(e){}
  updateKPSDisplay(laneIndex);

  let reqIndex = currentRequiredLanes.indexOf(laneIndex);
  if (reqIndex !== -1) {
    // correct press
    try { playSound('click'); } catch(e){}
    currentRequiredLanes.splice(reqIndex,1);
    flashReceptor(laneIndex,'hit');
    clearNoteVisual(currentRow,laneIndex);
    flashSideBox(laneIndex);

    if (currentRequiredLanes.length === 0) {
      combo++;
      currentRow++;
      updateTrackPosition();
      updateHUD();
      if (currentRow >= settings.length) endGame(true);
      else currentRequiredLanes = [...chart[currentRow]];
    }
  } else {
    // wrong press
    try { playSound('error'); } catch(e){}
    flashReceptor(laneIndex,'miss');
    flashSideBox(laneIndex);
    currentLives--;
    combo = 0;
    updateHUD();
    if (currentLives <= 0) endGame(false);
  }
}

/* side-panel feedback: mark the side box as pressed (stay lit until keyup removes it) */
function flashSideBox(laneIndex) {
  const box = document.getElementById(`side-box-${laneIndex}`);
  if (!box) return;
  box.classList.add('pressed');
  // Do not auto-remove here; removal happens on keyup so the box stays lit while the key is held
}

/* compute and update KPS (keys per second) for a lane */
function updateKPSDisplay(laneIndex) {
  const now = performance.now();
  const arr = keyPressHistory[laneIndex] || [];
  // drop timestamps older than 1 second
  while (arr.length && (now - arr[0]) > 1000) arr.shift();
  const kps = arr.length;
  const el = document.getElementById(`side-kps-${laneIndex}`);
  if (el) el.innerText = kps.toFixed(2);
}

function flashReceptor(laneIndex,type) {
  let rec = document.getElementById(`receptor-${laneIndex}`);
  if (!rec) return;
  rec.classList.remove('hit','miss');
  void rec.offsetWidth;
  rec.classList.add(type);
  setTimeout(()=>rec.classList.remove(type),100);
}

function clearNoteVisual(rowIdx,laneIndex) {
  let note = document.getElementById(`note-${rowIdx}-${laneIndex}`);
  if (note) {
    // remove the note element immediately so it vanishes on-hit
    note.remove();
  }
}

export function endGame(victory) {
  botStop();

  // Play end sounds based on outcome and remaining lives
  if (!victory) {
    try { playSound('fail'); } catch(e){}
  } else {
    // victory: choose specific reward sound
    if (currentLives >= 10) {
      try { playSound('ultimate'); } catch(e){}
    } else if (currentLives < 3) {
      try { playSound('inaccuracy'); } catch(e){}
    } else if (currentLives < 9) {
      try { playSound('bell'); } catch(e){}
    } else {
      // fallback
      try { playSound('bell'); } catch(e){}
    }
  }

  document.getElementById('result-title').innerText = victory ? 'Track Cleared!' : 'Game Over';
  document.getElementById('result-title').style.color = victory ? 'var(--success)' : 'var(--error)';
  document.getElementById('result-status').innerText = victory ? 'Success' : 'Failed';
  document.getElementById('result-combo').innerText = combo;
  document.getElementById('result-lives').innerText = currentLives;

  // compute and display NPS and star rating
  const elapsedSec = Math.max(0.001, (performance.now() - (startTime || performance.now())) / 1000);
  const nps = (settings.length / elapsedSec);
  const npsDisplay = nps.toFixed(2);
  const npsEl = document.getElementById('result-nps');
  if (npsEl) npsEl.innerText = npsDisplay;

  // stars: 3 stars if full 10+ lives, 2 stars if >=3 lives, 1 star if >0 lives, 0 if zero lives
  let stars = 0;
  if (currentLives >= 10) stars = 3;
  else if (currentLives >= 3) stars = 2;
  else if (currentLives > 0) stars = 1;
  const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  const starEl = document.getElementById('result-stars');
  if (starEl) starEl.innerText = starStr;

  setTimeout(()=>switchScreen('result'),300);
}

function setupPlayfield() {
  els.track.innerHTML = '';
  els.receptors.innerHTML = '';
  const isDown = settings.scroll === 'down';
  const skin = settings.noteSkin || 'squares';

  // initialize side panel labels and KPS
  const sidePanel = document.getElementById('side-panel');
  if (sidePanel) {
    for (let i=0;i<4;i++){
      const keyLabel = formatKeyDisplay(settings.keys[i] || '');
      const box = document.getElementById(`side-box-${i}`);
      const kpsEl = document.getElementById(`side-kps-${i}`);
      if (box) box.querySelector('.side-box-key').textContent = keyLabel;
      if (kpsEl) kpsEl.textContent = '0.00';
      // clear history for KPS
      keyPressHistory[i] = [];
    }
  }

  // create receptors with skin class so skin affects receptor shape
  for (let i=0;i<4;i++){
    let rec = document.createElement('div');
    rec.className = 'receptor';
    rec.classList.add(`skin-${skin}`);
    rec.style.left = `${i*25}%`;
    if (isDown) rec.style.bottom = `${RECEPTOR_OFFSET}px`; else rec.style.top = `${RECEPTOR_OFFSET}px`;
    rec.id = `receptor-${i}`;
    rec.innerText = formatKeyDisplay(settings.keys[i]);
    els.receptors.appendChild(rec);
  }

  // create notes: position them relative inside the track so track translate animates them smoothly
  chart.forEach((lanes,rowIdx) => {
    lanes.forEach(lane => {
      let note = document.createElement('div');
      note.className = 'note';
      note.classList.add(`skin-${skin}`);
      note.classList.add(`palette-${settings.noteColor || 'default'}`);
      note.style.left = `${lane*25}%`;
      // place notes at a consistent position inside track; track's translate will move them
      // we use translateY based on row index to avoid updating many DOM properties later
      const pos = RECEPTOR_OFFSET + rowIdx * NOTE_SPACING;
      if (isDown) {
        note.style.bottom = `${pos}px`;
      } else {
        note.style.top = `${pos}px`;
      }
      note.id = `note-${rowIdx}-${lane}`;

      let inner = document.createElement('div');
      inner.className = 'note-inner';

      // put the keybind label on the note itself (black text for contrast by default)
      inner.textContent = formatKeyDisplay(settings.keys[lane]);
      inner.style.pointerEvents = 'none';

      // Determine color based on selected palette
      let color = getColorFromKey(settings.keys[lane]); // default dynamic color
      if (settings.noteColor === 'fnf') {
        const fnf = ['hsl(275,80%,65%)','hsl(185,80%,55%)','hsl(145,70%,45%)','hsl(5,80%,55%)'];
        color = fnf[lane % fnf.length];
      } else if (settings.noteColor === 'osu') {
        const osu = ['#ffffff','#ffffff','#ff66b2','#ffffff'];
        color = osu[lane % osu.length];
      }

      // Apply background and foreground appropriately per skin
        // apply palette/background to the note inner; show key label on the note
      inner.style.backgroundColor = color;
      // prefer dark foreground for contrast unless explicit light palette rules are needed
      if (settings.noteColor === 'osu') inner.style.color = '#000000';
      else inner.style.color = '#000000';

      note.appendChild(inner);
      els.track.appendChild(note);
    });
  });

  updateTrackPosition();
}

function updateTrackPosition() {
  const isDown = settings.scroll === 'down';
  let offset = currentRow * NOTE_SPACING;
  if (isDown) els.track.style.transform = `translateY(${offset}px)`;
  else els.track.style.transform = `translateY(${-offset}px)`;
}

function updateHUD() {
  els.lives.innerText = currentLives;
  els.progress.innerText = `${currentRow} / ${settings.length}`;
  els.combo.innerText = combo;
}