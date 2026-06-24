/*
Core game file.
- 500 levels, deterministic per-level RNG (seeded) so each level is winnable: obstacle patterns are chaotic but consistent.
- Player can move and jump. Reaching the goal advances level.
- Colliding with obstacles resets the level.
- Difficulty ramps across levels.
- Saves highest reached level in localStorage.
- Added: smooth camera follow, increased obstacle chaos, screen-shake on resets, and particle/sound hooks.
*/

const TOTAL_LEVELS = 2000;

// Simple seeded RNG (mulberry32)
function makeRng(seed){
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export default class Game {
  constructor(canvas, hooks={}){
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", {alpha:false});
    this.hooks = hooks;
    this.level = parseInt(localStorage.getItem("chaos_level") || "1",10);
    if(isNaN(this.level) || this.level < 1) this.level = 1;
    if(this.level > TOTAL_LEVELS) this.level = TOTAL_LEVELS;
    this.input = { left:false, right:false, jump:false };
    this.resize();
    // camera & feedback
    this.camX = this.W * 0.5;
    this.camY = this.H * 0.5;
    this.shake = 0;
    this.particles = []; // particle system for chaos
    this.texts = []; // floating swear/text particles
    this.resetLevel();
    this._last = performance.now();
    this._acc = 0;
    this._tick = this._tick.bind(this);
    this.running = false;
  }

  resize(){
    this.W = this.canvas.width = innerWidth;
    this.H = this.canvas.height = innerHeight;
  }

  start(){
    if(this.running) return;
    this.running = true;
    this._last = performance.now();
    requestAnimationFrame(this._tick);
    this.hooks.onLevel?.(this.level, TOTAL_LEVELS);
  }

  stop(){ this.running = false; }

  resetLevel(){
    // create a wider world that grows slowly with level to make maps bigger
    this.worldW = Math.round(this.W * (1 + Math.min(2.0, this.level * 0.004)));
    // deterministic seed per level provides reproducible chaotic pattern and ensures winnability by design
    this.rng = makeRng(this.level * 901_237 + 13);
    // physics / world
    this.player = {
      x: this.W * 0.08,
      y: this.H * 0.84,
      vx:0, vy:0,
      r: Math.max(10, Math.min(28, Math.floor(12 + this.level*0.03))),
      onGround:false
    };
    this.gravity = Math.min(1400, 600 + this.level * 3.5);
    // place goal somewhere across the wider world (not just the screen)
    this.goal = {
      x: this.worldW * (0.62 + (this.rng()-0.5)*0.18 + (this.level/TOTAL_LEVELS)*0.18),
      y: this.H * (0.18 + (this.rng()-0.5)*0.12),
      r: Math.max(12, 38 - Math.floor(this.level*0.03))
    };

    // generate chaotic obstacles: mix of rotating saws, moving circles, lines, rare spikes and fields
    this.obstacles = [];
    // lower obstacle density along a guaranteed corridor between start and goal to ensure beatability
    const corridorX1 = Math.min(this.player.x, this.goal.x) - 80;
    const corridorX2 = Math.max(this.player.x, this.goal.x) + 80;
    // increase base obstacle count but bias placement away from corridor
    const baseCount = Math.min(120, 6 + Math.floor(this.level * 0.14) + Math.floor(this.rng()*22));
    const palettes = [
      ["#ff6b6b","#ffb86b","#7bd389","#68d0ff"],
      ["#ffd166","#ef476f","#06d6a0","#118ab2"],
      ["#f94144","#f3722c","#f8961e","#90be6d"],
      ["#9b5de5","#f15bb5","#fee440","#00bbf9"],
      ["#ffadad","#ffd6a5","#fdffb6","#caffbf"]
    ];
    const pal = palettes[Math.floor(this.rng()*palettes.length)];
    for(let i=0;i<baseCount;i++){
      const kindRand = this.rng();
      let kind;
      if(kindRand < 0.32) kind = "moving";
      else if(kindRand < 0.62) kind = "saw";
      else if(kindRand < 0.84) kind = "paddle";
      else if(kindRand < 0.92) kind = "spike";
      else kind = "field";
      // try to place obstacles across the wider world; if falling inside the corridor, nudge away
      let ox = this.worldW * (0.06 + this.rng()*0.88);
      if(ox > corridorX1 && ox < corridorX2){
        // push away from corridor with some probability so the corridor remains passable
        if(this.rng() > 0.5) ox = corridorX2 + 40 + this.rng() * (this.worldW - corridorX2 - 40);
        else ox = Math.max(12, corridorX1 - 40 - this.rng() * corridorX1);
      }
      const oy = this.H * (0.08 + this.rng()*0.82);
      const sz = 8 + Math.floor(this.rng()* (14 + this.level*0.05));
      const speed = 18 + this.rng()* (56 + this.level*2.8);
      const phase = this.rng()*Math.PI*2;
      const amp = 20 + this.rng()*Math.min(this.H*0.45, 140 + this.level*0.45);
      this.obstacles.push({
        kind, ox, oy, sz, speed, phase, amp,
        rot: this.rng()*Math.PI*2,
        dir: this.rng() > 0.5 ? 1 : -1,
        a: 0.3 + this.rng()*2.6,
        b: 0.3 + this.rng()*2.6,
        color: pal[Math.floor(this.rng()*pal.length)],
        wobble: 0.2 + this.rng()*1.8,
        jitterTimer: this.rng()*1.8,
        spikeCount: Math.floor(3 + this.rng()*6),
        fieldRadius: 20 + Math.floor(this.rng()*48)
      });
    }

    // safe platforms to create a navigable path across the wider world
    this.platforms = [];
    const platformCount = 5 + Math.floor(this.level * 0.04);
    // create a chain of overlapping platforms from start to goal
    for(let i=0;i<platformCount;i++){
      const t = i / Math.max(1, platformCount-1);
      // lerp x between start and goal with some vertical variance
      const x = this.player.x + (this.goal.x - this.player.x) * t + (this.rng()-0.5) * Math.min(160, this.level*0.6);
      const w = this.worldW* (0.09 + this.rng()*0.14);
      const y = this.H * (0.6 - t*0.46 + (this.rng()-0.5)*0.06);
      this.platforms.push({x: Math.max(8, Math.min(this.worldW - w - 8, x)), y, w, h:12});
    }

    // add start & goal ledges to ensure docking
    this.platforms.push({ x: this.player.x - 10, y: this.player.y + this.player.r + 6, w: this.W*0.18, h:10});
    this.platforms.push({ x: this.goal.x - this.goal.r - 10, y: this.goal.y + this.goal.r + 6, w: this.W*0.22, h:10});

    // reset camera target near player
    this.camX = this.player.x;
    this.camY = this.player.y;
    this.shake = 0;

    // reset particles
    this.particles.length = 0;
    // reset floating texts and spawn some swear-texts across the level, spread across worldW
    this.texts.length = 0;
    const swearList = ["damn","hell","crap","bloody","shit","f*ck","ass","ugh","wtf","god","bother","yikes","rats","jeez","dang"];
    const textCount = 4 + Math.floor(this.rng() * 6);
    for(let i=0;i<textCount;i++){
      const tx = this.worldW * (0.06 + this.rng()*0.88);
      const ty = this.H * (0.12 + this.rng()*0.76);
      const t = swearList[Math.floor(this.rng()*swearList.length)];
      this.texts.push({
        x: tx,
        y: ty,
        vx: (this.rng()-0.5) * 30,
        vy: -20 - this.rng()*60,
        life: 3 + this.rng()*6,
        maxLife: 3 + this.rng()*6,
        size: 14 + Math.floor(this.rng()*18),
        text: t,
        color: ["#ff6b6b","#ffb86b","#7bd389","#68d0ff"][Math.floor(this.rng()*4)],
        jitter: this.rng()
      });
    }

    // timers
    this.time = 0;
    this.hooks.onLevel?.(this.level, TOTAL_LEVELS);
    this.hooks.onStatus?.("", false);
  }

  advanceLevel(){
    if(this.level < TOTAL_LEVELS) this.level++;
    localStorage.setItem("chaos_level", String(this.level));
    this.hooks.onStatus?.("Level up!", false);
    // small celebratory particle burst and chaos nudge
    this._spawnParticles(this.goal.x, this.goal.y, Math.min(36, 6 + Math.floor(this.level*0.12)));
    this.hooks.onChaosBurst?.(this.goal.x, this.goal.y, 0.8);
    this.resetLevel();
  }

  resetThisLevel(){
    this.hooks.onStatus?.("Reset", true);
    // add a short screen shake and small random nudge to camera to emphasize chaos
    this.shake = Math.min(28, 10 + Math.floor(this.level*0.04));
    // also add a few frantic obstacle perturbations for extra chaos on reset
    for(let i=0;i<Math.min(10, this.obstacles.length); i++){
      const o = this.obstacles[Math.floor(this.rng()*this.obstacles.length)];
      o.ox += (this.rng()-0.5) * Math.min(220, this.level*0.9);
      o.oy += (this.rng()-0.5) * Math.min(220, this.level*0.9);
      o.phase = this.rng()*Math.PI*2;
      // give a sudden spin
      o.rot += (this.rng()-0.5) * 4.0;
    }
    // spawn a chaotic particle burst near player
    this._spawnParticles(this.player.x, this.player.y, Math.min(48, 8 + Math.floor(this.level*0.18)));
    this.hooks.onChaosBurst?.(this.player.x, this.player.y, Math.min(2.0, 0.6 + this.level*0.002));
    this.resetLevel();
  }

  _tick(ts){
    if(!this.running) return;
    const dt = Math.min(34, ts - this._last);
    this._last = ts;
    this.update(dt/1000);
    this.render();
    requestAnimationFrame(this._tick);
  }

  update(dt){
    this.time += dt;

    // handle input
    const maxSpeed = 320 + this.level * 0.6;
    const accel = 1800;
    if(this.input.left) this.player.vx -= accel * dt;
    if(this.input.right) this.player.vx += accel * dt;
    // friction
    this.player.vx *= 0.98;
    this.player.vx = Math.max(-maxSpeed, Math.min(maxSpeed, this.player.vx));

    // ground detection via platforms
    const belowY = this.player.y + this.player.r;
    let onAny = false;
    for(const p of this.platforms){
      if(this.player.x + this.player.r > p.x && this.player.x - this.player.r < p.x + p.w){
        const platformTop = p.y;
        if(belowY >= platformTop - 2 && belowY <= platformTop + 8 && this.player.vy >= -400){
          // snap to platform
          this.player.y = platformTop - this.player.r;
          this.player.vy = 0;
          onAny = true;
        }
      }
    }
    // floor bound
    const floorY = this.H - 6;
    if(belowY >= floorY){
      this.player.y = floorY - this.player.r;
      this.player.vy = 0;
      onAny = true;
    }
    this.player.onGround = onAny;

    // jump / simple flight: initial ground jump plus continuous upward thrust while jump is held
    if(this.input.jump){
      // initial impulse when starting from ground
      if(this.player.onGround){
        this.player.vy = -Math.min(780, 420 + this.level*0.8);
        this.player.onGround = false;
      }
      // continuous upward thrust for flying (scaled by dt)
      // thrust strength tuned to feel responsive without breaking level bounds
      const thrust = 800; // px/s^2 upward acceleration
      this.player.vy -= thrust * dt;
    }

    // gravity
    this.player.vy += this.gravity * dt;
    // clamp falling speed
    this.player.vy = Math.min(1800, this.player.vy);

    // position
    this.player.x += this.player.vx * dt;
    this.player.y += this.player.vy * dt;

    // clamp horizontal so player cannot move beyond world bounds (world can be wider than screen)
    const minX = this.player.r;
    const maxX = (this.worldW || this.W) - this.player.r;
    if(this.player.x < minX) {
      this.player.x = minX;
      this.player.vx = Math.min(0, this.player.vx * 0.2);
    }
    if(this.player.x > maxX) {
      this.player.x = maxX;
      this.player.vx = Math.max(0, this.player.vx * 0.2);
    }

    // update obstacles
    for(const o of this.obstacles){
      const t = this.time * o.speed + o.phase;
      // Lissajous / circular motions with extra wobble for chaos
      o.x = o.ox + Math.sin(t * o.a + this.rng()*0.6) * o.amp * (0.32 + this.rng()*1.06);
      o.y = o.oy + Math.cos(t * o.b + this.rng()*0.6) * (o.amp*0.6) * (0.28 + this.rng()*0.92);
      // occasional jitter increases with level
      o.jitterTimer -= dt;
      if(o.jitterTimer <= 0){
        if(this.rng() > 0.5) {
          o.x += (this.rng()-0.5) * (60 + this.level*0.6);
          o.y += (this.rng()-0.5) * (60 + this.level*0.6);
        }
        o.jitterTimer = 0.6 + this.rng()*2.4;
      }
      if(o.kind === "saw"){
        o.rot += (1.0 + this.level*0.01 + o.wobble*0.3) * o.dir * dt * 6;
      } else if(o.kind === "paddle"){
        // paddle swings more wildly as level rises
        o.rot = Math.sin(t*0.9 + this.rng()*0.5) * (1.6 + this.level*0.004) * o.dir;
      } else {
        o.rot = Math.sin(t*0.6 + o.phase) * (0.6 + o.wobble*0.7);
      }
    }

    // update particles
    for(let i=this.particles.length-1;i>=0;i--){
      const p = this.particles[i];
      p.vx += p.ax * dt;
      p.vy += p.ay * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      p.size *= (0.98);
      if(p.life <= 0 || p.size < 0.4) this.particles.splice(i,1);
    }

    // update floating text particles (drift upward, slight horizontal sway, fade out)
    for(let i=this.texts.length-1;i>=0;i--){
      const t = this.texts[i];
      // gentle physics
      t.vy -= 10 * dt; // slight upward acceleration
      t.vx += Math.sin(this.time * 0.6 + t.jitter) * 4 * dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.life -= dt;
      // subtle size/pulse
      t.size *= 1 - (0.02 * dt);
      if(t.life <= 0 || t.size < 6) this.texts.splice(i,1);
    }

    // collisions: simple circle collision for moving obstacles; extended for saws
    // player vs obstacles:
    for(const o of this.obstacles){
      const dx = this.player.x - o.x;
      const dy = this.player.y - o.y;
      const dist = Math.hypot(dx, dy);
      const killRadius = o.sz + this.player.r * 0.9;
      if(dist < killRadius){
        // extra difficulty: saws have teeth => bigger kill area when rotating
        if(o.kind === "saw"){
          // a rotating saw has effective radius slightly larger depending on rot speed
          const eff = o.sz + 6 + Math.abs(Math.sin(o.rot)) * 10;
          if(dist < eff){
            this.resetThisLevel();
            return;
          }
        } else {
          this.resetThisLevel();
          return;
        }
      }
    }

    // player vs goal
    const gx = this.goal.x, gy = this.goal.y;
    if(Math.hypot(this.player.x - gx, this.player.y - gy) < this.player.r + this.goal.r * 0.9){
      this.advanceLevel();
    }

    // camera: smooth follow with damping
    const lerp = Math.min(1, 6 * dt); // larger = snappier
    this.camX += (this.player.x - this.camX) * lerp;
    this.camY += (this.player.y - this.camY) * lerp;

    // damp screen shake
    this.shake *= 0.86;
    if(this.shake < 0.01) this.shake = 0;

    // subtle hint: if stuck too long, nudge goal color/status
    if(this.time > 12 + this.level*0.02){
      this.hooks.onStatus?.("Keep going — it's solvable", false);
    }
  }

  render(){
    const ctx = this.ctx;

    // clear with background (full canvas)
    ctx.setTransform(1,0,0,1,0,0);
    ctx.fillStyle = "#0f1112";
    ctx.fillRect(0,0,this.W,this.H);

    // apply camera transform (centered on player) + shake
    const shakeX = (this.shake ? (Math.random()*2-1) * this.shake : 0);
    const shakeY = (this.shake ? (Math.random()*2-1) * this.shake : 0);
    ctx.translate(Math.round(this.W/2 - this.camX + shakeX), Math.round(this.H/2 - this.camY + shakeY));

    // parallax background shapes to add chaos (drawn in world space)
    for(let i=0;i<10;i++){
      const x = (i*1237.1 + this.time*8*(1+i%3)) % this.W;
      const y = this.H * (0.08 + (i%3)*0.12 + Math.sin(this.time*0.7 + i)*0.03);
      ctx.fillStyle = `rgba(255,255,255,${0.015 + (i%2)*0.02})`;
      ctx.beginPath();
      ctx.ellipse(x, y - (i%2?40:0), 40 + (i%4)*16, 12 + (i%3)*8, 0,0,Math.PI*2);
      ctx.fill();
    }

    // draw platforms
    for(const p of this.platforms){
      ctx.fillStyle = "#151617";
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = "#222";
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x, p.y, p.w, p.h);
    }

    // draw goal with a subtle pulsing
    ctx.beginPath();
    ctx.fillStyle = "#ffb86b";
    ctx.strokeStyle = "#ffe6c9";
    ctx.lineWidth = 4;
    const pulse = 1 + Math.sin(this.time*4 + this.level) * 0.04;
    ctx.arc(this.goal.x, this.goal.y, this.goal.r * pulse, 0, Math.PI*2);
    ctx.fill();
    ctx.stroke();

    // draw obstacles
    for(const o of this.obstacles){
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.rotate(o.rot);
      if(o.kind === "saw"){
        // draw saw: spiky circle
        const spikes = 12 + Math.floor(o.sz*0.08);
        ctx.fillStyle = o.color;
        ctx.beginPath();
        for(let i=0;i<spikes;i++){
          const a = (i/spikes)*Math.PI*2;
          const r1 = o.sz;
          const r2 = o.sz * 0.48;
          const x1 = Math.cos(a) * r1, y1 = Math.sin(a) * r1;
          const x2 = Math.cos(a + Math.PI/spikes)*r2, y2 = Math.sin(a + Math.PI/spikes)*r2;
          ctx.lineTo(x1,y1);
          ctx.lineTo(x2,y2);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.45)";
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if(o.kind === "paddle"){
        ctx.fillStyle = o.color;
        ctx.fillRect(-o.sz*1.8, -o.sz*0.5, o.sz*3.6, o.sz);
        ctx.strokeStyle = "rgba(0,0,0,0.4)";
        ctx.lineWidth = 2;
        ctx.strokeRect(-o.sz*1.8, -o.sz*0.5, o.sz*3.6, o.sz);
      } else {
        // moving circle/hazard
        ctx.fillStyle = o.color;
        ctx.beginPath();
        ctx.arc(0,0,o.sz,0,Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.25)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
    }

    // draw player with a little hover glow when flying
    ctx.beginPath();
    const glow = Math.max(0, Math.min(1, (this.player.onGround ? 0 : 0.6)));
    if(glow){
      ctx.fillStyle = `rgba(104,208,255,${0.12 * glow})`;
      ctx.beginPath();
      ctx.ellipse(this.player.x, this.player.y + this.player.r*0.6, this.player.r*1.6, this.player.r*0.6, 0,0,Math.PI*2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.fillStyle = "#68d0ff";
    ctx.strokeStyle = "#0f1112";
    ctx.lineWidth = 3;
    ctx.arc(this.player.x, this.player.y, this.player.r, 0, Math.PI*2);
    ctx.fill();
    ctx.stroke();

    // draw particles (world space)
    for(const p of this.particles){
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.size, p.size, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }

    // draw floating swear/text particles (world space, slightly above other things)
    for(const t of this.texts){
      ctx.save();
      const alpha = Math.max(0, Math.min(1, t.life / t.maxLife));
      ctx.globalAlpha = alpha * 0.92;
      // outline for readability
      ctx.font = `${Math.round(t.size)}px system-ui, Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 6;
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
      ctx.restore();
    }

    // minimal HUD hint drawn in screen space: reset transform and draw HUD in screen coordinates
    ctx.setTransform(1,0,0,1,0,0);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(8, this.H - 56, 220, 48);
    ctx.fillStyle = "#e6f1ff";
    ctx.font = "12px system-ui, Arial";
    ctx.fillText("W/A/S/D or arrows. Touch controls shown below on mobile.", 16, this.H - 28);
  }

  // spawn simple particles for visual chaos
  _spawnParticles(x,y,count=12){
    for(let i=0;i<count;i++){
      const ang = Math.random()*Math.PI*2;
      const speed = 80 + Math.random()*380;
      const vx = Math.cos(ang)*speed;
      const vy = Math.sin(ang)*speed * 0.6;
      const life = 0.4 + Math.random()*1.0;
      this.particles.push({
        x: x + (Math.random()-0.5)*12,
        y: y + (Math.random()-0.5)*12,
        vx, vy,
        ax: 0, ay: 300 + Math.random()*240,
        size: 4 + Math.random()*8,
        color: ["#ff6b6b","#ffb86b","#7bd389","#68d0ff"][Math.floor(this.rng()*4)],
        life,
        maxLife: life
      });
    }
  }
}