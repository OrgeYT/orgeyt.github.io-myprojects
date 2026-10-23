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
  STEEP_SIZE_MULT,
  STEEP_VY_FACTOR,
  STEEP_ANGLE_RAD,
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

/** Horizontal speed (world units / tick) */
function speedX() {
  return SPEED;
}

/** Vertical speed magnitude (world units / tick) */
function speedY() {
  return S.steepMode ? SPEED * STEEP_VY_FACTOR : SPEED;
}

/** Effective wave size for the current mode */
function effectiveWaveSize(base) {
  const b = base ?? (parseFloat(els.waveSizeInput ? els.waveSizeInput.value : S.player.size) || S.player.size);
  return S.steepMode ? b * STEEP_SIZE_MULT : b;
}

function getSpawnY(size) {
  const sz = size ?? S.player.size ?? 12;
  if (S.spawnY != null && Number.isFinite(S.spawnY)) {
    // Clamp so the wave stays inside the arena
    return Math.max(2, Math.min(GAME_HEIGHT - sz - 2, S.spawnY));
  }
  return GAME_HEIGHT / 2;
}

function updateSpawnYLabel() {
  if (!els.spawnYValue) return;
  if (S.spawnY == null) {
    els.spawnYValue.textContent = 'default';
  } else {
    els.spawnYValue.textContent = Math.round(S.spawnY) + ' px';
  }
  if (els.spawnYInput && S.spawnY != null) {
    els.spawnYInput.value = String(Math.round(S.spawnY));
  }
}

function resetPlayer() {
  const base = parseFloat(els.waveSizeInput ? els.waveSizeInput.value : S.player.size) || S.player.size;
  const size = effectiveWaveSize(base);
  S.player.size = size;
  S.player.x = 100;
  S.player.y = getSpawnY(size);
  S.player.isHolding = false;
  S.clickBotPlan = [];
  S.tasInputBuffer = false;
  S.player.dead = false;
  S.cameraX = 0;
  S.cameraFocusX = S.player.x + S.player.size / 2;
  S.cameraFocusY = S.player.y + S.player.size / 2;
  S.trail = [];
  // keep S.lastPlayTrail so editor can still show the previous run
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
    // Entering editor: keep the last play path visible
    S.player.active = false;
    if (S.trail.length > 1) {
      S.lastPlayTrail = S.trail.slice();
    }
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

if (els.carvePathInput) {
  els.carvePathInput.onchange = () => {
    S.carvePathMode = els.carvePathInput.checked;
  };
}
updateRotIndicator();

function syncSpawnYUi() {
  updateSpawnYLabel();
}
if (els.btnSetSpawnY) {
  els.btnSetSpawnY.onclick = () => {
    const v = els.spawnYInput ? parseFloat(els.spawnYInput.value) : NaN;
    if (Number.isFinite(v)) {
      S.spawnY = v;
      updateSpawnYLabel();
      if (S.mode === 'edit') {
        S.player.y = getSpawnY();
      }
      showError('Spawn Y set to ' + Math.round(v));
    }
  };
}
if (els.btnClearSpawnY) {
  els.btnClearSpawnY.onclick = () => {
    S.spawnY = null;
    updateSpawnYLabel();
    if (S.mode === 'edit') {
      S.player.y = getSpawnY();
    }
    showError('Spawn Y reset to default');
  };
}
if (els.spawnYInput) {
  els.spawnYInput.addEventListener('input', () => {
    if (els.spawnYValue && S.spawnY != null) {
      els.spawnYValue.textContent = els.spawnYInput.value + ' px';
    } else if (els.spawnYValue) {
      els.spawnYValue.textContent = els.spawnYInput.value + ' px (not applied)';
    }
  });
}
updateSpawnYLabel();
if (els.transparentWaveInput) {
  els.transparentWaveInput.onchange = () => {
    S.transparentWave = els.transparentWaveInput.checked;
  };
}
if (els.steepModeInput) {
  els.steepModeInput.onchange = () => {
    S.steepMode = els.steepModeInput.checked;
    // Refresh size immediately in editor / between runs
    const base = parseFloat(els.waveSizeInput ? els.waveSizeInput.value : 12) || 12;
    S.player.size = effectiveWaveSize(base);
    if (S.mode === 'edit' || !S.player.active) {
      S.player.y = getSpawnY(S.player.size);
    }
    showError(S.steepMode ? 'Steep mode ON (75°, smaller, faster Y)' : 'Steep mode OFF');
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

  // Right-click in editor = temporary eraser
  if (S.mode === 'edit' && e.button === 2) {
    e.preventDefault();
    if (!S.rightClickErasing) {
      S.rightClickErasing = true;
      S.toolBeforeErase = getCurrentTool();
      setTool('erase');
    }
    S.dragPlacing = true;
    S.lastPlacedKey = null;
    handleEditorClick(e);
    return;
  }

  // Only count left-click (or primary) for CPS / play input
  if (e.button === 0 || e.button === undefined) {
    S.clicksCount++;
    S.clickTimestamps.push(performance.now());
    updateClickCounter();
  }

  if (S.mode === 'edit') {
    if (e.button === 0 || e.button === undefined) {
      S.dragPlacing = true;
      S.lastPlacedKey = null;
      handleEditorClick(e);
    }
  } else if ((S.mode === 'play' || S.mode === 'tas-record') && !S.player.dead) {
    if (!S.player.isHolding) {
      S.player.isHolding = true;
      S.tasInputBuffer = true;
      playClickSound(true);
    }
  }
};

const handleInputUp = (e) => {
  if (S.dragPlacing) {
    S.dragPlacing = false;
    S.lastPlacedKey = null;
  }

  // Release right-click → restore previous tool
  if (S.rightClickErasing && (!e || e.button === 2 || e.type === 'pointercancel' || e.type === 'blur')) {
    S.rightClickErasing = false;
    if (S.toolBeforeErase) {
      setTool(S.toolBeforeErase);
      S.toolBeforeErase = null;
    }
  }

  if ((S.mode === 'play' || S.mode === 'tas-record') && !S.player.dead) {
    if (S.player.isHolding) {
      S.player.isHolding = false;
      playClickSound(false);
    }
  }
};

// Prevent context menu so right-click can be used for erasing
canvas.addEventListener('contextmenu', (e) => {
  if (S.mode === 'edit') e.preventDefault();
});

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
  if ((e.key === 'r' || e.key === 'R') && S.mode === 'edit') {
    e.preventDefault();
    cycleRotation();
  }
  if ((e.key === 'q' || e.key === 'Q') && S.mode === 'edit') {
    e.preventDefault();
    cycleTool(-1);
  }
  if ((e.key === 'e' || e.key === 'E') && S.mode === 'edit') {
    e.preventDefault();
    cycleTool(1);
  }
});


