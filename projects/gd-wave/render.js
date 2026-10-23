/** Canvas rendering — real GD assets, full-bleed BG, smooth tilt, GD-style trail */

import {
  TILE_SIZE,
  GAME_HEIGHT,
  SPRITES,
  BG_PATH,
  FLOOR_PATH,
  GROUND_PATH,
  STREAK_PATH,
} from './config.js';
import { S, canvas, ctx } from './state.js';

// ---------------------------------------------------------------------------
// Asset loading
// ---------------------------------------------------------------------------
const images = {
  sheet: null,
  icons: null,
  bg: null,
  floor: null,
  ground: null,
  streak: null,
};

let assetsReady = false;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load ' + src));
    img.src = src;
  });
}

export async function loadAssets() {
  try {
    const [sheet, icons, bg, floor, ground, streak] = await Promise.all([
      loadImage(SPRITES.sheet),
      loadImage(SPRITES.iconsSheet),
      loadImage(BG_PATH),
      loadImage(FLOOR_PATH),
      loadImage(GROUND_PATH),
      loadImage(STREAK_PATH),
    ]);
    images.sheet = sheet;
    images.icons = icons;
    images.bg = bg;
    images.floor = floor;
    images.ground = ground;
    images.streak = streak;
    assetsReady = true;
  } catch (err) {
    console.warn('Some GD assets failed to load, falling back to procedural draw', err);
    assetsReady = false;
  }
}

loadAssets();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function drawSprite(sheet, sprite, dx, dy, dw, dh, flipY = false) {
  if (!sheet || !sprite) return false;
  ctx.save();
  if (flipY) {
    ctx.translate(dx + dw / 2, dy + dh / 2);
    ctx.scale(1, -1);
    ctx.translate(-dw / 2, -dh / 2);
    ctx.drawImage(sheet, sprite.x, sprite.y, sprite.w, sprite.h, 0, 0, dw, dh);
  } else {
    ctx.drawImage(sheet, sprite.x, sprite.y, sprite.w, sprite.h, dx, dy, dw, dh);
  }
  ctx.restore();
  return true;
}

function getSpikeScale(type) {
  // Different spike types render at different visual sizes
  switch (type) {
    case 'little-spike-up':
    case 'little-spike-down':
      return 0.45;
    case 'small-spike-up':
    case 'small-spike-down':
      return 0.62;
    case 'slightly-small-spike-up':
    case 'slightly-small-spike-down':
      return 0.78;
    case 'spike-up':
    case 'spike-down':
    default:
      return 1.0;
  }
}

