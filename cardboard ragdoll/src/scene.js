import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as CANNON from 'cannon-es';
import { loadSkyboxTexture } from './assets.js';

export async function initScene() {
  const scene = new THREE.Scene();

  // create a textured inward-facing cube to serve as a skybox
  const skyTex = await loadSkyboxTexture();
  skyTex.encoding = THREE.sRGBEncoding;
  skyTex.flipY = false;

  // Use a much larger box so it surrounds the scene; BoxGeometry faces will be rendered from the inside
  const size = 3000;
  const skyGeo = new THREE.BoxGeometry(size, size, size);
  const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.name = 'SkyboxCube';
  // Prevent the skybox from being frustum-culled and ensure stable transform updates
  sky.frustumCulled = false;
  // keep rotation fixed so it never appears to jitter; we still position it at the camera each frame
  sky.rotation.set(0, 0, 0);
  scene.add(sky);

  // fog removed to keep the skybox fully visible without atmospheric fading

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 5000);
  camera.position.set(40, 30, 60);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  // clamp zoom: minDistance prevents zooming too close; maxDistance prevents zooming out too far
  // tweak these values as needed for your scene scale
  controls.minDistance = 10;
  controls.maxDistance = 300;

  // Prevent abrupt jumps from large wheel/trackpad deltas by handling wheel zoom manually.
  // Disable built-in zoom so we can apply smooth, clamped zoom increments.
  controls.enableZoom = false;

  // Normalized wheel handler: compute a modest zoom step proportionate to distance, clamp, and update camera.
  // Use passive:false to allow preventDefault so some devices don't send giant accumulated deltas.
  renderer.domElement.addEventListener('wheel', (e) => {
    // only react when the user actually intends to zoom (no modifier keys like ctrl for page zoom)
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    // Prevent page from scrolling and stop OrbitControls' native wheel handling
    e.preventDefault();
    e.stopPropagation();

    // Normalize deltaY: different devices report different scales (pixels vs lines vs momentum).
    // Clamp magnitude so a single event cannot jump to min/max.
    const raw = e.deltaY;
    const sign = Math.sign(raw) || 1;
    // allow larger sensible events to have stronger effect but still bounded
    const mag = Math.min(Math.abs(raw), 240); // increased clamp for more responsive zoom on high-delta devices
    const normalized = sign * (mag / 240); // normalized into approx [-1,1]

    // Zoom step factor: increase to make zooming noticeably faster while keeping it controllable.
    const zoomFactor = 0.35; // larger factor for quicker zooming
    const currentDir = camera.position.clone().sub(controls.target);
    const currentDistance = currentDir.length();

    // Compute new distance and clamp to controls' min/max
    // keep proportional scaling so feel is consistent at different distances
    const deltaDistance = normalized * zoomFactor * Math.max(6, currentDistance * 0.12);
    let newDistance = currentDistance + deltaDistance;
    newDistance = Math.max(controls.minDistance, Math.min(controls.maxDistance, newDistance));

    // Place camera at target + direction * newDistance
    currentDir.normalize();
    camera.position.copy(controls.target.clone().add(currentDir.multiplyScalar(newDistance)));
    // Ensure controls see the update
    controls.update();
  }, { passive: false });

  // lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(100, 200, 100);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.left = -150;
  dirLight.shadow.camera.right = 150;
  dirLight.shadow.camera.top = 150;
  dirLight.shadow.camera.bottom = -150;
  scene.add(dirLight);

  // physics world
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -35, 0) });
  world.solver.iterations = 30;

  // create simple color material presets; ragdoll will respect passed materials when building parts
  const defaultMaterials = {
    // Note: These are simple MeshStandardMaterial instances used for skin presets.
    yellow: new THREE.MeshStandardMaterial({ color: 0xf5cd30, roughness: 0.9 }),
    blue: new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.9 }),
    green: new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.9 }),
    white: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }),
    // 'cardboard' placeholder signals the ragdoll builder to use the cardboard textured material
    cardboard: 'cardboard'
  };

  const state = {
    world,
    scene,
    camera,
    renderer,
    controls,
    parts: [],
    mapMeshes: [],
    mapBodies: [],
    // materials contains presets used by the ragdoll builder; default is Cardboard style fallback
    materials: { head: defaultMaterials.cardboard, torso: defaultMaterials.cardboard, arms: defaultMaterials.cardboard, legs: defaultMaterials.cardboard, presets: defaultMaterials },
    studTex: null,
    faceTex: null,
    isFollowing: true,
    isStanding: false,
    // timeScale controls slow motion (1 = normal, <1 = slow, >1 = fast)
    timeScale: 1,
    keys: { w:false,a:false,s:false,d:false,q:false,e:false,r:false },
    paused: false,
    jointBody: null,
    grabbed: { body: null, constraint: null },
    // store constraints so we can tighten/loosen them when standing toggles
    constraints: [],
    // chosen ragdoll type (R11 default). Can be 'R11' or 'R6'
    ragdollMode: 'R11',
    // attach sky reference so render loop can keep it centered on the camera
    sky: sky
  };

  return { scene, camera, renderer, controls, world, state };
}

