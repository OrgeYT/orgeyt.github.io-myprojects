import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { initRagdoll } from './ragdoll.js';
import { buildMaterialsForSkin } from './skins.js';

export function initUI(camera, controls, world, scene, state){
  const btnReset = document.getElementById('btn-reset');
  const btnExplode = document.getElementById('btn-explode');
  const btnUltra = document.getElementById('btn-ultra');
  const btnSpawn = document.getElementById('btn-spawn');
  const btnIce = document.getElementById('btn-ice');
  const btnFollow = document.getElementById('btn-follow');
  const btnStand = document.getElementById('btn-stand');
  const btnSlow = document.getElementById('btn-slow');
  const btnKnock = document.getElementById('btn-knock');
  const btnPause = document.getElementById('btn-pause');
  const btnRmode = document.getElementById('btn-rmode');
  const freecamHint = document.getElementById('freecam-hint');

  // wire up the menu toggle (open/close the dark panel)
  const menuToggle = document.getElementById('menu-toggle');
  const uiPanel = document.getElementById('ui-panel');
  if(menuToggle && uiPanel){
    menuToggle.addEventListener('click', ()=>{
      const isOpen = uiPanel.classList.contains('open');
      if(isOpen){
        uiPanel.classList.remove('open');
        uiPanel.classList.add('closed');
        menuToggle.textContent = 'Menu ▾';
        menuToggle.setAttribute('aria-expanded', 'false');
      } else {
        uiPanel.classList.remove('closed');
        uiPanel.classList.add('open');
        menuToggle.textContent = 'Menu ▴';
        menuToggle.setAttribute('aria-expanded', 'true');
      }
    });
  }

  // create a skin selector dropdown appended to the UI container
  const uiContainer = document.getElementById('ui-container');
  const skinSelect = document.createElement('select');
  skinSelect.style.padding = '8px';
  skinSelect.style.borderRadius = '8px';
  skinSelect.style.fontWeight = '700';
  skinSelect.style.fontSize = '13px';
  skinSelect.style.background = '#0078d7';
  skinSelect.style.color = '#fff';
  skinSelect.style.border = '2px solid #005a9e';
  skinSelect.style.cursor = 'pointer';
  const options = [
    { label: 'Cardboard (Default)', value: 'cardboard' },
    { label: 'Noob', value: 'noob' },
    { label: 'Boon', value: 'boon' },
    { label: 'White', value: 'white' },
    { label: 'Dummy', value: 'dummy' }
  ];
  options.forEach(o=>{
    const opt = document.createElement('option');
    opt.value = o.value;
    opt.textContent = o.label;
    skinSelect.appendChild(opt);
  });
  // default to Cardboard
  skinSelect.value = 'cardboard';
  uiContainer.appendChild(skinSelect);

  // create Zero Gravity button
  const btnZeroG = document.createElement('button');
  btnZeroG.id = 'btn-zerog';
  btnZeroG.textContent = 'ZeroG: OFF';
  uiContainer.appendChild(btnZeroG);

  // pause menu elements
  const pauseOverlay = document.getElementById('pause-overlay');
  const pauseResume = document.getElementById('pause-resume');
  const pauseRespawn = document.getElementById('pause-respawn');
  const pauseMeme = document.getElementById('pause-meme');
  const pauseClose = document.getElementById('pause-close');

  const memeOverlay = document.getElementById('meme-overlay');
  const memeIframe = document.getElementById('meme-iframe');
  const memeClose = document.getElementById('meme-close');

  btnReset.onclick = ()=>{
    state.parts.forEach(p=>{
      p.body.position.copy(p.initialPos);
      p.body.quaternion.set(0,0,0,1);
      p.body.velocity.set(0,0,0);
      p.body.angularVelocity.set(0,0,0);
    });
    setStanding(false);
  };

  // Pause button toggles the pause overlay and freeze state.paused
  if(btnPause){
    btnPause.onclick = ()=>{
      state.paused = true;
      pauseOverlay.style.display = 'flex';
      // ensure focusable
      pauseResume.focus();
    };
  }

  // Resume from pause
  if(pauseResume){
    pauseResume.onclick = ()=>{
      state.paused = false;
      pauseOverlay.style.display = 'none';
    };
  }

  // Respawn ragdoll then resume
  if(pauseRespawn){
    pauseRespawn.onclick = ()=>{
      // trigger the same logic as Reset but keep it local
      btnReset.click();
      state.paused = false;
      pauseOverlay.style.display = 'none';
    };
  }

  // Watch meme: open the meme overlay with the YouTube short
  if(pauseMeme){
    pauseMeme.onclick = ()=>{
      // Set paused so scene is frozen while watching
      state.paused = true;
      pauseOverlay.style.display = 'none';
      memeOverlay.style.display = 'flex';
      // use YouTube short URL embeddable variant; allow autoplay but do not force sound
      memeIframe.src = 'https://www.youtube.com/embed/wqEYD88j0kE?rel=0&autoplay=1&modestbranding=1';
    };
  }
  if(pauseClose){
    pauseClose.onclick = ()=>{
      state.paused = false;
      pauseOverlay.style.display = 'none';
    };
  }

  if(memeClose){
    memeClose.onclick = ()=>{
      memeIframe.src = '';
      memeOverlay.style.display = 'none';
      // unpause when closing meme viewer
      state.paused = false;
    };
  }

  btnExplode.onclick = ()=>{
    const force = new CANNON.Vec3((Math.random()-0.5)*1500, 3000, (Math.random()-0.5)*1500);
    const lower = state.parts.find(p=>p.name==='LowerTorso');
    if(lower) lower.body.applyImpulse(force, new CANNON.Vec3(0,0,0));
    setStanding(false);
  };

  // Ultra Launch: much stronger impulse than Super Launch
  if(btnUltra){
    btnUltra.onclick = ()=>{
      // Larger random horizontal spread and a much stronger upward impulse
      const horiz = (Math.random()-0.5) * 3000; // wider X/Z variance
      const horizZ = (Math.random()-0.5) * 3000;
      const up = 8000 + Math.random() * 2000; // significantly stronger upward force
      const force = new CANNON.Vec3(horiz, up, horizZ);
      const lower = state.parts.find(p=>p.name==='LowerTorso');
      if(lower) lower.body.applyImpulse(force, new CANNON.Vec3(0,0,0));
      // also apply a small random torque to make the launch feel chaotic
      if(lower){
        const torque = new CANNON.Vec3((Math.random()-0.5)*600, (Math.random()-0.5)*600, (Math.random()-0.5)*600);
        lower.body.torque.x += torque.x;
        lower.body.torque.y += torque.y;
        lower.body.torque.z += torque.z;
      }
      setStanding(false);
    };
  }

  // RagDoll mode toggle: cycle between R11 (default), R6, and R15 (R11 + hands/feet)
  if(btnRmode){
    // helper to produce display label where R11 reads as the Default variant
    const modeLabel = (m) => (m === 'R11' ? 'R11 (Default)' : m);

    btnRmode.onclick = async ()=>{
      // cycle order: R11 -> R6 -> R15 -> R11...
      let next;
      if(state.ragdollMode === 'R11') next = 'R6';
      else if(state.ragdollMode === 'R6') next = 'R15';
      else next = 'R11';

      btnRmode.textContent = `RagDoll: ${modeLabel(next)}`;
      // remove existing ragdoll parts & constraints
      function clearRagdoll(){
        // remove constraints
        if(Array.isArray(state.constraints)){
          state.constraints.forEach(c=>{ try{ world.removeConstraint(c); }catch(e){} });
          state.constraints.length = 0;
        }
        // remove bodies and meshes
        state.parts.forEach(p=>{
          try{ world.removeBody(p.body); }catch(e){}
          try{ scene.remove(p.mesh); }catch(e){}
        });
        state.parts.length = 0;
      }
      clearRagdoll();
      state.ragdollMode = next;
      // recreate ragdoll for the selected mode
      await initRagdoll(world, scene, state);
      // ensure standing toggles reset
      setStanding(false);
    };

    // ensure initial label reflects the "(Default)" suffix when page loads
    btnRmode.textContent = `RagDoll: ${modeLabel(state.ragdollMode || 'R11')}`;
  }

  // Knock the head backward and disable standing
  btnKnock.onclick = ()=>{
    const head = state.parts.find(p=>p.name==='Head');
    if(!head) return;
    // compute backward direction in world space (head local -Z)
    const localBack = new CANNON.Vec3(0,0,-1);
    const worldBack = head.body.quaternion.vmult(localBack);
    const impulseStrength = 600;
    const impulse = new CANNON.Vec3(worldBack.x*impulseStrength, worldBack.y*impulseStrength*0.2, worldBack.z*impulseStrength);
    head.body.applyImpulse(impulse, new CANNON.Vec3(0,0,0));
    setStanding(false);
  };

  // Skin selector logic: apply a preset by recreating the ragdoll with new materials
  skinSelect.onchange = async ()=>{
    const val = skinSelect.value;

    // Build the proper materials object (head/torso/arms/legs/presets) using the skins module.
    // buildMaterialsForSkin will produce THREE.Material instances where appropriate.
    const newMaterials = buildMaterialsForSkin(state, val, THREE);

    // clear existing ragdoll bodies and meshes
    function clearRagdoll(){
      if(Array.isArray(state.constraints)){
        state.constraints.forEach(c=>{ try{ world.removeConstraint(c); }catch(e){} });
        state.constraints.length = 0;
      }
      state.parts.forEach(p=>{
        try{ world.removeBody(p.body); }catch(e){}
        try{ scene.remove(p.mesh); }catch(e){}
      });
      state.parts.length = 0;
    }
    clearRagdoll();

    // assign new materials and recreate ragdoll
    state.materials = newMaterials;
    await initRagdoll(world, scene, state);
    // reset standing state to avoid unexpected forces
    setStanding(false);
  };

  btnSpawn.onclick = ()=>{
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    const spawnPos = camera.position.clone().add(camDir.multiplyScalar(15));
    createBoxDynamic(3,3,3, spawnPos.x, spawnPos.y, spawnPos.z, Math.random()*0xffffff, 5);
  };

  // Slow motion toggle: reduce timeScale to 0.25 for slow motion
  if(btnSlow){
    btnSlow.onclick = ()=>{
      const isSlow = state.timeScale !== 1;
      state.timeScale = isSlow ? 1 : 0.25;
      btnSlow.textContent = isSlow ? 'Slow: OFF' : 'Slow: ON';
      btnSlow.classList.toggle('toggle-active', !isSlow);
    };
  }

  // Zero Gravity toggle: flip world gravity between original and zero (use Vec3.set for robustness)
  if(document.getElementById('btn-zerog')){
    const btnZeroGEl = document.getElementById('btn-zerog');
    btnZeroGEl.onclick = ()=>{
      state.zeroGravity = !state.zeroGravity;
      btnZeroGEl.textContent = state.zeroGravity ? 'ZeroG: ON' : 'ZeroG: OFF';
      btnZeroGEl.classList.toggle('toggle-active', state.zeroGravity);
      if(world && world.gravity && typeof world.gravity.set === 'function'){
        if(state.zeroGravity){
          world.gravity.set(0, 0, 0);
        } else {
          const gy = (state._originalGravityY !== undefined ? state._originalGravityY : -35);
          world.gravity.set(0, gy, 0);
        }
      }
    };
  }



  btnFollow.onclick = ()=>{
    state.isFollowing = !state.isFollowing;
    btnFollow.textContent = state.isFollowing ? 'Follow: ON' : 'Follow: OFF';
    btnFollow.classList.toggle('toggle-active');
    freecamHint.style.display = state.isFollowing ? 'none' : 'block';
  };

  // Ice toggle: reduce ground<->dynamic friction to near zero for slippery behavior
  if(btnIce){
    btnIce.onclick = ()=>{
      state.isIce = !state.isIce;
      btnIce.textContent = state.isIce ? 'Ice: ON' : 'Ice: OFF';
      btnIce.classList.toggle('toggle-active', state.isIce);
      if(state.groundContact){
        state.groundContact.friction = state.isIce ? 0.02 : 0.4;
        // optionally increase restitution slightly on ice for more slide bounce
        state.groundContact.restitution = state.isIce ? 0.03 : 0.0;
      } else if(world && world.defaultContactMaterial){
        world.defaultContactMaterial.friction = state.isIce ? 0.02 : 0.4;
        world.defaultContactMaterial.restitution = state.isIce ? 0.03 : 0.0;
      }
    };
  }

  btnStand.onclick = ()=> setStanding();

  function setStanding(force){
    state.isStanding = (force !== undefined) ? force : !state.isStanding;
    btnStand.textContent = state.isStanding ? 'Stand: ON' : 'Stand: OFF';
    btnStand.classList.toggle('toggle-active', state.isStanding);

    // When toggling standing, tighten or loosen constraints for stronger/looser joints.
    // We use the stored _initialAngle on each constraint to compute the tightened value.
    if(Array.isArray(state.constraints)){
      state.constraints.forEach(c=>{
        if(!c || typeof c._initialAngle !== 'number') return;
        if(state.isStanding){
          // tighten to a fraction of the original to hold pose
          c.angle = Math.max(0.08, c._initialAngle * 0.35);
          c.twistAngle = Math.min(1.2, (c.twistAngle || 0.6) * 0.6);
        } else {
          // relax beyond original for floppy ragdoll feel
          c.angle = c._initialAngle * 1.4;
          c.twistAngle = Math.max(0.4, (c.twistAngle || 0.6) * 1.2);
        }
      });
    }
  }

  // helper to spawn dynamic map box (delegates to physics world)
  function createBoxDynamic(w,h,d,x,y,z,color=0xffffff,mass=1){
    // quick local creation without exporting the helper; mirrors physics.createBox in physics.js
    const body = new CANNON.Body({
      mass,
      position: new CANNON.Vec3(x,y,z),
      shape: new CANNON.Box(new CANNON.Vec3(w/2,h/2,d/2))
    });

    // Use stud texture for spawned dynamic boxes when available to match map styling
    let mat;
    if(state && state.studTex){
      const tex = state.studTex.clone();
      // set sensible repeat so studs scale with box dimensions (use half-size as heuristic)
      tex.repeat.set(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(d / 2)));
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      mat = new THREE.MeshStandardMaterial({ map: tex, color });
    } else {
      mat = new THREE.MeshStandardMaterial({ color });
    }

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
    mesh.position.set(x,y,z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    world.addBody(body);
    state.mapMeshes.push(mesh);
    state.mapBodies.push(body);
  }
}