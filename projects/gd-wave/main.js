/**
 * Geometry Dash Wave Bot — entry point
 * Wires UI, input, physics tick, and animation loop.
 */

import {
  TILE_SIZE,
  GAME_HEIGHT,
  SPEED,
  FIXED_TICK_RATE,
  PHYSICS_HZ,
  AUTOMATED_BOT_MODES,
  PREMADE_LEVEL_PATH,
} from './config.js';
import { S, canvas, ctx, els } from './state.js';
import { playClickSound, stopClickSound, tryResumeAudioContext } from './audio.js';
import { checkCollisions } from './collisions.js';
import {
  runBotSolver,
  runLeastClicksSolver,
  planClickMaxActions,
  triggerRewind,
  setUpdateFrameCounter,
} from './bots.js';
import { draw } from './render.js';

// ---------------------------------------------------------------------------
// Click / CPS UI
// ---------------------------------------------------------------------------
function updateClickCounter() {
  if (!els.clickCounter) return;
  els.clickCounter.textContent = `Clicks: ${S.clicksCount}`;
  updateCPS();
}

function updateCPS() {
  if (!els.cpsCounter) return;
  const now = performance.now();
  while (S.clickTimestamps.length && now - S.clickTimestamps[0] > 1000) {
    S.clickTimestamps.shift();
  }
  const cps = S.clickTimestamps.length;
  if (cps > S.maxCPS) S.maxCPS = cps;
  els.cpsCounter.textContent = `CPS: ${cps.toFixed(2)}`;
  if (els.maxCpsCounter) {
    els.maxCpsCounter.textContent = `Max CPS: ${S.maxCPS.toFixed(2)}`;
  }
}

function resetClickStats() {
  S.clicksCount = 0;
  S.clickTimestamps = [];
  S.maxCPS = 0;
  updateClickCounter();
}

// ---------------------------------------------------------------------------
// Canvas / player helpers
// ---------------------------------------------------------------------------
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  S.GAME_Y = Math.floor((canvas.height - GAME_HEIGHT) / 2);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

if (els.waveSizeInput && els.waveSizeValue) {
  els.waveSizeValue.textContent = els.waveSizeInput.value;
  els.waveSizeInput.addEventListener('input', () => {
    els.waveSizeValue.textContent = els.waveSizeInput.value;
    if (S.mode === 'edit') {
      S.player.size = parseFloat(els.waveSizeInput.value) || S.player.size;
    }
  });
}

function showError(msg) {
  if (!els.errorToast) return;
  els.errorToast.textContent = msg;
  els.errorToast.style.display = 'block';
  clearTimeout(showError._t);
  showError._t = setTimeout(() => {
    els.errorToast.style.display = 'none';
  }, 2200);
}

function normalizeTasFile(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.actions)) return data.actions;
  throw new Error('Invalid TAS format');
}

function resetPlayer() {
  const size = parseFloat(els.waveSizeInput ? els.waveSizeInput.value : S.player.size) || S.player.size;
  S.player.size = size;
  S.player.x = 100;
  S.player.y = GAME_HEIGHT / 2;
  S.player.isHolding = false;
  S.clickBotPlan = [];
  S.tasInputBuffer = false;
  S.player.dead = false;
  S.cameraX = 0;
  S.cameraFocusX = S.player.x + S.player.size / 2;
  S.cameraFocusY = S.player.y + S.player.size / 2;
  S.trail = [];
  S.frameCount = 0;
  updateFrameCounter();
}

function updateFrameCounter() {
  if (S.tasRecording || S.tasPlayback) {
    els.frameCounter.style.display = 'block';
    els.frameCounter.textContent = `Frame: ${S.frameCount}`;
  } else {
    els.frameCounter.style.display = 'none';
  }
  updateClickCounter();
}

// Let bots module call the same counter updater
setUpdateFrameCounter(updateFrameCounter);

