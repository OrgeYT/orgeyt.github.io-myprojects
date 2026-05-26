/* main.js
   The original single-file game logic has been moved here.
   Assumes THREE and CANNON are available globally (loaded via script tags).
*/

/* --- GAME STATE --- */
let gameState = 'START'; // START, PLAYING, GAMEOVER
let score = 0;
let airTime = 0;
let isGrounded = false;
let playerScale = new THREE.Vector3(1, 1, 1);

// Boost Powerup State
let boostActive = false;
let boostTimer = 0;

/* --- DOM ELEMENTS --- */
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('start-btn');
const scoreDisplay = document.getElementById('score-display');
const speedDisplay = document.getElementById('speed-display');
const comboDisplay = document.getElementById('combo-display');

/* --- THREE.JS & CANNON.JS SETUP --- */
const scene = new THREE.Scene();
// Darker theme colors
const bgColor = 0x1a2639;
const groundColor = 0x556b82;

scene.background = new THREE.Color(bgColor);
scene.fog = new THREE.Fog(bgColor, 300, 750);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const world = new CANNON.World();
world.gravity.set(0, -30, 0); // High gravity for snappy falling
world.broadphase = new CANNON.SAPBroadphase(world);

// Improve solver and collision robustness to reduce tunneling/phasing
world.solver.iterations = 10;
world.solver.tolerance = 0.001;
world.allowSleep = false;

// Physics Materials
const physicsMaterial = new CANNON.Material("standard");
const physicsContactMaterial = new CANNON.ContactMaterial(
    physicsMaterial, physicsMaterial,
    { friction: 0.0, restitution: 0.1 }
);
world.addContactMaterial(physicsContactMaterial);

/* --- LIGHTING --- */
const hemiLight = new THREE.HemisphereLight(0xaaccff, 0x223344, 0.3);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
dirLight.position.set(100, 200, 50);
dirLight.castShadow = true;
dirLight.shadow.camera.top = 300;
dirLight.shadow.camera.bottom = -300;
dirLight.shadow.camera.left = -300;
dirLight.shadow.camera.right = 300;
dirLight.shadow.camera.near = 0.1;
dirLight.shadow.camera.far = 800;
dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024;
scene.add(dirLight);
scene.add(dirLight.target);

/* --- ASSETS & WORLD GENERATION --- */
const meshes = [];
const bodies = [];

// Helper to create an object in both Three and Cannon
function createBox(w, h, d, x, y, z, mass, color, type) {
    const geometry = new THREE.BoxGeometry(w, h, d);
    const material = new THREE.MeshLambertMaterial({ color: color });
    if (type === 'booster') material.emissive = new THREE.Color(0x00ffaa);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(x, y, z);
    scene.add(mesh);

    const shape = new CANNON.Box(new CANNON.Vec3(w/2, h/2, d/2));
    const body = new CANNON.Body({ mass: mass, material: physicsMaterial });
    body.addShape(shape);
    body.position.set(x, y, z);
    body.userData = { type: type };

    if (type === 'booster') {
        body.collisionResponse = false;
    }

    world.addBody(body);

    if (mass > 0) {
        meshes.push(mesh);
        bodies.push(body);
    }

    return { mesh, body };
}

// Helper for stylized low-poly mountain hills
function createHill(radius, height, x, z) {
    const segments = 6 + Math.floor(Math.random() * 4);
    const geometry = new THREE.ConeGeometry(radius, height, segments);
    geometry.rotateX(Math.PI / 2);
    const material = new THREE.MeshLambertMaterial({ color: groundColor, flatShading: true });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    const shape = new CANNON.Cylinder(0.1, radius, height, segments);
    const body = new CANNON.Body({ mass: 0, material: physicsMaterial });
    body.addShape(shape);
    body.userData = { type: 'ground' };

    const qPitch = new CANNON.Quaternion();
    qPitch.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    const qYaw = new CANNON.Quaternion();
    qYaw.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.random() * Math.PI * 2);

    body.quaternion = qYaw.mult(qPitch);
    mesh.quaternion.copy(body.quaternion);

    body.position.set(x, (height / 2) - 1, z);
    mesh.position.copy(body.position);

    world.addBody(body);
    return { mesh, body };
}

// Helper for smooth angled ramps
function createRamp(width, depth, x, z) {
    const height = 2;
    const angle = (15 + Math.random() * 20) * (Math.PI / 180);
    const direction = Math.random() * Math.PI * 2;

    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshLambertMaterial({ color: groundColor });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    const shape = new CANNON.Box(new CANNON.Vec3(width/2, height/2, depth/2));
    const body = new CANNON.Body({ mass: 0, material: physicsMaterial });
    body.addShape(shape);
    body.userData = { type: 'ground' };

    const qPitch = new CANNON.Quaternion();
    qPitch.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), angle);
    const qYaw = new CANNON.Quaternion();
    qYaw.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), direction);

    body.quaternion = qYaw.mult(qPitch);
    mesh.quaternion.copy(body.quaternion);

    const yOffset = (depth / 2) * Math.sin(angle) - (height / 2);
    body.position.set(x, yOffset - 0.5, z);
    mesh.position.copy(body.position);

    world.addBody(body);
    return { mesh, body };
}

