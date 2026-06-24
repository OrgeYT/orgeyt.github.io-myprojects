/* Entities: Magnet and Wall constructors, collections and simple helpers */
export const magnets = [];
export const walls = [];
export let draggingMagnet = null;

export function setDraggingMagnet(m) { draggingMagnet = m; }

export const CONFIG = {
  MAGNET_WIDTH: 100,
  MAGNET_HEIGHT: 36,
  WALL_SIZE: 60,
  MONOPOLE_RADIUS: 22
};

export class Wall {
  constructor(x, y, type) { this.x = x; this.y = y; this.type = type; this.size = CONFIG.WALL_SIZE; }
  getPoles() {
    if (this.type === 'plain') return [];
    return [{ x: this.x, y: this.y, type: this.type === 'north' ? 'N' : 'S', parent: this, isStatic: true }];
  }
  draw(ctx, roundRect) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.shadowBlur = 15;
    ctx.shadowColor = this.type === 'north' ? '#ef4444' : (this.type === 'south' ? '#3b82f6' : '#475569');
    ctx.fillStyle = this.type === 'north' ? '#ef4444' : (this.type === 'south' ? '#3b82f6' : '#475569');
    roundRect(ctx, -this.size/2, -this.size/2, this.size, this.size, 8);
    ctx.fill();
    if (this.type !== 'plain') {
      ctx.shadowBlur = 0; ctx.fillStyle = 'white'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(this.type === 'north' ? 'N' : 'S', 0, 0);
    }
    ctx.restore();
  }
}