// ---------------------------------------------------------------------------
// Mode switching
// ---------------------------------------------------------------------------
function setMode(newMode) {
  S.leastClickSearchId++;
  stopClickSound();
  if (newMode === 'play' || AUTOMATED_BOT_MODES.has(newMode)) resetClickStats();
  S.mode = newMode;
  S.tasRecording = S.mode === 'tas-record';
  S.tasPlayback = S.mode === 'tas-playback';

  els.btnEdit.className = 'mode-btn ' + (S.mode === 'edit' ? 'active-mode' : '');
  els.btnPlay.className = 'mode-btn ' + (S.mode === 'play' ? 'active-mode' : '');
  els.btnPlayBot.className = 'play-bot-button ' + (AUTOMATED_BOT_MODES.has(S.mode) ? 'active-mode' : '');
  els.btnTasRecord.className = 'mode-btn ' + (S.mode === 'tas-record' ? 'active-mode' : '');

  els.botStatus.style.display = 'none';
  updateFrameCounter();

  if (S.mode !== 'edit') {
    resetPlayer();
    S.player.active = true;
    if (S.mode === 'bot') {
      runBotSolver();
    } else if (S.mode === 'dodge-bot') {
      els.botStatus.style.display = 'block';
      els.botStatus.textContent = 'Dodge Bot: Scanning ahead';
      els.botStatus.style.borderLeftColor = '#66ffcc';
    } else if (S.mode === 'click-bot') {
      els.botStatus.style.display = 'block';
      els.botStatus.textContent = 'Click-Max Bot: Safe route';
      els.botStatus.style.borderLeftColor = '#d1a5ff';
    } else if (S.mode === 'least-click-bot') {
      S.player.active = false;
      els.botStatus.style.display = 'block';
      els.botStatus.textContent = 'Least-click Bot: Searching for a minimum-click route';
      els.botStatus.style.borderLeftColor = '#76e4ee';
      void runLeastClicksSolver();
    } else if (S.mode === 'tas-record') {
      S.recordedActions = [];
    }
  } else {
    S.player.active = false;
  }
}

// ---------------------------------------------------------------------------
// UI button wiring
// ---------------------------------------------------------------------------
els.btnEdit.onclick = () => setMode('edit');
els.btnPlay.onclick = () => setMode('play');
els.btnCamera.onclick = () => {
  S.cameraFocus = !S.cameraFocus;
  S.cameraFocusX = S.player.x + S.player.size / 2;
  S.cameraFocusY = S.player.y + S.player.size / 2;
  els.btnCamera.className = 'mode-btn mode-wide ' + (S.cameraFocus ? 'active-mode' : '');
  els.btnCamera.setAttribute('aria-pressed', String(S.cameraFocus));
};
els.btnPlayBot.onclick = () => setMode(els.botSelect.value);
els.btnTasRecord.onclick = () => setMode('tas-record');

els.btnTasStep.onclick = () => {
  if (S.mode === 'tas-record' && !S.player.dead) tick();
};

els.btnTasPlay.onclick = () => {
  if (S.recordedActions.length === 0) {
    showError('No TAS recording found!');
    return;
  }
  S.playbackActions = [...S.recordedActions];
  const data = JSON.stringify({ tickRate: PHYSICS_HZ, actions: S.playbackActions });
  const blob = new Blob([data], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'wave_tas.json';
  a.click();
  setMode('tas-playback');
};

els.btnTasLoad.onclick = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        const loadedActions = normalizeTasFile(parsed);
        const extend = confirm(
          'Load TAS: OK = Extend (record after end), Cancel = Play immediately'
        );
        if (extend) {
          S.playbackActions = loadedActions;
          S.extendAfterPlayback = true;
          setMode('tas-playback');
          els.botStatus.style.display = 'block';
          els.botStatus.textContent =
            'TAS: Playing loaded actions (will enter record after playback)';
          els.botStatus.style.borderLeftColor = '#ffcc00';
        } else {
          S.playbackActions = loadedActions;
          S.extendAfterPlayback = false;
          setMode('tas-playback');
        }
      } catch (_) {
        showError('Invalid TAS file!');
      }
    };
    reader.onerror = () => showError('Failed to read file');
    reader.readAsText(file);
  };
  input.click();
};

els.toggleBtn.onclick = () => {
  els.uiPanel.classList.toggle('hidden');
  els.toggleBtn.blur();
};

if (els.showWaveHitboxInput) {
  els.showWaveHitboxInput.onchange = () => {
    S.showWaveHitbox = els.showWaveHitboxInput.checked;
  };
}
if (els.transparentWaveInput) {
  els.transparentWaveInput.onchange = () => {
    S.transparentWave = els.transparentWaveInput.checked;
  };
}

// ---------------------------------------------------------------------------
// Input (play + editor)
// ---------------------------------------------------------------------------
const handleInputDown = (e) => {
  if (
    e.target &&
    e.target.closest &&
    e.target.closest('#ui-container') &&
    getComputedStyle(e.target).pointerEvents !== 'none'
  ) {
    return;
  }

  S.clicksCount++;
  S.clickTimestamps.push(performance.now());
  updateClickCounter();

  if (S.mode === 'edit') {
    S.dragPlacing = true;
    S.lastPlacedKey = null;
    handleEditorClick(e);
  } else if ((S.mode === 'play' || S.mode === 'tas-record') && !S.player.dead) {
    if (!S.player.isHolding) {
      S.player.isHolding = true;
      S.tasInputBuffer = true;
      playClickSound(true);
    }
  }
};

