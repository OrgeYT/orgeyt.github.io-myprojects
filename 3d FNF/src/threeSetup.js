/* src/threeSetup.js
   Three.js setup extracted from engine.js.
   Exports initThree, createReceptors, getThreeContext, startRenderLoop.
*/
export async function initThree(config, state) {
  // create container and Three essentials
  return new Promise((resolve) => {
    const container = document.getElementById('game-container');

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x111111, 0.02);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 15);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    const colors = [
      0xc24b99,
      0x00ffff,
      0x12fa05,
      0xf9393f
    ];

    // receptors: use 3D sphere geometry (rounded) for receptors, with a glow material per lane for feedback
    // Using moderate segment counts for good visual quality without heavy performance cost
    const receptorGeometry = new THREE.SphereGeometry(0.7, 32, 16);
    const noteGeometry = new THREE.BoxGeometry(1.2, 1.2, 0.2);

    // receptors are neutral gray filled by default
    const receptorMats = colors.map(() => new THREE.MeshPhongMaterial({
      color: 0x777777,
      emissive: 0x000000,
      emissiveIntensity: 0,
      shininess: 30,
      transparent: false,
      opacity: 1
    }));

    // keep per-lane glow materials (colored) for hit feedback
    const receptorGlowMats = colors.map(color => new THREE.MeshPhongMaterial({
      color: 0xffffff,
      emissive: color,
      emissiveIntensity: 0.8,
      shininess: 100
    }));

    // note base materials (colored)
    const noteMats = colors.map(color => new THREE.MeshPhongMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 0.4,
      shininess: 80
    }));

    // outlines: create slightly darker variants used as a thin outline by rendering a slightly larger mesh behind the main note
    const noteOutlineMats = colors.map(color => {
      const c = new THREE.Color(color);
      // darken the color for outline
      c.multiplyScalar(0.35);
      return new THREE.MeshBasicMaterial({
        color: c,
        depthTest: true,
        depthWrite: false,
        transparent: true,
        opacity: 1
      });
    });

    // highways
    const highwayGeo = new THREE.PlaneGeometry(8, 30);
    const highwayMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0a, transparent: true, opacity: 0.8 });

    const playerHighway = new THREE.Mesh(highwayGeo, highwayMat);
    playerHighway.position.set(config.playerXOffset, 0, -1);
    scene.add(playerHighway);

    const oppHighway = new THREE.Mesh(highwayGeo, highwayMat);
    oppHighway.position.set(config.opponentXOffset, 0, -1);
    scene.add(oppHighway);

    // create simple character sprites using available GIFs and add them to the scene
    const texLoader = new THREE.TextureLoader();
    const idleTex = texLoader.load('/fnf_idle.gif');
    const downTex = texLoader.load('/fnf_down.gif');
    const upTex = texLoader.load('/fnf_up.gif');
    const leftTex = texLoader.load('/fnf_left.gif');
    const rightTex = texLoader.load('/fnf_right.gif');

    // helper to make a sprite (start with idle)
    function makeCharSprite(texture) {
      const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
      const sp = new THREE.Sprite(mat);
      // scale default: width x height in world units (small, tuned for scene)
      sp.scale.set(2.8, 2.8, 1);
      sp.position.z = 0.5;
      return sp;
    }

    const playerChar = makeCharSprite(idleTex);
    const opponentChar = makeCharSprite(idleTex);

    // place them relative to highways: player on right side, opponent on left
    // moved player further right and opponent further left for clearer separation
    // move player further to the right and opponent further to the left for clearer separation
    playerChar.position.x = config.playerXOffset + 5.4;
    playerChar.position.y = config.receptorY - 1.2;
    opponentChar.position.x = config.opponentXOffset - 5.4;
    opponentChar.position.y = config.receptorY - 1.2;

    // flip opponent horizontally so it faces the other way
    opponentChar.scale.x *= -1;

    // add to scene
    scene.add(playerChar);
    scene.add(opponentChar);

    // expose to state for other modules
    // store textures and characters so runtime can swap animations
    state._three = {
      scene,
      camera,
      renderer,
      clock: new THREE.Clock(),
      receptorGeometry,
      noteGeometry,
      receptorMats,
      receptorGlowMats,
      noteMats,
      noteOutlineMats,
      characters: {
        player: playerChar,
        opponent: opponentChar,
        textures: { idleTex, downTex, upTex, leftTex, rightTex }
      }
    };

    // tint the opponent slightly to visually differentiate (multiply tint via material.color)
    try {
      if (opponentChar && opponentChar.material) {
        // subtle bluish tint
        opponentChar.material.color.setHex(0x8fb3ff);
        opponentChar.material.needsUpdate = true;
      }
    } catch (e) {
      // ignore if sprite material not mutable
    }

    // resize handling
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    resolve();
  });
}

