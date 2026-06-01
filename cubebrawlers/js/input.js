import { Engine } from "./engine.js";
const THREE = Engine.THREE;

export const Input = {
  keys: { w: false, a: false, s: false, d: false, shift: false, e: false, r: false, q: false },
  mouseMovement: { x: 0, y: 0 },
  mousePitch: 0,
  // spectate state held here so we don't pollute Character
  _spectateState: {
    pos: null,
    yaw: 0,
    pitch: 0,
    vel: null,
    speed: 18,
    sprintMult: 2.0
  },
  init() {
    document.addEventListener('keydown', this._onKeyDown.bind(this));
    document.addEventListener('keyup', this._onKeyUp.bind(this));
    document.addEventListener('mousedown', this._onMouseDown.bind(this));
    document.addEventListener('mousemove', this._onMouseMove.bind(this));

    const startBtn = document.getElementById('start-btn');
    startBtn.addEventListener('click', () => {
      // Request pointer lock (user gesture) and start background music here
      document.body.requestPointerLock();
      // Play normal background music on user interaction so browser autoplay policies allow it
      if (Engine.sounds && Engine.sounds.playMusic) {
        Engine.sounds.playMusic('BgmNormal');
      }
    });

    document.addEventListener('pointerlockchange', () => {
      Engine.isLocked = document.pointerLockElement === document.body;
      document.getElementById('start-overlay').style.display = Engine.isLocked ? 'none' : 'flex';
      document.getElementById('spawn-menu').style.display = Engine.isLocked ? 'none' : 'flex';
      if (!Engine.isLocked) {
        this.keys = { w: false, a: false, s: false, d: false, shift: false, e: false, r: false };
      } else {
        // When the player locks the pointer (starts the game), ensure normal BGM starts if it's not already playing.
        if (Engine.sounds && Engine.sounds.playMusic && !Engine.sounds.currentMusic) {
          Engine.sounds.playMusic('BgmNormal');
        }
      }
    });

    document.querySelectorAll('#spawn-menu .btn').forEach(b => {
      b.addEventListener('click', () => {
        const ai = b.getAttribute('data-ai');
        if (ai !== null) {
          const withUltToggle = document.getElementById('spawn-with-ult');
          const withUlt = !!(withUltToggle && withUltToggle.checked);
          spawnEnemy(ai || 'none', withUlt);
        }
      });
    });

    // Specific handler for the Spawn Unfair button (explicit id used for styling/clarity)
    const spawnUnfairBtn = document.getElementById('spawn-unfair');
    if (spawnUnfairBtn) {
      spawnUnfairBtn.addEventListener('click', () => {
        const withUltToggle = document.getElementById('spawn-with-ult');
        const withUlt = !!(withUltToggle && withUltToggle.checked);
        spawnEnemy('unfair', withUlt);
      });
    }

    // Bring NPCs to each other: cluster all non-player NPCs around arena center in a tight group
    const bringBtn = document.getElementById('bring-npcs');
    if (bringBtn) {
      bringBtn.addEventListener('click', () => {
        // compute a compact circle of positions near center
        const center = new THREE.Vector3(0, 0.6, 0);
        const npcs = Engine.characters.filter(c => !c.isPlayer && !c.isDead);
        if (npcs.length === 0) return;
        const radius = Math.min(3, Math.max(1, npcs.length * 0.5));
        for (let i = 0; i < npcs.length; i++) {
          const angle = (i / npcs.length) * Math.PI * 2;
          const pos = center.clone().add(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
          npcs[i].pivot.position.copy(pos);
          // reset velocities and states for clarity
          npcs[i].velocity.set(0, 0, 0);
          if (npcs[i].state !== 'dead') npcs[i].changeState('idle');
          // ensure floating UI updates immediately
          npcs[i].updateUI();
        }
      });
    }

    // Give Ult button: instantly fill the player's ult meter
    const giveUltBtn = document.getElementById('give-ult-btn');
    if (giveUltBtn) {
      giveUltBtn.addEventListener('click', () => {
        if (Engine.player && !Engine.player.isDead) {
          Engine.player.ultCharge = Engine.player.maxUltCharge;
          if (Engine.ui && Engine.player) Engine.ui.updatePlayerUI();
        }
      });
    }

    // Map selector: change maps at runtime
    const mapSelect = document.getElementById('map-select');
    if (mapSelect) {
      mapSelect.addEventListener('change', () => {
        const val = mapSelect.value || 'default';
        // call engine map switch (engine exports setMap)
        if (Engine && Engine.setMap) {
          Engine.setMap(val);
        } else {
          // fallback: dynamically import engine and call setMap if necessary
          import('./engine.js').then(m => { if (m.setMap) m.setMap(val); }).catch(()=>{});
        }
      });
    }

    // Remove all NPCs button
    const removeNpcsBtn = document.getElementById('remove-npcs');
    if (removeNpcsBtn) {
      removeNpcsBtn.addEventListener('click', () => {
        // remove non-player characters from scene and engine list
        const npcs = Engine.characters.slice().filter(c => !c.isPlayer);
        for (const npc of npcs) {
          try {
            // hide/remove visual elements
            if (npc.uiElement) npc.uiElement.remove();
            if (npc.pivot && npc.pivot.parent) npc.pivot.parent.remove(npc.pivot);
            // mark dead to avoid lingering logic calls
            npc.isDead = true;
            // remove from Engine.characters array
            const idx = Engine.characters.indexOf(npc);
            if (idx !== -1) Engine.characters.splice(idx, 1);
          } catch (e) { /* ignore */ }
        }
      });
    }
  },

  _onKeyDown(e) {
    const k = e.key.toLowerCase();
    if (this.keys.hasOwnProperty(k)) this.keys[k] = true;
    const player = Engine.player;

    // Allow jumping via Space (use code to avoid localization differences)
    if (e.code === 'Space' && Engine.isLocked && player && !player.isDead && player.state !== 'stunned' && player.state !== 'grabbed' && player.state !== 'ult_transforming') {
      // only allow jump when grounded and in a moveable state
      if (player.isGrounded && (player.state === 'idle' || player.state === 'blocking' || player.state === 'punching' || player.state === 'skill4_combo' || player.state === 'ult3_combo')) {
        player.velocity.y = 12;
        player.isGrounded = false;
      }
    }

    if (!Engine.isLocked) return;
    // Allow toggling spectate with Q while pointer locked:
    if (k === 'q') {
      // Toggle spectate mode
      Engine.spectating = !Engine.spectating;
      const st = this._spectateState;

      if (Engine.spectating) {
        // enter spectate: initialize spectate camera at player's head (or camera if no player)
        const src = (Engine.player && !Engine.player.isDead) ? Engine.player.pivot.position.clone() : new THREE.Vector3(0, 2, 10);
        st.pos = src.clone().add(new THREE.Vector3(0, 1.6, 0));
        // derive yaw from player pivot when available
        st.yaw = (Engine.player) ? Engine.player.pivot.rotation.y : 0;
        // keep current input pitch so vertical look is preserved
        st.pitch = this.mousePitch;
        // sync main mousePitch so processPlayerInput will use it consistently
        this.mousePitch = st.pitch;
        st.vel = new THREE.Vector3(0, 0, 0);
        // immediately place camera
        Engine.camera.position.copy(st.pos);
        // set camera orientation
        const look = st.pos.clone().add(new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0,1,0), st.yaw));
        Engine.camera.lookAt(look);

        // hide player model while spectating to avoid visual obstruction
        if (Engine.player && Engine.player.meshGroup) Engine.player.meshGroup.visible = false;
      } else {
        // exit spectate: snap camera back to player follow if player exists and restore visibility
        if (Engine.player) {
          // restore player model visibility
          if (Engine.player.meshGroup) Engine.player.meshGroup.visible = true;

          // restore camera immediately to player's follow position; Input.processPlayerInput will keep it updated
          const camOffset = new THREE.Vector3(0, 2, -5);
          camOffset.applyAxisAngle(new THREE.Vector3(1, 0, 0), this.mousePitch);
          camOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), Engine.player.pivot.rotation.y);
          Engine.camera.position.copy(Engine.player.pivot.position).add(camOffset);
        }
      }
      return;
    }

    if (!player || player.isDead || player.state === 'stunned' || player.state === 'grabbed' || player.state === 'ult_transforming') return;

    if (k === 'r' && player.ultCharge >= player.maxUltCharge && !player.isUlt && player.state === 'idle') {
      player.ultCharge = 0;
      player.changeState('ult_transforming', 1.5);
      return;
    }

    if (player.stateTimer <= 0 || player.state === 'idle' || player.state === 'blocking') {
      if (player.isUlt) {
        if (k === '1' && player.cds.skill1 <= 0) {
          player.changeState('ult1_dash', 0.5);
          player.velocity.copy(player.getForward().multiplyScalar(40));
          player.cds.skill1 = player.maxCds.skill1;
        }
        if (k === '2' && player.cds.skill2 <= 0) {
          player.runUlt2Sequence();
          player.cds.skill2 = player.maxCds.skill2;
        }
        if (k === '3' && player.cds.skill3 <= 0) {
          player.changeState('ult3_combo', 1.0);
          player.cds.skill3 = player.maxCds.skill3;
        }
        if (k === '4' && player.cds.skill4 <= 0) {
          player.changeState('ult4_dash', 0.5);
          player.velocity.copy(player.getForward().multiplyScalar(50));
          // make ult variant of skill4 take longer to cooldown than the normal value
          const ultExtraCooldown = 4.0; // extra seconds for ult 4
          player.cds.skill4 = player.maxCds.skill4 + ultExtraCooldown;
        }
      } else {
        if (k === '1' && player.cds.skill1 <= 0) {
          player.changeState('skill1_windup', 0.5);
          player.cds.skill1 = player.maxCds.skill1;
        }
        if (k === '2' && player.cds.skill2 <= 0) {
          player.velocity.copy(player.getForward().multiplyScalar(30));
          player.changeState('skill2_dash', 0.3);
          player.cds.skill2 = player.maxCds.skill2;
        }
        if (k === '3' && player.cds.skill3 <= 0) {
          player.changeState('skill3_upper', 0.4);
          player.cds.skill3 = player.maxCds.skill3;
          player.velocity.y = 15;
          setTimeout(() => {
            if (player && player.state === 'skill3_upper') {
              let hits = player.performMeleeHit(15, 0, 3.5, Math.PI);
              hits.forEach(c => { c.velocity.y = 20; c.changeState('stunned', 1.0); });
            }
          }, 150);
        }
        if (k === '4' && player.cds.skill4 <= 0) {
          player.changeState('skill4_combo', 0.7);
          player.cds.skill4 = player.maxCds.skill4;
          let comboTicks = 0;
          let cInt = setInterval(() => {
            if (!player || player.isDead || player.state !== 'skill4_combo' || comboTicks >= 3) { clearInterval(cInt); return; }
            player.performMeleeHit(5, 3); comboTicks++;
          }, 200);
        }
      }
    }
  },

  _onKeyUp(e) {
    const k = e.key.toLowerCase();
    if (this.keys.hasOwnProperty(k)) this.keys[k] = false;
  },

  _onMouseDown(e) {
    if (!Engine.isLocked) return;
    const player = Engine.player;
    if (e.button === 0 && player && !player.isDead && player.state === 'idle' && player.cds.punch <= 0) {
      player.changeState('punching', 0.3);
      player.cds.punch = player.maxCds.punch;
      Engine.sounds && Engine.sounds.play('Punch');
      setTimeout(() => {
        if (player && player.state === 'punching') {
          player.performMeleeHit(player.isUlt ? 10 : 5, player.isUlt ? 10 : 5, 2.5);
        }
      }, 150);
    }
  },

  _onMouseMove(e) {
    if (Engine.isLocked) {
      this.mouseMovement.x += e.movementX;
      this.mouseMovement.y += e.movementY;
    }
  },

  processPlayerInput(dt) {
    const player = Engine.player;
    // Spectate mode: free-flying first-person camera controlled by mouse + WASD
    if (Engine.spectating) {
      // apply mouse movement to spectate orientation
      this.mousePitch += this.mouseMovement.y * 0.002;
      this.mousePitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.mousePitch));
      this._spectateState.yaw -= this.mouseMovement.x * 0.002;
      this.mouseMovement = { x: 0, y: 0 };

      const st = this._spectateState;
      if (!st.pos) st.pos = new THREE.Vector3().copy(Engine.camera.position);
      if (!st.vel) st.vel = new THREE.Vector3();

      // If Auto Watch is enabled and there's no manual movement input, smoothly track nearest NPC
      const autoWatchEl = document.getElementById('auto-watch-spectate');
      const autoWatch = !!(autoWatchEl && autoWatchEl.checked);

      // compute local forward/right vectors from yaw/pitch (first-person style)
      const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0,1,0), st.yaw);
      const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0,1,0)).normalize();

      let userMoving = this.keys.w || this.keys.a || this.keys.s || this.keys.d || this.keys.shift;
      if (autoWatch && !userMoving) {
        // Find closest visible NPC target
        let best = null;
        let bestDist = Infinity;
        for (const c of Engine.characters) {
          if (c.isPlayer || c.isDead) continue;
          const d = st.pos.distanceTo(c.pivot.position);
          if (d < bestDist) { bestDist = d; best = c; }
        }

        if (best) {
          // target position to look at: focus slightly above NPC center
          const targetPos = best.pivot.position.clone().add(new THREE.Vector3(0, 1.6, 0));

          // Raycast to check obstructions and nudge camera offset if blocked
          const raycaster = new THREE.Raycaster();
          const dirToTarget = targetPos.clone().sub(st.pos).normalize();
          raycaster.set(st.pos, dirToTarget);
          const obstacles = (Engine.mapGroup) ? Engine.mapGroup.children : [];
          const intersects = raycaster.intersectObjects(obstacles, true);

          let desiredPos = st.pos.clone();
          // If obstruction is close (within distance to target), attempt to step up or slide sideways
          if (intersects.length > 0 && intersects[0].distance < st.pos.distanceTo(targetPos) - 1.0) {
            // push camera upward and slightly to the side to avoid obstruction
            desiredPos.add(new THREE.Vector3(0, 2.0, 0));
            // slide sideways perpendicular to direction
            const side = new THREE.Vector3().crossVectors(dirToTarget, new THREE.Vector3(0,1,0)).normalize();
            desiredPos.add(side.multiplyScalar(2.0));
          } else {
            // otherwise smoothly move closer to a vantage point behind/above current pos toward the target
            // prefer to keep some offset distance so camera doesn't intersect the NPC
            // prefer a farther vantage point: increase multiplier and widen min/max clamps
            const idealDistance = Math.min(14, Math.max(6, bestDist * 0.9));
            desiredPos = targetPos.clone().sub(dirToTarget.multiplyScalar(idealDistance));
            // keep camera at least 1.5 units above ground
            if (desiredPos.y < 1.5) desiredPos.y = 1.5;
          }

          // Smoothly interpolate spectate position and velocity
          const desiredVel = desiredPos.clone().sub(st.pos).multiplyScalar(4);
          st.vel.lerp(desiredVel, Math.min(1, 10 * (1/60)));
          st.pos.add(st.vel.clone().multiplyScalar(1/60));

          // Smoothly orient camera to look at the target
          const desiredLook = targetPos.clone().sub(st.pos).normalize();
          // derive desired pitch/yaw from desiredLook
          const desiredYaw = Math.atan2(desiredLook.x, desiredLook.z);
          const desiredPitch = Math.asin(Math.max(-1, Math.min(1, desiredLook.y)));

          // smooth yaw using the shortest angular path (avoid wrap-around spins)
          let yawDiff = desiredYaw - st.yaw;
          while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
          while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
          st.yaw += yawDiff * Math.min(1, 4 * (1/60));

          // Flip vertical (up/down) when auto-watch spectate is active by inverting the desired pitch
          // then smoothly blend into the current mousePitch so controls feel consistent.
          this.mousePitch = THREE.MathUtils.lerp(this.mousePitch, -desiredPitch, Math.min(1, 4 * (1/60)));
        } else {
          // fallback idle drifting when no NPCs exist: slight orbiting
          const drift = new THREE.Vector3(Math.cos(Engine.time * 0.2) * 0.2, Math.sin(Engine.time * 0.15) * 0.05, 0);
          st.pos.add(drift);
        }
      } else {
        // vertical look doesn't affect movement direction on Y axis for simpler flight control
        let moveDir = new THREE.Vector3();
        if (this.keys.w) moveDir.add(forward);
        if (this.keys.s) moveDir.sub(forward);
        if (this.keys.a) moveDir.sub(right);
        if (this.keys.d) moveDir.add(right);
        const speed = st.speed * (this.keys.shift ? st.sprintMult : 1);
        if (moveDir.lengthSq() > 0) {
          moveDir.normalize();
          const desired = moveDir.multiplyScalar(speed);
          st.vel.lerp(desired, Math.min(1, 10 * (1/60)));
        } else {
          st.vel.lerp(new THREE.Vector3(0,0,0), Math.min(1, 8 * (1/60)));
        }
        // vertical movement via Space (up)
        if (this.keys[' ']) { st.vel.y = speed; }
        st.pos.add(st.vel.clone().multiplyScalar(1/60));
      }

      // clamp inside map bounds a bit larger
      const radiusLimit = Engine.mapRadius * 1.2;
      if (st.pos.length() > radiusLimit) {
        st.pos.setLength(radiusLimit);
      }

      // update camera transform: set position and look direction based on yaw/pitch
      Engine.camera.position.copy(st.pos);
      const lookDir = new THREE.Vector3(0, 0, 1);
      // apply pitch then yaw for correct orientation
      lookDir.applyAxisAngle(new THREE.Vector3(1,0,0), this.mousePitch);
      lookDir.applyAxisAngle(new THREE.Vector3(0,1,0), st.yaw);
      Engine.camera.lookAt(st.pos.clone().add(lookDir));

      // consume input and skip normal player processing
      return;
    }

    if (!Engine.isLocked || !player || player.isDead) {
      this.mouseMovement = { x: 0, y: 0 };
      return;
    }

    player.pivot.rotation.y -= this.mouseMovement.x * 0.002;
    // flipped vertical look: invert sign so moving mouse up looks down and vice-versa
    this.mousePitch += this.mouseMovement.y * 0.002;
    this.mousePitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.mousePitch));
    this.mouseMovement = { x: 0, y: 0 };

    const canMove = player.state === 'idle' || player.state === 'blocking' || player.state === 'punching' || player.state === 'skill4_combo' || player.state === 'ult3_combo';

    if (this.keys.e && player.state === 'idle') {
      player.changeState('blocking');
    } else if (!this.keys.e && player.state === 'blocking') {
      player.changeState('idle');
    }

    if (canMove) {
      let speedMultiplier = player.state === 'blocking' ? 0.4 : 1.0;

      const forward = player.getForward();
      const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

      let moveDir = new THREE.Vector3();
      if (this.keys.w) moveDir.add(forward);
      if (this.keys.s) moveDir.sub(forward);
      // flipped left/right: A now moves right, D moves left
      if (this.keys.a) moveDir.sub(right);
      if (this.keys.d) moveDir.add(right);

      const wasMoving = !!this._wasMoving;
      if (moveDir.lengthSq() > 0) {
        moveDir.normalize();

        // start moving sound loop if not already playing
        if (!this._wasMoving) {
          Engine.sounds && Engine.sounds.play('Moving');
        }
        this._wasMoving = true;

        if (this.keys.shift && player.cds.dash <= 0 && player.state !== 'blocking') {
          player.velocity.add(moveDir.multiplyScalar(25));
          player.cds.dash = player.maxCds.dash;
          Engine.sounds && Engine.sounds.play('Dash');
        } else {
          const moveVel = moveDir.multiplyScalar(player.moveSpeed * speedMultiplier);
          player.velocity.x = THREE.MathUtils.lerp(player.velocity.x, moveVel.x, 10 * dt);
          player.velocity.z = THREE.MathUtils.lerp(player.velocity.z, moveVel.z, 10 * dt);
        }
      } else {
        // stopped moving: stop moving loop
        if (this._wasMoving) {
          Engine.sounds && Engine.sounds.stop('Moving');
        }
        this._wasMoving = false;
      }
    }

    const camOffset = new THREE.Vector3(0, 2, -5);
    camOffset.applyAxisAngle(new THREE.Vector3(1, 0, 0), this.mousePitch);
    camOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), player.pivot.rotation.y);

    Engine.camera.position.copy(player.pivot.position).add(camOffset);

    const lookTarget = player.pivot.position.clone();
    lookTarget.y += 1.5;
    Engine.camera.lookAt(lookTarget);
  }
};

export async function spawnEnemy(aiLevel, withUlt = false) {
  const mod = await awaitImportCharacter();
  const Character = mod.Character || mod.default || mod;
  new Character(false, aiLevel, withUlt);
  document.body.requestPointerLock();
}

async function awaitImportCharacter() {
  // Dynamic import to avoid circular module resolution issues at top-level imports
  const mod = await import("./character.js");
  return mod;
}