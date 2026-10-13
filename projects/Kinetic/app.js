import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ─── Core setup ───────────────────────────────────────────────────────────────
const stageEl = document.querySelector('#stage');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a101c);
scene.fog = new THREE.FogExp2(0x0a101c, 0.0075);

const camera = new THREE.PerspectiveCamera(84, innerWidth / innerHeight, 0.1, 320);
let cameraZoomTarget = 6.4, cameraZoom = 6.4, firstPerson = false;

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
renderer.domElement.setAttribute('aria-label', 'Platformer game view');
stageEl.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xb8d4ff, 0x1a2435, 1.9));
const sun = new THREE.DirectionalLight(0xffead1, 2.9);
sun.position.set(-18, 30, 16);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024); // cheaper than 2048
sun.shadow.camera.left = -28;
sun.shadow.camera.right = 28;
sun.shadow.camera.top = 28;
sun.shadow.camera.bottom = -28;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 90;
sun.shadow.bias = -0.00015;
sun.shadow.normalBias = 0.04;
scene.add(sun);
const sunTarget = new THREE.Object3D();
scene.add(sunTarget);
sun.target = sunTarget;
const fill = new THREE.PointLight(0x43d9dc, 28, 50, 2);
fill.position.set(8, 9, -12);
scene.add(fill);

// Stars
const starGeo = new THREE.BufferGeometry();
const starCount = 100;
const starPos = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i++) {
  starPos[i * 3] = (Math.random() - 0.5) * 180;
  starPos[i * 3 + 1] = Math.random() * 60 + 8;
  starPos[i * 3 + 2] = (Math.random() - 0.5) * 180 - 40;
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
  color: 0x88ccff, size: 0.18, transparent: true, opacity: 0.55, sizeAttenuation: true
}));
scene.add(stars);

// ─── Materials ────────────────────────────────────────────────────────────────
const material = (color, roughness = 0.72, metalness = 0.05) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

const platformMaterials = [
  material(0x35465d, 0.56, 0.16),
  material(0x3b4c62, 0.52, 0.2),
  material(0x304158, 0.58, 0.14),
  material(0x2a3d52, 0.55, 0.18)
];
const insetMaterial = material(0x29394e, 0.62, 0.12);
const darkMaterial = material(0x202b3a, 0.65, 0.15);
const trimMaterial = new THREE.MeshStandardMaterial({ color: 0x28d7c8, emissive: 0x0b726f, emissiveIntensity: 1.4, roughness: 0.42, metalness: 0.2 });
const deathMaterial = new THREE.MeshStandardMaterial({ color: 0xd92a49, emissive: 0x690018, emissiveIntensity: 1.45, roughness: 0.42 });
const checkpointMaterial = new THREE.MeshStandardMaterial({ color: 0x67f2db, emissive: 0x14a896, emissiveIntensity: 1.55, roughness: 0.35 });
const goalMaterial = new THREE.MeshStandardMaterial({ color: 0xd6ff72, emissive: 0x75bc22, emissiveIntensity: 1.75, roughness: 0.35 });
const dashPadMaterial = new THREE.MeshStandardMaterial({ color: 0xffc85a, emissive: 0x9a4b08, emissiveIntensity: 1.55, roughness: 0.42 });
const bounceMaterial = new THREE.MeshStandardMaterial({ color: 0xff6b9d, emissive: 0x9a2058, emissiveIntensity: 1.6, roughness: 0.38 });
const orbMaterial = new THREE.MeshStandardMaterial({ color: 0x69f0dc, emissive: 0x1ad4c0, emissiveIntensity: 2.2, roughness: 0.25, metalness: 0.3 });
const monsterMaterial = new THREE.MeshStandardMaterial({ color: 0x030407, roughness: 0.26, metalness: 0.25 });
const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0xff182a, emissive: 0xff001a, emissiveIntensity: 5.5, roughness: 0.2 });
const climbWallMaterial = new THREE.MeshStandardMaterial({ color: 0x1e3a4a, emissive: 0x0a3040, emissiveIntensity: 0.6, roughness: 0.5, metalness: 0.15 });

function addBox(parent, w, h, d, mat, x, y, z, cast = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

// ─── Save / Progress ──────────────────────────────────────────────────────────
const SAVE_KEY = 'kinetic-stages-v4';
let saved = null;
try { saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch {}
const entropy = new Uint32Array(1);
if (!Number.isInteger(saved?.seed)) globalThis.crypto?.getRandomValues?.(entropy);
const worldSeed = Number.isInteger(saved?.seed) ? saved.seed >>> 0 : (entropy[0] || Date.now()) >>> 0;
let stageNumber = Number.isInteger(saved?.stage) && saved.stage > 0 ? saved.stage : 1;
let levelNumber = Number.isInteger(saved?.level) && saved.level >= 1 && saved.level <= 4 ? saved.level : 1;
let checkpointNumber = Number.isInteger(saved?.checkpoint) && saved.checkpoint >= 0 && saved.checkpoint <= 2 ? saved.checkpoint : 0;
let highScore = Number.isInteger(saved?.highScore) ? saved.highScore : 0;
let selectedSkin = typeof saved?.skin === 'string' ? saved.skin : 'default';

// ─── Level state ──────────────────────────────────────────────────────────────
let levelRoot = null, platforms = [], walls = [], ramps = [], dashPads = [], bouncePads = [], deathBricks = [], orbs = [], checkpointSpawns = [], goal = null, monster = null;
let levelElapsed = 0, visualTime = 0, levelTimer = 0, levelScore = 0, orbsCollected = 0, maxCombo = 1;
let combo = 1, comboTimer = 0, flowActive = false;
let screenShake = 0;

// Spatial grid — keeps collision/update cost ~constant even on long levels
const GRID_SIZE = 14;
const spatial = { platforms: new Map(), walls: new Map(), ramps: new Map(), death: new Map(), orbs: new Map(), dash: new Map(), bounce: new Map() };
function cellKey(x, z) { return (Math.floor(x / GRID_SIZE) | 0) + ',' + (Math.floor(z / GRID_SIZE) | 0); }
function gridInsert(map, x, z, item) {
  const k = cellKey(x, z);
  let arr = map.get(k);
  if (!arr) { arr = []; map.set(k, arr); }
  arr.push(item);
}
function gridQuery(map, x, z, radiusCells = 1) {
  const cx = Math.floor(x / GRID_SIZE) | 0;
  const cz = Math.floor(z / GRID_SIZE) | 0;
  const out = [];
  for (let dx = -radiusCells; dx <= radiusCells; dx++) {
    for (let dz = -radiusCells; dz <= radiusCells; dz++) {
      const arr = map.get((cx + dx) + ',' + (cz + dz));
      if (arr) for (let i = 0; i < arr.length; i++) out.push(arr[i]);
    }
  }
  return out;
}
function clearSpatial() {
  for (const m of Object.values(spatial)) m.clear();
}

// ─── Player ───────────────────────────────────────────────────────────────────
const player = new THREE.Group();
scene.add(player);
const modelRoot = new THREE.Group();
player.add(modelRoot);
const motionRoot = new THREE.Group();
modelRoot.add(motionRoot);
const flipRoot = new THREE.Group();
motionRoot.add(flipRoot);

const state = {
  pos: new THREE.Vector3(), vel: new THREE.Vector3(),
  yaw: 0, facingYaw: 0, pitch: -0.12,
  grounded: true, jumps: 0, coyote: 0, jumpBuffer: 0,
  wallTime: 0, wallNormal: new THREE.Vector3(),
  wallRunning: false, wallRunTime: 0,
  dashTime: 0, dashCooldown: 0, dashDir: new THREE.Vector3(),
  padCooldown: 0, jumpHold: 0,
  deform: 0, deformVelocity: 0, runPhase: 0, windClock: 0, lastSpeed: 0,
  climbing: false, climbProgress: 0, climbTarget: null,
  flipTime: 0, flipAxis: 'x', flipDir: 1
};

// ─── Skins ────────────────────────────────────────────────────────────────────
const SKINS = [
  { id: 'default', name: 'Cat',          path: 'player.glb',                          scaleMul: 1.00, yawOffset: Math.PI, preview: 'skins/previews/cat.png' },
  { id: 'cube25',  name: 'Blaze',        path: 'skins/cube_25.glb',                   scaleMul: 1.05, yawOffset: 0,       preview: 'skins/previews/blaze.png' },
  { id: 'cube102', name: 'Void',         path: 'skins/cube_102.glb',                  scaleMul: 1.00, yawOffset: Math.PI, preview: 'skins/previews/void.png' },
  { id: 'cube145', name: 'Subzero',      path: 'skins/cube_145_from_gd_subzero.glb',  scaleMul: 1.00, yawOffset: Math.PI, preview: 'skins/previews/subzero.png' },
  { id: 'cube287', name: 'Gold',         path: 'skins/cube_287.glb',                  scaleMul: 0.95, yawOffset: 0,       preview: 'skins/previews/gold.png' },
  { id: 'cube296', name: 'Neon',         path: 'skins/cube_296.glb',                  scaleMul: 1.00, yawOffset: Math.PI, preview: 'skins/previews/neon.png' }
];

const loader = new GLTFLoader();
const loadedSkins = {};
let currentSkinModel = null;

function loadSkin(id) {
  const def = SKINS.find(s => s.id === id) || SKINS[0];
  if (loadedSkins[def.id]) {
    applySkin(def.id);
    return;
  }
  loader.load(def.path, ({ scene: model }) => {
    model.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const baseScale = 1.72 / Math.max(size.y, 0.01);
    const scale = baseScale * (def.scaleMul || 1);
    model.scale.setScalar(scale);
    model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
    // Correct facing direction per skin
    model.rotation.y = def.yawOffset ?? 0;
    loadedSkins[def.id] = model;
    if (selectedSkin === def.id || !currentSkinModel) applySkin(def.id);
  }, undefined, err => console.error('Skin load failed', def.path, err));
}

function applySkin(id) {
  const def = SKINS.find(s => s.id === id) || SKINS[0];
  const model = loadedSkins[id];
  if (!model) return;
  if (currentSkinModel) flipRoot.remove(currentSkinModel);
  currentSkinModel = model;
  // Ensure correct yaw every time we switch
  model.rotation.y = def.yawOffset ?? 0;
  flipRoot.add(model);
  selectedSkin = id;
  saveProgress();
  document.querySelectorAll('.skin-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.skin === id);
  });
}

// Preload all skins
SKINS.forEach(s => loadSkin(s.id));

// Build skin buttons with preview images
const skinRow = document.querySelector('#skin-row');
SKINS.forEach(s => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'skin-btn' + (s.id === selectedSkin ? ' active' : '');
  btn.dataset.skin = s.id;
  btn.title = s.name;
  btn.innerHTML = `
    <img src="${s.preview}" alt="${s.name}" draggable="false">
    <span>${s.name}</span>
  `;
  btn.addEventListener('click', () => {
    selectedSkin = s.id;
    if (loadedSkins[s.id]) applySkin(s.id);
    else loadSkin(s.id);
  });
  skinRow.appendChild(btn);
});

