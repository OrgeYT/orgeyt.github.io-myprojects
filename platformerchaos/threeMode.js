import * as THREE from 'three';
import { OrbitControls } from 'three/examples/OrbitControls';

export class ThreeMode {
  constructor(canvas2D, game) {
    this.canvas2D = canvas2D;
    this.game = game;
    this.enabled = false;
    this._container = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.controls = null;
    this._animReq = null;
    this._meshes = [];
    this._hud = null;
    // chase ghost mesh for 3D chaseMode visualization
    this._chaseMesh = null;
    // whether the 3D orbit camera should auto-follow the player mesh;
    // when false the 3D camera stays where the user left it (normal 3D camera)
    this._followPlayer = true;

    // sphere field for background "white spheres everywhere" effect
    this._sphereGroup = null;
    this._spheres = []; // lightweight records for repositioning
    this._sphereCount = 80; // far fewer spheres so they aren't too dense
    this._sphereFieldRadius = 1400; // radius around player in which spheres live
  }

  // Control whether the 3D camera should follow the player mesh updates.
  setFollowCamera(enabled) {
    this._followPlayer = !!enabled;
  }

  // Enable 3D view: build scene from platforms and player
  async enable(platforms = [], player = null, opts = {}) {
    if (this.enabled) return;
    this.enabled = true;

    // Create container overlay
    this._container = document.createElement('div');
    Object.assign(this._container.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      width: '100vw',
      height: '100vh',
      zIndex: 10001,
      pointerEvents: 'auto',
      background: '#000'
    });
    document.body.appendChild(this._container);

    // Hide the 2D canvas visually to avoid double-draw (but keep it for state)
    try { this.canvas2D.style.visibility = 'hidden'; } catch (e) {}

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this._container.appendChild(this.renderer.domElement);

    // Add a small HUD so UI is available in 3D mode (Exit + hint)
    this._hud = document.createElement('div');
    Object.assign(this._hud.style, {
      position: 'absolute',
      left: '12px',
      top: '12px',
      zIndex: 10002,
      color: '#fff',
      fontFamily: 'Arial, sans-serif',
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
      pointerEvents: 'auto'
    });

    const exitBtn = document.createElement('button');
    exitBtn.textContent = 'Exit 3D';
    Object.assign(exitBtn.style, {
      padding: '8px 12px',
      borderRadius: '8px',
      border: 'none',
      background: '#b71c1c',
      color: '#fff',
      cursor: 'pointer'
    });
    exitBtn.addEventListener('click', () => {
      // trigger game toggle so it cleans up state in Game
      try {
        if (this.game && typeof this.game.toggle3D === 'function') {
          this.game.toggle3D();
        } else {
          this.disable();
          if (this.game) this.game.threeActive = false;
        }
      } catch (e) { console.warn('Exit 3D failed', e); }
    });

    const hint = document.createElement('div');
    hint.textContent = 'Rotate: drag • Zoom: wheel';
    Object.assign(hint.style, {
      padding: '8px 10px',
      borderRadius: '8px',
      background: 'rgba(0,0,0,0.4)',
      color: '#fff',
      fontSize: '13px'
    });

    this._hud.appendChild(exitBtn);
    this._hud.appendChild(hint);

    // Flip camera button: rotate camera 180° around target horizontally while preserving upright orientation.
    const flipBtn = document.createElement('button');
    flipBtn.textContent = 'Flip Camera';
    Object.assign(flipBtn.style, {
      padding: '8px 12px',
      borderRadius: '8px',
      border: 'none',
      background: '#455a64',
      color: '#fff',
      cursor: 'pointer'
    });
    flipBtn.addEventListener('click', () => {
      try {
        this.flipCamera();
      } catch (e) { console.warn('Flip camera failed', e); }
    });
    this._hud.appendChild(flipBtn);

    this._container.appendChild(this._hud);

    // Scene & camera
    // Create scene
    this.scene = new THREE.Scene();

    // Build a stylized layered background that mirrors the 2D parallax layers but in 3D.
    // We'll create three large distant planes with CanvasTexture: far tiled image, mid green-square grid, near soft gradient/circles.
    const makeCanvasTexture = (drawFn, w = 1024, h = 1024) => {
      const cvs = document.createElement('canvas');
      cvs.width = w;
      cvs.height = h;
      const cx = cvs.getContext('2d');
      try { drawFn(cx, w, h); } catch (e) { /* draw fail safe */ }
      const tex = new THREE.CanvasTexture(cvs);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(1, 1);
      tex.needsUpdate = true;
      return tex;
    };