// 1. Create Ground (EXTENDED MAP)
createBox(5000, 2, 5000, 0, -1, 0, 0, groundColor, 'ground');

const envMeshes = [];

// 2. Generate Snowpark Features
for (let i = 0; i < 800; i++) {
    const rx = (Math.random() - 0.5) * 4800;
    const rz = (Math.random() - 0.5) * 4800;

    const rand = Math.random();
    let feature;
    if (rand < 0.12) {
        const radius = 20 + Math.random() * 30;
        const height = 15 + Math.random() * 20;
        feature = createHill(radius, height, rx, rz);
    } else if (rand < 0.45) {
        const w = 15 + Math.random() * 25;
        const d = 30 + Math.random() * 40;
        feature = createRamp(w, d, rx, rz);
    } else if (rand < 0.70) {
        feature = createBox(5 + Math.random()*15, 10 + Math.random()*20, 5 + Math.random()*15, rx, 10, rz, 0, 0xff0055, 'obstacle');
    } else {
        feature = createBox(15, 0.2, 15, rx, 0.1, rz, 0, 0x00ffcc, 'booster');
    }
    if (feature && feature.mesh) envMeshes.push(feature.mesh);
}

createBox(5000, 100, 10, 0, 50, -2500, 0, groundColor, 'ground');
createBox(5000, 100, 10, 0, 50, 2500, 0, groundColor, 'ground');
createBox(10, 100, 5000, -2500, 50, 0, 0, groundColor, 'ground');
createBox(10, 100, 5000, 2500, 50, 0, 0, groundColor, 'ground');

/* --- PLAYER --- */
/* Use a sphere for the player (visual + physics) and tighten collision settings to avoid phasing */
const PLAYER_RADIUS = 1.0;
const playerGeo = new THREE.SphereGeometry(PLAYER_RADIUS, 24, 24);

// Create a canvas texture for a stylized pattern (diagonal stripes + subtle noise)
const patternSize = 512;
const patternCanvas = document.createElement('canvas');
patternCanvas.width = patternCanvas.height = patternSize;
const pctx = patternCanvas.getContext('2d');

// Background base color
pctx.fillStyle = '#ff0055';
pctx.fillRect(0, 0, patternSize, patternSize);

// Draw diagonal stripes
pctx.strokeStyle = 'rgba(0,0,0,0.18)';
pctx.lineWidth = 18;
for (let i = -patternSize; i < patternSize * 2; i += 48) {
  pctx.beginPath();
  pctx.moveTo(i, -patternSize);
  pctx.lineTo(i + patternSize, patternSize * 2);
  pctx.stroke();
}

// Add a subtle circular vignette for depth
const grad = pctx.createRadialGradient(patternSize/2, patternSize/2, patternSize*0.2, patternSize/2, patternSize/2, patternSize*0.8);
grad.addColorStop(0, 'rgba(255,255,255,0.06)');
grad.addColorStop(1, 'rgba(0,0,0,0.06)');
pctx.fillStyle = grad;
pctx.fillRect(0,0,patternSize,patternSize);

// Optional: small speckle noise
const imgData = pctx.getImageData(0,0,patternSize,patternSize);
for (let i = 0; i < imgData.data.length; i += 4) {
  if (Math.random() < 0.02) {
    const v = (Math.random() * 40) | 0;
    imgData.data[i] = Math.max(0, imgData.data[i] - v);
    imgData.data[i+1] = Math.max(0, imgData.data[i+1] - v);
    imgData.data[i+2] = Math.max(0, imgData.data[i+2] - v);
  }
}
pctx.putImageData(imgData, 0, 0);

const patternTexture = new THREE.CanvasTexture(patternCanvas);
patternTexture.wrapS = patternTexture.wrapT = THREE.RepeatWrapping;
patternTexture.repeat.set(1, 1);
patternTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

// Create material with the pattern and a slight emissive tint so boost flashes still show
const playerMat = new THREE.MeshLambertMaterial({
  map: patternTexture,
  emissive: new THREE.Color(0x000000),
  emissiveIntensity: 0.6,
  roughness: 0.8
});

const playerMesh = new THREE.Mesh(playerGeo, playerMat);
playerMesh.castShadow = true;
playerMesh.receiveShadow = true;