function updateRotIndicator() {
  if (els.rotIndicator) {
    els.rotIndicator.textContent = (S.placeRotation * 90) + '°';
  }
}

function cycleRotation() {
  S.placeRotation = (S.placeRotation + 1) % 4;
  updateRotIndicator();
}

const PLACEABLE_TOOLS = [
  'block',
  'more-slightly-shorter-block',
  'slightly-shorter-block',
  'short-block',
  'spike-up',
  'spike-down',
  'small-spike-up',
  'small-spike-down',
  'slightly-small-spike-up',
  'slightly-small-spike-down',
  'little-spike-up',
  'little-spike-down',
  'wedge',
  'slightly-shorter-wedge',
  'short-wedge',
  'erase',
];

function getCurrentTool() {
  return els.toolSelect ? els.toolSelect.value : 'block';
}

function setTool(tool) {
  if (!els.toolSelect) return;
  const opt = Array.from(els.toolSelect.options).find((o) => o.value === tool);
  if (opt) {
    els.toolSelect.value = tool;
  }
}

function cycleTool(dir) {
  const cur = getCurrentTool();
  let idx = PLACEABLE_TOOLS.indexOf(cur);
  if (idx < 0) idx = 0;
  idx = (idx + dir + PLACEABLE_TOOLS.length) % PLACEABLE_TOOLS.length;
  setTool(PLACEABLE_TOOLS[idx]);
}

