/*
Refactored game module - contains main game logic, loop, physics, AI, level creation and state.
This file was split out from the original main.js to make the project modular.
*/

import { ensureAudioStarted, playSound, loadAllSfx } from './audio.js';
import { renderAll, syncCanvasSize } from './render.js';
import { initSpriteManager, mgrStore, spriteImgs } from './spriteManager.js';
import { NPC_NAMES } from './npcnames.js';

// reuse nipplejs import in top-level main.js previously; import dynamic here if needed
const nipplejs = (await import('nipplejs')).default;

// canvas and basic constants
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

let W = innerWidth, H = innerHeight;
let worldW = Math.max(Math.round(W * 3.6), 2000);
function resize(){
  W = innerWidth; H = innerHeight;
  worldW = Math.max(Math.round(W * 2.4), 2000);
  syncCanvasSize(canvas);
}
addEventListener('resize', resize);
resize();

// UI references
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('startBtn');
const spectateBtn = document.getElementById('spectateBtn');
const toggleCheatsBtn = document.getElementById('toggleCheatsBtn');
const unpauseBtn = document.getElementById('unpauseBtn');
const npcRange = document.getElementById('npcRange');
const npcCountLabel = document.getElementById('npcCountLabel');

const gameOverEl = document.getElementById('gameOver');
const restartBtn = document.getElementById('restartBtn');
const bombTimerEl = document.getElementById('bombTimer');
const playersLeftEl = document.getElementById('playersLeft');
const pauseBtn = document.getElementById('pauseBtn');

// joystick and input
const jumpBtn = document.getElementById('jumpBtn');
const joystickZone = document.getElementById('joystickZone');
const input = {left:false,right:false,up:false,down:false,jump:false};

// game state
let running=false;
let spectating=false;
let last = 0;
const gravity = 1100;
const MAX_JUMPS = 2;
const groundPadding = 80;

let cheatsEnabled = false;
let noclipFlyActive = false;

let camX = 0, camY = 0;
let camPanVX = 0, camPanVY = 0;
const camPanSpeed = 420;
const camLerp = 8;

class Player {
  constructor(id,name,x,y,color,isUser=false){
    this.id=id; this.name=name||`NPC ${id}`;
    this.x=x; this.y=y; this.w=44; this.h=44;
    this.vx=0; this.vy=0; this.onGround=false;
    this.jumpsLeft = MAX_JUMPS;
    this.color=color; this.isUser=isUser; this.alive=true; this.hasBomb=false;
    this.aiTimer = Math.random()*2; this._aiTargetVx = 0;
    this.recentPassed = 0; this.facingLeft = false;
    this.escapeTarget = null; this.escapeTimer = 0; this.escapeCooldown = 0;
  }
  rect(){ return {x:this.x,y:this.y,w:this.w,h:this.h}; }
  center(){ return {x:this.x+this.w/2,y:this.y+this.h/2}; }
}

const players = [];
const platforms = [];
let user = null;
let bombTimer = 0, bombDuration = 15, bombActive = false, bombHolder = null, nextGiveTimer = 2;
let gameState = 'title';
let recentOutcome = 'None';
let NPC_COUNT = 10;
// OrgeYT_Real toggle (title UI)
window.orgeRealEnabled = window.orgeRealEnabled || false;

const explosions = [];
const passAnimations = [];

function randColor(){
  // richer palette + fallback procedural HSL with higher saturation for punchy colors
  const palette = [
    '#ff4b4b','#ff8a00','#ffd60a','#00c853','#00b0ff',
    '#7c4dff','#ff4081','#00bfa5','#d500f9','#ff6d00',
    '#c62828','#2e7d32','#00695c','#0277bd','#5e35b1'
  ];
  if(Math.random() < 0.55){
    return palette[Math.floor(Math.random()*palette.length)];
  }
  const h = Math.floor(Math.random()*360);
  const s = 85 + Math.floor(Math.random()*10); // 85-94% saturation
  const l = 48 + Math.floor(Math.random()*9);  // 48-56% lightness
  return `hsl(${h} ${s}% ${l}%)`;
}

