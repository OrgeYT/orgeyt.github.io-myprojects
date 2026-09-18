import {
  COLS, ROWS, CELL, SPAWN_COL, COLOR_HEX, CHAIN_POWER,
  emptyGrid, makePair,
} from "./constants.js";
import { runAI } from "./ai.js";

export class Board {
  constructor(id, name, isCPU = false, diff = "normal") {
    this.id = id;
    this.name = name;
    this.isCPU = isCPU;
    this.diff = diff;
    this.grid = emptyGrid();
    this.pair = null;
    this.nextPair = makePair();
    this.score = 0;
    this.chain = 0;
    this.garbageQueue = 0;
    this.dropTimer = 0;
    this.dropInterval = 900;
    this.lockDelay = 0;
    this.state = "falling";
    this.flashTimer = 0;
    this.comboScore = 0;
    this.chainSteps = []; // { groups, puyos, chain } per clear step this cascade
    this.level = 1;
    this.piecesDropped = 0;
    this.aiTimer = 0;
    this.fallY = 0;
    this.fallX = 0;
    this.gravityAnims = [];
    this.popAnims = [];
    this.particles = [];
    this.moveCooldown = 0;
    this.onSendGarbage = null;
  }

  spawnPair() {
    if (this.grid[0][SPAWN_COL] !== null) {
      this.state = "dead";
      return false;
    }
    const colors = this.nextPair;
    this.nextPair = makePair();
    this.pair = { colors: colors.slice(), x: SPAWN_COL, y: 1, rot: 0 };
    if (!this.canPlace(this.getPairCells())) {
      this.pair.y = 0;
      if (!this.canPlace(this.getPairCells())) {
        this.state = "dead";
        this.pair = null;
        return false;
      }
    }
    this.fallY = this.pair.y;
    this.fallX = this.pair.x;
    this.state = "falling";
    this.dropTimer = 0;
    this.lockDelay = 0;
    this.piecesDropped++;
    if (this.piecesDropped % 12 === 0) {
      this.level = Math.min(12, this.level + 1);
      this.dropInterval = Math.max(160, 900 - (this.level - 1) * 55);
    }
    return true;
  }

  getPairCells() {
    if (!this.pair) return [];
    const { x, y, rot, colors } = this.pair;
    if (rot === 0) return [{ x, y, c: colors[0] }, { x, y: y - 1, c: colors[1] }];
    if (rot === 1) return [{ x, y, c: colors[0] }, { x: x + 1, y, c: colors[1] }];
    if (rot === 2) return [{ x, y, c: colors[0] }, { x, y: y + 1, c: colors[1] }];
    return [{ x, y, c: colors[0] }, { x: x - 1, y, c: colors[1] }];
  }

  canPlace(cells) {
    for (const p of cells) {
      if (p.x < 0 || p.x >= COLS) return false;
      if (p.y >= ROWS) return false;
      if (p.y < 0) continue;
      if (this.grid[p.y][p.x] !== null) return false;
    }
    return true;
  }

  move(dx, dy) {
    if (this.state !== "falling" || !this.pair) return false;
    if (this.moveCooldown > 0 && dx !== 0) return false;
    const oldX = this.pair.x, oldY = this.pair.y;
    this.pair.x += dx;
    this.pair.y += dy;
    if (!this.canPlace(this.getPairCells())) {
      this.pair.x = oldX; this.pair.y = oldY;
      return false;
    }
    if (dx !== 0) this.moveCooldown = 55;
    if (dy > 0) { this.lockDelay = 0; this.fallY = this.pair.y; }
    return true;
  }

  rotate(dir) {
    if (this.state !== "falling" || !this.pair) return false;
    const oldRot = this.pair.rot, oldX = this.pair.x, oldY = this.pair.y;
    this.pair.rot = (this.pair.rot + dir + 4) % 4;
    if (this.canPlace(this.getPairCells())) return true;
    for (const [kx, ky] of [[1,0],[-1,0],[0,-1],[2,0],[-2,0],[0,1],[1,-1],[-1,-1]]) {
      this.pair.x = oldX + kx; this.pair.y = oldY + ky;
      if (this.canPlace(this.getPairCells())) return true;
    }
    this.pair.rot = oldRot; this.pair.x = oldX; this.pair.y = oldY;
    return false;
  }

  hardDrop() {
    if (this.state !== "falling" || !this.pair) return;
    let dropped = 0;
    while (this.move(0, 1)) dropped++;
    this.score += dropped;
    this.fallY = this.pair.y;
    this.fallX = this.pair.x;
    this.lockPair();
  }

  softDrop() {
    if (this.move(0, 1)) {
      this.score += 1;
      this.dropTimer = 0;
    }
  }

  lockPair() {
    if (!this.pair) return;
    for (const p of this.getPairCells()) {
      if (p.y >= 0 && p.y < ROWS && p.x >= 0 && p.x < COLS) this.grid[p.y][p.x] = p.c;
    }
    this.pair = null;
    this.chainSteps = [];
    this.comboScore = 0;
    this.startGravity(true);
  }