    // far: faint tiled image (uses same screenshot asset if available else subtle noise)
    const farTex = makeCanvasTexture((cx, w, h) => {
      // try to draw the screenshot image if it's loaded in DOM
      const img = document.querySelector('img[src$="Screenshot 2026-03-07 173627.png"]') || null;
      if (img && img.complete && img.naturalWidth) {
        // tile the image across canvas
        const iw = img.naturalWidth;
        const ih = img.naturalHeight;
        for (let x = 0; x < w; x += iw) for (let y = 0; y < h; y += ih) cx.drawImage(img, x, y, iw, ih);
        cx.globalAlpha = 0.6;
      } else {
        // fallback: subtle noise + radial texture
        cx.fillStyle = '#0e1113';
        cx.fillRect(0,0,w,h);
        for (let i = 0; i < 1200; i++) {
          const x = Math.random() * w, y = Math.random() * h, a = Math.random() * 0.06;
          cx.fillStyle = `rgba(255,255,255,${a})`;
          cx.fillRect(x, y, 1, 1);
        }
      }
    }, 1024, 1024);

    // mid: green square grid
    const midTex = makeCanvasTexture((cx, w, h) => {
      cx.clearRect(0,0,w,h);
      cx.fillStyle = 'rgba(34,139,34,0.12)';
      const size = 120, gap = 180;
      for (let x = -gap; x < w + gap; x += gap) {
        for (let y = -gap; y < h + gap; y += gap) {
          const ox = x + ((x / gap) % 3) * 6;
          const oy = y + ((y / gap) % 2) * 12;
          cx.fillRect(ox, oy, size, size);
        }
      }
    }, 1024, 1024);

    // near: soft gradient with subtle circles
    const nearTex = makeCanvasTexture((cx, w, h) => {
      const g = cx.createLinearGradient(0,0,0,h);
      g.addColorStop(0, 'rgba(20,24,28,0.94)');
      g.addColorStop(1, 'rgba(48,48,52,0.96)');
      cx.fillStyle = g;
      cx.fillRect(0,0,w,h);
      cx.fillStyle = 'rgba(255,255,255,0.03)';
      for (let i = 0; i < 6; i++) {
        const cxp = ((i * 311) % w) + (Math.sin(i*0.7) * 40);
        const cyp = ((i * 197) % h) + (Math.cos(i*0.9) * 30);
        const r = 160 + ((i * 43) % 100);
        cx.beginPath();
        cx.arc(cxp, cyp, r, 0, Math.PI * 2);
        cx.fill();
      }
    }, 1024, 1024);

    // Create distant planes and place them far away on the Z axis, set to render before scene objects by depth (back-to-front)
    const bgGroup = new THREE.Group();

    // helper to make a large plane mesh using a texture, placed at z and with slight parallax movement factor in user-controlled update
    const makeBgPlane = (tex, dist = -1200, scale = 6, opacity = 1, rotationY = 0) => {
      const geo = new THREE.PlaneGeometry(2000 * scale, 1200 * scale);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(0, 0, dist);
      mesh.rotation.y = rotationY;
      mesh.renderOrder = 0; // keep behind
      mesh.frustumCulled = false;
      return mesh;
    };

    const farPlane = makeBgPlane(farTex, -2200, 6, 0.7);
    const midPlane = makeBgPlane(midTex, -1600, 4.2, 0.9);
    const nearPlane = makeBgPlane(nearTex, -1000, 2.6, 1.0);

    // Slight rotations and offsets to make 3D feel deeper
    farPlane.rotation.y = 0.02;
    midPlane.rotation.y = -0.04;
    nearPlane.rotation.y = 0.01;
    farPlane.position.y = 40;
    midPlane.position.y = 10;
    nearPlane.position.y = -10;

    bgGroup.add(farPlane);
    bgGroup.add(midPlane);
    bgGroup.add(nearPlane);

    // fog removed to keep a clear 3D background (previously used THREE.FogExp2)

    // Add the bg group to the scene (behind all objects)
    this.scene.add(bgGroup);

    // store background planes for runtime parallax tweaks from the render loop
    this._bgPlanes = { farPlane, midPlane, nearPlane, group: bgGroup };

    // Use the screenshot as a simple skybox (applied to all faces for a consistent stylized backdrop).
    try {
      const loader = new THREE.TextureLoader();
      const imgPath = 'Screenshot 2026-03-07 173627.png';
      // create a darkened canvas-based texture so the screenshot appears darker in 3D mode
      try {
        const img = await new Promise((resolve, reject) => {
          const image = new Image();
          image.src = imgPath;
          image.crossOrigin = 'anonymous';
          image.onload = () => resolve(image);
          image.onerror = (err) => reject(err);
        });

        // draw the image to a canvas and apply a semi-transparent black overlay to darken it
        const cvs = document.createElement('canvas');
        const iw = Math.max(256, img.naturalWidth);
        const ih = Math.max(256, img.naturalHeight);
        cvs.width = iw;
        cvs.height = ih;
        const cx = cvs.getContext('2d');
        cx.drawImage(img, 0, 0, iw, ih);
        // apply a stronger darkening layer so the screenshot reads darker in 3D
        cx.fillStyle = 'rgba(0,0,0,0.65)';
        cx.fillRect(0, 0, iw, ih);

        const darkTex = new THREE.CanvasTexture(cvs);
        darkTex.wrapS = darkTex.wrapT = THREE.RepeatWrapping;
        darkTex.repeat.set(1, 1);
        darkTex.needsUpdate = true;
        this.scene.background = darkTex;
      } catch (e) {
        // fallback: try to load normally and then tint via material fallback
        try {
          const tex = loader.load(imgPath);
          tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
          tex.repeat.set(1, 1);
          // If loader returned a texture, use it but darken scene ambient by lowering hemisphere intensity later
          this.scene.background = tex;
        } catch (e2) {
          this.scene.background = new THREE.Color(0x0f1113);
        }
      }
    } catch (e) {
      // fallback color if texture fails
      this.scene.background = new THREE.Color(0x0f1113);
    }

