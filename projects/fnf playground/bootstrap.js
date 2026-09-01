/* bootstrap.js - loads images, wires input/UI, and starts the engine */
import { CHAR_IMG_URL, NOTE_IMG_URL } from "./assets.js";
import { initGame, spawnNote, notes, receptors } from "./engine.js";

/* UI hooks */
const canvas = document.getElementById('gameCanvas');
const loadingEl = document.getElementById('loading');
const loadingText = document.getElementById('loading-text');

let charImg = new Image();
let noteImg = new Image();
charImg.crossOrigin = "Anonymous";
noteImg.crossOrigin = "Anonymous";

let loadedCount = 0;
function checkLoad() {
    loadedCount++;
    if (loadedCount >= 2) {
        loadingEl.style.display = 'none';
        initGame(charImg, noteImg);
    }
}
charImg.onload = checkLoad;
noteImg.onload = checkLoad;
charImg.onerror = () => loadingText.innerText = "Error loading Character Image!";
noteImg.onerror = () => loadingText.innerText = "Error loading Notes Image!";
charImg.src = CHAR_IMG_URL;
noteImg.src = NOTE_IMG_URL;

/* Input handling - keyboard */
window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const key = e.key.toLowerCase();
    /* mirror previous behavior: set keysDown in engine */
    import("./engine.js").then(mod => {
        mod.keysDown[key] = true;
        if (key === 'a' || e.key === 'ArrowLeft') mod.spawnNote(0, false);
        if (key === 's' || e.key === 'ArrowDown') mod.spawnNote(1, false);
        if (key === 'k' || e.key === 'ArrowUp') mod.spawnNote(2, false);
        if (key === 'l' || e.key === 'ArrowRight') mod.spawnNote(3, false);
        if (key === 'z') mod.spawnNote(0, true);
        if (key === 'x') mod.spawnNote(1, true);
        if (key === ',') mod.spawnNote(2, true);
        if (key === '.') mod.spawnNote(3, true);
        if (key === '1') {
            mod.spawnNote(0, false);
            setTimeout(() => mod.spawnNote(1, false), 100);
            setTimeout(() => mod.spawnNote(2, false), 200);
            setTimeout(() => mod.spawnNote(3, false), 300);
        }
        if (key === ' ') {
            mod.spawnNote(0, false); mod.spawnNote(1, false); mod.spawnNote(2, false); mod.spawnNote(3, false);
        }
    });
});

window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    import("./engine.js").then(mod => {
        mod.keysDown[key] = false;
    });
});

/* Reset NPS button */
document.getElementById('btn-resetnps').addEventListener('click', () => {
    import("./engine.js").then(mod => {
        mod.maxNps = 0;
        document.getElementById('val-maxnps').innerText = 0;
    });
});

/* Expose spawnNote on window for quick debugging if needed */
window.spawnNote = (dir, danger) => {
    import("./engine.js").then(mod => mod.spawnNote(dir, !!danger));
};