const playerGroup = new THREE.Group();
playerGroup.add(playerMesh);

 // Face layer: a small, shorter billboard plane that sits just above the sphere's forward-facing area.
 // It will swap textures between normal, blink, look-left and look-right and also animate (subtle bob/squish).
 const faceWidth = PLAYER_RADIUS * 1.6;
 const faceHeight = PLAYER_RADIUS * 0.95; // shorter (not tall)
 const faceGeo = new THREE.PlaneGeometry(faceWidth, faceHeight);
 const faceMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
 const faceMesh = new THREE.Mesh(faceGeo, faceMat);
 faceMesh.renderOrder = 999; // always render on top of the sphere
 faceMesh.position.set(0, 0, PLAYER_RADIUS * 1); // slightly offset forward/outward
 // start slightly squashed in Y so faces appear short
 faceMesh.scale.set(1, 0.78, 1);
 // Do not parent the face to the playerGroup; keep it in world space so updateFace can set world positions directly.
 scene.add(faceMesh);

 // Load face textures
 const loader = new THREE.TextureLoader();
 const faceTextures = {
   normal: loader.load('facenormal.png'),
   blink: loader.load('faceblink.png'),
   left: loader.load('facelookleft.png'),
   right: loader.load('facelookright.png'),
 };
 Object.values(faceTextures).forEach(t => { t.encoding = THREE.sRGBEncoding; t.needsUpdate = true; });

 // ensure initial face image is set
 faceMat.map = faceTextures.normal;
 faceMat.needsUpdate = true;

 // Face state and blink timer (use elapsed tracking so we don't rely on setTimeout)
 let faceState = 'normal';
 let blinkTimer = 0;
 let blinkElapsed = 0;
 let nextBlinkInterval = 3.5 + Math.random() * 2.0;
 const BLINK_DURATION = 0.12;

 // Helper to set face
 function setFace(state) {
   if (faceState === state) return;
   faceState = state;
   faceMat.map = faceTextures[state] || faceTextures.normal;
   faceMat.needsUpdate = true;
 }

 // Small update each frame to orient face to camera and handle blinking/look-left/right and animation
 // dt is seconds since last frame
 let faceAnimTime = 0;

 // smoothing state for look offset (so face turns smoothly toward movement)
 let lookOffset = 0;
 let lookOffsetVel = 0;

 function updateFace(dt) {
  faceAnimTime += dt;

  // World position of player
  const playerWorldPos = new THREE.Vector3();
  playerGroup.getWorldPosition(playerWorldPos);

  // Camera-facing and orientation helpers
  const camPos = camera.position.clone();
  const camForward = new THREE.Vector3();
  camera.getWorldDirection(camForward);
  camForward.y = 0;
  camForward.normalize();

  // Compute movement-based lateral look based only on player velocity (ignore camera/input turning)
  const vel = player.body.velocity;
  const velVec = new THREE.Vector3(vel.x, 0, vel.z);
  const speed = velVec.length();

  // Predict future position based on current velocity so face aims where the ball is going to be
  // predictionTime scales with speed but is clamped to avoid extreme leads
  const minPredict = 0.15; // seconds
  const maxPredict = 0.9;  // seconds
  const speedFactor = THREE.MathUtils.clamp(speed / 60, 0, 1); // normalized by a reasonable top speed
  const predictionTime = minPredict + (maxPredict - minPredict) * speedFactor;
  const futureOffset = velVec.clone().multiplyScalar(predictionTime);
  const predictedPos = playerWorldPos.clone().add(futureOffset);

  // If the player is moving, compute lateral offset from movement direction relative to player
  let moveBasedOffset = 0;
  if (speed > 0.01) {
    // movement direction is from current position toward predicted position (gives more future-oriented facing)
    const moveDir = predictedPos.clone().sub(playerWorldPos);
    moveDir.y = 0;
    if (moveDir.lengthSq() > 1e-6) moveDir.normalize();
    else moveDir.copy(velVec).normalize();

    // project movement onto player's local right to get -1..1 lateral sign
    const playerRight = new THREE.Vector3(1, 0, 0).applyQuaternion(playerGroup.quaternion).normalize();
    moveBasedOffset = THREE.MathUtils.clamp(playerRight.dot(moveDir) * Math.min(speed * 0.06, 1.2), -1.0, 1.0);
  }

  // We only use movement to drive the look offset target (no camera yaw delta or input influence)
  const targetOffset = moveBasedOffset;

  // Smooth damp the look offset for natural motion
  const smoothTime = 0.06;
  const t = 1 - Math.exp(-dt / smoothTime);
  lookOffset += (targetOffset - lookOffset) * t;

  // Determine orbit based on the predicted movement direction (fall back to camera-facing if stationary)
  let baseAngle;
  const movementVecForAngle = predictedPos.clone().sub(playerWorldPos);
  movementVecForAngle.y = 0;
  if (movementVecForAngle.lengthSq() > 0.000001) {
    baseAngle = Math.atan2(movementVecForAngle.x, movementVecForAngle.z);
  } else {
    // when nearly stationary, keep face roughly toward camera
    const toCam = new THREE.Vector3(camPos.x - playerWorldPos.x, 0, camPos.z - playerWorldPos.z);
    if (toCam.lengthSq() < 1e-6) toCam.set(0,0,1);
    toCam.normalize();
    baseAngle = Math.atan2(toCam.x, toCam.z);
  }

  // Convert lookOffset (-1..1) to an angular offset around the sphere (max ~55 degrees)
  const maxOrbitAngle = Math.PI * 0.305; // ~55 degrees
  const lookAngle = lookOffset * maxOrbitAngle;

  // Final orbit angle around Y
  const orbitAngle = baseAngle + lookAngle;

  // Place the face on the sphere surface at the computed orbit angle so it travels around the ball instead of clipping.
  const faceOutset = PLAYER_RADIUS + 0.095; // slightly more outset to avoid z-fighting
  const orbitX = Math.sin(orbitAngle) * faceOutset;
  const orbitZ = Math.cos(orbitAngle) * faceOutset;

  // Vertical offset: keep slightly above center and add subtle bob
  const bob = Math.sin(faceAnimTime * 2.0) * 0.02;
  const verticalOffset = 0.05 + bob;

  const targetPos = new THREE.Vector3(playerWorldPos.x + orbitX, playerWorldPos.y + verticalOffset, playerWorldPos.z + orbitZ);

  // Face should yaw to face movement direction (or camera when stationary); compute yaw only to preserve upright orientation
  let faceYaw;

  // Ensure toCamFromFace is always defined so later breathing offset can use it safely
  let toCamFromFace = new THREE.Vector3();

  if (movementVecForAngle.lengthSq() > 0.000001) {
    // face looks along predicted movement direction
    faceYaw = Math.atan2(movementVecForAngle.x, movementVecForAngle.z);
    // derive a forward-facing vector from predicted movement for breathing offset (projected to ground)
    toCamFromFace.set(movementVecForAngle.x, 0, movementVecForAngle.z);
    if (toCamFromFace.lengthSq() > 1e-6) toCamFromFace.normalize();
    else toCamFromFace.set(0, 0, 1);
  } else {
    toCamFromFace.set(camPos.x - targetPos.x, 0, camPos.z - targetPos.z);
    if (toCamFromFace.lengthSq() > 0.000001) toCamFromFace.normalize();
    else toCamFromFace.set(0, 0, 1);
    faceYaw = Math.atan2(toCamFromFace.x, toCamFromFace.z);
  }

  // Apply rotation while preserving upright orientation
  faceMesh.rotation.set(0, faceYaw, 0);

  // Blink timing (unchanged)
  blinkTimer += dt;
  if (faceState === 'blink') {
    blinkElapsed += dt;
    if (blinkElapsed >= BLINK_DURATION) {
      blinkElapsed = 0;
      setFace('normal');
      nextBlinkInterval = 3.5 + Math.random() * 2.0;
      blinkTimer = 0;
    }
  } else {
    if (blinkTimer >= nextBlinkInterval) {
      setFace('blink');
      blinkElapsed = 0;
      blinkTimer = 0;
    }
  }

  // Expression logic (unchanged semantics)
  if (faceState !== 'blink') {
    if (speed > 2.5) {
      if (moveBasedOffset < -0.35) setFace('left');
      else if (moveBasedOffset > 0.35) setFace('right');
      else {
        if (camTurnOffset < -0.25) setFace('left');
        else if (camTurnOffset > 0.25) setFace('right');
        else setFace('normal');
      }
    } else {
      if (inputOffset < -0.35 || camTurnOffset < -0.25) setFace('left');
      else if (inputOffset > 0.35 || camTurnOffset > 0.25) setFace('right');
      else setFace('normal');
    }
  }

  // Squish / scale breathing
  const squish = 0.04 * Math.sin(faceAnimTime * 3.5);
  const baseY = 0.78;
  faceMesh.scale.y = baseY - Math.abs(squish);

  // Slight breathing along camera-facing axis to keep subtle motion (small magnitude since face moved outward)
  const breatheOffset = Math.sin(faceAnimTime * 1.2) * 0.008;
  const breatheVec = toCamFromFace.clone().multiplyScalar(breatheOffset);

  // Final placement
  faceMesh.position.copy(targetPos).add(breatheVec);
}

 // Expose updateFace so animate loop can call it
 window._playerFace = { update: updateFace, mesh: faceMesh };
 scene.add(playerGroup);