// Level generation (moved from main.js)
function makeLevel(){
  players.length = 0;
  platforms.length = 0;
  // taller overall map: push ground lower relative to viewport so there is more vertical travel room
  platforms.push({x:0, y:H-groundPadding, w:worldW, h:groundPadding});

  // responsive platform thickness and larger vertical spacing so players can "platform up" comfortably
  const small = Math.max(12, Math.min(28, Math.round(H * 0.028)));
  const midGap = Math.max(72, Math.round(H * 0.12)); // slightly larger gap for taller climbs
  const baseY = H * 0.82; // base ground moved slightly down to increase climbable height

  // denser stepping platforms across the ground band
  const stepping = [
    {x: worldW*0.03, w: 120, y: baseY},
    {x: worldW*0.12, w: 130, y: baseY - Math.round(H * 0.03)},
    {x: worldW*0.20, w: 140, y: baseY - Math.round(H * 0.06)},
    {x: worldW*0.28, w: 120, y: baseY - Math.round(H * 0.02)},
    {x: worldW*0.36, w: 150, y: baseY - Math.round(H * 0.05)},
    {x: worldW*0.44, w: 140, y: baseY - Math.round(H * 0.08)},
    {x: worldW*0.52, w: 130, y: baseY - Math.round(H * 0.04)},
    {x: worldW*0.60, w: 140, y: baseY - Math.round(H * 0.07)},
    {x: worldW*0.68, w: 120, y: baseY - Math.round(H * 0.03)},
    {x: worldW*0.76, w: 130, y: baseY - Math.round(H * 0.06)},
    {x: worldW*0.84, w: 110, y: baseY},
  ];
  for(const s of stepping) platforms.push({x: Math.max(8, s.x), y: s.y, w: s.w, h: small});

  // mid-level platforms increased in number to create chains upward
  const mids = [
    {x: worldW*0.08, w: 200, y: Math.max(H*0.56, H*0.68 - midGap*0.08)},
    {x: worldW*0.18, w: 160, y: Math.max(H*0.50, H*0.62 - midGap*0.10)},
    {x: worldW*0.30, w: 220, y: Math.max(H*0.46, H*0.58 - midGap*0.12)},
    {x: worldW*0.40, w: 180, y: Math.max(H*0.40, H*0.52 - midGap*0.14)},
    {x: worldW*0.52, w: 200, y: Math.max(H*0.36, H*0.48 - midGap*0.16)},
    {x: worldW*0.64, w: 160, y: Math.max(H*0.32, H*0.44 - midGap*0.18)},
    {x: worldW*0.76, w: 160, y: Math.max(H*0.28, H*0.40 - midGap*0.20)},
  ];
  for(const s of mids) platforms.push({x: Math.max(8, s.x), y: s.y, w: s.w, h: small});

  // more high platforms to allow real vertical progression (players can chain jumps)
  const highs = [
    {x: worldW*0.06, w: 120, y: Math.max(H*0.22, H*0.40 - midGap*0.6)},
    {x: worldW*0.22, w: 140, y: Math.max(H*0.16, H*0.34 - midGap*0.8)},
    {x: worldW*0.36, w: 140, y: Math.max(H*0.12, H*0.30 - midGap*1.0)},
    {x: worldW*0.50, w: 120, y: Math.max(H*0.08, H*0.26 - midGap*1.2)},
    {x: worldW*0.66, w: 120, y: Math.max(H*0.06, H*0.22 - midGap*1.3)},
    {x: worldW*0.82, w: 120, y: Math.max(H*0.04, H*0.18 - midGap*1.4)}
  ];
  for(const s of highs) platforms.push({x: Math.max(8, s.x), y: s.y, w: s.w, h: Math.max(10, Math.round(small*0.9))});

  // isolated short risky platforms for extra vertical hops
  platforms.push({x: worldW*0.42, y: Math.max(H*0.62, H*0.74 - midGap*0.06), w: 90, h: Math.max(10, Math.round(small*0.9))});
  platforms.push({x: worldW*0.58, y: Math.max(H*0.58, H*0.70 - midGap*0.08), w: 100, h: Math.max(10, Math.round(small*0.9))});

  // add 30 extra small/random platforms to increase vertical navigation options
  for(let i=0;i<30;i++){
    const pw = 60 + Math.round(Math.random()*120); // width 60-180
    // place mostly in upper two-thirds of the world to help vertical progression
    const py = Math.round(H*0.08 + Math.random() * (H*0.72));
    const px = Math.round(20 + Math.random() * (worldW - pw - 40));
    platforms.push({ x: px, y: py, w: pw, h: Math.max(10, Math.round(small*0.9)) });
  }

  // top wall to block going above (span worldW)
  platforms.push({x: -200, y: -48, w: worldW+400, h: 48});


  const names = NPC_NAMES.slice();

  const startY = H - groundPadding - 44 - 2;
  const namePool = names.slice();
  const chosen = [];
  const take = Math.max(2, Math.min(50, Math.floor(NPC_COUNT) || 10));
  for(let k=0;k<take && namePool.length>0;k++){
    const idx = Math.floor(Math.random() * namePool.length);
    chosen.push(namePool.splice(idx,1)[0]);
  }

  if(!chosen.includes('OrgeYT')){
    if(chosen.length > 0){
      const replaceIdx = Math.floor(Math.random() * chosen.length);
      chosen[replaceIdx] = 'OrgeYT';
    } else {
      chosen.push('OrgeYT');
    }
  } else {
    let found = false;
    for(let i = 0; i < chosen.length; i++){
      if(chosen[i] === 'OrgeYT'){
        if(!found) found = true;
        else chosen[i] = namePool.length ? namePool.splice(Math.floor(Math.random()*namePool.length),1)[0] : ('OrgeYT_'+i);
      }
    }
  }

  // If OrgeYT_Real toggle enabled, ensure exactly one NPC named "OrgeYT_Real" is present.
  if(window.orgeRealEnabled){
    if(!chosen.includes('OrgeYT_Real')){
      if(chosen.length > 0){
        let idx = Math.floor(Math.random() * chosen.length);
        if(chosen[idx] === 'OrgeYT') idx = (idx + 1) % chosen.length;
        chosen[idx] = 'OrgeYT_Real';
      } else {
        chosen.push('OrgeYT_Real');
      }
    } else {
      let found = false;
      for(let i = 0; i < chosen.length; i++){
        if(chosen[i] === 'OrgeYT_Real'){
          if(!found) found = true;
          else chosen[i] = namePool.length ? namePool.splice(Math.floor(Math.random()*namePool.length),1)[0] : ('OrgeYT_Real_'+i);
        }
      }
    }
  }

  const totalPlayers = 1 + chosen.length;
  const minSpacing = 120;
  const spacing = Math.max(minSpacing, worldW / (totalPlayers + 1));
  // small hat selection pool (some images may have red parts that we will recolor at render time)
  const HAT_POOL = [
    '/beany.png',
    '/top hat.png',
    '/traffic cone.png',
    '/santa hat.png',
    '/mini player.png',
    '/hele.png',
    '/Bomb hat.png'
  ];

  for(let i=0;i<totalPlayers;i++){
    const baseX = spacing * (i + 1);
    const jitterMax = Math.min(spacing * 0.12, 80);
    const jitter = (Math.random() * 2 - 1) * jitterMax;
    const px = Math.max(8, Math.min(worldW - 8 - 44, Math.round(baseX + jitter)));
    const isUser = (i===0 && !spectating);
    const candidateName = isUser ? (window.myUsername || 'You') : chosen[i-1];
    const color = (!isUser && candidateName === 'OrgeYT') ? '#ff8a00' : randColor();
    const name = candidateName || `NPC ${i}`;
    const p = new Player(i, name, px, startY, color, isUser);

    // Special OrgeYT_Real behavior: fast blue NPC with black beany hat and immune to bomb
    if(isUser){
      p.hat = window.selectedHat;
      p.hatColor = window.hatColor;
      // ensure the user's body color uses the saved preview/player color
      p.color = window.playerPreviewColor || p.color;
    } else if(!isUser && p.name === 'OrgeYT_Real'){
      p.color = '#00b0ff';
      p.hat = '/beany.png';
      p.hatColor = '#000000';
      p.cannotGetBomb = true;
      p.fast = true;
    } else if(!isUser && Math.random() < 0.75){
      // randomly assign a hat to other NPCs; 75% chance
      p.hat = HAT_POOL[Math.floor(Math.random() * HAT_POOL.length)];
      p.hatColor = randColor();
    } else {
      p.hat = null;
      p.hatColor = null;
    }

    // assign NPC type for non-user players using new rarity: 3% Pro, 12% Noob, 85% Average
    if(!isUser){
      const r = Math.random();
      if(r < 0.03){
        p.npcType = 'pro';
        p.fast = true;
      } else if(r < 0.15){
        p.npcType = 'noob';
      } else {
        p.npcType = 'average';
      }
    } else {
      p.npcType = p.npcType || 'average';
    }

    players.push(p);
    if(isUser) user = p;
  }

  // Ensure at least one NPC of each skill type (noob, pro, average) exists among non-user NPCs.
  (function ensureNpcTypeDiversity(){
    const npcs = players.filter(pp => !pp.isUser);
    if(npcs.length === 0) return;
    const has = { noob: false, pro: false, average: false };
    for(const n of npcs){
      has[n.npcType || 'average'] = true;
    }
    const missing = Object.keys(has).filter(k => !has[k]);
    for(const m of missing){
      const candidates = npcs.filter(x => !x.cannotGetBomb && x.name !== 'OrgeYT' && x.name !== 'OrgeYT_Real');
      const pool = candidates.length ? candidates : npcs;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      if(!pick) continue;
      pick.npcType = m;
      if(m === 'pro'){
        pick.fast = pick.fast || true;
      }
      if(m === 'noob'){
        pick.fast = false;
      }
    }
  })();

  if(user){
    camX = user.x - W/2;
    camY = user.y - H/2;
  } else {
    camX = worldW/2 - W/2;
    camY = 0;
  }
}

