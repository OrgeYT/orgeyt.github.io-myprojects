/** Collision helpers */

import { TILE_SIZE, GAME_HEIGHT } from './config.js';
import { S } from './state.js';

function isPointInPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function checkCollisions(px, py, size, buffer = 0) {
  if (py - buffer <= 0 || py + size + buffer >= GAME_HEIGHT) return true;

  const startX = Math.floor((px - buffer) / TILE_SIZE);
  const endX = Math.floor((px + size + buffer) / TILE_SIZE);
  const startY = Math.floor((py - buffer) / TILE_SIZE);
  const endY = Math.floor((py + size + buffer) / TILE_SIZE);

  // Original triangle hitbox (legacy wave bot physics)
  const pVertices = [
    { x: px + size + buffer, y: py + size / 2 },
    { x: px - buffer, y: py - buffer },
    { x: px - buffer, y: py + size + buffer },
  ];

  for (let x = startX; x <= endX; x++) {
    for (let y = startY; y <= endY; y++) {
      const block = S.levelGrid.get(`${x},${y}`);
      if (!block) continue;
      const bx = block.x * TILE_SIZE;
      const by = block.y * TILE_SIZE;
      let poly = [];

      if (
        block.type === 'block' ||
        block.type === 'more-slightly-shorter-block' ||
        block.type === 'slightly-shorter-block' ||
        block.type === 'short-block'
      ) {
        const height =
          block.type === 'block'
            ? TILE_SIZE
            : block.type === 'more-slightly-shorter-block'
              ? TILE_SIZE - 3
              : block.type === 'slightly-shorter-block'
                ? TILE_SIZE * 0.75
                : TILE_SIZE * 0.5;
        const top = by + TILE_SIZE - height;
        poly = [
          { x: bx, y: top },
          { x: bx + TILE_SIZE, y: top },
          { x: bx + TILE_SIZE, y: by + TILE_SIZE },
          { x: bx, y: by + TILE_SIZE },
        ];
      } else if (block.type === 'spike-up') {
        poly = [
          { x: bx + TILE_SIZE / 2, y: by },
          { x: bx + TILE_SIZE, y: by + TILE_SIZE },
          { x: bx, y: by + TILE_SIZE },
        ];
      } else if (block.type === 'spike-down') {
        poly = [
          { x: bx + TILE_SIZE / 2, y: by + TILE_SIZE },
          { x: bx + TILE_SIZE, y: by },
          { x: bx, y: by },
        ];
      } else if (block.type === 'small-spike-up') {
        poly = [
          { x: bx + TILE_SIZE / 2, y: by + TILE_SIZE / 2 },
          { x: bx + TILE_SIZE, y: by + TILE_SIZE },
          { x: bx, y: by + TILE_SIZE },
        ];
      } else if (block.type === 'small-spike-down') {
        poly = [
          { x: bx + TILE_SIZE / 2, y: by + TILE_SIZE / 2 },
          { x: bx + TILE_SIZE, y: by },
          { x: bx, y: by },
        ];
      } else if (block.type === 'slightly-small-spike-up') {
        poly = [
          { x: bx + TILE_SIZE / 2, y: by + 10 },
          { x: bx + TILE_SIZE, y: by + TILE_SIZE },
          { x: bx, y: by + TILE_SIZE },
        ];
      } else if (block.type === 'slightly-small-spike-down') {
        poly = [
          { x: bx + TILE_SIZE / 2, y: by + TILE_SIZE - 10 },
          { x: bx + TILE_SIZE, y: by },
          { x: bx, y: by },
        ];
      } else if (block.type === 'little-spike-up') {
        poly = [
          { x: bx + TILE_SIZE / 2, y: by + TILE_SIZE * 0.75 },
          { x: bx + TILE_SIZE, y: by + TILE_SIZE },
          { x: bx, y: by + TILE_SIZE },
        ];
      } else if (block.type === 'little-spike-down') {
        poly = [
          { x: bx + TILE_SIZE / 2, y: by + TILE_SIZE * 0.25 },
          { x: bx + TILE_SIZE, y: by },
          { x: bx, y: by },
        ];
      } else if (
        block.type === 'wedge' ||
        block.type === 'slightly-shorter-wedge' ||
        block.type === 'short-wedge'
      ) {
        const rise =
          block.type === 'wedge'
            ? TILE_SIZE
            : block.type === 'slightly-shorter-wedge'
              ? TILE_SIZE * 0.75
              : TILE_SIZE * 0.5;
        poly = [
          { x: bx, y: by + TILE_SIZE },
          { x: bx + TILE_SIZE, y: by + TILE_SIZE - rise },
          { x: bx + TILE_SIZE, y: by + TILE_SIZE },
        ];
      }

      // Apply object rotation (0/90/180/270) around the tile centre
      if (block.rot && poly.length) {
        const rot = block.rot % 4;
        if (rot) {
          const cx = bx + TILE_SIZE / 2;
          const cy = by + TILE_SIZE / 2;
          const cos = [1, 0, -1, 0][rot];
          const sin = [0, 1, 0, -1][rot];
          poly = poly.map((pt) => {
            const dx = pt.x - cx;
            const dy = pt.y - cy;
            return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
          });
        }
      }

      for (const p of pVertices) if (isPointInPoly(p.x, p.y, poly)) return true;
      for (const b of poly) if (isPointInPoly(b.x, b.y, pVertices)) return true;
    }
  }
  return false;
}
