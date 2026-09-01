/* ui.js — DOM wiring and palette rendering */

import { colorData } from './data.js';
import { setNavX } from './left-right-button.js';

export const DOM = {
    screens: { title: document.getElementById('title-screen'), game: document.getElementById('game-screen'), gameOver: document.getElementById('game-over-screen') },
    paletteContainer: document.getElementById('palette'),
    livesDisplay: document.getElementById('lives-display'),
    scoreDisplay: document.getElementById('score-display'),
    targetCircle: document.getElementById('target-circle'),
    targetNameDisplay: document.getElementById('target-name'),
    mix1: document.getElementById('mix-1'),
    mix2: document.getElementById('mix-2'),
    mixResult: document.getElementById('mix-result'),
    mixStatus: document.getElementById('mix-status'),
    gameScreenEl: document.getElementById('game-screen'),
    cheatToggle: document.getElementById('cheat-toggle'),
    cheatHint: document.getElementById('cheat-hint'),
    cheatShame: document.getElementById('cheat-shame'),
    playBtn: document.getElementById('play-btn'),
    playAgainBtn: document.getElementById('play-again-btn'),
    exitBtn: document.getElementById('exit-btn'),
    palettePrev: document.getElementById('palette-prev'),
    paletteNext: document.getElementById('palette-next'),
    palettePageIndicator: document.getElementById('palette-page-indicator'),
    freeplayBtn: document.getElementById('freeplay-btn')
};

const itemsPerPage = 12;

export function buildButtonForColor(colorName) {
    const btn = document.createElement('button');
    btn.className = 'palette-btn float-fast text-outline-sm py-3 md:py-4 rounded-full border-2 border-black text-lg md:text-xl relative w-full overflow-hidden';
    btn.style.backgroundColor = colorData[colorName].hex;
    btn.innerText = colorName;
    btn.dataset.color = colorName;
    btn.style.boxShadow = `inset 0 4px 10px rgba(255,255,255,0.4), inset 0 -4px 0 rgba(0,0,0,0.3), 0 4px 0 black`;
    btn.style.animationDelay = `${Math.random() * 2}s`;
    return btn;
}

let palettePage = 0;
let freeplayModeLocal = false;
let roundDisabled = new Set();

export function renderPalette(page = 0, paletteSource = null) {
    const container = DOM.paletteContainer;
    container.innerHTML = '';
    const source = paletteSource || window.COLOR_APP && window.COLOR_APP.paletteColors ? window.COLOR_APP.paletteColors : [];
    const total = source.length;
    const pages = Math.max(1, Math.ceil(total / itemsPerPage));
    palettePage = Math.max(0, Math.min(page, pages - 1));
    const start = palettePage * itemsPerPage;
    const slice = source.slice(start, start + itemsPerPage);
    slice.forEach(color => {
        const btn = buildButtonForColor(color);
        btn.addEventListener('click', () => {
            // dispatch a global event used by game logic
            window.dispatchEvent(new CustomEvent('palette:select', { detail: { color } }));
        });
        container.appendChild(btn);
    });

    // Update prev/next and indicator
    if (DOM.palettePrev && DOM.paletteNext && DOM.palettePageIndicator) {
        DOM.palettePrev.disabled = (palettePage === 0);
        DOM.paletteNext.disabled = (palettePage >= pages - 1);
        DOM.palettePageIndicator.innerText = `Page ${palettePage + 1} / ${pages}`;
    }

    // Apply round disabled set (if not freeplay)
    container.querySelectorAll('button').forEach(btn => {
        btn.disabled = roundDisabled.has(btn.dataset.color);
    });
}

export function setRoundDisabled(set) {
    roundDisabled = new Set(set);
    // update visible buttons
    DOM.paletteContainer.querySelectorAll('button').forEach(btn => btn.disabled = roundDisabled.has(btn.dataset.color));
}

export function initUI() {
    // Wire basic navigation buttons (listeners for game logic subscribe to events)
    if (DOM.playBtn) DOM.playBtn.addEventListener('click', () => window.dispatchEvent(new CustomEvent('game:start')));
    if (DOM.playAgainBtn) DOM.playAgainBtn.addEventListener('click', () => window.dispatchEvent(new CustomEvent('game:start')));
    if (DOM.freeplayBtn) DOM.freeplayBtn.addEventListener('click', () => window.dispatchEvent(new CustomEvent('game:freeplay')));
    if (DOM.exitBtn) DOM.exitBtn.addEventListener('click', () => window.dispatchEvent(new CustomEvent('game:exit')));
    if (DOM.palettePrev) DOM.palettePrev.addEventListener('click', () => {
        renderPalette(palettePage - 1);
        window.dispatchEvent(new CustomEvent('sfx:click'));
    });
    if (DOM.paletteNext) DOM.paletteNext.addEventListener('click', () => {
        renderPalette(palettePage + 1);
        window.dispatchEvent(new CustomEvent('sfx:click'));
    });

    // initial palette render if color data is present
    const paletteSource = window.COLOR_APP && window.COLOR_APP.basePaletteColors ? window.COLOR_APP.basePaletteColors : [];
    renderPalette(0, paletteSource);

    // Ensure nav buttons are auto-positioned after we've rendered the palette (so sizes are available)
    try { 
        // run in rAF to ensure layout is settled — let nav buttons snap to natural flex positions
        requestAnimationFrame(() => {
            try { setNavX(); } catch (e) { /* ignore if module unavailable */ }
        });
    } catch (e) { /* ignore */ }

    // Recompute nav X on resize so buttons stay positioned outside the palette; use rAF to avoid layout thrash
    try {
        let rafId = null;
        window.addEventListener('resize', () => {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                try { setNavX(); } catch (e) { /* ignore */ }
                rafId = null;
            });
        }, { passive: true });
    } catch (e) { /* ignore */ }
}