import * as THREE from 'three';
import { state } from './state.js';
import { R6_MODEL_DATA } from './constants.js';
import { buildHat, createFaceTexture } from './map.js';

function initPreview() {
  const container = document.getElementById('preview-3d');
  state.previewScene = new THREE.Scene();

  const amb = new THREE.AmbientLight(0xffffff, 0.6);
  state.previewScene.add(amb);
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(5, 10, 5);
  state.previewScene.add(dir);

  state.previewCamera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  state.previewCamera.position.set(0, 2, 8);

  state.previewRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  state.previewRenderer.setSize(192, 192);
  container.appendChild(state.previewRenderer.domElement);

  state.previewGroup = new THREE.Group();
  state.previewScene.add(state.previewGroup);
  updatePreview();
}

function updatePreview() {
  while(state.previewGroup.children.length > 0){ state.previewGroup.remove(state.previewGroup.children[0]); }

  const bodyColor = document.getElementById('edit-body-color').value;
  const headArmColor = document.getElementById('edit-head-color').value;
  const legColor = document.getElementById('edit-leg-color').value;
  const hatType = document.getElementById('edit-hat').value;
  const hatColor = document.getElementById('edit-hat-color').value;
  const eyeColor = document.getElementById('edit-eye-color').value;

  const bodyMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(bodyColor), roughness: 0.4 });
  const eyeGeo = new THREE.SphereGeometry(0.3, 16, 16);
  eyeGeo.scale(1, 2, 0.4);
  const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(eyeColor) });

  let headAnchor = null;

  if (state.isRobloxMode) {
    const robloxGroup = new THREE.Group();
    robloxGroup.scale.setScalar(0.75); // Scaled up
    robloxGroup.position.y = 0; // Adjusted grounding offset
    const yOffset = -0.07; // Grounding offset

    for (const key in R6_MODEL_DATA) {
      const part = R6_MODEL_DATA[key];
      let matColor;
      if (part.type === 'torso') matColor = new THREE.Color(bodyColor);
      else if (part.type === 'head' || part.type === 'arm') matColor = new THREE.Color(headArmColor);
      else if (part.type === 'leg') matColor = new THREE.Color(legColor);
      else matColor = new THREE.Color(part.color);

      const mat = new THREE.MeshStandardMaterial({ color: matColor, roughness: 0.4 });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
      mesh.scale.set(part.sx, part.sy, part.sz);

      const pivot = new THREE.Group();
      pivot.position.set(part.px, part.py + yOffset, part.pz);

      if (part.type === 'arm') {
        mesh.position.y = -part.sy / 2 + 0.2;
        pivot.position.y += part.sy / 2 - 0.2;
      } else if (part.type === 'leg') {
        mesh.position.y = -part.sy / 2;
        pivot.position.y += part.sy / 2;
      } else if (part.type === 'head') {
        headAnchor = pivot;
        const faceTex = createFaceTexture(new THREE.Color(eyeColor).getStyle());
        const faceMat = new THREE.MeshBasicMaterial({ map: faceTex, transparent: true });
        const faceMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.72), faceMat);
        faceMesh.position.set(0, 0.1, 0.52);
        faceMesh.renderOrder = 2;
        pivot.add(faceMesh);
      }

      pivot.add(mesh);
      robloxGroup.add(pivot);
    }

    state.previewGroup.add(robloxGroup);
  } else {
    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), bodyMat);
    bodyMesh.position.y = 1;
    state.previewGroup.add(bodyMesh);
    headAnchor = bodyMesh; // Hat goes on body

    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.4, 1.2, 1.05);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.4, 1.2, 1.05);
    state.previewGroup.add(leftEye, rightEye);
  }

  const myHat = buildHat(hatType, hatColor);
  if (myHat) {
    myHat.position.y = state.isRobloxMode ? 0.55 : 1;
    headAnchor.add(myHat);
  }

  state.previewGroup.scale.setScalar(1.5);
  state.previewGroup.position.y = -1.5;
}

export { initPreview, updatePreview };