function drawBlock(bx, by, height, rot = 0) {
  const h = height || TILE_SIZE;
  const top = by + TILE_SIZE - h;
  ctx.save();
  // Rotate around cell centre
  const cx = bx + TILE_SIZE / 2;
  const cy = by + TILE_SIZE / 2;
  ctx.translate(cx, cy);
  ctx.rotate((rot % 4) * Math.PI / 2);
  ctx.translate(-cx, -cy);

  if (assetsReady && images.sheet) {
    drawSprite(images.sheet, SPRITES.block, bx, top, TILE_SIZE, h);
  } else {
    ctx.fillStyle = '#4a90d9';
    ctx.fillRect(bx, top, TILE_SIZE, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.strokeRect(bx + 0.5, top + 0.5, TILE_SIZE - 1, h - 1);
  }
  ctx.restore();
}

function drawSpike(bx, by, type, pointingUp, rot = 0) {
  const scale = getSpikeScale(type);
  const size = TILE_SIZE * scale;
  const ox = bx + (TILE_SIZE - size) / 2;
  const oy = pointingUp
    ? by + (TILE_SIZE - size)
    : by;

  ctx.save();
  const cx = bx + TILE_SIZE / 2;
  const cy = by + TILE_SIZE / 2;
  ctx.translate(cx, cy);
  ctx.rotate((rot % 4) * Math.PI / 2);
  ctx.translate(-cx, -cy);

  // Base orientation from type; rot adds further 90° steps
  const flip = !pointingUp;
  if (assetsReady && images.sheet) {
    drawSprite(images.sheet, SPRITES.spikeUp, ox, oy, size, size, flip);
  } else {
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    if (pointingUp) {
      ctx.moveTo(ox + size / 2, oy);
      ctx.lineTo(ox + size, oy + size);
      ctx.lineTo(ox, oy + size);
    } else {
      ctx.moveTo(ox + size / 2, oy + size);
      ctx.lineTo(ox + size, oy);
      ctx.lineTo(ox, oy);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawWedge(bx, by, rise, rot = 0) {
  ctx.save();
  const cx = bx + TILE_SIZE / 2;
  const cy = by + TILE_SIZE / 2;
  ctx.translate(cx, cy);
  ctx.rotate((rot % 4) * Math.PI / 2);
  ctx.translate(-cx, -cy);

  ctx.fillStyle = '#5dade2';
  ctx.beginPath();
  // Default: rises toward top-right
  ctx.moveTo(bx, by + TILE_SIZE);
  ctx.lineTo(bx + TILE_SIZE, by + TILE_SIZE - rise);
  ctx.lineTo(bx + TILE_SIZE, by + TILE_SIZE);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Main draw
// ---------------------------------------------------------------------------
function draw() {
  // Full-bleed background that fills the entire canvas
  if (assetsReady && images.bg) {
    // Cover the whole screen with the GD background, parallax slightly with camera
    const scale = Math.max(canvas.width / images.bg.width, canvas.height / images.bg.height) * 1.05;
    const bgW = images.bg.width * scale;
    const bgH = images.bg.height * scale;
    const parallaxX = -((S.cameraX * 0.15) % bgW);
    const offsetY = (canvas.height - bgH) / 2;
    for (let x = parallaxX - bgW; x < canvas.width + bgW; x += bgW) {
      ctx.drawImage(images.bg, x, offsetY, bgW, bgH);
    }
    // Subtle vignette / darken so the play area and UI stay readable
    ctx.fillStyle = 'rgba(5, 8, 16, 0.45)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    const backdrop = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    backdrop.addColorStop(0, '#0a1020');
    backdrop.addColorStop(0.52, '#10182a');
    backdrop.addColorStop(1, '#080d19');
    ctx.fillStyle = backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.save();
  // Center the play strip vertically
  ctx.translate(0, S.GAME_Y);

  // Soft floor/ceiling bars so the arena still feels bounded
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.fillRect(-2000, -4, 10000, 4);
  ctx.fillRect(-2000, GAME_HEIGHT, 10000, 4);

  const focusCamera = S.cameraFocus && S.mode !== 'edit';
  const baseZoom = focusCamera ? 1.45 : 1;
  const zoom = baseZoom * S.zoom;
  const worldViewWidth = canvas.width / zoom;

  // Centre of the view in world space
  let viewCenterX, viewCenterY;
  if (focusCamera) {
    viewCenterX = S.cameraFocusX;
    viewCenterY = S.cameraFocusY;
  } else {
    // Keep the left side of the screen roughly following cameraX while zooming around the horizontal centre
    viewCenterX = S.cameraX + (canvas.width / 2) / S.zoom;
    // Vertical offset keeps the wave on-screen when zoomed in
    viewCenterY = GAME_HEIGHT / 2 + (S._viewCenterYOffset || 0);
  }
  const viewCameraX = viewCenterX - worldViewWidth / 2;

  ctx.translate(canvas.width / 2, GAME_HEIGHT / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-viewCenterX, -viewCenterY);

  // Floor & ceiling (real GD ground / floor sprites)
  {
    const floorH = 48;
    const ceilH = 40;
    // How far left/right we need to cover in world space
    const left = viewCameraX - 200;
    const right = viewCameraX + worldViewWidth + 200;
    const tileW = 90; // visual width of one ground tile

    if (assetsReady && images.ground) {
      // Ceiling strip (flipped ground)
      for (let x = Math.floor(left / tileW) * tileW; x < right; x += tileW) {
        ctx.save();
        ctx.translate(x + tileW / 2, -ceilH / 2);
        ctx.scale(1, -1);
        ctx.drawImage(images.ground, -tileW / 2, -ceilH / 2, tileW, ceilH);
        ctx.restore();
      }
      // Floor strip
      for (let x = Math.floor(left / tileW) * tileW; x < right; x += tileW) {
        ctx.drawImage(images.ground, x, GAME_HEIGHT - 4, tileW, floorH);
      }
    } else if (assetsReady && images.floor) {
      // Fallback to simple floor line texture
      const fh = 8;
      for (let x = Math.floor(left / 200) * 200; x < right; x += 200) {
        ctx.drawImage(images.floor, x, GAME_HEIGHT - fh, 200, fh);
        ctx.save();
        ctx.translate(x + 100, fh / 2);
        ctx.scale(1, -1);
        ctx.drawImage(images.floor, -100, -fh / 2, 200, fh);
        ctx.restore();
      }
    } else {
      // Procedural fallback
      ctx.fillStyle = 'rgba(40, 70, 110, 0.85)';
      ctx.fillRect(left, GAME_HEIGHT - 6, right - left, 28);
      ctx.fillRect(left, -22, right - left, 22);
      ctx.fillStyle = 'rgba(80, 140, 200, 0.35)';
      ctx.fillRect(left, GAME_HEIGHT - 6, right - left, 3);
      ctx.fillRect(left, 0, right - left, 3);
    }
  }

  // Very subtle grid
  const startCol = Math.floor((viewCameraX - 100) / TILE_SIZE);
  const endCol = startCol + Math.ceil(worldViewWidth / TILE_SIZE) + 4;
  ctx.lineWidth = 1 / zoom;
  ctx.strokeStyle = S.mode === 'edit' ? 'rgba(140, 198, 226, 0.10)' : 'rgba(140, 198, 226, 0.03)';
  for (let i = startCol; i <= endCol; i++) {
    ctx.beginPath();
    ctx.moveTo(i * TILE_SIZE, 0);
    ctx.lineTo(i * TILE_SIZE, GAME_HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y <= GAME_HEIGHT; y += TILE_SIZE) {
    ctx.beginPath();
    ctx.moveTo(viewCameraX - 200, y);
    ctx.lineTo(viewCameraX + worldViewWidth + 200, y);
    ctx.stroke();
  }

  // Level objects
  for (const b of S.level) {
    const bx = b.x * TILE_SIZE;
    const by = b.y * TILE_SIZE;

    const rot = b.rot || 0;
    if (
      b.type === 'block' ||
      b.type === 'more-slightly-shorter-block' ||
      b.type === 'slightly-shorter-block' ||
      b.type === 'short-block'
    ) {
      const height =
        b.type === 'block'
          ? TILE_SIZE
          : b.type === 'more-slightly-shorter-block'
            ? TILE_SIZE - 3
            : b.type === 'slightly-shorter-block'
              ? TILE_SIZE * 0.75
              : TILE_SIZE * 0.5;
      drawBlock(bx, by, height, rot);
    } else if (
      b.type === 'spike-up' ||
      b.type === 'small-spike-up' ||
      b.type === 'slightly-small-spike-up' ||
      b.type === 'little-spike-up'
    ) {
      drawSpike(bx, by, b.type, true, rot);
    } else if (
      b.type === 'spike-down' ||
      b.type === 'small-spike-down' ||
      b.type === 'slightly-small-spike-down' ||
      b.type === 'little-spike-down'
    ) {
      drawSpike(bx, by, b.type, false, rot);
    } else if (b.type === 'wedge' || b.type === 'slightly-shorter-wedge' || b.type === 'short-wedge') {
      const rise =
        b.type === 'wedge'
          ? TILE_SIZE
          : b.type === 'slightly-shorter-wedge'
            ? TILE_SIZE * 0.75
            : TILE_SIZE * 0.5;
      drawWedge(bx, by, rise, rot);
    }
  }

  // Placement preview ghost (editor)
  if (S.mode === 'edit' && S.previewTile) {
    const tool = (document.getElementById('tool-select') || {}).value || 'block';
    const bx = S.previewTile.x * TILE_SIZE;
    const by = S.previewTile.y * TILE_SIZE;
    const rot = S.placeRotation || 0;

    ctx.save();
    ctx.globalAlpha = 0.45;

    if (tool === 'erase') {
      ctx.strokeStyle = 'rgba(255, 80, 80, 0.9)';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx + 2, by + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      ctx.beginPath();
      ctx.moveTo(bx + 6, by + 6);
      ctx.lineTo(bx + TILE_SIZE - 6, by + TILE_SIZE - 6);
      ctx.moveTo(bx + TILE_SIZE - 6, by + 6);
      ctx.lineTo(bx + 6, by + TILE_SIZE - 6);
      ctx.stroke();
    } else if (
      tool === 'block' ||
      tool === 'more-slightly-shorter-block' ||
      tool === 'slightly-shorter-block' ||
      tool === 'short-block'
    ) {
      const height =
        tool === 'block'
          ? TILE_SIZE
          : tool === 'more-slightly-shorter-block'
            ? TILE_SIZE - 3
            : tool === 'slightly-shorter-block'
              ? TILE_SIZE * 0.75
              : TILE_SIZE * 0.5;
      drawBlock(bx, by, height, rot);
    } else if (
      tool === 'spike-up' ||
      tool === 'small-spike-up' ||
      tool === 'slightly-small-spike-up' ||
      tool === 'little-spike-up'
    ) {
      drawSpike(bx, by, tool, true, rot);
    } else if (
      tool === 'spike-down' ||
      tool === 'small-spike-down' ||
      tool === 'slightly-small-spike-down' ||
      tool === 'little-spike-down'
    ) {
      drawSpike(bx, by, tool, false, rot);
    } else if (
      tool === 'wedge' ||
      tool === 'slightly-shorter-wedge' ||
      tool === 'short-wedge'
    ) {
      const rise =
        tool === 'wedge'
          ? TILE_SIZE
          : tool === 'slightly-shorter-wedge'
            ? TILE_SIZE * 0.75
            : TILE_SIZE * 0.5;
      drawWedge(bx, by, rise, rot);
    }

    // Soft outline so the target cell is obvious
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = 'rgba(120, 230, 255, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(bx + 0.5, by + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
    ctx.setLineDash([]);
    ctx.restore();
  }

  // Ghost path from last play session (visible in editor)
  if (S.mode === 'edit' && S.lastPlayTrail && S.lastPlayTrail.length > 1) {
    const ghost = S.lastPlayTrail;
    ctx.beginPath();
    ctx.moveTo(ghost[0].x + 6, ghost[0].y + 6);
    for (let i = 1; i < ghost.length; i++) {
      ctx.lineTo(ghost[i].x + 6, ghost[i].y + 6);
    }
    ctx.strokeStyle = 'rgba(255, 214, 110, 0.35)';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([6, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // GD-style trail: short fading streak segments (looks closer to real wave trail)
  if (S.trail.length > 1 && !S.player.dead) {
    const maxTrail = 90;
    const start = Math.max(0, S.trail.length - maxTrail);
    for (let i = start; i < S.trail.length - 1; i++) {
      const a = S.trail[i];
      const b = S.trail[i + 1];
      const t = (i - start) / (S.trail.length - start);
      const alpha = 0.08 + t * 0.55;
      const width = 1.2 + t * 2.8;

      ctx.beginPath();
      ctx.moveTo(a.x + S.player.size / 2, a.y + S.player.size / 2);
      ctx.lineTo(b.x + S.player.size / 2, b.y + S.player.size / 2);
      ctx.strokeStyle = S.tasRecording
        ? `rgba(255, 214, 110, ${alpha})`
        : `rgba(120, 230, 255, ${alpha})`;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Occasional bright "spark" dots near the end of the trail (GD-ish)
    if (S.trail.length > 8) {
      for (let k = 0; k < 4; k++) {
        const idx = S.trail.length - 2 - k * 5;
        if (idx < 0) break;
        const p = S.trail[idx];
        ctx.fillStyle = `rgba(200, 250, 255, ${0.35 - k * 0.07})`;
        ctx.beginPath();
        ctx.arc(p.x + S.player.size / 2, p.y + S.player.size / 2, 1.4 - k * 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Player (wave / dart) with smooth visual tilt
  if (S.player.active || S.mode === 'edit') {
    ctx.save();
    ctx.translate(S.player.x + S.player.size / 2, S.player.y + S.player.size / 2);
    // Use the smoothed visualTilt instead of the binary angle
    ctx.rotate(S.visualTilt);

    if (!S.player.dead) {
      const scale = Math.max(0.55, S.player.size / 18);
      ctx.globalAlpha = S.transparentWave ? 0.72 : 1;

      if (assetsReady && images.icons) {
        // Glow
        const gw = SPRITES.waveGlow.w * scale * 1.15;
        const gh = SPRITES.waveGlow.h * scale * 1.15;
        ctx.globalAlpha = S.transparentWave ? 0.45 : 0.7;
        drawSprite(images.icons, SPRITES.waveGlow, -gw / 2, -gh / 2, gw, gh);
        ctx.globalAlpha = S.transparentWave ? 0.72 : 1;

        // Main dart
        const ww = SPRITES.wave.w * scale;
        const wh = SPRITES.wave.h * scale;
        drawSprite(images.icons, SPRITES.wave, -ww / 2, -wh / 2, ww, wh);
      } else {
        const radius = Math.max(7, S.player.size * 0.8);
        const wave = ctx.createLinearGradient(-radius, radius, radius, -radius);
        wave.addColorStop(0, '#45baff');
        wave.addColorStop(1, '#baffff');
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
      }
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = '#ff9b70';
      ctx.shadowColor = '#ff684f';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Hitbox viz (original triangle)
    if (!S.player.dead && S.showWaveHitbox) {
      const px = S.player.x;
      const py = S.player.y;
      const size = S.player.size;
      ctx.strokeStyle = 'rgba(139, 244, 255, 0.9)';
      ctx.lineWidth = 1.5 / zoom;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(px + size, py + size / 2);
      ctx.lineTo(px, py);
      ctx.lineTo(px, py + size);
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  ctx.restore();
}

export { draw };