// Streaks
const streakCount = 28;
const streakPositions = new Float32Array(streakCount * 6);
const streakGeometry = new THREE.BufferGeometry();
streakGeometry.setAttribute('position', new THREE.BufferAttribute(streakPositions, 3));
const streakMaterial = new THREE.LineBasicMaterial({
  color: 0x7cf7e5, transparent: true, opacity: 0.72,
  blending: THREE.AdditiveBlending, depthWrite: false
});
const streaks = new THREE.LineSegments(streakGeometry, streakMaterial);
streaks.frustumCulled = false;
scene.add(streaks);
const streakParticles = Array.from({ length: streakCount }, () => ({
  position: new THREE.Vector3(), velocity: new THREE.Vector3(), life: 0, maxLife: 0.25
}));
let streakCursor = 0;

// ─── Audio (real files) ───────────────────────────────────────────────────────
const SFX = {};
const SFX_FILES = {
  jump: 'sounds/jump.mp3',
  land: 'sounds/land.mp3',
  dash: 'sounds/dash.mp3',
  dashpad: 'sounds/dashpad.mp3',
  climb: 'sounds/climb.mp3',
  win: 'sounds/win.mp3',
  lose: 'sounds/lose.mp3'
};
let bgm = null;
let audioUnlocked = false;

function loadSfx() {
  for (const [key, src] of Object.entries(SFX_FILES)) {
    const a = new Audio(src);
    a.preload = 'auto';
    a.volume = key === 'lose' ? 0.45 : 0.55;
    SFX[key] = a;
  }
  bgm = new Audio('sounds/bgm.mp3');
  bgm.loop = true;
  bgm.volume = 0.35;
  bgm.preload = 'auto';
}
loadSfx();

function ensureAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  // unlock by playing muted briefly if needed
  try {
    if (bgm && bgm.paused) {
      const p = bgm.play();
      if (p && p.catch) p.catch(() => {});
    }
  } catch {}
}

function playSfx(key, volume) {
  const base = SFX[key];
  if (!base) return;
  try {
    // clone for overlapping plays
    const a = base.cloneNode();
    a.volume = volume != null ? volume : base.volume;
    a.play().catch(() => {});
  } catch {}
}

function sfxJump() { playSfx('jump', 0.55); }
function sfxLand() { playSfx('land', 0.5); }
function sfxDash() { playSfx('dash', 0.55); }
function sfxCollect() { playSfx('jump', 0.3); } // light tick
function sfxCheckpoint() { playSfx('climb', 0.5); }
function sfxGoal() { playSfx('win', 0.6); }
function sfxDeath() { playSfx('lose', 0.5); }
function sfxBounce() { playSfx('dashpad', 0.55); }
function sfxWall() { playSfx('land', 0.25); }
function sfxClimb() { playSfx('climb', 0.55); }
function sfxFlip() { playSfx('dash', 0.3); }
function sfxDashPad() { playSfx('dashpad', 0.55); }

// ─── Helpers ──────────────────────────────────────────────────────────────────
const keys = new Set();
let locked = false, gameStarted = false, paused = false, levelCompleteOpen = false;
const startButton = document.querySelector('#start');
const toast = document.querySelector('#toast');
const comboToast = document.querySelector('#combo-toast');
const pauseScreen = document.querySelector('#pause-screen');
const levelCompleteEl = document.querySelector('#level-complete');
const stageInput = document.querySelector('#stage-input');
let toastTimer, comboToastTimer;

function showToast(text) {
  toast.textContent = text;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 900);
}
function showComboToast(text) {
  comboToast.textContent = text;
  comboToast.classList.add('show');
  clearTimeout(comboToastTimer);
  comboToastTimer = setTimeout(() => comboToast.classList.remove('show'), 700);
}
function emitStreaks(origin, count, dx = 0, dy = 0, dz = 0, power = 1) {
  for (let i = 0; i < count; i++) {
    const p = streakParticles[streakCursor];
    streakCursor = (streakCursor + 1) % streakCount;
    p.life = p.maxLife = 0.14 + Math.random() * 0.18;
    p.position.set(origin.x + (Math.random() - 0.5) * 0.4, origin.y + (Math.random() - 0.5) * 0.45, origin.z + (Math.random() - 0.5) * 0.4);
    p.velocity.set(dx * power + (Math.random() - 0.5) * 2, dy * power + Math.random() * 1.5, dz * power + (Math.random() - 0.5) * 2);
  }
}
function updateStreaks(dt) {
  for (let i = 0; i < streakCount; i++) {
    const p = streakParticles[i], offset = i * 6;
    if (p.life <= 0) { for (let n = 0; n < 6; n++) streakPositions[offset + n] = 0; continue; }
    p.life -= dt;
    p.position.addScaledVector(p.velocity, dt);
    p.velocity.y -= 1.3 * dt;
    const speed = Math.max(p.velocity.length(), 0.1);
    const tail = (0.07 + speed * 0.022) * Math.max(p.life / p.maxLife, 0.15);
    streakPositions[offset] = p.position.x;
    streakPositions[offset + 1] = p.position.y;
    streakPositions[offset + 2] = p.position.z;
    streakPositions[offset + 3] = p.position.x - p.velocity.x / speed * tail;
    streakPositions[offset + 4] = p.position.y - p.velocity.y / speed * tail;
    streakPositions[offset + 5] = p.position.z - p.velocity.z / speed * tail;
    if (p.life <= 0) for (let n = 0; n < 6; n++) streakPositions[offset + n] = 0;
  }
  streakGeometry.attributes.position.needsUpdate = true;
}
function saveProgress() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      seed: worldSeed, stage: stageNumber, level: levelNumber,
      checkpoint: checkpointNumber, highScore, skin: selectedSkin
    }));
  } catch {}
}
function randomAt(index, salt) {
  let value = (worldSeed ^ Math.imul(stageNumber, 0x9e3779b1) ^ Math.imul(levelNumber, 0x85ebca6b) ^
    Math.imul(index + 1, 0xc2b2ae35) ^ Math.imul(salt + 1, 0x27d4eb2f)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967296;
}
function localToWorld(cx, cz, yaw, lx, lz) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return { x: cx + c * lx + s * lz, z: cz - s * lx + c * lz };
}
function worldToLocal(item, x, z) {
  const dx = x - item.x, dz = z - item.z;
  const c = Math.cos(item.yaw || 0), s = Math.sin(item.yaw || 0);
  return { x: c * dx - s * dz, z: s * dx + c * dz };
}
function formatTime(t) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const d = Math.floor((t % 1) * 10);
  return `${m}:${String(s).padStart(2, '0')}.${d}`;
}
function addScore(amount) {
  const gained = Math.round(amount * combo);
  levelScore += gained;
  if (levelScore > highScore) highScore = levelScore;
  document.querySelector('#score').textContent = levelScore.toLocaleString();
}
function bumpCombo(amount = 0.25) {
  const prev = Math.floor(combo);
  combo = Math.min(combo + amount, 8);
  comboTimer = 2.8;
  flowActive = true;
  if (Math.floor(combo) > prev) {
    showComboToast(`FLOW x${Math.floor(combo)}`);
    maxCombo = Math.max(maxCombo, Math.floor(combo));
  }
  document.querySelector('#combo').textContent = `x${combo.toFixed(1)}`;
}
function triggerFlip(axis = 'x', dir = 1) {
  if (state.flipTime > 0) return;
  state.flipTime = 0.55;
  state.flipAxis = axis;
  state.flipDir = dir;
  sfxFlip();
}

// ─── Level building ───────────────────────────────────────────────────────────
function addPlatform(data) {
  data.yaw ??= 0;
  data.bottom = data.top - 0.65;
  const group = new THREE.Group();
  group.position.set(data.x, 0, data.z);
  group.rotation.y = data.yaw;
  levelRoot.add(group);
  data.group = group;
  const topMat = platformMaterials[(stageNumber + levelNumber + (data.index || 0)) % platformMaterials.length];
  addBox(group, data.w, 0.65, data.d, topMat, 0, data.top - 0.325, 0);
  addBox(group, data.w + 0.28, 0.2, data.d + 0.28, darkMaterial, 0, data.top - 0.74, 0, false);
  addBox(group, data.w - 0.55, 0.035, data.d - 0.55, insetMaterial, 0, data.top + 0.008, 0, false);
  addBox(group, data.w * 0.82, 0.055, 0.1, trimMaterial, 0, data.top - 0.025, -data.d / 2 + 0.11, false);
  platforms.push(data);
  gridInsert(spatial.platforms, data.x, data.z, data);
  if (data.checkpoint) {
    const beaconX = data.w * 0.34;
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.18, 2.25, 8), checkpointMaterial);
    beacon.position.set(beaconX, data.top + 1.15, 0);
    group.add(beacon);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.055, 8, 24), checkpointMaterial);
    halo.position.set(beaconX, data.top + 2.35, 0);
    group.add(halo);
    data.halo = halo;
    data.spawn = { x: data.x, y: data.top, z: data.z };
    checkpointSpawns[data.checkpoint] = data.spawn;
  }
  return data;
}

