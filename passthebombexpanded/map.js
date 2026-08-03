import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { state } from './state.js';

const faceImg = new Image();
let faceImgLoaded = false;
const faceTextures = [];
faceImg.onload = () => {
  faceImgLoaded = true;
  faceTextures.forEach(t => t.refresh());
};
faceImg.src = 'face.png';

export function createFaceTexture(colorHex) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const tex = new THREE.CanvasTexture(canvas);
  const render = () => {
    if (!faceImgLoaded) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = colorHex || '#000000';
    ctx.fillRect(0, 0, 128, 128);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(faceImg, 0, 0, 128, 128);
    tex.needsUpdate = true;
  };
  tex.refresh = render;
  faceTextures.push(tex);
  render();
  return tex;
}

function createStudTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#4ade80';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.arc(32, 32, 12, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createWhiteStudTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#e5e5e5';
  ctx.beginPath();
  ctx.arc(32, 32, 12, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function buildMap() {
  const { scene, physicsWorld, dirLight } = state;

  state.mapObjects.forEach(obj => {
    scene.remove(obj);
    if(obj.geometry) obj.geometry.dispose();
    if(obj.material) {
      if(Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
      else obj.material.dispose();
    }
  });
  state.physicsBodies.forEach(body => physicsWorld.removeBody(body));
  state.mapObjects = [];
  state.platforms = [];
  state.walls = [];
  state.physicsBodies = [];

  const MAP_SIZE = state.MAP_SIZE;

  const floorGeo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE);
  const tex = createStudTexture();
  tex.repeat.set(MAP_SIZE/4, MAP_SIZE/4);
  const floorMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  state.mapObjects.push(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.4, emissive: 0x1d4ed8, emissiveIntensity: 0.15 });
  const wGeo = new THREE.BoxGeometry(MAP_SIZE, 40, 2);

  const walls = [
    { x: 0, z: -MAP_SIZE/2, rot: 0 },
    { x: 0, z: MAP_SIZE/2, rot: 0 },
    { x: -MAP_SIZE/2, z: 0, rot: Math.PI/2 },
    { x: MAP_SIZE/2, z: 0, rot: Math.PI/2 }
  ];
  walls.forEach(w => {
    const mesh = new THREE.Mesh(wGeo, wallMat);
    mesh.position.set(w.x, 20, w.z);
    mesh.rotation.y = w.rot;
    scene.add(mesh);
    state.mapObjects.push(mesh);
  });

  const platGeo = new THREE.BoxGeometry(8, 1, 8);
  const platMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35, metalness: 0.1, emissive: 0x8a6d00, emissiveIntensity: 0.12 });
  const numPlatforms = Math.floor(25 * state.platformMultiplier * (MAP_SIZE / 100));

  if (state.enablePlatforms) {
    for(let i=0; i<numPlatforms; i++) {
      const mesh = new THREE.Mesh(platGeo, platMat);
      mesh.position.set(
        (Math.random() - 0.5) * (MAP_SIZE - 10),
        2 + Math.random() * 20,
        (Math.random() - 0.5) * (MAP_SIZE - 10)
      );
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      scene.add(mesh);

      state.platforms.push({
        mesh: mesh,
        box: new THREE.Box3().setFromObject(mesh),
        topY: mesh.position.y + 0.5
      });
      state.mapObjects.push(mesh);
    }
  }

  // --- Short walls ---
  if (state.enableWalls) {
    const wallLen = Math.min(14, MAP_SIZE * 0.16);
    const wallHeight = 2.4;
    const wallThick = 1.2;
    const brickMat = new THREE.MeshStandardMaterial({ color: 0x8a5a3b, roughness: 0.7 });
    const numWalls = Math.max(3, Math.floor(MAP_SIZE / 14));
    const pad = 6;

    for (let i = 0; i < numWalls; i++) {
      const angle = Math.random() * Math.PI;
      const halfSpan = (MAP_SIZE / 2) - pad - wallLen / 2;
      const x = (Math.random() - 0.5) * halfSpan * 2;
      const z = (Math.random() - 0.5) * halfSpan * 2;

      const geo = new THREE.BoxGeometry(wallLen, wallHeight, wallThick);
      const mesh = new THREE.Mesh(geo, brickMat);
      mesh.position.set(x, wallHeight / 2, z);
      mesh.rotation.y = angle;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      state.mapObjects.push(mesh);

      const c = Math.cos(angle), s = Math.sin(angle);
      state.walls.push({
        mesh,
        x,
        z,
        angle,
        c,
        s,
        halfW: wallLen / 2,
        halfT: wallThick / 2,
        topY: wallHeight
      });
    }
  }

  // --- Intro Map ---
  const introY = 1000;
  const introGeo = new THREE.CylinderGeometry(40, 40, 2, 32);

  const introTex = createWhiteStudTexture();
  introTex.repeat.set(20, 20);
  const introMat = new THREE.MeshStandardMaterial({ map: introTex, roughness: 0.8 });

  const introFloor = new THREE.Mesh(introGeo, introMat);
  introFloor.position.set(0, introY - 1, 0);
  scene.add(introFloor);
  state.mapObjects.push(introFloor);

  state.platforms.push({
    mesh: introFloor,
    box: new THREE.Box3().setFromObject(introFloor),
    topY: introFloor.position.y + 1,
    isIntro: true
  });

  const ringGeo = new THREE.TorusGeometry(38, 0.5, 16, 64);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.set(0, introY, 0);
  ring.rotation.x = Math.PI/2;
  scene.add(ring);
  state.mapObjects.push(ring);

  const introShape = new CANNON.Box(new CANNON.Vec3(40, 1, 40));
  const introBody = new CANNON.Body({ mass: 0, shape: introShape });
  introBody.position.set(0, introY - 1, 0);
  physicsWorld.addBody(introBody);
  state.physicsBodies.push(introBody);

  dirLight.shadow.camera.left = -MAP_SIZE/2;
  dirLight.shadow.camera.right = MAP_SIZE/2;
  dirLight.shadow.camera.top = MAP_SIZE/2;
  dirLight.shadow.camera.bottom = -MAP_SIZE/2;
  dirLight.shadow.camera.updateProjectionMatrix();
}

