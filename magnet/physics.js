/* Physics: forces, collision resolution and environment constants */
import { magnets, walls, draggingMagnet } from './entities.js';
import { roundRect, canvas } from './utils.js';

export const ENV = {
  FRICTION: 0.985,
  ANGULAR_DRAG: 0.94,
  GRAVITY: 0.45,
  BOUNCE: 0.4,
  BORDER_OFFSET: 15,
  FLOOR_HEIGHT: 60,
  PHYSICS_STEPS: 4,
  globalMagneticStrength: 1500,
  maxInfluenceDistance: 500,
  canvas // attach shared canvas so entities can reference env.canvas
};

export function updateMagneticStrength(value) {
  ENV.globalMagneticStrength = value;
  ENV.maxInfluenceDistance = 300 + (value / 8000) * 500;
}

export function resolveCollisions(canvas) {
  for (let s = 0; s < 2; s++) {
    for (let i = 0; i < magnets.length; i++) {
      const m1 = magnets[i];
      for (let j = i + 1; j < magnets.length; j++) {
        const m2 = magnets[j];
        const dx = m2.x - m1.x;
        const dy = m2.y - m1.y;
        const combinedHalfWidth = (m1.width + m2.width) / 2;
        const combinedHalfHeight = (m1.height + m2.height) / 2;

        if (Math.abs(dx) < combinedHalfWidth && Math.abs(dy) < combinedHalfHeight) {
          const overlapX = combinedHalfWidth - Math.abs(dx);
          const overlapY = combinedHalfHeight - Math.abs(dy);

          if (overlapX < overlapY) {
            const side = dx > 0 ? 1 : -1;
            const m1Inv = draggingMagnet === m1 ? 0 : 1/m1.mass;
            const m2Inv = draggingMagnet === m2 ? 0 : 1/m2.mass;
            const totalInv = m1Inv + m2Inv;
            if (totalInv > 0) {
              m1.x -= side * overlapX * (m1Inv / totalInv);
              m2.x += side * overlapX * (m2Inv / totalInv);
              m1.vx *= -ENV.BOUNCE;
              m2.vx *= -ENV.BOUNCE;
            }
          } else {
            const side = dy > 0 ? 1 : -1;
            const m1Inv = draggingMagnet === m1 ? 0 : 1/m1.mass;
            const m2Inv = draggingMagnet === m2 ? 0 : 1/m2.mass;
            const totalInv = m1Inv + m2Inv;
            if (totalInv > 0) {
              m1.y -= side * overlapY * (m1Inv / totalInv);
              m2.y += side * overlapY * (m2Inv / totalInv);
              m1.vy *= -ENV.BOUNCE;
              m2.vy *= -ENV.BOUNCE;
            }
          }
        }
      }

      for (let w of walls) {
        const m = magnets[i];
        const dx = m.x - w.x;
        const dy = m.y - w.y;
        const combinedHalfSizeX = (m.width / 2) + (w.size / 2);
        const combinedHalfSizeY = (m.height / 2) + (w.size / 2);

        if (Math.abs(dx) < combinedHalfSizeX && Math.abs(dy) < combinedHalfSizeY) {
          const overlapX = combinedHalfSizeX - Math.abs(dx);
          const overlapY = combinedHalfSizeY - Math.abs(dy);
          if (overlapX < overlapY) {
            m.x += (dx > 0 ? 1 : -1) * overlapX;
            m.vx *= -ENV.BOUNCE;
          } else {
            m.y += (dy > 0 ? 1 : -1) * overlapY;
            m.vy *= -ENV.BOUNCE;
          }
        }
      }
    }
  }
}

export function applyMagneticForces(dt) {
  const poles = [];
  magnets.forEach(m => poles.push(...m.getPoles()));
  walls.forEach(w => poles.push(...w.getPoles()));

  for (let i = 0; i < poles.length; i++) {
    for (let j = i + 1; j < poles.length; j++) {
      const p1 = poles[i]; const p2 = poles[j];
      if (p1.parent === p2.parent) continue;
      const dx = p2.x - p1.x; const dy = p2.y - p1.y;
      const d2 = dx*dx + dy*dy;
      if (d2 < 600 || d2 > ENV.maxInfluenceDistance**2) continue;
      const dist = Math.sqrt(d2);
      let isAttracting; let customStrengthMultiplier = 1;

      if (p1.type === 'OMNI' || p2.type === 'OMNI') {
        isAttracting = true; customStrengthMultiplier = 1.5;
      } else {
        isAttracting = p1.type !== p2.type;
      }

      let strength = (ENV.globalMagneticStrength * (isAttracting ? 1 : -1) * customStrengthMultiplier) / d2;
      strength = Math.max(-15, Math.min(15, strength));
      const force = strength * dt;
      const fx = (dx/dist) * force;
      const fy = (dy/dist) * force;

      if (!p1.isStatic && p1.parent !== draggingMagnet) {
        p1.parent.vx += fx / p1.parent.mass;
        p1.parent.vy += fy / p1.parent.mass;
        if (p1.parent.type === 'dipole') {
          const rx = p1.x - p1.parent.x;
          const ry = p1.y - p1.parent.y;
          p1.parent.va += (rx * fy - ry * fx) * 0.0002;
        }
      }
      if (!p2.isStatic && p2.parent !== draggingMagnet) {
        p2.parent.vx -= fx / p2.parent.mass;
        p2.parent.vy -= fy / p2.parent.mass;
        if (p2.parent.type === 'dipole') {
          const rx = p2.x - p2.parent.x;
          const ry = p2.y - p2.parent.y;
          p2.parent.va -= (rx * fy - ry * fx) * 0.0002;
        }
      }
    }
  }
}