import * as THREE from 'three';

export function createStudTexture(){
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#555555'; ctx.fillRect(0,0,size,size);
  ctx.fillStyle = '#666666';
  ctx.beginPath(); ctx.arc(size/2, size/2, size*0.3, 0, Math.PI*2); ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  return tex;
}

export function createFaceTexture(){
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f5cd30'; ctx.fillRect(0,0,size,size);
  ctx.fillStyle = '#000000';
  ctx.beginPath(); ctx.arc(size*0.35, size*0.4, 15, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(size*0.65, size*0.4, 15, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#000000'; ctx.lineWidth = 10; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(size/2, size*0.55, 40, 0.2*Math.PI, 0.8*Math.PI); ctx.stroke();
  return new THREE.CanvasTexture(canvas);
}