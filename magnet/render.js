/* Rendering loop: draws scene and advances physics each frame */
import { canvas, ctx, roundRect } from './utils.js';
import { magnets, walls } from './entities.js';
import { resolveCollisions, applyMagneticForces, ENV } from './physics.js';

function drawContainment() {
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, canvas.height - ENV.FLOOR_HEIGHT, canvas.width, ENV.FLOOR_HEIGHT);
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.6)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, canvas.height - ENV.FLOOR_HEIGHT);
  ctx.lineTo(canvas.width, canvas.height - ENV.FLOOR_HEIGHT);
  ctx.stroke();

  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.strokeRect(ENV.BORDER_OFFSET, ENV.BORDER_OFFSET, canvas.width - ENV.BORDER_OFFSET*2, canvas.height - ENV.FLOOR_HEIGHT - ENV.BORDER_OFFSET);
}

export function startLoop() {
  function loop() {
    ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 1; ctx.beginPath();
    for(let x=0; x<canvas.width; x+=50) { ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); }
    for(let y=0; y<canvas.height; y+=50) { ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); }
    ctx.stroke();

    drawContainment();
    walls.forEach(w => w.draw(ctx, roundRect));

    const dt = 1.0 / ENV.PHYSICS_STEPS;
    for (let step = 0; step < ENV.PHYSICS_STEPS; step++) {
      applyMagneticForces(dt);
      resolveCollisions(canvas);
      magnets.forEach(m => m.update(dt, ENV));
    }

    magnets.forEach(m => m.draw(ctx, roundRect, 22));
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}