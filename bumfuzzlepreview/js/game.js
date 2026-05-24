 // core game: state, loader, loop, rendering
import { chartURL, bfImageURL, dadImageURL, gfImageURL, glerpImageURL, snoozerImageURL, bfXMLString, dadXMLString, gfXMLString, glerpXMLString, snoozerXMLString, instAudioURL, bfVoicesURL, oppVoicesURL } from './assets.js';
import { parseXML, Character } from './engine.js';

// canvas & ctx
const canvas = document.getElementById('gameCanvas');
export const ctx = canvas.getContext('2d');
export let width = 0, height = 0;
export function resizeCanvas() {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// game state (export for UI to inspect/control if needed)
export const gameState = {
  playing: false, paused: false, startTime: 0, currentTime: 0,
  bpm: 100, crotchet: 600, lastBeat: 0, notes: [], cameraPans: [],
  noteIndex: 0, panIndex: 0,
  loadedAssets: [] // populated by loadAssets()
};

export const camera = { x: 0, y: 0, targetX: 0, targetY: 0, zoom: 0.9, baseZoom: 0.9, zoomTarget: 0.9 };
export const mapDir = ['left', 'down', 'up', 'right'];

export let bf, dad, gf, glerp, snoozer;
export let instAudio, bfVoicesAudio, oppVoicesAudio;

let gfDanceRight = false;
let lastFrameTime = 0;

export async function loadAssets() {
  const loadImage = src => new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });

  try {
    const [bfImg, dadImg, gfImg, glerpImg, snoozerImg, chartRes] = await Promise.all([
      loadImage(bfImageURL),
      loadImage(dadImageURL),
      loadImage(gfImageURL),
      loadImage(glerpImageURL),
      loadImage(snoozerImageURL),
      fetch(chartURL)
    ]);

    instAudio = new Audio(instAudioURL);
    oppVoicesAudio = new Audio(oppVoicesURL);
    bfVoicesAudio = new Audio(bfVoicesURL);

    const chartData = await chartRes.json();
    const songData = (typeof chartData.song === 'object' && chartData.song !== null) ? chartData.song : chartData;

    gameState.bpm = songData.bpm || 150;
    gameState.crotchet = 60000 / gameState.bpm;

    let currentTimeMs = 0;
    gameState.cameraPans = [];
    gameState.notes = [];

    songData.notes.forEach(section => {
      gameState.cameraPans.push({
        time: currentTimeMs,
        target: section.mustHitSection ? 'bf' : 'dad'
      });
      section.sectionNotes.forEach(noteData => {
        gameState.notes.push({
          time: noteData[0],
          type: noteData[1],
          sustain: noteData[2] || 0,
          hit: false
        });
      });
      currentTimeMs += gameState.crotchet * (section.sectionBeats || 4);
    });

    gameState.notes.sort((a, b) => a.time - b.time);
    gameState.cameraPans.sort((a, b) => a.time - b.time);

    bf = new Character(bfImg, parseXML(bfXMLString), 1.2, false);
    dad = new Character(dadImg, parseXML(dadXMLString), 1.2, false);
    gf = new Character(gfImg, parseXML(gfXMLString), 1.1, false);
    glerp = new Character(glerpImg, parseXML(glerpXMLString), 1.0, false);

    gf.x = 0; gf.y = 300;
    dad.x = -350; dad.y = 300;
    bf.x = 350; bf.y = 300;
    // place glerp behind BF, further back and on the same baseline so it stands on the ground
    glerp.x = bf.x + 420; // moved further away behind BF
    glerp.y = bf.y;      // same baseline as BF so glerp stands on the ground
    // ensure glerp loops its base animation (third arg = loop)
    glerp.play(Object.keys(glerp.frames)[0] || 'glerpbert', true, true);

    // create snoozer behind the opponent and loop its base animation
    snoozer = new Character(snoozerImg, parseXML(snoozerXMLString), 0.9, false);
    snoozer.x = dad.x - 420; // place snoozer further left (behind opponent)
    snoozer.y = dad.y;
    snoozer.play(Object.keys(snoozer.frames)[0] || 'snoozer', true, true);

    // list of loaded assets for UI display
    gameState.loadedAssets = [
      { name: "Chart JSON", url: chartURL },
      { name: "Boyfriend Image", url: bfImageURL },
      { name: "Opponent (Dad) Image", url: dadImageURL },
      { name: "Girlfriend Image", url: gfImageURL },
      { name: "Glerpbert Image", url: glerpImageURL },
      { name: "Snoozer Image", url: snoozerImageURL },
      { name: "Instrumental Audio", url: instAudio?.src || "instAudio" },
      { name: "Opponent Voices Audio", url: oppVoicesAudio?.src || "oppVoicesAudio" },
      { name: "BF Voices Audio", url: bfVoicesAudio?.src || "bfVoicesAudio" }
    ];

    return true;
  } catch (err) {
    console.error("Failed to load assets:", err);
    throw err;
  }
}

