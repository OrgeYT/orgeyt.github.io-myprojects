import { initEngine, Engine } from "./engine.js";
import { UI } from "./ui.js";
import { Input } from "./input.js";
import { Character } from "./character.js";

const canvas = document.getElementById('game-canvas');

initEngine(canvas);
Engine.ui = UI;
Engine.input = Input;

UI.init();
Input.init();

 // wait for sounds to finish loading (or at least attempt) before hiding loading overlay,
  // but also set a fallback timeout so we don't block forever.
  const hideLoading = () => {
    const loader = document.getElementById('loading-overlay');
    if (loader) loader.style.display = 'none';
    const start = document.getElementById('start-overlay');
    if (start && !document.pointerLockElement) start.style.display = 'flex';

  };

  // maximum wait of 2.5s, but prefer actual sound readiness
  const soundReadyTimeout = new Promise(resolve => setTimeout(resolve, 2500));
  const soundReadyPromise = (Engine.sounds && Engine.sounds.whenReady) ? Engine.sounds.whenReady() : Promise.resolve();

  Promise.race([Promise.all([soundReadyPromise, Promise.resolve()]), soundReadyTimeout]).then(hideLoading).catch(hideLoading);

// Create player
const player = new Character(true, 'none');

function gameLoop() {
  const now = performance.now();
  let dt = (now - Engine.lastTime) / 1000;
  if (dt > 0.1) dt = 0.1;
  Engine.lastTime = now;
  Engine.time += dt;

  Input.processPlayerInput(dt);

  // when not pointer-locked, play idle camera cinematic to show the map
  if (!Engine.isLocked && Engine.updateIdleCamera) Engine.updateIdleCamera(dt);

  for (let char of Engine.characters.slice()) {
    char.update(dt);
    if (!char.isPlayer) char.updateAI(dt);
  }

  // update UI every frame so cooldown bars and ult meter animate smoothly
  if (Engine.ui && Engine.player) Engine.ui.updatePlayerUI();

  Engine.renderer.render(Engine.scene, Engine.camera);
  requestAnimationFrame(gameLoop);
}

window.spawnEnemy = function (aiLevel) {
  // prefer the centralized spawn function in Input so toggle behavior and locking are consistent
  if (Input && Input.spawnEnemy) {
    Input.spawnEnemy(aiLevel, false);
  } else {
    new Character(false, aiLevel, false);
    document.body.requestPointerLock();
  }
};

window.onload = () => {
  UI.updatePlayerUI();
  gameLoop();
};