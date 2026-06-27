import { state, setupCanvas, resizeCanvas } from './state.js';
import { initUI } from './ui.js';
import { loadLevel, loadPlayground } from './level.js';
import { update } from './physics.js';
import { draw } from './render.js';

// Wire up DOM + canvas
const { canvas } = state;
setupCanvas();
window.addEventListener('resize', resizeCanvas);

// Initialize UI (buttons, overlays)
initUI({
  start: () => {
    state.currentLevel = 1;
    loadLevel(state.currentLevel);
    state.isPlayground = false;
    state.gameState = 'playing';
    // sync mouse last pos
    state.cursor.lastScreenX = state.cursor.screenX;
    state.cursor.lastScreenY = state.cursor.screenY;
    state.hud.classList.remove('hidden');
  },
  playground: () => {
    // Enter free-roam playground: big empty map with no hazards
    loadPlayground();
    state.isPlayground = true;
    state.gameState = 'playing';
    state.cursor.lastScreenX = state.cursor.screenX;
    state.cursor.lastScreenY = state.cursor.screenY;
    state.hud.classList.remove('hidden');
    state.levelText.innerText = '∞';
  },
  next: () => {
    state.winScreen.classList.add('hidden');
    state.currentLevel++;
    if (state.currentLevel > state.MAX_LEVELS) {
      state.gameState = 'gameover';
      state.gameOverScreen.classList.remove('hidden');
      state.hud.classList.add('hidden');
    } else {
      loadLevel(state.currentLevel);
      state.isPlayground = false;
      state.gameState = 'playing';
    }
  },
  playAgain: () => {
    state.gameOverScreen.classList.add('hidden');
    // reuse start action
    state.currentLevel = 1;
    loadLevel(state.currentLevel);
    state.isPlayground = false;
    state.gameState = 'playing';
  }
});

// TAS helpers
function downloadTAS() {
  const tas = state.tas;
  if (!tas.frames.length) return;
  const data = {
    name: tas.name || 'tas_recording',
    frames: tas.frames
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (tas.name || 'tas') + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function startPlayback() {
  const tas = state.tas;
  if (!tas.frames.length) return;
  tas.playing = true;
  tas.playIndex = 0;
  // lock cursor sampling to tas input
  state.cursor.lastScreenX = tas.frames[0].x;
  state.cursor.lastScreenY = tas.frames[0].y;
}

function stopPlayback() {
  state.tas.playing = false;
}

// Keyboard controls:
// R - toggle recording (enter/exit paused frame-step record mode)
// Space - when recording: record current frame (capture client mouse position) while game is paused
// P - toggle playback
// D - download current recording
window.addEventListener('keydown', (e) => {
  const tas = state.tas;
  if (e.key === 'r' || e.key === 'R') {
    tas.recording = !tas.recording;
    if (tas.recording) {
      tas.frames = []; // start fresh
      // Immediately capture current mouse position as the first frame so recordings are not empty
      tas.frames.push({ x: state.cursor.screenX, y: state.cursor.screenY });
      // Enter paused recording mode so you can step frames with Space
      tas.paused = true;
      console.log('TAS: recording started, initial frame captured, game paused for frame-stepping');
    } else {
      // Exit paused recording mode
      tas.paused = false;
      console.log('TAS: recording stopped, frames:', tas.frames.length);
    }
  } else if (e.code === 'Space') {
    // Prevent default page scroll
    e.preventDefault();
    if (tas.recording) {
      // Capture current client coords as a frame while paused (record next frame)
      tas.frames.push({ x: state.cursor.screenX, y: state.cursor.screenY });
      console.log('TAS: frame recorded, total:', tas.frames.length);
      // keep tas.paused = true so game remains paused until recording stopped
    }
  } else if (e.key === 'p' || e.key === 'P') {
    if (tas.playing) stopPlayback();
    else startPlayback();
  } else if (e.key === 'd' || e.key === 'D') {
    downloadTAS();
  }
});

// Playback integration: override cursor.screenX/Y per-frame when playing
// We'll step one TAS frame per update() call (so playback runs at the game's update tick)
const originalUpdate = update;
function wrappedUpdate() {
  const tas = state.tas;

  // If we're actively recording and in paused frame-step mode, skip physics updates so the game is frozen
  if (tas.recording && tas.paused) {
    // still allow rendering and allow the mouse to move (mouse events update cursor.screenX/Y)
    // but do not advance physics/camera/etc. Return early to prevent originalUpdate from running.
    return;
  }

  if (tas.playing) {
    if (tas.playIndex >= tas.frames.length) {
      stopPlayback();
    } else {
      const f = tas.frames[tas.playIndex++];
      // Inject recorded client coords into cursor so physics uses them
      state.cursor.screenX = f.x;
      state.cursor.screenY = f.y;
      // keep lastScreen in sync to avoid giant velocity spikes
      state.cursor.lastScreenX = f.x;
      state.cursor.lastScreenY = f.y;
    }
  }
  originalUpdate();
}

// Start game loops and render
// Use a single requestAnimationFrame loop to drive both rendering and updates.
// This avoids double-stepping (setInterval + rAF) which could desync TAS recording/playback.
requestAnimationFrame(function loop() {
  wrappedUpdate();
  requestAnimationFrame(loop);
});
requestAnimationFrame(draw);