// minimal audio and sprite preloads
await loadAllSfx({
  jump: '/freesound_community-cartoon-jump-6462.mp3',
  land: '/freesound_community-land2-43790.mp3',
  explode: '/freesound_community-medium-explosion-40472.mp3',
  win: '/scratchonix-victory-chime-366449.mp3'
});

// joystick + controls (simplified, moved from original)
jumpBtn.addEventListener('pointerdown',()=>{
  input.jump=true;
  setTimeout(()=>input.jump=false,150);
});
const joystick = nipplejs.create({
  zone: joystickZone,
  mode: 'static',
  position: { left: '80px', bottom: '80px' },
  color: '#fff',
  size: 110,
  multitouch: false
});
joystick.on('start', () => {});
joystick.on('move', (evt, data) => {
  if(!data) return;
  const angle = data.angle && data.angle.degree !== undefined ? data.angle.degree : 0;
  const dist = data.distance || 0;
  const TH = 8;
  if(dist < TH){
    input.left = input.right = input.up = input.down = false;
    return;
  }
  const rad = angle * Math.PI / 180;
  const nx = Math.cos(rad);
  const ny = Math.sin(rad);
  if(nx > 0.25){ input.right = true; input.left = false; }
  else if(nx < -0.25){ input.left = true; input.right = false; }
  else { input.left = input.right = false; }
  if(ny < -0.25){ input.up = true; input.down = false; }
  else if(ny > 0.25){ input.down = true; input.up = false; }
  else { input.up = input.down = false; }
});
joystick.on('end', () => { input.left = input.right = false; });


