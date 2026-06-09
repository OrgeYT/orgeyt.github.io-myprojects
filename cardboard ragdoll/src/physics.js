import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { createStudTexture } from './textures.js';

export function initPhysics(world, scene, state){
  // helper to create boxes (map + dynamic)
  const GROUP_STATIC = 1;
  const GROUP_DYNAMIC = 2;
  state.studTex = createStudTexture();

  // create materials for ground and dynamic bodies so we can tune friction (ice)
  state.groundMaterial = new CANNON.Material('ground');
  state.dynamicMaterial = new CANNON.Material('dynamic');

  // default contact between ground and dynamic bodies
  const groundContact = new CANNON.ContactMaterial(state.groundMaterial, state.dynamicMaterial, {
    friction: 0.4,
    restitution: 0.0
  });
  groundContact.contactEquationStiffness = 1e7;
  world.addContactMaterial(groundContact);
  state.groundContact = groundContact;
  // convenience initial flag
  state.isIce = false;

  function createBox(w,h,d,x,y,z,color=0x888888,mass=0){
    const body = new CANNON.Body({
      mass: mass,
      position: new CANNON.Vec3(x,y,z),
      shape: new CANNON.Box(new CANNON.Vec3(w/2,h/2,d/2)),
      collisionFilterGroup: mass===0 ? GROUP_STATIC : GROUP_DYNAMIC,
      collisionFilterMask: GROUP_DYNAMIC | GROUP_STATIC
    });

    // assign cannon material for friction control
    if(mass === 0){
      body.material = state.groundMaterial;
    } else {
      body.material = state.dynamicMaterial;
    }

    const mat = new THREE.MeshStandardMaterial({ color });
    if(mass===0){
      mat.map = state.studTex.clone();
      mat.map.repeat.set(w/2,d/2);
    }
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
    mesh.position.set(x,y,z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    world.addBody(body);
    if(mass>0){
      state.mapMeshes.push(mesh);
      state.mapBodies.push(body);
    }
    return { mesh, body };
  }

  // the map (main ground now finite so the world edges are reachable)
  createBox(200,2,200,0,-1,0,0x444444);
  // longer stair run: more steps and slightly larger vertical/horizontal spacing
  for(let i=0;i<30;i++) createBox(10,1,2,-20, i*0.9, i*2.5, 0x777777);
  createBox(15,40,15,30,19,0,0x666666);
  createBox(20,2,20,30,39,0,0x555555);
  createBox(5,5,5,10,2.5,-20,0xff5555);
  createBox(8,2,8,-10,1,15,0x55ff55);

  // create a void barrier under the ground: large red static box; if ragdoll touches it we'll respawn
  // place it "far down (not too far)" under the main ground (main ground around y = -1)
  // moved deeper so it sits further below the playable area
  const voidY = -500; // depth (moved further down)
  const voidHeight = 4;
  const voidBox = createBox(400, voidHeight, 400, 0, voidY, 0, 0xff2222, 0);

  // Make the barrier non-colliding (no physical response) so it only acts as a trigger region.
  // We set collisionFilterMask to 0 and disable collision response on the body.
  if(voidBox.body){
    voidBox.body.collisionFilterMask = 0;
    voidBox.body.collisionResponse = false;
  }

  // mark specially on state for detection and follow behavior (we'll update X/Z each frame)
  state.voidBarrier = {
    mesh: voidBox.mesh,
    body: voidBox.body,
    y: voidY,
    halfHeight: voidHeight / 2
  };

  // joint body for dragging
  const jointBody = new CANNON.Body({ mass: 0 });
  jointBody.collisionFilterGroup = 0; jointBody.collisionFilterMask = 0;
  world.addBody(jointBody);
  state.jointBody = jointBody;

  // store original gravity so UI can toggle zero-gravity mode
  state._originalGravityY = world.gravity ? world.gravity.y : -35;
  state.zeroGravity = false;

  // create a bounce pad: static box with strong restitution and a marker so we can apply an extra impulse on contact
  const padSize = { w: 8, h: 1, d: 8 };
  const padX = 0, padY = 0.5, padZ = -10;
  const padBody = new CANNON.Body({
    mass: 0,
    position: new CANNON.Vec3(padX, padY, padZ),
    shape: new CANNON.Box(new CANNON.Vec3(padSize.w/2, padSize.h/2, padSize.d/2))
  });
  // special material for the pad so it bounces nicely
  const padMaterial = new CANNON.Material('bouncePad');
  padBody.material = padMaterial;
  // visual mesh (red with slight gloss)
  const padMat = new THREE.MeshStandardMaterial({ color: 0x44ccff, metalness: 0.05, roughness: 0.4 });
  const padMesh = new THREE.Mesh(new THREE.BoxGeometry(padSize.w, padSize.h, padSize.d), padMat);
  padMesh.position.set(padX, padY, padZ);
  padMesh.receiveShadow = true;
  scene.add(padMesh);
  world.addBody(padBody);

  // contact material between pad and dynamic bodies (high restitution)
  const padContact = new CANNON.ContactMaterial(state.dynamicMaterial || new CANNON.Material('dynamic'), padMaterial, {
    friction: 0.2,
    restitution: 1.6
  });
  padContact.contactEquationStiffness = 1e7;
  world.addContactMaterial(padContact);

  state.bouncePad = { body: padBody, mesh: padMesh, impulseStrength: 800 };

  // listen for beginContact to provide an extra upward impulse when ragdoll parts hit the pad
  world.addEventListener('beginContact', (evt) => {
    try {
      // evt.bodyA and evt.bodyB may be undefined in some cases; guard them
      const a = evt.bodyA || null;
      const b = evt.bodyB || null;
      if(!a || !b) return;

      // determine if either side is the pad and the other is one of our dynamic parts
      const padIsA = (a === padBody);
      const padIsB = (b === padBody);
      if(!padIsA && !padIsB) return;

      const other = padIsA ? b : a;
      // only apply to dynamic group bodies (we used GROUP_DYNAMIC = 2 earlier) or bodies that are in state.parts
      const isRagdollPart = Array.isArray(state.parts) && state.parts.some(p => p.body === other);
      const isDynamic = (other.mass && other.mass > 0);

      if(isRagdollPart || isDynamic){
        // compute an upward impulse. Slightly scale by the incoming velocity to make interactions feel responsive.
        const vel = other.velocity || new CANNON.Vec3(0,0,0);
        const verticalSpeed = Math.max(0, -vel.y); // if falling downward, add more bounce
        const base = state.bouncePad.impulseStrength || 800;
        const impulseY = base + verticalSpeed * 120;
        // apply impulse at the contact point if available; otherwise apply at body center
        const contactPointWorld = evt.contact && evt.contact.rj ? evt.contact.rj.clone() : null;
        const impulse = new CANNON.Vec3(0, impulseY, 0);
        other.applyImpulse(impulse, contactPointWorld || other.position);
      }
    } catch (err) {
      // swallow errors to avoid breaking the physics loop
      console.warn('bounce pad contact handler error', err);
    }
  });
}