// Use a sphere shape in Cannon; increase mass for more stable collisions
const playerShape = new CANNON.Sphere(PLAYER_RADIUS);
const playerBody = new CANNON.Body({ mass: 50, material: physicsMaterial });
playerBody.addShape(playerShape);
playerBody.position.set(0, 10, 0);
playerBody.angularDamping = 0.8;
playerBody.linearDamping = 0.1;
playerBody.userData = { type: 'player' };

// Improve collision reliability for the player
playerBody.collisionResponse = true;
playerBody.allowSleep = false;
playerBody.ccdSpeedThreshold = 1; // enable CCD-like behavior when moving fast
playerBody.ccdIterations = 5;

world.addBody(playerBody);

const player = { body: playerBody, mesh: playerMesh, group: playerGroup };

/* Collision events for Player */
player.body.addEventListener("collide", function(e) {
    const type = e.body.userData ? e.body.userData.type : null;

    if (type === 'obstacle' && gameState === 'PLAYING') {
        gameOver();
    } else if (type === 'booster' && gameState === 'PLAYING') {
        const velocity = player.body.velocity;
        const speed = velocity.length();
        let dir = new CANNON.Vec3(0, 1, -1);
        if (speed > 1) {
            dir.copy(velocity);
            dir.normalize();
        }

        boostActive = true;
        boostTimer = 35.0;
        player.mesh.material.emissive.setHex(0x00ffff);

        player.body.velocity.set(dir.x * 200, 40, dir.z * 200);
        score += 500;
    }
});

