import { initScene, startRenderLoop, resizeRendererToWindow } from './scene.js';
import { initUI } from './ui.js';
import { initInteractions } from './interactions.js';
import { initRagdoll } from './ragdoll.js';
import { initPhysics } from './physics.js';

(async function main(){
  const { scene, camera, renderer, controls, world, state } = await initScene();
  initPhysics(world, scene, state);
  initRagdoll(world, scene, state);
  initInteractions(camera, renderer.domElement, controls, world, state);
  initUI(camera, controls, world, scene, state);

  // hide loading overlay once initialization is complete
  const loading = document.getElementById('loading-overlay');
  if(loading){
    loading.style.transition = 'opacity 300ms ease';
    loading.style.opacity = '0';
    setTimeout(()=>{ loading.style.display = 'none'; }, 340);
  }

  window.addEventListener('resize', () => {
    resizeRendererToWindow(camera, renderer);
  });

  startRenderLoop({ scene, camera, renderer, controls, world, state });
})();