import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { state } from './state.js';
import { buildMap, createBomb } from './map.js';
import { populateNamesList } from './ui.js';
import { initPreview } from './preview.js';
import { createSky } from './sky.js';

function initScene() {
  state.scene = new THREE.Scene();
  state.scene.background = new THREE.Color(0x7fb6dd);

  state.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 2000);

  state.renderer = new THREE.WebGLRenderer({ antialias: true });
  state.renderer.setSize(window.innerWidth, window.innerHeight);
  state.renderer.shadowMap.enabled = true;
  state.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  state.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  state.renderer.toneMappingExposure = 1.05;
  document.body.appendChild(state.renderer.domElement);

  state.sky = createSky();
  state.scene.add(state.sky);

  const ambient = new THREE.AmbientLight(0xffffff, 0.35);
  state.scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x7aa57f, 0.85);
  state.scene.add(hemi);

  state.dirLight = new THREE.DirectionalLight(0xfff3e0, 1.1);
  state.dirLight.position.set(40, 80, -30);
  state.dirLight.castShadow = true;
  state.dirLight.shadow.mapSize.width = 2048;
  state.dirLight.shadow.mapSize.height = 2048;
  state.dirLight.shadow.camera.near = 1;
  state.dirLight.shadow.camera.far = 300;
  state.scene.add(state.dirLight);

  state.physicsWorld = new CANNON.World({ gravity: new CANNON.Vec3(0, -20, 0) });
  const groundMat = new CANNON.Material();
  state.physicsWorld.addBody(new CANNON.Body({
    mass: 0,
    shape: new CANNON.Plane(),
    material: groundMat,
    quaternion: new CANNON.Quaternion().setFromEuler(-Math.PI/2, 0, 0)
  }));

  buildMap();
  createBomb();
  populateNamesList();
  initPreview();

  window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
  state.camera.aspect = window.innerWidth / window.innerHeight;
  state.camera.updateProjectionMatrix();
  state.renderer.setSize(window.innerWidth, window.innerHeight);
}

export { initScene, onWindowResize };