function addWall(platform, side, height, isClimb = false) {
  const w = 0.58, d = platform.d * (isClimb ? 0.7 : 0.46);
  const center = localToWorld(platform.x, platform.z, platform.yaw, side * (platform.w / 2 + 0.34), 0);
  const group = new THREE.Group();
  group.position.set(center.x, 0, center.z);
  group.rotation.y = platform.yaw;
  levelRoot.add(group);
  const bottom = platform.top - 0.15;
  const mat = isClimb ? climbWallMaterial : darkMaterial;
  addBox(group, w, height, d, mat, 0, bottom + height / 2, 0);
  addBox(group, 0.075, height * 0.84, 0.12, trimMaterial, side * (w / 2 + 0.035), bottom + height / 2, 0, false);
  // Climb holds for climb walls
  if (isClimb) {
    for (let h = 0.6; h < height - 0.4; h += 0.85) {
      addBox(group, 0.22, 0.12, 0.18, trimMaterial, side * (w / 2 + 0.02), bottom + h, 0, false);
    }
  }
  const wallObj = {
    x: center.x, z: center.z, yaw: platform.yaw, w, d,
    bottom, top: bottom + height,
    walljump: true, climbable: isClimb, side
  };
  walls.push(wallObj);
  gridInsert(spatial.walls, wallObj.x, wallObj.z, wallObj);
}

// Standalone tall climb wall between platforms (for vertical ascent)
function addClimbWall(x, z, yaw, height, bottomY) {
  const w = 0.7, d = 2.4;
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = yaw;
  levelRoot.add(group);
  addBox(group, w, height, d, climbWallMaterial, 0, bottomY + height / 2, 0);
  for (let h = 0.5; h < height - 0.3; h += 0.7) {
    addBox(group, 0.25, 0.1, 0.2, trimMaterial, w / 2 + 0.02, bottomY + h, 0, false);
    addBox(group, 0.25, 0.1, 0.2, trimMaterial, -(w / 2 + 0.02), bottomY + h, 0, false);
  }
  const climbWall = {
    x, z, yaw, w, d, bottom: bottomY, top: bottomY + height,
    walljump: true, climbable: true, side: 0
  };
  walls.push(climbWall);
  gridInsert(spatial.walls, x, z, climbWall);
}

function addDeathBrick(x, y, z, w, d, h = 0.34, yaw = 0) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = yaw;
  levelRoot.add(group);
  addBox(group, w, h, d, deathMaterial, 0, 0, 0, false);
  const db = { x, y, z, yaw, w, d, bottom: y - h / 2, top: y + h / 2 };
  deathBricks.push(db);
  gridInsert(spatial.death, x, z, db);
}
function addRamp(platform, rise) {
  const w = platform.w * 0.62, d = platform.d * 0.78, angle = Math.atan(rise / d);
  const group = new THREE.Group();
  group.position.set(platform.x, 0, platform.z);
  group.rotation.y = platform.yaw;
  levelRoot.add(group);
  const mesh = addBox(group, w, 0.32, d, platformMaterials[(stageNumber + levelNumber) % platformMaterials.length], 0, platform.top + rise / 2 - 0.16 * Math.cos(angle), 0);
  mesh.rotation.x = angle;
  addBox(group, w * 0.72, 0.055, 0.1, trimMaterial, 0, platform.top + rise - 0.02, -d / 2 + 0.08, false);
  const rampObj = { x: platform.x, z: platform.z, yaw: platform.yaw, w, d, baseTop: platform.top, rise };
  ramps.push(rampObj);
  gridInsert(spatial.ramps, platform.x, platform.z, rampObj);
}
function addDashPad(platform) {
  const w = platform.w * 0.56, d = 1.8;
  const group = new THREE.Group();
  group.position.set(platform.x, 0, platform.z);
  group.rotation.y = platform.yaw;
  levelRoot.add(group);
  addBox(group, w, 0.09, d, dashPadMaterial, 0, platform.top + 0.055, -0.1, false);
  for (const z of [-0.62, 0, 0.62]) addBox(group, w * 0.44, 0.035, 0.08, goalMaterial, 0, platform.top + 0.11, z - 0.1, false);
  const dashObj = { x: platform.x, z: platform.z, yaw: platform.yaw, w, d, top: platform.top };
  dashPads.push(dashObj);
  gridInsert(spatial.dash, platform.x, platform.z, dashObj);
}
function addBouncePad(platform) {
  const w = 2.2, d = 2.2;
  const group = new THREE.Group();
  group.position.set(platform.x, 0, platform.z);
  group.rotation.y = platform.yaw;
  levelRoot.add(group);
  addBox(group, w, 0.14, d, bounceMaterial, 0, platform.top + 0.08, 0, false);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.06, 8, 20), bounceMaterial);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, platform.top + 0.18, 0);
  group.add(ring);
  const bounceObj = { x: platform.x, z: platform.z, yaw: platform.yaw, w, d, top: platform.top, ring };
  bouncePads.push(bounceObj);
  gridInsert(spatial.bounce, platform.x, platform.z, bounceObj);
}
function addOrb(x, y, z) {
  const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), orbMaterial);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  levelRoot.add(mesh);
  const glow = new THREE.PointLight(0x69f0dc, 2.5, 4, 2);
  glow.position.copy(mesh.position);
  levelRoot.add(glow);
  const orbObj = { mesh, glow, x, y, z, collected: false, bob: Math.random() * Math.PI * 2 };
  orbs.push(orbObj);
  gridInsert(spatial.orbs, x, z, orbObj);
}
function clearLevel() {
  if (levelRoot) {
    levelRoot.traverse(o => { if (o.isMesh || o.isLine || o.isPoints) o.geometry?.dispose(); });
    scene.remove(levelRoot);
  }
  levelRoot = new THREE.Group();
  scene.add(levelRoot);
  platforms = []; walls = []; ramps = []; dashPads = []; bouncePads = []; deathBricks = []; orbs = [];
  checkpointSpawns = []; goal = null; monster = null;
  clearSpatial();
  levelElapsed = 0; levelTimer = 0; levelScore = 0; orbsCollected = 0; maxCombo = 1;
  combo = 1; comboTimer = 0; flowActive = false;
}