// Input keyboard bindings (kept concise)
addEventListener('keydown',(e)=>{
  if(e.key==='a' || e.key==='ArrowLeft') input.left=true;
  if(e.key==='d' || e.key==='ArrowRight') input.right=true;
  if(e.key==='w' || e.key==='ArrowUp') {
    if(spectating) input.up = true;
    else { input.jump=true; setTimeout(()=>input.jump=false,150); }
  }
  if(e.key==='s' || e.key==='ArrowDown') {
    if(spectating) input.down = true;
  }
  if(e.key===' ' && !spectating) { input.jump=true; setTimeout(()=>input.jump=false,150); }

  if((e.key === 'f' || e.key === 'F') && cheatsEnabled){
    noclipFlyActive = !noclipFlyActive;
    bombTimerEl.classList.remove('hidden');
    bombTimerEl.textContent = noclipFlyActive ? 'FLY' : 'NOCLIP OFF';
    setTimeout(()=>{ if(!bombActive) bombTimerEl.classList.add('hidden'); }, 1200);
  }

  if(e.key === 'Escape'){
    if(paused) resumeGame();
    else if(gameState === 'playing') pauseGame(false);
  }
});
addEventListener('keyup',(e)=>{
  if(e.key==='a' || e.key==='ArrowLeft') input.left=false;
  if(e.key==='d' || e.key==='ArrowRight') input.right=false;
  if(e.key==='w' || e.key==='ArrowUp') input.up=false;
  if(e.key==='s' || e.key==='ArrowDown') input.down=false;
});

// physics helpers (copied)
function collideRect(a,b){ return !(a.x+a.w < b.x || a.x > b.x+b.w || a.y+a.h < b.y || a.y > b.y+b.h); }
function resolvePlatform(p, dt){
  p.onGround = false;
  for(const plat of platforms){
    if(!(p.x + p.w > plat.x && p.x < plat.x + plat.w)) continue;
    const prevY = p.y - p.vy * dt;
    const prevBottom = prevY + p.h;
    const currBottom = p.y + p.h;
    if(prevBottom <= plat.y && currBottom >= plat.y && p.vy >= -50){
      p.y = plat.y - p.h; p.vy = 0; p.onGround = true; continue;
    }
    const penetration = currBottom - plat.y;
    if(penetration > 0 && penetration < Math.max(60, p.h * 1.5) && (p.y < plat.y + plat.h)){
      const playerCenterY = p.y + p.h * 0.5;
      if(playerCenterY <= plat.y + plat.h * 0.5 && p.vy >= -400){
        p.y = plat.y - p.h; p.vy = 0; p.onGround = true; continue;
      }
    }
  }
}

function platformUnder(player){
  const cx = player.x + player.w/2;
  let best = null;
  for(const plat of platforms){
    if(cx >= plat.x - 4 && cx <= plat.x + plat.w + 4){
      if(plat.y >= player.y + player.h - 2){
        if(!best || plat.y < best.y) best = plat;
      }
    }
  }
  return best;
}
function nearestPlatformTo(x,y,maxDist=600){
  let best=null,bestD=Infinity;
  for(const plat of platforms){
    const px = Math.max(plat.x, Math.min(x, plat.x + plat.w));
    const py = plat.y;
    const d = Math.hypot(px-x,py-y);
    if(d < bestD && d < maxDist){ bestD = d; best = plat; }
  }
  return best;
}

