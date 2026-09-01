import { state } from './state.js';

export function draw() {
    const s = state;
    const ctx = s.ctx;

    // Clear screen
    ctx.fillStyle = '#808080'; // 50% dark background
    ctx.fillRect(0, 0, s.width, s.height);

    if (s.gameState === 'start') {
        requestAnimationFrame(draw);
        return;
    }

    ctx.save();
    ctx.translate(-Math.floor(s.camera.x), -Math.floor(s.camera.y));

    // 1. Draw 3D Parallax Floor Grid (Gray Grid)
    // Moves slightly slower than camera to give depth but stays snapped to TILE_SIZE
    ctx.strokeStyle = '#666666';
    ctx.lineWidth = 1;

    // Parallax factor (grid moves slower than camera)
    const PARALLAX = 0.1;

    // Compute parallax camera position and snap to TILE_SIZE to align with tile hitboxes
    let parCamX = s.camera.x * PARALLAX;
    let parCamY = s.camera.y * PARALLAX;

    // Ensure positive modulo result for consistent alignment
    let pOffX = ((parCamX % s.TILE_SIZE) + s.TILE_SIZE) % s.TILE_SIZE;
    let pOffY = ((parCamY % s.TILE_SIZE) + s.TILE_SIZE) % s.TILE_SIZE;

    // Start drawing at a snapped grid coordinate so lines line up with tiles
    let startCamX = Math.floor((s.camera.x - pOffX) / s.TILE_SIZE) * s.TILE_SIZE;
    let startCamY = Math.floor((s.camera.y - pOffY) / s.TILE_SIZE) * s.TILE_SIZE;

    ctx.beginPath();
    for (let x = startCamX; x < s.camera.x + s.width + s.TILE_SIZE; x += s.TILE_SIZE) {
        ctx.moveTo(x, s.camera.y);
        ctx.lineTo(x, s.camera.y + s.height);
    }
    for (let y = startCamY; y < s.camera.y + s.height + s.TILE_SIZE; y += s.TILE_SIZE) {
        ctx.moveTo(s.camera.x, y);
        ctx.lineTo(s.camera.x + s.width, y);
    }
    ctx.stroke();

    // 2. Draw Floor Elements (Holes & Goal)
    for (let r = 0; r < s.map.rows; r++) {
        for (let c = 0; c < s.map.cols; c++) {
            let tile = s.map.grid[r][c];
            let px = c * s.TILE_SIZE;
            let py = r * s.TILE_SIZE;

            // Frustum culling
            if (px + s.TILE_SIZE < s.camera.x || px > s.camera.x + s.width ||
                py + s.TILE_SIZE < s.camera.y || py > s.camera.y + s.height) continue;

            if (tile === 2) {
                // Hole (Deep Black Box)
                ctx.fillStyle = '#0a0a0a';
                ctx.fillRect(px + 2, py + 2, s.TILE_SIZE - 4, s.TILE_SIZE - 4);
                // Inner shadow illusion
                ctx.fillStyle = '#000000';
                ctx.fillRect(px + 8, py + 8, s.TILE_SIZE - 16, s.TILE_SIZE - 16);
            } else if (tile === 3) {
                // Goal (Green)
                ctx.fillStyle = '#22c55e';
                ctx.fillRect(px, py, s.TILE_SIZE, s.TILE_SIZE);
                ctx.strokeStyle = '#16a34a';
                ctx.lineWidth = 4;
                ctx.strokeRect(px+4, py+4, s.TILE_SIZE-8, s.TILE_SIZE-8);
            }
        }
    }

    // 3. Draw Player (Cube) and Cursor (Circle) beneath the tops of walls
    // Draw simple fading trails for cursor and player

    // Cursor trail (draw as soft stroked line fading out)
    if (s.cursorTrail && s.cursorTrail.length > 1) {
        ctx.save();
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        for (let i = 0; i < s.cursorTrail.length - 1; i++) {
            const a = s.cursorTrail[i];
            const b = s.cursorTrail[i + 1];
            const t = i / (s.cursorTrail.length - 1);
            // fade alpha from 0 to 0.85
            const alpha = (t * 0.85);
            ctx.strokeStyle = `rgba(59,130,246,${alpha})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        }
        ctx.restore();
    }

    // Player trail (smaller, darker)
    if (s.playerTrail && s.playerTrail.length > 1) {
        ctx.save();
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        for (let i = 0; i < s.playerTrail.length - 1; i++) {
            const a = s.playerTrail[i];
            const b = s.playerTrail[i + 1];
            const t = i / (s.playerTrail.length - 1);
            const alpha = (t * 0.7);
            ctx.strokeStyle = `rgba(0,0,0,${alpha * 0.6})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        }
        ctx.restore();
    }

    // Draw Player Cube
    ctx.fillStyle = s.player.color;
    ctx.fillRect(s.player.x - s.player.size/2, s.player.y - s.player.size/2, s.player.size, s.player.size);
    // Cube Bevel/Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(s.player.x - s.player.size/2, s.player.y + s.player.size/2 - 4, s.player.size, 4);
    ctx.fillRect(s.player.x + s.player.size/2 - 4, s.player.y - s.player.size/2, 4, s.player.size);

    // Draw Cursor
    ctx.beginPath();
    ctx.arc(s.cursor.x, s.cursor.y, s.cursor.radius, 0, Math.PI * 2);
    ctx.fillStyle = s.cursor.color;
    ctx.fill();
    ctx.strokeStyle = '#1e3a8a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 4. Draw 3D Walls (Extruded upwards)
    // Draw from top to bottom (y-sorting) to ensure overlapping looks correct
    for (let r = 0; r < s.map.rows; r++) {
        for (let c = 0; c < s.map.cols; c++) {
            if (s.map.grid[r][c] === 1) {
                let px = c * s.TILE_SIZE;
                let py = r * s.TILE_SIZE;

                // Frustum culling for walls (account for height)
                if (px + s.TILE_SIZE < s.camera.x || px > s.camera.x + s.width ||
                    py + s.TILE_SIZE < s.camera.y || py - s.WALL_HEIGHT > s.camera.y + s.height) continue;

                // Wall Front Face (Gray)
                ctx.fillStyle = '#a3a3a3';
                ctx.fillRect(px, py, s.TILE_SIZE, s.TILE_SIZE);

                // Wall Top Face (White)
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(px, py - s.WALL_HEIGHT, s.TILE_SIZE, s.TILE_SIZE);

                // Top Face Border
                ctx.strokeStyle = '#d4d4d4';
                ctx.lineWidth = 1;
                ctx.strokeRect(px, py - s.WALL_HEIGHT, s.TILE_SIZE, s.TILE_SIZE);
            }
        }
    }

    ctx.restore();
    requestAnimationFrame(draw);
}