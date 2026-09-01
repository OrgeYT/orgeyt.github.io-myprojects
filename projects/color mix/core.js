/* core.js — application entry that wires modules together */

import { colorData, basePaletteColors, paletteColors as sharedPaletteColors, recipes, targetColors } from './data.js';
import { hexToRgb, rgbToHex, estimateMix } from './utils.js';
import { sfx, initAudio } from './audio.js';
import { initUI, renderPalette, buildButtonForColor, DOM } from './ui.js';
import { initGameLogic } from './gameLogic.js';

// Initialize audio context on first user interaction (gesture-safe)
document.addEventListener('pointerdown', () => initAudio(), { once: true });

// Export shared pieces for modules that need them (keeps compatibility)
window.COLOR_APP = {
    colorData,
    basePaletteColors,
    paletteColors: sharedPaletteColors,
    recipes,
    targetColors,
    hexToRgb,
    rgbToHex,
    estimateMix,
    sfx
};

// Initialize UI and logic
initUI();
initGameLogic();