function buildLevel() {
  clearLevel();
  const platformCount = Math.min(9 + (stageNumber - 1) * 2 + (levelNumber - 1), 42);
  // Keep far plane bounded — huge far planes hurt depth precision & culling
  camera.far = Math.min(220, Math.max(160, 140 + platformCount * 4));
  camera.updateProjectionMatrix();
  scene.fog.density = 0.009;

  const start = addPlatform({ index: 0, x: 0, z: 14, w: 13, d: 13, top: 0, yaw: 0 });
  checkpointSpawns[0] = { x: start.x, y: start.top, z: start.z };

  let previous = start, routeYaw = 0;
  const difficulty = Math.min(1 + (stageNumber - 1) * 0.06 + (levelNumber - 1) * 0.07, 1.9);
  const curveSide = randomAt(0, 8) < 0.5 ? -1 : 1;
  const curveWaves = 1 + Math.floor(platformCount / 22);
  const curvePhase = randomAt(0, 9) * Math.PI * 2;
  const checkpointA = Math.ceil(platformCount / 3);
  const checkpointB = Math.ceil(platformCount * 2 / 3);
  const reserved = new Set([checkpointA, checkpointB]);

  function reserveStep(target) {
    const first = THREE.MathUtils.clamp(Math.round(target), 1, platformCount);
    for (let offset = 0; offset < platformCount; offset++) {
      const candidate = 1 + (first - 1 + offset) % platformCount;
      if (!reserved.has(candidate)) { reserved.add(candidate); return candidate; }
    }
    return -1;
  }

  const hazardSteps = [];
  for (let h = 0; h < Math.min(1 + Math.floor(platformCount / 20), 4); h++)
    hazardSteps.push(reserveStep(platformCount * (0.22 + h * 0.28)));
  const wallSteps = [];
  for (let w = 0; w < Math.min(3 + Math.floor((platformCount - 6) / 12), 8); w++)
    wallSteps.push(reserveStep(platformCount * (w + 1) / (Math.min(3 + Math.floor((platformCount - 6) / 12), 8) + 1)));
  const climbSteps = [];
  for (let c = 0; c < Math.min(2 + Math.floor(platformCount / 14), 5); c++)
    climbSteps.push(reserveStep(platformCount * (0.18 + c * 0.2)));
  const rampSteps = [];
  for (let r = 0; r < Math.min(1 + Math.floor(platformCount / 22), 3); r++)
    rampSteps.push(reserveStep(platformCount * (0.4 + r * 0.22)));
  const dashSteps = [];
  for (let d = 0; d < Math.min(1 + Math.floor(platformCount / 14), 5); d++)
    dashSteps.push(reserveStep(platformCount * (0.28 + d * 0.18)));
  const bounceSteps = [];
  for (let b = 0; b < Math.min(1 + Math.floor(platformCount / 18), 3); b++)
    bounceSteps.push(reserveStep(platformCount * (0.35 + b * 0.25)));

  for (let i = 1; i <= platformCount; i++) {
    const progress = i / platformCount;
    const targetHeading = curveSide * (0.92 * Math.sin(progress * Math.PI * 2 * curveWaves) +
      0.22 * (Math.sin(progress * Math.PI * 4 * curveWaves + curvePhase) - Math.sin(curvePhase)));
    const headingNoise = (randomAt(i, 7) - 0.5) * 0.14;
    routeYaw = THREE.MathUtils.clamp(
      routeYaw + THREE.MathUtils.clamp(targetHeading - routeYaw, -0.4, 0.4) + headingNoise,
      -1.35, 1.35
    );
    const forwardX = -Math.sin(routeYaw), forwardZ = -Math.cos(routeYaw);
    const rightX = Math.cos(routeYaw), rightZ = -Math.sin(routeYaw);
    const step = 11.5 + randomAt(i, 1) * 2.8 + Math.min(stageNumber * 0.04, 1.6);
    const lateral = (randomAt(i, 0) - 0.5) * (1.5 + Math.min(stageNumber * 0.03, 0.9));
    const x = THREE.MathUtils.clamp(previous.x + forwardX * step + rightX * lateral, -70, 70);
    const z = previous.z + forwardZ * step + rightZ * lateral;

    let top;
    if (levelNumber === 2) {
      top = THREE.MathUtils.clamp(previous.top + (i % 2 ? 0.95 : -0.28) + (randomAt(i, 2) - 0.5) * 0.55, 0.6, 6.2);
    } else if (levelNumber === 3) {
      top = THREE.MathUtils.clamp(0.75 + Math.abs(Math.sin(progress * Math.PI * 4 * curveWaves + curvePhase)) * 3.4 + randomAt(i, 2) * 0.45, 0.6, 6.4);
    } else if (levelNumber === 4) {
      top = THREE.MathUtils.clamp(previous.top + (randomAt(i, 2) - 0.5) * 1.7 * difficulty, 0.7, 6.5);
    } else {
      top = THREE.MathUtils.clamp(previous.top + (randomAt(i, 2) - 0.5) * 1.45 * difficulty, 0.6, 5.8);
    }

    // Bigger height jumps → place climb walls to reach them
    const heightDiff = top - previous.top;
    const needsClimb = heightDiff > 1.6 || climbSteps.includes(i);

    const checkpoint = i === checkpointA ? 1 : i === checkpointB ? 2 : 0;
    const sizePenalty = Math.min(stageNumber * 0.028, 0.9);
    const pad = addPlatform({
      index: i, x, z, yaw: routeYaw,
      w: 9.6 - sizePenalty + randomAt(i, 3) * 1.2,
      d: 8.9 - sizePenalty * 0.55 + randomAt(i, 4) * 1.15,
      top, checkpoint
    });

    // Orbs
    if (randomAt(i, 11) > 0.38) {
      const ox = (randomAt(i, 12) - 0.5) * pad.w * 0.55;
      const oz = (randomAt(i, 13) - 0.5) * pad.d * 0.5;
      const world = localToWorld(pad.x, pad.z, pad.yaw, ox, oz);
      addOrb(world.x, pad.top + 1.1 + randomAt(i, 14) * 0.6, world.z);
    }
    if (randomAt(i, 15) > 0.82 && i > 2) {
      const world = localToWorld(pad.x, pad.z, pad.yaw, 0, -pad.d * 0.7);
      addOrb(world.x, pad.top + 2.2, world.z);
    }

    if (i <= platformCount - 3 && hazardSteps.includes(i)) {
      const side = randomAt(i, 5) < 0.5 ? -1 : 1;
      const point = localToWorld(pad.x, pad.z, pad.yaw, side * pad.w * 0.28, -pad.d * 0.1);
      addDeathBrick(point.x, pad.top + 0.12, point.z, 1.85, 1.85, 0.26, pad.yaw);
      if (randomAt(i, 16) > 0.55) {
        const p2 = localToWorld(pad.x, pad.z, pad.yaw, -side * pad.w * 0.22, pad.d * 0.15);
        addDeathBrick(p2.x, pad.top + 0.12, p2.z, 1.5, 1.5, 0.22, pad.yaw);
      }
    }

    // Regular walls + climb walls
    // Keep the final stretch clear — no walls in the last 4 platforms before the goal
    const nearGoal = i > platformCount - 4;
    if (!nearGoal && wallSteps.includes(i)) {
      addWall(pad, randomAt(i, 6) < 0.5 ? -1 : 1, 3.4 + Math.min(stageNumber * 0.025, 0.5));
    }
    if (!nearGoal && (needsClimb || climbSteps.includes(i))) {
      // Place a tall climbable wall near the lower platform so player can wall-jump / run up to the higher one
      const climbSide = randomAt(i, 17) < 0.5 ? -1 : 1;
      const climbH = Math.max(3.8, heightDiff + 2.8);
      const climbBase = Math.min(previous.top, pad.top) - 0.2;
      // Keep climb walls off the main path center so they assist rather than block
      const climbPos = localToWorld(
        (previous.x + pad.x) * 0.5,
        (previous.z + pad.z) * 0.5,
        routeYaw,
        climbSide * 5.5,
        0
      );
      addClimbWall(climbPos.x, climbPos.z, routeYaw, climbH, climbBase);
      // Side wall on the platform (not blocking forward path)
      addWall(pad, climbSide, 2.8 + Math.min(stageNumber * 0.02, 0.4), true);
    }

    if (rampSteps.includes(i)) addRamp(pad, 0.9 + randomAt(i, 10) * 0.85);
    if (dashSteps.includes(i)) addDashPad(pad);
    if (bounceSteps.includes(i)) addBouncePad(pad);

    previous = pad;
  }

  // Goal
  const goalPoint = localToWorld(previous.x, previous.z, routeYaw, 0, -15);
  const goalPad = addPlatform({
    index: platformCount + 1, x: goalPoint.x, z: goalPoint.z, yaw: routeYaw,
    w: 13, d: 11, top: THREE.MathUtils.clamp(previous.top, 0.75, 5.5)
  });
  const goalLocalZ = -goalPad.d * 0.28;
  const goalPointWorld = localToWorld(goalPad.x, goalPad.z, routeYaw, 0, goalLocalZ);
  const gx = goalPointWorld.x, gz = goalPointWorld.z, gy = goalPad.top;
  const goalFrame = new THREE.Group();
  goalFrame.position.set(gx, 0, gz);
  goalFrame.rotation.y = routeYaw;
  levelRoot.add(goalFrame);
  addBox(goalFrame, 0.35, 5.2, 0.35, goalMaterial, -2.35, gy + 2.6, 0, false);
  addBox(goalFrame, 0.35, 5.2, 0.35, goalMaterial, 2.35, gy + 2.6, 0, false);
  addBox(goalFrame, 5.0, 0.35, 0.35, goalMaterial, 0, gy + 5.15, 0, false);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.14, 10, 42), goalMaterial);
  ring.position.set(0, gy + 2.65, 0);
  goalFrame.add(ring);
  const goalGlow = new THREE.PointLight(0xc2ff59, 20, 16, 2);
  goalGlow.position.set(0, gy + 2.6, 0);
  goalFrame.add(goalGlow);
  goal = { x: gx, z: gz, yaw: routeYaw, top: gy, ring, glow: goalGlow };

  addOrb(gx, gy + 1.4, gz);
  addOrb(gx + 1.5, gy + 1.8, gz - 1);

  if (checkpointNumber > 2) checkpointNumber = 0;
  const spawn = checkpointSpawns[checkpointNumber] || checkpointSpawns[0];
  state.pos.set(spawn.x, spawn.y, spawn.z);
  state.vel.set(0, 0, 0);
  state.grounded = true; state.jumps = 0;
  state.coyote = 0; state.jumpBuffer = 0; state.jumpHold = 0;
  state.wallTime = 0; state.dashTime = 0; state.dashCooldown = 0; state.padCooldown = 0;
  state.wallRunning = false; state.wallRunTime = 0;
  state.climbing = false; state.climbProgress = 0; state.climbTarget = null;
  state.flipTime = 0;
  state.deform = 0; state.deformVelocity = 0; state.lastSpeed = 0; state.windClock = 0;
  player.position.copy(state.pos);
  flipRoot.rotation.set(0, 0, 0);

  if (levelNumber === 4) createMonster();

  document.querySelector('#score').textContent = '0';
  document.querySelector('#combo').textContent = 'x1';
  document.querySelector('#orbs-collected').textContent = '0 ORBS';
  document.querySelector('#timer').textContent = '0:00.0';
  saveProgress();
  updateLevelHud();
}

function createMonster() {
  const root = new THREE.Group();
  addBox(root, 3.3, 3.3, 3.3, monsterMaterial, 0, 0, 0, true);
  for (const x of [-0.65, 0.65]) {
    const eye = addBox(root, 0.5, 0.3, 0.14, eyeMaterial, x, 0.4, -1.68, false);
    eye.rotation.z = x < 0 ? -0.09 : 0.09;
  }
  const core = new THREE.PointLight(0xff1028, 22, 13, 2);
  core.position.set(0, 0.4, -1.35);
  root.add(core);
  root.position.set(state.pos.x, state.pos.y + 1.7, state.pos.z + 32);
  levelRoot.add(root);
  monster = { root, speed: 20 + Math.min(stageNumber * 0.6, 8.5) };
}

function updateLevelHud() {
  document.querySelector('#stage-number').textContent = String(stageNumber).padStart(2, '0');
  document.querySelector('#level').textContent = levelNumber + '/4';
  document.querySelector('#surface').textContent = 'CP ' + checkpointNumber + '/2';
}

function activateCheckpoint(data) {
  if (!data.checkpoint || data.checkpoint <= checkpointNumber) return;
  checkpointNumber = data.checkpoint;
  saveProgress();
  updateLevelHud();
  showToast('CHECKPOINT ' + checkpointNumber + ' / 2');
  sfxCheckpoint();
  addScore(250);
  bumpCombo(0.5);
}

