/** Shared game constants */

export const TILE_SIZE = 40;
export const LEGACY_PHYSICS_HZ = 240;
export const PHYSICS_HZ = 500;
export const SPEED = 1.5 * LEGACY_PHYSICS_HZ / PHYSICS_HZ;
export const FIXED_TICK_RATE = 1000 / PHYSICS_HZ;
export const GAME_HEIGHT = 600;

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