// AI moved here (kept intact but localized)
function updateAI(p, dt){
  p.aiTimer -= dt;
  if(p.aiTimer <= 0){
    p.aiTimer = 0.4 + Math.random()*1.1;
    if(!p.hasBomb && !bombHolder){
      const dir = Math.random()*2-1; p._aiTargetVx = dir * 120;
      if(Math.random() < 0.25) p._aiTargetVx = 0;
    }
    if(Math.random() < 0.15 && p.onGround){ p.vy = -480; playSound('jump', 0.45); }
  }

  // SPECIAL BEHAVIOR: OrgeYT_Real prioritizes jumping onto bomb-holder's head when possible
  if(p.name === 'OrgeYT_Real' && !p.hasBomb && bombHolder && bombHolder.alive && bombHolder !== p){
    // move aggressively toward bomb holder
    const bx = bombHolder.x + bombHolder.w/2;
    const px = p.x + p.w/2;
    const dx = bx - px;
    p._aiTargetVx = (dx > 0) ? 260 : -260;
    // If on ground and horizontally close, attempt a high jump to land on top of the bomb holder
    const absDx = Math.abs(dx);
    const verticalGap = (bombHolder.y - p.y);
    // prefer jumping when below or same level and within ~80px horizontally
    if(p.onGround && absDx < 100 && verticalGap >= -40){
      p.vy = -620; // strong jump to reach head
      playSound('jump', 0.45);
    }
    // small smoothing and early return to keep behavior focused
    let targetVx = (p._aiTargetVx||0);
    if(p.fast) targetVx *= 1.6;
    const t = 10 * dt;
    p.vx += (targetVx - p.vx) * t;
    return;
  }

  if(p.hasBomb){
    let target = null, best = Infinity;
    for(const other of players){
      if(other === p || !other.alive) continue;
      if(other.recentPassed > 0) continue;
      const d = Math.abs((other.x + other.w/2) - (p.x + p.w/2));
      if(d < best){ best = d; target = other; }
    }
    if(target){
      const targPlat = platformUnder(target) || nearestPlatformTo(target.x+target.w/2,target.y);
      const myPlat = platformUnder(p);
      if(targPlat && !p.onGround){
        p._aiTargetVx = ((target.x + target.w/2) > (p.x + p.w/2)) ? 220 : -220;
      } else if(targPlat && myPlat && targPlat.y < myPlat.y - 8){
        p._aiTargetVx = ((targPlat.x + targPlat.w/2) > (p.x + p.w/2)) ? 200 : -200;
        if(p.onGround && Math.abs((targPlat.x + targPlat.w/2) - (p.x + p.w/2)) < 220){
          p.vy = -540; playSound('jump', 0.45);
        }
      } else {
        p._aiTargetVx = (target.x > p.x) ? 240 : -240;
        if(best < 64 && p.onGround && Math.random() < 0.6){ p.vy = -480; playSound('jump', 0.45); }
      }
    } else p._aiTargetVx = (Math.random()*2-1) * 80;
  } else {
    if(bombHolder && bombHolder.alive && bombHolder !== p){
      if(p.escapeCooldown > 0) p.escapeCooldown = Math.max(0, p.escapeCooldown - dt);
      if(p.escapeTimer > 0) p.escapeTimer = Math.max(0, p.escapeTimer - dt);
      if(p.escapeTarget && p.escapeTimer > 0){
        const plat = p.escapeTarget;
        p._aiTargetVx = ((plat.x + plat.w/2) > (p.x + p.w/2)) ? 200 : -200;
        const dxToPlat = Math.abs((plat.x + plat.w/2) - (p.x + p.w/2));
        const heightDiff = (plat.y - p.h) - p.y;
        if(p.onGround && heightDiff < -6 && Math.abs(dxToPlat) < 140){ p.vy = -540; }
        if(p.x + p.w/2 > plat.x - 8 && p.x + p.w/2 < plat.x + plat.w + 8 && p.onGround){
          p.escapeTimer = 0; p.escapeTarget = null; p.escapeCooldown = 1.5;
        }
      } else {
        if(p.escapeCooldown <= 0){
          const ch = bombHolder;
          let bestScore = -Infinity, bestPlat = null;
          for(const plat of platforms){
            if(plat.h > 40) continue;
            const platCenterX = plat.x + plat.w/2;
            const dxFromMe = platCenterX - (p.x + p.w/2);
            const dxFromChaser = platCenterX - (ch.x + ch.w/2);
            const verticalGain = (p.y - plat.y);
            const horizontalBenefit = Math.abs(dxFromChaser) - Math.abs(dxFromMe);
            const reachCost = Math.abs(dxFromMe) / 220 + Math.max(0, (p.y - plat.y) / 240);
            const score = (verticalGain * 0.95) + (horizontalBenefit * 0.7) - (reachCost * 2.3) + (Math.random()-0.5)*0.6;
            if(score > bestScore && Math.abs(dxFromMe) < 420 && verticalGain > -70){ bestScore = score; bestPlat = plat; }
          }
          if(bestPlat){
            p.escapeTarget = bestPlat; p.escapeTimer = 2.2 + Math.random()*1.4; p.escapeCooldown = 3.0;
            const dir = Math.sign((p.x + p.w/2) - (bombHolder.x + bombHolder.w/2)) || -1;
            p._aiTargetVx = dir * 160;
            if(p.onGround && bestPlat.y < p.y - 10){ p.vy = -540; playSound('jump'); }
          } else {
            const dx = (p.x + p.w/2) - (bombHolder.x + bombHolder.w/2);
            const dir = Math.sign(dx) || (Math.random() < 0.5 ? -1 : 1);
            p._aiTargetVx = dir * 200;
            if(Math.abs(dx) < 140 && p.onGround && Math.random() < 0.35){ p.vy = -480; playSound('jump', 0.45); }
          }
        } else {
          const dx = (p.x + p.w/2) - (bombHolder.x + bombHolder.w/2);
          const dir = Math.sign(dx) || (Math.random() < 0.5 ? -1 : 1);
          p._aiTargetVx = dir * 180;
          if(Math.abs(dx) < 140 && p.onGround && Math.random() < 0.25){ p.vy = -440; playSound('jump', 0.45); }
        }
      }
    }
  }
  let targetVx = (p._aiTargetVx||0);
  // skill adjustments: pros are skilled (better jumps/decisions) but use the same walk speed as average;
  // noobs remain slower. 'fast' flag still grants a moderate extra multiplier.
  let speedMult = 1.0;
  if(p.npcType === 'pro') speedMult = 1.0; // no walk speed advantage for pros
  else if(p.npcType === 'noob') speedMult = 0.72;
  if(p.fast) speedMult = Math.min(1.35, speedMult * 1.15);
  targetVx *= speedMult;
  const t = 10 * dt;
  p.vx += (targetVx - p.vx) * t;
}

