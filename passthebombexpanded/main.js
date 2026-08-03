import * as THREE from 'three';
import { state } from './state.js';
import { initScene } from './scene.js';
import { initUI } from './ui.js';
import {
  assignBomb,
  assignBombToRandom,
  checkBombPassing,
  checkWinCondition,
  finishIntro,
  updateCamera,
  updateIntroCamera,
  updatePlayerInput,
  updateSpectatorCamera,
  updateUI
} from './game.js';
import { playSound, sounds } from './audio.js';

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.1);
  const time = clock.getElapsedTime();

  if (state.gameState === 'intro') {
    state.introTimer += dt;

    if (state.gameMode === 'spectate' && !state.spectateTarget && state.players.length > 0) {
      state.spectateTarget = state.players[0];
    }

    state.players.forEach(p => p.update(dt, time, true));
    state.physicsWorld.step(dt);

    updateIntroCamera(dt, state.introTimer);
    updateUI();

    if (state.introTimer >= 8.5) {
      finishIntro();
    }
  }

  if (state.gameState === 'playing') {
    if (state.globalPassCooldown > 0) state.globalPassCooldown -= dt;

    if (state.gameMode === 'play') updatePlayerInput(dt);
    else if (state.gameMode === 'spectate' && !state.spectateTarget) updateSpectatorCamera(dt);

    state.players.forEach(p => p.update(dt, time));
    checkBombPassing();

    if (state.bombHolder) {
      state.bombTimer -= dt;
      const currentTickInt = Math.ceil(state.bombTimer);
      if (currentTickInt !== state.lastTickInt && currentTickInt > 0) {
        playSound('tick');
        state.lastTickInt = currentTickInt;
      }
      if (state.bombMesh) {
        const scale = 1 + (10 - state.bombTimer) * 0.05;
        state.bombMesh.scale.set(scale, scale, scale);
        const ud = state.bombMesh.userData;
        if (ud.spark) {
          const danger = Math.max(0, Math.min(1, 1 - state.bombTimer / 5));
          const pulse = 1 + 0.5 * Math.sin(time * (8 + danger * 22)) + danger * 0.8;
          ud.spark.scale.setScalar(0.5 + pulse * 0.4);
          if (ud.light) ud.light.intensity = 1.5 + danger * 6 + Math.sin(time * 10) * 0.5;
        }
      }

      if (state.bombTimer <= 0) {
        let explodedPlayer = state.bombHolder;
        explodedPlayer.explode();
        state.players = state.players.filter(p => p !== explodedPlayer);
        state.bombHolder = null;

        if(state.bombMesh) state.bombMesh.scale.set(1,1,1);

        if (explodedPlayer === state.myPlayer) {
          state.gameState = 'gameover';
          document.exitPointerLock();
          document.getElementById('game-ui').classList.add('hidden');
          document.getElementById('crosshair').style.display = 'none';
          document.getElementById('game-over').classList.remove('hidden');
          document.getElementById('game-over-title').innerText = "Game Over";
          document.getElementById('game-over-desc').innerHTML = `<span style="color:#ef4444; font-size:2rem">You blew up!</span>`;
          sounds.bgm.pause();
        } else {
          checkWinCondition();
          if (state.players.length > 1) {
            // Restore the bomb and pick where it will glide next.
            const next = state.players[Math.floor(Math.random() * state.players.length)];
            state.nextBombTarget = next;
            if (state.bombMesh) {
              if (state.bombMesh.parent) state.bombMesh.parent.remove(state.bombMesh);
              state.bombMesh.position.set(explodedPlayer.position.x, explodedPlayer.position.y + 1.5, explodedPlayer.position.z);
              state.bombMesh.quaternion.set(0, 0, 0, 1);
              state.bombMesh.scale.set(1, 1, 1);
              state.scene.add(state.bombMesh);
            }
            state.bombSpawnDelay = 3.0;
          }
        }
      }
    }

    if (!state.bombHolder && state.players.length > 1) {
      if (state.bombSpawnDelay > 0) {
        state.bombSpawnDelay -= dt;

        // Glide the bomb toward its next holder.
        if (state.bombMesh && state.nextBombTarget) {
          const t = state.nextBombTarget;
          const targetPos = t.position.clone();
          targetPos.y += 1.2 * (t.baseScale || 1.5);
          const delta = targetPos.clone().sub(state.bombMesh.position);
          state.bombMesh.position.addScaledVector(delta, Math.min(1, dt * 3.5));
          state.bombMesh.rotation.y += dt * 3;
          state.bombMesh.position.y += Math.sin(time * 6) * 0.03;
        }

        if (state.bombSpawnDelay <= 0) {
          if (state.nextBombTarget && state.nextBombTarget.isDead) {
            state.nextBombTarget = null;
            assignBombToRandom();
          } else if (state.nextBombTarget) {
            assignBomb(state.nextBombTarget);
            state.nextBombTarget = null;
          } else {
            assignBombToRandom();
          }
        }
      }
    }

    state.physicsWorld.step(dt);
    for (let i = state.debris.length - 1; i >= 0; i--) {
      const d = state.debris[i];
      d.mesh.position.copy(d.body.position);
      d.mesh.quaternion.copy(d.body.quaternion);
      d.timer -= dt;
      if (d.timer <= 0) {
        state.scene.remove(d.mesh);
        state.physicsWorld.removeBody(d.body);
        state.debris.splice(i, 1);
      }
    }

    updateCamera();
    updateUI();
  }

  if (state.sky) state.sky.position.copy(state.camera.position);

  if (!document.getElementById('customize-menu').classList.contains('hidden') && state.previewGroup) {
    state.previewGroup.rotation.y += dt;
    state.previewRenderer.render(state.previewScene, state.previewCamera);
  }

  state.renderer.render(state.scene, state.camera);
}

initScene();
initUI();

state.camera.position.set(0, 30, 40);
state.camera.lookAt(0, 0, 0);
state.camPitch = -0.5;

animate();
