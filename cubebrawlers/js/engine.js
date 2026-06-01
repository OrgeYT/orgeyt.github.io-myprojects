import * as THREE from "three";
import { Assets } from "./assets.js";

export const Engine = {
  THREE,
  scene: null,
  camera: null,
  renderer: null,
  characters: [],
  player: null,
  time: 0,
  lastTime: performance.now(),
  isLocked: false,
  // Spectate mode flag (when true, camera becomes a free-flying first-person spectator)
  spectating: false,
  mapRadius: 40,
  gravity: -30,
  ui: null, // injected later
  input: null, // injected later
  idleCamTime: 0,
  // Simple sound manager container (initialized in initEngine)
  sounds: null,
  updateIdleCamera(dt) {
    // Smooth orbiting camera for title/pause screen when pointer isn't locked
    if (this.isLocked) return;
    this.idleCamTime += dt;
    const t = this.idleCamTime;
    const radius = 30;
    const height = 12 + Math.sin(t * 0.35) * 3;
    const angle = t * 0.25;
    const camPos = new this.THREE.Vector3(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
    if (this.camera) {
      // ease camera movement
      this.camera.position.lerp(camPos, Math.min(1, dt * 1.5));
      // always look near arena center but slightly above for a cinematic feel
      const lookAt = new this.THREE.Vector3(0, 2, 0);
      this.camera.lookAt(lookAt);
    }
  }
};

export function initEngine(canvas) {
  const THREE = Engine.THREE;
  Engine.scene = new THREE.Scene();
  Engine.scene.background = new THREE.Color(0x87CEEB);
  Engine.scene.fog = new THREE.Fog(0x87CEEB, 20, 80);

  Engine.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  Engine.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  Engine.renderer.setSize(window.innerWidth, window.innerHeight);
  Engine.renderer.shadowMap.enabled = true;
  Engine.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Initialize simple SoundManager with background music switching
  class SoundManager {
    constructor() {
      this.sounds = {};
      this.looping = {};
      this._promises = [];
      this.currentMusic = null; // name of currently-playing looping music
    }
    // return a Promise that resolves when the audio is ready to play (canplaythrough) or rejects on error
    load(name, src, loop = false, volume = 1.0) {
      const a = new Audio();
      a.src = src;
      a.loop = !!loop;
      a.volume = volume;
      this.sounds[name] = a;

      const p = new Promise((resolve, reject) => {
        const onReady = () => {
          cleanup();
          resolve(a);
        };
        const onError = (e) => {
          cleanup();
          // resolve anyway so loading doesn't block UI forever; keep the audio object though
          resolve(a);
        };
        const cleanup = () => {
          a.removeEventListener('canplaythrough', onReady);
          a.removeEventListener('error', onError);
        };
        a.addEventListener('canplaythrough', onReady, { once: true });
        a.addEventListener('error', onError, { once: true });
        // start loading
        a.load();
      });
      this._promises.push(p);
      return p;
    }
    whenReady() {
      return Promise.all(this._promises);
    }
    play(name) {
      const s = this.sounds[name];
      if (!s) return;
      try {
        // clone for overlapping one-shots
        if (!s.loop) {
          const c = s.cloneNode();
          c.volume = s.volume;
          c.play().catch(()=>{});
        } else {
          if (!this.looping[name]) {
            s.currentTime = 0;
            s.play().catch(()=>{});
            this.looping[name] = s;
            this.currentMusic = name;
          }
        }
      } catch (e) {}
    }
    stop(name) {
      const s = this.sounds[name];
      if (!s) return;
      try {
        if (s.loop) { s.pause(); s.currentTime = 0; this.looping[name] = null; if (this.currentMusic === name) this.currentMusic = null; }
      } catch (e) {}
    }
    // Switch background music: stop current looping track and start the requested loop (if it exists).
    playMusic(name) {
      if (!name) return;
      // stop any currently-looping music
      if (this.currentMusic && this.currentMusic !== name) {
        this.stop(this.currentMusic);
      }
      this.play(name);
    }
    // stop current bg music
    stopMusic() {
      // Stop all looping tracks to ensure no music remains playing (handles cases where looping entries linger)
      for (const name in this.looping) {
        const s = this.looping[name];
        try {
          if (s && !s.paused) s.pause();
          if (s) s.currentTime = 0;
        } catch (e) {}
        this.looping[name] = null;
      }
      this.currentMusic = null;
    }
  }
  Engine.sounds = new SoundManager();
  // load assets (files are in project root) and track promises
  Engine.sounds.load('Slam', Assets.Slam, false, 0.9);
  Engine.sounds.load('UltTransform', Assets.UltTransform, false, 0.9);
  Engine.sounds.load('HardPunch', Assets.HardPunch, false, 0.9);
  Engine.sounds.load('Punch', Assets.Punch, false, 0.8);
  Engine.sounds.load('Moving', Assets.Moving, true, 0.5);
  Engine.sounds.load('Dash', Assets.Dash, false, 0.9);
  // background music tracks (looping)
  Engine.sounds.load('BgmNormal', Assets.BgmNormal, true, 0.6);
  Engine.sounds.load('BgmUlt', Assets.BgmUlt, true, 0.7);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  Engine.scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(50, 100, 50);
  dirLight.castShadow = true;
  dirLight.shadow.camera.top = 50;
  dirLight.shadow.camera.bottom = -50;
  dirLight.shadow.camera.left = -50;
  dirLight.shadow.camera.right = 50;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  Engine.scene.add(dirLight);

  buildMap();
  window.addEventListener('resize', onWindowResize);

  return Engine;
}

function buildMap(mapName = 'default') {
  const THREE = Engine.THREE;

  // Remove any existing map group
  if (Engine.mapGroup) {
    Engine.scene.remove(Engine.mapGroup);
    Engine.mapGroup.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose && m.dispose());
        else o.material.dispose && o.material.dispose();
      }
    });
  }

  const group = new THREE.Group();
  Engine.mapGroup = group;

  // map presets
  let mapRadius = 40;
  if (mapName === 'small') mapRadius = 20;
  else if (mapName === 'forest') mapRadius = 50;
  else if (mapName === 'wide') mapRadius = 80;

  Engine.mapRadius = mapRadius;

  // ground
  const groundGeo = new THREE.CylinderGeometry(mapRadius, mapRadius, 2, 32);
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x4ade80 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.position.y = -1;
  ground.receiveShadow = true;
  group.add(ground);

  // arena center ring (size varies slightly)
  const arenaSize = mapName === 'small' ? 10 : (mapName === 'forest' ? 18 : 15);
  const arenaGeo = new THREE.CylinderGeometry(arenaSize, arenaSize, 2.1, 32);
  const arenaMat = new THREE.MeshLambertMaterial({ color: 0x94a3b8 });
  const arena = new THREE.Mesh(arenaGeo, arenaMat);
  arena.position.y = -1;
  arena.receiveShadow = true;
  group.add(arena);

  // decorative rocks density scales with map
  const rockGeo = new THREE.DodecahedronGeometry(2);
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x64748b });
  const rockCount = mapName === 'small' ? 12 : (mapName === 'wide' ? 40 : 30);
  for (let i = 0; i < rockCount; i++) {
    const angle = (i / rockCount) * Math.PI * 2 + Math.random() * 0.5;
    const dist = Math.max(5, mapRadius - (2 + Math.random() * 6));
    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.position.set(
      Math.cos(angle) * dist,
      1,
      Math.sin(angle) * dist
    );
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.scale.set(1 + Math.random(), 1 + Math.random(), 1 + Math.random());
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
  }

  // Trees for forest / wide variants
  if (mapName === 'forest' || mapName === 'wide') {
    const trunkGeo = new THREE.CylinderGeometry(0.5, 0.7, 4);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x78350f });
    const leavesGeo = new THREE.SphereGeometry(3, 8, 8);
    const leavesMat = new THREE.MeshLambertMaterial({ color: 0x15803d });
    const treeCount = mapName === 'forest' ? 24 : 12;

    for (let i = 0; i < treeCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 10 + Math.random() * (mapRadius - 14);

      const tree = new THREE.Group();

      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 2;
      trunk.castShadow = true;
      tree.add(trunk);

      const leaves = new THREE.Mesh(leavesGeo, leavesMat);
      leaves.position.y = 5;
      leaves.castShadow = true;
      tree.add(leaves);

      tree.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
      group.add(tree);
    }
  }

  Engine.scene.add(group);
}

function onWindowResize() {
  Engine.camera.aspect = window.innerWidth / window.innerHeight;
  Engine.camera.updateProjectionMatrix();
  Engine.renderer.setSize(window.innerWidth, window.innerHeight);
}

// Public API to switch maps at runtime
export function setMap(name) {
  buildMap(name);
  // clamp characters inside new bounds
  for (const c of Engine.characters) {
    if (!c.pivot) continue;
    const pos = c.pivot.position;
    const len = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
    const limit = Engine.mapRadius - 1;
    if (len > limit) {
      pos.setLength(limit);
      c.pivot.position.x = pos.x;
      c.pivot.position.z = pos.z;
    }
    // refresh any UI placement
    if (!c.isPlayer) c.updateFloatingUI();
  }
}