function respawn() {
  const spawn = checkpointSpawns[checkpointNumber] || checkpointSpawns[0];
  state.pos.set(spawn.x, spawn.y, spawn.z);
  state.vel.set(0, 0, 0);
  state.grounded = true; state.jumps = 0;
  state.coyote = 0; state.jumpBuffer = 0; state.jumpHold = 0;
  state.wallTime = 0; state.dashTime = 0; state.dashCooldown = 0; state.padCooldown = 0;
  state.wallRunning = false; state.wallRunTime = 0;
  state.climbing = false; state.climbProgress = 0; state.climbTarget = null;
  state.flipTime = 0;
  state.deform = -0.22; state.deformVelocity = 0; state.windClock = 0; state.lastSpeed = 0;
  player.position.copy(state.pos);
  flipRoot.rotation.set(0, 0, 0);
  if (monster) monster.root.position.set(state.pos.x, state.pos.y + 1.7, state.pos.z + 32);
  combo = 1; comboTimer = 0; flowActive = false;
  document.querySelector('#combo').textContent = 'x1';
  showToast('BACK TO CHECKPOINT');
  sfxDeath();
  screenShake = 0.35;
}

function openLevelComplete() {
  levelCompleteOpen = true;
  paused = true;
  if (locked) document.exitPointerLock();
  document.querySelector('#complete-title').textContent =
    levelNumber === 4 ? `STAGE ${stageNumber} CLEAR` : `LEVEL ${levelNumber}`;
  document.querySelector('#complete-time').textContent = formatTime(levelTimer);
  document.querySelector('#complete-score').textContent = levelScore.toLocaleString();
  document.querySelector('#complete-orbs').textContent = orbsCollected;
  document.querySelector('#complete-combo').textContent = 'x' + maxCombo;
  levelCompleteEl.classList.remove('hidden');
  sfxGoal();
}

function advanceLevel() {
  levelCompleteOpen = false;
  levelCompleteEl.classList.add('hidden');
  if (levelNumber === 4) {
    stageNumber++;
    levelNumber = 1;
    checkpointNumber = 0;
    buildLevel();
    showToast('STAGE ' + stageNumber);
  } else {
    levelNumber++;
    checkpointNumber = 0;
    buildLevel();
    showToast(levelNumber === 4 ? 'MONSTER INBOUND' : 'LEVEL ' + levelNumber);
  }
  requestLock();
}

// ─── Input ────────────────────────────────────────────────────────────────────
buildLevel();

function requestLock() {
  ensureAudio();
  renderer.domElement.requestPointerLock?.();
}
function skipToStage() {
  const target = Number(stageInput.value);
  if (!Number.isSafeInteger(target) || target < 1) return;
  stageNumber = target; levelNumber = 1; checkpointNumber = 0;
  buildLevel();
  showToast('STAGE ' + stageNumber);
}
stageInput.addEventListener('keydown', e => { if (e.key === 'Enter') skipToStage(); });
document.querySelector('#stage-go').addEventListener('click', skipToStage);
document.querySelector('#resume-game').addEventListener('click', requestLock);
document.querySelector('#next-level').addEventListener('click', advanceLevel);
startButton.addEventListener('click', requestLock);
renderer.domElement.addEventListener('click', () => { if (!locked && !levelCompleteOpen) requestLock(); });

renderer.domElement.addEventListener('wheel', e => {
  e.preventDefault();
  cameraZoomTarget = THREE.MathUtils.clamp(cameraZoomTarget + Math.sign(e.deltaY) * 1.25, 0, 12);
}, { passive: false });

document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === renderer.domElement;
  if (locked) {
    gameStarted = true; paused = false;
    pauseScreen.classList.add('hidden');
    startButton.classList.add('hidden');
    ensureAudio();
    if (bgm && bgm.paused) {
      bgm.play().catch(() => {});
    }
  } else {
    keys.clear();
    if (gameStarted && !levelCompleteOpen) {
      paused = true;
      stageInput.value = String(stageNumber);
      document.querySelector('#pause-stage').textContent = stageNumber;
      document.querySelector('#pause-score').textContent = levelScore.toLocaleString();
      document.querySelector('#pause-best').textContent = highScore.toLocaleString();
      pauseScreen.classList.remove('hidden');
    } else if (!gameStarted) {
      startButton.classList.remove('hidden');
    }
  }
});

document.addEventListener('mousemove', e => {
  if (!locked) return;
  state.yaw -= e.movementX * 0.0025;
  state.pitch = THREE.MathUtils.clamp(state.pitch - e.movementY * 0.002, -1.54, 1.54);
});

document.addEventListener('keydown', e => {
  const key = e.key.toLowerCase();
  if (key === 'escape' && gameStarted) {
    e.preventDefault();
    if (levelCompleteOpen) return;
    if (locked) document.exitPointerLock();
    else requestLock();
    return;
  }
  if (paused || levelCompleteOpen) return;
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) e.preventDefault();
  if (!keys.has(key)) {
    if (key === ' ' && locked) jump();
    if (key === 'e' && locked) dash();
  }
  keys.add(key);
});
document.addEventListener('keyup', e => {
  const key = e.key.toLowerCase();
  keys.delete(key);
  if (key === ' ' && state.vel.y > 0) {
    state.vel.y *= 0.55;
    state.jumpHold = 0.22;
  }
});

// ─── Movement ─────────────────────────────────────────────────────────────────
function jump() {
  state.jumpBuffer = 0.16;
  performJump();
}
function performJump() {
  if (state.climbing) return false;
  if (state.wallTime > 0 && !state.grounded) {
    // Stronger wall jump for climbing up
    const boost = state.wallRunning ? 15.5 : 14.0;
    state.vel.x = state.wallNormal.x * boost + state.vel.x * 0.2;
    state.vel.z = state.wallNormal.z * boost + state.vel.z * 0.2;
    state.vel.y = state.wallRunning ? 17.8 : 16.8;
    state.jumps = 1; state.wallTime = 0; state.coyote = 0;
    state.wallRunning = false;
    showToast('WALL JUMP');
    bumpCombo(0.4);
    sfxJump();
    triggerFlip('z', Math.sign(state.wallNormal.x) || 1);
  } else if (state.grounded || state.coyote > 0) {
    state.vel.y = 17.2;
    state.grounded = false; state.jumps = 1; state.coyote = 0;
    sfxJump();
  } else if (state.jumps < 2) {
    state.vel.y = 15.6;
    state.jumps++;
    showToast('DOUBLE JUMP');
    bumpCombo(0.3);
    sfxJump();
    triggerFlip('x', -1);
  } else return false;
  state.jumpBuffer = 0; state.jumpHold = 0;
  state.deform = -0.17; state.deformVelocity = 8.5;
  emitStreaks(new THREE.Vector3(state.pos.x, state.pos.y + 0.06, state.pos.z), 8, 0, 0.4, 0, 0.7);
  return true;
}
function dash() {
  if (state.dashCooldown > 0 || state.climbing) return;
  const cameraForward = new THREE.Vector3(
    -Math.sin(state.yaw) * Math.cos(state.pitch),
    Math.sin(state.pitch),
    -Math.cos(state.yaw) * Math.cos(state.pitch)
  );
  const cameraRight = new THREE.Vector3(Math.cos(state.yaw), 0, -Math.sin(state.yaw));
  const input = new THREE.Vector3(
    (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0), 0,
    (keys.has('s') ? 1 : 0) - (keys.has('w') ? 1 : 0)
  );
  state.dashDir.copy(
    input.lengthSq()
      ? cameraRight.multiplyScalar(input.x).add(cameraForward.multiplyScalar(-input.z)).normalize()
      : cameraForward
  );
  state.dashTime = 0.22;
  state.dashCooldown = 1.85;
  state.deform = 0.2; state.deformVelocity = 4.5;
  state.wallRunning = false;
  if (Math.abs(state.dashDir.y) > 0.08) {
    state.grounded = false;
    state.vel.y = state.dashDir.y * 40;
  }
  emitStreaks(new THREE.Vector3(state.pos.x, state.pos.y + 0.8, state.pos.z), 18, -state.dashDir.x, 0.05, -state.dashDir.z, 3.3);
  showToast('DASH');
  bumpCombo(0.4);
  sfxDash();
  screenShake = 0.12;
  addScore(40);
  if (!state.grounded) triggerFlip('x', state.dashDir.y > 0 ? -1 : 1);
}
function moveAxis(axis, amount) {
  state.pos[axis] += amount;
  if (axis === 'x') state.pos.x = THREE.MathUtils.clamp(state.pos.x, -80, 80);
}

function resolveWallCollisions() {
  const radius = 0.38, feet = state.pos.y, head = feet + 1.72;
  let bestWall = null;
  let bestOverlap = 0;

  const nearbyWalls = gridQuery(spatial.walls, state.pos.x, state.pos.z, 1);
  for (const wall of nearbyWalls) {
    if (head <= wall.bottom + 0.02 || feet >= wall.top - 0.05) continue;
    const local = worldToLocal(wall, state.pos.x, state.pos.z);
    const overlapX = wall.w / 2 + radius - Math.abs(local.x);
    const overlapZ = wall.d / 2 + radius - Math.abs(local.z);
    if (overlapX <= 0 || overlapZ <= 0) continue;

    let nx = 0, nz = 0;
    if (overlapX < overlapZ) {
      nx = Math.sign(local.x) || 1;
      local.x = nx * (wall.w / 2 + radius);
    } else {
      nz = Math.sign(local.z) || 1;
      local.z = nz * (wall.d / 2 + radius);
    }
    const world = localToWorld(wall.x, wall.z, wall.yaw, local.x, local.z);
    state.pos.x = world.x; state.pos.z = world.z;
    const c = Math.cos(wall.yaw), s = Math.sin(wall.yaw);
    const normal = new THREE.Vector3(c * nx + s * nz, 0, -s * nx + c * nz);
    state.wallNormal.copy(normal);
    state.wallTime = 0.22;

    const overlap = Math.min(overlapX, overlapZ);
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestWall = wall;
    }
  }
  state.pos.x = THREE.MathUtils.clamp(state.pos.x, -80, 80);
  return bestWall;
}

