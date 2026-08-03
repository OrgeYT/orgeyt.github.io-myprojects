import * as THREE from 'three';
import { state } from './state.js';
import { NPC_NAMES } from './names.js';
import { sounds, playSound } from './audio.js';
import { Character } from './character.js';
import { buildMap } from './map.js';

function getSelectedNames() {
  let checked = Array.from(document.querySelectorAll('.name-checkbox:checked')).map(cb => cb.value);
  return checked.length > 0 ? checked : [...NPC_NAMES];
}

function startGame(npcs, mode, timer) {
  state.players.forEach(p => state.scene.remove(p.mesh));
  state.players = [];
  state.debris.forEach(d => { state.scene.remove(d.mesh); state.physicsWorld.removeBody(d.body); });
  state.debris = [];

  state.maxAllowedJumps = parseInt(document.getElementById('setting-jumps').value);
  state.MAP_SIZE = parseInt(document.getElementById('setting-mapsize').value);
  state.platformMultiplier = parseFloat(document.getElementById('setting-platmulti').value);
  buildMap();

  // Hide platforms initially for the intro sequence
  state.platforms.forEach(p => {
    if (!p.isIntro) p.mesh.visible = false;
  });

  state.bombTimer = state.initialBombTimer = timer;
  state.bombSpawnDelay = 0;
  state.gameMode = mode;
  state.gameState = 'intro';
  state.introTimer = 0;
  state.spectateTarget = null;
  state.camYaw = 0;
  state.camPitch = 0.2;
  state.camZoom = 15;

  document.getElementById('nametags-container').innerHTML = '';
  document.getElementById('main-menu').classList.add('hidden');
  document.getElementById('settings-menu').classList.add('hidden');
  document.getElementById('game-ui').classList.remove('hidden');
  document.getElementById('crosshair').style.display = 'block';
  document.getElementById('btn-skip-intro').classList.remove('hidden');

  if (state.gameMode === 'play') {
    const chosenName = document.getElementById('player-name').value.trim() || 'User';
    state.myPlayer = new Character(true, 'player', chosenName, state.playerBodyColor, state.playerHatType, state.playerHatColor, state.playerHeadArmColor, state.playerLegColor, state.playerEyeColor);
    state.players.push(state.myPlayer);
  } else {
    state.myPlayer = null;
  }

  const availableNames = getSelectedNames();
  const hatTypes = ['none', 'none', 'santa', 'cone', 'beanie', 'bomb', 'crown', 'cap', 'tophat', 'party', 'wizard', 'sombrero', 'propeller', 'headphones'];
  for(let i=0; i<npcs; i++) {
    const randomName = availableNames[Math.floor(Math.random() * availableNames.length)];
    const rBody = '#' + new THREE.Color().setHSL(Math.random(), 0.8, 0.5).getHexString();
    const rHeadArm = state.isRobloxMode ? '#' + new THREE.Color().setHSL(Math.random(), 0.8, 0.5).getHexString() : '#ffab66';
    const rLegs = state.isRobloxMode ? '#' + new THREE.Color().setHSL(Math.random(), 0.8, 0.5).getHexString() : '#000000';
    const rHat = hatTypes[Math.floor(Math.random() * hatTypes.length)];
    const rHatColor = '#' + new THREE.Color().setHSL(Math.random(), 0.8, 0.5).getHexString();
    const rEye = '#' + new THREE.Color().setHSL(Math.random(), Math.random() * 0.3 + 0.1, Math.random() * 0.2 + 0.12).getHexString();
    state.players.push(new Character(false, 'npc_'+i, randomName, rBody, rHat, rHatColor, rHeadArm, rLegs, rEye));
  }

  if(state.players.length === 0) return;

  const spacing = 3.5;
  const startX = -(state.players.length * spacing) / 2;
  const introY = 1000;
  state.players.forEach((p, i) => {
    p.position.set(startX + i * spacing + (spacing/2), introY + 10, 0);
    p.velocity.set(0,0,0);
  });

  document.getElementById('ui-mode-text').innerText = "Match Starting...";

  sounds.bgm.currentTime = 0;
  sounds.bgm.play().catch(()=>{});

  document.body.requestPointerLock();
}

function clearDebris() {
  state.debris.forEach(d => {
    state.scene.remove(d.mesh);
    state.physicsWorld.removeBody(d.body);
  });
  state.debris = [];
}

function assignBomb(target) {
  clearDebris();
  passBombTo(target, null);
  state.bombTimer = state.initialBombTimer;
  state.lastTickInt = Math.ceil(state.bombTimer);
}

function assignBombToRandom() {
  if(state.players.length === 0) return;
  const target = state.players[Math.floor(Math.random() * state.players.length)];
  assignBomb(target);
}