/** After a play session, carve a hollow tunnel along the recorded trail */
function carveHollowPathFromTrail(trail) {
  if (!trail || trail.length < 4) return;

  const TILE = TILE_SIZE;
  const occupied = new Set();
  // Sample trail points into grid cells the wave passed through
  const pathCells = [];
  let lastKey = null;
  for (const p of trail) {
    const gx = Math.floor((p.x + S.player.size / 2) / TILE);
    const gy = Math.floor((p.y + S.player.size / 2) / TILE);
    const key = gx + ',' + gy;
    if (key !== lastKey) {
      pathCells.push({ x: gx, y: gy });
      lastKey = key;
      occupied.add(key);
    }
  }
  if (pathCells.length < 2) return;

  // Build a hollow corridor: solid blocks / wedges around the path, leave path empty
  const newBlocks = [];
  const dirs = [
    { dx: 0, dy: -1 }, // up
    { dx: 0, dy: 1 },  // down
    { dx: -1, dy: 0 }, // left
    { dx: 1, dy: 0 },  // right
    { dx: -1, dy: -1 },
    { dx: 1, dy: -1 },
    { dx: -1, dy: 1 },
    { dx: 1, dy: 1 },
  ];

  // Determine approximate local direction for wedge orientation
  function localDir(i) {
    const a = pathCells[Math.max(0, i - 1)];
    const b = pathCells[Math.min(pathCells.length - 1, i + 1)];
    return { dx: Math.sign(b.x - a.x), dy: Math.sign(b.y - a.y) };
  }

  for (let i = 0; i < pathCells.length; i++) {
    const c = pathCells[i];
    const dir = localDir(i);

    for (const d of dirs) {
      const nx = c.x + d.dx;
      const ny = c.y + d.dy;
      const nkey = nx + ',' + ny;
      if (occupied.has(nkey)) continue; // don't fill the path itself
      if (ny < 0 || ny >= Math.floor(GAME_HEIGHT / TILE)) continue;

      // Prefer wedges on the "inner" corners relative to movement, else solid blocks
      let type = 'block';
      let rot = 0;
      // Simple heuristic: if neighbour is diagonal, use a wedge oriented toward the path
      if (d.dx !== 0 && d.dy !== 0) {
        type = 'wedge';
        // Map diagonal to a rotation that faces the path cell
        // 0 = default rising to the right, etc.
        if (d.dx > 0 && d.dy > 0) rot = 0;
        else if (d.dx < 0 && d.dy > 0) rot = 1;
        else if (d.dx < 0 && d.dy < 0) rot = 2;
        else rot = 3;
      }

      // Avoid duplicates
      if (newBlocks.some((b) => b.x === nx && b.y === ny)) continue;
      newBlocks.push({ x: nx, y: ny, type, rot });
    }
  }

  // Merge into level (don't overwrite existing path cells; path stays hollow)
  for (const b of newBlocks) {
    const exists = S.level.some((o) => o.x === b.x && o.y === b.y);
    if (!exists) S.level.push(b);
  }
  buildGrid();
  showError(`Carved hollow path (${newBlocks.length} pieces)`);
}

function screenToWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const sx = clientX - rect.left;
  const sy = clientY - rect.top;

  // Must match the transform used in render.js
  const zoom = S.zoom;
  const viewCenterX = S.cameraX + (canvas.width / 2) / zoom;
  const viewCenterY = GAME_HEIGHT / 2 + (S._viewCenterYOffset || 0);

  const worldX = viewCenterX + (sx - canvas.width / 2) / zoom;
  const worldY = viewCenterY + (sy - S.GAME_Y - GAME_HEIGHT / 2) / zoom;
  return { x: worldX, y: worldY };
}

function handleEditorClick(e) {
  if (S.mode !== 'edit') return;
  const { x: mx, y: my } = screenToWorld(e.clientX, e.clientY);
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
    S.level.push({ x: gx, y: gy, type: tool, rot: S.placeRotation });
  }
  buildGrid();
}

