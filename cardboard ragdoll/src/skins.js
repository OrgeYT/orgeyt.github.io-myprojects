export function getDefaultPresets(){
  // returns reusable THREE.Material presets (colors only, no THREE import here to keep module small)
  // The UI/importer will create actual THREE materials by mapping these color hexes.
  return {
    yellow: 0xf5cd30,
    blue: 0x3b82f6,
    green: 0x22c55e,
    white: 0xffffff,
    cardboard: 'cardboard',
    gray: 0x9aa0a6,
    darkGray: 0x4b4f54,
    dummy: 'dummy'
  };
}

 // buildMaterialsForSkin(state, skinValue, THREE)
 // Returns an object shaped { head, torso, arms, legs, presets }
 // where each of head/torso/arms/legs is either 'cardboard' or a THREE.Material instance.
 export function buildMaterialsForSkin(state, val, THREE){
   const presetColors = getDefaultPresets();
   // helper to create MeshStandardMaterial only if color value is numeric (hex)
   const makeMaterial = (colorHex) => {
     return new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.9 });
   };

   // small helper to create a canvas-based panel texture with a darker edge (used for dummy skin)
   function makePanelTexture(baseColorHex, edgeColorHex, size = 256){
     const canvas = document.createElement('canvas');
     canvas.width = canvas.height = size;
     const ctx = canvas.getContext('2d');

     // fill base
     const base = '#' + baseColorHex.toString(16).padStart(6, '0');
     const edge = '#' + edgeColorHex.toString(16).padStart(6, '0');
     ctx.fillStyle = base;
     ctx.fillRect(0,0,size,size);

     // draw darker border to simulate darker edges/corners
     const bw = Math.max(6, Math.floor(size * 0.06));
     ctx.strokeStyle = edge;
     ctx.lineWidth = bw;
     ctx.strokeRect(bw/2, bw/2, size - bw, size - bw);

     // subtle vignette / corner shading
     const g = ctx.createLinearGradient(0,0,size,size);
     g.addColorStop(0, 'rgba(0,0,0,0)');
     g.addColorStop(1, 'rgba(0,0,0,0.06)');
     ctx.fillStyle = g;
     ctx.fillRect(0,0,size,size);

     const tex = new THREE.CanvasTexture(canvas);
     tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
     tex.magFilter = THREE.LinearFilter;
     tex.minFilter = THREE.LinearMipMapLinearFilter;
     return tex;
   }

   // helper to create a head decal texture with a plus (+) icon
   function makePlusFaceTexture(bgColorHex=0x9aa0a6, plusColorHex=0x1f1f1f, size=256){
     const canvas = document.createElement('canvas');
     canvas.width = canvas.height = size;
     const ctx = canvas.getContext('2d');
     const bg = '#' + bgColorHex.toString(16).padStart(6, '0');
     const plus = '#' + plusColorHex.toString(16).padStart(6, '0');

     // background (slightly lighter to contrast)
     ctx.fillStyle = bg;
     ctx.fillRect(0,0,size,size);

     // draw white-ish circular face plate
     const plateR = Math.floor(size * 0.48);
     ctx.fillStyle = '#ffffff';
     ctx.beginPath();
     ctx.arc(size/2, size/2, plateR, 0, Math.PI*2);
     ctx.fill();

     // draw plus icon centered
     ctx.strokeStyle = plus;
     ctx.lineWidth = Math.max(8, Math.floor(size * 0.08));
     ctx.lineCap = 'round';
     ctx.beginPath();
     ctx.moveTo(size*0.44, size*0.5);
     ctx.lineTo(size*0.56, size*0.5);
     ctx.moveTo(size*0.5, size*0.44);
     ctx.lineTo(size*0.5, size*0.56);
     ctx.stroke();

     const tex = new THREE.CanvasTexture(canvas);
     tex.flipY = false;
     tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
     tex.magFilter = THREE.LinearFilter;
     tex.minFilter = THREE.LinearMipMapLinearFilter;
     return tex;
   }

   // Allow using previously stored presets (state.materials.presets may have been created earlier)
   const existingPresets = (state.materials && state.materials.presets) ? state.materials.presets : {
     yellow: makeMaterial(presetColors.yellow),
     blue: makeMaterial(presetColors.blue),
     green: makeMaterial(presetColors.green),
     white: makeMaterial(presetColors.white),
     cardboard: 'cardboard',
     gray: makeMaterial(presetColors.gray),
     darkGray: makeMaterial(presetColors.darkGray),
     dummy: 'dummy'
   };

   let newMaterials = {};
   if(val === 'cardboard'){
     newMaterials = { head: 'cardboard', torso: 'cardboard', arms: 'cardboard', legs: 'cardboard', presets: existingPresets };
   } else if(val === 'noob'){
     newMaterials = { head: existingPresets.yellow, torso: existingPresets.blue, arms: existingPresets.yellow, legs: existingPresets.green, presets: existingPresets };
   } else if(val === 'boon'){
     newMaterials = { head: existingPresets.green, torso: existingPresets.blue, arms: existingPresets.blue, legs: existingPresets.yellow, presets: existingPresets };
   } else if(val === 'white'){
     newMaterials = { head: existingPresets.white, torso: existingPresets.white, arms: existingPresets.white, legs: existingPresets.white, presets: existingPresets };
   } else if(val === 'dummy'){
     // create canvas-backed materials: base gray with darker border/edge feel
     const baseGray = presetColors.gray || 0x9aa0a6;
     const edgeGray = presetColors.darkGray || 0x4b4f54;
     // panel textures for boxes (arms/torso/legs)
     const panelTex = makePanelTexture(baseGray, edgeGray, 256);
     const panelMatParams = { map: panelTex, roughness: 0.92, metalness: 0.02 };
     const panelMat = new THREE.MeshStandardMaterial(panelMatParams);

     // For head: create a decal-like face with a plus icon and use it as a map on a slightly lighter material
     const faceTex = makePlusFaceTexture(baseGray, 0x1f1f1f, 256);
     const headMat = new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.9, metalness: 0 });

     // also expose presets so other skins can reuse gray colors if needed
     const presets = Object.assign({}, existingPresets, {
       gray: new THREE.MeshStandardMaterial({ color: baseGray, roughness: 0.9 }),
       darkGray: new THREE.MeshStandardMaterial({ color: edgeGray, roughness: 0.9 })
     });

     newMaterials = {
       head: headMat,
       torso: panelMat,
       arms: panelMat,
       legs: panelMat,
       presets
     };
   } else {
     newMaterials = { head: 'cardboard', torso: 'cardboard', arms: 'cardboard', legs: 'cardboard', presets: existingPresets };
   }

   return newMaterials;
 }