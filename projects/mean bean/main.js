import { Renderer } from "./renderer.js";
import { Board } from "./board.js";

const canvas = document.getElementById("game");
const renderer = new Renderer(canvas);

// App states: menu | cpuDiff | cpuVsCpu | playing | paused | gameover
let state = "menu";
let menuCursor = 0;
let subCursor = 0;
let cpuDiffTarget = "player"; // which CPU we're setting: player | cpu1 | cpu2
let selectedDiff = "normal";
let diff1 = "normal";
let diff2 = "normal";
let mode = null;
let players = [];
let paused = false;
let gameOver = false;
let goMessage = "";
let goCursor = 0;
let pauseCursor = 0;
let lastTime = 0;
let animId = null;
let keys = {};
let statusText = "";

const MAIN_ITEMS = ["Solo", "Local 2-Player", "Player vs CPU", "CPU vs CPU", "Controls"];
const DIFF_ITEMS = ["Easy", "Normal", "Hard"];
const DIFF_KEYS = ["easy", "normal", "hard"];
const CVSC_ITEMS = ["CPU 1 Difficulty", "CPU 2 Difficulty", "Start Match"];
const PAUSE_ITEMS = ["Resume", "Quit to Menu"];
const GO_ITEMS = ["Play Again", "Menu"];

function resize() {
  renderer.resize();
}
window.addEventListener("resize", resize);
resize();

function startMatch(m, d1 = "normal", d2 = "normal") {
  mode = m;
  players = [];
  gameOver = false;
  paused = false;

  if (m === "solo") {
    players.push(new Board(0, "Player", false));
    statusText = "Solo — Score Attack   ·   P Pause   Esc Menu";
  } else if (m === "local") {
    players.push(new Board(0, "Player 1", false));
    players.push(new Board(1, "Player 2", false));
    statusText = "Local 2P   ·   P Pause   Esc Menu";
  } else if (m === "cpu") {
    players.push(new Board(0, "You", false));
    players.push(new Board(1, `CPU (${d1})`, true, d1));
    statusText = `vs CPU (${d1})   ·   P Pause   Esc Menu`;
  } else if (m === "cpuVscpu") {
    players.push(new Board(0, `CPU 1 (${d1})`, true, d1));
    players.push(new Board(1, `CPU 2 (${d2})`, true, d2));
    statusText = `CPU vs CPU   ·   P Pause   Esc Menu`;
  }

  for (const p of players) {
    p.onSendGarbage = (fromId, amount) => {
      if (mode === "solo") return;
      for (const other of players) {
        if (other.id !== fromId && other.state !== "dead") other.receiveGarbage(amount);
      }
    };
    p.spawnPair();
  }

  state = "playing";
  lastTime = performance.now();
}

function endGame(msg) {
  gameOver = true;
  state = "gameover";
  goMessage = msg;
  goCursor = 0;
}

function checkWin() {
  if (mode === "solo") {
    if (players[0].state === "dead") endGame(`Final Score: ${players[0].score}`);
    return;
  }
  const alive = players.filter((p) => p.state !== "dead");
  if (alive.length <= 1) {
    if (alive.length === 1) endGame(`${alive[0].name} Wins!`);
    else endGame("Draw!");
  }
}

function quitToMenu() {
  state = "menu";
  menuCursor = 0;
  players = [];
  gameOver = false;
  paused = false;
}

function loop(now) {
  const dt = Math.min(40, now - lastTime);
  lastTime = now;

  if (state === "playing" && !paused && !gameOver) {
    for (const p of players) p.update(dt);
    checkWin();
  }

  // Draw
  if (state === "menu") {
    renderer.drawMenu("main", menuCursor);
  } else if (state === "cpuDiff") {
    renderer.drawMenu("cpuDiff", subCursor, { title: "CPU Difficulty" });
  } else if (state === "cpuVsCpu") {
    renderer.drawMenu("cpuVsCpu", menuCursor, { diff1, diff2 });
  } else if (state === "controls") {
    renderer.drawMenu("controls", 0);
  } else if (state === "playing" || state === "paused" || state === "gameover") {
    renderer.drawPlayfield(players, statusText);
    if (state === "paused") {
      renderer.drawOverlay("Paused", null, PAUSE_ITEMS, pauseCursor);
    } else if (state === "gameover") {
      renderer.drawOverlay("Game Over", goMessage, GO_ITEMS, goCursor);
    }
  }

  animId = requestAnimationFrame(loop);
}