function handleEditorWheel(e) {
  if (S.mode !== 'edit') return;
  // Zoom is handled by the Ctrl/Meta/Alt path registered later; plain wheel pans.
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  e.preventDefault();
  // Pan amount scales with zoom so it feels consistent
  const step = 40 / S.zoom;
  S.cameraX += e.deltaY > 0 ? step : -step;
  if (S.cameraX < 0) S.cameraX = 0;
}
canvas.addEventListener('wheel', handleEditorWheel, { passive: false });
canvas.addEventListener('pointermove', (e) => {
  if (S.mode === 'edit') {
    const { x: mx, y: my } = screenToWorld(e.clientX, e.clientY);
    const gx = Math.floor(mx / TILE_SIZE);
    const gy = Math.floor(my / TILE_SIZE);
    if (gy >= 0 && gy < Math.floor(GAME_HEIGHT / TILE_SIZE)) {
      S.previewTile = { x: gx, y: gy };
    } else {
      S.previewTile = null;
    }
    if (S.dragPlacing) handleEditorClick(e);
  } else {
    S.previewTile = null;
  }
});

canvas.addEventListener('pointerleave', () => {
  S.previewTile = null;
});

function buildGrid() {
  S.levelGrid = new Map();
  for (const b of S.level) {
    if (b) S.levelGrid.set(`${b.x},${b.y}`, b);
  }
}

function applyLevelData(parsed) {
  if (Array.isArray(parsed)) {
    S.level = parsed;
    S.spawnY = null;
  } else if (parsed && Array.isArray(parsed.level)) {
    S.level = parsed.level;
    S.spawnY = (parsed.spawnY != null && Number.isFinite(Number(parsed.spawnY)))
      ? Number(parsed.spawnY)
      : null;
  } else if (parsed && Array.isArray(parsed.objects)) {
    S.level = parsed.objects;
    S.spawnY = (parsed.spawnY != null && Number.isFinite(Number(parsed.spawnY)))
      ? Number(parsed.spawnY)
      : null;
  } else {
    throw new Error('Invalid Level format');
  }
  buildGrid();
  updateSpawnYLabel();
}

