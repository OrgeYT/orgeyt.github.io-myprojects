import { state } from './state.js';

export function generateLevel(levelNum) {
    let cols = 15 + levelNum * 3;
    let rows = 15 + levelNum * 3;
    let grid = Array.from({length: rows}, () => Array(cols).fill(1)); // 1 = Wall

    let x = 3;
    let y = 3;
    let startX = x, startY = y;

    // Hallway width gets narrower on later levels
    let hallRadius = Math.max(0, 2 - Math.floor(levelNum / 5));

    let steps = cols * 2 + levelNum * 4;

    // Generate main path to ensure it's solvable
    for (let i = 0; i < steps; i++) {
        // Carve area around current point
        for (let dy = -hallRadius; dy <= hallRadius; dy++) {
            for (let dx = -hallRadius; dx <= hallRadius; dx++) {
                if (y+dy > 0 && y+dy < rows-1 && x+dx > 0 && x+dx < cols-1) {
                    grid[y+dy][x+dx] = 0;
                }
            }
        }

        // Random walk biased towards bottom right
        let dirs = [[1,0], [0,1], [1,0], [0,1], [-1,0], [0,-1]];
        let d = dirs[Math.floor(Math.random() * dirs.length)];

        x += d[0];
        y += d[1];

        // Clamp to prevent walking off edge
        x = Math.max(2, Math.min(cols-3, x));
        y = Math.max(2, Math.min(rows-3, y));
    }

    // Create room for goal
    let goalX = x, goalY = y;
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            grid[goalY+dy][goalX+dx] = 0;
        }
    }
    grid[goalY][goalX] = 3; // 3 = Goal

    // Ensure start area is entirely clear
    for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
            if (startY+dy >= 0 && startY+dy < rows && startX+dx >= 0 && startX+dx < cols) {
                grid[startY+dy][startX+dx] = 0;
            }
        }
    }

    // Add hole hazards randomly on the path (skip early levels)
    let holeChance = (levelNum >= 3) ? 0.015 + (levelNum * 0.005) : 0;
    for (let r = 2; r < rows-2; r++) {
        for (let c = 2; c < cols-2; c++) {
            if (grid[r][c] === 0 && Math.random() < holeChance) {
                // Prevent placing near start/end
                let distS = Math.hypot(c-startX, r-startY);
                let distG = Math.hypot(c-goalX, r-goalY);
                if (distS > 4 && distG > 4) {
                    grid[r][c] = 2; // 2 = Hole
                }
            }
        }
    }

    return { grid, startX, startY, cols, rows };
}

export function loadLevel(level) {
    const s = state;
    const map = generateLevel(level);
    s.map = map;

    // Spawn player at center of start tile
    s.player.x = map.startX * s.TILE_SIZE + s.TILE_SIZE / 2;
    s.player.y = map.startY * s.TILE_SIZE + s.TILE_SIZE / 2;
    s.player.vx = 0;
    s.player.vy = 0;

    // Instantly snap camera to player
    s.camera.x = s.player.x - s.width / 2;
    s.camera.y = s.player.y - s.height / 2;

    s.currentLevel = level;
    s.levelText.innerText = level;
}

// Create a large empty map for free-roam playground
export function loadPlayground() {
    const s = state;
    const cols = 80;
    const rows = 60;
    const grid = Array.from({ length: rows }, () => Array(cols).fill(0)); // all floor
    // Add perimeter walls so you don't wander infinitely
    for (let c = 0; c < cols; c++) {
        grid[0][c] = 1;
        grid[rows-1][c] = 1;
    }
    for (let r = 0; r < rows; r++) {
        grid[r][0] = 1;
        grid[r][cols-1] = 1;
    }

    // Place a simple goal center so you can test reaching it
    const gx = Math.floor(cols/2);
    const gy = Math.floor(rows/2);
    grid[gy][gx] = 3;

    const map = { grid, startX: 3, startY: 3, cols, rows };
    s.map = map;

    // Spawn player near top-left
    s.player.x = map.startX * s.TILE_SIZE + s.TILE_SIZE / 2;
    s.player.y = map.startY * s.TILE_SIZE + s.TILE_SIZE / 2;
    s.player.vx = 0;
    s.player.vy = 0;

    s.camera.x = s.player.x - s.width / 2;
    s.camera.y = s.player.y - s.height / 2;

    s.levelText.innerText = '∞';
}