  startGravity(afterLock = false) {
    this.gravityAnims = [];
    const targets = emptyGrid();
    for (let x = 0; x < COLS; x++) {
      let write = ROWS - 1;
      for (let y = ROWS - 1; y >= 0; y--) {
        if (this.grid[y][x] !== null) {
          targets[write][x] = this.grid[y][x];
          if (write !== y) {
            this.gravityAnims.push({
              x, fromY: y, toY: write, color: this.grid[y][x],
              t: 0, dur: 100 + (write - y) * 28,
            });
          }
          write--;
        }
      }
    }
    for (const a of this.gravityAnims) this.grid[a.fromY][a.x] = null;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (targets[y][x] && !this.gravityAnims.some((a) => a.x === x && a.toY === y)) {
          this.grid[y][x] = targets[y][x];
        }
      }
    }
    if (this.gravityAnims.length === 0) {
      this.state = "clearing";
      this.flashTimer = afterLock ? 35 : 55;
      return;
    }
    this.state = "gravity";
  }

  finishGravity() {
    for (const a of this.gravityAnims) this.grid[a.toY][a.x] = a.color;
    this.gravityAnims = [];
    this.state = "clearing";
    this.flashTimer = 45;
  }

  findGroups() {
    const visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    const groups = [];
    const dirs = [[0,1],[1,0],[0,-1],[-1,0]];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const c = this.grid[y][x];
        if (!c || c === "garbage" || visited[y][x]) continue;
        const stack = [[x, y]], cells = [];
        visited[y][x] = true;
        while (stack.length) {
          const [cx, cy] = stack.pop();
          cells.push([cx, cy]);
          for (const [dx, dy] of dirs) {
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
            if (visited[ny][nx]) continue;
            if (this.grid[ny][nx] === c) { visited[ny][nx] = true; stack.push([nx, ny]); }
          }
        }
        if (cells.length >= 4) groups.push({ color: c, cells });
      }
    }
    return groups;
  }

  processClears() {
    const groups = this.findGroups();
    if (groups.length === 0) {
      if (this.chain > 0) this.sendGarbage();
      this.chain = 0;
      this.chainSteps = [];
      if (this.garbageQueue > 0) this.dropGarbage();
      if (this.grid[0][SPAWN_COL] !== null) { this.state = "dead"; return; }
      this.spawnPair();
      return;
    }
    this.chain++;
    let puyoCount = 0;
    const toClear = new Set();
    for (const g of groups) {
      puyoCount += g.cells.length;
      for (const [x, y] of g.cells) toClear.add(`${x},${y}`);
    }
    this.chainSteps.push({ groups: groups.length, puyos: puyoCount, chain: this.chain });
    for (const key of [...toClear]) {
      const [x, y] = key.split(",").map(Number);
      for (const [dx, dy] of [[0,1],[1,0],[0,-1],[-1,0]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
        if (this.grid[ny][nx] === "garbage") toClear.add(`${nx},${ny}`);
      }
    }
    const cp = CHAIN_POWER[Math.min(this.chain, CHAIN_POWER.length - 1)] || this.chain * 32;
    const groupBonus = Math.max(0, puyoCount - 4);
    const scoreAdd = 10 * puyoCount * Math.max(1, cp + groupBonus);
    this.score += scoreAdd;
    this.comboScore += scoreAdd;

    this.popAnims = [];
    for (const key of toClear) {
      const [x, y] = key.split(",").map(Number);
      const color = this.grid[y][x];
      this.popAnims.push({ x, y, color, t: 0, dur: 300 });
      const hex = COLOR_HEX[color] || "#888";
      for (let i = 0; i < 7; i++) {
        const angle = (Math.PI * 2 * i) / 7 + Math.random() * 0.35;
        const speed = 50 + Math.random() * 70;
        this.particles.push({
          x: (x + 0.5) * CELL, y: (y + 0.5) * CELL,
          vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 40,
          color: hex, life: 0, max: 320 + Math.random() * 160,
        });
      }
      this.grid[y][x] = null;
    }
    this.flashTimer = 300;
    this.state = "flashing";
  }

  finishClear() {
    this.popAnims = [];
    this.startGravity(false);
  }

  sendGarbage() {
    /**
     * Garbage rules:
     * - Single 4-clear (1 group, chain step 1): 1–2 small beans
     * - 2+ groups in the same step: 1 mega (counts as 6 = one full row wave)
     * - Stacked chains (chain 2, 3, …): more smalls; every 6 smalls coalesce into a mega
     */
    let small = 0;
    let mega = 0;

    for (const step of this.chainSteps) {
      if (step.groups >= 2) {
        // Simultaneous multi-clear → one mega wave
        mega += 1;
        // Extra groups beyond 2 add a bit more
        if (step.groups >= 3) small += step.groups - 2;
      } else {
        // Single group clear
        if (step.chain === 1) {
          // Plain single 4 (or a bit more)
          small += step.puyos <= 4 ? 1 : 2;
        } else {
          // Later links in a chain: scale with chain index
          // chain 2 → 2, chain 3 → 4, chain 4 → 6, ...
          small += Math.min(12, step.chain * 2);
          if (step.puyos > 4) small += 1;
        }
      }
    }

    // Coalesce smalls into megas (6 small = 1 mega)
    mega += Math.floor(small / 6);
    small = small % 6;

    // Total nuisance units (mega = 6)
    const amount = mega * 6 + small;
    this.comboScore = 0;
    this.chainSteps = [];
    if (amount <= 0) return;
    if (typeof this.onSendGarbage === "function") {
      this.onSendGarbage(this.id, amount);
    }
  }

  receiveGarbage(amount) {
    this.garbageQueue += amount;
  }

  dropGarbage() {
    // Drop megas first as full rows, then leftover smalls.
    // Cap this wave so the board can still play.
    let left = this.garbageQueue;
    if (left <= 0) return;

    const maxThisWave = COLS * 5; // safety cap
    let toDrop = Math.min(left, maxThisWave);
    this.garbageQueue -= toDrop;

    // How many full mega rows can we drop?
    let megas = Math.floor(toDrop / 6);
    let smalls = toDrop % 6;

    const placeOnStack = (x) => {
      // y=0 top, y=ROWS-1 bottom. Place just above current stack top.
      let topY = ROWS;
      for (let y = 0; y < ROWS; y++) {
        if (this.grid[y][x] !== null) {
          topY = y;
          break;
        }
      }
      const py = topY === ROWS ? ROWS - 1 : topY - 1;
      if (py >= 0 && this.grid[py][x] === null) {
        this.grid[py][x] = "garbage";
        return true;
      }
      return false;
    };

    // Mega = attempt one full row (all 6 columns)
    for (let m = 0; m < megas; m++) {
      let placed = 0;
      const order = [0, 1, 2, 3, 4, 5];
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = order[i]; order[i] = order[j]; order[j] = t;
      }
      for (const x of order) {
        if (placeOnStack(x)) placed++;
      }
      // If row couldn't fully place, remaining of this mega become smalls next wave
      if (placed < 6) {
        this.garbageQueue += 6 - placed;
      }
    }

    // Leftover smalls — random columns
    const cols = [0, 1, 2, 3, 4, 5];
    for (let i = cols.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = cols[i]; cols[i] = cols[j]; cols[j] = t;
    }
    let si = 0;
    while (smalls > 0 && si < 30) {
      const x = cols[si % cols.length];
      if (placeOnStack(x)) smalls--;
      si++;
    }
    if (smalls > 0) this.garbageQueue += smalls;

    if (this.grid[0][SPAWN_COL] !== null) this.state = "dead";
  }

  update(dt) {
    if (this.state === "dead") return;
    if (this.moveCooldown > 0) this.moveCooldown -= dt;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      p.x += p.vx * (dt / 1000);
      p.y += p.vy * (dt / 1000);
      p.vy += 200 * (dt / 1000);
      if (p.life >= p.max) this.particles.splice(i, 1);
    }

    if (this.state === "flashing") {
      for (const a of this.popAnims) a.t += dt;
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) this.finishClear();
      return;
    }
    if (this.state === "gravity") {
      let allDone = true;
      for (const a of this.gravityAnims) {
        a.t += dt;
        if (a.t < a.dur) allDone = false;
      }
      if (allDone) this.finishGravity();
      return;
    }
    if (this.state === "clearing") {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) this.processClears();
      return;
    }
    if (this.state === "falling" && this.pair) {
      const targetY = this.pair.y;
      if (this.fallY < targetY) this.fallY = Math.min(targetY, this.fallY + (dt / this.dropInterval) * 1.2);
      else this.fallY = targetY;

      const targetX = this.pair.x;
      const dx = targetX - this.fallX;
      if (Math.abs(dx) < 0.02) this.fallX = targetX;
      else {
        const speed = 14;
        this.fallX += Math.sign(dx) * Math.min(Math.abs(dx), speed * (dt / 1000));
      }

      this.dropTimer += dt;
      if (this.dropTimer >= this.dropInterval) {
        this.dropTimer = 0;
        if (!this.move(0, 1)) {
          this.lockDelay += this.dropInterval;
          if (this.lockDelay >= 450) this.lockPair();
        } else this.lockDelay = 0;
      }

      if (this.isCPU) {
        this.aiTimer += dt;
        const interval = this.diff === "easy" ? 320 : this.diff === "normal" ? 140 : 60;
        if (this.aiTimer >= interval) {
          this.aiTimer = 0;
          runAI(this);
        }
      }
    }
  }
}
