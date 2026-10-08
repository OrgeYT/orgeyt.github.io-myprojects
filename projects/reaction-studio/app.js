/* Reaction Studio – simple daily-use editor
   Speech bubbles always hover above the character
   and can force a character expression while active. */

const EXPRESSIONS = [
  "Normal","Happy","Sad","Mad","Ew","Oh...","Confused",
  "Scared","Nervous","Realization","Thinking","Shy","Yeah!!","Faceless"
];
const SOUNDBOARD = [
  "a-few-moments-later","air-horn","among-us-kill","among-us-role-reveal","anderdingus",
  "anime-wow","apple-pay","asdasd","autotune-laugh","back-up","bad-to-the-bone",
  "ben-hohohoh","bing-chilling","bloxy-cola","bone-crack","bonk","bruh","camera-shutter",
  "car-crash","cat-iphone-ringtone","cat-laugh","censor-beep","cha-ching-money","clapping",
  "concrete-scrape","confetti-pop","ding","discord-leave","discord-notification","downer-noise",
  "dun-dun-dun","enrique","error","explosion-meme","faah","fart-with-reverb","fart",
  "fortnite-death","galaxy","gopgopgop","gta-ah-shit","gta-death","gunshot","heavenly-music",
  "huh","i-farted","i-like-ya-cut-g","kids-saying-yay","lack-of-a-father-figure","laugh",
  "long-brain-fart","mafioso-scream","man-snoring","metal-pipe","michael-dont-leave-me-here",
  "minecraft-explosion","nanannonono","no-no-wait-wait","nope","notification",
  "oh-hell-nah","oh-my-god","oh-no-no-no-no-laugh","oh-no-no-no-tiktok","oi-oi-oe","oi-oi",
  "orgeyt","pc-explosion","pluh","prowler","quack","raaar","rizz","roblox-bye",
  "roblox-eating","roblox-explosion","roblox-hi","roblox-its-free","roblox-oof",
  "roblox-screaming-kid","roblox-sword","sad-meow-song","scream","shut-your-mouth",
  "skibidi-toilet","smoke-detector","spider-man","spongebob-fail","studio-audience-awwww",
  "sus-meow","taco-bell","take-off","talking-ben-no","talking-ben-ugh","talking-ben-yes",
  "undertaker-bell","undertale-gameover","uwu","vine-boom","weeeee","well-be-right-back",
  "what-the-dog-doing","wilhelm-scream","wrong-answer","yeah-boi","yeahoo","yes-lara",
  "yippee","your-phone-ringing","youre-fine"
];
const STORAGE_KEY = "rve_project_v4";

const state = {
  videos: [],
  texts: [],
  sounds: [],
  speeches: [], // { id, text, start, end, expression }
  character: {
    visible: true,
    expression: "Normal",
    x: 82, y: 72, scale: 1,
    keyframes: [],
    customImages: {}, // { expressionName: dataURL }
    slide: null
  },
  totalDuration: 0,
  currentTime: 0,
  playing: false,
  pixelsPerSecond: 40,
  recording: false,
  exportAbort: false,
  masterVol: 1,
  dirty: false
};

let charImages = {};       // default built-in
let customCharImages = {}; // loaded Image objects for custom
let pendingExprUpload = null; // which expression slot is waiting for a file
let animFrameId = null;
let activeVideoEl = null;
let mediaRecorder = null;
let recordedChunks = [];
let sharedAudioCtx = null; // persistent — MediaElementSource can only connect once
let sharedMasterGain = null;

const drag = { active: false, startMX: 0, startMY: 0, startX: 0, startY: 0, charRect: null };

const canvas = document.getElementById("preview-canvas");
const ctx = canvas.getContext("2d", { alpha: false });
const uploadOverlay = document.getElementById("upload-overlay");
const seekBar = document.getElementById("seek-bar");
const timeDisplay = document.getElementById("time-display");
const btnPlay = document.getElementById("btn-play");
const btnPause = document.getElementById("btn-pause");
const btnStop = document.getElementById("btn-stop");
const btnExport = document.getElementById("btn-export");
const exportStatus = document.getElementById("export-status");
const timelineEl = document.getElementById("timeline");
const timelineTracks = document.getElementById("timeline-tracks");
const timelineRuler = document.getElementById("timeline-ruler");
const playhead = document.getElementById("playhead");
const saveIndicator = document.getElementById("save-indicator");
const canvasWrap = document.getElementById("canvas-wrap");

