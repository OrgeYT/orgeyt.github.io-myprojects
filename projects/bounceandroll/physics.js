import { state } from './state.js';

function constrainCursorToWalls(targetX, targetY) {
    const s = state;
    let cx = targetX;
    let cy = targetY;
    let pCol = Math.floor(cx / s.TILE_SIZE);
    let pRow = Math.floor(cy / s.TILE_SIZE);

    for (let r = pRow - 1; r <= pRow + 1; r++) {
        for (let c = pCol - 1; c <= pCol + 1; c++) {
            if (r < 0 || r >= s.map.rows || c < 0 || c >= s.map.cols) continue;

            if (s.map.grid[r][c] === 1) {
                let wallX = c * s.TILE_SIZE;
                let wallY = r * s.TILE_SIZE;

                let testX = cx;
                let testY = cy;

                if (cx < wallX) testX = wallX;
                else if (cx > wallX + s.TILE_SIZE) testX = wallX + s.TILE_SIZE;

                if (cy < wallY) testY = wallY;
                else if (cy > wallY + s.TILE_SIZE) testY = wallY + s.TILE_SIZE;

                let distX = cx - testX;
                let distY = cy - testY;
                let distance = Math.sqrt((distX*distX) + (distY*distY));

                if (distance < s.cursor.radius) {
                    let overlap = s.cursor.radius - distance;
                    let nx = distance === 0 ? 1 : distX / distance;
                    let ny = distance === 0 ? 0 : distY / distance;

                    cx += nx * overlap;
                    cy += ny * overlap;
                }
            }
        }
    }
    return {x: cx, y: cy};
}

function checkWallCollisions() {
    const s = state;
    let halfSize = s.player.size / 2;
    let pCol = Math.floor(s.player.x / s.TILE_SIZE);
    let pRow = Math.floor(s.player.y / s.TILE_SIZE);

    // Check surrounding tiles
    for (let r = pRow - 1; r <= pRow + 1; r++) {
        for (let c = pCol - 1; c <= pCol + 1; c++) {
            if (r < 0 || r >= s.map.rows || c < 0 || c >= s.map.cols) continue;

            if (s.map.grid[r][c] === 1) { // Wall tile
                let wLeft = c * s.TILE_SIZE;
                let wRight = wLeft + s.TILE_SIZE;
                let wTop = r * s.TILE_SIZE;
                let wBottom = wTop + s.TILE_SIZE;

                let pLeft = s.player.x - halfSize;
                let pRight = s.player.x + halfSize;
                let pTop = s.player.y - halfSize;
                let pBottom = s.player.y + halfSize;

                if (pRight > wLeft && pLeft < wRight && pBottom > wTop && pTop < wBottom) {
                    let overlapLeft = pRight - wLeft;
                    let overlapRight = wRight - pLeft;
                    let overlapTop = pBottom - wTop;
                    let overlapBottom = wBottom - pTop;

                    let minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

                    if (minOverlap === overlapLeft) {
                        s.player.x -= overlapLeft;
                        s.player.vx *= -0.6;
                    } else if (minOverlap === overlapRight) {
                        s.player.x += overlapRight;
                        s.player.vx *= -0.6;
                    } else if (minOverlap === overlapTop) {
                        s.player.y -= overlapTop;
                        s.player.vy *= -0.6;
                    } else if (minOverlap === overlapBottom) {
                        s.player.y += overlapBottom;
                        s.player.vy *= -0.6;
                    }
                }
            }
        }
    }
}

function resolveCursorCollision(simMouseX, simMouseY, vX, vY) {
    // Improved swept collision response: use per-substep cursor motion and
    // push the player away along the correct normal so fast cursor movement
    // imparts a stronger, consistent impulse instead of letting the cursor
    // teleport through the square.
    const s = state;
    let halfSize = s.player.size / 2;

    // Find closest point on square to circle center
    let testX = simMouseX;
    let testY = simMouseY;

    if (simMouseX < s.player.x - halfSize) testX = s.player.x - halfSize;
    else if (simMouseX > s.player.x + halfSize) testX = s.player.x + halfSize;

    if (simMouseY < s.player.y - halfSize) testY = s.player.y - halfSize;
    else if (simMouseY > s.player.y + halfSize) testY = s.player.y + halfSize;

    // Vector from closest point on square -> circle center
    let distX = simMouseX - testX;
    let distY = simMouseY - testY;
    let distance = Math.sqrt((distX*distX) + (distY*distY));

    if (distance < s.cursor.radius) {
        // Determine collision normal pointing from square toward cursor
        let nx, ny;
        if (distance === 0) {
            nx = 1; ny = 0;
        } else {
            nx = distX / distance;
            ny = distY / distance;
        }

        // Calculate overlap (penetration)
        let overlap = s.cursor.radius - distance;

        // Resolve penetration by moving the player away from the cursor
        s.player.x += nx * overlap;
        s.player.y += ny * overlap;

        // Apply an impulse based on cursor movement per-substep and a fixed bounce
        // Use stronger impulse so quick swipes transfer momentum reliably
        const BOUNCE_STRENGTH = 6;
        const MOTION_SCALE = 2.0;
        s.player.vx += nx * BOUNCE_STRENGTH + vX * MOTION_SCALE;
        s.player.vy += ny * BOUNCE_STRENGTH + vY * MOTION_SCALE;
    }
}