export function startGame() {
  gameState.playing = true;
  gameState.paused = false;
  gameState.noteIndex = 0;
  gameState.panIndex = 0;
  gameState.lastBeat = 0;
  gameState.notes.forEach(n => n.hit = false);

  if (instAudio) {
    instAudio.currentTime = 0;
    oppVoicesAudio.currentTime = 0;
    bfVoicesAudio.currentTime = 0;
    instAudio.play();
    oppVoicesAudio.play();
    bfVoicesAudio.play();
  }

  gameState.startTime = performance.now();
  lastFrameTime = performance.now();
  requestAnimationFrame(loop);
}

export function pauseGame() {
  if (!gameState.playing || gameState.paused) return;
  gameState.paused = true;
  if (instAudio) { instAudio.pause(); oppVoicesAudio.pause(); bfVoicesAudio.pause(); }
}

export function resumeGame() {
  if (!gameState.playing || !gameState.paused) return;
  gameState.paused = false;
  if (instAudio) { instAudio.play(); oppVoicesAudio.play(); bfVoicesAudio.play(); }
  lastFrameTime = performance.now();
  requestAnimationFrame(loop);
}

export function restartGame() {
  startGame();
}

function loop(now) {
  if (!gameState.playing || gameState.paused) return;
  const dt = now - lastFrameTime;
  lastFrameTime = now;

  if (instAudio && !instAudio.paused) {
    gameState.currentTime = instAudio.currentTime * 1000;
  } else {
    gameState.currentTime = now - gameState.startTime;
  }

  while (gameState.panIndex < gameState.cameraPans.length && gameState.currentTime >= gameState.cameraPans[gameState.panIndex].time) {
    const pan = gameState.cameraPans[gameState.panIndex];
    if (pan.target === 'bf') { camera.targetX = bf.x - 100; camera.targetY = bf.y - 300; }
    else { camera.targetX = dad.x + 100; camera.targetY = dad.y - 300; }
    gameState.panIndex++;
  }

  while (gameState.noteIndex < gameState.notes.length && gameState.currentTime >= gameState.notes[gameState.noteIndex].time) {
    const note = gameState.notes[gameState.noteIndex];
    note.hit = true;
    if (note.type >= 0 && note.type <= 3) {
      bf.play(mapDir[note.type], true);
      bf.singDuration = Math.max(note.sustain, gameState.crotchet * 0.75);
    } else if (note.type >= 4 && note.type <= 7) {
      dad.play(mapDir[note.type - 4], true);
      dad.singDuration = Math.max(note.sustain, gameState.crotchet * 0.75);
    }
    gameState.noteIndex++;
  }

  const currentBeat = Math.floor(gameState.currentTime / gameState.crotchet);
  if (currentBeat > gameState.lastBeat) {
    gameState.lastBeat = currentBeat;
    camera.zoom += 0.015;
    if (bf.singDuration <= 0) bf.play('idle', true);
    if (dad.singDuration <= 0) dad.play('idle', true);
    gfDanceRight = !gfDanceRight;
    gf.play(gfDanceRight ? 'right' : 'left', true);
  }

  if (bf.singDuration <= 0 && bf.currentAnim !== 'idle') bf.play('idle');
  if (dad.singDuration <= 0 && dad.currentAnim !== 'idle') dad.play('idle');

  // update characters (include snoozer and glerp)
  gf.update(dt);
  if (snoozer) snoozer.update(dt);
  dad.update(dt);
  bf.update(dt);
  if (glerp) glerp.update(dt);

  camera.x += (camera.targetX - camera.x) * 0.05;
  camera.y += (camera.targetY - camera.y) * 0.05;
  camera.zoom += (camera.baseZoom - camera.zoom) * 0.05;

  render();

  const isFinished = instAudio ? instAudio.ended : (gameState.noteIndex >= gameState.notes.length && gameState.currentTime > gameState.notes[gameState.notes.length - 1].time + 2000);
  if (isFinished) {
    startGame();
  } else {
    requestAnimationFrame(loop);
  }
}