const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const lerp = (a,b,t) => a + (b - a) * t;
function fmtTime(s) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60), cs = Math.floor((s % 1) * 10);
  return `${m}:${sec.toString().padStart(2,"0")}.${cs}`;
}
function escapeHtml(str) {
  return String(str ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function getCharImage(expr) {
  const key = expr || "Normal";
  if (customCharImages[key] && customCharImages[key].complete && customCharImages[key].naturalWidth) {
    return customCharImages[key];
  }
  // fallback: any custom image if this expression has none (e.g. single-image mode)
  if (Object.keys(customCharImages).length) {
    const first = Object.values(customCharImages).find(im => im && im.complete && im.naturalWidth);
    if (first) return first;
  }
  let img = charImages[key] || charImages["Normal"];
  if (!img || !img.complete || !img.naturalWidth) img = charImages["Normal"];
  return img;
}

async function loadCustomFromDataUrls(map) {
  customCharImages = {};
  if (!map) return;
  const entries = Object.entries(map);
  await Promise.all(entries.map(([exp, dataUrl]) => new Promise(resolve => {
    if (!dataUrl) { resolve(); return; }
    const img = new Image();
    img.onload = () => { customCharImages[exp] = img; resolve(); };
    img.onerror = () => resolve();
    img.src = dataUrl;
  })));
}

function renderExprGrid() {
  const grid = document.getElementById("expr-grid");
  if (!grid) return;
  grid.innerHTML = EXPRESSIONS.map(exp => {
    const hasCustom = !!(state.character.customImages && state.character.customImages[exp]);
    const src = hasCustom
      ? state.character.customImages[exp]
      : `assets/characters/Reaction character_${exp}.png`;
    return `<button type="button" class="expr-slot ${hasCustom ? "custom" : ""}" data-exp="${escapeHtml(exp)}" title="Click to replace ${escapeHtml(exp)}">
      <img src="${src}" alt="${escapeHtml(exp)}" />
      <span>${escapeHtml(exp)}</span>
    </button>`;
  }).join("");
  grid.querySelectorAll(".expr-slot").forEach(btn => {
    btn.addEventListener("click", () => {
      pendingExprUpload = btn.dataset.exp;
      document.getElementById("char-upload-expr").click();
    });
  });
}

async function setCustomImageFor(exp, file) {
  if (!file || !file.type.startsWith("image/")) return;
  const dataUrl = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  if (!state.character.customImages) state.character.customImages = {};
  state.character.customImages[exp] = dataUrl;
  const img = new Image();
  await new Promise(r => { img.onload = r; img.onerror = r; img.src = dataUrl; });
  customCharImages[exp] = img;
  markDirty();
  renderExprGrid();
  drawFrame();
}

async function setCustomImageForAll(file) {
  if (!file || !file.type.startsWith("image/")) return;
  const dataUrl = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  if (!state.character.customImages) state.character.customImages = {};
  const img = new Image();
  await new Promise(r => { img.onload = r; img.onerror = r; img.src = dataUrl; });
  for (const exp of EXPRESSIONS) {
    state.character.customImages[exp] = dataUrl;
    customCharImages[exp] = img;
  }
  markDirty();
  renderExprGrid();
  drawFrame();
}

function resetAppearance() {
  state.character.customImages = {};
  customCharImages = {};
  markDirty();
  renderExprGrid();
  drawFrame();
}

async function init() {
  for (const exp of EXPRESSIONS) {
    const img = new Image();
    img.src = `assets/characters/Reaction character_${exp}.png`;
    await new Promise(r => { img.onload = r; img.onerror = r; });
    charImages[exp] = img;
  }
  buildSoundboard();
  bindEvents();
  renderExprGrid();
  checkBackup();
  drawFrame();
}

function bindEvents() {
  document.getElementById("btn-upload-video").addEventListener("click", () => document.getElementById("video-input").click());
  document.getElementById("video-input").addEventListener("change", e => handleVideos(e.target.files));
  uploadOverlay.addEventListener("dragover", e => e.preventDefault());
  uploadOverlay.addEventListener("drop", e => { e.preventDefault(); handleVideos(e.dataTransfer.files); });

  btnPlay.addEventListener("click", play);
  btnPause.addEventListener("click", pause);
  btnStop.addEventListener("click", stop);
  seekBar.addEventListener("input", () => seek((+seekBar.value / 1000) * state.totalDuration));
  document.getElementById("master-vol").addEventListener("input", e => {
    state.masterVol = +e.target.value;
    state.videos.forEach(v => v.videoEl.volume = state.masterVol);
    state.sounds.forEach(s => { if (s.audio) s.audio.volume = state.masterVol; });
    if (sharedMasterGain) sharedMasterGain.gain.value = state.masterVol;
  });
  document.getElementById("timeline-zoom").addEventListener("input", e => {
    state.pixelsPerSecond = +e.target.value * 8;
    renderTimeline();
  });

  document.getElementById("btn-add-text").addEventListener("click", addText);
  document.getElementById("btn-add-speech").addEventListener("click", addSpeech);
  document.getElementById("btn-char-keyframe").addEventListener("click", addCharKeyframe);
  document.getElementById("btn-char-visible").addEventListener("click", () => {
    // Toggle visibility and clear any stuck slide so character can always reappear
    state.character.slide = null;
    state.character.visible = !state.character.visible;
    // If turning visible on, also fix keyframes that locked visible:false at this time
    if (state.character.visible) {
      state.character.keyframes.forEach(k => {
        if (Math.abs(k.time - state.currentTime) < 0.15) k.visible = true;
      });
    }
    markDirty();
    drawFrame();
  });
  document.getElementById("btn-char-slide-in").addEventListener("click", () => {
    state.character.visible = true;
    state.character.slide = { type: "in", start: state.currentTime, duration: 0.4 };
    markDirty();
    drawFrame();
  });
  document.getElementById("btn-char-slide-out").addEventListener("click", () => {
    state.character.slide = { type: "out", start: state.currentTime, duration: 0.4 };
    markDirty();
    drawFrame();
  });
  document.getElementById("char-expression").addEventListener("change", e => {
    state.character.expression = e.target.value; markDirty(); drawFrame();
  });
  document.getElementById("char-scale").addEventListener("input", e => {
    state.character.scale = +e.target.value; markDirty(); drawFrame();
  });
  document.getElementById("btn-char-upload-one").addEventListener("click", () => document.getElementById("char-upload-one").click());
  document.getElementById("char-upload-one").addEventListener("change", e => {
    const f = e.target.files && e.target.files[0];
    if (f) setCustomImageForAll(f);
    e.target.value = "";
  });
  document.getElementById("char-upload-expr").addEventListener("change", e => {
    const f = e.target.files && e.target.files[0];
    if (f && pendingExprUpload) setCustomImageFor(pendingExprUpload, f);
    pendingExprUpload = null;
    e.target.value = "";
  });
  document.getElementById("btn-char-reset-appear").addEventListener("click", resetAppearance);
  document.getElementById("btn-upload-sound").addEventListener("click", () => document.getElementById("sound-upload").click());
  document.getElementById("sound-upload").addEventListener("change", onSoundUpload);
  document.getElementById("sound-search").addEventListener("input", e => filterSoundboard(e.target.value));
  document.getElementById("btn-save").addEventListener("click", () => saveProject(true));
  btnExport.addEventListener("click", () => {
    if (state.recording) {
      // Stop early and keep what was recorded
      state.exportAbort = true;
      exportStatus.textContent = "Stopping…";
      return;
    }
    exportWebM();
  });

  // Enter adds speech quickly
  document.getElementById("speech-input").addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); addSpeech(); }
  });

  window.addEventListener("keydown", e => {
    if (["INPUT","TEXTAREA","SELECT"].includes(e.target.tagName)) return;
    if (e.code === "Space") { e.preventDefault(); state.playing ? pause() : play(); }
  });

  canvas.addEventListener("mousedown", onCanvasDown);
  window.addEventListener("mousemove", onCanvasMove);
  window.addEventListener("mouseup", () => {
    if (drag.active) { drag.active = false; canvasWrap.classList.remove("dragging"); markDirty(); }
  });

  timelineEl.addEventListener("click", e => {
    if (!state.totalDuration || e.target.classList.contains("timeline-clip")) return;
    const rect = timelineEl.getBoundingClientRect();
    const x = e.clientX - rect.left + timelineEl.scrollLeft;
    seek(clamp(x / state.pixelsPerSecond, 0, state.totalDuration));
  });

  setInterval(() => { if (state.dirty && state.videos.length) saveProject(false); }, 4000);
  window.addEventListener("beforeunload", () => { if (state.dirty) saveProject(false); });
}

