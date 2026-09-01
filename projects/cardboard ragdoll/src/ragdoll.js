import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { createFaceTexture } from './textures.js';
import { loadCardboardTexture, loadFaceTexture } from './assets.js';

export async function initRagdoll(world, scene, state){
  // load cardboard and face textures via central loader helpers
  const cardboardTex = await loadCardboardTexture();
  cardboardTex.wrapS = cardboardTex.wrapT = THREE.RepeatWrapping;
  cardboardTex.encoding = THREE.sRGBEncoding;
  cardboardTex.flipY = false;

  // helper to create a procedural "tape" overlay texture (transparent background)
  function createTapeTexture(size, seed = Math.random()){
    const w = Math.max(64, Math.floor(size[0] * 64));
    const h = Math.max(64, Math.floor(size[1] * 64));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');

    // Transparent background
    ctx.clearRect(0,0,w,h);

    // Randomly place 2-5 tape strips with random rotation, width and slight color variation
    const strips = 2 + Math.floor((Math.abs(Math.sin(seed*9999)) * 3));
    for(let i=0;i<strips;i++){
      const tSeed = seed * (i + 1.235);
      // random position
      const cx = Math.floor((Math.abs(Math.sin(tSeed * 13.1)) * 0.8 + 0.1) * w);
      const cy = Math.floor((Math.abs(Math.cos(tSeed * 7.3)) * 0.8 + 0.1) * h);
      const angle = (Math.abs(Math.sin(tSeed * 5.7)) - 0.5) * 1.2; // between ~-0.6 and 0.6 rad
      const tw = Math.max(6, Math.floor((0.06 + Math.abs(Math.cos(tSeed*3.3)) * 0.14) * Math.min(w,h)));
      const th = Math.max(20, Math.floor((0.18 + Math.abs(Math.sin(tSeed*4.1)) * 0.35) * Math.max(w,h)));

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);

      // tape base (slightly desaturated yellow-ish)
      const variation = Math.floor(Math.abs(Math.sin(tSeed * 97.3)) * 30);
      ctx.fillStyle = `rgba(${220 - variation},${200 - Math.floor(variation*0.6)},${80 - Math.floor(variation*0.4)},0.95)`;
      // draw rounded rectangle
      const rx = -th/2, ry = -tw/2, rw = th, rh = tw;
      const r = Math.min(6, Math.floor(tw/6));
      ctx.beginPath();
      ctx.moveTo(rx + r, ry);
      ctx.lineTo(rx + rw - r, ry);
      ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + r);
      ctx.lineTo(rx + rw, ry + rh - r);
      ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - r, ry + rh);
      ctx.lineTo(rx + r, ry + rh);
      ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - r);
      ctx.lineTo(rx, ry + r);
      ctx.quadraticCurveTo(rx, ry, rx + r, ry);
      ctx.closePath();
      ctx.fill();

      // subtle edges: darker stroke
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = Math.max(1, Math.floor(tw/18));
      ctx.stroke();

      // a bit of scuff/noise by drawing semi-transparent noise lines
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = 'rgba(0,0,0,0.04)';
      for(let n=0;n<4;n++){
        const nx = rx + Math.random()*rw;
        ctx.fillRect(nx, ry + Math.random()*rh, Math.max(1,Math.floor(rw*0.02)), Math.max(1,Math.floor(rh*0.7)));
      }

      ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    return tex;
  }

  // small helper to create a material that uses the cardboard texture and optionally adds tape
  function makeCardboardMaterial(size, withTape = true){
    const tex = cardboardTex.clone();
    // choose sensible repeat based on object dimensions (scale down for small parts)
    const rx = Math.max(1, size[0] * 0.6);
    const ry = Math.max(1, size[2] * 0.6);
    tex.repeat.set(rx, ry);

    const matParams = { map: tex, roughness: 0.9 };

    if(withTape){
      // generate a tape texture sized proportionally to part and set it as an emissiveMap overlay
      const tapeTex = createTapeTexture(size, Math.random());
      // make tape repeat align with base so tape covers each face nicely
      tapeTex.repeat.set(1, 1);
      matParams.emissiveMap = tapeTex;
      matParams.emissive = new THREE.Color(0xffffff);
      matParams.emissiveIntensity = 0.35;
      // subtle normal-like variation to tape by lowering metalness slightly
      matParams.metalness = 0.02;
    }

    return new THREE.MeshStandardMaterial(matParams);
  }

  // keep the face texture generator for fallback / other uses if needed
  state.faceTex = createFaceTexture();

  const parts = state.parts;
  async function createRagdollPart(name, size, position, material, mass=1){
    // allow material to be either a THREE.Material instance or the string 'cardboard'
    const useCardboard = (material === undefined || material === 'cardboard');

    // Special-case head: use a sphere mesh and sphere collision shape, slightly larger than before
    if(name === 'Head'){
      const radius = 0.9; // visual radius
      const physRadius = radius * 0.88; // slightly smaller collision sphere than visual
      const body = new CANNON.Body({
        mass,
        position: new CANNON.Vec3(...position),
        shape: new CANNON.Sphere(physRadius),
        collisionFilterGroup: 2,
        collisionFilterMask: 1|2,
        linearDamping: 0.08,
        angularDamping: 0.25
      });
      // use dynamic material so friction interactions can be tuned (ice)
      if(state && state.dynamicMaterial) body.material = state.dynamicMaterial;

      // choose mesh material: cardboard styled or provided material
      const sphereMat = useCardboard ? makeCardboardMaterial([radius*2, radius*2, radius*2], true) : material;
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 24), sphereMat);
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.position.set(...position);

      // Use central face loader (preloaded above) and create decal plane material
      const faceMap = state._faceTexCache || await loadFaceTexture();
      // cache a reference on state to avoid re-loading per part creation
      state._faceTexCache = faceMap;
      faceMap.encoding = THREE.sRGBEncoding;
      faceMap.flipY = false;
      const faceMat = new THREE.MeshBasicMaterial({
        map: faceMap,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        side: THREE.DoubleSide
      });

      // plane size roughly matches head front area
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(radius * 1.6, radius * 1.6), faceMat);
      // position plane slightly in front of sphere along local +Z so it's visible and doesn't z-fight
      plane.position.set(0, 0, radius + 0.02);
      // rotate the decal 180 degrees so the face is upside down on the head
      plane.rotation.z = Math.PI;
      // ensure the decal faces outward by default; add as child so it follows head rotation
      mesh.add(plane);

      scene.add(mesh);
      world.addBody(body);
      const part = { name, body, mesh, initialPos: new CANNON.Vec3(...position), size: [radius*2, radius*2, radius*2] };
      parts.push(part);
      return part;
    }

    // default: box-shaped parts — use either cardboard or provided color material
    // shrink collision box slightly so visual mesh is a bit larger than the hitbox
    const hitboxShrink = 0.84;
    const halfExtents = new CANNON.Vec3((size[0]/2) * hitboxShrink, (size[1]/2) * hitboxShrink, (size[2]/2) * hitboxShrink);
    const body = new CANNON.Body({
      mass,
      position: new CANNON.Vec3(...position),
      shape: new CANNON.Box(halfExtents),
      collisionFilterGroup: 2,
      collisionFilterMask: 1|2,
      // lower damping so limbs swing more freely
      linearDamping: 0.08,
      angularDamping: 0.25
    });
    // use dynamic material so friction interactions can be tuned (ice)
    if(state && state.dynamicMaterial) body.material = state.dynamicMaterial;

    const finalMaterial = useCardboard ? makeCardboardMaterial(size, true) : material;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), finalMaterial);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    world.addBody(body);
    const part = { name, body, mesh, initialPos: new CANNON.Vec3(...position), size };
    parts.push(part);
    return part;
  }

  function connectWithLimits(partA, partB, pivotA, pivotB, angle=Math.PI/2){
    const constraint = new CANNON.ConeTwistConstraint(partA.body, partB.body, {
      pivotA: new CANNON.Vec3(...pivotA),
      pivotB: new CANNON.Vec3(...pivotB),
      // allow larger angular limits for a looser, floppi(er) feel by default
      angle,
      twistAngle: 0.6
    });
    constraint.collideConnected = true;
    // store initial angle on the constraint so we can tighten/restore later
    constraint._initialAngle = angle;
    // keep track in global state for dynamic adjustment when standing toggles
    if(state && Array.isArray(state.constraints)){
      state.constraints.push(constraint);
    }
    world.addConstraint(constraint);
    return constraint;
  }

  // spawn ragdoll (supports R11, simplified R6, and R15 layouts)
  const y = 45, x = 30;
  const p = {};

  const mode = state.ragdollMode || 'R11';

  if(mode === 'R6'){
    // R6 layout: Head, Torso (used as LowerTorso), LeftArm, RightArm, LeftLeg, RightLeg
    const torsoMat = state.materials && state.materials.torso ? state.materials.torso : 'cardboard';
    const headMat = state.materials && state.materials.head ? state.materials.head : 'cardboard';
    const armMat = state.materials && state.materials.arms ? state.materials.arms : 'cardboard';
    const legMat = state.materials && state.materials.legs ? state.materials.legs : 'cardboard';

    p.LowerTorso = await createRagdollPart('LowerTorso', [2.2,1.6,1.2], [x, y+3.0, 0], torsoMat, 4);
    p.Head = await createRagdollPart('Head', [1.0,1.0,1.0], [x, y+5.0, 0], headMat, 1);
    p.LArm = await createRagdollPart('LArm', [1.2,1.2,1.2], [x-1.8, y+3.0, 0], armMat, 1.2);
    p.RArm = await createRagdollPart('RArm', [1.2,1.2,1.2], [x+1.8, y+3.0, 0], armMat, 1.2);
    p.LLeg = await createRagdollPart('LLeg', [1.1,1.6,1.0], [x-0.6, y+1.0, 0], legMat, 2.2);
    p.RLeg = await createRagdollPart('RLeg', [1.1,1.6,1.0], [x+0.6, y+1.0, 0], legMat, 2.2);

    // connect head to torso
    connectWithLimits(p.LowerTorso, p.Head, [0,0.9,0], [0,-0.5,0], 0.45);
    // arms to torso
    connectWithLimits(p.LowerTorso, p.LArm, [-1.25,0.5,0], [0,0.4,0], Math.PI/2.8);
    connectWithLimits(p.LowerTorso, p.RArm, [1.25,0.5,0], [0,0.4,0], Math.PI/2.8);
    // legs to torso
    connectWithLimits(p.LowerTorso, p.LLeg, [-0.6,-0.8,0], [0,0.6,0], Math.PI/3.2);
    connectWithLimits(p.LowerTorso, p.RLeg, [0.6,-0.8,0], [0,0.6,0], Math.PI/3.2);
  } else if(mode === 'R15'){
    // R15: R11 base + hand joints on lower arms and foot joints on lower legs
    const torsoMat = state.materials && state.materials.torso ? state.materials.torso : 'cardboard';
    const headMat = state.materials && state.materials.head ? state.materials.head : 'cardboard';
    const armMat = state.materials && state.materials.arms ? state.materials.arms : 'cardboard';
    const legMat = state.materials && state.materials.legs ? state.materials.legs : 'cardboard';

    // core R11 parts
    p.LowerTorso = await createRagdollPart('LowerTorso', [2,1.2,1], [x, y+2.5, 0], torsoMat, 3);
    p.UpperTorso = await createRagdollPart('UpperTorso', [2.2,1.4,1.1], [x, y+3.8,0], torsoMat, 2);
    p.Head = await createRagdollPart('Head', [1.2,1.2,1.2], [x, y+5.2,0], headMat, 1);
    p.LUArm = await createRagdollPart('LUArm', [1,1.2,1], [x-1.6,y+3.8,0], armMat, 1);
    p.LLArm = await createRagdollPart('LLArm', [0.9,1.2,0.9], [x-1.6,y+2.6,0], armMat, 1);
    p.RUArm = await createRagdollPart('RUArm', [1,1.2,1], [x+1.6,y+3.8,0], armMat, 1);
    p.RLArm = await createRagdollPart('RLArm', [0.9,1.2,0.9], [x+1.6,y+2.6,0], armMat, 1);
    p.LULeg = await createRagdollPart('LULeg', [1,1.4,1], [x-0.6,y+1.2,0], legMat, 2);
    p.LLLeg = await createRagdollPart('LLLeg', [0.9,1.4,0.9], [x-0.6,y-0.2,0], legMat, 2);
    p.RULeg = await createRagdollPart('RULeg', [1,1.4,1], [x+0.6,y+1.2,0], legMat, 2);
    p.RLLeg = await createRagdollPart('RLLeg', [0.9,1.4,0.9], [x+0.6,y-0.2,0], legMat, 2);

    // extra terminal joints: small hands and feet
    p.LHand = await createRagdollPart('LHand', [0.4,0.4,0.6], [x-1.6,y+1.6,0.6], armMat, 0.25);
    p.RHand = await createRagdollPart('RHand', [0.4,0.4,0.6], [x+1.6,y+1.6,0.6], armMat, 0.25);
    p.LFoot = await createRagdollPart('LFoot', [0.6,0.3,1.0], [x-0.6,y-1.0,0.35], legMat, 0.4);
    p.RFoot = await createRagdollPart('RFoot', [0.6,0.3,1.0], [x+0.6,y-1.0,0.35], legMat, 0.4);

    // connect core R11 joints
    connectWithLimits(p.LowerTorso, p.UpperTorso, [0,0.6,0], [0,-0.7,0], 0.2);
    connectWithLimits(p.UpperTorso, p.Head, [0,0.7,0], [0,-0.6,0], 0.4);
    connectWithLimits(p.UpperTorso, p.LUArm, [-1.1,0.5,0], [0.5,0.5,0], Math.PI/2.5);
    connectWithLimits(p.UpperTorso, p.RUArm, [1.1,0.5,0], [-0.5,0.5,0], Math.PI/2.5);
    connectWithLimits(p.LUArm, p.LLArm, [0,-0.6,0], [0,0.6,0], Math.PI/2.2);
    connectWithLimits(p.RUArm, p.RLArm, [0,-0.6,0], [0,0.6,0], Math.PI/2.2);
    connectWithLimits(p.LowerTorso, p.LULeg, [-0.6,-0.6,0], [0,0.7,0], Math.PI/3);
    connectWithLimits(p.LowerTorso, p.RULeg, [0.6,-0.6,0], [0,0.7,0], Math.PI/3);
    connectWithLimits(p.LULeg, p.LLLeg, [0,-0.7,0], [0,0.7,0], Math.PI/2.5);
    connectWithLimits(p.RULeg, p.RLLeg, [0,-0.7,0], [0,0.7,0], Math.PI/2.5);

    // connect hands to lower arms with tighter wrist-like limits
    connectWithLimits(p.LLArm, p.LHand, [0,-0.7,0], [0,0.18,-0.25], 0.45);
    connectWithLimits(p.RLArm, p.RHand, [0,-0.7,0], [0,0.18,-0.25], 0.45);

    // connect feet to lower legs with limited ankle-like motion (smaller angle)
    connectWithLimits(p.LLLeg, p.LFoot, [0,-0.75,0], [0,0.18,0.25], 0.5);
    connectWithLimits(p.RLLeg, p.RFoot, [0,-0.75,0], [0,0.18,0.25], 0.5);
  } else {
    // R11 (original detailed ragdoll)
    const torsoMat = state.materials && state.materials.torso ? state.materials.torso : 'cardboard';
    const headMat = state.materials && state.materials.head ? state.materials.head : 'cardboard';
    const armMat = state.materials && state.materials.arms ? state.materials.arms : 'cardboard';
    const legMat = state.materials && state.materials.legs ? state.materials.legs : 'cardboard';

    p.LowerTorso = await createRagdollPart('LowerTorso', [2,1.2,1], [x, y+2.5, 0], torsoMat, 3);
    p.UpperTorso = await createRagdollPart('UpperTorso', [2.2,1.4,1.1], [x, y+3.8,0], torsoMat, 2);
    p.Head = await createRagdollPart('Head', [1.2,1.2,1.2], [x, y+5.2,0], headMat, 1);
    p.LUArm = await createRagdollPart('LUArm', [1,1.2,1], [x-1.6,y+3.8,0], armMat, 1);
    p.LLArm = await createRagdollPart('LLArm', [0.9,1.2,0.9], [x-1.6,y+2.6,0], armMat, 1);
    p.RUArm = await createRagdollPart('RUArm', [1,1.2,1], [x+1.6,y+3.8,0], armMat, 1);
    p.RLArm = await createRagdollPart('RLArm', [0.9,1.2,0.9], [x+1.6,y+2.6,0], armMat, 1);
    p.LULeg = await createRagdollPart('LULeg', [1,1.4,1], [x-0.6,y+1.2,0], legMat, 2);
    p.LLLeg = await createRagdollPart('LLLeg', [0.9,1.4,0.9], [x-0.6,y-0.2,0], legMat, 2);
    p.RULeg = await createRagdollPart('RULeg', [1,1.4,1], [x+0.6,y+1.2,0], legMat, 2);
    p.RLLeg = await createRagdollPart('RLLeg', [0.9,1.4,0.9], [x+0.6,y-0.2,0], legMat, 2);

    connectWithLimits(p.LowerTorso, p.UpperTorso, [0,0.6,0], [0,-0.7,0], 0.2);
    connectWithLimits(p.UpperTorso, p.Head, [0,0.7,0], [0,-0.6,0], 0.4);
    connectWithLimits(p.UpperTorso, p.LUArm, [-1.1,0.5,0], [0.5,0.5,0], Math.PI/2.5);
    connectWithLimits(p.UpperTorso, p.RUArm, [1.1,0.5,0], [-0.5,0.5,0], Math.PI/2.5);
    connectWithLimits(p.LUArm, p.LLArm, [0,-0.6,0], [0,0.6,0], Math.PI/2.2);
    connectWithLimits(p.RUArm, p.RLArm, [0,-0.6,0], [0,0.6,0], Math.PI/2.2);
    connectWithLimits(p.LowerTorso, p.LULeg, [-0.6,-0.6,0], [0,0.7,0], Math.PI/3);
    connectWithLimits(p.LowerTorso, p.RULeg, [0.6,-0.6,0], [0,0.7,0], Math.PI/3);
    connectWithLimits(p.LULeg, p.LLLeg, [0,-0.7,0], [0,0.7,0], Math.PI/2.5);
    connectWithLimits(p.RULeg, p.RLLeg, [0,-0.7,0], [0,0.7,0], Math.PI/2.5);
  }

  // compute and store each part's rest rotation relative to the LowerTorso
  const lowerQuat = p.LowerTorso.body.quaternion.clone();
  Object.values(p).forEach(pr=>{
    // initial world quaternion (at spawn)
    pr.initialWorldQuat = pr.body.quaternion.clone();
    // store quaternion relative to lower torso so we can reconstruct standing pose later
    pr.initialRelToLower = lowerQuat.inverse().mult(pr.initialWorldQuat);
  });

  // keep reference to parts (still pushed earlier)
  Object.values(p).forEach(pr=>{}); // no-op to satisfy linter
}