const handleInputUp = () => {
  if (S.dragPlacing) {
    S.dragPlacing = false;
    S.lastPlacedKey = null;
  }
  if ((S.mode === 'play' || S.mode === 'tas-record') && !S.player.dead) {
    if (S.player.isHolding) {
      S.player.isHolding = false;
      playClickSound(false);
    }
  }
};

window.addEventListener('pointerdown', handleInputDown);
window.addEventListener('pointerup', handleInputUp);
window.addEventListener('pointercancel', handleInputUp);
window.addEventListener('blur', handleInputUp);

window.addEventListener('keydown', (e) => {
  if (e.code === 'Tab') {
    e.preventDefault();
    els.uiPanel.classList.toggle('hidden');
  }
  if (e.code === 'Space' && S.mode === 'tas-record') {
    e.preventDefault();
    if (!S.player.dead) tick();
  }
});

function handleEditorClick(e) {
  if (S.mode !== 'edit') return;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left + S.cameraX;
  const my = e.clientY - rect.top - S.GAME_Y;
  const gx = Math.floor(mx / TILE_SIZE);
  const gy = Math.floor(my / TILE_SIZE);
  if (gy < 0 || gy >= Math.floor(GAME_HEIGHT / TILE_SIZE)) return;

  const key = `${gx},${gy}`;
  if (S.dragPlacing && S.lastPlacedKey === key) return;
  S.lastPlacedKey = key;

  const tool = els.toolSelect ? els.toolSelect.value : 'block';
  if (tool === 'erase') {
    S.level = S.level.filter((b) => !(b.x === gx && b.y === gy));
  } else {
    S.level = S.level.filter((b) => !(b.x === gx && b.y === gy));
    S.level.push({ x: gx, y: gy, type: tool });
  }
  buildGrid();
}

function handleEditorWheel(e) {
  if (S.mode !== 'edit') return;
  e.preventDefault();
  S.cameraX += e.deltaY > 0 ? 40 : -40;
  if (S.cameraX < 0) S.cameraX = 0;
}
canvas.addEventListener('wheel', handleEditorWheel, { passive: false });
canvas.addEventListener('pointermove', (e) => {
  if (S.dragPlacing && S.mode === 'edit') handleEditorClick(e);
});

function buildGrid() {
  S.levelGrid = new Map();
  for (const b of S.level) {
    if (b) S.levelGrid.set(`${b.x},${b.y}`, b);
  }
}

function applyActionsToPlayer(actions) {
  const act = Array.isArray(actions) ? actions : [];
  S.recordedActions = Array.from(act);
  S.frameCount = S.recordedActions.length;
  S.player.x = 100 + S.frameCount * SPEED;
  let tempY = GAME_HEIGHT / 2;
  for (let i = 0; i < S.recordedActions.length; i++) {
    tempY += S.recordedActions[i] ? -SPEED : SPEED;
  }
  S.player.y = tempY;
  S.cameraX = S.player.x - 100;
  S.trail = [{ x: S.player.x, y: S.player.y }];
  S.tasInputBuffer = false;
  updateFrameCounter();
}

// ---------------------------------------------------------------------------
// Level save / load
// ---------------------------------------------------------------------------
document.getElementById('btn-save').onclick = () => {
  const data = JSON.stringify(S.level);
  const blob = new Blob([data], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'wave_level.json';
  a.click();
};

document.getElementById('btn-load').onclick = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (!Array.isArray(parsed)) throw new Error('Invalid Level format');
        S.level = parsed;
        buildGrid();
        setMode('edit');
      } catch (_) {
        showError('Invalid Level file!');
      }
    };
    reader.onerror = () => showError('Failed to read file');
    reader.readAsText(file);
  };
  input.click();
};

const btnLoadWave = document.getElementById('btn-load-wave');
if (btnLoadWave) {
  btnLoadWave.onclick = async () => {
    try {
      const res = await fetch(PREMADE_LEVEL_PATH);
      if (!res.ok) throw new Error('Failed to fetch premade level');
      const parsed = await res.json();
      if (!Array.isArray(parsed)) throw new Error('Invalid premade level');
      S.level = parsed;
      buildGrid();
      setMode('edit');
      showError('Loaded premade level');
    } catch (err) {
      showError('Failed to load premade level');
      console.warn(err);
    }
  };
}

