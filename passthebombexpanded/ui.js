import * as THREE from 'three';
import { state } from './state.js';
import { NPC_NAMES } from './names.js';
import { sounds, toggleSfx, toggleMusic, isSfxMuted, isMusicMuted } from './audio.js';
import { startGame, finishIntro } from './game.js';
import { updatePreview } from './preview.js';

function populateNamesList() {
  const container = document.getElementById('npc-names-list');
  NPC_NAMES.forEach(name => {
    const lbl = document.createElement('label');
    lbl.className = "flex items-center space-x-2 text-sm select-none cursor-pointer hover:bg-white/10 p-1 rounded";
    lbl.innerHTML = `<input type="checkbox" value="${name}" checked class="name-checkbox accent-red-500 w-4 h-4 rounded"> <span class="truncate">${name}</span>`;
    container.appendChild(lbl);
  });
}

function initUI() {
  document.addEventListener('keydown', (e) => {
    if(state.keys.hasOwnProperty(e.key.toLowerCase())) state.keys[e.key.toLowerCase()] = true;
    if(e.code === 'Space') state.keys.space = true;
    if (state.gameState === 'intro' && (e.code === 'Enter' || e.code === 'Space')) finishIntro();
  });
  document.addEventListener('keyup', (e) => {
    if(state.keys.hasOwnProperty(e.key.toLowerCase())) state.keys[e.key.toLowerCase()] = false;
    if(e.code === 'Space') state.keys.space = false;
  });

  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === document.body) {
      if (state.gameMode === 'play' || state.spectateTarget) {
        state.camYaw -= (e.movementX || 0) * 0.002;
        state.camPitch += (e.movementY || 0) * 0.002;
      } else if (state.gameMode === 'spectate') {
        state.camYaw += (e.movementX || 0) * 0.002;
        state.camPitch += (e.movementY || 0) * 0.002;
      }
      state.camPitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, state.camPitch));
    }
  });

  document.addEventListener('wheel', (e) => {
    if (document.pointerLockElement === document.body) {
      state.camZoom += e.deltaY * 0.01;
      state.camZoom = Math.max(2, Math.min(30, state.camZoom));
    }
  });

  document.addEventListener('pointerlockchange', () => {
    state.isPointerLocked = document.pointerLockElement === document.body;
    if(!state.isPointerLocked && state.gameState === 'playing') {
      state.gameState = 'paused';
      document.getElementById('pause-menu').classList.remove('hidden');
      sounds.bgm.pause();
    } else if (state.isPointerLocked && state.gameState === 'paused') {
      state.gameState = 'playing';
      document.getElementById('pause-menu').classList.add('hidden');
      sounds.bgm.play().catch(()=>{});
    }
  });

  document.addEventListener('mousedown', (e) => {
    if (state.gameState === 'playing' && state.isPointerLocked && e.button === 0) {
      if (state.gameMode === 'spectate') {
        state.raycaster.setFromCamera(new THREE.Vector2(0, 0), state.camera);
        let hitPlayer = null;
        for(let p of state.players) {
          let intersects = state.raycaster.intersectObject(p.bodyMesh);
          if(intersects.length > 0) {
            hitPlayer = p;
            break;
          }
        }
        if (hitPlayer) {
          if (state.spectateTarget === hitPlayer) state.spectateTarget = null;
          else state.spectateTarget = hitPlayer;
        } else {
          state.spectateTarget = null;
        }
      }
    } else if (state.gameState === 'playing' && !state.isPointerLocked) {
      document.body.requestPointerLock();
    }
  });

  document.getElementById('setting-npcs').addEventListener('input', (e) => document.getElementById('npc-val').innerText = e.target.value);
  document.getElementById('setting-timer').addEventListener('input', (e) => document.getElementById('timer-val').innerText = e.target.value);
  document.getElementById('setting-jumps').addEventListener('input', (e) => document.getElementById('jumps-val').innerText = e.target.value);
  document.getElementById('setting-mapsize').addEventListener('input', (e) => document.getElementById('mapsize-val').innerText = e.target.value);
  document.getElementById('setting-platmulti').addEventListener('input', (e) => document.getElementById('platmulti-val').innerText = e.target.value + 'x');

  document.getElementById('setting-roblox').addEventListener('change', (e) => {
    state.isRobloxMode = e.target.checked;
    document.getElementById('roblox-val').innerText = state.isRobloxMode ? 'On' : 'Off';
    updatePreview();
  });

  document.getElementById('setting-walls').addEventListener('change', (e) => {
    state.enableWalls = e.target.checked;
    document.getElementById('walls-val').innerText = state.enableWalls ? 'On' : 'Off';
  });
  document.getElementById('setting-platforms').addEventListener('change', (e) => {
    state.enablePlatforms = e.target.checked;
    document.getElementById('platforms-val').innerText = state.enablePlatforms ? 'On' : 'Off';
  });

  document.getElementById('setting-easierbots').addEventListener('change', (e) => {
    state.easierBotsMode = e.target.checked;
    document.getElementById('easierbots-val').innerText = state.easierBotsMode ? 'On' : 'Off';
  });

  document.getElementById('mode-play').addEventListener('click', () => {
    state.selectedMode = 'play';
    document.getElementById('mode-play').className = "flex-1 py-2 rounded bg-red-600 font-bold border-2 border-red-400";
    document.getElementById('mode-spectate').className = "flex-1 py-2 rounded bg-gray-700 font-bold border-2 border-gray-500 hover:bg-gray-600";
  });
  document.getElementById('mode-spectate').addEventListener('click', () => {
    state.selectedMode = 'spectate';
    document.getElementById('mode-spectate').className = "flex-1 py-2 rounded bg-red-600 font-bold border-2 border-red-400";
    document.getElementById('mode-play').className = "flex-1 py-2 rounded bg-gray-700 font-bold border-2 border-gray-500 hover:bg-gray-600";
  });

  const updateAudioButtons = () => {
    const sfxBtn = document.getElementById('btn-sfx');
    const musicBtn = document.getElementById('btn-music');
    if (isSfxMuted()) { sfxBtn.textContent = '🔕 SFX'; sfxBtn.style.background = '#ef4444'; }
    else { sfxBtn.textContent = '🔔 SFX'; sfxBtn.style.background = '#4b5563'; }
    if (isMusicMuted()) { musicBtn.textContent = '🔇 Music'; musicBtn.style.background = '#ef4444'; }
    else { musicBtn.textContent = '🎵 Music'; musicBtn.style.background = '#4b5563'; }
  };

  document.getElementById('btn-sfx').addEventListener('click', () => {
    toggleSfx();
    updateAudioButtons();
  });
  document.getElementById('btn-music').addEventListener('click', () => {
    toggleMusic();
    updateAudioButtons();
  });
  updateAudioButtons();

  document.getElementById('btn-settings').addEventListener('click', () => {
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('settings-menu').classList.remove('hidden');
  });
  document.getElementById('btn-settings-back').addEventListener('click', () => {
    document.getElementById('settings-menu').classList.add('hidden');
    document.getElementById('main-menu').classList.remove('hidden');
  });

  document.getElementById('btn-customize').addEventListener('click', () => {
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('customize-menu').classList.remove('hidden');

    if (state.isRobloxMode) {
      document.getElementById('roblox-colors-container').classList.remove('hidden');
      document.getElementById('body-color-label').innerText = 'Torso Color:';
    } else {
      document.getElementById('roblox-colors-container').classList.add('hidden');
      document.getElementById('body-color-label').innerText = 'Body Color:';
    }

    updatePreview();
  });
  document.getElementById('btn-customize-back').addEventListener('click', () => {
    state.playerBodyColor = document.getElementById('edit-body-color').value;
    state.playerHeadArmColor = document.getElementById('edit-head-color').value;
    state.playerLegColor = document.getElementById('edit-leg-color').value;
    state.playerEyeColor = document.getElementById('edit-eye-color').value;
    state.playerHatType = document.getElementById('edit-hat').value;
    state.playerHatColor = document.getElementById('edit-hat-color').value;
    document.getElementById('customize-menu').classList.add('hidden');
    document.getElementById('main-menu').classList.remove('hidden');
  });
  document.getElementById('edit-hat').addEventListener('change', (e) => {
    const val = e.target.value;
    const colorPicker = document.getElementById('edit-hat-color');
    if (val === 'none') {
      colorPicker.disabled = true;
      colorPicker.style.opacity = '0.3';
    } else {
      colorPicker.disabled = false;
      colorPicker.style.opacity = '1';
    }
    updatePreview();
  });

  document.getElementById('edit-body-color').addEventListener('input', updatePreview);
  document.getElementById('edit-head-color').addEventListener('input', updatePreview);
  document.getElementById('edit-leg-color').addEventListener('input', updatePreview);
  document.getElementById('edit-eye-color').addEventListener('input', updatePreview);
  document.getElementById('edit-hat-color').addEventListener('input', updatePreview);

  document.getElementById('btn-names-all').addEventListener('click', () => document.querySelectorAll('.name-checkbox').forEach(cb => cb.checked = true));
  document.getElementById('btn-names-none').addEventListener('click', () => document.querySelectorAll('.name-checkbox').forEach(cb => cb.checked = false));

  document.getElementById('btn-start').addEventListener('click', () => startGame(parseInt(document.getElementById('setting-npcs').value), state.selectedMode, parseInt(document.getElementById('setting-timer').value)));
  document.getElementById('btn-skip-intro').addEventListener('click', finishIntro);
  document.getElementById('btn-random-name').addEventListener('click', () => {
    const name = NPC_NAMES[Math.floor(Math.random() * NPC_NAMES.length)];
    document.getElementById('player-name').value = name;
  });
  document.getElementById('btn-menu').addEventListener('click', () => {
    document.getElementById('game-over').classList.add('hidden');
    document.getElementById('main-menu').classList.remove('hidden');
    document.getElementById('nametags-container').innerHTML = '';
    document.getElementById('btn-skip-intro').classList.add('hidden');
    state.gameState = 'menu';
  });
  document.getElementById('btn-resume').addEventListener('click', () => document.body.requestPointerLock());
  document.getElementById('btn-quit').addEventListener('click', () => {
    document.getElementById('pause-menu').classList.add('hidden');
    document.getElementById('game-ui').classList.add('hidden');
    document.getElementById('crosshair').style.display = 'none';
    document.getElementById('btn-skip-intro').classList.add('hidden');
    document.getElementById('main-menu').classList.remove('hidden');
    document.getElementById('nametags-container').innerHTML = '';
    state.gameState = 'menu';
    sounds.bgm.pause();
  });
}

export { populateNamesList, initUI };