export function render() {
  // animated parallax grid background
  ctx.clearRect(0, 0, width, height);

  // grid parameters
  const t = gameState.currentTime || performance.now();
  const baseSize = 60; // base cell size in px
  const zoomFactor = 1 + (camera.zoom - camera.baseZoom) * 2;
  const cell = Math.max(24, baseSize * zoomFactor);
  const subCell = cell / 4;

  // animated offsets for parallax
  const offsetX = (t * 0.03) % cell;
  const offsetY = (t * 0.02) % cell;

  // background subtle gradient
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#f5f7fa');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);

  // draw faint large grid
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  for (let x = -cell + (-offsetX); x < width + cell; x += cell) {
    ctx.beginPath();
    ctx.moveTo(x + (width/2 - camera.x*camera.zoom) % cell, 0);
    ctx.lineTo(x + (width/2 - camera.x*camera.zoom) % cell, height);
    ctx.stroke();
  }
  for (let y = -cell + (-offsetY); y < height + cell; y += cell) {
    ctx.beginPath();
    ctx.moveTo(0, y + (height/2 - camera.y*camera.zoom) % cell);
    ctx.lineTo(width, y + (height/2 - camera.y*camera.zoom) % cell);
    ctx.stroke();
  }
  ctx.restore();

  // draw denser sub-grid for depth
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  for (let x = -subCell + (-offsetX*1.5); x < width + subCell; x += subCell) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = -subCell + (-offsetY*1.5); y < height + subCell; y += subCell) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();

  // subtle vignette to frame the scene
  ctx.save();
  const vignette = ctx.createRadialGradient(width/2, height/2, Math.min(width, height)*0.2, width/2, height/2, Math.max(width, height)*0.7);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.06)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  // core scene rendering (camera transform + ground)
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);

  ctx.fillStyle = '#666666';
  ctx.fillRect(-2000, 300, 4000, 1000);

  // draw glerp behind BF so it appears in background
  if (glerp) glerp.draw(ctx);

  // draw gf, then snoozer behind opponent, then opponent and bf
  gf.draw(ctx);
  if (snoozer) snoozer.draw(ctx);
  dad.draw(ctx);
  bf.draw(ctx);

  ctx.restore();

  // progress/time bar (guarded against NaN/Infinity)
  // ensure currentTime is a finite number
  if (!isFinite(gameState.currentTime) || Number.isNaN(gameState.currentTime)) {
    gameState.currentTime = 0;
  }

  let duration = 0;
  if (instAudio && Number.isFinite(instAudio.duration) && instAudio.duration > 0) {
    duration = instAudio.duration * 1000;
  } else if (gameState.notes.length > 0) {
    duration = gameState.notes[gameState.notes.length - 1].time + 2000;
  }

  // fallback if duration is invalid
  if (!isFinite(duration) || Number.isNaN(duration) || duration <= 0) {
    duration = 0;
  }

  if (duration > 0) {
    const progress = Math.max(0, Math.min(1, gameState.currentTime / duration));
    const barWidth = Math.min(600, width * 0.8);
    const barHeight = 24;
    const barX = (width - barWidth) / 2;
    const barY = 25;

    ctx.fillStyle = '#000000';
    ctx.fillRect(barX - 4, barY - 4, barWidth + 8, barHeight + 8);
    ctx.fillStyle = '#444444';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    ctx.fillStyle = '#00ffcc';
    ctx.fillRect(barX, barY, barWidth * progress, barHeight);

    const formatTime = (ms) => {
      if (!isFinite(ms) || Number.isNaN(ms) || ms < 0) ms = 0;
      let totalSecs = Math.floor(ms / 1000);
      let mins = Math.floor(totalSecs / 60);
      let secs = totalSecs % 60;
      return mins + ":" + (secs < 10 ? "0" : "") + secs;
    };

    const timeText = formatTime(gameState.currentTime) + " / " + formatTime(duration);
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.strokeText(timeText, width / 2, barY + barHeight / 2);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(timeText, width / 2, barY + barHeight / 2);
  }
}