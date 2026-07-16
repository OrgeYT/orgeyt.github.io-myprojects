import * as C from './constants.js';
import { initEngine, getState as engineGetState } from './engine.js';
import { initInput } from './input.js';
import { startRenderLoop } from './renderer.js';
import { place_food as placeFood } from './engine.js';
import * as S from './sounds.js';

// wire up engine callbacks and start render
S.initSounds();
initEngine({
    onScore: (s) => {
        const scoreEl = document.getElementById("score");
        if (scoreEl) scoreEl.textContent = "Score: " + s;
        S.playEat();
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
        S.playGameOver();
    }
});

// init input (input module will call start/move sounds)
const input = initInput(S);

// place initial food and start renderer
placeFood();

startRenderLoop(() => {
    return engineGetState();
});