/* ---- Canvas drag (character only) ---- */
function canvasPoint(cx, cy) {
  const r = canvas.getBoundingClientRect();
  return { x: (cx - r.left) * (canvas.width / r.width), y: (cy - r.top) * (canvas.height / r.height) };
}
function onCanvasDown(e) {
  if (!state.videos.length) return;
  const p = canvasPoint(e.clientX, e.clientY);
  const r = drag.charRect;
  if (r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
    drag.active = true;
    drag.startMX = e.clientX; drag.startMY = e.clientY;
    drag.startX = state.character.x; drag.startY = state.character.y;
    canvasWrap.classList.add("dragging");
  }
}
function onCanvasMove(e) {
  if (!drag.active) return;
  const rect = canvas.getBoundingClientRect();
  const dx = ((e.clientX - drag.startMX) / rect.width) * 100;
  const dy = ((e.clientY - drag.startMY) / rect.height) * 100;
  state.character.x = clamp(drag.startX + dx, 5, 95);
  state.character.y = clamp(drag.startY + dy, 10, 95);
  if (!state.playing) drawFrame();
}

/* ---- Videos ---- */
async function handleVideos(fileList) {
  const files = Array.from(fileList || []).filter(f => f.type.startsWith("video/"));
  if (!files.length) return;
  for (const file of files) {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.src = url; video.preload = "auto"; video.playsInline = true; video.muted = false;
    await new Promise((res, rej) => { video.onloadedmetadata = res; video.onerror = rej; });
    state.videos.push({ id: "v" + Date.now(), file, url, name: file.name, duration: video.duration, videoEl: video });
  }
  state.totalDuration = state.videos.reduce((s, v) => s + v.duration, 0);
  uploadOverlay.classList.add("hidden");
  btnPlay.disabled = btnPause.disabled = btnStop.disabled = seekBar.disabled = btnExport.disabled = false;
  renderVideoList(); renderTimeline(); markDirty(); seek(0); drawFrame();
}

function getVideoAtTime(t) {
  let acc = 0;
  for (let i = 0; i < state.videos.length; i++) {
    const v = state.videos[i];
    if (t < acc + v.duration) return { video: v, localTime: t - acc, index: i };
    acc += v.duration;
  }
  if (state.videos.length) {
    const last = state.videos[state.videos.length - 1];
    return { video: last, localTime: last.duration, index: state.videos.length - 1 };
  }
  return null;
}

function renderVideoList() {
  document.getElementById("video-list").innerHTML = state.videos.map((v, i) => `
    <div class="item">
      <div class="row"><span>${i + 1}. ${escapeHtml(v.name)}</span>
        <span>
          <button class="btn-x" onclick="moveVideo(${i},-1)" title="Up">↑</button>
          <button class="btn-x" onclick="moveVideo(${i},1)" title="Down">↓</button>
          <button class="btn-x" onclick="removeVideo(${i})">✕</button>
        </span>
      </div>
      <div class="meta">${fmtTime(v.duration)}</div>
    </div>`).join("");
}
window.moveVideo = function(i, dir) {
  const j = i + dir; if (j < 0 || j >= state.videos.length) return;
  [state.videos[i], state.videos[j]] = [state.videos[j], state.videos[i]];
  renderVideoList(); renderTimeline(); markDirty();
};
window.removeVideo = function(i) {
  try { URL.revokeObjectURL(state.videos[i].url); } catch (_) {}
  state.videos.splice(i, 1);
  state.totalDuration = state.videos.reduce((s, v) => s + v.duration, 0);
  if (!state.videos.length) {
    uploadOverlay.classList.remove("hidden");
    btnExport.disabled = true;
  }
  renderVideoList(); renderTimeline(); markDirty(); drawFrame();
};

/* ---- Playback ---- */
function play() {
  if (!state.videos.length || state.playing) return;
  state.playing = true;
  syncVideo(true);
  const wall0 = performance.now(), t0 = state.currentTime;
  function loop(now) {
    if (!state.playing) return;
    const info = getVideoAtTime(state.currentTime);
    if (info && activeVideoEl === info.video.videoEl && !activeVideoEl.paused) {
      const acc = state.videos.slice(0, info.index).reduce((s, v) => s + v.duration, 0);
      state.currentTime = acc + activeVideoEl.currentTime;
    } else {
      state.currentTime = Math.min(t0 + (now - wall0) / 1000, state.totalDuration);
      syncVideo(true);
    }
    if (state.currentTime >= state.totalDuration - 0.04) {
      state.currentTime = state.totalDuration; pause(); updateUI(); drawFrame(); return;
    }
    updateUI(); drawFrame(); playSoundsAt(state.currentTime);
    animFrameId = requestAnimationFrame(loop);
  }
  animFrameId = requestAnimationFrame(loop);
}

function syncVideo(shouldPlay) {
  const info = getVideoAtTime(state.currentTime);
  if (!info) return;
  const v = info.video.videoEl;
  state.videos.forEach((vid, i) => { if (i !== info.index && !vid.videoEl.paused) vid.videoEl.pause(); });
  if (activeVideoEl !== v) {
    if (activeVideoEl && !activeVideoEl.paused) activeVideoEl.pause();
    activeVideoEl = v;
  }
  if (Math.abs(v.currentTime - info.localTime) > 0.12) v.currentTime = info.localTime;
  v.volume = state.masterVol; v.muted = false;
  if (shouldPlay && v.paused) v.play().catch(() => {});
}

