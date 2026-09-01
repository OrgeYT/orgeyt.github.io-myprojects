import { D_UP, D_DOWN, D_LEFT, D_RIGHT } from './constants.js';
import { setDirStack, start_game, setStarted, isStarted, setPaused, isPaused } from './engine.js';

let ctrl_stack = [];

export function initInput(opts = {}) {
    const pauseBtn = document.getElementById("pause-btn");
    const scoreEl = document.getElementById("score");

    function flushStackToEngine() {
        setDirStack(ctrl_stack);
    }

    if (pauseBtn) {
        pauseBtn.addEventListener("click", function() {
            if (!isStarted()) return;
            setPaused(!isPaused());
            pauseBtn.setAttribute("aria-pressed", isPaused() ? "true" : "false");
            pauseBtn.textContent = isPaused() ? "Resume" : "Pause";
        });
    }

    document.addEventListener("keydown", function(e) {
        // P toggles pause
        if (e.keyCode === 80 || e.key === "p" || e.key === "P") {
            if (isStarted()) {
                setPaused(!isPaused());
                pauseBtn && pauseBtn.setAttribute("aria-pressed", isPaused() ? "true" : "false");
                pauseBtn && (pauseBtn.textContent = isPaused() ? "Resume" : "Pause");
            }
            return;
        }
        // Enter starts / toggles pause
        if (e.keyCode === 13) {
            if (!isStarted()) {
                setStarted(true);
                start_game();
                return;
            } else {
                setPaused(!isPaused());
                pauseBtn && pauseBtn.setAttribute("aria-pressed", isPaused() ? "true" : "false");
                pauseBtn && (pauseBtn.textContent = isPaused() ? "Resume" : "Pause");
                return;
            }
        }

        if (isPaused()) return;

        switch (e.keyCode) {
            case D_UP:
            case D_LEFT:
            case D_RIGHT:
            case D_DOWN:
                ctrl_stack.push(e.keyCode);
        }

        // on first move start the game
        if (!isStarted() && ctrl_stack.length > 0) {
            setStarted(true);
            start_game();
        }

        flushStackToEngine();
    });

    return {
        getStack: () => ctrl_stack,
        clearStack: () => { ctrl_stack = []; setDirStack(ctrl_stack); }
    };
}