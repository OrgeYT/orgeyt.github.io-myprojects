const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let width = window.innerWidth;
let height = window.innerHeight;

const camera = { x: 0, y: 0 };

// Game State
let currentLevel = 1;
const MAX_LEVELS = 15;
let gameState = 'start'; // start, playing, win, gameover
let isPlayground = false; // flag when in free-roam mode

// Entities & constants
const TILE_SIZE = 60;
const WALL_HEIGHT = 40;

let map = { grid: [], startX: 0, startY: 0, cols: 0, rows: 0 };

const player = {
    x: 0, y: 0,
    vx: 0, vy: 0,
    size: 24,
    color: '#ef4444' // Red
};

// Simple trail buffers (circular queues implemented as arrays)
// Each entry: {x, y}
const playerTrail = [];
const cursorTrail = [];

// Trail settings
const TRAIL_MAX = 22; // number of samples
const TRAIL_SPACING = 1; // sample every update (can skip to make shorter trails)

const cursor = {
    x: -1000, y: -1000,
    screenX: -1000, screenY: -1000,
    lastScreenX: -1000, lastScreenY: -1000,
    vx: 0, vy: 0,
    radius: 18,
    color: 'rgba(59, 130, 246, 0.8)' // Blue
};

// UI elements
const startScreen = document.getElementById('startScreen');
const winScreen = document.getElementById('winScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const hud = document.getElementById('hud');
const levelText = document.getElementById('levelText');

// Mouse input tracking
// Track client mouse and allow TAS-paused recording to be unpaused by moving the real cursor.

// TAS / Tool-assisted speedrun support
// - tas.frames : array of {x, y} recorded as screen/client coordinates per-frame
// - tas.recording : bool while recording
// - tas.playing : bool while playing back
// - tas.playIndex : current frame index for playback
// - tas.name : optional name/label
const tas = {
    frames: [],
    recording: false,
    playing: false,
    playIndex: 0,
    name: 'tas_recording',
    paused: false // used by recording mode to freeze physics between frames
};

// Now that tas exists, the mousemove handler can safely reference it
window.addEventListener('mousemove', (e) => {
    cursor.screenX = e.clientX;
    cursor.screenY = e.clientY;

    // If we're in TAS recording paused frame-step mode, moving the cursor will unpause
    // so the player can resume the simulation immediately by moving the mouse.
    // This keeps recording active but exits the paused frame-step state.
    if (tas.recording && tas.paused) {
        tas.paused = false;
        console.log('TAS: cursor movement unpaused recording');
    }
});

export const state = {
    canvas, ctx, width, height, camera,
    currentLevel, MAX_LEVELS, gameState,
    TILE_SIZE, WALL_HEIGHT, map, player, cursor,
    // Trails and trail settings (exposed so other modules can push/read)
    playerTrail, cursorTrail, TRAIL_MAX, TRAIL_SPACING,
    startScreen, winScreen, gameOverScreen, hud, levelText,
    // TAS
    tas
};

export function setupCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    state.width = canvas.width;
    state.height = canvas.height;
}

export function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    state.width = canvas.width;
    state.height = canvas.height;
}