function pause() {
  state.playing = false;
  if (animFrameId) cancelAnimationFrame(animFrameId);
  state.videos.forEach(v => { if (!v.videoEl.paused) v.videoEl.pause(); });
  state.sounds.forEach(s => { if (s.audio && !s.audio.paused) s.audio.pause(); });
}
function stop() { pause(); seek(0); }

function seek(t) {
  const was = state.playing;
  if (was) pause();
  state.currentTime = clamp(t, 0, state.totalDuration || 0);
  state.sounds.forEach(s => { s.played = state.currentTime > s.start + 0.05; });
  syncVideo(false); updateUI(); drawFrame();
  if (was) play();
}

function updateUI() {
  seekBar.value = state.totalDuration ? (state.currentTime / state.totalDuration) * 1000 : 0;
  timeDisplay.textContent = `${fmtTime(state.currentTime)} / ${fmtTime(state.totalDuration)}`;
  playhead.style.left = (state.currentTime * state.pixelsPerSecond) + "px";
}

/* ---- Character state (speech expression wins) ---- */
function getCharStateAt(time) {
  const ch = state.character;
  let visible = ch.visible !== false;
  let x = ch.x, y = ch.y, scale = ch.scale, expr = ch.expression || "Normal";

  // Keyframes: interpolate position; before first keyframe keep base visibility (do NOT hide)
  if (ch.keyframes && ch.keyframes.length) {
    const kfs = [...ch.keyframes].sort((a, b) => a.time - b.time);
    let prev = null, next = null;
    for (const k of kfs) {
      if (k.time <= time) prev = k;
      else if (!next) next = k;
    }
    if (prev && next) {
      const t = (time - prev.time) / Math.max(next.time - prev.time, 0.0001);
      x = lerp(prev.x, next.x, t);
      y = lerp(prev.y, next.y, t);
      scale = lerp(prev.scale, next.scale, t);
      expr = prev.expression || expr;
      // only override visibility if keyframe explicitly set it
      if (typeof prev.visible === "boolean") visible = prev.visible;
    } else if (prev) {
      x = prev.x; y = prev.y; scale = prev.scale;
      expr = prev.expression || expr;
      if (typeof prev.visible === "boolean") visible = prev.visible;
    }
    // if only next exists (playhead before first keyframe): keep base x/y/scale/visible
  }

  // Active speech bubble forces its expression
  for (const sp of state.speeches) {
    if (time >= sp.start && time <= sp.end && sp.expression) {
      expr = sp.expression;
      break;
    }
  }

  let slideOffsetX = 0;
  if (ch.slide) {
    const sl = ch.slide;
    const prog = clamp((time - sl.start) / Math.max(sl.duration, 0.01), 0, 1);
    if (sl.type === "in") {
      slideOffsetX = (1 - prog) * -28;
      if (prog >= 1) {
        // finished slide-in: clear slide, ensure visible
        ch.slide = null;
        ch.visible = true;
        visible = true;
      } else {
        visible = true;
      }
    } else {
      // slide out
      slideOffsetX = prog * 28;
      if (prog >= 1) {
        ch.slide = null;
        ch.visible = false;
        visible = false;
      }
    }
  }

  // Master visibility flag always wins when explicitly false (after slide-out / hide)
  if (ch.visible === false && !(ch.slide && ch.slide.type === "in")) {
    visible = false;
  }

  return { visible, x, y, scale, expr, slideOffsetX };
}

/* ---- Draw ---- */
function drawFrame() {
  const w = canvas.width, h = canvas.height;
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h);

  const info = getVideoAtTime(state.currentTime);
  if (info) {
    const v = info.video.videoEl;
    if (!state.playing && Math.abs(v.currentTime - info.localTime) > 0.08) v.currentTime = info.localTime;
    const vr = (v.videoWidth || 16) / (v.videoHeight || 9), cr = w / h;
    let dw, dh, dx, dy;
    if (vr > cr) { dw = w; dh = w / vr; dx = 0; dy = (h - dh) / 2; }
    else { dh = h; dw = h * vr; dx = (w - dw) / 2; dy = 0; }
    try { ctx.drawImage(v, dx, dy, dw, dh); } catch (_) {}
  }

  // Text bars
  for (const t of state.texts) {
    if (state.currentTime >= t.start && state.currentTime <= t.end) {
      const barH = 36, y = (t.y / 100) * h;
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.fillRect(0, y - barH / 2, w, barH);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 22px system-ui, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(t.text || "", w / 2, y);
    }
  }

  // Character + speech (speech always above character)
  const st = getCharStateAt(state.currentTime);
  drag.charRect = null;
  if (st.visible) {
    const img = getCharImage(st.expr);
    if (img && img.complete && img.naturalWidth) {
      const baseH = h * 0.35 * (st.scale || 1);
      const baseW = (img.width / Math.max(img.height, 1)) * baseH;
      const cx = ((st.x + (st.slideOffsetX || 0)) / 100) * w;
      const cy = (st.y / 100) * h;

      drag.charRect = { x: cx - baseW / 2, y: cy - baseH / 2, w: baseW, h: baseH };

      ctx.save();
      ctx.translate(cx, cy);
      ctx.drawImage(img, -baseW / 2, -baseH / 2, baseW, baseH);
      ctx.restore();

      // Active speech bubbles stacked above character head
      const active = state.speeches.filter(sp => state.currentTime >= sp.start && state.currentTime <= sp.end);
      active.forEach((sp, i) => {
        const stack = active.length - 1 - i;
        const bx = cx;
        const by = cy - baseH / 2 - 18 - stack * 36;
        drawBubble(bx, by, sp.text);
      });
    }
  }
}