// ========== Input ==========
window.addEventListener("keydown", (e) => {
  keys[e.key] = true;
  const k = e.key;

  // Global pause during play
  if ((k === "p" || k === "P") && state === "playing") {
    state = "paused";
    pauseCursor = 0;
    paused = true;
    e.preventDefault();
    return;
  }

  if (state === "menu") {
    if (k === "ArrowUp") { menuCursor = (menuCursor - 1 + MAIN_ITEMS.length) % MAIN_ITEMS.length; e.preventDefault(); }
    else if (k === "ArrowDown") { menuCursor = (menuCursor + 1) % MAIN_ITEMS.length; e.preventDefault(); }
    else if (k === "Enter") {
      e.preventDefault();
      if (menuCursor === 0) startMatch("solo");
      else if (menuCursor === 1) startMatch("local");
      else if (menuCursor === 2) {
        state = "cpuDiff";
        subCursor = 1;
        cpuDiffTarget = "player";
      } else if (menuCursor === 3) {
        state = "cpuVsCpu";
        menuCursor = 0;
        diff1 = "normal";
        diff2 = "normal";
      } else if (menuCursor === 4) {
        state = "controls";
      }
    }
    return;
  }

  if (state === "cpuDiff") {
    if (k === "ArrowUp") { subCursor = (subCursor - 1 + 3) % 3; e.preventDefault(); }
    else if (k === "ArrowDown") { subCursor = (subCursor + 1) % 3; e.preventDefault(); }
    else if (k === "Escape") { state = "menu"; menuCursor = 2; }
    else if (k === "Enter") {
      e.preventDefault();
      const d = DIFF_KEYS[subCursor];
      if (cpuDiffTarget === "player") startMatch("cpu", d);
      else if (cpuDiffTarget === "cpu1") { diff1 = d; state = "cpuVsCpu"; menuCursor = 0; }
      else if (cpuDiffTarget === "cpu2") { diff2 = d; state = "cpuVsCpu"; menuCursor = 1; }
    }
    return;
  }

  if (state === "cpuVsCpu") {
    if (k === "ArrowUp") { menuCursor = (menuCursor - 1 + CVSC_ITEMS.length) % CVSC_ITEMS.length; e.preventDefault(); }
    else if (k === "ArrowDown") { menuCursor = (menuCursor + 1) % CVSC_ITEMS.length; e.preventDefault(); }
    else if (k === "Escape") { state = "menu"; menuCursor = 3; }
    else if (k === "Enter") {
      e.preventDefault();
      if (menuCursor === 0) { state = "cpuDiff"; subCursor = DIFF_KEYS.indexOf(diff1); cpuDiffTarget = "cpu1"; }
      else if (menuCursor === 1) { state = "cpuDiff"; subCursor = DIFF_KEYS.indexOf(diff2); cpuDiffTarget = "cpu2"; }
      else if (menuCursor === 2) startMatch("cpuVscpu", diff1, diff2);
    }
    return;
  }

  if (state === "controls") {
    if (k === "Escape" || k === "Enter") {
      state = "menu";
      menuCursor = 4;
      e.preventDefault();
    }
    return;
  }

  if (state === "paused") {
    if (k === "ArrowUp" || k === "ArrowDown") {
      pauseCursor = pauseCursor === 0 ? 1 : 0;
      e.preventDefault();
    } else if (k === "Enter") {
      e.preventDefault();
      if (pauseCursor === 0) { state = "playing"; paused = false; }
      else quitToMenu();
    } else if (k === "Escape" || k === "p" || k === "P") {
      state = "playing";
      paused = false;
    }
    return;
  }

  if (state === "gameover") {
    if (k === "ArrowUp" || k === "ArrowDown") {
      goCursor = goCursor === 0 ? 1 : 0;
      e.preventDefault();
    } else if (k === "Enter") {
      e.preventDefault();
      if (goCursor === 0) {
        // replay same mode
        if (mode === "solo") startMatch("solo");
        else if (mode === "local") startMatch("local");
        else if (mode === "cpu") startMatch("cpu", players[1]?.diff || "normal");
        else if (mode === "cpuVscpu") startMatch("cpuVscpu", players[0]?.diff || "normal", players[1]?.diff || "normal");
      } else quitToMenu();
    } else if (k === "Escape") quitToMenu();
    return;
  }

  if (state === "playing" && !paused && !gameOver) {
    if (k === "Escape") {
      state = "paused";
      pauseCursor = 0;
      paused = true;
      return;
    }

    const p1 = players[0];
    const p2 = players[1];

    // P1 human
    if (p1 && !p1.isCPU && p1.state === "falling") {
      if (k === "ArrowLeft") p1.move(-1, 0);
      else if (k === "ArrowRight") p1.move(1, 0);
      else if (k === "ArrowDown") p1.softDrop();
      else if (k === "ArrowUp" || k === "z" || k === "Z") p1.rotate(1);
      else if (k === "x" || k === "X") p1.rotate(-1);
      else if (k === " ") { e.preventDefault(); p1.hardDrop(); }
    }
    // P2 human (local only)
    if (mode === "local" && p2 && !p2.isCPU && p2.state === "falling") {
      if (k === "a" || k === "A") p2.move(-1, 0);
      else if (k === "d" || k === "D") p2.move(1, 0);
      else if (k === "s" || k === "S") p2.softDrop();
      else if (["w", "W", "q", "Q"].includes(k)) p2.rotate(1);
      else if (k === "e" || k === "E") p2.rotate(-1);
      else if (k === "Shift") { e.preventDefault(); p2.hardDrop(); }
    }
  }
});

window.addEventListener("keyup", (e) => { keys[e.key] = false; });

setInterval(() => {
  if (state !== "playing" || paused || gameOver) return;
  const p1 = players[0];
  if (p1 && !p1.isCPU && p1.state === "falling" && keys["ArrowDown"]) p1.softDrop();
  if (mode === "local") {
    const p2 = players[1];
    if (p2 && !p2.isCPU && p2.state === "falling" && (keys["s"] || keys["S"])) p2.softDrop();
  }
}, 55);

lastTime = performance.now();
animId = requestAnimationFrame(loop);
