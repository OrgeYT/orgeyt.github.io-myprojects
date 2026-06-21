 // Tombstone: game.js moved and split into modules:
 // removed const colorData = { ... } {}
 // removed const basePaletteColors = [...] {}
 // removed const recipes = { ... } {}
 // removed hexToRgb() {}
 // removed rgbToHex() {}
 // removed estimateMix() {}
 // removed game state variables (lives, score, etc.) {}
 // removed sfx object and audio code {}
 // removed DOM refs and UI helper functions (buildButtonForColor, renderPalette, initPalette, showScreen, updateUI) {}
 // removed gameplay functions (startGame, startFreeplay, generateRound, selectColor, processMix, checkResult, endGame) {}
 // removed custom color helpers (findColorByHex, addCustomColor) {}
 // removed event wiring for buttons and palette navigation {}
 // See new modular files: data.js, utils.js, audio.js, ui.js, core.js