/* --- INPUT HANDLING --- */
const keys = { w: false, a: false, s: false, d: false, space: false };
let camYaw = 0;
let camPitch = 0.2;

// Face/look helpers used by updateFace (kept up-to-date each physics frame)
let inputOffset = 0;     // lateral input (-1..1), updated from moveX
let camTurnOffset = 0;   // recent camera yaw change (smoothed)
let _prevCamYaw = camYaw; // internal tracker for yaw delta smoothing

document.addEventListener('keydown', (e) => {
    if(e.code === 'KeyW' || e.code === 'ArrowUp') keys.w = true;
    if(e.code === 'KeyA' || e.code === 'ArrowLeft') keys.a = true;
    if(e.code === 'KeyS' || e.code === 'ArrowDown') keys.s = true;
    if(e.code === 'KeyD' || e.code === 'ArrowRight') keys.d = true;
    if(e.code === 'Space') keys.space = true;
});

document.addEventListener('keyup', (e) => {
    if(e.code === 'KeyW' || e.code === 'ArrowUp') keys.w = false;
    if(e.code === 'KeyA' || e.code === 'ArrowLeft') keys.a = false;
    if(e.code === 'KeyS' || e.code === 'ArrowDown') keys.s = false;
    if(e.code === 'KeyD' || e.code === 'ArrowRight') keys.d = false;
    if(e.code === 'Space') keys.space = false;
});

document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === document.body && gameState === 'PLAYING') {
        camYaw -= e.movementX * 0.002;
        camPitch += e.movementY * 0.002;
        camPitch = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, camPitch));
    }
});

startBtn.addEventListener('click', () => {
    if (gameState === 'GAMEOVER') resetGame();
    document.body.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === document.body) {
        gameState = 'PLAYING';
        overlay.style.display = 'none';
    } else {
        if(gameState === 'PLAYING') {
            gameState = 'START';
            showOverlay("PAUSED", "Click to Resume");
        }
    }
});

function showOverlay(title, btnText) {
    overlay.style.display = 'flex';
    overlay.querySelector('h1').innerText = title;
    startBtn.innerText = btnText;
    document.exitPointerLock();
}

function gameOver() {
    gameState = 'GAMEOVER';
    showOverlay("WIPEOUT", "TRY AGAIN");
    overlay.querySelector('h1').style.color = '#ff0055';
    overlay.querySelector('h1').style.textShadow = '0 0 20px rgba(255, 0, 85, 0.5)';
}

function resetGame() {
    score = 0;
    player.body.position.set(0, 10, 0);
    player.body.velocity.set(0,0,0);
    player.body.angularVelocity.set(0,0,0);
    player.body.quaternion.setFromEuler(0,0,0);
    playerScale.set(1, 1, 1);

    boostActive = false;
    boostTimer = 0;
    player.mesh.material.emissive.setHex(0x000000);

    camYaw = 0;
    camPitch = 0.2;
    overlay.querySelector('h1').style.color = '#00ffcc';
    overlay.querySelector('h1').style.textShadow = '0 0 20px rgba(0, 255, 204, 0.5)';
}

/* --- GAME LOOP --- */
const clock = new THREE.Clock();
const baseCameraDistance = 15; // base distance that will be multiplied by camZoom

// Camera zoom control (affects camera distance, not FOV)
let camZoom = 1.0; // 1.0 = default distance
const camZoomMin = 0.5;
const camZoomMax = 2.5;
const camZoomSpeed = 0.08; // mouse wheel and gamepad speed
// Ensure camera uses stable FOV
camera.fov = 75;
camera.updateProjectionMatrix();

// Mouse wheel zoom (scroll to zoom)
window.addEventListener('wheel', (e) => {
    // normalize wheel delta
    const delta = Math.sign(e.deltaY);
    camZoom = Math.min(camZoomMax, Math.max(camZoomMin, camZoom + delta * camZoomSpeed));
});

