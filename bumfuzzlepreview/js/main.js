// entry
import { initUI } from './ui.js';
import { resizeCanvas } from './game.js';

window.addEventListener('load', () => {
  resizeCanvas();
  initUI();
});