function checkHazards() {
    const s = state;
    let pCol = Math.floor(s.player.x / s.TILE_SIZE);
    let pRow = Math.floor(s.player.y / s.TILE_SIZE);

    if (pRow >= 0 && pRow < s.map.rows && pCol >= 0 && pCol < s.map.cols) {
        let tile = s.map.grid[pRow][pCol];

        // Fall in hole (if center of player is inside the tile)
        if (tile === 2) {
            // Slight tolerance so you don't instantly fall if barely grazing
            let centerX = pCol * s.TILE_SIZE + s.TILE_SIZE / 2;
            let centerY = pRow * s.TILE_SIZE + s.TILE_SIZE / 2;
            let distToHoleCenter = Math.hypot(s.player.x - centerX, s.player.y - centerY);

            if (distToHoleCenter < s.TILE_SIZE * 0.4) {
                // reset current level
                document.body.style.backgroundColor = '#fca5a5';
                setTimeout(() => document.body.style.backgroundColor = '#808080', 100);

                s.player.x = s.map.startX * s.TILE_SIZE + s.TILE_SIZE / 2;
                s.player.y = s.map.startY * s.TILE_SIZE + s.TILE_SIZE / 2;
                s.player.vx = 0;
                s.player.vy = 0;
            }
        }

        // Reach Goal
        if (tile === 3) {
            s.gameState = 'win';
            s.winScreen.classList.remove('hidden');
        }
    }
}

export function update() {
    const s = state;
    if (s.gameState !== 'playing') return;

    // Camera smoothly follows player
    s.camera.x += (s.player.x - s.width / 2 - s.camera.x) * 0.08;
    s.camera.y += (s.player.y - s.height / 2 - s.camera.y) * 0.08;

    // Calculate Mouse Velocity based on screen deltas (prevents camera pan from creating false velocity)
    let dxScreen = s.cursor.screenX - s.cursor.lastScreenX;
    let dyScreen = s.cursor.screenY - s.cursor.lastScreenY;

    s.cursor.lastScreenX = s.cursor.screenX;
    s.cursor.lastScreenY = s.cursor.screenY;

    // Physics Substepping for precision (prevents fast mouse from tunneling)
    const substeps = 4;
    const dt = 1 / substeps;

    let simMouseX = (s.cursor.screenX - dxScreen) + s.camera.x;
    let simMouseY = (s.cursor.screenY - dyScreen) + s.camera.y;

    let dmx = dxScreen / substeps;
    let dmy = dyScreen / substeps;

    for (let i = 0; i < substeps; i++) {
        simMouseX += dmx;
        simMouseY += dmy;

        // Constrain cursor to walls
        let constrained = constrainCursorToWalls(simMouseX, simMouseY);
        simMouseX = constrained.x;
        simMouseY = constrained.y;

        // Friction / Damping
        s.player.vx *= Math.pow(0.95, dt);
        s.player.vy *= Math.pow(0.95, dt);

        // Velocity Cap
        const maxVel = 25;
        if (s.player.vx > maxVel) s.player.vx = maxVel;
        if (s.player.vx < -maxVel) s.player.vx = -maxVel;
        if (s.player.vy > maxVel) s.player.vy = maxVel;
        if (s.player.vy < -maxVel) s.player.vy = -maxVel;

        // Move Player
        s.player.x += s.player.vx * dt;
        s.player.y += s.player.vy * dt;

        checkWallCollisions();
        // Pass per-substep cursor motion (dmx, dmy) so fast cursor movement is handled incrementally
        resolveCursorCollision(simMouseX, simMouseY, dmx, dmy);
    }

    // Sync final cursor world pos for rendering
    s.cursor.x = simMouseX;
    s.cursor.y = simMouseY;

    // Record trails (push current positions; keep length capped)
    // Player trail: sample player center
    s.playerTrail.push({ x: s.player.x, y: s.player.y });
    if (s.playerTrail.length > s.TRAIL_MAX) s.playerTrail.shift();

    // Cursor trail: sample cursor world position
    s.cursorTrail.push({ x: s.cursor.x, y: s.cursor.y });
    if (s.cursorTrail.length > s.TRAIL_MAX) s.cursorTrail.shift();

    checkHazards();
}