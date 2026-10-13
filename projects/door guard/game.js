// Door Guard - clickable 3D monitor, no side panel, linear monster, scary jumpscare
const Game = {
  power: 4,
  maxPower: 10,
  phasesBlocked: 0,
  doorClosed: false,
  doorTimer: null,
  doorTimeLeft: 0,
  monsterState: 'idle',
  attackTimer: null,
  sounds: {},
  gameActive: false,
  paused: false,
  pauseRemainingAttack: null, // ms left on attack timer when paused
  themeRate: 1,
  skipTheme: false,

  scene: null,
  camera: null,
  renderer: null,
  doorLeft: null,
  doorRight: null,
  coverDoor: null,
  monsterGroup: null,
  monsterEyes: [],
  currentView: 'hallway',
  animId: null,
  monsterZ: -28,
  monsterSpeed: 0,
  isRunningAnim: false,
  runDuration: 1.6,
  doorLight: null,

  monitorCanvas: null,
  monitorCtx: null,
  monitorTexture: null,
  monitorMesh: null,
  raycaster: null,
  mouse: null,
  buttonRects: [], // {game, x,y,w,h} in canvas space

  init() {
    this.cacheDOM();
    this.loadSounds();
    this.bindEvents();
    MiniGames.init(() => this.onMinigameComplete());
    this.updatePowerUI();
    this.updatePhaseUI();
    this.initThree();
    this.animate();
  },

  cacheDOM() {
    this.els = {
      powerBars: document.getElementById('power-bars'),
      powerCount: document.getElementById('power-count'),
      phaseCount: document.getElementById('phase-count'),
      monsterStatus: document.getElementById('monster-status'),
      doorStatus: document.getElementById('door-status'),
      cameraStatus: document.getElementById('camera-status'),
      closeBtn: document.getElementById('close-door-btn'),
      doorTimer: document.getElementById('door-timer'),
      startScreen: document.getElementById('start-screen'),
      gameOver: document.getElementById('game-over'),
      finalPhases: document.getElementById('final-phases'),
      viewHallway: document.getElementById('view-hallway'),
      viewOffice: document.getElementById('view-office'),
      canvas: document.getElementById('three-canvas'),
      viewport: document.getElementById('viewport-container'),
      jumpscareFlash: document.getElementById('jumpscare-flash'),
      modal: document.getElementById('minigame-modal'),
      modalTitle: document.getElementById('modal-title'),
      modalClose: document.getElementById('modal-close-btn'),
      minigameArea: document.getElementById('minigame-area'),
      pauseBtn: document.getElementById('pause-btn'),
      pauseOverlay: document.getElementById('pause-overlay'),
      resumeBtn: document.getElementById('resume-btn')
    };
  },

  loadSounds() {
    const files = {
      theme: 'sounds/theme.mp3',
      run: 'sounds/run.mp3',
      bang: 'sounds/door banging.mp3',
      death: 'sounds/death.mp3'
    };
    for (const [key, src] of Object.entries(files)) {
      this.sounds[key] = new Audio(src);
      this.sounds[key].preload = 'auto';
    }
  },

  bindEvents() {
    document.getElementById('start-btn').addEventListener('click', () => this.startGame());
    document.getElementById('restart-btn').addEventListener('click', () => location.reload());
    this.els.closeBtn.addEventListener('click', () => this.closeDoor());
    this.els.viewHallway.addEventListener('click', () => this.setView('hallway'));
    this.els.viewOffice.addEventListener('click', () => this.setView('office'));
    this.els.modalClose.addEventListener('click', () => this.closeModal());
    this.els.pauseBtn.addEventListener('click', () => this.togglePause());
    this.els.resumeBtn.addEventListener('click', () => this.togglePause());

    // ESC to pause/unpause
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        if (this.gameActive) this.togglePause();
      }
    });

    // Click on 3D canvas → raycast
    this.els.canvas.addEventListener('pointerdown', (e) => this.onCanvasClick(e));

    window.addEventListener('resize', () => this.onResize());
  },

  initThree() {
    const canvas = this.els.canvas;
    const w = this.els.viewport.clientWidth || window.innerWidth;
    const h = this.els.viewport.clientHeight || (window.innerHeight - 40);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050508);
    this.scene.fog = new THREE.FogExp2(0x050508, 0.032);

    this.camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 100);
    this.setCameraHallway();

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.scene.add(new THREE.AmbientLight(0x222233, 0.45));
    const dim = new THREE.PointLight(0x445566, 0.55, 40);
    dim.position.set(0, 4, 2);
    this.scene.add(dim);

    this.doorLight = new THREE.PointLight(0xff2200, 0.35, 28);
    this.doorLight.position.set(0, 3, -22);
    this.scene.add(this.doorLight);

    this.buildHallway();
    this.buildDoor();
    this.buildCoverDoor();
    this.buildMonster();
    this.buildOfficeWithMonitor();
  },

  buildHallway() {
    const floorGeo = new THREE.PlaneGeometry(8, 50);
    const floor = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({ color: 0x111118, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -15);
    this.scene.add(floor);

    const ceil = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({ color: 0x0a0a10 }));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, 5, -15);
    this.scene.add(ceil);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x15151c, roughness: 0.85 });
    const wallGeo = new THREE.PlaneGeometry(50, 5);

    const leftWall = new THREE.Mesh(wallGeo, wallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-4, 2.5, -15);
    this.scene.add(leftWall);

    const rightWall = new THREE.Mesh(wallGeo, wallMat);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(4, 2.5, -15);
    this.scene.add(rightWall);

    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(8, 5), wallMat);
    backWall.position.set(0, 2.5, 8);
    this.scene.add(backWall);

    const endWall = new THREE.Mesh(new THREE.PlaneGeometry(8, 5), new THREE.MeshStandardMaterial({ color: 0x0d0d12 }));
    endWall.position.set(0, 2.5, -28);
    this.scene.add(endWall);

    for (let i = 0; i < 12; i++) {
      const stripe = new THREE.Mesh(
        new THREE.PlaneGeometry(7.5, 0.12),
        new THREE.MeshBasicMaterial({ color: 0x1a1a22 })
      );
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(0, 0.01, -2 - i * 2.5);
      this.scene.add(stripe);
    }
  },

  buildDoor() {
    const doorGroup = new THREE.Group();
    doorGroup.position.set(0, 0, -27.5);

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a2a30 });
    const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.2, 0.4), frameMat);
    frameL.position.set(-1.4, 2.1, 0);
    doorGroup.add(frameL);
    const frameR = frameL.clone();
    frameR.position.x = 1.4;
    doorGroup.add(frameR);
    const frameT = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.3, 0.4), frameMat);
    frameT.position.set(0, 4.2, 0);
    doorGroup.add(frameT);

    const doorMat = new THREE.MeshStandardMaterial({ color: 0x1a1a20, metalness: 0.3, roughness: 0.7 });
    this.doorLeft = new THREE.Mesh(new THREE.BoxGeometry(1.3, 3.9, 0.15), doorMat);
    this.doorLeft.position.set(-0.65, 2, 0.1);
    doorGroup.add(this.doorLeft);
    this.doorRight = new THREE.Mesh(new THREE.BoxGeometry(1.3, 3.9, 0.15), doorMat);
    this.doorRight.position.set(0.65, 2, 0.1);
    doorGroup.add(this.doorRight);

    const handle = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.4, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x888899 })
    );
    handle.position.set(0.9, 2, 0.25);
    doorGroup.add(handle);

    this.scene.add(doorGroup);
    this.setFarDoorOpen(true);
  },

  setFarDoorOpen(open) {
    if (!this.doorLeft || !this.doorRight) return;
    this.doorLeft.position.x = open ? -1.85 : -0.65;
    this.doorRight.position.x = open ? 1.85 : 0.65;
  },

  buildCoverDoor() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x1a1520, metalness: 0.4, roughness: 0.6 });
    this.coverDoor = new THREE.Mesh(new THREE.BoxGeometry(7, 5.5, 0.3), mat);
    this.coverDoor.position.set(0, 2.5, 2.6);
    this.coverDoor.visible = false;

    const lineMat = new THREE.MeshBasicMaterial({ color: 0x2a2a35 });
    for (let i = 0; i < 4; i++) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.04, 0.05), lineMat);
      line.position.set(0, 1 + i * 1.1, 0.16);
      this.coverDoor.add(line);
    }
    const handle = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.5, 0.15),
      new THREE.MeshStandardMaterial({ color: 0x9999aa })
    );
    handle.position.set(2.2, 2.3, 0.2);
    this.coverDoor.add(handle);
    this.scene.add(this.coverDoor);
  },

  setCoverDoor(closed) {
    if (!this.coverDoor) return;
    this.coverDoor.visible = closed;
  },

  buildMonster() {
    this.monsterGroup = new THREE.Group();
    this.monsterGroup.visible = false;

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.95, 2.9, 8),
      new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.95 })
    );
    body.position.y = 1.5;
    this.monsterGroup.add(body);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.6, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0x0c0c0c })
    );
    head.position.y = 3.25;
    this.monsterGroup.add(head);

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), eyeMat);
    eyeL.position.set(-0.25, 3.35, 0.45);
    this.monsterGroup.add(eyeL);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.25;
    this.monsterGroup.add(eyeR);
    this.monsterEyes = [eyeL, eyeR];

    const eyeLightL = new THREE.PointLight(0xff0000, 2.2, 9);
    eyeLightL.position.copy(eyeL.position);
    this.monsterGroup.add(eyeLightL);
    const eyeLightR = new THREE.PointLight(0xff0000, 2.2, 9);
    eyeLightR.position.copy(eyeR.position);
    this.monsterGroup.add(eyeLightR);

    const mouth = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.12, 0.12),
      new THREE.MeshBasicMaterial({ color: 0x1a0000 })
    );
    mouth.position.set(0, 2.95, 0.5);
    this.monsterGroup.add(mouth);

    for (let i = 0; i < 5; i++) {
      const tooth = new THREE.Mesh(
        new THREE.ConeGeometry(0.04, 0.12, 4),
        new THREE.MeshBasicMaterial({ color: 0xdddddd })
      );
      tooth.position.set(-0.2 + i * 0.1, 2.88, 0.55);
      tooth.rotation.x = Math.PI;
      this.monsterGroup.add(tooth);
    }

    this.monsterGroup.position.set(0, 0, this.monsterZ);
    this.scene.add(this.monsterGroup);
  },

  buildOfficeWithMonitor() {
    // Desk on the LEFT side of the hallway, monitor faces the player (camera)
    // Camera office is roughly at (-0.6, 2.05, 3.8) looking toward the desk.
    // We place the monitor so its front faces the camera.

    const desk = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.12, 2.6),
      new THREE.MeshStandardMaterial({ color: 0x2a2218 })
    );
    desk.position.set(-3.2, 1.05, 2.0);
    this.scene.add(desk);

    // Bezel – rotated so the screen faces toward the center / player
    const bezel = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 1.3, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x111118 })
    );
    bezel.position.set(-3.05, 1.9, 2.0);
    bezel.rotation.y = Math.PI / 2; // face +X (toward hallway center)
    this.scene.add(bezel);

    this.monitorCanvas = document.createElement('canvas');
    this.monitorCanvas.width = 512;
    this.monitorCanvas.height = 340;
    this.monitorCtx = this.monitorCanvas.getContext('2d');
    this.monitorTexture = new THREE.CanvasTexture(this.monitorCanvas);
    this.monitorTexture.minFilter = THREE.LinearFilter;
    this.monitorTexture.magFilter = THREE.LinearFilter;

    // Screen plane – same rotation so it faces the player
    this.monitorMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.75, 1.15),
      new THREE.MeshBasicMaterial({ map: this.monitorTexture, side: THREE.DoubleSide })
    );
    this.monitorMesh.position.set(-2.98, 1.9, 2.0);
    this.monitorMesh.rotation.y = Math.PI / 2; // face toward +X (player)
    this.scene.add(this.monitorMesh);

    // Small secondary monitor (decorative)
    const mon2 = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.5, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x111118 })
    );
    mon2.position.set(-3.1, 1.65, 0.9);
    mon2.rotation.y = Math.PI / 2 + 0.25;
    this.scene.add(mon2);
    const s2 = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, 0.4),
      new THREE.MeshBasicMaterial({ color: 0x0a1520, side: THREE.DoubleSide })
    );
    s2.position.set(-3.05, 1.65, 0.9);
    s2.rotation.y = Math.PI / 2 + 0.25;
    this.scene.add(s2);

    this.drawMonitorMenu();
  },

  drawMonitorMenu() {
    const ctx = this.monitorCtx;
    const W = this.monitorCanvas.width;
    const H = this.monitorCanvas.height;
    if (!ctx) return;

    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#0a2a0a';
    ctx.fillRect(0, 0, W, 48);
    ctx.fillStyle = '#00ff66';
    ctx.font = 'bold 24px Courier New';
    ctx.fillText('POWER RECHARGE', 16, 32);

    ctx.fillStyle = '#88aa88';
    ctx.font = '13px Courier New';
    ctx.fillText('Click an option to play  (+1 power)', 16, 70);

    const games = [
      { id: 'simon', label: '1  Simon Says' },
      { id: 'platformer', label: '2  Platformer (2 Levels)' },
      { id: 'path', label: '3  Follow the Path' },
      { id: 'math', label: '4  Math Challenge' },
      { id: 'quiz', label: '5  Quiz Time' }
    ];

    this.buttonRects = [];
    games.forEach((g, i) => {
      const y = 90 + i * 42;
      const x = 14, w = W - 28, h = 36;
      ctx.fillStyle = '#12121c';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#00cc55';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = '#aaffaa';
      ctx.font = 'bold 17px Courier New';
      ctx.fillText(g.label, 26, y + 24);

      this.buttonRects.push({ game: g.id, x, y, w, h });
    });

    ctx.fillStyle = '#333';
    ctx.fillRect(0, H - 28, W, 28);
    ctx.fillStyle = '#0f0';
    ctx.font = '12px Courier New';
    ctx.fillText('CLICK OPTIONS ON THIS SCREEN', 16, H - 10);

    if (this.monitorTexture) this.monitorTexture.needsUpdate = true;
  },

  drawMonitorBusy(title) {
    const ctx = this.monitorCtx;
    const W = this.monitorCanvas.width;
    const H = this.monitorCanvas.height;
    if (!ctx) return;

    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#0a2a0a';
    ctx.fillRect(0, 0, W, 48);
    ctx.fillStyle = '#00ff66';
    ctx.font = 'bold 20px Courier New';
    ctx.fillText((title || 'MINI-GAME').substring(0, 26), 16, 32);

    ctx.fillStyle = '#0e0e18';
    ctx.fillRect(14, 70, W - 28, H - 110);
    ctx.strokeStyle = '#00aa44';
    ctx.lineWidth = 2;
    ctx.strokeRect(14, 70, W - 28, H - 110);

    ctx.fillStyle = '#0f0';
    ctx.font = '16px Courier New';
    ctx.fillText('Game running in popup...', 40, 160);
    ctx.fillStyle = '#888';
    ctx.font = '13px Courier New';
    ctx.fillText('Complete it for +1 power', 40, 190);

    ctx.fillStyle = '#333';
    ctx.fillRect(0, H - 28, W, 28);
    ctx.fillStyle = '#0f0';
    ctx.font = '12px Courier New';
    ctx.fillText('MINIGAME ACTIVE', 16, H - 10);

    if (this.monitorTexture) this.monitorTexture.needsUpdate = true;
  },

  // Convert click on 3D monitor → canvas pixel → which button
  onCanvasClick(event) {
    if (this.paused) return;
    if (!this.gameActive || this.currentView !== 'office') return;
    if (!this.monitorMesh || this.els.modal.classList.contains('hidden') === false) return;

    const rect = this.els.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hits = this.raycaster.intersectObject(this.monitorMesh);
    if (hits.length === 0) return;

    const uv = hits[0].uv;
    if (!uv) return;

    // UV (0,0) is bottom-left of the plane in Three.js by default
    const canvasX = uv.x * this.monitorCanvas.width;
    const canvasY = (1 - uv.y) * this.monitorCanvas.height;

    for (const btn of this.buttonRects) {
      if (canvasX >= btn.x && canvasX <= btn.x + btn.w &&
          canvasY >= btn.y && canvasY <= btn.y + btn.h) {
        this.launchMinigame(btn.game);
        break;
      }
    }
  },

  launchMinigame(gameId) {
    const titles = {
      simon: 'Simon Says',
      platformer: 'Platformer',
      path: 'Follow the Path',
      math: 'Math Challenge',
      quiz: 'Quiz Time'
    };
    this.els.modalTitle.textContent = titles[gameId] || 'MINI-GAME';
    this.els.modal.classList.remove('hidden');
    this.drawMonitorBusy(titles[gameId]);

    // Start the actual game inside the modal area
    if (gameId === 'simon') MiniGames.startSimon();
    else if (gameId === 'platformer') MiniGames.startPlatformer();
    else if (gameId === 'path') MiniGames.startPath();
    else if (gameId === 'math') MiniGames.startMath();
    else if (gameId === 'quiz') MiniGames.startQuiz();
  },

  closeModal() {
    this.els.modal.classList.add('hidden');
    MiniGames.clearArea();
    this.drawMonitorMenu();
  },

  onMinigameComplete() {
    this.addPower(1);
    this.closeModal();
  },

  setCameraHallway() {
    this.camera.position.set(0, 2.2, 4);
    this.camera.lookAt(0, 2, -20);
    this.camera.fov = 60;
    this.camera.updateProjectionMatrix();
    this.currentView = 'hallway';
    this.els.cameraStatus.textContent = 'VIEW: HALLWAY';
    this.els.viewHallway.classList.add('active');
    this.els.viewOffice.classList.remove('active');
    this.updatePowerUI(); // enable door button if possible
  },

  setCameraOffice() {
    // Camera sits in the middle of the hallway looking left at the monitor
    // Monitor is at ~(-2.98, 1.9, 2.0) facing +X
    this.camera.position.set(0.4, 2.0, 2.0);
    this.camera.lookAt(-2.98, 1.9, 2.0);
    this.camera.fov = 50;
    this.camera.updateProjectionMatrix();
    this.currentView = 'office';
    this.els.cameraStatus.textContent = 'VIEW: MINIGAMES';
    this.els.viewOffice.classList.add('active');
    this.els.viewHallway.classList.remove('active');
    this.drawMonitorMenu();
    this.updatePowerUI(); // disable door button in office view
  },

  setView(view) {
    if (view === 'hallway') this.setCameraHallway();
    else this.setCameraOffice();
  },

  onResize() {
    if (!this.renderer || !this.camera) return;
    const w = this.els.viewport.clientWidth;
    const h = this.els.viewport.clientHeight;
    if (w < 10 || h < 10) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  },

  getRunSpeed() {
    let baseDuration = 1.7;
    if (this.phasesBlocked >= 10) {
      const extra = this.phasesBlocked - 9;
      baseDuration = Math.max(0.55, 1.7 - extra * 0.12);
    }
    this.runDuration = baseDuration;
    return 23 / baseDuration;
  },

  animate() {
    this.animId = requestAnimationFrame(() => this.animate());

    if (!this.paused && this.isRunningAnim && this.monsterGroup && this.monsterSpeed > 0) {
      const dt = 1 / 60;
      this.monsterZ += this.monsterSpeed * dt;
      this.monsterGroup.position.z = this.monsterZ;
      this.monsterGroup.position.y = Math.sin(Date.now() * 0.02) * 0.09;
      const pulse = 0.9 + Math.sin(Date.now() * 0.025) * 0.4;
      this.monsterEyes.forEach(e => e.scale.setScalar(pulse));

      const targetZ = this.doorClosed ? -20.5 : -2.5;
      if (this.monsterZ >= targetZ) {
        this.monsterZ = targetZ;
        this.monsterGroup.position.z = targetZ;
        this.isRunningAnim = false;
      }
    }

    if (this.doorLight) {
      this.doorLight.intensity = 0.28 + Math.sin(Date.now() * 0.003) * 0.12;
    }

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  },

  togglePause() {
    if (!this.gameActive) return;
    if (this.paused) this.resume();
    else this.pause();
  },

  pause() {
    if (this.paused || !this.gameActive) return;
    this.paused = true;
    this.els.pauseOverlay.classList.remove('hidden');
    this.els.pauseBtn.textContent = '▶ RESUME';

    // Freeze attack timer
    if (this.attackTimer) {
      clearTimeout(this.attackTimer);
      this.attackTimer = null;
      // We don't track exact remaining time precisely; on resume just re-schedule a short delay
      this.pauseRemainingAttack = 3000; // resume with 3s warning window
    }

    // Pause any playing theme/run if needed (optional - leave audio)
    try {
      if (this.sounds.theme && !this.sounds.theme.paused) this.sounds.theme.pause();
      if (this.sounds.run && !this.sounds.run.paused) this.sounds.run.pause();
    } catch(e) {}
  },

  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.els.pauseOverlay.classList.add('hidden');
    this.els.pauseBtn.textContent = '❚❚ PAUSE';

    // Resume audio if it was mid-theme (best effort)
    try {
      if (this.monsterState === 'theme' && this.sounds.theme) this.sounds.theme.play().catch(()=>{});
    } catch(e) {}

    // Re-schedule attack if we were idle waiting
    if (this.monsterState === 'idle' || this.monsterState === 'leaving') {
      const delay = this.pauseRemainingAttack || 4000;
      this.pauseRemainingAttack = null;
      this.attackTimer = setTimeout(() => {
        if (this.gameActive && !this.paused) this.beginAttack();
      }, delay);
    }
  },

  startGame() {
    this.els.startScreen.classList.add('hidden');
    this.gameActive = true;
    this.paused = false;
    this.els.closeBtn.disabled = false;
    this.scheduleNextAttack();
  },

  updatePowerUI() {
    this.els.powerBars.innerHTML = '';
    for (let i = 0; i < this.maxPower; i++) {
      const bar = document.createElement('div');
      bar.className = 'power-bar ' + (i < this.power ? 'filled' : 'empty');
      this.els.powerBars.appendChild(bar);
    }
    this.els.powerCount.textContent = `${this.power}/${this.maxPower}`;
    this.els.closeBtn.disabled = this.power < 1 || this.doorClosed || !this.gameActive || this.currentView !== 'hallway';
  },

  updatePhaseUI() {
    this.els.phaseCount.textContent = this.phasesBlocked;
  },

  setStatus(text, cls = '') {
    this.els.monsterStatus.textContent = 'STATUS: ' + text;
    this.els.monsterStatus.className = cls;
  },

  addPower(n) {
    this.power = Math.min(this.maxPower, this.power + n);
    this.updatePowerUI();
  },

  usePower(n) {
    if (this.power < n) return false;
    this.power -= n;
    this.updatePowerUI();
    return true;
  },

  closeDoor() {
    if (this.paused) return;
    if (this.currentView !== 'hallway') return; // can only close door in door view
    if (this.doorClosed || this.power < 1 || !this.gameActive) return;
    if (!this.usePower(1)) return;

    this.doorClosed = true;
    this.setFarDoorOpen(false);
    this.setCoverDoor(true);
    this.els.doorStatus.textContent = 'DOOR: CLOSED';
    this.doorTimeLeft = 5;
    this.els.doorTimer.textContent = `Door holds for ${this.doorTimeLeft}s`;

    if (this.doorTimer) clearInterval(this.doorTimer);
    this.doorTimer = setInterval(() => {
      this.doorTimeLeft--;
      if (this.doorTimeLeft > 0) {
        this.els.doorTimer.textContent = `Door holds for ${this.doorTimeLeft}s`;
      } else {
        this.openDoor();
      }
    }, 1000);
  },

  openDoor() {
    if (this.doorTimer) {
      clearInterval(this.doorTimer);
      this.doorTimer = null;
    }
    this.doorClosed = false;
    this.setFarDoorOpen(true);
    this.setCoverDoor(false);
    this.els.doorStatus.textContent = 'DOOR: OPEN';
    this.els.doorTimer.textContent = '';
    this.updatePowerUI();
  },

  scheduleNextAttack() {
    if (!this.gameActive || this.paused) return;
    const base = Math.max(7, 15 - Math.floor(this.phasesBlocked / 3));
    const delay = (base + Math.random() * 11) * 1000;
    this.attackTimer = setTimeout(() => this.beginAttack(), delay);
    this.setStatus('IDLE');
    if (this.monsterGroup) {
      this.monsterGroup.visible = false;
      this.monsterZ = -28;
      this.monsterSpeed = 0;
      this.isRunningAnim = false;
    }
  },

  beginAttack() {
    if (!this.gameActive || this.paused) return;
    this.monsterState = 'theme';

    if (this.monsterGroup) {
      this.monsterGroup.visible = false;
      this.monsterZ = -28;
      this.monsterSpeed = 0;
      this.isRunningAnim = false;
    }

    if (this.skipTheme || this.phasesBlocked >= 10) {
      this.startRunning();
      return;
    }

    this.setStatus('THEME PLAYING', 'theme');
    const theme = this.sounds.theme;
    theme.currentTime = 0;
    theme.playbackRate = this.themeRate;
    theme.play().catch(() => {});

    const themeDur = (theme.duration || 3.8) / this.themeRate * 1000;
    setTimeout(() => {
      if (this.monsterState === 'theme') this.startRunning();
    }, themeDur - 60);
  },

  startRunning() {
    if (!this.gameActive || this.paused) return;
    this.monsterState = 'running';
    this.setStatus('MONSTER RUNNING!', 'running');

    this.monsterSpeed = this.getRunSpeed();
    this.monsterZ = -26;
    this.isRunningAnim = true;

    if (this.monsterGroup) {
      this.monsterGroup.visible = true;
      this.monsterGroup.position.z = this.monsterZ;
      this.monsterGroup.scale.set(1, 1, 1);
    }

    const run = this.sounds.run;
    run.currentTime = 0;
    run.playbackRate = 1;
    run.play().catch(() => {});

    const resolveAfter = this.runDuration * 1000 + 100;
    setTimeout(() => {
      if (this.monsterState !== 'running') return;
      this.resolveAttack();
    }, resolveAfter);
  },

  resolveAttack() {
    if (!this.gameActive || this.paused) return;

    if (this.doorClosed) {
      this.monsterState = 'banging';
      this.setStatus('BANGING ON DOOR!', 'banging');
      this.monsterSpeed = 0;
      this.isRunningAnim = false;
      if (this.monsterGroup) this.monsterGroup.position.z = -20.5;

      document.body.classList.add('shake-hard');
      this.els.viewport.classList.add('shake-hard');
      let shakeCount = 0;
      const shakeInterval = setInterval(() => {
        document.body.classList.add('shake-hard');
        this.els.viewport.classList.add('shake-hard');
        setTimeout(() => {
          document.body.classList.remove('shake-hard');
          this.els.viewport.classList.remove('shake-hard');
        }, 380);
        shakeCount++;
        if (shakeCount > 7) clearInterval(shakeInterval);
      }, 420);

      const bang = this.sounds.bang;
      bang.currentTime = 0;
      bang.play().catch(() => {});

      const bangDur = (bang.duration || 3.3) * 1000;
      setTimeout(() => this.monsterLeaves(true), bangDur);
    } else {
      this.die();
    }
  },

  monsterLeaves(success) {
    this.monsterState = 'leaving';
    this.isRunningAnim = false;
    this.monsterSpeed = 0;
    if (this.monsterGroup) {
      this.monsterGroup.visible = false;
      this.monsterZ = -28;
      this.monsterGroup.scale.set(1, 1, 1);
    }

    if (success) {
      this.phasesBlocked++;
      this.updatePhaseUI();
      if (this.phasesBlocked >= 5 && this.phasesBlocked < 10) this.themeRate = 2;
      if (this.phasesBlocked >= 10) this.skipTheme = true;
      this.setStatus('IDLE - Monster left');
      setTimeout(() => {
        if (this.gameActive) this.scheduleNextAttack();
      }, 1600);
    }
  },

  die() {
    this.gameActive = false;
    this.monsterState = 'dead';
    if (this.attackTimer) clearTimeout(this.attackTimer);
    if (this.doorTimer) clearInterval(this.doorTimer);
    this.closeModal();

    this.setStatus('YOU DIED', 'running');
    this.monsterSpeed = 0;
    this.isRunningAnim = false;

    this.setView('hallway');

    if (this.monsterGroup) {
      this.monsterGroup.visible = true;
      this.monsterGroup.position.set(0, 0.3, 1.2);
      this.monsterGroup.scale.set(2.5, 2.5, 2.5);
    }

    this.camera.position.set(0, 2.0, 2.5);
    this.camera.lookAt(0, 2.4, 1.2);
    this.camera.fov = 90;
    this.camera.updateProjectionMatrix();

    this.els.jumpscareFlash.classList.remove('hidden');
    this.els.jumpscareFlash.classList.add('active');

    document.body.classList.add('shake-hard');
    this.els.viewport.classList.add('shake-hard');
    const scareShake = setInterval(() => {
      document.body.classList.add('shake-hard');
      this.els.viewport.classList.add('shake-hard');
      setTimeout(() => {
        document.body.classList.remove('shake-hard');
        this.els.viewport.classList.remove('shake-hard');
      }, 180);
    }, 200);

    const death = this.sounds.death;
    death.currentTime = 0;
    death.volume = 1;
    death.play().catch(() => {});

    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 1.5);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 1.6);
    } catch (e) {}

    setTimeout(() => {
      clearInterval(scareShake);
      this.els.jumpscareFlash.classList.remove('active');
      this.els.jumpscareFlash.classList.add('hidden');
      this.els.finalPhases.textContent = this.phasesBlocked;
      this.els.gameOver.classList.remove('hidden');
    }, 2300);
  }
};

document.addEventListener('DOMContentLoaded', () => Game.init());