// ---------------------------------------------------------------------------
// Physics tick + loop
// ---------------------------------------------------------------------------
function tick() {
  if (!S.player.active || S.player.dead) return;

  let nextHold;
  if (S.mode === 'bot' || S.mode === 'tas-playback' || S.mode === 'least-click-bot') {
    if (S.frameCount < S.playbackActions.length) nextHold = S.playbackActions[S.frameCount];
  } else if (S.mode === 'dodge-bot') {
    const movingUp = S.player.isHolding;
    const lookaheadFrames = Math.ceil((TILE_SIZE * 4) / SPEED);
    const safeFrames = (hold) => {
      let x = S.player.x;
      let y = S.player.y;
      for (let frame = 0; frame < lookaheadFrames; frame++) {
        x += SPEED;
        y += hold ? -SPEED : SPEED;
        if (checkCollisions(x, y, S.player.size, 0)) return frame;
      }
      return lookaheadFrames;
    };
    nextHold = safeFrames(!movingUp) > safeFrames(movingUp) ? !movingUp : movingUp;
  } else if (S.mode === 'click-bot') {
    if (!S.clickBotPlan.length) S.clickBotPlan = planClickMaxActions();
    nextHold = S.clickBotPlan.shift();
  }

  if (nextHold !== undefined && nextHold !== S.player.isHolding) {
    const wasHolding = S.player.isHolding;
    S.player.isHolding = nextHold;
    playClickSound(S.player.isHolding);
    if (!wasHolding && nextHold) {
      S.clicksCount++;
      S.clickTimestamps.push(performance.now());
      updateClickCounter();
    }
  }

  const currentHolding =
    S.mode === 'tas-record' ? S.player.isHolding || S.tasInputBuffer : S.player.isHolding;

  S.player.x += SPEED;
  S.player.y += currentHolding ? -SPEED : SPEED;
  S.cameraX = S.player.x - 100;
  S.frameCount++;
  if (S.tasRecording || S.tasPlayback) updateFrameCounter();

  if (
    S.mode === 'tas-playback' &&
    S.extendAfterPlayback &&
    S.frameCount >= S.playbackActions.length
  ) {
    const carry = S.playbackActions.slice();
    S.extendAfterPlayback = false;
    setMode('tas-record');
    applyActionsToPlayer(carry);
    S.recordedActions = carry.slice();
    S.frameCount = S.recordedActions.length;
    S.tasInputBuffer = false;
    els.botStatus.style.display = 'block';
    els.botStatus.textContent = 'TAS: Extend mode active — recording after end';
    els.botStatus.style.borderLeftColor = '#28a745';
  }

  if (S.mode === 'tas-record') {
    S.recordedActions.push(currentHolding);
    S.tasInputBuffer = false;
  }

  S.trail.push({ x: S.player.x, y: S.player.y });
  if (S.trail.length > 4800) S.trail.shift();

  if (checkCollisions(S.player.x, S.player.y, S.player.size, 0)) {
    S.player.dead = true;
    stopClickSound();
    if (S.mode === 'click-bot') {
      S.player.active = false;
      els.botStatus.textContent = 'Click-Max Bot: Stopped at collision';
    }
    S.clicksCount = 0;
    S.clickTimestamps = [];
    S.maxCPS = 0;
    updateClickCounter();

    if (S.mode === 'tas-record') {
      S.recordedActions.splice(-1);
      setTimeout(triggerRewind, 200);
    } else {
      const deathMode = S.mode;
      setTimeout(() => {
        if (!S.player.dead || S.mode !== deathMode) return;
        resetPlayer();
        if (S.mode === 'bot') runBotSolver();
        else if (S.mode === 'least-click-bot') runLeastClicksSolver();
        else if (S.mode === 'tas-playback') setMode('tas-playback');
      }, 1000);
    }
  }

  if (
    !S.player.dead &&
    S.mode === 'least-click-bot' &&
    S.frameCount >= S.playbackActions.length
  ) {
    S.player.active = false;
    stopClickSound();
    els.botStatus.textContent = `Least-click Bot: Finished with ${S.clicksCount} clicks`;
    els.botStatus.style.borderLeftColor = '#76e4ee';
  }
}

let lastTime = 0;
let accumulator = 0;

function loop(time) {
  if (!lastTime) lastTime = time;
  const dt = time - lastTime;
  lastTime = time;

  updateCPS();

  if (S.player.active && !S.player.dead) {
    const multiplier = parseFloat(els.tasSpeedSelect.value);

    if (S.mode === 'tas-record' && multiplier === 0) {
      accumulator = 0;
    } else {
      const actualMultiplier = S.mode === 'tas-record' ? multiplier : 1.0;
      accumulator += dt * actualMultiplier;

      while (accumulator >= FIXED_TICK_RATE) {
        tick();
        accumulator -= FIXED_TICK_RATE;
        if (S.player.dead) break;
      }
    }
  } else {
    accumulator = 0;
  }

  if (S.cameraFocus && S.mode !== 'edit') {
    const follow = 1 - Math.exp(-Math.max(0, dt) / 120);
    S.cameraFocusX += (S.player.x + S.player.size / 2 - S.cameraFocusX) * follow;
    S.cameraFocusY += (S.player.y + S.player.size / 2 - S.cameraFocusY) * follow;
  }

  draw();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
