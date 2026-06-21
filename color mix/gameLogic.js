/* gameLogic.js — game state and flow, uses UI and audio modules */

import { colorData, basePaletteColors, paletteColors, recipes, targetColors } from './data.js';
import { estimateMix, hexToRgb } from './utils.js';
import { sfx } from './audio.js';
import { DOM, renderPalette, setRoundDisabled } from './ui.js';
import colorNames from './color-names.js';

let lives = 3;
let score = 0;
const maxLives = 5;
let currentTarget = '';
let selectedColors = [];
let isAnimating = false;
let cheatModeActive = false;
let freeplayMode = false;
let customCount = 0;
let roundDisabledSet = new Set();

const annoyingMessages = ["Ugh, it's obviously [C1] and [C2].", "My pet rock knows it's [C1] + [C2].", "*Sigh*... just click [C1] and [C2].", "L bozo its just [C1] & [C2].", "Wow. Can't figure out [C1] + [C2]?", "Use [C1] and [C2] you absolute casual.", "I'm judging you. It's [C1] + [C2].", "Need me to hold your hand? [C1] & [C2].", "Bla bla bla its [C1] [C2]"];

function updateUI() {
    DOM.livesDisplay.innerHTML = '❤️'.repeat(lives) + '<span class="opacity-30">🖤</span>'.repeat(maxLives - lives);
    DOM.scoreDisplay.innerText = score;
}

function showScreen(screenName) {
    Object.values(DOM.screens).forEach(s => s.classList.add('hidden'));
    DOM.screens[screenName].classList.remove('hidden');
    DOM.screens[screenName].classList.add('flex');
}

function initPalette() {
    renderPalette(0, freeplayMode ? paletteColors : basePaletteColors);
    roundDisabledSet = new Set();
    setRoundDisabled(roundDisabledSet);
}

function generateRound() {
    selectedColors = [];
    isAnimating = false;
    DOM.mix1.className = 'mix-circle mix-left w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-black z-10';
    DOM.mix2.className = 'mix-circle mix-right w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-black z-10';
    DOM.mixResult.className = 'mix-result w-32 h-32 md:w-40 md:h-40 rounded-full border-8 border-black z-20 flex items-center justify-center text-4xl text-outline';
    DOM.mixResult.innerHTML = '';
    DOM.mixStatus.style.opacity = '0';
    DOM.mixStatus.innerText = '';
    DOM.gameScreenEl.classList.remove('glow-screen');

    if (freeplayMode) {
        DOM.targetCircle.style.backgroundColor = 'transparent';
        DOM.targetNameDisplay.innerText = 'FREEPLAY';
        DOM.targetNameDisplay.style.color = '#ffffff';
        DOM.cheatHint.classList.add('hidden');
        renderPalette(0, paletteColors);
        return;
    }

    currentTarget = targetColors[Math.floor(Math.random() * targetColors.length)];
    const possibleCombinations = recipes[currentTarget];
    const requiredColors = possibleCombinations[0];
    DOM.targetCircle.style.backgroundColor = colorData[currentTarget].hex;
    DOM.targetNameDisplay.innerText = currentTarget;
    DOM.targetNameDisplay.style.color = colorData[currentTarget].hex;

    cheatModeActive = DOM.cheatToggle.checked;
    if (cheatModeActive) {
        DOM.cheatHint.classList.remove('hidden');
        let msg = annoyingMessages[Math.floor(Math.random() * annoyingMessages.length)];
        const activeCombo = possibleCombinations[Math.floor(Math.random() * possibleCombinations.length)];
        msg = msg.replace('[C1]', activeCombo[0]).replace('[C2]', activeCombo[1]);
        DOM.cheatHint.innerText = msg;
        DOM.cheatHint.style.top = `${Math.floor(Math.random() * 70) + 10}%`;
        DOM.cheatHint.style.left = `${Math.floor(Math.random() * 50) + 10}%`;
    } else {
        DOM.cheatHint.classList.add('hidden');
    }

    let buttonsToDisable = [currentTarget];
    let distractors = paletteColors.filter(c => c !== currentTarget && !requiredColors.includes(c));
    distractors.sort(() => 0.5 - Math.random());
    let disableCount = Math.floor(Math.random() * 2) + 1;
    for (let i = 0; i < disableCount && i < distractors.length; i++) buttonsToDisable.push(distractors[i]);

    roundDisabledSet = new Set(buttonsToDisable);
    setRoundDisabled(roundDisabledSet);
}

function startGame() {
    sfx.init();
    sfx.click();
    freeplayMode = false;
    lives = 3;
    score = 0;
    isAnimating = false;
    cheatModeActive = DOM.cheatToggle.checked;
    DOM.exitBtn.classList.remove('hidden');
    updateUI();
    showScreen('game');
    initPalette();
    generateRound();
}

function startFreeplay() {
    sfx.init();
    sfx.click();
    freeplayMode = true;
    isAnimating = false;
    cheatModeActive = false;
    DOM.exitBtn.classList.remove('hidden');
    updateUI();
    showScreen('game');
    initPalette();
    generateRound();
}

function endGame() {
    sfx.gameover();
    document.getElementById('final-score').innerText = score;
    DOM.cheatShame.classList.toggle('hidden', !cheatModeActive);
    showScreen('gameOver');
}

function findColorByHex(hex) {
    const norm = hex.toLowerCase();
    for (const key of Object.keys(colorData)) {
        if (colorData[key].hex.toLowerCase() === norm) return key;
    }
    return null;
}