function createBomb() {
  const grp = new THREE.Group();
  const geo = new THREE.SphereGeometry(0.6, 16, 16);
  const mat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.25, metalness: 0.6 });
  const mesh = new THREE.Mesh(geo, mat);
  grp.add(mesh);

  const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4), new THREE.MeshBasicMaterial({ color: 0x884400 }));
  fuse.position.y = 0.7;
  grp.add(fuse);

  const spark = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff8800 }));
  spark.position.y = 0.9;
  grp.add(spark);

  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 16), new THREE.MeshBasicMaterial({ color: 0xff2200, transparent: true, opacity: 0.18, depthWrite: false }));
  glow.position.y = 0.9;
  grp.add(glow);

  const light = new THREE.PointLight(0xff4400, 1.5, 12);
  light.position.y = 0.5;
  grp.add(light);

  grp.userData.spark = spark;
  grp.userData.light = light;

  state.bombMesh = grp;
}

function buildHat(type, colorHex) {
  if (!type || type === 'none') return null;
  const hatGroup = new THREE.Group();
  const color = new THREE.Color(colorHex);

  if (type === 'santa') {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.5, 16), new THREE.MeshStandardMaterial({ color: color }));
    cone.position.y = 0.75;
    const brim = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.2, 8, 24), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    brim.rotation.x = Math.PI / 2;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    ball.position.y = 1.5;
    hatGroup.add(cone, brim, ball);
  } else if (type === 'cone') {
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 1.8), new THREE.MeshStandardMaterial({ color: color }));
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.6, 16), new THREE.MeshStandardMaterial({ color: color }));
    cone.position.y = 0.8;
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.4, 16), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    stripe.position.y = 0.7;
    hatGroup.add(base, cone, stripe);
  } else if (type === 'beanie') {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.85, 16, 16, 0, Math.PI*2, 0, Math.PI/2), new THREE.MeshStandardMaterial({ color: color }));
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), new THREE.MeshStandardMaterial({ color: color }));
    ball.position.y = 0.85;
    hatGroup.add(dome, ball);
  } else if (type === 'bomb') {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 16), new THREE.MeshStandardMaterial({ color: color, roughness: 0.2 }));
    mesh.position.y = 0.6;
    const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4), new THREE.MeshBasicMaterial({ color: 0x884400 }));
    fuse.position.y = 1.3;
    const spark = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    spark.position.y = 1.5;
    hatGroup.add(mesh, fuse, spark);
  } else if (type === 'crown') {
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.8, 0.8, 8, 1, true), new THREE.MeshStandardMaterial({ color: color, side: THREE.DoubleSide }));
    crown.position.y = 0.4;
    for (let i=0; i<4; i++) {
      const gem = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), new THREE.MeshStandardMaterial({ color: 0xef4444 }));
      gem.position.set(Math.cos(i*Math.PI/2)*0.9, 0.4, Math.sin(i*Math.PI/2)*0.9);
      hatGroup.add(gem);
    }
    hatGroup.add(crown);
  } else if (type === 'cap') {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 16, 0, Math.PI*2, 0, Math.PI/2), new THREE.MeshStandardMaterial({ color: color }));
    dome.position.y = 0.28;
    const brim = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.7), new THREE.MeshStandardMaterial({ color: color }));
    brim.position.set(0, 0.22, 0.55);
    const button = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), new THREE.MeshStandardMaterial({ color: color }));
    button.position.y = 0.55;
    hatGroup.add(dome, brim, button);
  } else if (type === 'tophat') {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.15, 16), new THREE.MeshStandardMaterial({ color: color }));
    brim.position.y = 0.1;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.9, 16), new THREE.MeshStandardMaterial({ color: color }));
    body.position.y = 0.6;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.61, 0.61, 0.15, 16), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    band.position.y = 0.55;
    hatGroup.add(brim, body, band);
  } else if (type === 'party') {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.2, 16), new THREE.MeshStandardMaterial({ color: color }));
    cone.position.y = 0.6;
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    puff.position.y = 1.25;
    hatGroup.add(cone, puff);
  } else if (type === 'wizard') {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.2, 0.15, 16), new THREE.MeshStandardMaterial({ color: color }));
    brim.position.y = 0.1;
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.6, 16), new THREE.MeshStandardMaterial({ color: color }));
    body.position.y = 0.9;
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xfbbf24, emissiveIntensity: 0.6 }));
    star.position.y = 1.5;
    hatGroup.add(brim, body, star);
  } else if (type === 'sombrero') {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.12, 24), new THREE.MeshStandardMaterial({ color: color }));
    brim.position.y = 0.2;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 16, 0, Math.PI*2, 0, Math.PI/2), new THREE.MeshStandardMaterial({ color: color }));
    dome.position.y = 0.4;
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.06, 8, 24), new THREE.MeshStandardMaterial({ color: 0xfbbf24 }));
    band.rotation.x = Math.PI/2;
    band.position.y = 0.28;
    hatGroup.add(brim, dome, band);
  } else if (type === 'propeller') {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 16, 0, Math.PI*2, 0, Math.PI/2), new THREE.MeshStandardMaterial({ color: color }));
    dome.position.y = 0.28;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.25), new THREE.MeshBasicMaterial({ color: 0x888888 }));
    post.position.y = 0.55;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.18), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
    blade.position.y = 0.7;
    hatGroup.add(dome, post, blade);
  } else if (type === 'headphones') {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.08, 8, 24, Math.PI), new THREE.MeshStandardMaterial({ color: 0x333333 }));
    band.rotation.x = Math.PI/2;
    band.rotation.z = Math.PI/2;
    band.position.y = 0.15;
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.45, 0.2), new THREE.MeshStandardMaterial({ color: color }));
    left.position.set(-0.7, -0.05, 0);
    const right = left.clone();
    right.position.x = 0.7;
    hatGroup.add(band, left, right);
  }
  return hatGroup;
}

export { createStudTexture, createWhiteStudTexture, buildMap, createBomb, buildHat };
