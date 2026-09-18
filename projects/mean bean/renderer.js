import {
  COLS, ROWS, CELL, SPAWN_COL,
  COLOR_HEX, COLOR_DARK, COLOR_LIGHT,
} from "./constants.js";

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.w = 0;
    this.h = 0;
    this.dpr = 1;
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.floor(this.w * this.dpr);
    this.canvas.height = Math.floor(this.h * this.dpr);
    this.canvas.style.width = this.w + "px";
    this.canvas.style.height = this.h + "px";
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  // ========== Background ==========
  drawBackground() {
    const ctx = this.ctx;
    const g = ctx.createRadialGradient(this.w * 0.3, 0, 0, this.w * 0.5, this.h * 0.5, this.h);
    g.addColorStop(0, "#141428");
    g.addColorStop(0.5, "#0c0c18");
    g.addColorStop(1, "#080810");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  // ========== Menu screens ==========
  drawMenu(screen, cursor, opts = {}) {
    this.drawBackground();
    const ctx = this.ctx;
    const cx = this.w / 2;

    // Title — scale with viewport
    const titleSize = Math.max(36, Math.min(64, this.w * 0.045));
    const subSize = Math.max(14, Math.min(20, this.w * 0.014));
    ctx.textAlign = "center";
    ctx.fillStyle = "#e94560";
    ctx.font = `bold ${titleSize}px system-ui, sans-serif`;
    ctx.shadowColor = "rgba(233,69,96,0.5)";
    ctx.shadowBlur = 20;
    ctx.fillText("MEAN BEAN MACHINE", cx, Math.max(70, this.h * 0.1));
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#9aa0b4";
    ctx.font = `${subSize}px system-ui, sans-serif`;
    ctx.fillText("Falling-Block Color Matcher", cx, Math.max(70, this.h * 0.1) + titleSize * 0.55);

    if (screen === "main") {
      const items = [
        "Solo",
        "Local 2-Player",
        "Player vs CPU",
        "CPU vs CPU",
        "Controls",
      ];
      const startY = Math.max(180, this.h * 0.28);
      this.drawMenuList(items, cursor, startY);
      this.drawHint("↑↓ Navigate   Enter Select   Esc Back");
    } else if (screen === "cpuDiff") {
      ctx.fillStyle = "#eef0f5";
      ctx.font = "22px system-ui, sans-serif";
      ctx.fillText(opts.title || "CPU Difficulty", cx, 160);
      const items = ["Easy", "Normal", "Hard"];
      this.drawMenuList(items, cursor, Math.max(210, this.h * 0.32));
      this.drawHint("↑↓ Navigate   Enter Select   Esc Back");
    } else if (screen === "cpuVsCpu") {
      ctx.fillStyle = "#eef0f5";
      ctx.font = "22px system-ui, sans-serif";
      ctx.fillText("CPU vs CPU — Pick difficulties", cx, 150);
      ctx.font = "16px system-ui, sans-serif";
      ctx.fillStyle = "#9aa0b4";
      ctx.fillText(`CPU 1: ${opts.diff1 || "Normal"}    ·    CPU 2: ${opts.diff2 || "Normal"}`, cx, 185);

      const items = [
        "CPU 1 Difficulty",
        "CPU 2 Difficulty",
        "Start Match",
      ];
      this.drawMenuList(items, cursor, Math.max(230, this.h * 0.35));
      this.drawHint("↑↓ Navigate   Enter Select   Esc Back");
    } else if (screen === "controls") {
      this.drawControlsHelp();
      this.drawHint("Esc / Enter — Back");
    }

    // Decorative beans
    this.drawDecorBeans();
  }

  drawMenuList(items, cursor, startY) {
    const ctx = this.ctx;
    const cx = this.w / 2;
    const rowH = Math.max(48, Math.min(64, this.h * 0.07));
    const boxW = Math.max(300, Math.min(420, this.w * 0.4));
    const fontSize = Math.max(18, Math.min(26, this.w * 0.018));
    items.forEach((label, i) => {
      const y = startY + i * rowH;
      const selected = i === cursor;
      if (selected) {
        ctx.fillStyle = "rgba(233,69,96,0.18)";
        roundRect(ctx, cx - boxW / 2, y - rowH * 0.55, boxW, rowH * 0.85, 12);
        ctx.fill();
        ctx.strokeStyle = "rgba(233,69,96,0.55)";
        ctx.lineWidth = 2;
        roundRect(ctx, cx - boxW / 2, y - rowH * 0.55, boxW, rowH * 0.85, 12);
        ctx.stroke();
      }
      ctx.fillStyle = selected ? "#eef0f5" : "#9aa0b4";
      ctx.font = `${selected ? "bold " : ""}${fontSize}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText((selected ? "▸  " : "   ") + label, cx, y);
    });
  }

  drawHint(text) {
    const ctx = this.ctx;
    ctx.fillStyle = "#6a7080";
    ctx.font = "14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(text, this.w / 2, this.h - 36);
  }

  drawControlsHelp() {
    const ctx = this.ctx;
    const cx = this.w / 2;
    const titleY = Math.max(140, this.h * 0.18);
    const fs = Math.max(15, Math.min(20, this.w * 0.014));

    ctx.fillStyle = "#eef0f5";
    ctx.font = `bold ${Math.max(24, fs + 8)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Controls", cx, titleY);

    const blocks = [
      { title: "Player 1", lines: [
        "← →  Move",
        "↓  Soft Drop",
        "↑ / Z  Rotate CW",
        "X  Rotate CCW",
        "Space  Hard Drop",
      ]},
      { title: "Player 2", lines: [
        "A D  Move",
        "S  Soft Drop",
        "W / Q  Rotate CW",
        "E  Rotate CCW",
        "Shift  Hard Drop",
      ]},
    ];

    const colW = Math.min(280, this.w * 0.35);
    const leftX = cx - colW * 0.7;
    const rightX = cx + colW * 0.7;
    const startY = titleY + 50;

    blocks.forEach((b, bi) => {
      const x = bi === 0 ? leftX : rightX;
      ctx.fillStyle = "#e94560";
      ctx.font = `bold ${fs + 2}px system-ui, sans-serif`;
      ctx.fillText(b.title, x, startY);
      ctx.fillStyle = "#c8ccd8";
      ctx.font = `${fs}px system-ui, sans-serif`;
      b.lines.forEach((line, i) => {
        ctx.fillText(line, x, startY + 36 + i * (fs + 12));
      });
    });

    ctx.fillStyle = "#9aa0b4";
    ctx.font = `${fs}px system-ui, sans-serif`;
    ctx.fillText("P — Pause     ·     Esc — Menu / Back", cx, startY + 36 + 6 * (fs + 12));
  }

  drawDecorBeans() {
    const colors = ["red", "blue", "green", "yellow", "purple"];
    const positions = [
      [this.w * 0.12, this.h * 0.7],
      [this.w * 0.18, this.h * 0.78],
      [this.w * 0.88, this.h * 0.65],
      [this.w * 0.82, this.h * 0.75],
      [this.w * 0.08, this.h * 0.55],
    ];
    positions.forEach(([x, y], i) => {
      this.drawBean(x, y, colors[i % colors.length], 0.7, 0.35);
    });
  }

  // ========== Pause / Game Over overlays ==========
  drawOverlay(title, subtitle, items, cursor) {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(0, 0, this.w, this.h);

    const cx = this.w / 2;
    const cy = this.h / 2 - 40;

    ctx.fillStyle = "#151528";
    roundRect(ctx, cx - 200, cy - 80, 400, 220, 16);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    roundRect(ctx, cx - 200, cy - 80, 400, 220, 16);
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.fillStyle = "#e94560";
    ctx.font = "bold 28px system-ui, sans-serif";
    ctx.fillText(title, cx, cy - 30);

    if (subtitle) {
      ctx.fillStyle = "#9aa0b4";
      ctx.font = "16px system-ui, sans-serif";
      ctx.fillText(subtitle, cx, cy + 2);
    }

    items.forEach((label, i) => {
      const y = cy + 50 + i * 40;
      const selected = i === cursor;
      if (selected) {
        ctx.fillStyle = "rgba(233,69,96,0.2)";
        roundRect(ctx, cx - 120, y - 22, 240, 34, 8);
        ctx.fill();
      }
      ctx.fillStyle = selected ? "#eef0f5" : "#9aa0b4";
      ctx.font = selected ? "bold 18px system-ui, sans-serif" : "17px system-ui, sans-serif";
      ctx.fillText((selected ? "▸ " : "") + label, cx, y);
    });
  }

  // ========== Board drawing ==========
  /** Returns { ox, oy, cell } for board layout */
  boardLayout(index, total) {
    // Maximize cell size to fill the screen
    const topPad = 56;
    const bottomPad = 36;
    const sidePad = 24;
    const gap = total > 1 ? 56 : 0;
    const nextColW = 72; // space for next/garbage panel beside each board

    const availH = this.h - topPad - bottomPad;
    const availW = this.w - sidePad * 2 - total * nextColW - gap * (total - 1);

    const cellByH = Math.floor(availH / ROWS);
    const cellByW = Math.floor(availW / (COLS * total));
    // Prefer large cells; clamp to reasonable min/max
    let cell = Math.min(cellByH, cellByW);
    cell = Math.max(28, Math.min(cell, 72));

    const boardW = COLS * cell;
    const boardH = ROWS * cell;
    const blockW = boardW + nextColW;
    const totalW = total * blockW + gap * (total - 1);
    const startX = Math.max(sidePad, (this.w - totalW) / 2);
    const ox = startX + index * (blockW + gap);
    const oy = topPad + Math.max(0, (availH - boardH) / 2);
    return { ox, oy, cell, boardW, boardH };
  }

  drawBoardFrame(layout, board) {
    const ctx = this.ctx;
    const { ox, oy, cell, boardW, boardH } = layout;

    // Header
    ctx.textAlign = "left";
    ctx.fillStyle = "#eef0f5";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillText(board.name, ox, oy - 28);

    ctx.textAlign = "right";
    ctx.fillStyle = "#f1c40f";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillText(String(board.score), ox + boardW, oy - 28);

    if (board.chain > 1) {
      ctx.textAlign = "center";
      ctx.fillStyle = "#e94560";
      ctx.font = "bold 14px system-ui, sans-serif";
      ctx.fillText(`CHAIN x${board.chain}`, ox + boardW / 2, oy - 10);
    } else if (board.chain === 1) {
      ctx.textAlign = "center";
      ctx.fillStyle = "#e94560";
      ctx.font = "bold 14px system-ui, sans-serif";
      ctx.fillText("CLEAR!", ox + boardW / 2, oy - 10);
    }

    // Board bg
    ctx.fillStyle = "#0c0c18";
    roundRect(ctx, ox - 2, oy - 2, boardW + 4, boardH + 4, 6);
    ctx.fill();
    ctx.strokeStyle = "#2a2a48";
    ctx.lineWidth = 2;
    roundRect(ctx, ox - 2, oy - 2, boardW + 4, boardH + 4, 6);
    ctx.stroke();

    // Inner
    const g = ctx.createRadialGradient(
      ox + boardW / 2, oy + boardH / 2, boardH * 0.15,
      ox + boardW / 2, oy + boardH / 2, boardH * 0.7
    );
    g.addColorStop(0, "#12122a");
    g.addColorStop(1, "#080812");
    ctx.fillStyle = g;
    ctx.fillRect(ox, oy, boardW, boardH);

    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(ox + x * cell + 0.5, oy);
      ctx.lineTo(ox + x * cell + 0.5, oy + boardH);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(ox, oy + y * cell + 0.5);
      ctx.lineTo(ox + boardW, oy + y * cell + 0.5);
      ctx.stroke();
    }

    // Subtle danger line under top row (game-over region)
    ctx.strokeStyle = "rgba(233,69,96,0.28)";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(ox, oy + cell);
    ctx.lineTo(ox + boardW, oy + cell);
    ctx.stroke();
    ctx.setLineDash([]);

    // Next preview
    const nx = ox + boardW + 12;
    const ny = oy;
    ctx.fillStyle = "#9aa0b4";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("NEXT", nx, ny + 12);
    this.drawNextPair(nx, ny + 28, board.nextPair, cell * 0.55);

    // Garbage queue
    if (board.garbageQueue > 0) {
      ctx.fillStyle = "#9aa0b4";
      ctx.font = "11px system-ui, sans-serif";
      ctx.fillText("GARBAGE", nx, ny + 110);
      const show = Math.min(board.garbageQueue, 18);
      for (let i = 0; i < show; i++) {
        ctx.beginPath();
        ctx.arc(nx + 6 + (i % 6) * 12, ny + 128 + Math.floor(i / 6) * 12, 4, 0, Math.PI * 2);
        ctx.fillStyle = COLOR_HEX.garbage;
        ctx.fill();
      }
      if (board.garbageQueue > 18) {
        ctx.fillStyle = "#aaa";
        ctx.font = "11px system-ui, sans-serif";
        ctx.fillText(`+${board.garbageQueue - 18}`, nx, ny + 170);
      }
    }
  }

  drawNextPair(x, y, pair, scale) {
    if (!pair) return;
    const [c1, c2] = pair;
    const r = scale * 0.4;
    if (c1 === c2) {
      this.ctx.fillStyle = COLOR_HEX[c1];
      this.ctx.fillRect(x + scale * 0.2, y + scale * 0.15, scale * 0.5, scale * 1.1);
    }
    this.drawBeanAt(x + scale * 0.45, y + scale * 1.15, c1, scale);
    this.drawBeanAt(x + scale * 0.45, y + scale * 0.35, c2, scale);
  }

  drawBean(px, py, color, scale = 1, alpha = 1) {
    this.drawBeanAt(px, py, color, CELL * scale, alpha);
  }

  drawBeanAt(px, py, color, cellSize, alpha = 1) {
    const ctx = this.ctx;
    const r = cellSize * 0.4;
    ctx.save();
    ctx.globalAlpha = alpha;

    ctx.beginPath();
    ctx.arc(px + 1.5, py + 2.5, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fill();

    const hex = COLOR_HEX[color] || "#888";
    const dark = COLOR_DARK[color] || "#555";
    const light = COLOR_LIGHT[color] || hex;
    const grad = ctx.createRadialGradient(px - r * 0.3, py - r * 0.35, r * 0.08, px, py + r * 0.1, r);
    grad.addColorStop(0, light);
    grad.addColorStop(0.45, hex);
    grad.addColorStop(1, dark);

    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.2)";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(px - r * 0.25, py - r * 0.3, r * 0.28, r * 0.2, -0.4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.42)";
    ctx.fill();

    if (color !== "garbage") {
      const eyeR = r * 0.14;
      ctx.fillStyle = "#1a1a1a";
      ctx.beginPath();
      ctx.arc(px - r * 0.22, py - r * 0.02, eyeR, 0, Math.PI * 2);
      ctx.arc(px + r * 0.22, py - r * 0.02, eyeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(px - r * 0.18, py - r * 0.06, eyeR * 0.4, 0, Math.PI * 2);
      ctx.arc(px + r * 0.26, py - r * 0.06, eyeR * 0.4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = "rgba(40,40,40,0.75)";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(px - r * 0.3, py - r * 0.3);
      ctx.lineTo(px + r * 0.3, py + r * 0.3);
      ctx.moveTo(px + r * 0.3, py - r * 0.3);
      ctx.lineTo(px - r * 0.3, py + r * 0.3);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawLinks(ox, oy, cell, grid) {
    const ctx = this.ctx;
    const r = cell * 0.4;
    const linkW = r * 0.72;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const c = grid[y][x];
        if (!c || c === "garbage") continue;
        const hex = COLOR_HEX[c];
        const px = ox + (x + 0.5) * cell;
        const py = oy + (y + 0.5) * cell;
        if (x + 1 < COLS && grid[y][x + 1] === c) {
          const px2 = ox + (x + 1.5) * cell;
          ctx.fillStyle = hex;
          const hw = linkW / 2;
          ctx.beginPath();
          ctx.moveTo(px, py - hw);
          ctx.lineTo(px2, py - hw);
          ctx.lineTo(px2, py + hw);
          ctx.lineTo(px, py + hw);
          ctx.closePath();
          ctx.fill();
        }
        if (y + 1 < ROWS && grid[y + 1][x] === c) {
          const py2 = oy + (y + 1.5) * cell;
          ctx.fillStyle = hex;
          const hw = linkW / 2;
          ctx.beginPath();
          ctx.moveTo(px - hw, py);
          ctx.lineTo(px + hw, py);
          ctx.lineTo(px + hw, py2);
          ctx.lineTo(px - hw, py2);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  }

  /**
   * Landing ghost + column guides that track the active pair.
   * Uses logical pair cells only (not fallX/fallY) so the preview stays accurate.
   */
  drawGhost(ox, oy, cell, board) {
    if (!board.pair || board.state !== "falling") return;
    const cells = board.getPairCells();
    if (!cells.length) return;

    // How far can the pair drop from its logical position?
    let dy = 0;
    while (dy < ROWS + 2) {
      const test = cells.map((p) => ({ x: p.x, y: p.y + dy + 1, c: p.c }));
      if (!board.canPlace(test)) break;
      dy++;
    }

    const ctx = this.ctx;

    if (dy <= 0) return;

    // Vertical dashed guides from each bean down to landing
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 5]);
    for (const p of cells) {
      const gy = p.y + dy;
      if (gy < 0 || gy >= ROWS) continue;
      // start from below the live bean (use visual Y if available for nicer look)
      const startY = Math.max(p.y, 0);
      const px = ox + (p.x + 0.5) * cell;
      ctx.beginPath();
      ctx.moveTo(px, oy + (startY + 0.55) * cell);
      ctx.lineTo(px, oy + (gy + 0.45) * cell);
      ctx.stroke();
    }
    ctx.restore();

    // Landing outlines
    for (const p of cells) {
      const gy = p.y + dy;
      if (gy < 0 || gy >= ROWS) continue;
      const px = ox + (p.x + 0.5) * cell;
      const py = oy + (gy + 0.5) * cell;
      const hex = COLOR_HEX[p.c] || "#fff";

      ctx.save();
      ctx.beginPath();
      ctx.arc(px, py, cell * 0.38, 0, Math.PI * 2);
      ctx.strokeStyle = hex;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = hex;
      ctx.fill();
      ctx.restore();
    }
  }

  drawBoard(layout, board) {
    const { ox, oy, cell } = layout;
    this.drawBoardFrame(layout, board);

    // Column highlight under active pair (behind beans)
    if (board.pair && board.state === "falling") {
      const cols = new Set(board.getPairCells().map((p) => p.x));
      for (const col of cols) {
        this.ctx.fillStyle = "rgba(233, 69, 96, 0.08)";
        this.ctx.fillRect(ox + col * cell, oy, cell, ROWS * cell);
      }
    }

    this.drawLinks(ox, oy, cell, board.grid);

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const c = board.grid[y][x];
        if (!c) continue;
        this.drawBeanAt(ox + (x + 0.5) * cell, oy + (y + 0.5) * cell, c, cell);
      }
    }

    for (const a of board.gravityAnims) {
      const t = Math.min(1, a.t / a.dur);
      const y = a.fromY + (a.toY - a.fromY) * (1 - Math.pow(1 - t, 3));
      this.drawBeanAt(ox + (a.x + 0.5) * cell, oy + (y + 0.5) * cell, a.color, cell);
    }

    for (const a of board.popAnims) {
      const t = Math.min(1, a.t / a.dur);
      this.drawBeanAt(
        ox + (a.x + 0.5) * cell, oy + (a.y + 0.5) * cell,
        a.color, cell * (1 + t * 0.45), 1 - t
      );
    }

    // particles (board-local coords stored in cell space of CELL — scale)
    const scale = cell / CELL;
    for (const p of board.particles) {
      const life = p.life / p.max;
      this.ctx.globalAlpha = Math.max(0, 1 - life);
      this.ctx.beginPath();
      this.ctx.arc(ox + p.x * scale, oy + p.y * scale, 3.5 * (1 - life * 0.6), 0, Math.PI * 2);
      this.ctx.fillStyle = p.color;
      this.ctx.fill();
    }
    this.ctx.globalAlpha = 1;

    if (board.pair && board.state === "falling") {
      this.drawGhost(ox, oy, cell, board);
      const cells = board.getPairCells();
      const xOff = (board.fallX ?? board.pair.x) - board.pair.x;
      const yOff = board.fallY - board.pair.y;

      if (board.pair.colors[0] === board.pair.colors[1]) {
        const c0 = cells[0], c1 = cells[1];
        const hex = COLOR_HEX[c0.c];
        const r = cell * 0.4;
        const linkW = r * 0.65;
        const x0 = ox + (c0.x + xOff + 0.5) * cell;
        const y0 = oy + (c0.y + yOff + 0.5) * cell;
        const x1 = ox + (c1.x + xOff + 0.5) * cell;
        const y1 = oy + (c1.y + yOff + 0.5) * cell;
        this.ctx.fillStyle = hex;
        this.ctx.beginPath();
        if (Math.abs(c0.x - c1.x) > 0) {
          const midY = (y0 + y1) / 2, hw = linkW / 2;
          this.ctx.moveTo(x0, midY - hw); this.ctx.lineTo(x1, midY - hw);
          this.ctx.lineTo(x1, midY + hw); this.ctx.lineTo(x0, midY + hw);
        } else {
          const hw = linkW / 2;
          this.ctx.moveTo(x0 - hw, y0); this.ctx.lineTo(x0 + hw, y0);
          this.ctx.lineTo(x1 + hw, y1); this.ctx.lineTo(x1 - hw, y1);
        }
        this.ctx.closePath();
        this.ctx.fill();
      }

      for (const p of cells) {
        if (p.y + yOff < -0.6) continue;
        this.drawBeanAt(
          ox + (p.x + xOff + 0.5) * cell,
          oy + (p.y + yOff + 0.5) * cell,
          p.c, cell
        );
      }
    }
  }

  drawPlayfield(players, statusText) {
    this.drawBackground();
    const total = players.length;
    players.forEach((board, i) => {
      const layout = this.boardLayout(i, total);
      this.drawBoard(layout, board);
    });
    if (statusText) {
      this.ctx.fillStyle = "#6a7080";
      this.ctx.font = "13px system-ui, sans-serif";
      this.ctx.textAlign = "center";
      this.ctx.fillText(statusText, this.w / 2, this.h - 20);
    }
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
