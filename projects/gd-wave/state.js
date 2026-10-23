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
  steepModeInput: document.getElementById('steep-mode'),
  soundSelect: document.getElementById('sound-select'),
  zoomInBtn: document.getElementById('btn-zoom-in'),
  zoomOutBtn: document.getElementById('btn-zoom-out'),
  zoomValue: document.getElementById('zoom-value'),
  carvePathInput: document.getElementById('carve-path'),
  rotIndicator: document.getElementById('rot-indicator'),
  spawnYInput: document.getElementById('spawn-y'),
  spawnYValue: document.getElementById('spawn-y-value'),
  btnSetSpawnY: document.getElementById('btn-set-spawn-y'),
  btnClearSpawnY: document.getElementById('btn-clear-spawn-y'),
};

export const S = {
  GAME_Y: 0,
  cameraX: 0,
  cameraFocus: false,
  showWaveHitbox: false,
  transparentWave: false,
  steepMode: false,
  cameraFocusX: 100,
  cameraFocusY: GAME_HEIGHT / 2,

  // Camera zoom (1 = default). Works in both edit and play.
  zoom: 1.0,
  minZoom: 0.4,
  maxZoom: 3.0,

  // Visual-only tilt angle for smooth wave rotation animation (radians)
  // Gameplay still uses the binary isHolding state.
  visualTilt: Math.PI / 4, // start pointing down

  mode: 'edit',
  level: [],
  levelGrid: new Map(),

  // Optional per-level spawn Y (world pixels). null = default center.
  spawnY: null,

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

  // Current placement rotation (0=0°, 1=90°, 2=180°, 3=270°)
  placeRotation: 0,

  // Last play path (kept when returning to editor)
  lastPlayTrail: [],

  // After-play carve mode: generate hollow tunnel from path
  carvePathMode: false,

  // Editor: right-click temporary eraser
  rightClickErasing: false,
  toolBeforeErase: null,

  // Editor ghost preview (world-space tile under cursor)
  previewTile: null, // { x, y } grid coords or null

  clicksCount: 0,
  clickTimestamps: [],
  maxCPS: 0,
};