function drawBubble(x, y, text) {
  ctx.font = "14px system-ui, sans-serif";
  const m = ctx.measureText(text || "");
  const pad = 10, bw = Math.max(m.width + pad * 2, 40), bh = 28;
  ctx.fillStyle = "#fff"; ctx.strokeStyle = "#222"; ctx.lineWidth = 2;
  roundRect(ctx, x - bw / 2, y - bh, bw, bh, 8);
  ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 7, y); ctx.lineTo(x, y + 9); ctx.lineTo(x + 7, y);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#111";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text || "", x, y - bh / 2);
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/* ---- Character keyframes ---- */
function addCharKeyframe() {
  const ch = state.character;
  // Saving a position always means the character should be visible at that time
  ch.visible = true;
  ch.slide = null;
  const existing = ch.keyframes.findIndex(k => Math.abs(k.time - state.currentTime) < 0.05);
  const kf = { time: state.currentTime, x: ch.x, y: ch.y, scale: ch.scale, expression: ch.expression, visible: true };
  if (existing >= 0) ch.keyframes[existing] = kf; else ch.keyframes.push(kf);
  ch.keyframes.sort((a, b) => a.time - b.time);
  renderTimeline(); markDirty(); drawFrame();
}

/* ---- Speech ---- */
function addSpeech() {
  const text = (document.getElementById("speech-input").value || "").trim() || "…";
  const expression = document.getElementById("speech-expression").value || "Happy";
  state.speeches.push({
    id: "sp" + Date.now(),
    text,
    expression,
    start: state.currentTime,
    end: state.currentTime + 2.5
  });
  document.getElementById("speech-input").value = "";
  renderSpeechList(); renderTimeline(); markDirty(); drawFrame();
}

function renderSpeechList() {
  document.getElementById("speech-list").innerHTML = state.speeches.map((s, i) => `
    <div class="item">
      <div class="row">
        <strong>${escapeHtml(s.text)}</strong>
        <button class="btn-x" onclick="removeSpeech(${i})">✕</button>
      </div>
      <div class="meta">${s.start.toFixed(1)}s – ${s.end.toFixed(1)}s</div>
      <label class="meta">Expression
        <select onchange="updateSpeech(${i},'expression',this.value)">
          ${EXPRESSIONS.map(e => `<option value="${e}" ${s.expression === e ? "selected" : ""}>${e}</option>`).join("")}
        </select>
      </label>
      <div class="row" style="gap:4px;margin-top:3px">
        <input type="number" step="0.1" value="${s.start.toFixed(1)}" title="Start"
          onchange="updateSpeech(${i},'start',+this.value)" style="width:48%" />
        <input type="number" step="0.1" value="${s.end.toFixed(1)}" title="End"
          onchange="updateSpeech(${i},'end',+this.value)" style="width:48%" />
      </div>
    </div>`).join("");
}
window.updateSpeech = function(i, key, val) {
  state.speeches[i][key] = val;
  renderTimeline(); markDirty(); drawFrame();
};
window.removeSpeech = function(i) {
  state.speeches.splice(i, 1);
  renderSpeechList(); renderTimeline(); markDirty(); drawFrame();
};

/* ---- Text ---- */
function addText() {
  state.texts.push({
    id: "t" + Date.now(),
    text: "Caption",
    y: 88,
    start: state.currentTime,
    end: Math.min(state.currentTime + 4, state.totalDuration || state.currentTime + 4)
  });
  renderTextList(); renderTimeline(); markDirty(); drawFrame();
}
function renderTextList() {
  document.getElementById("text-list").innerHTML = state.texts.map((t, i) => `
    <div class="item">
      <div class="row">
        <input type="text" value="${escapeHtml(t.text)}" onchange="updateText(${i},'text',this.value)" />
        <button class="btn-x" onclick="removeText(${i})">✕</button>
      </div>
      <div class="row" style="gap:4px">
        <input type="number" step="0.1" value="${t.start.toFixed(1)}" title="Start"
          onchange="updateText(${i},'start',+this.value)" style="width:33%" />
        <input type="number" step="0.1" value="${t.end.toFixed(1)}" title="End"
          onchange="updateText(${i},'end',+this.value)" style="width:33%" />
        <input type="number" value="${t.y}" title="Y%" min="5" max="95"
          onchange="updateText(${i},'y',+this.value)" style="width:33%" />
      </div>
    </div>`).join("");
}
window.updateText = function(i, key, val) {
  state.texts[i][key] = val; renderTimeline(); markDirty(); drawFrame();
};
window.removeText = function(i) {
  state.texts.splice(i, 1); renderTextList(); renderTimeline(); markDirty(); drawFrame();
};

/* ---- Sounds ---- */
function buildSoundboard() {
  document.getElementById("soundboard").innerHTML = SOUNDBOARD.map(n =>
    `<button class="sound-btn" data-name="${n}" onclick="addSound('${n}')">${n}</button>`
  ).join("");
}
function filterSoundboard(q) {
  const l = q.toLowerCase();
  document.querySelectorAll(".sound-btn").forEach(b => {
    b.style.display = b.dataset.name.includes(l) ? "" : "none";
  });
}
window.addSound = function(name) {
  const url = `assets/sounds/${name}.mp3`;
  const audio = new Audio(url); audio.preload = "auto"; audio.volume = state.masterVol;
  const id = "s" + Date.now();
  audio.addEventListener("loadedmetadata", () => {
    const s = state.sounds.find(x => x.id === id);
    if (s) { s.duration = audio.duration; renderTimeline(); }
  });
  state.sounds.push({ id, name, url, board: true, start: state.currentTime, duration: 2, audio, played: false });
  renderSoundList(); renderTimeline(); markDirty();
};
function onSoundUpload(e) {
  Array.from(e.target.files).forEach(file => {
    const reader = new FileReader();
    reader.onload = () => {
      const audio = new Audio(reader.result); audio.volume = state.masterVol;
      const id = "s" + Date.now();
      audio.addEventListener("loadedmetadata", () => {
        const s = state.sounds.find(x => x.id === id);
        if (s) { s.duration = audio.duration; renderTimeline(); }
      });
      state.sounds.push({ id, name: file.name, board: false, dataUrl: reader.result, start: state.currentTime, duration: 2, audio, played: false });
      renderSoundList(); renderTimeline(); markDirty();
    };
    reader.readAsDataURL(file);
  });
}
function renderSoundList() {
  document.getElementById("sound-list").innerHTML = state.sounds.map((s, i) => `
    <div class="item">
      <div class="row"><span>${escapeHtml(s.name)}</span>
        <button class="btn-x" onclick="removeSound(${i})">✕</button></div>
      <input type="number" step="0.1" value="${s.start.toFixed(1)}"
        onchange="updateSound(${i},'start',+this.value)" />
    </div>`).join("");
}
window.updateSound = function(i, key, val) {
  state.sounds[i][key] = val; state.sounds[i].played = false; renderTimeline(); markDirty();
};
window.removeSound = function(i) {
  state.sounds.splice(i, 1); renderSoundList(); renderTimeline(); markDirty();
};
function playSoundsAt(t) {
  for (const s of state.sounds) {
    if (!s.played && t >= s.start && t < s.start + 0.12) {
      s.audio.currentTime = 0; s.audio.volume = state.masterVol;
      s.audio.play().catch(() => {}); s.played = true;
    }
    if (t < s.start) s.played = false;
  }
}

