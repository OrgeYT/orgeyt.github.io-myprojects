import { Engine } from "./engine.js";
const THREE = Engine.THREE;

export class Character {
  constructor(isPlayer = false, aiLevel = 'none', withUlt = false) {
    this.isPlayer = isPlayer;
    this.aiLevel = aiLevel;
    this._queuedUlt = false;
    // timers to manage AI look/scan behavior and prevent ult4 spam
    this.scanTimer = 0;
    this.lastUlt4 = -9999;

    // default stats
    this.maxHp = 350;
    this.hp = this.maxHp;

    this.maxUltCharge = 400;
    this.ultCharge = 0;
    this.isUlt = false;
    this.ultTimer = 0;

    // If this NPC is an "unfair" type, crank up stats to make it extremely strong and fast.
    if (this.aiLevel === 'unfair') {
      this.moveSpeed = 60;           // very fast
      this.maxHp = 5000;             // massive health pool
      this.hp = this.maxHp;
      this.maxUltCharge = 120;       // charges quicker for continuous pressure
      // shorten many cooldowns to allow rapid actions
      this.maxCds = { punch: 0.2, skill1: 1.0, skill2: 2.0, skill3: 1.5, skill4: 2.5, dash: 0.8 };
      // increase damage multipliers via temporary property to be used by attacks (kept simple)
      this.unfairDamageMultiplier = 3.5;
      // make its color distinct and aggressive
      this.originalColor = 0xff4444;
    }

    this.isDead = false;

    this.velocity = new THREE.Vector3(0, 0, 0);
    this.moveSpeed = 12;
    this.gravity = Engine.gravity;
    this.isGrounded = false;

    this.state = 'idle';
    this.stateTimer = 0;

    this.lastHitTime = 0;

    this.ragdollSpin = new THREE.Vector3();

    this.cds = { punch: 0, skill1: 0, skill2: 0, skill3: 0, skill4: 0, dash: 0 };
    this.maxCds = { punch: 0.4, skill1: 3, skill2: 5, skill3: 4, skill4: 6, dash: 2 };

    this.originalColor = 0xffffff;

    this.buildMesh();
    Engine.scene.add(this.pivot);

    if (!this.isPlayer) {
      this.createFloatingUI();
      const spawnAngle = Math.random() * Math.PI * 2;
      const spawnDist = Math.random() * 15;
      this.pivot.position.set(Math.cos(spawnAngle) * spawnDist, 5, Math.sin(spawnAngle) * spawnDist);
    } else {
      this.pivot.position.set(0, 5, 10);
    }

    // If constructed with withUlt=true, immediately enter ult state (bypass charge)
    if (withUlt && !this.isPlayer) {
      // If currently in a protected state, queue the ult to start when idle; otherwise begin transforming.
      const protectedStates = ['stunned', 'grabbed', 'ult_transforming', 'dead'];
      if (!protectedStates.includes(this.state)) {
        this.changeState('ult_transforming', 1.5);
      } else {
        this._queuedUlt = true;
      }
    }

    // register in engine
    Engine.characters.push(this);
    if (this.isPlayer) Engine.player = this;
  }