function addCustomColor(hex) {
    // If exact match exists in known palette, return it
    const existing = findColorByHex(hex);
    if (existing) return existing;

    // Try to match an actual color name from colorNames by exact hex first
    const exact = colorNames.find(c => c.hex.toLowerCase() === hex.toLowerCase());
    if (exact) {
        // Ensure unique key if name already exists in colorData
        let baseName = exact.name;
        let name = baseName;
        let idx = 1;
        while (colorData[name]) {
            name = `${baseName} (${idx})`;
            idx++;
        }
        colorData[name] = { hex };
        paletteColors.push(name);
        renderPalette(Math.max(0, Math.ceil(paletteColors.length / 10) - 1), paletteColors);
        return name;
    }

    // Otherwise pick the closest named color by Euclidean RGB distance
    const targetRgb = hexToRgb(hex);
    let best = null;
    let bestDist = Infinity;
    for (const cand of colorNames) {
        const cRgb = hexToRgb(cand.hex);
        const dr = cRgb.r - targetRgb.r;
        const dg = cRgb.g - targetRgb.g;
        const db = cRgb.b - targetRgb.b;
        const dist = dr * dr + dg * dg + db * db;
        if (dist < bestDist) {
            bestDist = dist;
            best = cand;
        }
    }

    // Use the closest name but ensure uniqueness
    let baseName = best ? best.name : `Color ${hex.toUpperCase()}`;
    let name = baseName;
    let idx = 1;
    while (colorData[name]) {
        name = `${baseName} (${idx})`;
        idx++;
    }

    colorData[name] = { hex };
    paletteColors.push(name);
    renderPalette(Math.max(0, Math.ceil(paletteColors.length / 10) - 1), paletteColors);
    return name;
}

function handlePaletteSelect(e) {
    const colorName = e.detail.color;
    if (isAnimating || selectedColors.length >= 2) return;
    sfx.click();
    selectedColors.push(colorName);
    if (selectedColors.length === 1) {
        DOM.mix1.style.backgroundColor = colorData[colorName].hex;
        DOM.mix1.classList.add('active');
    } else if (selectedColors.length === 2) {
        DOM.mix2.style.backgroundColor = colorData[colorName].hex;
        DOM.mix2.classList.add('active');
        DOM.paletteContainer.querySelectorAll('button').forEach(btn => btn.disabled = true);
        DOM.cheatHint.classList.add('hidden');
        processMix();
    }
}

function processMix() {
    isAnimating = true;
    sfx.mix();
    setTimeout(() => {
        DOM.mix1.classList.add('merge');
        DOM.mix2.classList.add('merge');
        setTimeout(checkResult, 500);
    }, 300);
}

function checkResult() {
    if (freeplayMode) {
        sfx.correct();
        const hex = estimateMix(selectedColors[0], selectedColors[1]);
        const name = addCustomColor(hex);
        DOM.mixResult.style.backgroundColor = hex;
        DOM.mixResult.innerHTML = '★';
        DOM.mixResult.classList.add('show');
        DOM.mixStatus.innerText = `Created: ${name}`;
        DOM.mixStatus.style.color = '#32ade6';
        DOM.mixStatus.style.opacity = '1';
        DOM.paletteContainer.querySelectorAll('button').forEach(btn => btn.disabled = false);
        setTimeout(generateRound, 700);
        return;
    }

    const validCombinations = recipes[currentTarget];
    const isCorrect = validCombinations.some(required =>
        required.every(c => selectedColors.includes(c)) && selectedColors.length === 2
    );

    if (isCorrect) {
        sfx.correct();
        score += cheatModeActive ? 50 : 100;
        lives = Math.min(maxLives, lives + 1);
        DOM.mixResult.style.backgroundColor = colorData[currentTarget].hex;
        DOM.mixResult.innerHTML = '✔';
        DOM.mixResult.classList.add('show');
        DOM.mixStatus.innerText = cheatModeActive ? 'CHEATED! (+50 PTS)' : 'GREAT MIX! +1 LIFE';
        DOM.mixStatus.style.color = cheatModeActive ? '#ff00ff' : '#34c759';
        DOM.mixStatus.style.opacity = '1';
        DOM.gameScreenEl.classList.add('glow-screen');
        updateUI();
        setTimeout(generateRound, 1500);
    } else {
        sfx.wrong();
        lives--;
        DOM.mixResult.style.backgroundColor = estimateMix(selectedColors[0], selectedColors[1]);
        DOM.mixResult.innerHTML = '✖';
        DOM.mixResult.classList.add('show');
        DOM.mixStatus.innerText = cheatModeActive ? 'YOU HAD THE ANSWER?!' : 'BAD MIX! -1 LIFE';
        DOM.mixStatus.style.color = cheatModeActive ? '#ff00ff' : '#ff3b30';
        DOM.mixStatus.style.opacity = '1';
        document.body.classList.add('shake-screen');
        setTimeout(() => document.body.classList.remove('shake-screen'), 400);
        updateUI();
        setTimeout(() => (lives <= 0 ? endGame() : generateRound()), 1500);
    }
}

// Global event listeners used by ui.js
export function initGameLogic() {
    // UI dispatches these custom events — react to them
    window.addEventListener('game:start', startGame);
    window.addEventListener('game:freeplay', startFreeplay);
    window.addEventListener('game:exit', () => {
        sfx.click();
        freeplayMode = false;
        cheatModeActive = DOM.cheatToggle.checked;
        showScreen('title');
    });
    window.addEventListener('palette:select', handlePaletteSelect);
    window.addEventListener('sfx:click', () => sfx.click());

    // initial UI state
    updateUI();
    initPalette();
}