// Ledge detection & climb-up (mantle)
function tryLedgeClimb() {
  if (state.grounded || state.climbing || state.vel.y > 4) return;
  const radius = 0.4;
  const probeY = state.pos.y + 1.05; // chest / head height

  const nearPlats = gridQuery(spatial.platforms, state.pos.x, state.pos.z, 1);
  for (const platform of nearPlats) {
    const local = worldToLocal(platform, state.pos.x, state.pos.z);
    const halfW = platform.w / 2;
    const halfD = platform.d / 2;

    // Check if we are just outside the platform horizontally but close
    const outsideX = Math.abs(local.x) > halfW && Math.abs(local.x) < halfW + 0.55;
    const outsideZ = Math.abs(local.z) > halfD && Math.abs(local.z) < halfD + 0.55;
    const insideX = Math.abs(local.x) <= halfW + 0.15;
    const insideZ = Math.abs(local.z) <= halfD + 0.15;

    // Near an edge
    if (!((outsideX && insideZ) || (outsideZ && insideX) || (outsideX && outsideZ))) continue;

    // Vertical: feet below top, but head/chest near or above top
    if (state.pos.y > platform.top + 0.15) continue;
    if (state.pos.y + 1.72 < platform.top - 0.1) continue;
    if (Math.abs(state.pos.y + 0.95 - platform.top) > 0.95) continue;

    // Start climb
    state.climbing = true;
    state.climbProgress = 0;
    state.climbTarget = {
      x: state.pos.x,
      y: platform.top,
      z: state.pos.z,
      // Pull slightly inward
      pullX: platform.x,
      pullZ: platform.z
    };
    // Snap horizontal a bit inward
    const inward = worldToLocal(platform, state.pos.x, state.pos.z);
    if (Math.abs(inward.x) > halfW) inward.x = Math.sign(inward.x) * (halfW - 0.15);
    if (Math.abs(inward.z) > halfD) inward.z = Math.sign(inward.z) * (halfD - 0.15);
    const pulled = localToWorld(platform.x, platform.z, platform.yaw, inward.x, inward.z);
    state.climbTarget.x = pulled.x;
    state.climbTarget.z = pulled.z;
    state.vel.set(0, 0, 0);
    sfxClimb();
    showToast('CLIMB');
    return;
  }
}

function rampHeightAt(ramp, x, z) {
  const local = worldToLocal(ramp, x, z);
  return ramp.baseTop + ramp.rise * THREE.MathUtils.clamp((ramp.d / 2 - local.z) / ramp.d, 0, 1);
}
function hasSupportAt(x, y, z) {
  for (const ramp of gridQuery(spatial.ramps, x, z, 1)) {
    const local = worldToLocal(ramp, x, z);
    if (Math.abs(local.x) > 0.5 * ramp.w + 0.3 || Math.abs(local.z) > 0.5 * ramp.d + 0.3) continue;
    const surface = rampHeightAt(ramp, x, z);
    if (y <= surface + 0.3 && y >= ramp.baseTop - 0.25) return { top: surface, ramp };
  }
  for (const platform of gridQuery(spatial.platforms, x, z, 1)) {
    const local = worldToLocal(platform, x, z);
    if (Math.abs(local.x) <= platform.w / 2 + 0.3 && Math.abs(local.z) <= platform.d / 2 + 0.3 && Math.abs(y - platform.top) < 0.25)
      return { top: platform.top, platform };
  }
  return null;
}
function intersectsPlayer(box) {
  const local = worldToLocal(box, state.pos.x, state.pos.z);
  return Math.abs(local.x) < box.w / 2 + 0.38 && Math.abs(local.z) < box.d / 2 + 0.38 &&
    state.pos.y + 1.72 > box.bottom && state.pos.y < box.top;
}

// ─── Main tick ────────────────────────────────────────────────────────────────
const cameraTarget = new THREE.Vector3();
const desiredCamera = new THREE.Vector3();
const windDirection = new THREE.Vector3();