class Magnet {
  constructor(x, y, type = 'dipole', angle = 0) {
    this.x = x; this.y = y; this.type = type; this.angle = angle;
    this.vx = 0; this.vy = 0; this.va = 0;
    this.width = (type === 'dipole') ? CONFIG.MAGNET_WIDTH : (type === 'quad' ? 70 : (type === 'lead' ? 60 : CONFIG.MONOPOLE_RADIUS * 2));
    this.height = (type === 'dipole') ? CONFIG.MAGNET_HEIGHT : (type === 'quad' ? 70 : (type === 'lead' ? 60 : CONFIG.MONOPOLE_RADIUS * 2));
    this.mass = this.calculateMass();
    this.isCircle = (type !== 'dipole' && type !== 'quad' && type !== 'lead');
  }
  calculateMass() {
    if (this.type === 'quad' || this.type === 'lead' || this.type === 'omni') return 5;
    if (this.type === 'dipole' || this.type === 'ring') return 3.5;
    return 2;
  }
  getPoles() {
    const poles = []; const cos = Math.cos(this.angle); const sin = Math.sin(this.angle);
    if (this.type === 'dipole') {
      const off = this.width / 2 - 12;
      poles.push({ x: this.x + off * cos, y: this.y + off * sin, type: 'N', parent: this });
      poles.push({ x: this.x - off * cos, y: this.y - off * sin, type: 'S', parent: this });
    } else if (this.type === 'ring') {
      const off = 12;
      poles.push({ x: this.x - off * cos, y: this.y - off * sin, type: 'N', parent: this });
      poles.push({ x: this.x + off * cos, y: this.y + off * sin, type: 'S', parent: this });
    } else if (this.type === 'quad') {
      const off = 20;
      poles.push({ x: this.x + off*cos - off*sin, y: this.y + off*sin + off*cos, type: 'N', parent: this });
      poles.push({ x: this.x - off*cos - off*sin, y: this.y - off*sin + off*cos, type: 'S', parent: this });
      poles.push({ x: this.x - off*cos + off*sin, y: this.y - off*sin - off*cos, type: 'N', parent: this });
      poles.push({ x: this.x + off*cos + off*sin, y: this.y + off*sin - off*cos, type: 'S', parent: this });
    } else if (this.type === 'lead') {
      return [];
    } else if (this.type === 'omni') {
      poles.push({ x: this.x, y: this.y, type: 'OMNI', parent: this });
    } else {
      poles.push({ x: this.x, y: this.y, type: this.type === 'north' ? 'N' : 'S', parent: this });
    }
    return poles;
  }
  update(dt, env) {
    if (draggingMagnet === this) return;
    this.vy += env.GRAVITY * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.angle += this.va * dt;
    this.vx *= Math.pow(env.FRICTION, dt);
    this.vy *= Math.pow(env.FRICTION, dt);
    this.va *= Math.pow(env.ANGULAR_DRAG, dt);

    const floorY = env.canvas.height - env.FLOOR_HEIGHT;
    const ceilY = env.BORDER_OFFSET;
    const wallL = env.BORDER_OFFSET;
    const wallR = env.canvas.width - env.BORDER_OFFSET;

    const hw = this.width / 2;
    const hh = this.height / 2;

    if (this.y + hh > floorY) {
      this.y = floorY - hh;
      this.vy *= -env.BOUNCE;
      this.vx *= 0.85;
      this.va *= 0.8;
    }
    if (this.y - hh < ceilY) { this.y = ceilY + hh; this.vy *= -env.BOUNCE; }
    if (this.x - hw < wallL) { this.x = wallL + hw; this.vx *= -env.BOUNCE; }
    if (this.x + hw > wallR) { this.x = wallR - hw; this.vx *= -env.BOUNCE; }
  }
  draw(ctx, roundRect, MONOPOLE_RADIUS) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.shadowBlur = 10; ctx.shadowColor = 'rgba(0,0,0,0.5)';
    if (this.type === 'dipole') {
      ctx.fillStyle = '#3b82f6'; roundRect(ctx, -this.width/2, -this.height/2, this.width/2, this.height, [6,0,0,6]); ctx.fill();
      ctx.fillStyle = '#ef4444'; roundRect(ctx, 0, -this.height/2, this.width/2, this.height, [0,6,6,0]); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = 'white'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign='center';
      ctx.fillText('S', -this.width/4, 5); ctx.fillText('N', this.width/4, 5);
    } else if (this.type === 'lead') {
      ctx.fillStyle = '#64748b'; roundRect(ctx, -this.width/2, -this.height/2, this.width, this.height, 4); ctx.fill();
      ctx.strokeStyle = '#475569'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'white'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign='center';
      ctx.fillText('LEAD', 0, 5);
    } else if (this.type === 'ring') {
      ctx.lineWidth = 10;
      ctx.beginPath(); ctx.arc(0,0, MONOPOLE_RADIUS, Math.PI/2, 3*Math.PI/2); ctx.strokeStyle = '#ef4444'; ctx.stroke();
      ctx.beginPath(); ctx.arc(0,0, MONOPOLE_RADIUS, 3*Math.PI/2, Math.PI/2); ctx.strokeStyle = '#3b82f6'; ctx.stroke();
    } else if (this.type === 'quad') {
      ctx.fillStyle = '#475569'; roundRect(ctx, -35, -35, 70, 70, 8); ctx.fill();
      ctx.fillStyle = 'white'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign='center';
      ctx.fillText('QUAD', 0, 5);
    } else if (this.type === 'omni') {
      ctx.fillStyle = '#94a3b8'; ctx.beginPath(); ctx.arc(0, 0, MONOPOLE_RADIUS + 2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#f1f5f9'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'white'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign='center'; ctx.fillText('G', 0, 6);
    } else {
      ctx.fillStyle = this.type === 'north' ? '#ef4444' : '#3b82f6';
      ctx.beginPath(); ctx.arc(0, 0, MONOPOLE_RADIUS, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'white'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign='center'; ctx.fillText(this.type === 'north' ? 'N' : 'S', 0, 7);
    }
    ctx.restore();
  }
}

export function spawnMagnet(type) { magnets.push(new Magnet(window.innerWidth/2, 150, type, 0)); }
export function spawnChain() {
  const centerX = window.innerWidth / 2;
  const startY = 100;
  const spacing = 46;
  const count = 8;
  for (let i = 0; i < count; i++) {
    const type = (i % 2 === 0) ? 'south' : 'north';
    const m = new Magnet(centerX, startY + (i * spacing), type);
    m.vx = 0; m.vy = 0;
    magnets.push(m);
  }
}
export function clearAll() { magnets.length = 0; walls.length = 0; }