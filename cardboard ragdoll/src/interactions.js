import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export function initInteractions(camera, canvas, controls, world, state){
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  canvas.addEventListener('mousedown', (e)=>{
    if(e.button !== 0) return;
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const targetMeshes = [...state.parts.map(p=>p.mesh), ...state.mapMeshes];
    const intersects = raycaster.intersectObjects(targetMeshes);
    if(intersects.length > 0){
      const hitMesh = intersects[0].object;
      const hitPoint = intersects[0].point;
      const part = state.parts.find(p=>p.mesh === hitMesh);
      const grabbedBody = part ? part.body : state.mapBodies[state.mapMeshes.indexOf(hitMesh)];
      if(grabbedBody){
        state.grabbed.body = grabbedBody;
        state.jointBody.position.copy(hitPoint);
        const localOffset = grabbedBody.pointToLocalFrame(new CANNON.Vec3(hitPoint.x, hitPoint.y, hitPoint.z));
        const constraint = new CANNON.PointToPointConstraint(grabbedBody, localOffset, state.jointBody, new CANNON.Vec3(0,0,0));
        world.addConstraint(constraint);
        state.grabbed.constraint = constraint;
        controls.enabled = false;
      }
    }
  });

  window.addEventListener('mousemove', (e)=>{
    if(!state.grabbed.constraint) return;
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    const vector = new THREE.Vector3(mouse.x, mouse.y, 0.5).unproject(camera);
    const dir = vector.sub(camera.position).normalize();
    const grabbedPos = state.grabbed.body.position;
    const distance = camera.position.distanceTo(grabbedPos);
    const pos = camera.position.clone().add(dir.multiplyScalar(distance));
    state.jointBody.position.set(pos.x, pos.y, pos.z);
  });

  window.addEventListener('mouseup', ()=>{
    if(state.grabbed.constraint){
      world.removeConstraint(state.grabbed.constraint);
      state.grabbed.constraint = null;
      state.grabbed.body = null;
      controls.enabled = true;
    }
  });

  // keyboard for free camera and R toggle
  window.addEventListener('keydown', (e)=>{
    const key = e.key.toLowerCase();
    state.keys[key] = true;
    if(key === 'r'){ // toggle standing
      state.isStanding = !state.isStanding;
      const btn = document.getElementById('btn-stand');
      if(btn){ btn.textContent = state.isStanding ? 'Stand: ON' : 'Stand: OFF'; btn.classList.toggle('toggle-active', state.isStanding); }
    }
  });
  window.addEventListener('keyup',(e)=>{ state.keys[e.key.toLowerCase()] = false; });

  // freecam movement loop (applies when not following)
  function freecamTick(){
    requestAnimationFrame(freecamTick);
    if(!state.isFollowing){
      const moveSpeed = 0.5;
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const right = new THREE.Vector3().crossVectors(camera.up, dir).normalize();
      const forward = new THREE.Vector3().crossVectors(right, camera.up).normalize();
      const moveVec = new THREE.Vector3(0,0,0);
      if(state.keys.w) moveVec.add(forward);
      if(state.keys.s) moveVec.sub(forward);
      if(state.keys.a) moveVec.add(right);
      if(state.keys.d) moveVec.sub(right);
      if(state.keys.q) moveVec.y -= 1;
      if(state.keys.e) moveVec.y += 1;
      if(moveVec.lengthSq()>0){
        moveVec.normalize().multiplyScalar(moveSpeed);
        camera.position.add(moveVec);
        controls.target.add(moveVec);
      }
    }
  }
  freecamTick();
}