function tick(dt) {
  if (paused || levelCompleteOpen) return;
  visualTime += dt;
  levelTimer += dt;

  // Only animate nearby decorations (huge win on long levels)
  const nearHalos = gridQuery(spatial.platforms, state.pos.x, state.pos.z, 2);
  for (const platform of nearHalos) if (platform.halo) platform.halo.rotation.z = visualTime * 0.8;
  if (goal) {
    const gdx = goal.x - state.pos.x, gdz = goal.z - state.pos.z;
    if (gdx * gdx + gdz * gdz < 80 * 80) {
      goal.ring.rotation.z = Math.sin(visualTime * 0.95) * 0.08;
      goal.glow.intensity = 17 + Math.sin(visualTime * 2.1) * 3;
    }
  }
  for (const bp of gridQuery(spatial.bounce, state.pos.x, state.pos.z, 2)) {
    if (bp.ring) {
      bp.ring.rotation.z = visualTime * 1.4;
      bp.ring.scale.setScalar(1 + Math.sin(visualTime * 3) * 0.06);
    }
  }
  for (const orb of gridQuery(spatial.orbs, state.pos.x, state.pos.z, 2)) {
    if (orb.collected) continue;
    orb.bob += dt * 2.2;
    orb.mesh.position.y = orb.y + Math.sin(orb.bob) * 0.22;
    orb.mesh.rotation.y += dt * 1.8;
    orb.mesh.rotation.x = Math.sin(orb.bob * 0.7) * 0.25;
    if (orb.glow) orb.glow.position.copy(orb.mesh.position);
  }

  // Climbing mantle
  if (state.climbing && state.climbTarget) {
    state.climbProgress = Math.min(1, state.climbProgress + dt * 3.2);
    const t = state.climbProgress;
    const ease = t * t * (3 - 2 * t);
    state.pos.x = THREE.MathUtils.lerp(state.pos.x, state.climbTarget.x, ease * 0.4);
    state.pos.z = THREE.MathUtils.lerp(state.pos.z, state.climbTarget.z, ease * 0.4);
    state.pos.y = THREE.MathUtils.lerp(state.pos.y, state.climbTarget.y, ease);
    state.vel.set(0, 0, 0);
    if (t >= 1) {
      state.pos.y = state.climbTarget.y;
      state.grounded = true;
      state.jumps = 0;
      state.climbing = false;
      state.climbTarget = null;
      state.deform = -0.12;
      emitStreaks(new THREE.Vector3(state.pos.x, state.pos.y + 0.05, state.pos.z), 10, 0, 0.5, 0, 0.9);
      addScore(30);
    }
    player.position.copy(state.pos);
    // Still update camera during climb
    updateCameraAndAnim(dt, 0, 0);
    return;
  }

  // Input & movement
  const forward = new THREE.Vector3(-Math.sin(state.yaw), 0, -Math.cos(state.yaw));
  const right = new THREE.Vector3(Math.cos(state.yaw), 0, -Math.sin(state.yaw));
  const input = new THREE.Vector3(
    (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0), 0,
    (keys.has('s') ? 1 : 0) - (keys.has('w') ? 1 : 0)
  );
  if (input.lengthSq() > 1) input.normalize();
  const wish = right.multiplyScalar(input.x).add(forward.multiplyScalar(-input.z));
  const sprint = keys.has('shift');
  const speed = sprint ? 20.2 : 12.8;

  // Wall run detection & logic
  let onWall = null;
  if (!state.grounded && state.wallTime > 0 && state.dashTime <= 0) {
    onWall = resolveWallCollisions();
    const pressingIntoWall = wish.lengthSq() > 0.1 && wish.dot(state.wallNormal) < -0.25;
    const movingAlong = Math.abs(wish.dot(new THREE.Vector3(-state.wallNormal.z, 0, state.wallNormal.x))) > 0.2;

    if ((pressingIntoWall || movingAlong || keys.has('w')) && state.wallTime > 0.02) {
      if (!state.wallRunning) {
        state.wallRunning = true;
        state.wallRunTime = 0;
        sfxWall();
        showToast('WALL RUN');
        bumpCombo(0.2);
      }
      state.wallRunTime += dt;
      // Stick to wall and allow horizontal movement along it
      const along = new THREE.Vector3(-state.wallNormal.z, 0, state.wallNormal.x);
      const alongInput = wish.dot(along);
      const runSpeed = 14 + (sprint ? 3 : 0);
      state.vel.x = THREE.MathUtils.damp(state.vel.x, along.x * alongInput * runSpeed - state.wallNormal.x * 2, 12, dt);
      state.vel.z = THREE.MathUtils.damp(state.vel.z, along.z * alongInput * runSpeed - state.wallNormal.z * 2, 12, dt);
      // Reduced gravity while wall running
      if (state.vel.y < 0) state.vel.y = Math.max(state.vel.y - 8 * dt, -6);
      else state.vel.y = Math.max(state.vel.y - 14 * dt, -6);
      // Time limit on wall run
      if (state.wallRunTime > 1.8) {
        state.wallRunning = false;
      }
    } else {
      state.wallRunning = false;
    }
  } else {
    state.wallRunning = false;
  }

  if (state.dashTime > 0) {
    state.dashTime = Math.max(0, state.dashTime - dt);
    state.vel.x = state.dashDir.x * 40;
    state.vel.y = state.dashDir.y * 40;
    state.vel.z = state.dashDir.z * 40;
  } else if (state.grounded) {
    const moving = input.lengthSq() > 0;
    const reversing = moving && state.vel.x * wish.x + state.vel.z * wish.z < 0;
    const traction = moving ? (reversing ? 24 : 16) : 5.8;
    state.vel.x = THREE.MathUtils.damp(state.vel.x, wish.x * speed, traction, dt);
    state.vel.z = THREE.MathUtils.damp(state.vel.z, wish.z * speed, traction, dt);
  } else if (!state.wallRunning && input.lengthSq() > 0) {
    const airSpeed = speed * 0.9;
    state.vel.x = THREE.MathUtils.damp(state.vel.x, wish.x * airSpeed, 4.0, dt);
    state.vel.z = THREE.MathUtils.damp(state.vel.z, wish.z * airSpeed, 4.0, dt);
  } else if (!state.wallRunning) {
    const airDrag = Math.exp(-0.4 * dt);
    state.vel.x *= airDrag; state.vel.z *= airDrag;
  }

  state.dashCooldown = Math.max(0, state.dashCooldown - dt);
  state.wallTime = Math.max(0, state.wallTime - dt);
  state.jumpBuffer = Math.max(0, state.jumpBuffer - dt);
  if (state.grounded) state.coyote = 0.14;
  else state.coyote = Math.max(0, state.coyote - dt);

  // Combo decay
  if (comboTimer > 0) {
    comboTimer -= dt;
    if (comboTimer <= 0) {
      combo = Math.max(1, combo - 0.5);
      if (combo <= 1.05) { combo = 1; flowActive = false; }
      document.querySelector('#combo').textContent = `x${combo.toFixed(1)}`;
      comboTimer = combo > 1 ? 1.2 : 0;
    }
  }

  // Gravity & landing
  const previousY = state.pos.y;
  if (!state.grounded && !state.wallRunning) {
    let gravity = state.wallTime > 0 && state.vel.y < 0 ? 9.5 : 26.5;
    if (state.vel.y > 0 && keys.has(' ') && state.jumpHold < 0.22) {
      gravity = 17.5;
      state.jumpHold += dt;
    }
    state.vel.y = Math.max(state.vel.y - gravity * dt, -44);
  }
  state.pos.y += state.vel.y * dt;

  let landing = null;
  if (state.vel.y <= 0 && !state.wallRunning) {
    for (const platform of gridQuery(spatial.platforms, state.pos.x, state.pos.z, 1)) {
      const local = worldToLocal(platform, state.pos.x, state.pos.z);
      if (Math.abs(local.x) > 0.32 + platform.w / 2 || Math.abs(local.z) > 0.32 + platform.d / 2) continue;
      if (previousY >= platform.top - 0.08 && state.pos.y <= platform.top && (!landing || platform.top > landing.top))
        landing = { top: platform.top, platform };
    }
    for (const ramp of gridQuery(spatial.ramps, state.pos.x, state.pos.z, 1)) {
      const local = worldToLocal(ramp, state.pos.x, state.pos.z);
      if (Math.abs(local.x) > 0.32 + ramp.w / 2 || Math.abs(local.z) > 0.32 + ramp.d / 2) continue;
      const top = rampHeightAt(ramp, state.pos.x, state.pos.z);
      if (previousY >= top - 0.08 && state.pos.y <= top && (!landing || top > landing.top))
        landing = { top, ramp };
    }
    if (landing) {
      if (!state.grounded) {
        state.deform = -Math.min(0.44, 0.12 + Math.abs(state.vel.y) * 0.017);
        state.deformVelocity = 2.4;
        emitStreaks(new THREE.Vector3(state.pos.x, landing.top + 0.06, state.pos.z), 14, 0, 0.75, 0, 1.3);
        sfxLand();
        if (Math.abs(state.vel.y) > 12) screenShake = Math.min(0.25, Math.abs(state.vel.y) * 0.012);
        if (landing.platform) activateCheckpoint(landing.platform);
        addScore(15);
      }
      state.pos.y = landing.top;
      state.vel.y = 0;
      state.grounded = true;
      state.jumps = 0;
      state.jumpHold = 0;
      state.wallRunning = false;
    } else state.grounded = false;
  }

  if (!state.wallRunning) {
    moveAxis('x', state.vel.x * dt);
    moveAxis('z', state.vel.z * dt);
  } else {
    // Still move while wall running
    moveAxis('x', state.vel.x * dt);
    moveAxis('z', state.vel.z * dt);
  }
  resolveWallCollisions();

  // Ledge climb attempt
  if (!state.grounded && !state.climbing) tryLedgeClimb();

  if (state.grounded) {
    const support = hasSupportAt(state.pos.x, state.pos.y, state.pos.z);
    if (!support) { state.grounded = false; state.coyote = 0.14; }
    else if (support.ramp) { state.pos.y = support.top; state.vel.y = 0; }
  }

  // Dash pads
  state.padCooldown = Math.max(0, state.padCooldown - dt);
  if (state.grounded && state.padCooldown === 0) {
    for (const pad of gridQuery(spatial.dash, state.pos.x, state.pos.z, 1)) {
      const local = worldToLocal(pad, state.pos.x, state.pos.z);
      if (Math.abs(local.x) > pad.w / 2 || Math.abs(local.z) > pad.d / 2 || Math.abs(state.pos.y - pad.top) > 0.22) continue;
      const dirX = -Math.sin(pad.yaw), dirZ = -Math.cos(pad.yaw);
      state.dashDir.set(dirX, 0.32, dirZ).normalize();
      state.vel.x = state.dashDir.x * 34;
      state.vel.z = state.dashDir.z * 34;
      state.vel.y = state.dashDir.y * 34;
      state.dashTime = 0.17;
      state.padCooldown = 0.5;
      state.grounded = false; state.jumps = 1; state.jumpHold = 0.22;
      state.deform = 0.22; state.deformVelocity = 4.5;
      emitStreaks(new THREE.Vector3(state.pos.x, state.pos.y + 0.4, state.pos.z), 18, -dirX, 0.15, -dirZ, 2.8);
      showToast('BOOST');
      bumpCombo(0.45);
      sfxDashPad();
      addScore(60);
      break;
    }
  }

  // Bounce pads
  if (state.padCooldown === 0) {
    for (const pad of gridQuery(spatial.bounce, state.pos.x, state.pos.z, 1)) {
      const local = worldToLocal(pad, state.pos.x, state.pos.z);
      if (Math.abs(local.x) > pad.w / 2 + 0.15 || Math.abs(local.z) > pad.d / 2 + 0.15) continue;
      if (state.pos.y > pad.top + 0.4 || state.pos.y < pad.top - 0.3) continue;
      if (state.vel.y > 4) continue;
      state.vel.y = 26;
      state.grounded = false; state.jumps = 1;
      state.padCooldown = 0.35;
      state.deform = -0.28; state.deformVelocity = 10;
      emitStreaks(new THREE.Vector3(state.pos.x, pad.top + 0.2, state.pos.z), 16, 0, 1.2, 0, 1.8);
      showToast('BOUNCE');
      bumpCombo(0.5);
      sfxBounce();
      addScore(80);
      screenShake = 0.18;
      triggerFlip('x', -1);
      break;
    }
  }

  // Collect orbs
  for (const orb of gridQuery(spatial.orbs, state.pos.x, state.pos.z, 1)) {
    if (orb.collected) continue;
    const dx = state.pos.x - orb.mesh.position.x;
    const dy = (state.pos.y + 0.9) - orb.mesh.position.y;
    const dz = state.pos.z - orb.mesh.position.z;
    if (dx * dx + dy * dy + dz * dz < 1.6) {
      orb.collected = true;
      orb.mesh.visible = false;
      if (orb.glow) orb.glow.intensity = 0;
      orbsCollected++;
      document.querySelector('#orbs-collected').textContent = orbsCollected + ' ORBS';
      addScore(120);
      bumpCombo(0.3);
      sfxCollect();
      emitStreaks(orb.mesh.position.clone(), 12, 0, 0.8, 0, 1.5);
    }
  }

  if (state.jumpBuffer > 0 && state.grounded) performJump();

  const nearDeath = gridQuery(spatial.death, state.pos.x, state.pos.z, 1);
  if (nearDeath.some(intersectsPlayer) || state.pos.y < -14) respawn();

  if (monster) {
    levelElapsed += dt;
    const toPlayer = new THREE.Vector3(state.pos.x - monster.root.position.x, 0, state.pos.z - monster.root.position.z);
    const distance = toPlayer.length();
    if (distance > 0.01) monster.root.position.addScaledVector(toPlayer, Math.min(1, monster.speed * dt / distance));
    monster.root.position.y = THREE.MathUtils.damp(monster.root.position.y, state.pos.y + 1.55 + Math.sin(levelElapsed * 6.5) * 0.25, 7.5, dt);
    monster.root.rotation.y = Math.atan2(-(state.pos.x - monster.root.position.x), -(state.pos.z - monster.root.position.z));
    if (Math.abs(monster.root.position.x - state.pos.x) < 2.4 &&
        Math.abs(monster.root.position.z - state.pos.z) < 2.8 &&
        Math.abs(monster.root.position.y - (state.pos.y + 1)) < 2.3) {
      respawn();
    }
  }

  if (goal) {
    const localGoal = worldToLocal(goal, state.pos.x, state.pos.z);
    if (Math.abs(localGoal.x) < 2.5 && Math.abs(localGoal.z) < 2.4 &&
        state.pos.y > goal.top - 0.4 && state.pos.y < goal.top + 3.6) {
      addScore(500 + Math.max(0, 400 - Math.floor(levelTimer * 4)));
      openLevelComplete();
    }
  }

  player.position.copy(state.pos);
  const horizontalSpeed = Math.hypot(state.vel.x, state.vel.z);
  updateCameraAndAnim(dt, horizontalSpeed, wish);
}