function updatePhysicsAndInput(dt) {
    if (gameState !== 'PLAYING') return;

    let currentMaxSpeed = 100;
    if (boostActive) {
        currentMaxSpeed = 250;
        boostTimer -= dt;
        speedDisplay.style.color = '#00ffff';

        if (boostTimer <= 0) {
            boostActive = false;
            player.mesh.material.emissive.setHex(0x000000);
            speedDisplay.style.color = '#fff';
        }
    }

    let moveX = 0;
    let moveY = 0;
    let jumpPressed = keys.space;

    if (keys.w) moveY = 1;
    if (keys.s) moveY = -1;
    if (keys.a) moveX = -1;
    if (keys.d) moveX = 1;

    const gamepads = navigator.getGamepads();
    if (gamepads[0]) {
        const gp = gamepads[0];
        if (Math.abs(gp.axes[1]) > 0.1) moveY = -gp.axes[1];
        if (Math.abs(gp.axes[0]) > 0.1) moveX = gp.axes[0];

        if (Math.abs(gp.axes[2]) > 0.1) camYaw -= gp.axes[2] * 0.05;
        if (Math.abs(gp.axes[3]) > 0.1) camPitch += gp.axes[3] * 0.05;
        camPitch = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, camPitch));

        if (gp.buttons[0].pressed || gp.buttons[7].pressed) jumpPressed = true;

        // Gamepad zoom controls:
        // - If right stick vertical (axes[3]) is moved strongly, use it to zoom
        if (Math.abs(gp.axes[3]) > 0.25) {
            // negative axes[3] typically means up; invert so pushing up zooms in
            camZoom = Math.min(camZoomMax, Math.max(camZoomMin, camZoom - gp.axes[3] * camZoomSpeed));
        }
        // - If L3 / R3 (stick buttons) are available, use them: L3 decreases zoom (zoom out), R3 increases zoom (zoom in)
        // Note: button indices vary by controller; commonly 9 = L3, 10 = R3 on many mappings; check existence defensively.
        if (gp.buttons[9] && gp.buttons[9].pressed) {
            camZoom = Math.min(camZoomMax, Math.max(camZoomMin, camZoom - camZoomSpeed * 0.7));
        }
        if (gp.buttons[10] && gp.buttons[10].pressed) {
            camZoom = Math.min(camZoomMax, Math.max(camZoomMin, camZoom + camZoomSpeed * 0.7));
        }
    }

    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0,1,0), camYaw);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0,1,0), camYaw);

    // Update public input/look offsets used by the face logic
    // inputOffset = lateral player input (-1..1)
    inputOffset = moveX;

    // camTurnOffset = recent yaw delta (signed). Smooth it to avoid jitter.
    const rawYawDelta = camYaw - _prevCamYaw;
    // Normalize angle to [-PI,PI]
    const normalizedDelta = Math.atan2(Math.sin(rawYawDelta), Math.cos(rawYawDelta));
    // scale to an intuitive -1..1 range (divide by a reasonable radian value such as 0.6 rad ~= 34deg)
    const targetCamTurn = THREE.MathUtils.clamp(normalizedDelta / 0.6, -1, 1);
    // exponential smoothing
    const smoothT = 1 - Math.exp(-dt / 0.08);
    camTurnOffset += (targetCamTurn - camTurnOffset) * smoothT;
    _prevCamYaw = camYaw;

    const rayStart = new CANNON.Vec3(player.body.position.x, player.body.position.y, player.body.position.z);
    const rayEnd = new CANNON.Vec3(player.body.position.x, player.body.position.y - 1.8, player.body.position.z);
    const raycastResult = new CANNON.RaycastResult();
    world.raycastClosest(rayStart, rayEnd, { skipBackfaces: true }, raycastResult);

    if (raycastResult.hasHit && raycastResult.body !== player.body) {
        if (!isGrounded) {
            if (airTime > 0.5) {
                const bonus = Math.floor(airTime * 1000);
                score += bonus;
                comboDisplay.innerText = `SICK AIR! +${bonus}`;
                comboDisplay.style.opacity = 1;
                setTimeout(() => comboDisplay.style.opacity = 0, 1500);
            }

            const impact = Math.abs(player.body.velocity.y);
            const sq = Math.max(0.3, 1.0 - (impact * 0.02));
            const bulge = 1.0 + (1.0 - sq) * 0.5;
            playerScale.set(bulge, sq, bulge);

            // Blink on landing: force a short blink for expressive feedback
            setFace('blink');
            blinkElapsed = 0;
            blinkTimer = 0;
            // schedule next blink after a small delay so we don't double-blink immediately
            nextBlinkInterval = 2.0 + Math.random() * 2.5;
        }

        isGrounded = true;
        airTime = 0;
    } else if (Math.abs(player.body.velocity.y) > 0.5) {
        isGrounded = false;
    }

    player.body.wakeUp();

    const groundForce = 3500;
    const airTorque = 600;

    if (isGrounded) {
        player.body.angularVelocity.x *= 0.9;
        player.body.angularVelocity.y *= 0.9;
        player.body.angularVelocity.z *= 0.9;

        // Apply ground movement forces
        const fx = (forward.x * moveY + right.x * moveX) * groundForce;
        const fz = (forward.z * moveY + right.z * moveX) * groundForce;
        player.body.applyForce(new CANNON.Vec3(fx, 0, fz), player.body.position);

        // Add spin while moving: torque around Y for visible rotation (strafe/turning) and slight Y angular velocity push for forward motion
        // Scale torque with input magnitude so gentle control feels natural
        const inputMag = Math.min(1, Math.sqrt(moveX*moveX + moveY*moveY));
        const spinTorqueY = (-moveX * 1200 + moveY * 120) * inputMag; // strafing causes stronger spin
        // Apply as torque (affects angular velocity over time). Use small damping above to keep it from exploding.
        player.body.torque.y += spinTorqueY;

        // Also nudge angular velocity if moving forward for a subtle roll feel
        if (Math.abs(moveY) > 0.01 && Math.abs(moveX) < 0.2) {
            player.body.angularVelocity.y += (moveY * -2.0) * inputMag;
        }

        if (jumpPressed) {
            player.body.velocity.y = 25;
            isGrounded = false;
            playerScale.set(0.5, 2.0, 0.5);
        }
    } else {
        airTime += dt;

        const tx = (right.x * moveY + forward.x * moveX) * airTorque;
        const tz = (right.z * moveY + forward.z * moveX) * airTorque;

        player.body.torque.x += tx;
        player.body.torque.z += tz;

        const airForce = 1500;
        const fx = (forward.x * moveY + right.x * moveX) * airForce;
        const fz = (forward.z * moveY + right.z * moveX) * airForce;
        player.body.applyForce(new CANNON.Vec3(fx, 0, fz), player.body.position);
    }

    const velocity = player.body.velocity;
    const speed = Math.sqrt(velocity.x*velocity.x + velocity.z*velocity.z);
    if (speed > currentMaxSpeed) {
        const mult = currentMaxSpeed / speed;
        player.body.velocity.x *= mult;
        player.body.velocity.z *= mult;
    }

    if (isGrounded) score += Math.floor(speed * dt);
    scoreDisplay.innerText = score;

    if (boostActive) {
        speedDisplay.innerText = `SPEED: ${Math.floor(speed)} km/h (BOOST: ${boostTimer.toFixed(1)}s)`;
    } else {
        speedDisplay.innerText = `SPEED: ${Math.floor(speed)} km/h`;
    }

    // Keep FOV fixed (already set once); camera zoom uses camZoom applied to cameraDistance.
    // No per-frame FOV changes needed.

    playerScale.lerp(new THREE.Vector3(1, 1, 1), 0.15);
    player.group.scale.copy(playerScale);
}