  buildMesh() {
    this.pivot = new THREE.Group();
    this.meshGroup = new THREE.Group();
    this.pivot.add(this.meshGroup);

    const color = new THREE.Color(Math.random(), Math.random(), Math.random());
    if (this.isPlayer) color.setHex(0x3b82f6);
    this.originalColor = color.getHex();

    const bodyGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
    this.bodyMat = new THREE.MeshLambertMaterial({ color: this.originalColor });
    this.bodyMesh = new THREE.Mesh(bodyGeo, this.bodyMat);
    this.bodyMesh.position.y = 0.6;
    this.bodyMesh.castShadow = true;
    this.meshGroup.add(this.bodyMesh);

    const eyeGeo = new THREE.BoxGeometry(0.2, 0.2, 0.1);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.3, 0.9, 0.65);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.3, 0.9, 0.65);
    this.meshGroup.add(leftEye, rightEye);

    const handGeo = new THREE.SphereGeometry(0.3, 16, 16);
    const handMat = new THREE.MeshLambertMaterial({ color: 0xdddddd });

    this.leftHand = new THREE.Mesh(handGeo, handMat);
    this.leftHand.position.set(-0.8, 0.6, 0.2);
    this.leftHand.castShadow = true;
    this.meshGroup.add(this.leftHand);

    this.rightHand = new THREE.Mesh(handGeo, handMat);
    this.rightHand.position.set(0.8, 0.6, 0.2);
    this.rightHand.castShadow = true;
    this.meshGroup.add(this.rightHand);
  }

  createFloatingUI() {
    this.uiElement = document.createElement('div');
    this.uiElement.className = 'floating-hp';
    // Add an ult bar + timer under the HP bar for NPCs
    this.uiElement.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;font-weight:bold;">
        <div>${this.aiLevel.toUpperCase()}</div>
        <div id="ult-txt-${this.pivot.uuid}" style="color:#fde047; font-size:12px; display:none;">ULT: 50s</div>
      </div>
      <div class="floating-hp-bar" style="margin-top:4px;"><div class="floating-hp-fill" id="fill-${this.pivot.uuid}"></div></div>
      <div style="height:6px; background:#444; border-radius:3px; margin-top:6px; overflow:hidden; border:1px solid #111;">
        <div id="ult-fill-${this.pivot.uuid}" style="width:0%; height:100%; background:linear-gradient(90deg,#f97316,#eab308); box-shadow:0 0 6px rgba(234,179,8,0.6);"></div>
      </div>
    `;
    document.body.appendChild(this.uiElement);
  }

  changeState(newState, duration = 0) {
    // Prevent interruptions while transforming into ult:
    // If currently transforming, ignore attempts to change to any other state
    // except 'dead' (so death still works) or re-entering the same transforming state.
    if (this.state === 'ult_transforming' && newState !== 'ult_transforming' && newState !== 'dead') {
      return;
    }
    this.state = newState;
    this.stateTimer = duration;

    // play transform sound when entering ult transform (for player)
    if (newState === 'ult_transforming' && this.isPlayer) {
      Engine.sounds && Engine.sounds.play('UltTransform');
    }
  }

  addUltCharge(amount) {
    // Players always gain ult from damage; allow aggressive AI types to also charge and transform.
    const canGainUlt = this.isPlayer || this.aiLevel === 'pro' || this.aiLevel === 'pro_own';
    if (!canGainUlt || this.isUlt) return;

    this.ultCharge = Math.min(this.maxUltCharge, this.ultCharge + amount);

    // For player update the UI, for NPCs we don't show player UI but still auto-transform when full.
    if (Engine.ui && this.isPlayer) Engine.ui.updatePlayerUI();

    // If we've reached full charge, either start transform immediately or queue it if currently in a protected state.
    if (this.ultCharge >= this.maxUltCharge) {
      this.ultCharge = 0;
      const protectedStates = ['stunned', 'grabbed', 'ult_transforming', 'dead'];
      if (!protectedStates.includes(this.state)) {
        this.changeState('ult_transforming', 1.5);
      } else {
        // queue the ult so it will trigger when the NPC becomes idle next time
        this._queuedUlt = true;
      }
    }
  }

  takeDamage(amount, attacker = null, knockback = 0) {
    if (this.isDead || this.state === 'dead') return;

    // While actively transforming into ult, ignore incoming damage/knockback so the transform can't be interrupted.
    if (this.state === 'ult_transforming') return;

    if (this.state === 'blocking') {
      amount = Math.floor(amount * 0.2);
      knockback = 0;
    }

    this.hp -= amount;
    this.lastHitTime = Engine.time;

    // Give ult charge to the attacker when they hit someone.
    // Previously only players gained ult; allow Pro and Pro-own AI to gain ult too.
    if (attacker && (attacker.isPlayer || attacker.aiLevel === 'pro' || attacker.aiLevel === 'pro_own')) {
      attacker.addUltCharge(amount);
    }

    this.bodyMat.emissive.setHex(0xff0000);
    setTimeout(() => {
      if (this.bodyMat && !this.isUlt) this.bodyMat.emissive.setHex(0x000000);
      else if (this.bodyMat && this.isUlt) this.bodyMat.emissive.setHex(0x888800);
    }, 150);

    if (amount > 0) {
      if (Engine.ui) Engine.ui.createFloatingText(amount.toString(), this.pivot.position.clone().add(new THREE.Vector3(0, 2, 0)), 0xff0000);
      // play different hit sounds for heavier hits
      if (amount >= 20) {
        Engine.sounds && Engine.sounds.play('HardPunch');
      } else {
        Engine.sounds && Engine.sounds.play('Punch');
      }
    }

    if (knockback > 0 && attacker && this.state !== 'blocking') {
      const dir = this.pivot.position.clone().sub(attacker.pivot.position).normalize();
      dir.y = 0.5;
      this.velocity.copy(dir.multiplyScalar(knockback));
      this.changeState('stunned', 0.5);
    }

    // If lethal but attacker is currently in a finishing 'ult' sequence, defer actual death
    const protectingStates = ['ult1_sequence', 'ult4_cutscene', 'ult3_combo', 'ult2_smash', 'ult2_upper1', 'ult2_upper2'];
    if (this.hp <= 0) {
      this.hp = 0;
      if (attacker && attacker.state && protectingStates.some(s => attacker.state === s || attacker.state.startsWith(s))) {
        // mark as pending death; store killer reference so the killer can finalize the death later
        this.pendingDeath = true;
        this.pendingKiller = attacker;
        // update UI to show zero hp but don't call die() yet
        this.updateUI();
        return;
      } else {
        this.die();
      }
    }
    this.updateUI();
  }

  die() {
    this.isDead = true;
    this.changeState('dead');
    this.bodyMat.color.setHex(0x333333);
    this.bodyMat.emissive.setHex(0x000000);

    this.isUlt = false;
    this.ultCharge = 0;

    this.velocity.y = 8;
    this.velocity.x = (Math.random() - 0.5) * 15;
    this.velocity.z = (Math.random() - 0.5) * 15;
    this.ragdollSpin.set((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);

    if (this.uiElement) this.uiElement.style.display = 'none';

    if (this.grabbedBy) { this.grabbedBy.grabbedEnemy = null; this.grabbedBy = null; }
    if (this.grabbedEnemy) { this.grabbedEnemy.grabbedBy = null; this.grabbedEnemy.changeState('idle'); this.grabbedEnemy = null; }

    setTimeout(() => this.respawn(), 3000);
    if (this.isPlayer && Engine.ui) Engine.ui.updateActionDescriptions();
  }

  respawn() {
    this.isDead = false;
    this.hp = this.maxHp;
    this.changeState('idle');

    if (this.isPlayer) this.bodyMat.color.setHex(0x3b82f6);
    else {
      this.bodyMat.color.setHex(this.originalColor);
      if (this.uiElement) this.uiElement.style.display = 'block';
    }

    this.updateUI();

    const spawnRadius = Engine.mapRadius - 5;
    const angle = Math.random() * Math.PI * 2;
    this.pivot.position.set(Math.cos(angle) * (spawnRadius * Math.random()), 10, Math.sin(angle) * (spawnRadius * Math.random()));

    this.velocity.set(0, 0, 0);
    this.pivot.rotation.set(0, 0, 0);
    this.meshGroup.rotation.set(0, 0, 0);
  }

  updateUI() {
    if (this.isPlayer) {
      if (Engine.ui) Engine.ui.updatePlayerUI();
    } else if (this.uiElement) {
      const fill = document.getElementById(`fill-${this.pivot.uuid}`);
      if (fill) fill.style.width = (this.hp / this.maxHp) * 100 + '%';
    }
  }

  getForward() {
    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyQuaternion(this.pivot.quaternion);
    return forward;
  }

  update(dt) {
    if (this.isDead) {
      this.velocity.y += this.gravity * dt;
      this.pivot.position.add(this.velocity.clone().multiplyScalar(dt));

      if (this.pivot.position.y <= 0.6) {
        this.pivot.position.y = 0.6;
        this.velocity.x -= this.velocity.x * 10 * dt;
        this.velocity.z -= this.velocity.z * 10 * dt;
        if (this.velocity.y < 0) this.velocity.y = -this.velocity.y * 0.4;
        if (Math.abs(this.velocity.y) < 1) this.velocity.y = 0;
        this.ragdollSpin.multiplyScalar(0.9);
      }
      this.meshGroup.rotation.x += this.ragdollSpin.x * dt;
      this.meshGroup.rotation.y += this.ragdollSpin.y * dt;
      this.meshGroup.rotation.z += this.ragdollSpin.z * dt;
      this.leftHand.position.lerp(new THREE.Vector3(-1, -0.5, 0), 5 * dt);
      this.rightHand.position.lerp(new THREE.Vector3(1, -0.5, 0), 5 * dt);
      return;
    }

    // Handle ult countdown for both player and NPCs
    if (this.isUlt) {
      this.ultTimer -= dt;
      if (this.isPlayer) {
        if (Engine.ui) Engine.ui.setUltTimerText(Math.ceil(this.ultTimer));
      } else {
        // update NPC floating ult timer display
        const ultTxt = document.getElementById(`ult-txt-${this.pivot.uuid}`);
        if (ultTxt) {
          ultTxt.style.display = this.ultTimer > 0 ? 'block' : 'none';
          ultTxt.innerText = `ULT: ${Math.ceil(Math.max(0, this.ultTimer))}s`;
        }
      }

      if (this.ultTimer <= 0) {
        this.isUlt = false;
        // revert colors
        if (this.isPlayer) {
          this.bodyMat.color.setHex(0x3b82f6);
          this.bodyMat.emissive.setHex(0x000000);
          if (Engine.ui) Engine.ui.showUltTimer(false);
          if (Engine.ui) Engine.ui.updateActionDescriptions();
          // revert background music to normal when player's ult ends
          if (Engine.sounds) {
            if (Engine.sounds.stopMusic) Engine.sounds.stopMusic();
            if (Engine.sounds.playMusic) Engine.sounds.playMusic('BgmNormal');
          }
        } else {
          this.bodyMat.color.setHex(this.originalColor);
          this.bodyMat.emissive.setHex(0x000000);
          // hide NPC ult timer text
          const ultTxt = document.getElementById(`ult-txt-${this.pivot.uuid}`);
          if (ultTxt) ultTxt.style.display = 'none';
          // reset NPC ult fill bar
          const ultFill = document.getElementById(`ult-fill-${this.pivot.uuid}`);
          if (ultFill) ultFill.style.width = '0%';
        }

        this.changeState('idle');
        this.updateUI();
      }
    }

    if (Engine.time - this.lastHitTime > 5.0 && this.hp < this.maxHp && this.state !== 'dead') {
      this.hp += 5 * dt;
      if (this.hp > this.maxHp) this.hp = this.maxHp;
      this.updateUI();
    }

    for (let key in this.cds) {
      if (this.cds[key] > 0) this.cds[key] -= dt;
    }

    if (this.stateTimer > 0) {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) this.handleStateExpiration();
    }

    this.velocity.y += this.gravity * dt;

    if (this.isGrounded && this.state !== 'skill2_dash' && this.state !== 'ult1_dash' && this.state !== 'ult4_dash') {
      this.velocity.x -= this.velocity.x * 10 * dt;
      this.velocity.z -= this.velocity.z * 10 * dt;
    }

    this.pivot.position.add(this.velocity.clone().multiplyScalar(dt));

    if (this.pivot.position.y <= 0) {
      this.pivot.position.y = 0;
      this.velocity.y = 0;
      this.isGrounded = true;
    } else {
      this.isGrounded = false;
    }

    const distFromCenter = Math.sqrt(this.pivot.position.x ** 2 + this.pivot.position.z ** 2);
    if (distFromCenter > Engine.mapRadius - 1) {
      const norm = new THREE.Vector2(this.pivot.position.x, this.pivot.position.z).normalize();
      this.pivot.position.x = norm.x * (Engine.mapRadius - 1);
      this.pivot.position.z = norm.y * (Engine.mapRadius - 1);
    }

    this.animateHands(dt);
    this.handleSpecialStates(dt);

    if (!this.isPlayer) this.updateFloatingUI();
  }

  handleSpecialStates(dt) {
    if (this.state === 'ult_transforming') {
      this.velocity.set(0, 0, 0);
      this.pivot.position.y = 2 + Math.sin(Engine.time * 10) * 0.5;
      this.meshGroup.rotation.y += 15 * dt;
    } else if (this.state !== 'skill2_spin' && this.state !== 'dead') {
      this.meshGroup.rotation.y = THREE.MathUtils.lerp(this.meshGroup.rotation.y, 0, 10 * dt);
    }

    if (this.state === 'skill2_spin') {
      this.meshGroup.rotation.y -= Math.PI * 8 * dt;
      if (this.grabbedEnemy) {
        const holdPos = this.pivot.position.clone().add(this.getForward().multiplyScalar(1.5));
        holdPos.y += 0.5;
        this.grabbedEnemy.pivot.position.copy(holdPos);
        this.grabbedEnemy.meshGroup.rotation.y = this.meshGroup.rotation.y + Math.PI;
      }
    }

    if (this.state === 'skill2_dash' || this.state === 'ult1_dash' || this.state === 'ult4_dash') {
      this.checkDashCollisions();
    }

    if (this.state === 'ult3_combo') {
      this.meshGroup.rotation.y = Math.sin(Engine.time * 25) * 0.3;
      if (Math.random() < 0.2) {
        this.performMeleeHit(2, 0, 3.0, Math.PI);
      }
    }
  }

  checkDashCollisions() {
    const hits = this.performMeleeHit(0, 0, 2.5);
    if (hits.length > 0 && !this.grabbedEnemy) {
      const target = hits[0];
      if (target.state === 'grabbed') return;

      this.velocity.set(0, 0, 0);
      this.grabbedEnemy = target;
      target.grabbedBy = this;

      if (this.state === 'skill2_dash') {
        target.changeState('grabbed', 1.0);
        this.changeState('skill2_spin', 0.5);
      } else if (this.state === 'ult1_dash') {
        this.changeState('ult1_sequence', 3.0);
        this.runUlt1Sequence(target);
      } else if (this.state === 'ult4_dash') {
        this.changeState('ult4_cutscene', 4.5);
        this.runUlt4Sequence(target);
      }
    }
  }

  handleStateExpiration() {
    const prev = this.state;

    if (prev === 'skill1_windup') {
      this.changeState('skill1_strike', 0.2);
      this.performMeleeHit(20, 20, 2.5);
    } else if (prev === 'skill2_spin') {
      this.changeState('skill2_slam', 0.3);
      if (this.grabbedEnemy) {
        const enemy = this.grabbedEnemy;
        enemy.takeDamage(25, this, 0);
        if (!enemy.isDead) {
          enemy.velocity.y = -15;
          enemy.changeState('stunned', 1.0);
        }
        if (this.grabbedEnemy === enemy) {
          this.grabbedEnemy.grabbedBy = null;
          this.grabbedEnemy = null;
        }
      }
    } else if (prev === 'ult_transforming') {
      this.isUlt = true;
      this.ultTimer = 50;
      this.bodyMat.color.setHex(0xffff00);
      this.bodyMat.emissive.setHex(0xaaaa00);
      if (Engine.ui) { Engine.ui.showUltTimer(true); Engine.ui.updateActionDescriptions(); }
      // start ult music when transformation completes (player only)
      if (this.isPlayer && Engine.sounds) {
        // ensure any normal bg music is halted before starting the ult loop
        if (Engine.sounds.stopMusic) Engine.sounds.stopMusic();
        if (Engine.sounds.playMusic) Engine.sounds.playMusic('BgmUlt');
      }
      // Directly set state to idle here to bypass the 'ult_transforming' guard in changeState,
      // ensuring the transform completes and the player can act normally.
      this.state = 'idle';
      this.stateTimer = 0;
    } else if (prev === 'ult3_combo') {
      this.velocity.y = 10;
      setTimeout(() => {
        if (this.isDead) return;
        this.velocity.y = -30;
        if (Engine.ui) Engine.ui.createFloatingText("SMASH!", this.pivot.position, 0xffff00);
        Engine.characters.forEach(c => {
          if (c !== this && !c.isDead && c.pivot.position.distanceTo(this.pivot.position) < 6.0) {
            c.takeDamage(30, this, 0);
            c.velocity.y = -20;
            c.changeState('stunned', 1.5);
          }
        });
      }, 200);
      this.changeState('idle');
    } else {
      this.changeState('idle');
      // If an ult was queued because the NPC filled their meter while in a protected/interruptible state,
      // trigger the transforming sequence now (unless already ulted).
      if (this._queuedUlt && !this.isUlt && this.state === 'idle') {
        this._queuedUlt = false;
        this.changeState('ult_transforming', 1.5);
      }
    }
  }

  performMeleeHit(damage, knockback, range = 2.0, arc = Math.PI / 2) {
    const forward = this.getForward();
    let hitChars = [];

    for (let char of Engine.characters) {
      if (char === this || char.isDead) continue;

      const dist = this.pivot.position.distanceTo(char.pivot.position);
      if (dist < range) {
        const dirToTarget = char.pivot.position.clone().sub(this.pivot.position).normalize();
        const angle = forward.angleTo(dirToTarget);

        if (angle < arc) {
          if (damage > 0 || knockback > 0) char.takeDamage(damage, this, knockback);
          hitChars.push(char);
        }
      }
    }
    return hitChars;
  }

  animateHands(dt) {
    let targetLH = new THREE.Vector3(-0.8, 0.6, 0.2);
    let targetRH = new THREE.Vector3(0.8, 0.6, 0.2);
    let lerpSpeed = 15 * dt;

    const t = Engine.time * 10;

    if (this.state === 'punching') {
      targetRH.z = 1.2; targetRH.x = 0.4;
    } else if (this.state === 'blocking') {
      targetLH.set(-0.4, 0.8, 0.8);
      targetRH.set(0.4, 0.8, 0.8);
    } else if (this.state === 'skill1_windup') {
      targetRH.set(1.0, 1.0, -0.5);
    } else if (this.state === 'skill1_strike') {
      targetRH.set(0.2, 0.6, 2.0);
    } else if (this.state === 'skill2_dash' || this.state === 'ult1_dash' || this.state === 'ult4_dash') {
      targetLH.set(-1.0, 0.8, 1.0);
      targetRH.set(1.0, 0.8, 1.0);
    } else if (this.state === 'skill2_slam') {
      targetLH.set(-0.5, -0.5, 1.5);
      targetRH.set(0.5, -0.5, 1.5);
    } else if (this.state === 'skill3_upper' || (this.state && this.state.startsWith && this.state.startsWith('ult2_upper'))) {
      targetRH.set(0, 1.5, 1.0);
    } else if (this.state === 'skill4_combo' || this.state === 'ult3_combo') {
      targetLH.z = 0.2 + Math.sin(t) * 0.8;
      targetRH.z = 0.2 + Math.sin(t + Math.PI) * 0.8;
    } else if (this.state === 'stunned' || this.state === 'grabbed') {
      targetLH.set(-1.2, 1.2, -0.2);
      targetRH.set(1.2, 1.2, -0.2);
    } else if (this.velocity.lengthSq() > 1 && this.isGrounded) {
      targetLH.z = 0.2 + Math.sin(t) * 0.5;
      targetRH.z = 0.2 + Math.sin(t + Math.PI) * 0.5;
    }

    this.leftHand.position.lerp(targetLH, lerpSpeed);
    this.rightHand.position.lerp(targetRH, lerpSpeed);
  }

  runUlt1Sequence(target) {
    target.changeState('grabbed', 3.0);

    setTimeout(() => {
      if (this.isDead || target.isDead || this.state !== 'ult1_sequence') return;
      target.pivot.position.copy(this.pivot.position.clone().add(this.getForward().multiplyScalar(1.5)));
      target.pivot.position.y = 0.6;
      target.takeDamage(10, this, 0);
      if (Engine.ui) Engine.ui.createFloatingText("SLAM!", target.pivot.position, 0xffff00);
      Engine.sounds && Engine.sounds.play('Slam');
    }, 100);

    let comboCount = 0;
    let comboInt = setInterval(() => {
      if (this.isDead || target.isDead || this.state !== 'ult1_sequence') { clearInterval(comboInt); return; }
      comboCount++;
      target.takeDamage(5, this, 0);
      target.pivot.position.y = 0.6 + comboCount * 0.3;

      if (comboCount >= 6) {
        clearInterval(comboInt);
        setTimeout(() => {
          if (this.isDead || target.isDead) return;
          target.takeDamage(25, this, 0);
          target.velocity.y = 35;
          target.changeState('stunned', 2.0);
          if (Engine.ui) Engine.ui.createFloatingText("AWESOME KICK!", target.pivot.position, 0xff0000);

          // finalize pending death if this ult was holding off the kill
          if (target.pendingDeath && target.pendingKiller === this) {
            target.pendingDeath = false;
            target.pendingKiller = null;
            target.die();
          }

          this.changeState('idle');
          target.grabbedBy = null;
          this.grabbedEnemy = null;
        }, 200);
      }
    }, 150);
  }

  runUlt2Sequence() {
    this.changeState('ult2_upper1', 0.4);
    this.velocity.y = 12;

    setTimeout(() => {
      if (this.isDead || this.state !== 'ult2_upper1') return;
      let hits = this.performMeleeHit(15, 0, 3.5, Math.PI);

      if (hits.length > 0) {
        hits.forEach(h => { h.velocity.y = 18; h.changeState('stunned', 2.5); });

        setTimeout(() => {
          if (this.isDead) return;
          this.velocity.y = 15;
          this.changeState('ult2_upper2', 0.4);
          hits.forEach(h => { if (!h.isDead) { h.velocity.y = 18; h.takeDamage(15, this, 0); } });

          setTimeout(() => {
            if (this.isDead) return;
            this.velocity.y = 10;
            this.changeState('ult2_smash', 0.4);
            if (Engine.ui) Engine.ui.createFloatingText("ULTRA SMASH!", this.pivot.position, 0xffff00);
            hits.forEach(h => {
              if (!h.isDead) {
                h.velocity.y = -45;
                h.takeDamage(20, this, 0);
                // if this hit was lethal but deferred, finalize here for this attacker
                if (h.pendingDeath && h.pendingKiller === this) {
                  h.pendingDeath = false;
                  h.pendingKiller = null;
                  h.die();
                }
              }
            });
          }, 400);
        }, 400);
      }
    }, 100);
  }

  runUlt4Sequence(target) {
    target.changeState('grabbed', 4.5);

    const clones = [];
    const cloneGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
    const cloneMat = new THREE.MeshLambertMaterial({ color: 0xffff00, emissive: 0x555500 });

    for (let i = 0; i < 4; i++) {
      const mesh = new THREE.Mesh(cloneGeo, cloneMat);
      Engine.scene.add(mesh);
      clones.push(mesh);
    }

    let ticks = 0;
    let cloneInt = setInterval(() => {
      if (this.isDead || target.isDead || this.state !== 'ult4_cutscene') {
        clearInterval(cloneInt);
        clones.forEach(c => Engine.scene.remove(c));
        if (this.grabbedEnemy) { this.grabbedEnemy.grabbedBy = null; this.grabbedEnemy = null; }
        if (this.state === 'ult4_cutscene') this.changeState('idle');
        return;
      }
      ticks++;

      clones.forEach((c, i) => {
        const angle = (Math.PI * 2 / 4) * i + ticks * 0.5;
        const r = (ticks % 2 === 0) ? 1.0 : 4.0;
        c.position.set(
          target.pivot.position.x + Math.cos(angle) * r,
          target.pivot.position.y + (Math.random() - 0.5),
          target.pivot.position.z + Math.sin(angle) * r
        );
        if (ticks % 2 === 0) {
          target.takeDamage(2, this, 0);
          if (Engine.ui) Engine.ui.createFloatingText("BAM!", c.position, 0xffff00);
        }
      });

      if (ticks > 15) {
        clearInterval(cloneInt);
        clones.forEach(c => Engine.scene.remove(c));

        // For AI we can reposition/lookAt for dramatic effect; for the player, avoid changing player pivot rotation
        if (!this.isPlayer) {
          this.pivot.position.copy(target.pivot.position.clone().add(new THREE.Vector3(2, 0, 2)));
          this.pivot.lookAt(target.pivot.position);
        }
        // scale the hand for the effect regardless, but don't alter player rotation
        this.rightHand.scale.set(4, 4, 4);

        setTimeout(() => {
          if (this.isDead || target.isDead) { this.rightHand.scale.set(1, 1, 1); return; }
          this.rightHand.scale.set(1, 1, 1);

          if (Engine.ui) Engine.ui.createFloatingText("OBLITERATED!", target.pivot.position, 0xff0000);
          target.hp = 0;
          target.takeDamage(999, this, 50);
          target.velocity.y = 25;

          // finalize pending death after the cutscene completes
          if (target.pendingDeath && target.pendingKiller === this) {
            target.pendingDeath = false;
            target.pendingKiller = null;
            target.die();
          }

          this.changeState('idle');
          target.grabbedBy = null;
          this.grabbedEnemy = null;
        }, 500);
      }
    }, 200);
  }

  updateFloatingUI() {
    if (this.uiElement && !this.isDead) {
      const vector = this.pivot.position.clone();
      vector.y += 2;
      vector.project(Engine.camera);

      const x = (vector.x * .5 + .5) * window.innerWidth;
      const y = (vector.y * -.5 + .5) * window.innerHeight;

      if (vector.z < 1) {
        this.uiElement.style.display = 'block';
        this.uiElement.style.left = `${x}px`;
        this.uiElement.style.top = `${y}px`;

        // update HP fill (already handled in updateUI but ensure sync)
        const fill = document.getElementById(`fill-${this.pivot.uuid}`);
        if (fill) fill.style.width = (this.hp / this.maxHp) * 100 + '%';

        // update ult fill bar and timer for NPCs
        const ultFill = document.getElementById(`ult-fill-${this.pivot.uuid}`);
        const ultTxt = document.getElementById(`ult-txt-${this.pivot.uuid}`);
        if (ultFill) {
          if (this.isUlt) {
            // when in ult, show full bar and then act as a countdown indicator (filled)
            ultFill.style.width = '100%';
          } else {
            // when not ult, show charge fraction
            const frac = Math.min(1, this.ultCharge / this.maxUltCharge);
            ultFill.style.width = `${frac * 100}%`;
          }
        }
        if (ultTxt) {
          if (this.isUlt) {
            ultTxt.style.display = 'block';
            ultTxt.innerText = `ULT: ${Math.ceil(Math.max(0, this.ultTimer))}s`;
          } else {
            // hide timer when not in ult, but keep it ready for when filling
            ultTxt.style.display = this.ultCharge >= this.maxUltCharge ? 'block' : 'none';
            if (this.ultCharge >= this.maxUltCharge) ultTxt.innerText = `READY`;
          }
        }
      } else {
        this.uiElement.style.display = 'none';
      }
    }
  }

  updateAI(dt) {
    if (this.isDead || this.aiLevel === 'none' || this.state === 'stunned' || this.state === 'grabbed') return;
    if (this.stateTimer > 0) return;

    // Determine whether this NPC should behave like "pro" (fast/aggressive).
    // Also treat 'unfair' as ultra-pro behavior for aggression and decision frequency.
    const isProBehavior = (this.aiLevel === 'pro' || this.aiLevel === 'pro_own' || this.aiLevel === 'unfair');

    // Select the closest valid target by scanning all characters.
    // Valid targets:
    //  - pro_own: other alive characters with the same aiLevel (friendly-only combat)
    //  - others: any alive character that isn't the same aiLevel (players included)
    let target = null;
    let best = null;
    let bestDist = Infinity;
    for (const c of Engine.characters) {
      if (c === this || c.isDead) continue;
      // determine validity
      let valid = false;
      // spectating flag only reflects an explicit spectator; treat "no active player" separately
      const spectating = Engine.spectating;
      const noActivePlayer = (!Engine.player || Engine.player.isDead);

      if (this.aiLevel === 'pro_own') {
        // only target same kind
        valid = c.aiLevel === this.aiLevel;
      } else {
        // Normally target anyone who is not the same aiLevel (players included).
        if (!spectating && !noActivePlayer) {
          // regular gameplay with an active player: target different kinds or the player
          valid = (c.aiLevel !== this.aiLevel) || c.isPlayer;
        } else if (spectating) {
          // when someone is spectating, ignore player entities and target other NPC types that differ
          valid = !c.isPlayer && (c.aiLevel !== this.aiLevel);
        } else if (noActivePlayer) {
          // when there is no player at all, allow NPCs to target other NPCs including their own kind
          valid = !c.isPlayer;
        }
      }
      if (!valid) continue;
      const d = this.pivot.position.distanceTo(c.pivot.position);
      if (d < bestDist) { bestDist = d; best = c; }
    }
    target = best;

    // If no suitable target found, either idle (non-ult) or perform scanning/lookaround if in ult
    if (!target) {
      if (this.isUlt) {
        this.scanTimer -= dt;
        if (this.scanTimer <= 0) {
          this.scanTimer = 1.0 + Math.random() * 2.0;
          const yawDelta = (Math.random() - 0.5) * Math.PI * 0.6;
          this.pivot.rotation.y += yawDelta;
        } else {
          this.pivot.rotation.y += dt * 0.6;
        }
      } else {
        // no valid targets and not ult: stop moving and do nothing
        this.velocity.x = 0; this.velocity.z = 0;
        return;
      }
    }

    const dist = target ? this.pivot.position.distanceTo(target.pivot.position) : Infinity;
    // prepare a direction vector accessible later (defaults to zero)
    let dir = new THREE.Vector3();

    // If we have a concrete target, compute a direction and smoothly turn toward them;
    // otherwise scanning above already adjusts rotation.
    if (target) {
      dir = target.pivot.position.clone().sub(this.pivot.position).normalize();
      const targetRotation = Math.atan2(dir.x, dir.z);

      let rotDiff = targetRotation - this.pivot.rotation.y;
      while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
      while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
      this.pivot.rotation.y += rotDiff * 5 * dt;
    }

    const aggroRange = 15;
    const attackRange = 2.5;

    if (dist < aggroRange) {
      if (dist > attackRange) {
        this.velocity.x = dir.x * this.moveSpeed * (isProBehavior ? 0.8 : 0.5);
        this.velocity.z = dir.z * this.moveSpeed * (isProBehavior ? 0.8 : 0.5);
      } else {
        this.velocity.x = 0; this.velocity.z = 0;

        // increase action frequency for pro-like behavior and when in ult
        const actionChance = this.isUlt ? (isProBehavior ? 0.18 : 0.12) : (isProBehavior ? 0.05 : 0.02);
        if (Math.random() < actionChance) {
          // If NPC is in ult form, prefer ult moveset
          if (this.isUlt) {
            const ultMoves = [];
            if (this.cds.skill1 <= 0) ultMoves.push('ult1');
            if (this.cds.skill2 <= 0) ultMoves.push('ult2');
            if (this.cds.skill3 <= 0) ultMoves.push('ult3');
            if (this.cds.skill4 <= 0) ultMoves.push('ult4');

            if (ultMoves.length > 0) {
              const move = ultMoves[Math.floor(Math.random() * ultMoves.length)];
              if (move === 'ult1') {
                // dash/grab sequence leading into ult1_sequence
                this.changeState('ult1_dash', 0.5);
                // Unfair NPCs move *far* faster on dashes
                const dashSpeed = (this.aiLevel === 'unfair') ? 90 : 30;
                this.velocity.copy(this.getForward().multiplyScalar(dashSpeed));
                this.cds.skill1 = this.maxCds.skill1;
              } else if (move === 'ult2') {
                this.cds.skill2 = this.maxCds.skill2;
                this.runUlt2Sequence();
              } else if (move === 'ult3') {
                this.changeState('ult3_combo', 1.0);
                this.cds.skill3 = this.maxCds.skill3;
              } else if (move === 'ult4') {
                const minUlt4Gap = (this.aiLevel === 'unfair') ? 3.0 : 8.0;
                if (Engine.time - (this.lastUlt4 || -9999) >= minUlt4Gap) {
                  this.changeState('ult4_dash', 0.5);
                  const ult4Speed = (this.aiLevel === 'unfair') ? 140 : 45;
                  this.velocity.copy(this.getForward().multiplyScalar(ult4Speed));
                  const ultExtraCooldown = (this.aiLevel === 'unfair') ? 2.0 : 4.0;
                  this.cds.skill4 = this.maxCds.skill4 + ultExtraCooldown;
                  this.lastUlt4 = Engine.time;
                } else {
                  if (this.cds.skill1 <= 0) {
                    this.changeState('ult1_dash', 0.5);
                    this.velocity.copy(this.getForward().multiplyScalar((this.aiLevel === 'unfair') ? 90 : 30));
                    this.cds.skill1 = this.maxCds.skill1;
                  } else {
                    this.changeState('punching', 0.3);
                    this.cds.punch = this.maxCds.punch;
                    setTimeout(() => this.performMeleeHit(8 * (this.unfairDamageMultiplier || 1), 8), 150);
                  }
                }
              }
            } else {
              // no ult moves ready: fallback to simple punch to keep pressure
              this.changeState('punching', 0.3); this.cds.punch = this.maxCds.punch;
              setTimeout(() => this.performMeleeHit(8 * (this.unfairDamageMultiplier || 1), 8), 150);
            }
          } else {
            // Normal (non-ult) moves
            let moves = ['punch'];
            if (this.cds.skill1 <= 0) moves.push('skill1');
            if (this.cds.skill3 <= 0 && isProBehavior) moves.push('skill3');
            if (this.cds.skill4 <= 0) moves.push('skill4');

            if (moves.length > 0) {
              const move = moves[Math.floor(Math.random() * moves.length)];
              if (move === 'punch') {
                this.changeState('punching', 0.3); this.cds.punch = this.maxCds.punch;
                setTimeout(() => this.performMeleeHit(5, 5), 150);
              } else if (move === 'skill1') {
                this.changeState('skill1_windup', 0.5); this.cds.skill1 = this.maxCds.skill1;
              } else if (move === 'skill3') {
                this.changeState('skill3_upper', 0.4); this.cds.skill3 = this.maxCds.skill3;
                this.velocity.y = 15;
                setTimeout(() => {
                  if (this.state === 'skill3_upper') {
                    let hits = this.performMeleeHit(15, 0, 3.5, Math.PI);
                    hits.forEach(c => { c.velocity.y = 20; c.changeState('stunned', 1.0); });
                  }
                }, 150);
              } else if (move === 'skill4') {
                this.changeState('skill4_combo', 0.7); this.cds.skill4 = this.maxCds.skill4;
                let comboTicks = 0;
                let cInt = setInterval(() => {
                  if (this.isDead || this.state !== 'skill4_combo' || comboTicks >= 3) { clearInterval(cInt); return; }
                  this.performMeleeHit(4, 2); comboTicks++;
                }, 200);
              }
            }
          }
        }
      }
    } else {
      this.velocity.x = 0; this.velocity.z = 0;
    }
  }
}