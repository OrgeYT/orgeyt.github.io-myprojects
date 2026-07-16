import * as C from './constants.js';
import { initEngine, place_food, getState, initEngine as ign, initEngine as unused } from './engine.js';
import { initInput } from './input.js';
import { startRenderLoop } from './renderer.js';

import { initEngine as engineInit, getState as engineGetState, reset as engineReset, start_game } from './engine.js';

// wire up engine callbacks and start render
engineInit({
    onScore: (s) => {
        const scoreEl = document.getElementById("score");
        if (scoreEl) scoreEl.textContent = "Score: " + s;
    },
    onGameOver: (msg) => {
        const overlay = document.getElementById("overlay"),
            overlayMsg = document.getElementById("overlay-msg"),
            restartBtn = document.getElementById("restart-btn");
        if (overlay && overlayMsg && restartBtn) {
            overlayMsg.textContent = msg;
            overlay.style.display = "block";
            restartBtn.onclick = function() { location.reload(); };
        } else {
            setTimeout(function() { alert(msg); }, 250);
        }
    }
});

// init input
const input = initInput();

// place initial food and start renderer
import { place_food as placeFood } from './engine.js';
placeFood();

startRenderLoop(() => {
    return engineGetState();
});