/* ---- Timeline ---- */
function renderTimeline() {
  const pps = state.pixelsPerSecond;
  const totalW = Math.max(state.totalDuration * pps, timelineEl.clientWidth || 400);
  timelineRuler.style.width = totalW + "px";
  timelineRuler.innerHTML = "";
  const step = pps > 60 ? 1 : pps > 30 ? 2 : 5;
  for (let t = 0; t <= state.totalDuration + 0.01; t += step) {
    const m = document.createElement("div");
    m.style.cssText = `position:absolute;left:${t * pps}px;top:0;height:100%;border-left:1px solid #333;padding-left:2px;font-size:9px;`;
    m.textContent = fmtTime(t).replace(/\.\d$/, "");
    timelineRuler.appendChild(m);
  }
  timelineTracks.innerHTML = "";
  timelineTracks.style.width = totalW + "px";

  function track(clips) {
    const tr = document.createElement("div");
    tr.className = "timeline-track";
    clips.forEach(c => {
      const el = document.createElement("div");
      el.className = "timeline-clip " + c.cls;
      el.style.left = c.start * pps + "px";
      el.style.width = Math.max(c.dur * pps, 12) + "px";
      el.textContent = c.text;
      if (c.obj) makeDrag(el, c.obj, c.hasEnd);
      tr.appendChild(el);
    });
    timelineTracks.appendChild(tr);
  }

  let acc = 0;
  track(state.videos.map(v => { const c = { start: acc, dur: v.duration, text: v.name, cls: "video" }; acc += v.duration; return c; }));
  track(state.speeches.map(s => ({ start: s.start, dur: s.end - s.start, text: "💬 " + s.text, cls: "speech", obj: s, hasEnd: true })));
  track(state.texts.map(t => ({ start: t.start, dur: t.end - t.start, text: t.text, cls: "text", obj: t, hasEnd: true })));
  track(state.sounds.map(s => ({ start: s.start, dur: s.duration || 1, text: s.name, cls: "sound", obj: s, hasEnd: false })));
  track(state.character.keyframes.map(k => ({ start: k.time, dur: 0.12, text: "◆", cls: "char" })));
  updateUI();
}

function makeDrag(clip, obj, hasEnd) {
  let dragging = false, sx = 0, st = 0, se = 0;
  clip.addEventListener("mousedown", e => {
    e.stopPropagation();
    dragging = true; sx = e.clientX; st = obj.start; se = obj.end;
    clip.style.opacity = "0.6";
  });
  window.addEventListener("mousemove", e => {
    if (!dragging) return;
    const dt = (e.clientX - sx) / state.pixelsPerSecond;
    obj.start = clamp(st + dt, 0, state.totalDuration);
    if (hasEnd) obj.end = obj.start + (se - st);
    clip.style.left = obj.start * state.pixelsPerSecond + "px";
  });
  window.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false; clip.style.opacity = "";
    renderSpeechList(); renderTextList(); renderSoundList(); markDirty();
  });
}

/* ---- Save ---- */
function markDirty() {
  state.dirty = true;
  saveIndicator.textContent = "Unsaved";
  saveIndicator.className = "save-indicator";
}
function saveProject(manual) {
  try {
    const data = {
      version: 4, savedAt: Date.now(), totalDuration: state.totalDuration,
      texts: state.texts, speeches: state.speeches,
      sounds: state.sounds.map(s => ({
        id: s.id, name: s.name, board: !!s.board, url: s.board ? s.url : null,
        dataUrl: s.dataUrl || null, start: s.start, duration: s.duration
      })),
      character: {
        visible: state.character.visible, expression: state.character.expression,
        x: state.character.x, y: state.character.y, scale: state.character.scale,
        keyframes: state.character.keyframes,
        customImages: state.character.customImages || {}
      },
      videosMeta: state.videos.map(v => ({ name: v.name, duration: v.duration }))
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    state.dirty = false;
    saveIndicator.textContent = manual ? "Saved ✓" : "Auto-saved";
    saveIndicator.className = "save-indicator saved";
    setTimeout(() => { if (!state.dirty) { saveIndicator.textContent = ""; } }, 2000);
  } catch (e) { saveIndicator.textContent = "Save failed"; }
}

function checkBackup() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (!data?.version) return;
    document.getElementById("recovery-info").textContent =
      `Saved ${data.savedAt ? new Date(data.savedAt).toLocaleString() : ""} · ${data.speeches?.length || 0} speech · ${data.texts?.length || 0} text`;
    document.getElementById("recovery-modal").classList.remove("hidden");
    document.getElementById("btn-load-backup").onclick = () => {
      loadProject(data);
      document.getElementById("recovery-modal").classList.add("hidden");
    };
    document.getElementById("btn-discard-backup").onclick = () => {
      localStorage.removeItem(STORAGE_KEY);
      document.getElementById("recovery-modal").classList.add("hidden");
    };
  } catch (_) {}
}