function finishIntro() {
  if (state.gameState !== 'intro') return;
  state.gameState = 'playing';
  const spawnRange = (state.MAP_SIZE / 2) - 5;
  state.players.forEach(p => {
    // Teleport into the main arena
    p.position.set((Math.random()-0.5)*spawnRange*2, 10, (Math.random()-0.5)*spawnRange*2);
    p.velocity.set(0,0,0);
  });

  state.platforms.forEach(p => p.mesh.visible = true); // Unhide platforms after intro

  assignBombToRandom();
  document.getElementById('ui-mode-text').innerText = "WASD to Move | Mouse to Look | Scroll to Zoom | Click to Target (Spectator)";
  document.getElementById('btn-skip-intro').classList.add('hidden');
}

function passBombTo(newHolder, oldHolder) {
  state.bombHolder = newHolder;
  state.globalPassCooldown = 0.5;
  if(oldHolder) {
    newHolder.cannotPassTo = oldHolder;
    newHolder.cannotPassTimer = 3.0;
  }
  newHolder.handedness = Math.random() > 0.5 ? 'left' : 'right';
  if(newHolder.handedness === 'left') newHolder.leftHand.add(state.bombMesh);
  else newHolder.rightHand.add(state.bombMesh);
  state.bombMesh.position.set(0, 0, 0);
}

function checkBombPassing() {
  if(state.globalPassCooldown > 0 || !state.bombHolder) return;

  // Pre-calculate bomb holder's full body bounding box if in roblox mode
  let holderBox = null;
  if (state.isRobloxMode && state.bombHolder.robloxGroup) {
    holderBox = new THREE.Box3().setFromObject(state.bombHolder.robloxGroup);
  }

  for (let i = 0; i < state.players.length; i++) {
    const p = state.players[i];

    // Skip if it's the bomb holder, dead, or on cooldown from just passing
    if (p === state.bombHolder || p.isDead) continue;
    if (state.bombHolder.cannotPassTo === p && state.bombHolder.cannotPassTimer > 0) continue;

    let isCollision = false;

    if (state.isRobloxMode && p.robloxGroup && holderBox) {
      // Check if ANY body part (arms, legs, head, torso) touches via Bounding Box intersection
      const pBox = new THREE.Box3().setFromObject(p.robloxGroup);
      isCollision = holderBox.intersectsBox(pBox);
    } else {
      // Standard distance check for non-Roblox mode
      if (state.bombHolder.position.distanceTo(p.position) < 2.5 * (p.baseScale || 1.5)) {
        isCollision = true;
      }
    }

    if (isCollision) {
      passBombTo(p, state.bombHolder);
      return; // Stop checking once successfully passed
    }
  }
}

function updatePlayerInput(dt) {
  if(!state.myPlayer || state.myPlayer.isDead) return;

  const speed = 30 * dt * 5;

  const forward = new THREE.Vector3(Math.sin(state.camYaw), 0, Math.cos(state.camYaw));
  const right = new THREE.Vector3(forward.z, 0, -forward.x);

  let inputDir = new THREE.Vector3(0, 0, 0);

  if(state.keys.w) { inputDir.x -= forward.x; inputDir.z -= forward.z; }
  if(state.keys.s) { inputDir.x += forward.x; inputDir.z += forward.z; }
  if(state.keys.a) { inputDir.x -= right.x; inputDir.z -= right.z; }
  if(state.keys.d) { inputDir.x += right.x; inputDir.z += right.z; }

  if (inputDir.lengthSq() > 0) {
    inputDir.normalize();
    state.myPlayer.velocity.x += inputDir.x * speed;
    state.myPlayer.velocity.z += inputDir.z * speed;
  }

  if(state.keys.space) state.myPlayer.jump();
  state.keys.space = false;
}

function updateSpectatorCamera(dt) {
  const speed = 30 * 2 * dt;
  const dir = new THREE.Vector3();
  state.camera.getWorldDirection(dir);
  const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0,1,0)).normalize();

  if(state.keys.w) state.camera.position.addScaledVector(dir, speed);
  if(state.keys.s) state.camera.position.addScaledVector(dir, -speed);
  if(state.keys.a) state.camera.position.addScaledVector(right, -speed);
  if(state.keys.d) state.camera.position.addScaledVector(right, speed);
  if(state.keys.e) state.camera.position.y += speed;
  if(state.keys.q) state.camera.position.y -= speed;

  state.camera.rotation.set(0,0,0);
  state.camera.rotateY(-state.camYaw);
  state.camera.rotateX(-state.camPitch);
}

