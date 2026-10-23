/** Shared game constants — tuned closer to real Geometry Dash wave behaviour */

export const TILE_SIZE = 40;

// Real GD uses discrete high-rate physics (historically 240 Hz, later variants higher).
// We keep a high fixed rate for bot accuracy while matching the classic 1.5 unit/frame
// feel of legacy 240 Hz wave tools.
export const LEGACY_PHYSICS_HZ = 240;
export const PHYSICS_HZ = 500;
export const SPEED = 1.5 * LEGACY_PHYSICS_HZ / PHYSICS_HZ; // ≈ 0.72 world units / tick
export const FIXED_TICK_RATE = 1000 / PHYSICS_HZ;
export const GAME_HEIGHT = 600;

// Wave moves at exact ±45° (vx = SPEED, vy = ±SPEED) in normal mode.
// Steep mode: 45% smaller, vy = ±SPEED * tan(75°), aim 75° from horizontal.
export const STEEP_SIZE_MULT = 0.55; // 45% smaller
export const STEEP_ANGLE_RAD = (75 * Math.PI) / 180;
export const STEEP_VY_FACTOR = Math.tan(STEEP_ANGLE_RAD); // ≈ 3.732

export const AUTOMATED_BOT_MODES = new Set([
  'bot',
  'dodge-bot',
  'click-bot',
  'least-click-bot',
]);

/** Relative paths for assets (work when served from project root) */
export const SOUND_PATHS = {
  keyboardClick: 'keyboard_click.wav',
  keyboardLetGo: 'keyboard_let_go.wav',
  classicMouseClick: 'classic_mouse_click.wav',
  classicMouseLetGo: 'classic_mouse_let_go.wav',
  softMouseClick: 'soft_mouse_click.wav',
  softMouseLetGo: 'soft_mouse_let_go.wav',
  pop: 'pop.wav',
  loudHit: 'loud_hit.wav',
  clap: 'clap.wav',
  tap: 'tap.wav',
  hold: 'hold.wav',
  letGo: 'let_go.wav',
};

export const PREMADE_LEVEL_PATH = 'premade.json';
export const PREMADE_LEVELS = [
  { id: 'classic', name: 'Classic premade', path: 'premade.json' },
  { id: 'normal-wave', name: 'Normal wave level', path: 'premade_normal_wave.json' },
];


// Sprite sheet definitions (extracted from Actually Geometry Dash / real GD assets)
export const SPRITES = {
  // GJ_GameSheet.png  (2048×1762)
  sheet: 'GJ_GameSheet.png',
  // square_01_001.png 1191 317 60 60
  block: { x: 1191, y: 317, w: 60, h: 60 },
  // spike_01_001.png 1253 317 60 60
  spikeUp: { x: 1253, y: 317, w: 60, h: 60 },
  // spike_02_001.png 477 7 60 28  (half-height style spike)
  spikeDown: { x: 477, y: 7, w: 60, h: 28 },

  // gd19_icons.png for the dart / wave
  iconsSheet: 'gd19_icons.png',
  // dart_01_001.png 714 188 52 42
  wave: { x: 714, y: 188, w: 52, h: 42 },
  // dart_01_glow_001.png 780 188 56 44
  waveGlow: { x: 780, y: 188, w: 56, h: 44 },
};

export const BG_PATH = 'game_bg_01_001.png';
export const FLOOR_PATH = 'floor.png';
export const GROUND_PATH = 'groundSquare_001.png';
export const STREAK_PATH = 'streak.png';