function loadProject(data) {
  state.texts = data.texts || [];
  state.speeches = (data.speeches || []).map(s => ({
    ...s, expression: s.expression || "Happy"
  }));
  // migrate old single speech
  if (data.character?.speech && !state.speeches.length) {
    state.speeches.push({
      id: "m", text: data.character.speech.text,
      expression: "Happy",
      start: data.character.speech.start, end: data.character.speech.end
    });
  }
  state.character.visible = data.character?.visible !== false;
  state.character.expression = data.character?.expression || "Normal";
  state.character.x = data.character?.x ?? 82;
  state.character.y = data.character?.y ?? 72;
  state.character.scale = data.character?.scale ?? 1;
  state.character.keyframes = data.character?.keyframes || [];
  state.character.customImages = data.character?.customImages || {};
  state.character.slide = null; // never restore a mid-slide that can leave character stuck hidden
  document.getElementById("char-expression").value = state.character.expression;
  document.getElementById("char-scale").value = state.character.scale;

  state.sounds = [];
  for (const s of (data.sounds || [])) {
    let audio;
    if (s.board && s.url) audio = new Audio(s.url);
    else if (s.dataUrl) audio = new Audio(s.dataUrl);
    else continue;
    audio.preload = "auto"; audio.volume = state.masterVol;
    state.sounds.push({ id: s.id, name: s.name, board: s.board, url: s.url, dataUrl: s.dataUrl, start: s.start, duration: s.duration || 2, audio, played: false });
  }
  if (data.videosMeta?.length && !state.videos.length) {
    document.getElementById("video-list").innerHTML =
      `<div class="item"><div class="meta">Re-upload: ${data.videosMeta.map(v => escapeHtml(v.name)).join(", ")}</div></div>`;
  }
  state.totalDuration = data.totalDuration || 0;
  loadCustomFromDataUrls(state.character.customImages).then(() => {
    renderExprGrid();
    drawFrame();
  });
  renderTextList(); renderSpeechList(); renderSoundList(); renderTimeline();
  state.dirty = false; saveIndicator.textContent = "Loaded"; saveIndicator.className = "save-indicator saved";
  drawFrame();
}

/* ---- Export ---- */
async function exportWebM() {
  if (!state.videos.length || state.recording) return;
  state.recording = true;
  state.exportAbort = false;
  btnExport.disabled = false;
  btnExport.textContent = "Stop & download";
  btnExport.classList.add("btn-accent");
  exportStatus.textContent = "Preparing…";

  const first = state.videos[0].videoEl;
  const outW = first.videoWidth || 1280;
  const outH = first.videoHeight || 720;
  const off = document.createElement("canvas");
  off.width = outW;
  off.height = outH;
  const octx = off.getContext("2d", { alpha: false });
  // Capture at up to 60fps; browser will match display refresh when possible
  const fps = 30;
  const canvasStream = off.captureStream(fps);

  // Persistent audio graph
  if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
    sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    sharedMasterGain = sharedAudioCtx.createGain();
    sharedMasterGain.gain.value = 1;
    sharedMasterGain.connect(sharedAudioCtx.destination);
  }
  const audioCtx = sharedAudioCtx;
  try { await audioCtx.resume(); } catch (_) {}
  sharedMasterGain.gain.value = state.masterVol;

  const dest = audioCtx.createMediaStreamDestination();
  try { sharedMasterGain.connect(dest); } catch (_) {}

  for (const v of state.videos) {
    if (!v._waConnected) {
      try {
        const src = audioCtx.createMediaElementSource(v.videoEl);
        const g = audioCtx.createGain();
        g.gain.value = 1;
        src.connect(g);
        g.connect(sharedMasterGain);
        v._waConnected = true;
        v._waGain = g;
      } catch (err) {
        console.warn("video audio connect", err);
      }
    } else if (v._waGain) {
      v._waGain.gain.value = 1;
    }
    v.videoEl.muted = false;
    v.videoEl.volume = 1;
    v.videoEl.playbackRate = 1;
  }

  // Decode SFX once
  async function getSoundBuffer(s) {
    if (s._buffer) return s._buffer;
    try {
      const srcUrl = s.dataUrl || s.url;
      if (!srcUrl) return null;
      const res = await fetch(srcUrl);
      const arr = await res.arrayBuffer();
      s._buffer = await audioCtx.decodeAudioData(arr.slice(0));
      return s._buffer;
    } catch (err) {
      console.warn("decode", s.name, err);
      return null;
    }
  }
  await Promise.all(state.sounds.map(s => getSoundBuffer(s)));

  const combined = new MediaStream();
  canvasStream.getVideoTracks().forEach(t => combined.addTrack(t));
  dest.stream.getAudioTracks().forEach(t => combined.addTrack(t));

  const mimeCandidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm"
  ];
  const mime = mimeCandidates.find(m => MediaRecorder.isTypeSupported(m)) || "video/webm";

  recordedChunks = [];
  let downloadTriggered = false;

  function finishDownload() {
    if (downloadTriggered) return;
    downloadTriggered = true;
    if (!recordedChunks.length) {
      exportStatus.textContent = "Nothing recorded";
      resetExportUI();
      return;
    }
    const blob = new Blob(recordedChunks, { type: "video/webm" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "reaction_" + Date.now() + ".webm";
    a.click();
    exportStatus.textContent = "Downloaded!";
    resetExportUI();
    setTimeout(() => {
      if (exportStatus.textContent === "Downloaded!") exportStatus.textContent = "";
    }, 2500);
  }

  function resetExportUI() {
    state.recording = false;
    state.exportAbort = false;
    btnExport.disabled = !state.videos.length;
    btnExport.textContent = "Export WebM";
    btnExport.classList.remove("btn-accent");
    try { sharedMasterGain.disconnect(dest); } catch (_) {}
  }

  try {
    mediaRecorder = new MediaRecorder(combined, {
      mimeType: mime,
      videoBitsPerSecond: 10_000_000,
      audioBitsPerSecond: 192_000
    });
  } catch (_) {
    mediaRecorder = new MediaRecorder(combined, { mimeType: mime });
  }

  mediaRecorder.ondataavailable = e => {
    if (e.data && e.data.size > 0) recordedChunks.push(e.data);
  };
  mediaRecorder.onstop = () => finishDownload();
  mediaRecorder.onerror = e => {
    console.error(e);
    exportStatus.textContent = "Export error";
    resetExportUI();
  };

  // Reset playback to start — continuous play (no per-frame seeking)
  pause();
  state.sounds.forEach(s => { s.played = false; });
  state.currentTime = 0;

  // Seek all videos to 0 once
  for (const v of state.videos) {
    v.videoEl.pause();
    v.videoEl.currentTime = 0;
  }
  await new Promise(r => setTimeout(r, 100));

  mediaRecorder.start(250);
  exportStatus.textContent = "Recording… (Stop & download anytime)";

  // Precompute video segment starts
  const segments = [];
  let acc = 0;
  for (const v of state.videos) {
    segments.push({ video: v, start: acc, end: acc + v.duration, duration: v.duration });
    acc += v.duration;
  }
  const totalDur = state.totalDuration;

  let segIdx = 0;
  let exportRaf = null;
  let lastUiUpdate = 0;
  let finished = false;

  function drawExportFrame(t) {
    octx.fillStyle = "#000";
    octx.fillRect(0, 0, outW, outH);
    const seg = segments[segIdx];
    if (seg) {
      const v = seg.video.videoEl;
      const vr = (v.videoWidth || 16) / (v.videoHeight || 9);
      const cr = outW / outH;
      let dw, dh, dx, dy;
      if (vr > cr) { dw = outW; dh = outW / vr; dx = 0; dy = (outH - dh) / 2; }
      else { dh = outH; dw = outH * vr; dx = (outW - dw) / 2; dy = 0; }
      try { octx.drawImage(v, dx, dy, dw, dh); } catch (_) {}
    }
    drawOverlays(octx, outW, outH, t);
  }

  function playSegment(i) {
    // Pause others
    segments.forEach((s, j) => {
      if (j !== i) {
        try { s.video.videoEl.pause(); } catch (_) {}
      }
    });
    const seg = segments[i];
    if (!seg) return;
    const v = seg.video.videoEl;
    v.muted = false;
    v.volume = 1;
    // Only seek if not already near start of this segment's local time
    const targetLocal = Math.max(0, state.currentTime - seg.start);
    if (Math.abs(v.currentTime - targetLocal) > 0.25) {
      v.currentTime = targetLocal;
    }
    v.play().catch(() => {});
  }

  playSegment(0);

  function tick() {
    if (finished) return;

    if (state.exportAbort) {
      finished = true;
      endExport();
      return;
    }

    const seg = segments[segIdx];
    if (!seg) {
      finished = true;
      endExport();
      return;
    }

    const v = seg.video.videoEl;
    // Timeline time = segment start + video's currentTime
    let t = seg.start + (v.currentTime || 0);

    // Advance to next segment when this one ends
    if (v.ended || v.currentTime >= seg.duration - 0.05) {
      segIdx++;
      if (segIdx >= segments.length) {
        state.currentTime = totalDur;
        drawExportFrame(totalDur);
        finished = true;
        endExport();
        return;
      }
      playSegment(segIdx);
      t = segments[segIdx].start;
    }

    state.currentTime = Math.min(t, totalDur);
    drawExportFrame(state.currentTime);

    // SFX
    for (const s of state.sounds) {
      if (!s.played && state.currentTime >= s.start && state.currentTime < s.start + 0.12) {
        s.played = true;
        if (s._buffer) {
          try {
            const src = audioCtx.createBufferSource();
            src.buffer = s._buffer;
            const g = audioCtx.createGain();
            g.gain.value = state.masterVol;
            src.connect(g);
            g.connect(sharedMasterGain);
            src.start();
          } catch (_) {}
        }
      }
    }

    // Throttle UI updates (preview + status) to ~4/sec to avoid lag
    const now = performance.now();
    if (now - lastUiUpdate > 250) {
      lastUiUpdate = now;
      drawFrame();
      updateUI();
      const pct = Math.min(100, Math.round((state.currentTime / Math.max(totalDur, 0.01)) * 100));
      exportStatus.textContent = `Recording ${pct}% — Stop & download to cut`;
    }

    if (state.currentTime >= totalDur - 0.03) {
      finished = true;
      endExport();
      return;
    }

    exportRaf = requestAnimationFrame(tick);
  }

  function endExport() {
    if (exportRaf) cancelAnimationFrame(exportRaf);
    exportRaf = null;
    state.videos.forEach(v => { try { v.videoEl.pause(); } catch (_) {} });
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      try { mediaRecorder.requestData(); } catch (_) {}
      try { mediaRecorder.stop(); } catch (_) { finishDownload(); }
    } else {
      finishDownload();
    }
    state.currentTime = 0;
    updateUI();
    drawFrame();
  }

  exportRaf = requestAnimationFrame(tick);
}

