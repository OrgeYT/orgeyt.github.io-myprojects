/** Shared mutable game state — mutate properties on `S` from any module */

import { GAME_HEIGHT } from './config.js';

export const canvas = document.getElementById('gameCanvas');
export const ctx = canvas.getContext('2d');

export const els = {
  botStatus: document.getElementById('bot-status'),
  frameCounter: document.getElementById('tas-frame-counter'),
  clickCounter: document.getElementById('click-counter'),
  cpsCounter: document.getElementById('cps-counter'),
  maxCpsCounter: document.getElementById('max-cps-counter'),
  rewindFlash: document.getElementById('rewind-flash'),
  errorToast: document.getElementById('error-toast'),
  uiPanel: document.getElementById('ui'),
  toggleBtn: document.getElementById('toggle-ui'),
  btnEdit: document.getElementById('btn-edit'),
  btnPlay: document.getElementById('btn-play'),
  btnCamera: document.getElementById('btn-camera'),
  botSelect: document.getElementById('bot-select'),
  btnPlayBot: document.getElementById('btn-play-bot'),
  btnTasRecord: document.getElementById('btn-tas-record'),
  btnTasPlay: document.getElementById('btn-tas-play'),
  btnTasLoad: document.getElementById('btn-tas-load'),
  btnTasStep: document.getElementById('btn-tas-step'),
  tasSpeedSelect: document.getElementById('tas-speed'),
  toolSelect: document.getElementById('tool-select'),
  waveSizeInput: document.getElementById('wave-size'),
  waveSizeValue: document.getElementById('wave-size-value'),
  showWaveHitboxInput: document.getElementById('show-wave-hitbox'),
  transparentWaveInput: document.getElementById('transparent-wave'),
  soundSelect: document.getElementById('sound-select'),
};

export const S = {
  GAME_Y: 0,
  cameraX: 0,
  cameraFocus: false,
  showWaveHitbox: false,
  transparentWave: false,
  cameraFocusX: 100,
  cameraFocusY: GAME_HEIGHT / 2,

  mode: 'edit',
  level: [],
  levelGrid: new Map(),

  player: {
    x: 100,
    y: GAME_HEIGHT / 2,
    size: 12,
    isHolding: false,
    active: false,
    dead: false,
  },

  trail: [],
  recordedActions: [],
  playbackActions: [],
  clickBotPlan: [],
  leastClickSearchId: 0,
  frameCount: 0,
  tasRecording: false,
  tasPlayback: false,
  tasInputBuffer: false,
  extendAfterPlayback: false,

  dragPlacing: false,
  lastPlacedKey: null,

  clicksCount: 0,
  clickTimestamps: [],
  maxCPS: 0,
};
