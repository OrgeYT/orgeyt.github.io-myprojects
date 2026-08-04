import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { state } from './state.js';
import { R6_MODEL_DATA, GRAVITY, JUMP_FORCE, MOVE_SPEED } from './constants.js';
import { buildHat, createFaceTexture } from './map.js';
import { playSound } from './audio.js';

export class Character {
  constructor(isPlayer, id, name, bodyColorHex, hatType, hatColorHex, headArmColorHex = '#ffab66', legColorHex = '#000000', eyeColorHex = '#000000') {
    this.id = id;
    this.isPlayer = isPlayer;
    this.name = name;
    this.color = new THREE.Color(bodyColorHex);
    this.headArmColor = new THREE.Color(headArmColorHex);
    this.legColor = new THREE.Color(legColorHex);
    this.hatType = hatType;
    this.hatColorHex = hatColorHex;
    this.eyeColor = new THREE.Color(eyeColorHex);

    [this.color, this.headArmColor, this.legColor].forEach(c => {
      const h = {};
      c.getHSL(h);
      c.setHSL(h.h, Math.min(1, h.s * 1.4), h.l);
    });

    const spawnRange = (state.MAP_SIZE / 2) - 5;
    this.position = new THREE.Vector3((Math.random()-0.5)*spawnRange*2, 10, (Math.random()-0.5)*spawnRange*2);

    this.velocity = new THREE.Vector3(0,0,0);
    this.isOnGround = false;
    this.isDead = false;
    this.jumps = 0;

    this.cannotPassTo = null;
    this.cannotPassTimer = 0;
    this.handedness = Math.random() > 0.5 ? 'left' : 'right';

    this.baseScale = 1.5;
    this.animOffset = Math.random() * Math.PI * 2;

    this.targetPos = new THREE.Vector3();
    this.stuckTimer = 0;
    this.lastPos = this.position.clone();

    this.buildMesh();
  }

