/* main.js now delegates to modular files for maintainability.
   Large original content moved into entities.js, physics.js, render.js, ui.js, utils.js.
   Tombstones below mark removed blocks for reference. */

import { canvas, ctx, resizeCanvas } from './utils.js';
import { initUI } from './ui.js';
import { spawnMagnet, spawnChain, clearAll, magnets, walls, draggingMagnet, setDraggingMagnet } from './entities.js';
import { startLoop } from './render.js';
import './styles.js'; // noop: placeholder if you want JS-side style hooks

// Create background audio and attempt autoplay; fall back to starting on first user interaction
const bgAudio = new Audio('/Inst.mp3');
bgAudio.loop = true;
bgAudio.volume = 0.45;
let bgPlaying = false;
function tryPlayBg() {
  if (bgPlaying) return;
  const p = bgAudio.play();
  if (p && p.then) {
    p.then(() => { bgPlaying = true; })
     .catch(() => { /* autoplay blocked; will start on user gesture */ });
  }
}

// try to autoplay immediately
tryPlayBg();

// ensure user interaction starts audio if autoplay blocked
function userStartHandler() {
  tryPlayBg();
  window.removeEventListener('mousedown', userStartHandler);
  window.removeEventListener('touchstart', userStartHandler);
}
window.addEventListener('mousedown', userStartHandler, { once: true });
window.addEventListener('touchstart', userStartHandler, { once: true });

// Wire UI to entity spawners and actions
initUI({
  onResize: resizeCanvas,
  onSpawn: (type) => spawnMagnet(type),
  onChain: spawnChain,
  onReset: clearAll,
  getState: () => ({ magnets, walls, draggingMagnet }),
  setDragging: setDraggingMagnet
});

// start rendering loop (handles physics, render, interactions)
resizeCanvas();
startLoop();
