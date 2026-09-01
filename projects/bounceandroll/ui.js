import { state } from './state.js';

export function initUI(actions) {
    const s = state;
    const startBtn = document.getElementById('startBtn');
    const nextBtn = document.getElementById('nextBtn');
    const playAgainBtn = document.getElementById('playAgainBtn');
    const playgroundBtn = document.getElementById('playgroundBtn');

    startBtn.addEventListener('click', () => {
        s.startScreen.classList.add('hidden');
        s.hud.classList.remove('hidden');
        if (actions.start) actions.start();
    });

    if (playgroundBtn) {
        playgroundBtn.addEventListener('click', () => {
            s.startScreen.classList.add('hidden');
            s.hud.classList.remove('hidden');
            if (actions.playground) actions.playground();
        });
    }

    nextBtn.addEventListener('click', () => {
        if (actions.next) actions.next();
    });

    playAgainBtn.addEventListener('click', () => {
        if (actions.playAgain) actions.playAgain();
    });
}