// game flow methods (giveBomb, transfer, explode, teleport) kept and slightly adapted
function giveBomb(player){
  if(!player || !player.alive || player.recentPassed > 0){
    const alive = players.filter(p=>p.alive && p.recentPassed <= 0);
    if(alive.length === 0){
      const any = players.filter(p=>p.alive);
      if(any.length === 0){ nextGiveTimer = 1; return; }
      player = any[Math.floor(Math.random()*any.length)];
    } else player = alive[Math.floor(Math.random()*alive.length)];
  }
  player.hasBomb = true; bombHolder = player; bombActive = true; bombTimer = bombDuration; nextGiveTimer = 0;
  bombTimerEl.classList.remove('hidden');
}
function transferBomb(from,to){
  if(!from.hasBomb) return;
  if(to.recentPassed > 0) return;
  if(to.cannotGetBomb) return;
  const fx = from.x + from.w/2;
  const fy = from.y - 18;
  const tx = to.x + to.w/2;
  const ty = to.y - 18;
  const travel = { x0:fx,y0:fy,x1:tx,y1:ty,t:0,life:0.36, trail: Array.from({length:8}, ()=>({x:0,y:0,vx:(Math.random()*2-1)*30,vy:(Math.random()*2-1)*20,r:3+Math.random()*3,alpha:1})) };
  passAnimations.push(travel);
  from.hasBomb = false; from.recentPassed = 3.0; from.isGiving = true;
  to.isGetting = true; bombHolder = null; bombTimerEl.classList.add('hidden');
  travel.toPlayer = to; travel.fromPlayer = from;
}
function explodeBomb(){
  if(bombHolder){
    const bx = bombHolder.x + bombHolder.w / 2;
    const by = bombHolder.y + bombHolder.h / 2;
    if(bombHolder.isUser){
      playSound('explode'); spawnExplosion(bx,by); recentOutcome = 'You exploded'; endGame('You got BOOMED!');
    } else {
      playSound('explode'); spawnExplosion(bx,by);
      bombHolder.alive = false; bombHolder.hasBomb = false;
      bombActive = false; bombHolder = null; bombTimer = 0; nextGiveTimer = 2;
      bombTimerEl.classList.add('hidden');
      const aliveNPC = players.filter(p=>p.alive && !p.isUser);
      if(aliveNPC.length === 0){ recentOutcome = 'You won'; endGame('You Win! All NPCs eliminated.'); return; }
    }
  }
}
function teleportToSafe(p){
  const ground = platforms.find(pl=>pl.h > 40) || platforms[0];
  if(!ground) return;
  p.x = Math.max(16, Math.min(W - p.w - 16, W/2 + (Math.random()-0.5)*220));
  p.y = ground.y - p.h - 2; p.vx = 0; p.vy = 0; p.alive = true; p.onGround = true;
  // restore double-jump allowance when teleported to safe spot
  p.jumpsLeft = MAX_JUMPS;
  if(p.hasBomb){ p.hasBomb = false; bombActive = false; bombHolder = null; bombTimer = 0; nextGiveTimer = 1.2; bombTimerEl.classList.add('hidden'); }
}
function spawnExplosion(x,y){
  const e = { x,y,t:0, life:0.9 + Math.random()*0.3, particles: Array.from({length:12 + Math.floor(Math.random()*8)}, ()=>{ const angle = Math.random()*Math.PI*2; const speed = 120 + Math.random()*220; return {x:0,y:0,vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed*0.7 - 60, r:4+Math.random()*5, color: Math.random() < 0.5 ? '#ffb86b' : '#ff6b6b'}); } };
  explosions.push(e);
}

