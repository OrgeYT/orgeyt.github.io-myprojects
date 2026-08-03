import * as THREE from 'three';

export function createSky() {
  const geo = new THREE.SphereGeometry(900, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: true,
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vWorld = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vWorld;
      void main() {
        float h = max(vWorld.y, 0.0);
        vec3 horizon = vec3(0.62, 0.80, 0.92);
        vec3 zenith = vec3(0.24, 0.52, 0.95);
        vec3 low = vec3(0.78, 0.88, 0.96);
        vec3 color = mix(low, horizon, smoothstep(0.0, 0.25, h));
        color = mix(color, zenith, smoothstep(0.25, 0.9, h));
        gl_FragColor = vec4(color, 1.0);
      }
    `
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -1;
  mesh.name = 'sky';
  return mesh;
}
