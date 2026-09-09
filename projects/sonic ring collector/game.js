(() => {
  "use strict";

  // ========== CANVAS & CONTEXT ==========
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  function resize() {
    const container = document.getElementById("game-container");
    const rect = container.getBoundingClientRect();
    canvas.width = Math.floor(rect.width);
    canvas.height = Math.floor(rect.height);
  }
  window.addEventListener("resize", resize);
  resize();

  // ========== ASSETS ==========
  const assets = {
    sonic: null,
    ring: null,
    bg: null,
    music: null,
    sfx: {
      collect: null,
      hurt: null,
      boost: null,
      jump: null,
      land: null
    }
  };

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function loadAudio(src) {
    const a = new Audio(src);
    a.preload = "auto";
    return a;
  }

  // ========== SPRITE DATA ==========
  // Sonic: 624x168 → 8 cols × 2 rows → frame ~78×84
  const SONIC_FW = 78;
  const SONIC_FH = 84;
  // Frames:
  // Row 0 (0-7): jump ball
  // Row 1 (8-11): run
  // Row 1 (12-15): peelout
  const JUMP_FRAMES = [0, 1, 2, 3, 4, 5, 6, 7];
  const RUN_FRAMES = [8, 9, 10, 11];
  const PEELOUT_FRAMES = [12, 13, 14, 15];

  // Ring: 200x200 → 2×2 → 100×100
  const RING_FW = 100;
  const RING_FH = 100;
  const RING_FRAMES = [0, 1, 2, 3];

  // ========== GAME STATE ==========
  let state = "start"; // start | playing | paused | levelComplete | gameOver
  let level = 1;
  let restartWarnCount = 0;
  let scatteredRings = []; // classic hurt rings bouncing out
  let ringsCollected = 0;
  let ringsNeeded = 10;
  let score = 0;

  // Camera & world
  let cameraX = 0;
  let cameraY = 0;
  const ZOOM = 1.75; // closer view of Sonic (classic feel)
  let worldWidth = 8000; // grows with generation

  // Sonic
  const sonic = {
    x: 200,
    y: 0,
    vx: 0,
    vy: 0,
    width: 72,
    height: 78,
    onGround: false,
    wasOnGround: false,
    jumpsLeft: 2,
    facing: 1,
    anim: "run", // run | jump | peelout
    frame: 0,
    frameTimer: 0,
    invincible: 0,
    boostTimer: 0,
    speed: 0
  };

  // Physics
  const GRAVITY = 0.65;
  const JUMP_FORCE = -14.2;
  const DOUBLE_JUMP_FORCE = -11.0; // second jump weaker
  const BASE_SPEED = 8.2;
  const BOOST_SPEED = 14.5;
  const MAX_FALL = 18;
  const GROUND_Y = () => canvas.height - 90;

  // Level objects
  let platforms = [];
  let rings = [];
  let bombs = [];
  let boosters = [];
  let hills = [];
  let particles = [];

  // Floor color theme per level
  const themes = [
    { floor1: "#e8a020", floor2: "#8b5a2b", bgTint: "rgba(255,180,50,0.15)", sky: "#4a9fd8" },
    { floor1: "#40c060", floor2: "#2a6030", bgTint: "rgba(40,180,80,0.18)", sky: "#3a8a6a" },
    { floor1: "#c040c0", floor2: "#602060", bgTint: "rgba(180,40,180,0.15)", sky: "#5a3a7a" },
    { floor1: "#40a0e0", floor2: "#205080", bgTint: "rgba(40,120,220,0.18)", sky: "#2a5a9a" },
    { floor1: "#e05030", floor2: "#802010", bgTint: "rgba(220,60,30,0.18)", sky: "#8a3a2a" },
    { floor1: "#e0e040", floor2: "#808020", bgTint: "rgba(220,220,40,0.15)", sky: "#6a6a2a" },
    { floor1: "#30d0d0", floor2: "#187070", bgTint: "rgba(30,200,200,0.18)", sky: "#2a7a7a" },
    { floor1: "#d0d0d0", floor2: "#505050", bgTint: "rgba(200,200,200,0.12)", sky: "#4a4a5a" }
  ];

  function getTheme() {
    return themes[(level - 1) % themes.length];
  }

  // ========== INPUT ==========
  const keys = {};
  window.addEventListener("keydown", (e) => {
    keys[e.code] = true;
    if (["ArrowUp", "Space", "KeyW", "Escape", "KeyP"].includes(e.code)) {
      e.preventDefault();
    }
    if (e.code === "Escape" || e.code === "KeyP") {
      togglePause();
    }
  });
  window.addEventListener("keyup", (e) => {
    keys[e.code] = false;
  });

  // ========== UI ELEMENTS ==========
  const el = {
    ringCount: document.getElementById("ring-count"),
    levelNum: document.getElementById("level-num"),
    goalCount: document.getElementById("goal-count"),
    boostTimer: document.getElementById("boost-timer"),
    startScreen: document.getElementById("start-screen"),
    pauseScreen: document.getElementById("pause-screen"),
    restartWarn: document.getElementById("restart-warn"),
    warnText: document.getElementById("warn-text"),
    gameOver: document.getElementById("game-over"),
    levelComplete: document.getElementById("level-complete"),
    failReason: document.getElementById("fail-reason"),
    message: document.getElementById("message"),
    startBtn: document.getElementById("start-btn"),
    resumeBtn: document.getElementById("resume-btn"),
    restartLevelBtn: document.getElementById("restart-level-btn"),
    restartGameBtn: document.getElementById("restart-game-btn"),
    confirmRestartBtn: document.getElementById("confirm-restart-btn"),
    cancelRestartBtn: document.getElementById("cancel-restart-btn"),
    retryBtn: document.getElementById("retry-btn"),
    nextBtn: document.getElementById("next-btn")
  };

  el.startBtn.addEventListener("click", startGame);
  el.retryBtn.addEventListener("click", () => {
    el.gameOver.classList.add("hidden");
    startLevel();
  });
  el.nextBtn.addEventListener("click", () => {
    el.levelComplete.classList.add("hidden");
    level++;
    startLevel();
  });
  el.resumeBtn.addEventListener("click", () => resumeGame());
  el.restartLevelBtn.addEventListener("click", () => {
    resumeGame();
    startLevel();
  });
  el.restartGameBtn.addEventListener("click", () => {
    restartWarnCount = 1;
    el.restartWarn.classList.remove("hidden");
    el.warnText.textContent = "Are you sure? (1/2)";
  });
  el.confirmRestartBtn.addEventListener("click", () => {
    if (restartWarnCount < 2) {
      restartWarnCount = 2;
      el.warnText.textContent = "Really restart the whole game? (2/2)";
      return;
    }
    // Confirmed twice
    el.restartWarn.classList.add("hidden");
    restartWarnCount = 0;
    resumeGame();
    level = 1;
    el.pauseScreen.classList.add("hidden");
    startLevel();
  });
  el.cancelRestartBtn.addEventListener("click", () => {
    restartWarnCount = 0;
    el.restartWarn.classList.add("hidden");
  });

  window.__startSonicGame = startGame;
  window.__startLevel = startLevel;

  // ========== AUDIO ==========
  function playSfx(name, volume = 0.2) {
    const s = assets.sfx[name];
    if (!s) return;
    try {
      const clone = s.cloneNode();
      clone.volume = Math.min(volume, 0.28);
      clone.play().catch(() => {});
    } catch (e) {}
  }

  function startMusic() {
    if (!assets.music) return;
    try {
      assets.music.loop = true;
      assets.music.volume = 0.55;
      assets.music.play().catch(() => {});
    } catch (e) {}
  }

  function pauseMusic() {
    if (assets.music) {
      try { assets.music.pause(); } catch (e) {}
    }
  }

  function resumeMusic() {
    if (assets.music && state === "playing") {
      try { assets.music.play().catch(() => {}); } catch (e) {}
    }
  }

  // ========== PAUSE ==========
  function togglePause() {
    if (state === "playing") {
      state = "paused";
      el.pauseScreen.classList.remove("hidden");
      el.restartWarn.classList.add("hidden");
      restartWarnCount = 0;
      pauseMusic();
    } else if (state === "paused") {
      resumeGame();
    }
  }

  function resumeGame() {
    if (state !== "paused") return;
    state = "playing";
    el.pauseScreen.classList.add("hidden");
    el.restartWarn.classList.add("hidden");
    restartWarnCount = 0;
    resumeMusic();
  }

  // ========== LEVEL GENERATION ==========
  function generateLevel() {
    platforms = [];
    rings = [];
    bombs = [];
    boosters = [];
    hills = [];
    particles = [];

    const difficulty = Math.min(level, 15);
    ringsNeeded = 12 + level * 5;
    // Longer stages to match higher speed
    worldWidth = 6200 + level * 950;

    const groundH = 90;
    const baseY = () => canvas.height - groundH;

    // --- Starting safe runway (longer for faster speed) ---
    platforms.push({ x: 0, y: baseY(), w: 900, h: groundH, type: "ground" });
    for (let i = 0; i < 5; i++) {
      rings.push({
        x: 320 + i * 60,
        y: baseY() - 52,
        frame: i % 4,
        collected: false
      });
    }

    let x = 900;
    let lastWasGap = false;

    while (x < worldWidth - 650) {
      const roll = Math.random();

      // GAP – jumpable with single or double jump; wider at higher levels
      if (!lastWasGap && roll < 0.11 + difficulty * 0.013) {
        const gapW = 90 + Math.random() * (70 + difficulty * 10);
        // Mid-gap platform for fairness at high speed
        if (Math.random() < 0.72) {
          const platW = 120 + Math.random() * 100;
          const py = baseY() - (50 + Math.random() * 75);
          platforms.push({ x: x + gapW * 0.22, y: py, w: platW, h: 28, type: "platform" });
          const numR = 1 + Math.floor(Math.random() * 3);
          for (let i = 0; i < numR; i++) {
            rings.push({
              x: x + gapW * 0.22 + 24 + i * 42,
              y: py - 46,
              frame: Math.floor(Math.random() * 4),
              collected: false
            });
          }
        }
        x += gapW;
        lastWasGap = true;
        continue;
      }
      lastWasGap = false;

      // FLOATING PLATFORM cluster
      if (roll < 0.34 + difficulty * 0.014) {
        const platW = 130 + Math.random() * 160;
        const heightOff = 55 + Math.random() * (85 + difficulty * 8);
        const py = baseY() - heightOff;
        platforms.push({ x: x, y: py, w: platW, h: 28, type: "platform" });

        const numR = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < numR; i++) {
          rings.push({
            x: x + 28 + i * 44,
            y: py - 46,
            frame: Math.floor(Math.random() * 4),
            collected: false
          });
        }

        if (difficulty > 2 && Math.random() < 0.16 + difficulty * 0.018) {
          bombs.push({
            x: x + platW * 0.55,
            y: py - 50,
            radius: 16,
            bob: Math.random() * Math.PI * 2
          });
        }

        if (Math.random() < 0.38) {
          const p2w = 90 + Math.random() * 90;
          const p2y = py - (48 + Math.random() * 42);
          platforms.push({ x: x + 50, y: p2y, w: p2w, h: 26, type: "platform" });
          rings.push({
            x: x + 70,
            y: p2y - 44,
            frame: 0,
            collected: false
          });
        }

        x += platW + 40 + Math.random() * 70;
        continue;
      }

      // SOLID GROUND chunk – longer for high speed readability
      const chunkW = 260 + Math.random() * 320;
      platforms.push({ x: x, y: baseY(), w: chunkW, h: groundH, type: "ground" });

      if (Math.random() < 0.5) {
        hills.push({
          x: x + 40 + Math.random() * (chunkW - 100),
          y: baseY(),
          w: 55 + Math.random() * 80,
          h: 28 + Math.random() * 48
        });
      }

      if (Math.random() < 0.72) {
        const numR = 2 + Math.floor(Math.random() * 5);
        const startRx = x + 60 + Math.random() * 50;
        const arc = Math.random() < 0.42;
        for (let i = 0; i < numR; i++) {
          const extraY = arc ? Math.sin((i / (numR - 1 || 1)) * Math.PI) * 60 : (Math.random() < 0.28 ? 55 : 0);
          rings.push({
            x: startRx + i * 48,
            y: baseY() - 52 - extraY,
            frame: Math.floor(Math.random() * 4),
            collected: false
          });
        }
      }

      if (difficulty > 1 && Math.random() < 0.12 + difficulty * 0.018) {
        bombs.push({
          x: x + chunkW * (0.4 + Math.random() * 0.35),
          y: baseY() - 40,
          radius: 16,
          bob: Math.random() * Math.PI * 2
        });
      }

      x += chunkW;
    }

    // --- Final safe zone ---
    platforms.push({
      x: worldWidth - 750,
      y: baseY(),
      w: 900,
      h: groundH,
      type: "ground"
    });
    for (let i = 0; i < 6; i++) {
      rings.push({
        x: worldWidth - 580 + i * 52,
        y: baseY() - 52,
        frame: i % 4,
        collected: false
      });
    }

    // Guarantee enough rings
    let totalRings = rings.length;
    while (totalRings < ringsNeeded + 12) {
      const rx = 800 + Math.random() * (worldWidth - 1600);
      // Prefer placing near existing ground
      const ry = baseY() - 48 - Math.random() * 100;
      rings.push({
        x: rx,
        y: ry,
        frame: Math.floor(Math.random() * 4),
        collected: false
      });
      totalRings++;
    }

    // 1–2 boosters on solid ground areas
    const numBoost = level === 1 ? 1 : (Math.random() < 0.45 ? 1 : 2);
    for (let i = 0; i < numBoost; i++) {
      const bx = 900 + (i + 0.5) * ((worldWidth - 1400) / numBoost) + (Math.random() - 0.5) * 200;
      boosters.push({
        x: bx,
        y: baseY() - 52,
        w: 56,
        h: 42,
        used: false,
        pulse: 0
      });
    }

    platforms.sort((a, b) => a.x - b.x);
  }

  // ========== SONIC RESET ==========
  function resetSonic() {
    sonic.x = 220;
    sonic.y = GROUND_Y() - sonic.height;
    sonic.vx = 0;
    sonic.vy = 0;
    sonic.onGround = true;
    sonic.wasOnGround = true;
    sonic.jumpsLeft = 2;
    sonic.anim = "run";
    sonic.frame = 0;
    sonic.frameTimer = 0;
    sonic.invincible = 0;
    sonic.boostTimer = 0;
    sonic.speed = BASE_SPEED;
    cameraX = 0;
    cameraY = 0;
  }

  // ========== START ==========
  function startGame() {
    el.startScreen.classList.add("hidden");
    level = 1;
    startMusic();
    startLevel();
  }

  function startLevel() {
    state = "playing";
    ringsCollected = 0;
    scatteredRings = [];
    generateLevel();
    resetSonic();
    updateHUD();
    el.message.classList.add("hidden");
    el.pauseScreen.classList.add("hidden");
    showMessage(`Collect ${ringsNeeded} Rings!`, 1800);
    resumeMusic();
  }

  function updateHUD() {
    el.ringCount.textContent = ringsCollected;
    el.levelNum.textContent = level;
    el.goalCount.textContent = ringsNeeded;
    if (sonic.boostTimer > 0) {
      el.boostTimer.classList.remove("hidden");
      el.boostTimer.textContent = `BOOST! ${Math.ceil(sonic.boostTimer / 60)}s`;
    } else {
      el.boostTimer.classList.add("hidden");
    }
  }

  function showMessage(text, duration = 1500) {
    el.message.textContent = text;
    el.message.classList.remove("hidden");
    setTimeout(() => el.message.classList.add("hidden"), duration);
  }

  // ========== COLLISION HELPERS ==========
  function rectOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function getSolidUnder(x, y, w, h, falling = true) {
    // Find platforms under an object (Sonic or scattered rings)
    const feetY = y + h;
    for (const p of platforms) {
      if (x + w > p.x + 8 && x < p.x + p.w - 8) {
        if (feetY >= p.y - 6 && feetY <= p.y + 22 && falling) {
          return p;
        }
      }
    }
    return null;
  }

  // ========== UPDATE ==========
  function update(dt) {
    if (state !== "playing") return;

    // Forward auto-run only (no left/right movement)
    const targetSpeed = sonic.boostTimer > 0 ? BOOST_SPEED : BASE_SPEED;
    sonic.speed += (targetSpeed - sonic.speed) * 0.1;
    sonic.x += sonic.speed;

    // Jump / double jump (edge-triggered so hold doesn't spam)
    const jumpPressed = keys["Space"] || keys["ArrowUp"] || keys["KeyW"];
    if (jumpPressed && !keys._jumpHeld && sonic.jumpsLeft > 0) {
      const isDouble = sonic.jumpsLeft < 2 || !sonic.onGround;
      sonic.vy = isDouble ? DOUBLE_JUMP_FORCE : JUMP_FORCE;
      sonic.onGround = false;
      sonic.wasOnGround = false;
      sonic.jumpsLeft--;
      sonic.anim = "jump";
      sonic.frame = 0;
      playSfx("jump", 0.2);
    }
    keys._jumpHeld = jumpPressed;

    // Gravity
    sonic.vy += GRAVITY;
    if (sonic.vy > MAX_FALL) sonic.vy = MAX_FALL;
    sonic.y += sonic.vy;

    // Platform collision
    sonic.wasOnGround = sonic.onGround;
    sonic.onGround = false;
    const plat = getSolidUnder(sonic.x, sonic.y, sonic.width, sonic.height, sonic.vy >= 0);
    if (plat) {
      sonic.y = plat.y - sonic.height;
      // Play land sound ONLY when transitioning from air → ground
      if (!sonic.wasOnGround && sonic.vy > 1) {
        playSfx("land", 0.18);
      }
      sonic.vy = 0;
      sonic.onGround = true;
      sonic.jumpsLeft = 2;
      if (sonic.anim === "jump") {
        sonic.anim = sonic.boostTimer > 0 ? "peelout" : "run";
        sonic.frame = 0;
      }
    }

    // Fall off world
    if (sonic.y > canvas.height + 100) {
      loseRings(true);
    }

    // Camera – zoomed view centered more on Sonic
    const viewW = canvas.width / ZOOM;
    const viewH = canvas.height / ZOOM;
    const targetCamX = sonic.x - viewW * 0.32;
    cameraX += (targetCamX - cameraX) * 0.2;
    if (cameraX < 0) cameraX = 0;

    // Vertical: keep Sonic in the lower-middle of the frame
    const targetCamY = sonic.y - viewH * 0.58;
    cameraY += (targetCamY - cameraY) * 0.15;
    // Soft clamp so we don't scroll into empty void too far
    const minCamY = GROUND_Y() - viewH + 40;
    const maxCamY = GROUND_Y() - viewH * 0.35;
    if (cameraY < minCamY) cameraY = minCamY;
    if (cameraY > maxCamY) cameraY = maxCamY;

    // Boost timer
    if (sonic.boostTimer > 0) {
      sonic.boostTimer--;
      if (sonic.boostTimer <= 0) {
        sonic.anim = sonic.onGround ? "run" : "jump";
      }
    }

    // Invincibility frames
    if (sonic.invincible > 0) sonic.invincible--;

    // Animation
    updateAnimation();

    // Collect rings
    for (const r of rings) {
      if (r.collected) continue;
      if (rectOverlap(sonic.x + 10, sonic.y + 10, sonic.width - 20, sonic.height - 16, r.x - 4, r.y - 4, 44, 44)) {
        r.collected = true;
        ringsCollected++;
        playSfx("collect", 0.2);
        spawnParticles(r.x + 16, r.y + 16, "#ffd700", 8);
        updateHUD();
        if (ringsCollected >= ringsNeeded) {
          levelWin();
          return;
        }
      }
    }

    // Bombs
    for (const b of bombs) {
      b.bob += 0.08;
      const by = b.y + Math.sin(b.bob) * 6;
      const dx = sonic.x + sonic.width / 2 - b.x;
      const dy = sonic.y + sonic.height / 2 - by;
      if (Math.hypot(dx, dy) < b.radius + 20 && sonic.invincible <= 0) {
        hitBomb(b);
      }
    }

    // Boosters
    for (const bo of boosters) {
      bo.pulse += 0.1;
      if (!bo.used && rectOverlap(sonic.x, sonic.y, sonic.width, sonic.height, bo.x, bo.y, bo.w, bo.h)) {
        bo.used = true;
        sonic.boostTimer = 600;
        sonic.anim = "peelout";
        sonic.frame = 0;
        playSfx("boost", 0.25);
        showMessage("SPEED BOOST!", 1200);
        spawnParticles(bo.x + 25, bo.y + 20, "#ffaa00", 16);
        updateHUD();
      }
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }

    // Scattered hurt rings — visual animation only (not collectible)
    for (let i = scatteredRings.length - 1; i >= 0; i--) {
      const r = scatteredRings[i];
      r.vy += 0.5;
      r.x += r.vx;
      r.y += r.vy;
      r.vx *= 0.99;
      r.frame = (r.frame + 0.3) % 4;
      r.life--;

      const plat = getSolidUnder(r.x - 10, r.y - 10, 28, 28, r.vy > 0);
      if (plat && r.vy > 0 && r.bounce < 2) {
        r.y = plat.y - 18;
        r.vy *= -0.5;
        r.vx *= 0.85;
        r.bounce++;
      }

      if (r.life <= 0 || r.y > GROUND_Y() + 250) {
        scatteredRings.splice(i, 1);
      }
    }

    // End of level check
    if (sonic.x > worldWidth - 100) {
      if (ringsCollected >= ringsNeeded) {
        levelWin();
      } else if (ringsCollected < ringsNeeded) {
        el.failReason.textContent = `Only collected ${ringsCollected}/${ringsNeeded} rings!`;
        state = "gameOver";
        el.gameOver.classList.remove("hidden");
        pauseMusic();
      }
    }
  }

  function updateAnimation() {
    if (!sonic.onGround) {
      sonic.anim = "jump";
    } else if (sonic.boostTimer > 0) {
      sonic.anim = "peelout";
    } else {
      sonic.anim = "run";
    }

    sonic.frameTimer++;
    let fps = 12;
    if (sonic.anim === "jump") fps = 60;
    else if (sonic.anim === "peelout") fps = 20;
    else fps = 14;

    const interval = Math.max(1, Math.round(60 / fps));
    if (sonic.frameTimer >= interval) {
      sonic.frameTimer = 0;
      sonic.frame++;
      let maxF = 4;
      if (sonic.anim === "jump") maxF = 8;
      else if (sonic.anim === "peelout") maxF = 4;
      if (sonic.frame >= maxF) sonic.frame = 0;
    }
  }

  function hitBomb(b) {
    playSfx("hurt", 0.25);
    sonic.invincible = 100;
    // Lose rings from the counter
    const lost = Math.min(ringsCollected, Math.min(20, 4 + Math.floor(level / 2)));
    if (lost > 0) {
      ringsCollected -= lost;
      if (ringsCollected < 0) ringsCollected = 0;
      updateHUD();
    }
    // Visual only: 5–7 rings fly out (NOT collectible)
    const visualCount = 5 + Math.floor(Math.random() * 3);
    scatterRingsFromSonic(visualCount);
    spawnParticles(b.x, b.y, "#ff3333", 14);
    sonic.vy = -10;
    sonic.onGround = false;
    sonic.jumpsLeft = Math.max(sonic.jumpsLeft, 1);
  }

  function scatterRingsFromSonic(count) {
    const cx = sonic.x + sonic.width / 2;
    const cy = sonic.y + sonic.height * 0.3;
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI * 0.9 + (Math.PI * 1.8 * i) / Math.max(count - 1, 1);
      const speed = 6 + Math.random() * 5;
      const jitter = (Math.random() - 0.5) * 0.3;
      scatteredRings.push({
        x: cx + (Math.random() - 0.5) * 8,
        y: cy,
        vx: Math.cos(angle + jitter) * speed,
        vy: Math.sin(angle + jitter) * speed - 3,
        frame: Math.random() * 4,
        life: 90 + Math.floor(Math.random() * 30),
        bounce: 0
      });
    }
  }

  function loseRings(fell) {
    playSfx("hurt", 0.25);
    if (fell) {
      el.failReason.textContent = "You fell into the void!";
    } else {
      el.failReason.textContent = "You lost all your rings!";
    }
    state = "gameOver";
    el.gameOver.classList.remove("hidden");
    pauseMusic();
  }

  function levelWin() {
    state = "levelComplete";
    el.levelComplete.classList.remove("hidden");
    playSfx("collect", 0.22);
  }

  function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8 - 2,
        life: 20 + Math.random() * 25,
        color: color,
        size: 2 + Math.random() * 3
      });
    }
  }

  // ========== DRAW ==========
  function draw() {
    const theme = getTheme();
    const W = canvas.width;
    const H = canvas.height;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = theme.sky;
    ctx.fillRect(0, 0, W, H);

    if (assets.bg) {
      const bgScale = Math.max(W / assets.bg.width, H / assets.bg.height) * 1.15;
      const bgW = assets.bg.width * bgScale;
      const bgH = assets.bg.height * bgScale;
      const parallax = (state === "playing" || state === "paused" ? cameraX : 0) * 0.2 * ZOOM;
      let bx = -((parallax) % bgW);
      while (bx < W) {
        ctx.globalAlpha = 0.5;
        ctx.drawImage(assets.bg, bx, H - bgH * 0.85, bgW, bgH);
        bx += bgW - 2;
      }
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = theme.bgTint;
    ctx.fillRect(0, 0, W, H);

    if (state === "start") return;

    ctx.save();
    ctx.scale(ZOOM, ZOOM);
    const ox = -cameraX;
    const oy = -cameraY;

    // Hills
    for (const h of hills) {
      const sx = h.x + ox;
      const sy = h.y + oy;
      if (sx + h.w < -20 || sx > W / ZOOM + 20) continue;
      ctx.fillStyle = theme.floor2;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(sx + h.w / 2, sy - h.h, sx + h.w, sy);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fill();
    }

    // Platforms / ground
    for (const p of platforms) {
      const sx = p.x + ox;
      const sy = p.y + oy;
      if (sx + p.w < -20 || sx > W / ZOOM + 20) continue;

      if (p.type === "ground") {
        const tile = 32;
        for (let tx = 0; tx < p.w; tx += tile) {
          for (let ty = 0; ty < p.h; ty += tile) {
            const col = ((Math.floor((p.x + tx) / tile) + Math.floor(ty / tile)) % 2 === 0)
              ? theme.floor1
              : theme.floor2;
            ctx.fillStyle = col;
            ctx.fillRect(sx + tx, sy + ty, Math.min(tile, p.w - tx), Math.min(tile, p.h - ty));
          }
        }
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        ctx.fillRect(sx, sy, p.w, 4);
      } else {
        ctx.fillStyle = theme.floor1;
        ctx.fillRect(sx, sy, p.w, p.h);
        ctx.fillStyle = theme.floor2;
        ctx.fillRect(sx, sy + p.h - 8, p.w, 8);
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.fillRect(sx, sy, p.w, 3);
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.fillRect(sx + p.w - 6, sy, 6, p.h);
      }
    }

    // Level rings
    if (assets.ring) {
      for (const r of rings) {
        if (r.collected) continue;
        const sx = r.x + ox;
        const sy = r.y + oy;
        if (sx < -40 || sx > W / ZOOM + 40) continue;
        r.frame = (r.frame + 0.15) % 4;
        const fi = Math.floor(r.frame);
        const col = fi % 2;
        const row = Math.floor(fi / 2);
        ctx.drawImage(
          assets.ring,
          col * RING_FW, row * RING_FH, RING_FW, RING_FH,
          sx, sy, 40, 40
        );
      }
    }

    // Bombs
    for (const b of bombs) {
      const sx = b.x + ox;
      const by = b.y + Math.sin(b.bob) * 6 + oy;
      if (sx < -30 || sx > W / ZOOM + 30) continue;
      ctx.beginPath();
      ctx.arc(sx, by, b.radius, 0, Math.PI * 2);
      ctx.fillStyle = "#222";
      ctx.fill();
      ctx.strokeStyle = "#555";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = "#aa6622";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(sx, by - b.radius);
      ctx.quadraticCurveTo(sx + 8, by - b.radius - 12, sx + 4, by - b.radius - 18);
      ctx.stroke();
      ctx.fillStyle = "#ff4400";
      ctx.beginPath();
      ctx.arc(sx + 4, by - b.radius - 18, 3 + Math.sin(b.bob * 3) * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.beginPath();
      ctx.arc(sx - 5, by - 5, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Boosters
    for (const bo of boosters) {
      if (bo.used) continue;
      const sx = bo.x + ox;
      const sy = bo.y + oy;
      if (sx < -40 || sx > W / ZOOM + 40) continue;
      const pulse = 1 + Math.sin(bo.pulse) * 0.08;
      ctx.save();
      ctx.translate(sx + bo.w / 2, sy + bo.h / 2);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = "#ff8800";
      ctx.fillRect(-bo.w / 2, -bo.h / 2, bo.w, bo.h);
      ctx.fillStyle = "#ffcc00";
      ctx.fillRect(-bo.w / 2 + 4, -bo.h / 2 + 4, bo.w - 8, bo.h - 8);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("BOOST", 0, 0);
      ctx.restore();
      ctx.fillStyle = `rgba(255,150,0,${0.15 + Math.sin(bo.pulse) * 0.1})`;
      ctx.beginPath();
      ctx.arc(sx + bo.w / 2, sy + bo.h / 2, 40, 0, Math.PI * 2);
      ctx.fill();
    }

    // Scattered hurt rings (visual only — fade out)
    if (assets.ring) {
      for (const r of scatteredRings) {
        const sx = r.x + ox;
        const sy = r.y + oy;
        if (sx < -50 || sx > W / ZOOM + 50) continue;
        const alpha = r.life < 30 ? r.life / 30 : 1;
        ctx.globalAlpha = alpha;
        const fi = Math.floor(r.frame) % 4;
        const col = fi % 2;
        const row = Math.floor(fi / 2);
        ctx.drawImage(
          assets.ring,
          col * RING_FW, row * RING_FH, RING_FW, RING_FH,
          sx - 18, sy - 18, 36, 36
        );
      }
      ctx.globalAlpha = 1;
    }

    // Particles
    for (const p of particles) {
      ctx.globalAlpha = Math.min(1, p.life / 20);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x + ox, p.y + oy, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // Sonic
    if (state === "playing" || state === "paused" || state === "levelComplete" || state === "gameOver") {
      drawSonic(ox, oy);
    }

    // Goal line
    const goalX = worldWidth - 500 + ox;
    if (goalX > -50 && goalX < W / ZOOM + 50) {
      ctx.strokeStyle = "#00ff88";
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 6]);
      ctx.beginPath();
      ctx.moveTo(goalX, oy);
      ctx.lineTo(goalX, oy + H / ZOOM + 200);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#00ff88";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText("GOAL", goalX + 6, oy + 30);
    }

    ctx.restore();
  }

  function drawSonic(ox, oy) {
    if (!assets.sonic) return;

    let frameIndex;
    if (sonic.anim === "jump") {
      frameIndex = JUMP_FRAMES[sonic.frame % 8];
    } else if (sonic.anim === "peelout") {
      frameIndex = PEELOUT_FRAMES[sonic.frame % 4];
    } else {
      frameIndex = RUN_FRAMES[sonic.frame % 4];
    }

    const col = frameIndex % 8;
    const row = Math.floor(frameIndex / 8);

    const sx = sonic.x + ox;
    const sy = sonic.y + oy;

    if (sonic.invincible > 0 && Math.floor(sonic.invincible / 4) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    const dw = sonic.width;
    const dh = sonic.height;

    ctx.drawImage(
      assets.sonic,
      col * SONIC_FW, row * SONIC_FH, SONIC_FW, SONIC_FH,
      sx, sy, dw, dh
    );

    ctx.globalAlpha = 1;

    if (sonic.onGround) {
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath();
      ctx.ellipse(sx + dw / 2, sy + dh + 2, dw * 0.35, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ========== MAIN LOOP ==========
  let lastTime = performance.now();
  function loop(now) {
    const dt = Math.min(32, now - lastTime);
    lastTime = now;

    update(dt);
    draw();

    requestAnimationFrame(loop);
  }

  // ========== INIT ==========
  async function init() {
    try {
      assets.sonic = await loadImage("Sonic.png");
      assets.ring = await loadImage("Ring.png");
      assets.bg = await loadImage("game bg.png");

      assets.sfx.collect = loadAudio("Collect ring.mp3");
      assets.sfx.hurt = loadAudio("Hurt lose rings.mp3");
      assets.sfx.boost = loadAudio("boost.mp3");
      assets.sfx.jump = loadAudio("Jump.mp3");
      assets.sfx.land = loadAudio("Land.mp3");
      assets.music = loadAudio("bg.mp3");

      // Start loop even if on start screen
      requestAnimationFrame(loop);
    } catch (err) {
      console.error("Failed to load assets", err);
      document.body.innerHTML = "<h2 style='color:white;text-align:center;margin-top:40vh'>Failed to load game assets</h2>";
    }
  }

  init();
})();