export function createReceptors(config, state) {
  const { scene, receptorGeometry, receptorMats, receptorGlowMats } = state._three;
  state.receptors.player.forEach(r => scene.remove(r));
  state.receptors.opponent.forEach(r => scene.remove(r));
  state.receptors.player = [];
  state.receptors.opponent = [];

  // flatten factor: <1 makes spheres squashed on the Z axis (smaller -> flatter front-to-back)
  const flattenZ = 0.55;

  // store a baseScale per receptor so runtime glow/resets preserve flattening
  const baseScale = new THREE.Vector3(1, 1, flattenZ);

  for (let i = 0; i < 4; i++) {
    const pReceptor = new THREE.Mesh(receptorGeometry, receptorMats[i]);
    pReceptor.position.x = config.playerXOffset + (i - 1.5) * config.laneWidth;
    pReceptor.position.y = config.receptorY;
    pReceptor.position.z = 0;
    // apply front-to-back flattening for a puck-like receptor (squash on Z)
    pReceptor.scale.copy(baseScale);
    pReceptor.userData = { lane: i, originalMat: receptorMats[i], glowMat: receptorGlowMats[i], glowTimer: 0, baseScale: baseScale.clone() };
    scene.add(pReceptor);
    state.receptors.player.push(pReceptor);

    const oReceptor = new THREE.Mesh(receptorGeometry, receptorMats[i]);
    oReceptor.position.x = config.opponentXOffset + (i - 1.5) * config.laneWidth;
    oReceptor.position.y = config.receptorY;
    oReceptor.position.z = 0;
    oReceptor.scale.copy(baseScale);
    oReceptor.userData = { lane: i, originalMat: receptorMats[i], glowMat: receptorGlowMats[i], glowTimer: 0, baseScale: baseScale.clone() };
    scene.add(oReceptor);
    state.receptors.opponent.push(oReceptor);
  }
}

export function getThreeContext() {
  return (window && window.__ENGINE_THREE__) ? window.__ENGINE_THREE__ : null;
}