function applyActionsToPlayer(actions) {
  const act = Array.isArray(actions) ? actions : [];
  S.recordedActions = Array.from(act);
  S.frameCount = S.recordedActions.length;
  const sx = speedX();
  const sy = speedY();
  S.player.x = 100 + S.frameCount * sx;
  let tempY = getSpawnY();
  for (let i = 0; i < S.recordedActions.length; i++) {
    tempY += S.recordedActions[i] ? -sy : sy;
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
  const payload = S.spawnY != null
    ? { spawnY: S.spawnY, level: S.level }
    : S.level;
  const data = JSON.stringify(payload);
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
        applyLevelData(parsed);
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
const premadeSelect = document.getElementById('premade-select');
if (btnLoadWave) {
  btnLoadWave.onclick = async () => {
    try {
      const path = (premadeSelect && premadeSelect.value) || PREMADE_LEVEL_PATH;
      const res = await fetch(path);
      if (!res.ok) throw new Error('Failed to fetch premade level');
      const parsed = await res.json();
      applyLevelData(parsed);
      setMode('edit');
      const label = premadeSelect && premadeSelect.selectedOptions[0]
        ? premadeSelect.selectedOptions[0].textContent
        : 'premade level';
      showError('Loaded ' + label);
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

  // Planned routes must not advance past their last action (extra frame was causing deaths)
  if (
    (S.mode === 'bot' || S.mode === 'least-click-bot' || S.mode === 'tas-playback') &&
    S.playbackActions &&
    S.frameCount >= S.playbackActions.length
  ) {
    if (S.mode === 'least-click-bot') {
      S.player.active = false;
      stopClickSound();
      els.botStatus.style.display = 'block';
      els.botStatus.textContent = `Least-click Bot: Finished with ${S.clicksCount} clicks`;
      els.botStatus.style.borderLeftColor = '#76e4ee';
    }
    return;
  }

  let nextHold;
  if (S.mode === 'bot' || S.mode === 'tas-playback' || S.mode === 'least-click-bot') {
    if (S.frameCount < S.playbackActions.length) nextHold = S.playbackActions[S.frameCount];
  } else if (S.mode === 'dodge-bot') {
    const movingUp = S.player.isHolding;
    const sx = speedX();
    const sy = speedY();
    const lookaheadFrames = Math.ceil((TILE_SIZE * 4) / sx);
    const safeFrames = (hold) => {
      let x = S.player.x;
      let y = S.player.y;
      for (let frame = 0; frame < lookaheadFrames; frame++) {
        x += sx;
        y += hold ? -sy : sy;
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

  const sx = speedX();
  const sy = speedY();
  S.player.x += sx;
  S.player.y += currentHolding ? -sy : sy;
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
    // Save path for editor + optional carve
    if (S.trail.length > 1) {
      S.lastPlayTrail = S.trail.slice();
      if (S.carvePathMode && (S.mode === 'play' || S.mode === 'tas-record')) {
        carveHollowPathFromTrail(S.lastPlayTrail);
      }
    }
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
  } else if (S.mode !== 'edit' && S.player.active && !S.player.dead && S.zoom > 1.15) {
    // When zoomed in enough that the wave can leave the vertical view,
    // shift the view centre Y so the wave stays visible.
    // viewCenterY is normally GAME_HEIGHT/2; we store an offset in S.cameraFocusY
    // only used when focus is off (see render.js).
    const margin = 80 / S.zoom;
    const waveCY = S.player.y + S.player.size / 2;
    // Desired view centre so wave stays in the middle-ish band
    let desiredY = S._viewCenterYOffset != null ? (GAME_HEIGHT / 2 + S._viewCenterYOffset) : GAME_HEIGHT / 2;
    const halfH = (canvas.height / S.zoom) / 2;
    const top = desiredY - halfH;
    const bot = desiredY + halfH;
    if (waveCY < top + margin) {
      desiredY = waveCY - margin + halfH;
    } else if (waveCY > bot - margin) {
      desiredY = waveCY + margin - halfH;
    }
    // Clamp so we don't scroll past the arena
    desiredY = Math.max(halfH, Math.min(GAME_HEIGHT - halfH, desiredY));
    S._viewCenterYOffset = desiredY - GAME_HEIGHT / 2;
  } else if (S.mode === 'edit' || S.zoom <= 1.15) {
    S._viewCenterYOffset = 0;
  }

  // Smooth visual-only tilt animation (does not affect physics / collision)
  {
    const aim = S.steepMode ? STEEP_ANGLE_RAD : Math.PI / 4;
    const targetTilt = S.player.isHolding ? -aim : aim;
    // Linear-ish lerp that feels snappy but not instant
    const tiltSpeed = 18; // higher = faster snap
    const k = 1 - Math.exp(-tiltSpeed * (dt / 1000));
    S.visualTilt += (targetTilt - S.visualTilt) * k;
  }

  // Keep zoom value label in sync
  if (els.zoomValue) {
    els.zoomValue.textContent = S.zoom.toFixed(2) + 'x';
  }

  draw();
  requestAnimationFrame(loop);
}


// ---------------------------------------------------------------------------
// Camera zoom (works in edit + play)
// ---------------------------------------------------------------------------
function setZoom(z) {
  S.zoom = Math.max(S.minZoom, Math.min(S.maxZoom, z));
  if (els.zoomValue) els.zoomValue.textContent = S.zoom.toFixed(2) + 'x';
}

function zoomBy(delta) {
  // Multiplicative steps feel better than additive
  const factor = delta > 0 ? 1.12 : 1 / 1.12;
  setZoom(S.zoom * factor);
}

if (els.zoomInBtn) {
  els.zoomInBtn.onclick = () => zoomBy(1);
}
if (els.zoomOutBtn) {
  els.zoomOutBtn.onclick = () => zoomBy(-1);
}

// Mouse wheel zoom when holding Ctrl (or always in edit with Alt)
canvas.addEventListener('wheel', (e) => {
  if (e.ctrlKey || e.metaKey || (S.mode === 'edit' && e.altKey)) {
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? 1 : -1);
  }
}, { passive: false });

// Keyboard shortcuts: + / - and = / _
window.addEventListener('keydown', (e) => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) return;
  if (e.key === '+' || e.key === '=') {
    e.preventDefault();
    zoomBy(1);
  } else if (e.key === '-' || e.key === '_') {
    e.preventDefault();
    zoomBy(-1);
  } else if (e.key === '0' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    setZoom(1);
  }
});

requestAnimationFrame(loop);