function updateCameraAndAnim(dt, horizontalSpeed, wish) {
  const speedRatio = THREE.MathUtils.clamp(horizontalSpeed / 20.2, 0, 1);
  const acceleration = THREE.MathUtils.clamp((horizontalSpeed - state.lastSpeed) / Math.max(dt, 0.001), -40, 40);
  state.lastSpeed = horizontalSpeed;

  const facing = state.dashTime > 0 ? state.dashDir : (horizontalSpeed > 0.55 ? state.vel : (wish || new THREE.Vector3()));
  if (facing.lengthSq() > 0.04) {
    const targetYaw = Math.atan2(-facing.x, -facing.z);
    const delta = Math.atan2(Math.sin(targetYaw - state.facingYaw), Math.cos(targetYaw - state.facingYaw));
    // Snappier facing
    state.facingYaw += delta * (1 - Math.exp(-18 * dt));
  }
  player.rotation.y = state.facingYaw;

  // Flip animation
  if (state.flipTime > 0) {
    state.flipTime = Math.max(0, state.flipTime - dt);
    const flipProgress = 1 - state.flipTime / 0.55;
    const angle = flipProgress * Math.PI * 2 * state.flipDir;
    if (state.flipAxis === 'x') {
      flipRoot.rotation.x = angle;
      flipRoot.rotation.z = 0;
    } else {
      flipRoot.rotation.z = angle;
      flipRoot.rotation.x = 0;
    }
    if (state.flipTime <= 0) flipRoot.rotation.set(0, 0, 0);
  }

  const runWeight = state.grounded ? THREE.MathUtils.clamp(horizontalSpeed / 2.1, 0, 1) : 0;
  if (runWeight > 0.01) state.runPhase += dt * (keys.has('shift') ? 19 : 13.5);
  const airborne = state.grounded ? 0 : 1;
  const dashPose = state.dashTime > 0 ? 1 : 0;
  const jumpPose = state.grounded ? 0 : THREE.MathUtils.clamp(state.vel.y / 17, 0, 1);
  const wallPose = state.wallRunning ? 1 : 0;
  const accelLean = THREE.MathUtils.clamp(acceleration * 0.004, -0.17, 0.17);

  motionRoot.rotation.x = THREE.MathUtils.damp(motionRoot.rotation.x,
    (0.12 + Math.sin(state.runPhase * 2) * 0.055) * runWeight + accelLean + 0.74 * dashPose - 0.35 * jumpPose + wallPose * 0.25, 16, dt);
  motionRoot.rotation.y = THREE.MathUtils.damp(motionRoot.rotation.y, Math.sin(state.runPhase) * 0.07 * runWeight, 14, dt);
  motionRoot.rotation.z = THREE.MathUtils.damp(motionRoot.rotation.z,
    Math.sin(state.runPhase * 2) * 0.13 * runWeight + (state.wallRunning ? state.wallNormal.x * 0.35 : 0), 14, dt);

  if (horizontalSpeed > 8 || dashPose || state.wallRunning) {
    state.windClock += dt * (dashPose ? 58 : horizontalSpeed * 0.9);
    while (state.windClock >= 1) {
      windDirection.set(
        state.dashTime > 0 ? state.dashDir.x : state.vel.x, 0,
        state.dashTime > 0 ? state.dashDir.z : state.vel.z
      );
      if (windDirection.lengthSq() > 0.01) windDirection.normalize();
      emitStreaks(
        new THREE.Vector3(state.pos.x - windDirection.x * 0.5, state.pos.y + 0.45 + Math.random() * 0.9, state.pos.z - windDirection.z * 0.5),
        1, -windDirection.x, 0.06, -windDirection.z, 0.95
      );
      state.windClock -= 1;
    }
  } else state.windClock = 0;

  updateStreaks(dt);

  const bob = runWeight > 0.01 ? Math.abs(Math.sin(state.runPhase * 2)) * 0.078 * runWeight : 0;
  state.deformVelocity += -state.deform * 130 * dt;
  state.deformVelocity *= Math.exp(-14.5 * dt);
  state.deform = THREE.MathUtils.clamp(state.deform + state.deformVelocity * dt, -0.38, 0.44);
  const strideStretch = Math.sin(state.runPhase * 2) * 0.048 * runWeight;
  const verticalStretch = airborne * THREE.MathUtils.clamp(state.vel.y * 0.013, -0.16, 0.24);
  const squash = THREE.MathUtils.clamp(state.deform + strideStretch + verticalStretch + dashPose * 0.09, -0.46, 0.52);
  const widthScale = 1 - squash * 0.47;
  motionRoot.scale.set(widthScale, 1 + squash, widthScale);
  motionRoot.position.y = THREE.MathUtils.damp(motionRoot.position.y, 0.86 + bob, 16, dt);

  // Snappy camera
  cameraZoom = THREE.MathUtils.damp(cameraZoom, cameraZoomTarget, 16, dt);
  if (!firstPerson && cameraZoomTarget < 0.05) firstPerson = true;
  else if (firstPerson && cameraZoomTarget > 1.15) { firstPerson = false; cameraZoom = Math.max(cameraZoom, 1); }
  modelRoot.visible = !firstPerson;

  const targetFov = 84 + dashPose * 6 + Math.max(0, speedRatio - 0.4) * 4 + (flowActive ? 2 : 0) + (state.wallRunning ? 3 : 0);
  camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 8, dt);
  camera.updateProjectionMatrix();

  if (firstPerson) {
    const cp = Math.cos(state.pitch);
    const dx = -Math.sin(state.yaw) * cp, dy = Math.sin(state.pitch), dz = -Math.cos(state.yaw) * cp;
    cameraTarget.set(state.pos.x + dx * 12, state.pos.y + 1.4 + dy * 12, state.pos.z + dz * 12);
    desiredCamera.set(state.pos.x, state.pos.y + 1.4, state.pos.z);
  } else {
    cameraTarget.set(state.pos.x, state.pos.y + 1.15, state.pos.z);
    const horizontal = Math.cos(state.pitch) * cameraZoom;
    desiredCamera.set(
      state.pos.x + Math.sin(state.yaw) * horizontal,
      state.pos.y + 2.2 + Math.sin(-state.pitch) * cameraZoom,
      state.pos.z + Math.cos(state.yaw) * horizontal
    );
  }

  if (screenShake > 0) {
    screenShake = Math.max(0, screenShake - dt * 2.8);
    desiredCamera.x += (Math.random() - 0.5) * screenShake * 0.9;
    desiredCamera.y += (Math.random() - 0.5) * screenShake * 0.7;
  }

  // Much snappier camera follow
  camera.position.lerp(desiredCamera, 1 - Math.exp(-22 * dt));
  camera.lookAt(cameraTarget);
  fill.position.set(state.pos.x + 6, state.pos.y + 8, state.pos.z - 8);
  // Keep directional shadow locked on the player so it never disappears
  sunTarget.position.set(state.pos.x, state.pos.y, state.pos.z);
  sun.position.set(state.pos.x - 18, state.pos.y + 30, state.pos.z + 16);

  // Distance-based visibility for platform groups (cuts draw calls on long routes)
  const visRange = 55;
  const visRangeSq = visRange * visRange;
  for (const p of platforms) {
    if (!p.group) continue;
    const dx = p.x - state.pos.x, dz = p.z - state.pos.z;
    const far = dx * dx + dz * dz > visRangeSq;
    if (p.group.visible === far) p.group.visible = !far; // only write when changed
  }

  // HUD
  document.querySelector('#speed').textContent = String(Math.round(horizontalSpeed * 3.6)).padStart(2, '0');
  document.querySelector('#speed-fill').style.width = Math.min(horizontalSpeed / 32 * 100, 100) + '%';
  document.querySelectorAll('#jumps i').forEach((pip, index) =>
    pip.classList.toggle('on', state.grounded || index < 2 - state.jumps)
  );
  document.querySelector('#dash-dot').parentElement.classList.toggle('cooldown', state.dashCooldown > 0);
  document.querySelector('#dash-label').textContent = state.dashCooldown > 0 ? state.dashCooldown.toFixed(1) + 'S' : 'READY';
  document.querySelector('#timer').textContent = formatTime(levelTimer);

  const motion = document.querySelector('.bottom-left');
  const flowState = horizontalSpeed > 15.5 && state.dashTime <= 0;
  motion.classList.toggle('airborne', !state.grounded);
  motion.classList.toggle('dashing', state.dashTime > 0);
  motion.classList.toggle('flow', flowState || flowActive || state.wallRunning);
  document.querySelector('#motion-state').textContent =
    state.climbing ? 'CLIMBING' :
    state.dashTime > 0 ? 'DASHING' :
    state.wallRunning ? 'WALL RUN' :
    flowState || flowActive ? 'FLOW' :
    state.grounded ? (keys.has('shift') && horizontalSpeed > 1 ? 'SPRINTING' : 'GROUNDED') :
    state.wallTime > 0 ? 'WALL SLIDE' : 'AIRBORNE';

  updateLevelHud();
}

// ─── Loop (target 60+ FPS) ────────────────────────────────────────────────────
let previous = performance.now();
let shadowFrame = 0;
// Throttle shadow map updates — big GPU saver on long levels
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;

function frame(now) {
  requestAnimationFrame(frame);
  // Cap dt so physics stays stable; don't spiral if a frame spikes
  const dt = Math.min((now - previous) / 1000, 0.028);
  previous = now;
  tick(dt);

  // Update shadows every 2 frames while moving (still looks solid, much cheaper)
  shadowFrame++;
  if (shadowFrame % 2 === 0) {
    renderer.shadowMap.needsUpdate = true;
  }

  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
});