function drawOverlays(c, w, h, time) {
  for (const t of state.texts) {
    if (time >= t.start && time <= t.end) {
      const barH = Math.max(36, h * 0.05), y = (t.y / 100) * h;
      c.fillStyle = "rgba(0,0,0,0.22)"; c.fillRect(0, y - barH / 2, w, barH);
      c.fillStyle = "#fff"; c.font = `bold ${Math.round(h * 0.035)}px system-ui, sans-serif`;
      c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(t.text || "", w / 2, y);
    }
  }
  const st = getCharStateAt(time);
  if (st.visible) {
    const img = getCharImage(st.expr);
    if (img && img.complete && img.naturalWidth) {
      const baseH = h * 0.35 * st.scale, baseW = (img.width / Math.max(img.height, 1)) * baseH;
      const cx = ((st.x + (st.slideOffsetX || 0)) / 100) * w, cy = (st.y / 100) * h;
      c.save(); c.translate(cx, cy);
      c.drawImage(img, -baseW / 2, -baseH / 2, baseW, baseH);
      c.restore();
      const active = state.speeches.filter(sp => time >= sp.start && time <= sp.end);
      active.forEach((sp, i) => {
        const stack = active.length - 1 - i;
        const bx = cx, by = cy - baseH / 2 - 18 - stack * Math.round(h * 0.055);
        c.font = `${Math.round(h * 0.022)}px system-ui, sans-serif`;
        const m = c.measureText(sp.text || "");
        const pad = 10, bw = Math.max(m.width + pad * 2, 40), bh = Math.round(h * 0.04);
        c.fillStyle = "#fff"; c.strokeStyle = "#222"; c.lineWidth = 2;
        roundRect(c, bx - bw / 2, by - bh, bw, bh, 8); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(bx - 7, by); c.lineTo(bx, by + 9); c.lineTo(bx + 7, by); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = "#111"; c.textAlign = "center"; c.textBaseline = "middle";
        c.fillText(sp.text || "", bx, by - bh / 2);
      });
    }
  }
}

init();