function updateCamera() {
  let activeTarget = (state.gameMode === 'play') ? state.myPlayer : state.spectateTarget;

  if (activeTarget && !activeTarget.isDead) {
    const targetPos = activeTarget.position.clone();
    targetPos.y += 1 * (activeTarget.baseScale || 1.5);
    state.camera.position.x = targetPos.x + state.camZoom * Math.sin(state.camYaw) * Math.cos(state.camPitch);
    state.camera.position.y = targetPos.y + state.camZoom * Math.sin(state.camPitch);
    state.camera.position.z = targetPos.z + state.camZoom * Math.cos(state.camYaw) * Math.cos(state.camPitch);
    state.camera.lookAt(targetPos);
  }
}

function updateIntroCamera(dt, introTimer) {
  let activeTarget = (state.gameMode === 'play') ? state.myPlayer : state.spectateTarget;
  if(!activeTarget && state.players.length > 0) activeTarget = state.players[0];

  const INTRO_Y = 1000;

  if (introTimer < 4.0) {
    const N = state.players.length;
    const radius = Math.max(15, 10 + N * 1.5);
    const angle = -Math.PI/2 + (introTimer / 4.0) * (Math.PI * 2);
    state.camera.position.set(Math.sin(angle) * radius, INTRO_Y + 6 + radius*0.1, Math.cos(angle) * radius);
    state.camera.lookAt(0, INTRO_Y + 2, 0);
  } else {
    let t = (introTimer - 4.0) / 4.5;
    t = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    let targetIdx = state.players.indexOf(activeTarget);
    if (targetIdx === -1) targetIdx = 0;

    let p1 = state.players[0].position.clone();
    let p2 = activeTarget.position.clone();

    let lookPos = new THREE.Vector3().lerpVectors(p1, p2, t);
    lookPos.y += 1 * (activeTarget.baseScale || 1.5);

    state.camera.position.set(lookPos.x, lookPos.y + 3, lookPos.z + 12 - (t * 5));
    state.camera.lookAt(lookPos);
  }
}

function updateUI() {
  state.players.forEach(p => {
    if (p.isDead || !p.nametag) return;

    if (p === state.bombHolder) {
      p.nametag.innerHTML = `<div style="text-align: center; color: #facc15; font-size: 1.5em; margin-bottom: 0.1rem; text-shadow: 2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000;">💣 ${Math.ceil(state.bombTimer)}</div><div style="text-align: center;">${p.name}</div>`;
      p.nametag.style.zIndex = "20";
    } else {
      p.nametag.innerHTML = `<div style="text-align: center;">${p.name}</div>`;
      p.nametag.style.zIndex = "10";
    }

    const vec = p.position.clone();
    vec.y += (p === state.bombHolder ? (state.isRobloxMode ? 3.8 : 3.0) : (state.isRobloxMode ? 3.0 : 2.2)) * (p.baseScale || 1.5);
    vec.project(state.camera);

    if(vec.z > 1) {
      p.nametag.style.display = 'none';
    } else {
      p.nametag.style.display = 'block';
      const x = (vec.x *  .5 + .5) * window.innerWidth;
      const y = (vec.y * -.5 + .5) * window.innerHeight;
      p.nametag.style.left = `${x}px`;
      p.nametag.style.top = `${y}px`;

      const dist = state.camera.position.distanceTo(p.position);
      const scale = Math.max(0.4, Math.min(1.2, 25 / dist));
      p.nametag.style.transform = `translate(-50%, -50%) scale(${scale})`;
    }
  });
}

function checkWinCondition() {
  if (state.players.length === 1) {
    state.gameState = 'gameover';
    document.exitPointerLock();
    document.getElementById('game-ui').classList.add('hidden');
    document.getElementById('crosshair').style.display = 'none';
    document.getElementById('game-over').classList.remove('hidden');

    const winner = state.players[0];
    const colorHex = '#' + winner.color.getHexString();
    const text = winner.isPlayer ? "You Win!" : `Winner: ${winner.name}`;
    document.getElementById('game-over-desc').innerHTML = `<span style="color:${colorHex}; font-size:2rem">${text}</span>`;

    playSound('win');
    sounds.bgm.pause();
  } else if (state.players.length === 0) {
    state.gameState = 'gameover';
    document.exitPointerLock();
    document.getElementById('game-over').classList.remove('hidden');
    document.getElementById('game-over-desc').innerText = "Draw!";
    sounds.bgm.pause();
  }
}

export { getSelectedNames, startGame, assignBomb, assignBombToRandom, finishIntro, passBombTo, checkBombPassing, updatePlayerInput, updateSpectatorCamera, updateCamera, updateIntroCamera, updateUI, checkWinCondition };