export function startRenderLoop(config, state, Notes, UI) {
  const { scene, camera, renderer, clock } = state._three;

  function loop() {
    requestAnimationFrame(loop);

    if (state.isPlaying && !state.isPaused) {
      let delta = clock.getDelta();

      if (state.audioElements && state.audioElements.length > 0) {
        const mainAudio = state.audioElements[0];
        const audioTime = mainAudio.currentTime;

        if (!mainAudio.paused && Math.abs(state.time - audioTime) > 0.05) {
          delta = audioTime - state.time;
          state.time = audioTime;
        } else {
          state.time += delta;
        }
      } else {
        state.time += delta;
      }

      const lookaheadTime = 25 / config.scrollSpeed;
      while (state.chartIndex < state.chart.length &&
             state.chart[state.chartIndex].time <= state.time + lookaheadTime) {
        Notes.spawnNote(state, config, state.chart[state.chartIndex]);
        state.chartIndex++;
      }

      Notes.updateNotes(state, config, delta);

      state.receptors.opponent.forEach((r) => {
        if (r.userData.glowTimer > 0) {
          r.userData.glowTimer -= delta;
          r.material = r.userData.glowMat;
          // preserve the flattened Z by multiplying the baseScale
          if (r.userData && r.userData.baseScale) {
            r.scale.copy(r.userData.baseScale).multiplyScalar(1.1);
          } else {
            r.scale.set(1.1, 1.1, 1.1);
          }
        } else {
          r.material = r.userData.originalMat;
          if (r.userData && r.userData.baseScale) {
            r.scale.copy(r.userData.baseScale);
          } else {
            r.scale.set(1, 1, 1);
          }
        }
      });

      state.receptors.player.forEach((r, i) => {
        // Prefer explicit glowTimer first (so quick taps still show animation),
        // otherwise fall back to keysHeld for sustained hold visuals.
        if (r.userData && r.userData.glowTimer > 0) {
          r.userData.glowTimer -= delta;
          r.material = r.userData.glowMat;
          if (r.userData && r.userData.baseScale) {
            r.scale.copy(r.userData.baseScale).multiplyScalar(1.1);
          } else {
            r.scale.set(1.1, 1.1, 1.1);
          }
        } else if (state.keysHeld[i]) {
          r.material = r.userData.glowMat;
          if (r.userData && r.userData.baseScale) {
            r.scale.copy(r.userData.baseScale).multiplyScalar(1.1);
          } else {
            r.scale.set(1.1, 1.1, 1.1);
          }
        } else {
          r.material = r.userData.originalMat;
          if (r.userData && r.userData.baseScale) {
            r.scale.copy(r.userData.baseScale);
          } else {
            r.scale.set(1, 1, 1);
          }
        }
      });

      // Character sprite animation: choose sprite frame based on input/glow state
      try {
        const chars = state._three && state._three.characters;
        if (chars) {
          const { player: pChar, opponent: oChar, textures } = chars;

          // Helper to pick texture for an actor based on an active lane index or idle
          function pickTextureForKeyState(index, isOpponent) {
            if (index === 0) return textures.leftTex;
            if (index === 1) return textures.downTex;
            if (index === 2) return textures.upTex;
            if (index === 3) return textures.rightTex;
            return textures.idleTex;
          }

          // Player: if any key is held, show corresponding direction (prefer last held lane)
          let playerTex = textures.idleTex;
          if (Array.isArray(state.keysHeld)) {
            // find highest-priority held lane (rightmost pressed lane)
            let heldIdx = -1;
            for (let k = 0; k < state.keysHeld.length; k++) {
              if (state.keysHeld[k]) heldIdx = k;
            }
            if (heldIdx !== -1) playerTex = pickTextureForKeyState(heldIdx, false);
          }
          if (pChar && pChar.material && pChar.material.map !== playerTex) {
            pChar.material.map = playerTex;
            pChar.material.needsUpdate = true;
          }

          // Opponent: derive active lane from any receptor glowTimers > 0 (first matching), otherwise idle
          let oppTex = textures.idleTex;
          for (let lane = 0; lane < (state.receptors.opponent ? state.receptors.opponent.length : 0); lane++) {
            const r = state.receptors.opponent[lane];
            if (r && r.userData && r.userData.glowTimer > 0) {
              oppTex = pickTextureForKeyState(lane, true);
              break;
            }
          }
          if (oChar && oChar.material && oChar.material.map !== oppTex) {
            oChar.material.map = oppTex;
            oChar.material.needsUpdate = true;
          }
        }
      } catch (e) {
        // swallow sprite update errors to avoid breaking render loop
      }

    } else if (!state.isPaused) {
      clock.getDelta();
      const time = Date.now() * 0.002;
      state.receptors.player.forEach((r, i) => {
        r.rotation.z = Math.sin(time + i) * 0.1;
      });
      state.receptors.opponent.forEach((r, i) => {
        r.rotation.z = Math.sin(time + i + Math.PI) * 0.1;
      });
    }

    renderer.render(scene, camera);
  }

  loop();
}