    // Add a subtle exponential fog to give depth (not too much)
    try {
      this.scene.fog = new THREE.FogExp2(0x0f1113, 0.00055);
    } catch (e) {
      // ignore
    }

    // Create a dynamic field of small white spheres that will be re-positioned around the player as they move.
    // We keep a group of meshes and recycle them each frame to give the impression of infinite spheres.
    try {
      this._sphereGroup = new THREE.Group();
      // Make spheres larger and semi-transparent so they are visible but not overpowering.
      // larger but much fewer and fainter spheres for a subtle effect
      const sphereGeo = new THREE.SphereGeometry(18, 12, 10);
      const sphereMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false });
      // generate initial positions around origin; they will be relocated relative to player in the loop
      for (let i = 0; i < this._sphereCount; i++) {
        const s = new THREE.Mesh(sphereGeo, sphereMat);
        // random spherical distribution within radius
        const r = Math.random() * this._sphereFieldRadius * 0.95;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        s.position.x = Math.cos(theta) * Math.sin(phi) * r;
        s.position.y = (Math.random() - 0.5) * 600; // vertical scatter
        s.position.z = Math.sin(theta) * Math.sin(phi) * r;
        s.material = sphereMat;
        s.frustumCulled = false;
        this._sphereGroup.add(s);
        this._spheres.push(s);
      }
      // place group behind scene objects (a modest offset so spheres appear around camera)
      this._sphereGroup.position.y = 0;
      this.scene.add(this._sphereGroup);
    } catch (e) {
      // ignore sphere generation failures
      console.warn('sphere field init failed', e);
    }

    // state for flip (false = normal, true = flipped 180°)
    this._flipped = false;

    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(55, aspect, 0.1, 10000);
    this.camera.position.set(0, 200, 600);
    // keep camera upright (no Z-roll) for correct orientation
    this.camera.rotation.z = 0;

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    // Ensure world up is the Y axis
    this.camera.up.set(0, 1, 0);

    // Third-person orbit setup:
    // - Disable panning so orbit stays centered on player
    // - Disable damping for immediate, non-smoothed response (third-person immediate feel)
    // - Allow user rotation via drag and zoom with wheel
    this.controls.enableRotate = true;
    // Allow panning so the user has full free-camera control in 3D mode
    this.controls.enablePan = true;
    this.controls.enableZoom = true;
    this.controls.rotateSpeed = 1.2;
    // Enable damping for a smoother, free-rotation feel
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;

    // Allow full vertical rotation (no artificial clamp) so the camera can rotate freely.
    // Still keep world up consistent to avoid roll accumulation.
    this.controls.minPolarAngle = 0;        // allow looking fully down
    this.controls.maxPolarAngle = Math.PI;  // allow looking fully up

    // Allow unlimited horizontal rotation (full 360° and continuous spinning).
    // OrbitControls treats `null` as no limit; use +/- Infinity for clarity.
    this.controls.minAzimuthAngle = -Infinity;
    this.controls.maxAzimuthAngle = Infinity;

    // Keep panning in world-space so touch/drag feels natural when panning is used
    this.controls.screenSpacePanning = true;

    // Lights
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    hemi.position.set(0, 400, 0);
    this.scene.add(hemi);

    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(-200, 400, 300);
    dir.castShadow = true;
    dir.shadow.camera.left = -500;
    dir.shadow.camera.right = 500;
    dir.shadow.camera.top = 500;
    dir.shadow.camera.bottom = -500;
    dir.shadow.mapSize.set(1024, 1024);
    this.scene.add(dir);



    // Convert 2D platforms to 3D boxes
    const platformGroup = new THREE.Group();
    for (const p of platforms) {
      if (!p) continue;
      // Determine depth and height mapping: use width -> x, height -> y, z thickness small
      const w = Math.max(4, p.width);
      const h = Math.max(4, p.height);
      const depth = Math.max(8, Math.min(120, Math.round((w + h) * 0.08)));

      const geo = new THREE.BoxGeometry(w, depth, h);
      // color mapping fallback
      const color = (p.color || '#666666').replace('#','0x');
      const mat = new THREE.MeshStandardMaterial({ color: parseInt(color) || 0x333333, metalness: 0.1, roughness: 0.8 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      // Map 2D coords to 3D: x = platform.x, z = platform.y (invert y so screen-up becomes 3D-up), y = thickness/2 * -1
      // Use a scale factor to make the world comfortable
      const scale = 1;
      // Mirror X coordinate so the 3D scene is horizontally mirrored relative to the 2D layout
      mesh.position.x = - (p.x + w / 2 - (this.game.viewWidth/2 || window.innerWidth/2)) * scale;
      // Invert vertical axis and offset so platforms appear near center
      mesh.position.z = - (p.y + h / 2 - (this.game.viewHeight/2 || window.innerHeight/2)) * scale;
      mesh.position.y = 0; // place around y=0 plane
      platformGroup.add(mesh);
      this._meshes.push(mesh);
    }
    this.scene.add(platformGroup);

    // Add player mesh: use a textured box/sphere that mirrors the 2D look (gradient + rotated face)
    if (player) {
      // helper: create a canvas texture matching the 2D player's gradient rounded rect and rotated face
      const makePlayerTexture = (w = 256, h = 384, faceText = ':)') => {
        const cvs = document.createElement('canvas');
        cvs.width = w;
        cvs.height = h;
        const cx = cvs.getContext('2d');

        // clear
        cx.clearRect(0,0,w,h);

        // create wide horizontal rainbow gradient similar to 2D
        const grad = cx.createLinearGradient(0, 0, w, 0);
        grad.addColorStop(0.0, '#ff3b3b');
        grad.addColorStop(0.2, '#ff8a00');
        grad.addColorStop(0.4, '#ffd400');
        grad.addColorStop(0.6, '#4caf50');
        grad.addColorStop(0.8, '#2196f3');
        grad.addColorStop(1.0, '#9c27b0');

        // rounded rect background
        const r = Math.max(8, Math.round(Math.min(w, h) * 0.06));
        cx.fillStyle = grad;
        cx.beginPath();
        cx.moveTo(r, 0);
        cx.lineTo(w - r, 0);
        cx.quadraticCurveTo(w, 0, w, r);
        cx.lineTo(w, h - r);
        cx.quadraticCurveTo(w, h, w - r, h);
        cx.lineTo(r, h);
        cx.quadraticCurveTo(0, h, 0, h - r);
        cx.lineTo(0, r);
        cx.quadraticCurveTo(0, 0, r, 0);
        cx.closePath();
        cx.fill();

        // subtle inner inset
        cx.globalAlpha = 0.95;
        cx.fillStyle = 'rgba(0,0,0,0.06)';
        cx.fillRect(4,4,w-8,h-8);
        cx.globalAlpha = 1;

        // Draw face rotated 90deg clockwise: we'll draw rotated text near center
        cx.save();
        cx.translate(w/2, h/2);
        cx.rotate(Math.PI / 2);
        cx.fillStyle = '#000';
        // size relative to height similar to 2D
        const fontSize = Math.max(24, Math.round(h * 0.28));
        cx.font = `${fontSize}px Arial`;
        cx.textAlign = 'center';
        cx.textBaseline = 'middle';
        cx.fillText(faceText, 0, 0);
        cx.restore();

        const tex = new THREE.CanvasTexture(cvs);
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.needsUpdate = true;
        return tex;
      };

      // helper to build a player mesh based on current visual shape using canvas texture
      const buildPlayerMesh = (shapePlayer) => {
        // dispose old mesh if present
        if (this._playerMesh) {
          try {
            this.scene.remove(this._playerMesh);
            if (this._playerMesh.geometry) this._playerMesh.geometry.dispose();
            if (this._playerMesh.material) {
              if (this._playerMesh.material.map) this._playerMesh.material.map.dispose();
              this._playerMesh.material.dispose();
            }
          } catch (e) {}
          this._playerMesh = null;
        }

        // create a texture sized proportionally to player's visual rect
        const tw = Math.max(128, Math.round((shapePlayer.width || player.width) * 4));
        const th = Math.max(160, Math.round((shapePlayer.height || player.height) * 4));
        const texture = makePlayerTexture(tw, th, ':)');

        // use MeshBasicMaterial so texture colors remain faithful (no heavy lighting tint)
        const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
        mat.depthTest = true;

        if ((shapePlayer && shapePlayer.shape) === 'ball') {
          const radius = Math.max(6, Math.min(shapePlayer.width, shapePlayer.height) / 2);
          const geo = new THREE.SphereGeometry(radius, 32, 24);
          const mesh = new THREE.Mesh(geo, mat);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          this._playerMeshType = 'ball';
          this._playerMesh = mesh;
        } else {
          // box geometry should show the front face texture; we map UVs so front gets the canvas texture
          const geo = new THREE.BoxGeometry(shapePlayer.width || player.width, (shapePlayer.height || player.height) * 0.6, shapePlayer.height || player.height);
          // adjust UVs so the long horizontal texture maps primarily to front face
          // (Front face is 4th group in BoxGeometry UV ordering in three.js; we'll rely on default mapping being acceptable)
          const mesh = new THREE.Mesh(geo, mat);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          this._playerMeshType = 'box';
          this._playerMesh = mesh;
        }

        // Mirror and position to match 2D -> 3D mapping used for platforms above
        this._playerMesh.position.x = -((shapePlayer.x - (this.game.viewWidth/2 || window.innerWidth/2)) + (shapePlayer.width || player.width)/2);
        this._playerMesh.position.z = - (shapePlayer.y - (this.game.viewHeight/2 || window.innerHeight/2)) - (shapePlayer.height || player.height)/2;
        this._playerMesh.position.y = (shapePlayer.height || player.height) * 0.3;

        this.scene.add(this._playerMesh);
      };

      // build initial player mesh according to current player.shape
      buildPlayerMesh(player);

      // Create a chase ghost mesh if chase data exists on the game so the chaser appears in 3D
      try {
        if (!this._chaseMesh) {
          // Build a canvas-textured chase appearance matching the 2D look (rainbow gradient + angry face)
          const chaseTex = makePlayerTexture(Math.max(128, player.width * 4), Math.max(160, player.height * 4), '>:(');
          chaseTex.minFilter = THREE.LinearFilter;
          chaseTex.magFilter = THREE.LinearFilter;
          chaseTex.needsUpdate = true;

          // store chase texture/material so updates can reuse them
          this._chaseTexture = chaseTex;
          this._chaseMaterial = new THREE.MeshBasicMaterial({ map: this._chaseTexture, color: 0xcc6666, transparent: true });

          // Create geometry sized to the player visual and build mesh
          const cgeo = new THREE.BoxGeometry(player.width, player.height * 0.6, player.height);
          const cmesh = new THREE.Mesh(cgeo, this._chaseMaterial);
          cmesh.castShadow = true;
          cmesh.receiveShadow = true;

          // start hidden off-scene; position will be updated during loop if chase frames exist
          cmesh.visible = false;
          this._chaseMesh = cmesh;
          this.scene.add(this._chaseMesh);
        }
      } catch (e) {
        // don't let chase mesh failure break 3D enable
        console.warn('create chase mesh failed', e);
      }
    }

    // Fit camera to scene roughly around player/cameraX if provided
    if (opts && typeof opts.cameraX !== 'undefined') {
      // attempt to center camera on the passed cameraX/cameraY world offset
      const camWorldX = -opts.cameraX || 0;
      const camWorldY = -opts.cameraY || 0;
      this.controls.target.set(camWorldX, 0, camWorldY);
      this.camera.position.set(camWorldX + 0, 300, camWorldY + 600);
      // ensure the camera has no Z-roll after repositioning so the view stays upright
      this.camera.rotation.z = 0;
      this.controls.update();
      // NOTE: we intentionally avoid direct quaternion flips here to keep the camera orientation consistent
    }

    // Handle resize
    this._onResize = () => {
      if (!this.renderer) return;
      this.camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', this._onResize);

    // Helper to flip the camera 180° horizontally around the current controls.target
    this.flipCamera = () => {
      if (!this.camera || !this.controls) return;
      // toggle flip state
      this._flipped = !this._flipped;

      // compute horizontal vector from target to camera (XZ plane)
      const tgt = this.controls.target.clone();
      const camPos = this.camera.position.clone();

      // vector from target to camera
      const v = new THREE.Vector3().subVectors(camPos, tgt);
      // rotate v by 180° around Y (invert X and Z)
      v.x = -v.x;
      v.z = -v.z;

      // set new camera position and ensure upright orientation
      this.camera.position.copy(tgt).add(v);
      this.camera.up.set(0, 1, 0);
      // update controls so internal state matches new camera position
      this.controls.update();
    };

    // Start render loop
    const loop = () => {
      if (!this.enabled) return;

      // If a player exists, compute its 3D-centered position and make the controls target follow it.
      try {
        if (this.game && this.game.player) {
          const pl = this.game.player;
          // compute player-centered world coords used by the 3D mapping
          // Mirror player's computed world X so camera target follows mirrored positions
          const px = - (pl.x + pl.width / 2 - (this.game.viewWidth / 2 || window.innerWidth / 2));
          const pz = - (pl.y + pl.height / 2 - (this.game.viewHeight / 2 || window.innerHeight / 2));

          // Keep the player mesh synced
          if (this._playerMesh) {
            this._playerMesh.position.x = px;
            this._playerMesh.position.z = pz;
          }

          // Keep player2 mesh synced (if present) - create a lightweight mesh lazily if needed
          try {
            if (this.game && this.game.player2) {
              const p2 = this.game.player2;
              const p2px = - (p2.x + p2.width / 2 - (this.game.viewWidth / 2 || window.innerWidth / 2));
              const p2pz = - (p2.y + p2.height / 2 - (this.game.viewHeight / 2 || window.innerHeight / 2));
              // create a simple textured box for player2 the first time it's needed
              if (!this._player2Mesh) {
                try {
                  const tw = Math.max(128, Math.round((p2.width || 40) * 3));
                  const th = Math.max(160, Math.round((p2.height || 60) * 3));
                  const tex = makePlayerTexture(tw, th, (p2.face || ':D'));
                  tex.minFilter = THREE.LinearFilter;
                  tex.magFilter = THREE.LinearFilter;
                  tex.needsUpdate = true;
                  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
                  const geo = new THREE.BoxGeometry(p2.width || 40, (p2.height || 60) * 0.6, p2.height || 60);
                  const mesh = new THREE.Mesh(geo, mat);
                  mesh.castShadow = true;
                  mesh.receiveShadow = true;
                  this._player2Mesh = mesh;
                  this._player2Mesh.userData._tex = tex;
                  this.scene.add(this._player2Mesh);
                } catch (e) {
                  // fallback: create a simple colored box
                  try {
                    const geo = new THREE.BoxGeometry(p2.width || 40, (p2.height || 60) * 0.6, p2.height || 60);
                    const mat = new THREE.MeshBasicMaterial({ color: 0x8d6e63 });
                    const mesh = new THREE.Mesh(geo, mat);
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;
                    this._player2Mesh = mesh;
                    this.scene.add(this._player2Mesh);
                  } catch (err) { /* ignore */ }
                }
              }
              if (this._player2Mesh) {
                this._player2Mesh.position.x = p2px;
                this._player2Mesh.position.z = p2pz;
                this._player2Mesh.position.y = (p2.height || 60) * 0.3;
              }
            }
          } catch (e) {
            // swallow player2 mesh sync errors
          }

          // Keep the chase ghost mesh synced if present and game has chase state
          try {
            if (this._chaseMesh && this.game && this.game.chase && this.game.chase.ghost) {
              const g = this.game.chase.ghost;
              if (g && g.active) {
                // show and place the chase mesh mirroring the same mapping as player mesh
                this._chaseMesh.visible = true;
                const cw = g.width || (this.game.player && this.game.player.width) || 40;
                const ch = g.height || (this.game.player && this.game.player.height) || 60;
                // if size differs, update geometry
                if (this._chaseMesh) {
                  // safe recreate geometry when sizes change noticeably
                  try {
                    const geoParams = (this._chaseMesh.geometry && this._chaseMesh.geometry.parameters) ? this._chaseMesh.geometry.parameters : null;
                    const needRecreate = !geoParams || Math.abs((geoParams.width || 0) - cw) > 1 || Math.abs((geoParams.depth || 0) - ch) > 1 || Math.abs((geoParams.height || 0) - (ch * 0.6)) > 1;

                    if (needRecreate) {
                      // remove old mesh but keep material/texture if available
                      const oldMat = this._chaseMesh.material || this._chaseMaterial;
                      try {
                        this.scene.remove(this._chaseMesh);
                        if (this._chaseMesh.geometry) this._chaseMesh.geometry.dispose();
                      } catch (e) {}
                      const newGeo = new THREE.BoxGeometry(cw, ch * 0.6, ch);
                      // reuse stored chase material if present; otherwise create a textured one
                      let mat = oldMat;
                      if (!mat) {
                        if (this._chaseTexture) {
                          mat = new THREE.MeshBasicMaterial({ map: this._chaseTexture, color: 0xcc6666, transparent: true });
                        } else {
                          mat = new THREE.MeshBasicMaterial({ color: 0xcc6666 });
                        }
                        this._chaseMaterial = mat;
                      }
                      const newMesh = new THREE.Mesh(newGeo, mat);
                      newMesh.castShadow = true;
                      newMesh.receiveShadow = true;
                      newMesh.visible = true;
                      this._chaseMesh = newMesh;
                      this.scene.add(this._chaseMesh);
                    }
                    // ensure material exists: if material lost, recreate from stored texture
                    if (!this._chaseMesh.material && this._chaseTexture) {
                      this._chaseMesh.material = new THREE.MeshBasicMaterial({ map: this._chaseTexture, color: 0xcc6666, transparent: true });
                      this._chaseMaterial = this._chaseMesh.material;
                    }
                  } catch(e) {
                    // swallow geometry/material recreation errors
                  }
                  // update position and size mapping
                  try {
                    this._chaseMesh.position.x = -((g.x - (this.game.viewWidth/2 || window.innerWidth/2)) + (g.width || cw) / 2);
                    this._chaseMesh.position.z = - (g.y - (this.game.viewHeight/2 || window.innerHeight/2)) - (g.height || ch)/2;
                    this._chaseMesh.position.y = (g.height || ch) * 0.3;
                    this._chaseMesh.visible = true;
                  } catch(e){}
                }
              } else {
                // hide chase mesh if ghost inactive
                if (this._chaseMesh) this._chaseMesh.visible = false;
              }
            }
          } catch (e) {
            // swallow chase mesh sync errors
            // console.warn('chase mesh sync failed', e);
          }

          // Maintain camera Y (height) but keep horizontal offset so user rotation is preserved.
          const desiredCamY = this.camera.position.y || 600;

          // Compute current horizontal offset between camera and controls target so we preserve user rotation/orbit.
          if (this.controls && this.controls.target) {
            // current horizontal offset (XZ plane)
            const curTarget = this.controls.target;
            const horizOffsetX = this.camera.position.x - curTarget.x;
            const horizOffsetZ = this.camera.position.z - curTarget.z;

            // Place camera at same horizontal offset relative to the player's new world position
            this.camera.position.x = px + horizOffsetX;
            this.camera.position.z = pz + horizOffsetZ;
            // Keep camera height as-is so users can choose distance/height for third-person view
            this.camera.position.y = desiredCamY;

            // Update controls target to player's center on ground (y=0)
            this.controls.target.set(px, 0, pz);

            // Ensure camera 'up' stays canonical to avoid roll accumulation
            this.camera.up.set(0, 1, 0);
          } else {
            // Fallback: directly position camera above player if controls not initialized
            this.camera.position.set(px, desiredCamY, pz);
            this.camera.up.set(0, 1, 0);
          }
        }
      } catch (e) {}

      // Recycle / reposition sphere field so spheres appear everywhere as you move.
      try {
        if (this._sphereGroup && this.game && this.game.player) {
          const pl = this.game.player;
          // compute player-centered world coords used by the 3D mapping (same mapping used elsewhere)
          const px = - (pl.x + pl.width / 2 - (this.game.viewWidth/2 || window.innerWidth/2));
          const pz = - (pl.y + pl.height / 2 - (this.game.viewHeight/2 || window.innerHeight/2));
          // For each sphere, if it's too far from player reposition it to a new random location within radius
          const maxDist = this._sphereFieldRadius;
          for (let i = 0; i < this._spheres.length; i++) {
            const s = this._spheres[i];
            const dx = s.position.x - px;
            const dz = s.position.z - pz;
            const dy = s.position.y - 0;
            const distSq = dx * dx + dz * dz + dy * dy;
            if (distSq > (maxDist * maxDist)) {
              // relocate to random point around player within radius
              const r = Math.random() * maxDist * 0.7 + (maxDist * 0.15);
              const theta = Math.random() * Math.PI * 2;
              const phi = Math.acos(2 * Math.random() - 1);
              s.position.x = px + Math.cos(theta) * Math.sin(phi) * r;
              s.position.z = pz + Math.sin(theta) * Math.sin(phi) * r;
              s.position.y = (Math.random() - 0.5) * 600;
            }
          }
          // keep the group roughly centered on the player so frustum stays populated
          this._sphereGroup.position.x = 0;
          this._sphereGroup.position.z = 0;
        }
      } catch(e) {
        // ignore sphere update errors
      }

      // Update controls after target/camera changes and render
      if (this.controls) this.controls.update();
      this.renderer.render(this.scene, this.camera);
      this._animReq = requestAnimationFrame(loop);
    };
    this._animReq = requestAnimationFrame(loop);
  }

  // Disable 3D mode and clean up
  disable() {
    if (!this.enabled) return;
    this.enabled = false;

    // stop loop
    if (this._animReq) {
      cancelAnimationFrame(this._animReq);
      this._animReq = null;
    }

    // Remove resize listener
    window.removeEventListener('resize', this._onResize);

    // Remove scene objects
    try {
      if (this._playerMesh) {
        this.scene.remove(this._playerMesh);
        this._playerMesh.geometry.dispose();
        if (this._playerMesh.material) this._playerMesh.material.dispose();
        this._playerMesh = null;
      }
      // dispose chase mesh if present
      if (this._chaseMesh) {
        try {
          this.scene.remove(this._chaseMesh);
          if (this._chaseMesh.geometry) this._chaseMesh.geometry.dispose();
          if (this._chaseMesh.material) this._chaseMesh.material.dispose();
        } catch (e) {}
        this._chaseMesh = null;
      }
      for (const m of this._meshes) {
        if (!m) continue;
        this.scene.remove(m);
        if (m.geometry) m.geometry.dispose();
        if (m.material) m.material.dispose();
      }
      this._meshes.length = 0;

      // remove and dispose sphere field if present
      try {
        if (this._sphereGroup) {
          this.scene.remove(this._sphereGroup);
          // dispose geometry/material of first sphere (shared) if possible
          if (this._spheres && this._spheres.length) {
            const s0 = this._spheres[0];
            if (s0) {
              try {
                if (s0.geometry) s0.geometry.dispose();
                if (s0.material) s0.material.dispose();
              } catch(e){}
            }
          }
          this._spheres.length = 0;
          this._sphereGroup = null;
        }
      } catch (e) {}
    } catch (e) {}

    // Dispose renderer
    try {
      if (this.renderer) {
        this.renderer.dispose();
        if (this.renderer.domElement && this.renderer.domElement.parentNode) {
          this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
        }
        this.renderer = null;
      }
    } catch (e) {}

    // Dispose player2 mesh if present
    try {
      if (this._player2Mesh) {
        try { this.scene.remove(this._player2Mesh); } catch (e) {}
        try { if (this._player2Mesh.geometry) this._player2Mesh.geometry.dispose(); } catch (e) {}
        try {
          if (this._player2Mesh.material) {
            if (this._player2Mesh.material.map) this._player2Mesh.material.map.dispose();
            this._player2Mesh.material.dispose();
          }
        } catch (e) {}
        this._player2Mesh = null;
      }
    } catch (e) {}

    // Remove HUD and container
    try {
      if (this._hud && this._hud.parentNode) this._hud.parentNode.removeChild(this._hud);
      this._hud = null;
      if (this._container && this._container.parentNode) {
        this._container.parentNode.removeChild(this._container);
      }
      this._container = null;
    } catch (e) {}

    // Restore visibility of 2D canvas
    try { this.canvas2D.style.visibility = 'visible'; } catch (e) {}

    // Clean up references
    this.scene = null;
    this.camera = null;
    if (this.controls) { try { this.controls.dispose(); } catch(e) {} }
    this.controls = null;
  }

  // Update the 3D player mesh from a replay/frame-like object {x,y,width,height}
  // Keeps the same mirroring and mapping used elsewhere so the 3D ghost lines up with the 2D world.
  updatePlayerMesh(frame) {
    try {
      if (!this.enabled || !frame) return;
      const pl = frame;
      // Determine desired visual shape (frame may come from replay; fall back to live game player)
      const desiredShape = pl.shape || (this.game && this.game.player ? this.game.player.shape : 'rect');

      // If the current mesh type doesn't match desired shape, rebuild the mesh so ball mode works live
      const desiredType = (desiredShape === 'ball') ? 'ball' : 'box';
      if (!this._playerMesh || this._playerMeshType !== desiredType) {
        // Rebuild mesh using the same logic as in enable; reuse frame for sizing/position
        try {
          if (this._playerMesh) {
            this.scene.remove(this._playerMesh);
            if (this._playerMesh.geometry) this._playerMesh.geometry.dispose();
            if (this._playerMesh.material) this._playerMesh.material.dispose();
            this._playerMesh = null;
          }
        } catch (e) {}

        const mat = new THREE.MeshStandardMaterial({ color: 0xff66aa, emissive: 0x332233, metalness: 0.2, roughness: 0.6 });
        if (desiredType === 'ball') {
          const radius = Math.max(6, Math.min(pl.width || this.game.player.width, pl.height || this.game.player.height) / 2);
          const geo = new THREE.SphereGeometry(radius, 24, 18);
          this._playerMesh = new THREE.Mesh(geo, mat);
          this._playerMeshType = 'ball';
        } else {
          const geo = new THREE.BoxGeometry(pl.width || this.game.player.width, (pl.height || this.game.player.height) * 0.6, pl.height || this.game.player.height);
          this._playerMesh = new THREE.Mesh(geo, mat);
          this._playerMeshType = 'box';
        }
        this._playerMesh.castShadow = true;
        this._playerMesh.receiveShadow = true;
        this.scene.add(this._playerMesh);
      }

      // Mirror player's computed world X so mesh matches mirrored platforms
      const px = - (pl.x + (pl.width || this.game.player.width) / 2 - (this.game.viewWidth/2 || window.innerWidth/2));
      const pz = - (pl.y + (pl.height || this.game.player.height) / 2 - (this.game.viewHeight/2 || window.innerHeight/2));
      this._playerMesh.position.x = px;
      this._playerMesh.position.z = pz;
      // keep y consistent with normal mapping
      this._playerMesh.position.y = (pl.height || this.game.player.height) * 0.3;

      // Only move the orbit controls target when following is enabled.
      // When following is disabled (e.g., for "use normal 3D camera during replay"),
      // we update just the player mesh so the user's camera stays where they left it.
      if (this._followPlayer) {
        if (this.controls && this.controls.target) {
          this.controls.target.set(px, 0, pz);
          this.controls.update();
        }
      }
    } catch (e) {
      // swallow errors to avoid breaking replay loop
      console.warn('updatePlayerMesh failed', e);
    }
  }
}