function updateCamera() {
    // apply camZoom to the base camera distance so wheel/gamepad zoom actually affects camera position
    const dist = baseCameraDistance * camZoom;

    const idealOffset = new THREE.Vector3(
        Math.sin(camYaw) * Math.cos(camPitch) * dist,
        Math.sin(camPitch) * dist,
        Math.cos(camYaw) * Math.cos(camPitch) * dist
    );

    const targetPos = player.group.position.clone().add(idealOffset);

    camera.position.copy(targetPos);
    camera.lookAt(player.group.position);
}

function animate() {
    requestAnimationFrame(animate);

    const dt = Math.min(clock.getDelta(), 0.1);

    if (gameState === 'PLAYING') {
        world.step(1/60, dt, 3);
    }

    updatePhysicsAndInput(dt);

    for (let i = 0; i < meshes.length; i++) {
        meshes[i].position.copy(bodies[i].position);
        meshes[i].quaternion.copy(bodies[i].quaternion);
    }

    player.group.position.copy(player.body.position);
    player.mesh.quaternion.copy(player.body.quaternion);

    const pX = player.group.position.x;
    const pZ = player.group.position.z;
    const renderDistSq = 800 * 800;

    for (let i = 0; i < envMeshes.length; i++) {
        const m = envMeshes[i];
        const dx = m.position.x - pX;
        const dz = m.position.z - pZ;
        m.visible = (dx*dx + dz*dz) < renderDistSq;
    }

    dirLight.position.set(pX + 100, player.group.position.y + 200, pZ + 50);
    dirLight.target.position.set(pX, player.group.position.y, pZ);

    if (player.body.position.y < -10 && gameState === 'PLAYING') gameOver();

    updateCamera();

    // Update clouds to always face camera and drift
    if (window._cloudSystem) {
      window._cloudSystem.update(dt, camera.position);
    }

    // Update player face each frame so expressions, blinking and look-offset animate properly.
    if (window._playerFace && typeof window._playerFace.update === 'function') {
      window._playerFace.update(dt);
    }

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();

/* --- CLOUDS: Procedural billboard clouds with gentle drift --- */
/* This creates a soft cloud texture on a canvas and makes many semi-transparent planes that always face the camera.
   The cloud system is lightweight and only updates orientation + small drift each frame.
*/

(function createClouds() {
  // Cloud settings
  const CLOUD_COUNT = 120;
  const CLOUD_AREA_RADIUS = 2200; // spread across the sky
  const CLOUD_MIN_HEIGHT = 60;
  const CLOUD_MAX_HEIGHT = 220;
  const CLOUD_SCALE_MIN = 40;
  const CLOUD_SCALE_MAX = 160;

  // Create canvas-based soft cloud texture
  const csize = 512;
  const c = document.createElement('canvas');
  c.width = c.height = csize;
  const ctx = c.getContext('2d');

  // base gradient (pale white)
  const g = ctx.createLinearGradient(0, 0, csize, csize);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(1, 'rgba(230,238,255,0.85)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, csize, csize);

  // draw a few soft blobs to make a cloud
  function drawBlob(x, y, r, a) {
    const rg = ctx.createRadialGradient(x, y, r*0.1, x, y, r);
    rg.addColorStop(0, `rgba(255,255,255,${a})`);
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI*2);
    ctx.fill();
  }

  for (let i = 0; i < 12; i++) {
    const x = Math.random() * csize;
    const y = Math.random() * csize;
    const r = 60 + Math.random() * 180;
    const a = 0.25 + Math.random() * 0.6;
    drawBlob(x, y, r, a);
  }

  // subtle noise overlay
  const id = ctx.getImageData(0, 0, csize, csize);
  for (let i = 0; i < id.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 8;
    id.data[i] = Math.min(255, Math.max(0, id.data[i] + n));
    id.data[i+1] = Math.min(255, Math.max(0, id.data[i+1] + n));
    id.data[i+2] = Math.min(255, Math.max(0, id.data[i+2] + n));
    // keep alpha untouched
  }
  ctx.putImageData(id, 0, 0);

  const cloudTexture = new THREE.CanvasTexture(c);
  cloudTexture.needsUpdate = true;
  cloudTexture.premultiplyAlpha = true;
  cloudTexture.minFilter = THREE.LinearMipMapLinearFilter;
  cloudTexture.magFilter = THREE.LinearFilter;
  cloudTexture.wrapS = cloudTexture.wrapT = THREE.ClampToEdgeWrapping;

  const cloudMaterial = new THREE.MeshLambertMaterial({
    map: cloudTexture,
    transparent: true,
    depthWrite: false,
    opacity: 0.9,
    side: THREE.DoubleSide,
    color: 0xffffff,
  });

  const cloudGeo = new THREE.PlaneGeometry(1, 1);
  const cloudGroup = new THREE.Group();

  const clouds = [];

  for (let i = 0; i < CLOUD_COUNT; i++) {
    const m = new THREE.Mesh(cloudGeo, cloudMaterial.clone());
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * CLOUD_AREA_RADIUS * 0.9;
    const x = Math.cos(angle) * radius + (Math.random() - 0.5) * 300;
    const z = Math.sin(angle) * radius + (Math.random() - 0.5) * 300;
    const y = CLOUD_MIN_HEIGHT + Math.random() * (CLOUD_MAX_HEIGHT - CLOUD_MIN_HEIGHT);

    const s = CLOUD_SCALE_MIN + Math.random() * (CLOUD_SCALE_MAX - CLOUD_SCALE_MIN);
    m.scale.set(s, s * (0.5 + Math.random() * 0.8), 1);

    m.position.set(x, y, z);
    m.material.opacity = 0.35 + Math.random() * 0.45;
    m.material.color = new THREE.Color(0xffffff).multiplyScalar(0.9 + Math.random()*0.2);

    // subtle rotation variance
    m.rotation.z = Math.random() * Math.PI * 2;

    cloudGroup.add(m);

    clouds.push({
      mesh: m,
      driftX: (Math.random() - 0.5) * 4, // units per second
      driftZ: (Math.random() - 0.5) * 4,
      wobble: Math.random() * 0.6
    });
  }

  // place group high above world center so clouds remain visible
  cloudGroup.position.y = 0;
  scene.add(cloudGroup);

  // Expose a small updater for animate loop
  window._cloudSystem = {
    update: function(dt, camPos) {
      // Drift and slowly loop around center to keep clouds distributed
      for (let i = 0; i < clouds.length; i++) {
        const c = clouds[i];
        c.mesh.position.x += c.driftX * dt * 0.6;
        c.mesh.position.z += c.driftZ * dt * 0.6;

        // Gentle vertical bob
        c.mesh.position.y += Math.sin((performance.now() * 0.001) * (0.1 + c.wobble)) * 0.002;

        // Wrap-around to keep within area radius
        const dx = c.mesh.position.x;
        const dz = c.mesh.position.z;
        const r2 = dx*dx + dz*dz;
        if (r2 > CLOUD_AREA_RADIUS * CLOUD_AREA_RADIUS) {
          const ang = Math.atan2(dz, dx);
          c.mesh.position.x = Math.cos(ang) * (CLOUD_AREA_RADIUS * 0.85) * -1;
          c.mesh.position.z = Math.sin(ang) * (CLOUD_AREA_RADIUS * 0.85) * -1;
        }

        // Billboard to camera: make plane face camera while preserving own Z-rotation for variety
        c.mesh.lookAt(camPos.x, camPos.y, camPos.z);
        // Apply slight local Z rotation offset to keep variety (maintain readable silhouette)
        c.mesh.rotateZ(c.wobble * 0.05);
      }

      // Fade cloud density with camera height (higher camera see more sky)
      const camH = camPos.y;
      const fogFactor = Math.min(1, Math.max(0.35, (camH / 200)));
      cloudGroup.traverse((o) => {
        if (o.material) {
          o.material.opacity = Math.max(0.15, 0.45 * fogFactor);
        }
      });
    }
  };
})();