// loop
let dt = 0;
function loop(now){
  if(!running) return;
  dt = Math.min(1/30, (now - last)/1000);
  last = now;
  if(gameState!=='playing') return;

  if(!bombActive){
    nextGiveTimer -= dt;
    if(nextGiveTimer <= 0){
      const alive = players.filter(p=>p.alive && !p.cannotGetBomb);
      const pool = alive.length ? alive : players.filter(p=>p.alive);
      if(pool.length === 0){ endGame('All NPCs eliminated'); return; }
      const rnd = pool[Math.floor(Math.random()*pool.length)];
      giveBomb(rnd);
    }
  } else {
    bombTimer -= dt;
    if(bombTimer <= 0) explodeBomb();
  }

  for(const p of players.filter(pp=>pp.alive)){
    if(p.recentPassed > 0) p.recentPassed = Math.max(0, p.recentPassed - dt);

    if(p.isUser){
      if(cheatsEnabled && noclipFlyActive){
        const flySpeed = 320;
        if(input.left) p.vx = -flySpeed; else if(input.right) p.vx = flySpeed; else p.vx = 0;
        if(input.up) p.vy = -flySpeed; else if(input.down) p.vy = flySpeed; else p.vy = 0;
        p.x += p.vx * dt; p.y += p.vy * dt;
      } else {
        const speed = 240;
        if(input.left) p.vx = -speed; else if(input.right) p.vx = speed; else p.vx = 0;
        // Double-jump handling: consume the jump input once so it doesn't retrigger across frames.
        if(input.jump){
          if(p.onGround){
            // ground jump: launch and reserve remaining air-jumps
            p.vy = -520;
            p.onGround = false;
            p.jumpsLeft = Math.max(0, MAX_JUMPS - 1);
          } else if(typeof p.jumpsLeft === 'number' && p.jumpsLeft > 0){
            // mid-air jump (double-jump)
            p.vy = -480;
            p.jumpsLeft = Math.max(0, p.jumpsLeft - 1);
          }
          // consume input immediately so a brief input only triggers one jump action
          input.jump = false;
        }
        p.vy += gravity * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      }
    } else {
      updateAI(p, dt);
      p.vy += gravity * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    }

    if(p.vx < -10) p.facingLeft = true; else if(p.vx > 10) p.facingLeft = false;

    if(p.isUser && cheatsEnabled && noclipFlyActive){
      p.x = Math.max(-220, Math.min(worldW- p.w + 220, p.x));
      p.y = Math.max(-H, Math.min(H*1.5, p.y));
    } else {
      if(p.x < 4) { p.x = 4; p.vx = Math.max(0, p.vx); }
      if(p.x + p.w > worldW-4) { p.x = worldW-4-p.w; p.vx = Math.min(0, p.vx); }
      if(p.y < -120) teleportToSafe(p);
      if(p.y > H + 200) teleportToSafe(p);
    }

    const wasOnGround = !!p.onGround;
    if(!(p.isUser && cheatsEnabled && noclipFlyActive)){
      resolvePlatform(p, dt);
      if(!wasOnGround && p.onGround){
        // landed: restore double-jump allowance
        p.jumpsLeft = MAX_JUMPS;
        playSound('land', 0.45);
      }
    } else p.onGround = false;
  }

  const live = players.filter(p=>p.alive);
  for(let i=0;i<live.length;i++){
    for(let j=i+1;j<live.length;j++){
      const a = live[i], b = live[j];
      if(collideRect(a.rect(), b.rect())){
        if(a.hasBomb && !b.hasBomb) transferBomb(a,b);
        else if(b.hasBomb && !a.hasBomb) transferBomb(b,a);

        const ax1 = a.x, ax2 = a.x + a.w, bx1 = b.x, bx2 = b.x + b.w;
        const ay1 = a.y, ay2 = a.y + a.h, by1 = b.y, by2 = b.y + b.h;
        const overlapX = Math.min(ax2, bx2) - Math.max(ax1, bx1);
        const overlapY = Math.min(ay2, by2) - Math.max(ay1, by1);

        if(overlapX > 0 && overlapY > 0){
          if(overlapX < overlapY){
            const push = overlapX/2 + 0.5;
            if(a.x < b.x){ a.x -= push; b.x += push; } else { a.x += push; b.x -= push; }
            const vxShare = (a.vx - b.vx) * 0.2; a.vx -= vxShare; b.vx += vxShare;
          } else {
            const push = overlapY/2 + 0.5;
            if(a.y < b.y){ a.y -= push; b.y += push; a.onGround = true; a.vy = Math.min(a.vy,0); }
            else { a.y += push; b.y -= push; b.onGround = true; b.vy = Math.min(b.vy,0); }
          }
        }
      }
    }
  }

  if(spectating){
    let vx = 0, vy = 0;
    if(input.left) vx -= 1;
    if(input.right) vx += 1;
    if(input.up) vy -= 1;
    if(input.down) vy += 1;
    const mag = Math.hypot(vx, vy) || 1;
    camPanVX = (vx / mag) * camPanSpeed;
    camPanVY = (vy / mag) * camPanSpeed;
    camX += camPanVX * dt; camY += camPanVY * dt;
    // allow spectating camera to go anywhere (no world clamps)
  } else {
    const unclampedGoalX = user.x - W/2;
    const unclampedGoalY = user.y - H/2;
    // follow user without clamping so camera can move anywhere
    const goalX = unclampedGoalX;
    const goalY = unclampedGoalY;
    camX += (goalX - camX) * Math.min(1, camLerp * dt);
    camY += (goalY - camY) * Math.min(1, camLerp * dt);
  }

  // hand off to renderer module
  renderAll({
    ctx, canvas, players, platforms, explosions, passAnimations,
    camX, camY, W, H, worldW, bombTimer, spriteImgs, mgrStore, user
  });

  playersLeftEl.textContent = `Players: ${players.filter(p=>p.alive).length}`;
  if(bombActive){ bombTimerEl.classList.remove('hidden'); bombTimerEl.textContent = Math.ceil(bombTimer); }
  else bombTimerEl.classList.add('hidden');

  const aliveNPC = players.filter(p=>p.alive && !p.isUser);
  if(spectating && aliveNPC.length === 1){
    playSound('win');
    recentOutcome = 'NPC won';
    endGame(`${aliveNPC[0].name} wins!`);
    return;
  }

  requestAnimationFrame(loop);
}