  buildMesh() {
    this.mesh = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: this.color, roughness: 0.4 });

    const eyeGeo = new THREE.SphereGeometry(0.3, 16, 16);
    eyeGeo.scale(1, 2, 0.4);
    const eyeMat = new THREE.MeshBasicMaterial({ color: this.eyeColor });
    this.leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    this.rightEye = new THREE.Mesh(eyeGeo, eyeMat);

    if (state.isRobloxMode) {
      this.robloxGroup = new THREE.Group();
      this.robloxGroup.scale.setScalar(0.75); // Scaled up
      this.robloxGroup.position.y = 0; // Adjusted grounding offset
      this.limbs = {};

      const yOffset = -0.07;

      for (const key in R6_MODEL_DATA) {
        const part = R6_MODEL_DATA[key];
        let matColor;
        if (part.type === 'torso') matColor = this.color;
        else if (part.type === 'head' || part.type === 'arm') matColor = this.headArmColor;
        else if (part.type === 'leg') matColor = this.legColor;
        else matColor = new THREE.Color(part.color);

        const mat = new THREE.MeshStandardMaterial({ color: matColor, roughness: 0.4 });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
        mesh.scale.set(part.sx, part.sy, part.sz);

        const pivotGroup = new THREE.Group();
        pivotGroup.position.set(part.px, part.py + yOffset, part.pz);

        if (part.type === 'arm') {
          mesh.position.y = -part.sy / 2 + 0.2;
          pivotGroup.position.y += part.sy / 2 - 0.2;
          this.limbs[key] = pivotGroup;
        } else if (part.type === 'leg') {
          mesh.position.y = -part.sy / 2;
          pivotGroup.position.y += part.sy / 2;
          this.limbs[key] = pivotGroup;
        } else if (part.type === 'head') {
          this.headMesh = pivotGroup;
          // Attach a recolorable face to the front of the head.
          const faceTex = createFaceTexture(this.eyeColor.getStyle());
          const faceMat = new THREE.MeshBasicMaterial({ map: faceTex, transparent: true });
          const faceMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.72), faceMat);
          faceMesh.position.set(0, 0.1, 0.52);
          faceMesh.renderOrder = 2;
          pivotGroup.add(faceMesh);
        }

        mesh.castShadow = true;
        mesh.receiveShadow = true;
        pivotGroup.add(mesh);
        this.robloxGroup.add(pivotGroup);
      }

      // Attach hands (for bomb passing)
      this.leftHand = new THREE.Group();
      this.leftHand.position.y = -0.8;
      this.limbs['l_arm'].add(this.leftHand);

      this.rightHand = new THREE.Group();
      this.rightHand.position.y = -0.8;
      this.limbs['r_arm'].add(this.rightHand);

      const myHat = buildHat(this.hatType, this.hatColorHex);
      if (myHat) {
        myHat.position.y = 0.55;
        this.headMesh.add(myHat);
      }

      this.mesh.add(this.robloxGroup);
    } else {
      this.bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), bodyMat);
      this.bodyMesh.position.y = 1;

      this.leftEye.position.set(-0.4, 1.2, 1.05);
      this.rightEye.position.set(0.4, 1.2, 1.05);
      this.mesh.add(this.leftEye, this.rightEye);

      const handGeo = new THREE.SphereGeometry(0.4, 16, 16);
      this.leftHand = new THREE.Mesh(handGeo, bodyMat);
      this.leftHand.position.set(-1.5, 1, 0);
      this.rightHand = new THREE.Mesh(handGeo, bodyMat);
      this.rightHand.position.set(1.5, 1, 0);
      this.mesh.add(this.leftHand, this.rightHand);

      const myHat = buildHat(this.hatType, this.hatColorHex);
      if (myHat) {
        myHat.position.y = 1;
        this.bodyMesh.add(myHat);
      }

      this.mesh.add(this.bodyMesh);
    }

    this.mesh.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    this.mesh.position.copy(this.position);
    state.scene.add(this.mesh);

    this.nametag = document.createElement('div');
    this.nametag.className = 'nametag';
    this.nametag.innerText = this.name;
    document.getElementById('nametags-container').appendChild(this.nametag);
  }

  update(dt, time, isIntro = false) {
    if(this.isDead) return;

    if (state.isRobloxMode && this.limbs) {
      if (!this.isOnGround) {
        this.limbs['l_arm'].rotation.x = Math.PI;
        this.limbs['r_arm'].rotation.x = Math.PI;
        this.limbs['l_leg'].rotation.x = 0;
        this.limbs['r_leg'].rotation.x = 0;
      } else if (Math.abs(this.velocity.x) > 1 || Math.abs(this.velocity.z) > 1) {
        const walkCycle = Math.sin(time * 15);
        this.limbs['l_arm'].rotation.x = walkCycle * 0.8;
        this.limbs['r_arm'].rotation.x = -walkCycle * 0.8;
        this.limbs['l_leg'].rotation.x = -walkCycle * 0.8;
        this.limbs['r_leg'].rotation.x = walkCycle * 0.8;
      } else {
        this.limbs['l_arm'].rotation.x = 0;
        this.limbs['r_arm'].rotation.x = 0;
        this.limbs['l_leg'].rotation.x = 0;
        this.limbs['r_leg'].rotation.x = 0;
      }
    } else {
      const speed = Math.hypot(this.velocity.x, this.velocity.z);
      const swing = this.isOnGround && speed > 1 ? 1 : 0.25;
      this.leftHand.position.y = 1 + Math.sin(time * 7 + this.animOffset) * (0.2 + 0.25 * swing);
      this.rightHand.position.y = 1 + Math.sin(time * 7 + this.animOffset + Math.PI) * (0.2 + 0.25 * swing);
      this.leftHand.position.z = Math.sin(time * 7 + this.animOffset) * 0.12 * swing;
      this.rightHand.position.z = Math.sin(time * 7 + this.animOffset + Math.PI) * 0.12 * swing;
      this.animateFace(time);
    }

    if(this.cannotPassTimer > 0) this.cannotPassTimer -= dt;

    let wasOnGround = this.isOnGround;

    this.prevY = this.position.y;
    this.velocity.y += GRAVITY * dt;

    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;

    const limit = state.MAP_SIZE/2 - 1;
    if(this.position.x < -limit) this.position.x = -limit;
    if(this.position.x > limit) this.position.x = limit;
    if(this.position.z < -limit) this.position.z = -limit;
    if(this.position.z > limit) this.position.z = limit;

    this.resolveCharacterCollisionXZ();

    this.position.y += this.velocity.y * dt;
    this.isOnGround = false;

    this.resolveWallCollisions();

    if (this.position.y <= 0) {
      if(this.velocity.y < -5) playSound('land');
      this.position.y = 0;
      this.velocity.y = 0;
      this.isOnGround = true;
    }

    const myBox = new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(this.position.x, this.position.y + 1 * this.baseScale, this.position.z),
      new THREE.Vector3(2 * this.baseScale, 2 * this.baseScale, 2 * this.baseScale)
    );

    for(let p of state.platforms) {
      if(myBox.intersectsBox(p.box)) {
        if (this.prevY >= p.topY - 0.05 && this.velocity.y <= 0) {
          if(this.velocity.y < -5) playSound('land');
          this.position.y = p.topY;
          this.velocity.y = 0;
          this.isOnGround = true;
        } else {
          // Physics Edge Climbing
          const toCenter = new THREE.Vector2(p.mesh.position.x - this.position.x, p.mesh.position.z - this.position.z);
          const vel2D = new THREE.Vector2(this.velocity.x, this.velocity.z);
          if (vel2D.lengthSq() > 0.1 && toCenter.dot(vel2D) > 0) {
            this.velocity.y = 12; // Snap/Climb upwards
            this.isOnGround = false;
          }
        }
      }
    }

    this.resolveCharacterCollisionY();

    if (this.isOnGround) {
      this.jumps = 0;
    }

    this.mesh.scale.setScalar(this.baseScale);

    this.velocity.x *= 0.8;
    this.velocity.z *= 0.8;

    this.mesh.position.copy(this.position);

    if (!state.isRobloxMode) {
      const speed = Math.hypot(this.velocity.x, this.velocity.z);
      const moving = this.isOnGround && speed > 1;
      let bob = 0;
      if (this.isOnGround) {
        bob = moving
          ? Math.abs(Math.sin(time * 10 + this.animOffset)) * 0.18
          : Math.sin(time * 2 + this.animOffset) * 0.05;
      } else {
        bob = 0.06;
      }
      this.mesh.position.y += bob;
    }

    if(!this.isPlayer && !isIntro) {
      this.runAI(dt, time);

      if(this.position.distanceToSquared(this.lastPos) < 0.001) {
        this.stuckTimer += dt;
        if(this.stuckTimer > 0.3) {
          if(this.jumps < state.maxAllowedJumps) this.jump();
          this.stuckTimer = 0;
        }
      } else {
        this.stuckTimer = 0;
      }
    }
    this.lastPos.copy(this.position);

    if(isIntro) {
      this.velocity.x = 0;
      this.velocity.z = 0;
    }

    if (this.isPlayer && !isIntro) {
      this.mesh.rotation.y = state.camYaw + Math.PI;
    } else if(Math.abs(this.velocity.x) > 0.1 || Math.abs(this.velocity.z) > 0.1) {
      const angle = Math.atan2(this.velocity.x, this.velocity.z);
      this.mesh.rotation.y = angle;
    } else if (isIntro) {
      this.mesh.rotation.y = 0;
    }
  }

  animateFace(time) {
    if (!this.leftEye || !this.rightEye) return;
    const period = 3.6 + this.animOffset % 1.5;
    const t = (time + this.animOffset) % period;
    const blink = t < 0.13 ? Math.abs(Math.sin((t / 0.13) * Math.PI)) : 1;
    const s = Math.max(0.05, blink);
    this.leftEye.scale.set(1, s, 1);
    this.rightEye.scale.set(1, s, 1);
  }

  resolveCharacterCollisionXZ() {
    const collisionRad = 1.0 * this.baseScale;
    const minDistSq = (collisionRad * 2) * (collisionRad * 2);

    for(let other of state.players) {
      if(other === this || other.isDead) continue;
      const dx = this.position.x - other.position.x;
      const dz = this.position.z - other.position.z;
      const distSq = dx*dx + dz*dz;
      const dy = Math.abs(this.position.y - other.position.y);

      if(distSq < minDistSq && dy < 1.8 * this.baseScale) {
        const dist = Math.sqrt(distSq);
        if(dist === 0) continue;
        const push = ((collisionRad * 2) - dist) / 2;
        this.position.x += (dx/dist) * push;
        this.position.z += (dz/dist) * push;
      }
    }
  }

  resolveWallCollisions() {
    if (state.gameState === 'intro') return;
    const rad = 1.0 * this.baseScale;
    const feetY = this.position.y;

    for (const w of state.walls) {
      const dx = this.position.x - w.x;
      const dz = this.position.z - w.z;
      const lx = dx * w.c - dz * w.s;
      const lz = dx * w.s + dz * w.c;
      const hW = w.halfW + rad;
      const hT = w.halfT + rad;

      if (Math.abs(lx) < hW && Math.abs(lz) < hT) {
        if (this.prevY >= w.topY - 0.05 && this.position.y <= w.topY && this.velocity.y <= 0) {
          this.position.y = w.topY;
          this.velocity.y = 0;
          this.isOnGround = true;
          continue;
        }

        if (feetY >= w.topY - 0.05) continue;

        const penX = hW - Math.abs(lx);
        const penZ = hT - Math.abs(lz);
        let outLX, outLZ;
        if (penX < penZ) { outLX = Math.sign(lx) * penX; outLZ = 0; }
        else { outLX = 0; outLZ = Math.sign(lz) * penZ; }

        this.position.x += outLX * w.c + outLZ * w.s;
        this.position.z += -outLX * w.s + outLZ * w.c;

        const pushLen = Math.hypot(outLX, outLZ);
        if (pushLen > 0) {
          const nx = outLX / pushLen, nz = outLZ / pushLen;
          const vn = this.velocity.x * nx + this.velocity.z * nz;
          if (vn < 0) {
            this.velocity.x -= nx * vn;
            this.velocity.z -= nz * vn;
          }
        }
      }
    }
  }

  resolveCharacterCollisionY() {
    const collisionRad = 1.0 * this.baseScale;
    for(let other of state.players) {
      if(other === this || other.isDead) continue;
      const dx = this.position.x - other.position.x;
      const dz = this.position.z - other.position.z;

      if(dx*dx + dz*dz < (collisionRad * 2) * (collisionRad * 2)) {
        const otherTop = other.position.y + (2.0 * other.baseScale);
        if(this.prevY >= otherTop - 0.1 && this.position.y < otherTop && this.velocity.y <= 0) {
          this.position.y = otherTop;
          this.velocity.y = 0;
          this.isOnGround = true;
        }
      }
    }
  }

  jump() {
    if(this.isOnGround) {
      this.velocity.y = JUMP_FORCE;
      this.jumps = 1;
      playSound('jump');
    } else if (this.jumps < state.maxAllowedJumps) {
      this.velocity.y = JUMP_FORCE;
      this.jumps++;
      playSound('jump');
    }
  }

  rollJump(prob) {
    if (state.easierBotsMode) return false;
    return Math.random() < prob;
  }

  steerWalls(dir, time) {
    const rad = this.baseScale;
    for (const w of state.walls) {
      const dx = this.position.x - w.x;
      const dz = this.position.z - w.z;
      const lx = dx * w.c - dz * w.s;
      const lz = dx * w.s + dz * w.c;

      if (this.position.y >= w.topY - 0.1) continue;

      const hW = w.halfW + rad;
      const hT = w.halfT + rad;
      if (Math.abs(lx) < hW && Math.abs(lz) < hT) {
        if (this.isOnGround && this.rollJump(0.35)) this.jump();
        if (Math.abs(lz) < Math.abs(lx)) {
          const sign = lz >= 0 ? 1 : -1;
          dir.x += w.c * sign;
          dir.z += -w.s * sign;
        } else {
          const sign = lx >= 0 ? 1 : -1;
          dir.x += w.s * sign;
          dir.z += w.c * sign;
        }
      }
    }
    if (dir.lengthSq() > 0.0001) dir.normalize();
  }

  runAI(dt, time) {
    let moveDir = new THREE.Vector3();
    const easeMul = state.easierBotsMode ? 0.75 : 1;

    if (!state.bombHolder) {
      let tooClose = false;
      for (let p of state.players) {
        if (p !== this && !p.isDead) {
          let distSq = this.position.distanceToSquared(p.position);
          if (distSq < 300) {
            let awayP = new THREE.Vector3().subVectors(this.position, p.position);
            awayP.y = 0;
            moveDir.add(awayP.normalize());
            tooClose = true;
          }
        }
      }

      if (tooClose) {
        const wallMargin = 15;
        const limit = state.MAP_SIZE / 2;
        if (this.position.x < -limit + wallMargin) moveDir.x += (wallMargin - (this.position.x - -limit)) * 0.15;
        if (this.position.x > limit - wallMargin) moveDir.x -= (wallMargin - (limit - this.position.x)) * 0.15;
        if (this.position.z < -limit + wallMargin) moveDir.z += (wallMargin - (this.position.z - -limit)) * 0.15;
        if (this.position.z > limit - wallMargin) moveDir.z -= (wallMargin - (limit - this.position.z)) * 0.15;

        moveDir.normalize();

        this.steerWalls(moveDir, time);

        this.velocity.x += moveDir.x * MOVE_SPEED * dt * 4 * easeMul;
        this.velocity.z += moveDir.z * MOVE_SPEED * dt * 4 * easeMul;
      }
    } else {
      let target = null;
      const distToBombSq = this.position.distanceToSquared(state.bombHolder.position);
      const distToBomb = Math.sqrt(distToBombSq);

      if (state.bombHolder === this) {
        let minDist = Infinity;
        for(let p of state.players) {
          if(p === this || p.isDead || this.cannotPassTo === p) continue;
          const dist = this.position.distanceToSquared(p.position);
          if(dist < minDist) {
            minDist = dist;
            target = p;
          }
        }
        if(target) {
          let predictedTargetPos = target.position.clone().addScaledVector(target.velocity, 0.4);
          let dx = predictedTargetPos.x - this.position.x;
          let dz = predictedTargetPos.z - this.position.z;
          let dy = predictedTargetPos.y - this.position.y;
          let distXZSq = dx*dx + dz*dz;

          if (dy > 3 && distXZSq < 35) {
            let bestPlatform = null;
            let bestScore = -Infinity;

            for (let p of state.platforms) {
              let pdy = p.topY - this.position.y;
              if (pdy > 1 && pdy < 11) {
                let pdx = p.mesh.position.x - this.position.x;
                let pdz = p.mesh.position.z - this.position.z;
                let pDistSq = pdx*pdx + pdz*pdz;

                let tdx = p.mesh.position.x - predictedTargetPos.x;
                let tdz = p.mesh.position.z - predictedTargetPos.z;
                let tDistSq = tdx*tdx + tdz*tdz;

                if (tDistSq > 20) {
                  let score = -pDistSq + (pdy * 20);
                  if (score > bestScore) {
                    bestScore = score;
                    bestPlatform = p.mesh.position;
                  }
                }
              }
            }

            if (bestPlatform) {
              moveDir.subVectors(bestPlatform, this.position);
            } else {
              moveDir.set(-dx, 0, -dz);
              if (moveDir.lengthSq() < 0.1) moveDir.set(Math.sin(time*3 + this.animOffset), 0, Math.cos(time*3 + this.animOffset));
            }
            if (this.rollJump(0.05)) this.jump();
          } else {
            moveDir.subVectors(predictedTargetPos, this.position);
            if (dy > 1.5 && distXZSq < 100 && this.rollJump(0.05)) this.jump();
          }
          moveDir.y = 0;
          moveDir.normalize();
        }
      } else {
        const panicThreshold = 5.0;
        let isPanicking = state.bombTimer < panicThreshold || distToBomb < 14;
        let isTeasing = !isPanicking && distToBomb > 15 && distToBomb < 30;

        if (isTeasing) {
          moveDir.subVectors(state.bombHolder.position, this.position).normalize();
          let tempX = moveDir.x; moveDir.x = -moveDir.z; moveDir.z = tempX;
          if (Math.sin(time * 2.5 + this.animOffset) > 0) moveDir.negate();
          if (this.rollJump(0.015)) this.jump();
        } else {
          let dirFromBomb = new THREE.Vector3().subVectors(this.position, state.bombHolder.position);
          dirFromBomb.y = 0;
          dirFromBomb.normalize();

          const wallMargin = 15;
          const limit = state.MAP_SIZE / 2;
          let wallForce = new THREE.Vector3();
          if (this.position.x < -limit + wallMargin) wallForce.x += (wallMargin - (this.position.x - -limit)) * 0.3;
          if (this.position.x > limit - wallMargin) wallForce.x -= (wallMargin - (limit - this.position.x)) * 0.3;
          if (this.position.z < -limit + wallMargin) wallForce.z += (wallMargin - (this.position.z - -limit)) * 0.3;
          if (this.position.z > limit - wallMargin) wallForce.z -= (wallMargin - (limit - this.position.z)) * 0.3;

          if (wallForce.lengthSq() > 0.5 && dirFromBomb.dot(wallForce) < -0.2) {
            let strafe = new THREE.Vector3(-dirFromBomb.z, 0, dirFromBomb.x);
            if (strafe.dot(this.position) > 0) strafe.negate();
            moveDir.addScaledVector(strafe, 1.5);
            if (this.rollJump(0.05)) this.jump();
          } else {
            moveDir.copy(dirFromBomb);
          }

          moveDir.add(wallForce);
          moveDir.normalize();
        }
      }

      this.steerWalls(moveDir, time);

      this.velocity.x += moveDir.x * MOVE_SPEED * dt * 5 * easeMul;
      this.velocity.z += moveDir.z * MOVE_SPEED * dt * 5 * easeMul;
    }

    let intentDir = moveDir.clone();
    if (intentDir.lengthSq() === 0) intentDir.set(this.velocity.x, 0, this.velocity.z);
    intentDir.normalize();

    if (intentDir.lengthSq() > 0.1) {
      let lookAheadX = this.position.x + intentDir.x * 3.0;
      let lookAheadZ = this.position.z + intentDir.z * 3.0;

      for (let p of state.platforms) {
        let px = p.mesh.position.x;
        let pz = p.mesh.position.z;
        let dx = px - lookAheadX;
        let dz = pz - lookAheadZ;

        if (dx*dx + dz*dz < 25) {
          if (p.topY > this.position.y + 0.2 && p.topY < this.position.y + 11) {
            if (this.isOnGround && this.rollJump(0.2)) {
              this.jump();
            } else if (this.jumps < state.maxAllowedJumps && this.velocity.y < 3 && p.topY > this.position.y + 2 && this.rollJump(0.15)) {
              this.jump();
            }
          }
        }
      }
    }
  }

  explode() {
    this.isDead = true;
    if (this.nametag) this.nametag.remove();
    playSound('explode');

    if (state.spectateTarget === this) state.spectateTarget = null;

    // Gather every visible body-part mesh with its world transform,
    // skipping the bomb itself (it may be held in one of the hands).
    const parts = [];
    const bomb = state.bombMesh;
    const isPartOfBomb = obj => {
      let p = obj.parent;
      while (p) { if (p === bomb) return true; p = p.parent; }
      return false;
    };
    this.mesh.updateMatrixWorld(true);
    this.mesh.traverse(obj => {
      if (obj.isMesh && !isPartOfBomb(obj)) {
        const pos = new THREE.Vector3();
        const quat = new THREE.Quaternion();
        const scale = new THREE.Vector3();
        obj.getWorldPosition(pos);
        obj.getWorldQuaternion(quat);
        obj.getWorldScale(scale);
        parts.push({ obj, pos, quat, scale });
      }
    });

    state.scene.remove(this.mesh);

    parts.forEach(p => {
      p.obj.geometry.computeBoundingBox();
      const bb = p.obj.geometry.boundingBox;
      const hx = Math.max((bb.max.x - bb.min.x) / 2 * p.scale.x, 0.05);
      const hy = Math.max((bb.max.y - bb.min.y) / 2 * p.scale.y, 0.05);
      const hz = Math.max((bb.max.z - bb.min.z) / 2 * p.scale.z, 0.05);
      const shape = new CANNON.Box(new CANNON.Vec3(hx, hy, hz));

      // Detach the part from its parent and place it in the world on its own.
      p.obj.parent.remove(p.obj);
      p.obj.position.copy(p.pos);
      p.obj.quaternion.copy(p.quat);
      p.obj.scale.copy(p.scale);
      state.scene.add(p.obj);

      const body = new CANNON.Body({ mass: 1, shape });
      body.position.set(p.pos.x, p.pos.y, p.pos.z);
      body.quaternion.set(p.quat.x, p.quat.y, p.quat.z, p.quat.w);

      // Blast outward from the character's centre.
      const dir = new THREE.Vector3().subVectors(p.pos, this.position);
      dir.y = 0;
      if (dir.lengthSq() < 0.01) dir.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
      else dir.normalize();
      const blast = 5 + Math.random() * 7;
      body.velocity.set(dir.x * blast, 9 + Math.random() * 22, dir.z * blast);
      body.angularVelocity.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
      state.physicsWorld.addBody(body);
      state.debris.push({ mesh: p.obj, body, timer: 5.0 });
    });
  }
}
