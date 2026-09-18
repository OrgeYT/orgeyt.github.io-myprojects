import { COLS, ROWS, SPAWN_COL, cloneGrid } from "./constants.js";

function applyGravity(grid) {
  for (let x = 0; x < COLS; x++) {
    let w = ROWS - 1;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (grid[y][x] !== null) {
        if (w !== y) {
          grid[w][x] = grid[y][x];
          grid[y][x] = null;
        }
        w--;
      }
    }
  }
}

function findGroups(grid) {
  const visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  const groups = [];
  const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const c = grid[y][x];
      if (!c || c === "garbage" || visited[y][x]) continue;
      const stack = [[x, y]];
      const cells = [];
      visited[y][x] = true;
      while (stack.length) {
        const [cx, cy] = stack.pop();
        cells.push([cx, cy]);
        for (const [dx, dy] of dirs) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
          if (visited[ny][nx]) continue;
          if (grid[ny][nx] === c) {
            visited[ny][nx] = true;
            stack.push([nx, ny]);
          }
        }
      }
      if (cells.length >= 4) groups.push(cells);
    }
  }
  return groups;
}

function simClearOnce(grid) {
  const groups = findGroups(grid);
  if (!groups.length) return 0;
  const toClear = new Set();
  let count = 0;
  for (const cells of groups) {
    count += cells.length;
    for (const [x, y] of cells) toClear.add(x + "," + y);
  }
  for (const key of [...toClear]) {
    const parts = key.split(",");
    const x = +parts[0];
    const y = +parts[1];
    for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
      if (grid[ny][nx] === "garbage") toClear.add(nx + "," + ny);
    }
  }
  for (const key of toClear) {
    const parts = key.split(",");
    grid[+parts[1]][+parts[0]] = null;
  }
  applyGravity(grid);
  return count;
}

function simChains(grid) {
  let chain = 0;
  let cleared = 0;
  let garbageCleared = 0;
  for (;;) {
    let gBefore = 0;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (grid[y][x] === "garbage") gBefore++;
      }
    }
    const n = simClearOnce(grid);
    if (n === 0) break;
    chain++;
    cleared += n;
    let gAfter = 0;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (grid[y][x] === "garbage") gAfter++;
      }
    }
    garbageCleared += gBefore - gAfter;
  }
  return { chain: chain, cleared: cleared, garbageCleared: garbageCleared };
}

function columnHeight(grid, x) {
  for (let y = 0; y < ROWS; y++) {
    if (grid[y][x] !== null) return ROWS - y;
  }
  return 0;
}

function avgHeight(grid) {
  let s = 0;
  for (let x = 0; x < COLS; x++) s += columnHeight(grid, x);
  return s / COLS;
}

export function evalGrid(grid, diff) {
  if (!diff) diff = "normal";
  const g = cloneGrid(grid);
  const result = simChains(g);
  const chain = result.chain;
  const cleared = result.cleared;
  const garbageCleared = result.garbageCleared;

  let score = 0;
  score += cleared * 80;
  score += chain * chain * 200;
  score += garbageCleared * 120;

  for (let x = 0; x < COLS; x++) {
    const h = columnHeight(g, x);
    const mult = x === SPAWN_COL ? 18 : 5;
    score -= h * h * mult * 0.15;
    score -= h * mult;
  }

  if (g[0][SPAWN_COL] !== null) score -= 5000;
  if (g[1] && g[1][SPAWN_COL] !== null) score -= 800;

  const visited = Array.from({ length: ROWS }, function () {
    return Array(COLS).fill(false);
  });
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const c = g[y][x];
      if (!c || c === "garbage" || visited[y][x]) continue;
      let size = 0;
      const stack = [[x, y]];
      visited[y][x] = true;
      while (stack.length) {
        const pair = stack.pop();
        const cx = pair[0];
        const cy = pair[1];
        size++;
        for (const d of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
          const nx = cx + d[0];
          const ny = cy + d[1];
          if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
          if (visited[ny][nx]) continue;
          if (g[ny][nx] === c) {
            visited[ny][nx] = true;
            stack.push([nx, ny]);
          }
        }
      }
      if (size >= 2 && size < 4) score += size * size * 6;
      if (size >= 4) score += 100;
    }
  }

  const ah = avgHeight(g);
  if (ah > 6) {
    score += cleared * 100;
    score += garbageCleared * 80;
  }

  if (diff === "easy") {
    score += (Math.random() - 0.5) * 180;
    score *= 0.85;
  } else if (diff === "normal") {
    score += (Math.random() - 0.5) * 40;
  }

  return score;
}

export function runAI(board) {
  if (!board.pair || board.state !== "falling") return;

  let bestScore = -Infinity;
  let best = null;
  const orig = { x: board.pair.x, y: board.pair.y, rot: board.pair.rot };
  const diff = board.diff || "normal";

  const allRots = [0, 1, 2, 3];
  let rots = allRots;
  if (diff === "easy") {
    rots = allRots.filter(function () {
      return Math.random() > 0.25;
    });
    if (!rots.length) rots = [0, 1];
  }

  for (let ri = 0; ri < rots.length; ri++) {
    const rot = rots[ri];
    board.pair.rot = rot;
    for (let col = 0; col < COLS; col++) {
      if (diff === "easy" && Math.random() < 0.2) continue;

      board.pair.x = col;
      board.pair.y = 0;
      let safety = 0;
      while (board.move(0, 1) && safety++ < 24) {}

      const cells = board.getPairCells();
      let valid = true;
      for (let i = 0; i < cells.length; i++) {
        const p = cells[i];
        if (p.y < 0 || p.y >= ROWS || p.x < 0 || p.x >= COLS) {
          valid = false;
          break;
        }
      }
      if (!valid || !board.canPlace(cells)) {
        board.pair.x = orig.x;
        board.pair.y = orig.y;
        board.pair.rot = orig.rot;
        continue;
      }

      const sim = cloneGrid(board.grid);
      for (let i = 0; i < cells.length; i++) {
        const p = cells[i];
        sim[p.y][p.x] = p.c;
      }
      applyGravity(sim);

      const sc = evalGrid(sim, diff);
      if (sc > bestScore) {
        bestScore = sc;
        best = { rot: rot, col: col };
      }

      board.pair.x = orig.x;
      board.pair.y = orig.y;
      board.pair.rot = orig.rot;
    }
  }

  if (!best) {
    board.softDrop();
    return;
  }

  if (board.pair.rot !== best.rot) {
    board.rotate(1);
    return;
  }
  if (board.pair.x < best.col) {
    board.move(1, 0);
  } else if (board.pair.x > best.col) {
    board.move(-1, 0);
  } else {
    const h = columnHeight(board.grid, SPAWN_COL);
    if (diff === "hard" || (diff === "normal" && h >= 5)) {
      board.hardDrop();
    } else {
      board.softDrop();
    }
  }
}
