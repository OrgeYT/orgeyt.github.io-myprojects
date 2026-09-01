import * as THREE from 'three';

export const PATHS = {
  CARDBOARD: 'texturecardboard.avif',
  SKYBOX: 'skyboxtexture.jpg',
  FACE: 'facey.png'
};

/**
 * Promise-based texture loader with sensible defaults applied.
 * @param {string} url
 * @param {object} [opts] - optional overrides: {srgb:true, flipY:false, wrapRepeat:[x,y]}
 * @returns {Promise<THREE.Texture>}
 */
export function loadTexture(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (tex) => {
        if (opts.srgb !== false) tex.encoding = THREE.sRGBEncoding;
        if (opts.flipY !== undefined) tex.flipY = opts.flipY;
        if (opts.wrapRepeat && Array.isArray(opts.wrapRepeat) && opts.wrapRepeat.length === 2) {
          tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
          tex.repeat.set(opts.wrapRepeat[0], opts.wrapRepeat[1]);
        }
        resolve(tex);
      },
      undefined,
      (err) => reject(err)
    );
  });
}

export async function loadCardboardTexture(opts = {}) {
  // default repeat small so boards look detailed on medium parts
  const tex = await loadTexture(PATHS.CARDBOARD, Object.assign({ srgb: true, flipY: false, wrapRepeat: [2, 2] }, opts));
  return tex;
}

export async function loadSkyboxTexture(opts = {}) {
  const tex = await loadTexture(PATHS.SKYBOX, Object.assign({ srgb: true, flipY: false }, opts));
  return tex;
}

export async function loadFaceTexture(opts = {}) {
  const tex = await loadTexture(PATHS.FACE, Object.assign({ srgb: true, flipY: false }, opts));
  return tex;
}