// public controls to start/stop
function startGame(){
  makeLevel();
  bombActive=false; bombHolder=null; bombTimer=0; nextGiveTimer=2; gameState='playing';
  overlay.classList.add('hidden'); gameOverEl.classList.add('hidden'); running=true; last = performance.now();
  playersLeftEl.textContent = `Players: ${players.filter(p=>p.alive).length}`;
  requestAnimationFrame(loop);
}
function endGame(text){
  gameState = 'title'; running = false;
  overlay.classList.remove('hidden'); gameOverEl.classList.add('hidden');
  const card = overlay.querySelector('.card');
  if(card){ const h1 = card.querySelector('h1'); if(h1) h1.textContent = 'Pass The Bomb'; const label = card.querySelector('#npcCountLabel'); const range = card.querySelector('#npcRange'); if(label && range){ range.value = NPC_COUNT; label.textContent = range.value; } }
  try{ const recentEl = document.getElementById('recentLabel'); if(recentEl) recentEl.textContent = recentOutcome || 'None'; }catch(e){}
  bombTimerEl.classList.add('hidden'); if(unpauseBtn) unpauseBtn.classList.add('hidden');
  pauseBtn.classList.remove('paused'); pauseBtn.textContent = 'Pause';
}

startBtn.onclick = ()=>{ NPC_COUNT = npcRange ? Math.max(2, Math.min(50, parseInt(npcRange.value)||10)) : 10; spectating=false; startGame(); };
restartBtn.onclick = ()=>{ NPC_COUNT = npcRange ? Math.max(2, Math.min(50, parseInt(npcRange.value)||10)) : 10; spectating=false; startGame(); };
spectateBtn.onclick = ()=>{ NPC_COUNT = npcRange ? Math.max(2, Math.min(20, parseInt(npcRange.value)||10)) : 10; spectating=true; makeLevel(); if(players[0]) players[0].isUser=false; bombActive=false; bombHolder=null; bombTimer=0; nextGiveTimer=2; gameState='playing'; overlay.classList.add('hidden'); gameOverEl.classList.add('hidden'); running=true; last=performance.now(); camX = Math.max(0, Math.min(worldW - W, worldW/2 - W/2)); camY = 0; camPanVX = camPanVY = 0; requestAnimationFrame(loop); };

let paused=false, autoPaused=false;
function pauseGame(auto=false){ if(paused) return; paused=true; autoPaused=!!auto; running=false; pauseBtn.classList.add('paused'); pauseBtn.textContent='Resume'; overlay.classList.remove('hidden'); overlay.querySelector('.card').querySelector('h1').textContent='Paused'; if(unpauseBtn) unpauseBtn.classList.remove('hidden'); }
function resumeGame(){ if(!paused) return; paused=false; autoPaused=false; pauseBtn.classList.remove('paused'); pauseBtn.textContent='Pause'; overlay.classList.add('hidden'); if(unpauseBtn) unpauseBtn.classList.add('hidden'); running=true; last=performance.now(); requestAnimationFrame(loop); }
pauseBtn.addEventListener('click', ()=>{ if(paused) resumeGame(); else pauseGame(false); });
if(unpauseBtn) unpauseBtn.addEventListener('click', ()=> resumeGame() );
addEventListener('visibilitychange', ()=>{ if(document.hidden){ if(gameState==='playing' && running) pauseGame(true); } else { if(gameState==='playing' && paused && autoPaused) resumeGame(); } });
addEventListener('blur', ()=>{ if(gameState==='playing' && running) pauseGame(true); });
addEventListener('focus', ()=>{ if(gameState==='playing' && paused && autoPaused) resumeGame(); });

// expose sprite manager init
initSpriteManager();

// export for potential debugging
window.__PTB = { players, platforms, startGame, endGame, mgrStore };