export function resizeRendererToWindow(camera, renderer){
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

export function startRenderLoop({ scene, camera, renderer, controls, world, state }){
  function applyStandingPhysics(){
    if(!state.isStanding) return;
    const parts = state.parts;
    if(!parts.length) return;
    const lower = parts.find(p=>p.name==='LowerTorso');
    if(!lower) return;

    // Increase upward support on the lower torso so gravity is countered when standing.
    const totalMass = parts.reduce((s,p)=>s + p.body.mass, 0);
    const gravityForce = totalMass * Math.abs(world.gravity.y);
    // provide strong but clamped lift
    const support = Math.min(gravityForce * 1.05, 7000);
    lower.body.force.y += support;

    // Upright correction: align the lower torso's up vector to world up, then apply
    // coordinated corrective torques to other parts to reach the stored standing pose.
    // Compute lower torso upright error
    const lowerQuat = lower.body.quaternion.clone();
    // world up in body space
    const bodyUp = new CANNON.Vec3(0,1,0);
    const currentUp = lowerQuat.vmult(bodyUp); // lower's up in world space

    // desired up is (0,1,0) in world space; compute axis-angle to rotate currentUp -> desiredUp
    const desiredUp = new CANNON.Vec3(0,1,0);
    const cross = currentUp.cross(desiredUp);
    const dot = currentUp.dot(desiredUp);
    const magCross = Math.sqrt(cross.x*cross.x + cross.y*cross.y + cross.z*cross.z);
    // clamp dot to valid range for acos
    const cosAngle = Math.max(-1, Math.min(1, dot / (currentUp.length() * desiredUp.length())));
    const angle = Math.acos(cosAngle || 0);

    if(magCross > 1e-4 && angle > 1e-3){
      const axis = new CANNON.Vec3(cross.x / magCross, cross.y / magCross, cross.z / magCross);
      // apply a torque to lower torso to correct tilt (stronger for larger errors)
      const uprightTorqueGain = 2200; // authoritative upright correction
      const maxUprightTorque = 6000;
      const tx = axis.x * angle * uprightTorqueGain;
      const ty = axis.y * angle * uprightTorqueGain;
      const tz = axis.z * angle * uprightTorqueGain;
      lower.body.torque.x += Math.max(-maxUprightTorque, Math.min(maxUprightTorque, tx));
      lower.body.torque.y += Math.max(-maxUprightTorque, Math.min(maxUprightTorque, ty));
      lower.body.torque.z += Math.max(-maxUprightTorque, Math.min(maxUprightTorque, tz));

      // add some angular damping to help settle
      lower.body.angularVelocity.scale(0.7, lower.body.angularVelocity);
    }

    // Now apply pose-correcting torques to each part relative to lower torso.
    parts.forEach(part=>{
      if(part === lower) return;
      const targetWorldQuat = lowerQuat.mult(part.initialRelToLower || part.body.quaternion);
      const invCurrent = part.body.quaternion.inverse();
      const rotDiff = targetWorldQuat.mult(invCurrent);

      if(Math.abs(rotDiff.w) > 0.9999) return;

      const partAngle = 2 * Math.acos(Math.max(-1, Math.min(1, rotDiff.w)));
      const s = Math.sqrt(1 - rotDiff.w * rotDiff.w) || 1;
      const axis = new CANNON.Vec3(rotDiff.x / s, rotDiff.y / s, rotDiff.z / s);

      // scale torque by mass so heavier parts take stronger corrections
      const baseTorque = 160; // slightly lower than upright torque but still strong
      const torqueScale = baseTorque * Math.sqrt(part.body.mass || 1);

      const maxTorque = 2500 * Math.sqrt(part.body.mass || 1);
      const tx = axis.x * partAngle * torqueScale;
      const ty = axis.y * partAngle * torqueScale;
      const tz = axis.z * partAngle * torqueScale;

      part.body.torque.x += Math.max(-maxTorque, Math.min(maxTorque, tx));
      part.body.torque.y += Math.max(-maxTorque, Math.min(maxTorque, ty));
      part.body.torque.z += Math.max(-maxTorque, Math.min(maxTorque, tz));

      // stabilization for limbs
      part.body.angularVelocity.scale(0.82, part.body.angularVelocity);
      part.body.velocity.scale(0.995, part.body.velocity);
    });

    // feet stabilization: reduce tipping more aggressively when standing
    const feet = parts.filter(p=>/Leg|LLLeg|RLLeg|LULeg|RULeg/.test(p.name));
    feet.forEach(f=>{
      f.body.angularVelocity.x *= 0.5;
      f.body.angularVelocity.z *= 0.5;
      // add a small downward force to help feet plant
      f.body.force.y -= 20;
    });
  }

  function renderLoop(){
    requestAnimationFrame(renderLoop);

    // If paused, skip physics stepping and standing forces but still render the scene so the UI/modal can be shown.
    if(state.paused){
      controls.update();
      renderer.render(scene, camera);
      return;
    }

    applyStandingPhysics();
    // step physics using a fixed timestep accumulator so slow motion stays stable.
    // We keep the physics fixedStep constant (1/60) and scale the amount of simulated time
    // by state.timeScale; accumulate real time and step multiple fixed steps if needed.
    if (typeof renderLoop._lastTime === 'undefined') {
      renderLoop._lastTime = performance.now() / 1000;
      renderLoop._accumulator = 0;
    }
    const now = performance.now() / 1000;
    let delta = now - renderLoop._lastTime;
    renderLoop._lastTime = now;

    // clamp large deltas (tab switching / hibernation) to avoid explosion of steps
    const maxDelta = 0.1; // seconds
    if (delta > maxDelta) delta = maxDelta;

    // scale the simulated time by timeScale (1 = real time, 0.25 = quarter speed)
    const timeScale = (state.timeScale === undefined) ? 1 : state.timeScale;
    const scaledDelta = delta * timeScale;

    renderLoop._accumulator += scaledDelta;

    const fixedTimeStep = 1 / 60; // physics fixed step
    const maxSubSteps = 4; // limit to avoid spiral of death

    let subSteps = 0;
    while (renderLoop._accumulator >= fixedTimeStep && subSteps < maxSubSteps) {
      world.step(fixedTimeStep);
      renderLoop._accumulator -= fixedTimeStep;
      subSteps++;
    }
    // if any leftover time remains, step a final time with that fraction to keep visuals responsive
    // (optional small fractional step for smoother interpolation)
    if (renderLoop._accumulator > 0 && subSteps === 0) {
      world.step(renderLoop._accumulator);
      renderLoop._accumulator = 0;
    }
    // sync meshes
    state.parts.forEach(part=>{
      part.mesh.position.copy(part.body.position);
      part.mesh.quaternion.copy(part.body.quaternion);
    });
    for(let i=0;i<state.mapMeshes.length;i++){
      state.mapMeshes[i].position.copy(state.mapBodies[i].position);
      state.mapMeshes[i].quaternion.copy(state.mapBodies[i].quaternion);
    }

    // if a void barrier exists, make it follow the ragdoll in X/Z and check for falls below its top Y
    if(state.voidBarrier){
      const lower = state.parts.find(p=>p.name==='LowerTorso');
      // follow ragdoll by X and Z (keep fixed Y)
      if(lower && state.voidBarrier.body){
        const followX = lower.body.position.x;
        const followZ = lower.body.position.z;
        // update physics body and visual mesh so the barrier tracks the ragdoll horizontally
        state.voidBarrier.body.position.x = followX;
        state.voidBarrier.body.position.z = followZ;
        if(state.voidBarrier.mesh){
          state.voidBarrier.mesh.position.x = followX;
          state.voidBarrier.mesh.position.z = followZ;
        }
      }

      const barrierYTop = state.voidBarrier.y + state.voidBarrier.halfHeight;
      // simple cooldown to avoid rapid repeated respawns
      const nowTs = performance.now();
      if(!state._lastVoidRespawnTime) state._lastVoidRespawnTime = 0;
      const cooldown = 600; // ms
      const fell = state.parts.some(p => p.body.position.y < barrierYTop);
      if(fell && (nowTs - state._lastVoidRespawnTime) > cooldown){
        // respawn: reset positions and velocities for all parts
        state.parts.forEach(p=>{
          p.body.position.copy(p.initialPos);
          p.body.quaternion.set(0,0,0,1);
          p.body.velocity.set(0,0,0);
          p.body.angularVelocity.set(0,0,0);
        });
        // also reset constraints/standing state
        state.isStanding = false;
        state._lastVoidRespawnTime = nowTs;
      }
    }

    if(state.isFollowing){
      const lower = state.parts.find(p=>p.name==='LowerTorso');
      if(lower){
        const targetPos = lower.mesh.position;
        const deltaMovement = targetPos.clone().sub(controls.target);
        camera.position.add(deltaMovement);
        controls.target.copy(targetPos);
      }
    } else {
      // free camera movement handled in interactions; controls still update
    }

    // keep the skybox centered on the camera so it appears infinitely distant
    if(state.sky){
      state.sky.position.copy(camera.position);
      // Ensure the skybox rotation stays fixed each frame to remove any small visual jitter
      state.sky.rotation.set(0, 0, 0);
    }

    controls.update();
    renderer.render(scene, camera);
  }
  renderLoop();
}