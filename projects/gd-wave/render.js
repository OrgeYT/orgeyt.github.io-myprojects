/** Canvas rendering */

import { TILE_SIZE, GAME_HEIGHT } from './config.js';
import { S, canvas, ctx } from './state.js';

function draw() {
    const backdrop = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    backdrop.addColorStop(0, '#0a1020');
    backdrop.addColorStop(0.52, '#10182a');
    backdrop.addColorStop(1, '#080d19');
    ctx.fillStyle = backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(0, S.GAME_Y);

    const arena = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    arena.addColorStop(0, '#101a2c');
    arena.addColorStop(0.5, '#0b1425');
    arena.addColorStop(1, '#11182b');
    ctx.fillStyle = arena;
    ctx.fillRect(0, 0, canvas.width, GAME_HEIGHT);

    const focusCamera = S.cameraFocus && S.mode !== 'edit';
    const zoom = focusCamera ? 1.45 : 1;
    const worldViewWidth = canvas.width / zoom;
    const viewCameraX = focusCamera ? S.cameraFocusX - worldViewWidth / 2 : S.cameraX;
    if (focusCamera) {
        ctx.translate(canvas.width / 2, GAME_HEIGHT / 2);
        ctx.scale(zoom, zoom);
        ctx.translate(-S.cameraFocusX, -S.cameraFocusY);
    } else {
        ctx.translate(-S.cameraX, 0);
    }

    // Subtle parallax stars keep the playfield readable while it scrolls.
    const firstStar = Math.floor(viewCameraX / 96) * 96;
    for (let x = firstStar; x < viewCameraX + worldViewWidth + 96; x += 96) {
        for (let row = 0; row < 4; row++) {
            const seed = Math.sin(x * 0.017 + row * 19.7) * 10000;
            const y = 30 + ((seed - Math.floor(seed)) * (GAME_HEIGHT - 60));
            ctx.fillStyle = row === 0 ? 'rgba(118, 222, 255, 0.32)' : 'rgba(177, 200, 255, 0.17)';
            ctx.beginPath();
            ctx.arc(x + row * 23, y, row === 0 ? 1.25 : 0.8, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    const startCol = Math.floor(viewCameraX / TILE_SIZE);
    const endCol = startCol + Math.ceil(worldViewWidth / TILE_SIZE) + 1;
    ctx.lineWidth = 1;
    ctx.strokeStyle = S.mode === 'edit' ? 'rgba(140, 198, 226, 0.12)' : 'rgba(140, 198, 226, 0.055)';
    for (let i = startCol; i <= endCol; i++) {
        ctx.beginPath();
        ctx.moveTo(i * TILE_SIZE, 0);
        ctx.lineTo(i * TILE_SIZE, GAME_HEIGHT);
        ctx.stroke();
    }
    for (let y = 0; y <= GAME_HEIGHT; y += TILE_SIZE) {
        ctx.beginPath();
        ctx.moveTo(viewCameraX, y);
        ctx.lineTo(viewCameraX + worldViewWidth, y);
        ctx.stroke();
    }

    const topEdge = ctx.createLinearGradient(0, 0, 0, 5);
    topEdge.addColorStop(0, 'rgba(75, 220, 255, 0.72)');
    topEdge.addColorStop(1, 'rgba(75, 220, 255, 0)');
    ctx.fillStyle = topEdge;
    ctx.fillRect(viewCameraX, 0, worldViewWidth, 5);
    const bottomEdge = ctx.createLinearGradient(0, GAME_HEIGHT - 5, 0, GAME_HEIGHT);
    bottomEdge.addColorStop(0, 'rgba(75, 220, 255, 0)');
    bottomEdge.addColorStop(1, 'rgba(75, 220, 255, 0.55)');
    ctx.fillStyle = bottomEdge;
    ctx.fillRect(viewCameraX, GAME_HEIGHT - 5, worldViewWidth, 5);

    const getBlockPoints = (block, bx, by) => {
        const s = TILE_SIZE;
        if (block.type === 'spike-up') return [{x: bx + s / 2, y: by}, {x: bx + s, y: by + s}, {x: bx, y: by + s}];
        if (block.type === 'spike-down') return [{x: bx + s / 2, y: by + s}, {x: bx + s, y: by}, {x: bx, y: by}];
        if (block.type === 'small-spike-up') return [{x: bx + s / 2, y: by + s / 2}, {x: bx + s, y: by + s}, {x: bx, y: by + s}];
        if (block.type === 'small-spike-down') return [{x: bx + s / 2, y: by + s / 2}, {x: bx + s, y: by}, {x: bx, y: by}];
        if (block.type === 'slightly-small-spike-up') return [{x: bx + s / 2, y: by + 10}, {x: bx + s, y: by + s}, {x: bx, y: by + s}];
        if (block.type === 'slightly-small-spike-down') return [{x: bx + s / 2, y: by + s - 10}, {x: bx + s, y: by}, {x: bx, y: by}];
        if (block.type === 'little-spike-up') return [{x: bx + s / 2, y: by + s * 0.75}, {x: bx + s, y: by + s}, {x: bx, y: by + s}];
        if (block.type === 'little-spike-down') return [{x: bx + s / 2, y: by + s * 0.25}, {x: bx + s, y: by}, {x: bx, y: by}];
        if (block.type === 'wedge' || block.type === 'slightly-shorter-wedge' || block.type === 'short-wedge') {
            const rise = block.type === 'wedge' ? s : block.type === 'slightly-shorter-wedge' ? s * 0.75 : s * 0.5;
            return [{x: bx, y: by + s}, {x: bx + s, y: by + s - rise}, {x: bx + s, y: by + s}];
        }
        return [];
    };

    for (const block of S.level) {
        if (!block) continue;
        const bx = block.x * TILE_SIZE;
        const by = block.y * TILE_SIZE;
        if (bx + TILE_SIZE < viewCameraX - 2 || bx > viewCameraX + worldViewWidth + 2) continue;

        if (block.type === 'block' || block.type === 'more-slightly-shorter-block' || block.type === 'slightly-shorter-block' || block.type === 'short-block') {
            const height = block.type === 'block' ? TILE_SIZE : block.type === 'more-slightly-shorter-block' ? TILE_SIZE - 3 : block.type === 'slightly-shorter-block' ? TILE_SIZE * 0.75 : TILE_SIZE * 0.5;
            const top = by + TILE_SIZE - height;
            const tile = ctx.createLinearGradient(bx, top, bx + TILE_SIZE, by + TILE_SIZE);
            tile.addColorStop(0, '#28516a');
            tile.addColorStop(1, '#173248');
            ctx.shadowColor = 'rgba(63, 224, 255, 0.2)';
            ctx.shadowBlur = 9;
            ctx.fillStyle = tile;
            ctx.fillRect(bx + 1, top + 1, TILE_SIZE - 2, height - 2);
            ctx.shadowBlur = 0;
            ctx.strokeStyle = 'rgba(127, 236, 255, 0.68)';
            ctx.lineWidth = 1;
            ctx.strokeRect(bx + 1.5, top + 1.5, TILE_SIZE - 3, height - 3);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
            ctx.beginPath();
            ctx.moveTo(bx + 5, top + 5);
            ctx.lineTo(bx + TILE_SIZE - 5, top + 5);
            ctx.stroke();
            continue;
        }

        const points = getBlockPoints(block, bx, by);
        if (!points.length) continue;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.closePath();
        const isWedge = block.type.includes('wedge');
        const danger = isWedge ? '#ffbd69' : '#ff7189';
        const face = ctx.createLinearGradient(bx, by, bx + TILE_SIZE, by + TILE_SIZE);
        face.addColorStop(0, isWedge ? '#f8a85f' : '#ff708b');
        face.addColorStop(1, isWedge ? '#b96652' : '#a9436e');
        ctx.shadowColor = danger;
        ctx.shadowBlur = 11;
        ctx.fillStyle = face;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255, 226, 220, 0.85)';
        ctx.lineWidth = 1.15;
        ctx.stroke();
    }

    if (S.mode !== 'edit') {
        if (!S.player.dead && S.trail.length > 1) {
            const visibleTrail = S.trail.filter(point => point.x > viewCameraX - 200);
            if (visibleTrail.length > 1) {
                const trailGradient = ctx.createLinearGradient(S.player.x - 220, 0, S.player.x + 12, 0);
                trailGradient.addColorStop(0, 'rgba(48, 162, 255, 0.08)');
                trailGradient.addColorStop(1, S.tasRecording ? '#ffd66e' : '#66f4ff');
                ctx.beginPath();
                ctx.moveTo(visibleTrail[0].x + S.player.size / 2, visibleTrail[0].y + S.player.size / 2);
                for (let i = 1; i < visibleTrail.length; i++) ctx.lineTo(visibleTrail[i].x + S.player.size / 2, visibleTrail[i].y + S.player.size / 2);
                ctx.strokeStyle = trailGradient;
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.shadowColor = S.tasRecording ? '#ffd66e' : '#4deaff';
                ctx.shadowBlur = 13;
                ctx.stroke();
                ctx.shadowBlur = 0;
            }
        }

        ctx.save();
        ctx.translate(S.player.x + S.player.size / 2, S.player.y + S.player.size / 2);
        ctx.rotate(S.player.isHolding ? -Math.PI / 4 : Math.PI / 4);
        if (!S.player.dead) {
            const radius = Math.max(7, S.player.size * 0.8);
            const wave = ctx.createLinearGradient(-radius, radius, radius, -radius);
            wave.addColorStop(0, '#45baff');
            wave.addColorStop(1, '#baffff');
            ctx.globalAlpha = S.transparentWave ? 0.72 : 1;
            ctx.beginPath();
            ctx.moveTo(radius, 0);
            ctx.lineTo(-radius, -radius * 0.78);
            ctx.lineTo(-radius * 0.3, 0);
            ctx.lineTo(-radius, radius * 0.78);
            ctx.closePath();
            ctx.shadowColor = '#49e8ff';
            ctx.shadowBlur = 17;
            ctx.fillStyle = wave;
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.strokeStyle = 'rgba(240, 255, 255, 0.9)';
            ctx.lineWidth = 1.2;
            ctx.stroke();
        } else {
            ctx.fillStyle = '#ff9b70';
            ctx.shadowColor = '#ff684f';
            ctx.shadowBlur = 18;
            ctx.beginPath();
            ctx.arc(0, 0, 10, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        if (!S.player.dead && S.showWaveHitbox) {
            ctx.strokeStyle = 'rgba(139, 244, 255, 0.85)';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.strokeRect(S.player.x, S.player.y, S.player.size, S.player.size);
            ctx.setLineDash([]);
        }
    }

    ctx.restore();
}


export { draw };
