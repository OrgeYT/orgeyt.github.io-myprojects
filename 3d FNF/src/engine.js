/*
  src/engine.js
  Orchestrator: thin entry that wires modular subsystems: threeSetup, notes, input, ui.
  Heavy logic was moved to:
    - ./threeSetup.js
    - ./notes.js
    - ./input.js
    - ./ui.js

  Tombstones below indicate functions removed from this file.
*/

import { initThree, createReceptors, getThreeContext, startRenderLoop } from './threeSetup.js';
import Notes from './notes.js';
import Input from './input.js';
import UI from './ui.js';

const Engine = (() => {
  const config = {
    keybinds: ['a', 's', 'k', 'l'],
    scrollDirection: 'up',
    _baseScrollSpeed: 12,
    scrollMultiplier: 1.9,
    scrollSpeed: 22.8,
    noteDespawnDistance: 30,
    hitWindow: 0.166,
    receptorY: 6,
    laneWidth: 1.8,
    playerXOffset: 4.5,
    opponentXOffset: -4.5,
    botplay: false
  };

  const state = {
    isPlaying: false,
    isPaused: false,
    botplay: false,
    score: 0,
    combo: 0,
    time: 0,
    notes: [],
    receptors: { player: [], opponent: [] },
    chart: [],
    chartIndex: 0,
    audioElements: [],
    currentCustomChart: null,
    currentAudios: [],
    keysHeld: [false, false, false, false],
    stats: {
      totalNotes: 0,
      sick: 0,
      good: 0,
      bad: 0,
      miss: 0
    }
  };

  // Tombstones: moved implementations to modules
  // removed function initThree() {}
  // removed function createReceptors() {}
  // removed function generateRandomChart() {}
  // removed function spawnNote() {}
  // removed function removeNote() {}
  // removed function updateNotes() {}
  // removed function onKeyDown() {}
  // removed function onKeyUp() {}
  // removed function handlePlayerInput() {}
  // removed function showJudgment() {}
  // removed function addScore() {}
  // removed function resetCombo() {}
  // removed function updateHUD() {}
  // removed function stopAndClearGame() {}
  // removed function startGame() {}
  // removed function parsePsychChart() {}
  // removed function animate() {}
  // removed function wireUI() {}

  function stopAndClearGame() {
    state.isPlaying = false;
    Notes.clearAll(state);
    if (state.audioElements) {
      state.audioElements.forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
      });
    }
  }

  function startGame(customChart = null, customAudios = []) {
    stopAndClearGame();

    state.isPlaying = true;
    state.isPaused = false;
    state.score = 0;
    state.combo = 0;
    state.time = 0;
    state.chartIndex = 0;
    state.keysHeld = [false, false, false, false];

    document.getElementById('title-screen').style.display = 'none';
    document.getElementById('pause-modal').classList.remove('active');

    if (customChart) {
      state.chart = customChart;
      state.audioElements = customAudios;
      state.currentCustomChart = customChart;
      state.currentAudios = customAudios;
      state.audioElements.forEach(a => { a.currentTime = 0; a.play(); });
    } else {
      config.scrollSpeed = 8;
      state.chart = Notes.generateRandomChart(60, 4);
      state.currentCustomChart = null;
      state.currentAudios = [];
    }

    UI.updateHUD(state);
    const infoP = document.querySelector('#ui-layer p');
    if (infoP) infoP.innerText = customChart ? "Playing Custom Chart" : "Playing Random Chart";

    const three = getThreeContext();
    if (three && three.clock) three.clock.getDelta();
  }

  function init() {
    initThree(config, state).then(() => {
      createReceptors(config, state);
      UI.wireUI(config, state, {
        startGame,
        stopAndClearGame,
        parsePsychChart: Notes.parsePsychChart
      });
      Input.wireInput(config, state, {
        handlePlayerInput: (lane) => Notes.handlePlayerInput(config, state, lane, UI),
        startGame
      });
      // start main render/logic loop
      startRenderLoop(config, state, Notes, UI);
    }).catch(err => {
      console.error('Engine init error:', err);
    });
  }

  return {
    init,
    startGame,
    stopAndClearGame,
    // expose for debugging
    _state: state,
    _config: config,
    // expose notes helpers
    _notes: Notes
  };
})();

export default Engine;