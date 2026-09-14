/**
 * Scratch Corruptor
 * Corrupts .sb3 / .zip Scratch projects in interesting but still-loadable ways.
 */

(() => {
  // ---------- DOM ----------
  const dropArea = document.getElementById("dropArea");
  const fileInput = document.getElementById("fileInput");
  const fileInfo = document.getElementById("fileInfo");
  const fileNameEl = document.getElementById("fileName");
  const clearFileBtn = document.getElementById("clearFile");
  const intensitySlider = document.getElementById("intensity");
  const intensityVal = document.getElementById("intensityVal");
  const corruptBtn = document.getElementById("corruptBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const logEl = document.getElementById("log");

  // ---------- State ----------
  let originalZip = null;       // JSZip instance of uploaded file
  let originalFileName = "";
  let corruptedBlob = null;
  let projectJson = null;       // parsed project.json

  // ---------- Helpers ----------
  function log(msg, type = "entry") {
    const empty = logEl.querySelector(".log-empty");
    if (empty) empty.remove();
    const p = document.createElement("p");
    p.className = `entry ${type}`;
    p.textContent = msg;
    logEl.appendChild(p);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function clearLog() {
    logEl.innerHTML = '<p class="log-empty">Waiting for a project…</p>';
  }

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  function randInt(min, max) {
    return Math.floor(rand(min, max + 1));
  }

  function chance(p) {
    return Math.random() < p;
  }

  function pick(arr) {
    return arr[randInt(0, arr.length - 1)];
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = randInt(0, i);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function glitchText(str, intensity) {
    if (!str || str.length < 2) return str;
    const chars = "█▓▒░▄▀■□◆◇●○★☆✦✧¡¿§¶†‡•‣";
    let out = str.split("");
    const flips = Math.max(1, Math.floor(str.length * (intensity / 25)));
    for (let i = 0; i < flips; i++) {
      const idx = randInt(0, out.length - 1);
      if (chance(0.5)) {
        out[idx] = pick(chars.split(""));
      } else if (chance(0.4) && idx < out.length - 1) {
        [out[idx], out[idx + 1]] = [out[idx + 1], out[idx]];
      }
    }
    return out.join("");
  }

  function intensityFactor() {
    return Number(intensitySlider.value) / 10; // 0.1 – 1.0
  }

  // ---------- File handling ----------
  function setFile(file) {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith(".sb3") && !name.endsWith(".zip")) {
      log("Please upload a .sb3 or .zip file.", "err");
      return;
    }
    originalFileName = file.name;
    fileNameEl.textContent = file.name;
    fileInfo.classList.remove("hidden");
    corruptBtn.disabled = false;
    downloadBtn.classList.add("hidden");
    corruptedBlob = null;
    clearLog();
    log(`Loaded: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`, "info");

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        originalZip = await JSZip.loadAsync(e.target.result);
        const jsonFile = originalZip.file("project.json");
        if (!jsonFile) {
          log("No project.json found — is this a valid Scratch project?", "err");
          originalZip = null;
          corruptBtn.disabled = true;
          return;
        }
        const text = await jsonFile.async("string");
        projectJson = JSON.parse(text);
        const targets = projectJson.targets || [];
        log(`Parsed project.json — ${targets.length} targets (sprites + stage)`, "ok");
        log(`Ready to corrupt. Adjust options then hit the button.`, "info");
      } catch (err) {
        log(`Failed to read archive: ${err.message}`, "err");
        originalZip = null;
        corruptBtn.disabled = true;
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // Drag & drop
  dropArea.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) setFile(fileInput.files[0]);
  });

  ["dragenter", "dragover"].forEach((ev) => {
    dropArea.addEventListener(ev, (e) => {
      e.preventDefault();
      dropArea.classList.add("dragover");
    });
  });
  ["dragleave", "drop"].forEach((ev) => {
    dropArea.addEventListener(ev, (e) => {
      e.preventDefault();
      dropArea.classList.remove("dragover");
    });
  });
  dropArea.addEventListener("drop", (e) => {
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  });

  clearFileBtn.addEventListener("click", () => {
    originalZip = null;
    projectJson = null;
    corruptedBlob = null;
    originalFileName = "";
    fileInput.value = "";
    fileInfo.classList.add("hidden");
    corruptBtn.disabled = true;
    downloadBtn.classList.add("hidden");
    clearLog();
  });

  intensitySlider.addEventListener("input", () => {
    intensityVal.textContent = intensitySlider.value;
  });

  // ---------- Corruption engines ----------

  /**
   * Collect all costume asset IDs and sound asset IDs from the project.
   */
  function collectAssets(proj) {
    const costumes = [];
    const sounds = [];
    for (const t of proj.targets || []) {
      for (const c of t.costumes || []) {
        if (c.assetId) costumes.push({ target: t, costume: c });
      }
      for (const s of t.sounds || []) {
        if (s.assetId) sounds.push({ target: t, sound: s });
      }
    }
    return { costumes, sounds };
  }

  /**
   * Costume Shuffle — swap assetId / md5ext / dataFormat between costumes.
   * Keeps names & rotation centers mostly intact so sprites still "exist".
   */
  function corruptCostumeShuffle(proj, factor) {
    const { costumes } = collectAssets(proj);
    if (costumes.length < 2) {
      log("Costume Shuffle: not enough costumes", "warn");
      return;
    }
    const count = Math.max(1, Math.floor(costumes.length * factor * 0.7));
    let swaps = 0;
    for (let i = 0; i < count; i++) {
      const a = pick(costumes);
      const b = pick(costumes);
      if (a === b) continue;
      // Swap the actual file references
      const tmpId = a.costume.assetId;
      const tmpMd5 = a.costume.md5ext;
      const tmpFmt = a.costume.dataFormat;
      a.costume.assetId = b.costume.assetId;
      a.costume.md5ext = b.costume.md5ext;
      a.costume.dataFormat = b.costume.dataFormat;
      b.costume.assetId = tmpId;
      b.costume.md5ext = tmpMd5;
      b.costume.dataFormat = tmpFmt;
      swaps++;
    }
    log(`Costume Shuffle: performed ${swaps} asset swaps`, "ok");
  }

  /**
   * Sound Scramble — reassign sound asset references.
   */
  function corruptSoundScramble(proj, factor) {
    const { sounds } = collectAssets(proj);
    if (sounds.length < 2) {
      log("Sound Scramble: not enough sounds", "warn");
      return;
    }
    const count = Math.max(1, Math.floor(sounds.length * factor * 0.8));
    let swaps = 0;
    for (let i = 0; i < count; i++) {
      const a = pick(sounds);
      const b = pick(sounds);
      if (a === b) continue;
      const tmpId = a.sound.assetId;
      const tmpMd5 = a.sound.md5ext;
      const tmpFmt = a.sound.dataFormat;
      const tmpRate = a.sound.rate;
      const tmpSample = a.sound.sampleCount;
      a.sound.assetId = b.sound.assetId;
      a.sound.md5ext = b.sound.md5ext;
      a.sound.dataFormat = b.sound.dataFormat;
      a.sound.rate = b.sound.rate;
      a.sound.sampleCount = b.sound.sampleCount;
      b.sound.assetId = tmpId;
      b.sound.md5ext = tmpMd5;
      b.sound.dataFormat = tmpFmt;
      b.sound.rate = tmpRate;
      b.sound.sampleCount = tmpSample;
      swaps++;
    }
    log(`Sound Scramble: performed ${swaps} sound swaps`, "ok");
  }

  /**
   * Block Chaos — mutate numeric inputs, occasionally swap safe opcodes,
   * jiggle block x/y positions.
   */
  const SAFE_OPCODE_SWAPS = {
    motion_movesteps: ["motion_turnright", "motion_turnleft", "motion_changexby", "motion_changeyby"],
    motion_turnright: ["motion_turnleft", "motion_movesteps"],
    motion_turnleft: ["motion_turnright", "motion_movesteps"],
    motion_changexby: ["motion_changeyby", "motion_movesteps"],
    motion_changeyby: ["motion_changexby", "motion_movesteps"],
    looks_changesizeby: ["looks_changeeffectby", "motion_changexby"],
    looks_setsizeto: ["looks_seteffectto"],
    control_wait: ["control_wait_until"],
    operator_add: ["operator_subtract", "operator_multiply"],
    operator_subtract: ["operator_add", "operator_random"],
    operator_multiply: ["operator_add", "operator_divide"],
    operator_divide: ["operator_multiply", "operator_mod"],
  };

  function corruptBlockChaos(proj, factor) {
    let mutated = 0;
    let opcodeSwaps = 0;
    let positionJiggles = 0;

    for (const target of proj.targets || []) {
      const blocks = target.blocks || {};
      for (const id of Object.keys(blocks)) {
        const block = blocks[id];
        if (!block || typeof block !== "object") continue;

        // Jiggle top-level block positions
        if (block.topLevel && (block.x !== undefined || block.y !== undefined) && chance(factor * 0.6)) {
          block.x = (block.x || 0) + randInt(-80, 80);
          block.y = (block.y || 0) + randInt(-60, 60);
          positionJiggles++;
        }

        // Mutate numeric shadow inputs
        if (block.inputs && chance(factor * 0.55)) {
          for (const key of Object.keys(block.inputs)) {
            const inp = block.inputs[key];
            // Scratch input format: [type, value] or nested
            if (Array.isArray(inp) && inp.length >= 2) {
              const val = inp[1];
              if (Array.isArray(val) && typeof val[1] === "number") {
                // [shadow type, number]
                const n = val[1];
                if (chance(0.7)) {
                  val[1] = Number((n * rand(0.3, 2.5) + rand(-5, 5)).toFixed(2));
                  mutated++;
                }
              } else if (typeof val === "number") {
                inp[1] = Number((val * rand(0.4, 2.2) + rand(-3, 3)).toFixed(2));
                mutated++;
              }
            }
          }
        }

        // Occasional safe opcode swap
        if (block.opcode && SAFE_OPCODE_SWAPS[block.opcode] && chance(factor * 0.25)) {
          block.opcode = pick(SAFE_OPCODE_SWAPS[block.opcode]);
          opcodeSwaps++;
        }
      }
    }
    log(`Block Chaos: ${mutated} number tweaks, ${opcodeSwaps} opcode swaps, ${positionJiggles} position jiggles`, "ok");
  }

  /**
   * Name Mangle — glitch sprite names, variable names, list names.
   * Careful not to break internal ID references too badly.
   */
  function corruptNameMangle(proj, factor) {
    let count = 0;
    for (const target of proj.targets || []) {
      // Sprite name (Stage is sacred-ish, but we can still lightly touch it)
      if (target.name && chance(factor * 0.7)) {
        const original = target.name;
        if (target.isStage) {
          // very light
          if (chance(0.3)) target.name = glitchText(original, factor * 4);
        } else {
          target.name = glitchText(original, factor * 8);
        }
        if (target.name !== original) count++;
      }

      // Variables: { id: [name, value] }
      if (target.variables) {
        for (const id of Object.keys(target.variables)) {
          const v = target.variables[id];
          if (Array.isArray(v) && typeof v[0] === "string" && chance(factor * 0.5)) {
            v[0] = glitchText(v[0], factor * 6);
            count++;
          }
        }
      }
      // Lists
      if (target.lists) {
        for (const id of Object.keys(target.lists)) {
          const l = target.lists[id];
          if (Array.isArray(l) && typeof l[0] === "string" && chance(factor * 0.5)) {
            l[0] = glitchText(l[0], factor * 6);
            count++;
          }
        }
      }
    }
    log(`Name Mangle: altered ${count} names`, "ok");
  }

  /**
   * Coordinate Jitter — randomize sprite position, size, direction, layer.
   */
  function corruptCoordJitter(proj, factor) {
    let count = 0;
    for (const target of proj.targets || []) {
      if (target.isStage) continue;
      if (chance(factor * 0.85)) {
        if (typeof target.x === "number") {
          target.x = Math.round(target.x + rand(-120, 120) * factor);
        }
        if (typeof target.y === "number") {
          target.y = Math.round(target.y + rand(-90, 90) * factor);
        }
        if (typeof target.size === "number") {
          target.size = Math.max(5, Math.min(300, target.size * rand(0.5, 1.8)));
        }
        if (typeof target.direction === "number") {
          target.direction = ((target.direction + rand(-180, 180) * factor) % 360 + 360) % 360;
          if (target.direction > 180) target.direction -= 360;
        }
        if (typeof target.volume === "number") {
          target.volume = Math.max(0, Math.min(100, target.volume + rand(-30, 30) * factor));
        }
        count++;
      }
    }
    log(`Coordinate Jitter: messed with ${count} sprites`, "ok");
  }

  /**
   * SVG Glitch — inject visual noise into SVG costume files inside the zip.
   * Keeps the SVG parseable.
   */
  async function corruptSvgGlitch(zip, factor) {
    const svgFiles = [];
    zip.forEach((path, file) => {
      if (!file.dir && path.toLowerCase().endsWith(".svg")) {
        svgFiles.push(path);
      }
    });
    if (svgFiles.length === 0) {
      log("SVG Glitch: no SVG costumes found", "warn");
      return;
    }
    const toTouch = Math.max(1, Math.floor(svgFiles.length * factor * 0.6));
    const chosen = shuffle(svgFiles).slice(0, toTouch);
    let touched = 0;

    for (const path of chosen) {
      try {
        let svg = await zip.file(path).async("string");
        // Inject a few harmless-but-visible glitches
        // 1. Random filter / color matrix if possible
        if (chance(0.6)) {
          const hue = randInt(0, 360);
          const inject = `<filter id="g${randInt(1000,9999)}"><feColorMatrix type="hueRotate" values="${hue}"/></filter>`;
          // Try to insert after <svg ...>
          svg = svg.replace(/(<svg[^>]*>)/i, `$1${inject}`);
          // Apply filter to a group if present, else wrap content
          if (svg.includes("<g") && chance(0.5)) {
            svg = svg.replace(/<g/, `<g filter="url(#g${randInt(1000,9999)})" `);
          }
        }
        // 2. Nudge transform attributes
        svg = svg.replace(/transform="([^"]*)"/gi, (m, t) => {
          if (chance(0.4 * factor)) {
            return `transform="${t} rotate(${randInt(-25, 25)}) scale(${rand(0.85, 1.2).toFixed(2)})"`;
          }
          return m;
        });
        // 3. Randomize some fill/stroke colors lightly
        svg = svg.replace(/fill="(#[0-9a-fA-F]{3,8})"/gi, (m, c) => {
          if (chance(0.35 * factor)) {
            const r = randInt(0, 255).toString(16).padStart(2, "0");
            const g = randInt(0, 255).toString(16).padStart(2, "0");
            const b = randInt(0, 255).toString(16).padStart(2, "0");
            return `fill="#${r}${g}${b}"`;
          }
          return m;
        });
        zip.file(path, svg);
        touched++;
      } catch (_) {
        // skip bad files
      }
    }
    log(`SVG Glitch: visually corrupted ${touched} costume files`, "ok");
  }

  /**
   * PNG Glitch — decode bitmap costumes via canvas, apply visual corruption,
   * re-encode as valid PNG so Scratch can still load them.
   *
   * Effects (scaled by intensity):
   *  - RGB channel shift / swap
   *  - Horizontal scanline offsets (datamosh-ish)
   *  - Random pixel noise / bit crush
   *  - Occasional row/column duplication or slice
   *  - Color inversion / posterize pockets
   */
  async function corruptPngGlitch(zip, factor) {
    const pngFiles = [];
    zip.forEach((path, file) => {
      if (!file.dir && path.toLowerCase().endsWith(".png")) {
        pngFiles.push(path);
      }
    });
    if (pngFiles.length === 0) {
      log("PNG Glitch: no PNG costumes found", "warn");
      return;
    }

    const toTouch = Math.max(1, Math.floor(pngFiles.length * Math.min(1, factor * 0.85)));
    const chosen = shuffle(pngFiles).slice(0, toTouch);
    let touched = 0;

    // Helper: load blob → ImageBitmap / HTMLImageElement
    function loadImage(blob) {
      return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(url);
          resolve(img);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error("image load failed"));
        };
        img.src = url;
      });
    }

    for (const path of chosen) {
      try {
        const blob = await zip.file(path).async("blob");
        const img = await loadImage(blob);
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (w < 1 || h < 1) continue;

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data; // RGBA

        // --- Effect 1: channel shift / RGB swap ---
        if (chance(0.55 + factor * 0.3)) {
          const mode = randInt(0, 3);
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            if (mode === 0) { data[i] = g; data[i + 1] = b; data[i + 2] = r; }      // RGB → GBR
            else if (mode === 1) { data[i] = b; data[i + 1] = r; data[i + 2] = g; } // RGB → BRG
            else if (mode === 2) { data[i] = r; data[i + 1] = b; data[i + 2] = g; } // swap G/B
            else { // slight channel offset via neighbor pixels
              const shift = randInt(1, Math.max(1, Math.floor(4 * factor))) * 4;
              if (i + shift + 2 < data.length) {
                data[i] = data[i + shift];
                data[i + 2] = data[i + shift + 2];
              }
            }
          }
        }

        // --- Effect 2: horizontal scanline offset (classic glitch) ---
        if (chance(0.5 + factor * 0.35)) {
          const bandH = Math.max(1, Math.floor(h * (0.02 + factor * 0.08)));
          const bands = Math.max(1, Math.floor((h / bandH) * factor * 0.5));
          for (let b = 0; b < bands; b++) {
            const y0 = randInt(0, Math.max(0, h - bandH));
            const offset = randInt(-Math.floor(w * 0.25 * factor), Math.floor(w * 0.25 * factor));
            if (offset === 0) continue;
            // copy the band with horizontal shift
            const rowBytes = w * 4;
            const temp = new Uint8ClampedArray(bandH * rowBytes);
            for (let row = 0; row < bandH; row++) {
              const src = (y0 + row) * rowBytes;
              temp.set(data.subarray(src, src + rowBytes), row * rowBytes);
            }
            for (let row = 0; row < bandH; row++) {
              const destY = y0 + row;
              for (let x = 0; x < w; x++) {
                const sx = (x - offset + w * 10) % w; // wrap
                const di = (destY * w + x) * 4;
                const si = (row * w + sx) * 4;
                data[di] = temp[si];
                data[di + 1] = temp[si + 1];
                data[di + 2] = temp[si + 2];
                data[di + 3] = temp[si + 3];
              }
            }
          }
        }

        // --- Effect 3: random pixel noise / bit crush ---
        if (chance(0.45 + factor * 0.4)) {
          const noiseAmt = Math.floor(data.length / 4 * (0.02 + factor * 0.12));
          for (let n = 0; n < noiseAmt; n++) {
            const i = randInt(0, Math.floor(data.length / 4) - 1) * 4;
            if (chance(0.5)) {
              // bit crush one channel
              data[i + randInt(0, 2)] = data[i + randInt(0, 2)] & (0xff << randInt(1, 4));
            } else {
              data[i] = randInt(0, 255);
              data[i + 1] = randInt(0, 255);
              data[i + 2] = randInt(0, 255);
            }
          }
        }

        // --- Effect 4: slice / duplicate a column or row ---
        if (chance(0.35 * factor + 0.15)) {
          if (chance(0.5) && w > 4) {
            // duplicate a vertical slice
            const x0 = randInt(0, w - 2);
            const sliceW = randInt(1, Math.max(1, Math.floor(w * 0.08)));
            const destX = randInt(0, Math.max(0, w - sliceW));
            for (let y = 0; y < h; y++) {
              for (let dx = 0; dx < sliceW; dx++) {
                const si = (y * w + Math.min(w - 1, x0 + dx)) * 4;
                const di = (y * w + Math.min(w - 1, destX + dx)) * 4;
                data[di] = data[si];
                data[di + 1] = data[si + 1];
                data[di + 2] = data[si + 2];
                data[di + 3] = data[si + 3];
              }
            }
          } else if (h > 4) {
            // duplicate a horizontal band
            const y0 = randInt(0, h - 2);
            const sliceH = randInt(1, Math.max(1, Math.floor(h * 0.1)));
            const destY = randInt(0, Math.max(0, h - sliceH));
            for (let dy = 0; dy < sliceH; dy++) {
              const srcRow = Math.min(h - 1, y0 + dy);
              const dstRow = Math.min(h - 1, destY + dy);
              for (let x = 0; x < w; x++) {
                const si = (srcRow * w + x) * 4;
                const di = (dstRow * w + x) * 4;
                data[di] = data[si];
                data[di + 1] = data[si + 1];
                data[di + 2] = data[si + 2];
                data[di + 3] = data[si + 3];
              }
            }
          }
        }

        // --- Effect 5: local invert / posterize pockets ---
        if (chance(0.3 + factor * 0.25)) {
          const pockets = Math.max(1, Math.floor(3 * factor));
          for (let p = 0; p < pockets; p++) {
            const px = randInt(0, w - 1);
            const py = randInt(0, h - 1);
            const rw = randInt(4, Math.max(5, Math.floor(w * 0.2)));
            const rh = randInt(4, Math.max(5, Math.floor(h * 0.2)));
            const invert = chance(0.5);
            for (let y = py; y < Math.min(h, py + rh); y++) {
              for (let x = px; x < Math.min(w, px + rw); x++) {
                const i = (y * w + x) * 4;
                if (invert) {
                  data[i] = 255 - data[i];
                  data[i + 1] = 255 - data[i + 1];
                  data[i + 2] = 255 - data[i + 2];
                } else {
                  // posterize
                  const levels = 4;
                  data[i] = Math.round(data[i] / 255 * levels) / levels * 255;
                  data[i + 1] = Math.round(data[i + 1] / 255 * levels) / levels * 255;
                  data[i + 2] = Math.round(data[i + 2] / 255 * levels) / levels * 255;
                }
              }
            }
          }
        }

        ctx.putImageData(imageData, 0, 0);

        // Re-encode as PNG (keeps transparency)
        const outBlob = await new Promise((resolve) => {
          canvas.toBlob((b) => resolve(b), "image/png");
        });
        if (outBlob) {
          zip.file(path, outBlob);
          touched++;
        }
      } catch (err) {
        // skip unreadable / broken images
      }
    }
    log(`PNG Glitch: visually corrupted ${touched} bitmap costumes`, "ok");
  }

  /**
   * Broadcast Mess — scramble broadcast message names in the broadcasts map
   * and in block fields/inputs that reference them.
   */
  function corruptBroadcastMess(proj, factor) {
    let count = 0;
    for (const target of proj.targets || []) {
      const broadcasts = target.broadcasts || {};
      const idToNew = {};
      for (const id of Object.keys(broadcasts)) {
        if (chance(factor * 0.7)) {
          const old = broadcasts[id];
          const neu = glitchText(String(old), factor * 7) || "???";
          broadcasts[id] = neu;
          idToNew[id] = neu;
          count++;
        }
      }
      // Also update block fields that hardcode the message string
      const blocks = target.blocks || {};
      for (const bid of Object.keys(blocks)) {
        const b = blocks[bid];
        if (!b) continue;
        // fields.BROADCAST_OPTION = [name, id]
        if (b.fields && b.fields.BROADCAST_OPTION) {
          const f = b.fields.BROADCAST_OPTION;
          if (Array.isArray(f) && f[1] && idToNew[f[1]]) {
            f[0] = idToNew[f[1]];
          }
        }
        // inputs can contain [11, name, id]
        if (b.inputs) {
          for (const k of Object.keys(b.inputs)) {
            const inp = b.inputs[k];
            if (Array.isArray(inp) && Array.isArray(inp[1]) && inp[1][0] === 11) {
              const msgId = inp[1][2];
              if (msgId && idToNew[msgId]) {
                inp[1][1] = idToNew[msgId];
              }
            }
          }
        }
      }
    }
    log(`Broadcast Mess: mangled ${count} broadcast messages`, "ok");
  }

  /**
   * Monitor Chaos — shuffle positions and sizes of variable/list monitors.
   */
  function corruptMonitorChaos(proj, factor) {
    const monitors = proj.monitors || [];
    if (monitors.length === 0) {
      log("Monitor Chaos: no monitors present", "warn");
      return;
    }
    let count = 0;
    for (const m of monitors) {
      if (chance(factor * 0.8)) {
        m.x = randInt(0, 400);
        m.y = randInt(0, 300);
        if (m.width) m.width = Math.max(40, Math.round(m.width * rand(0.5, 1.8)));
        if (m.height) m.height = Math.max(20, Math.round(m.height * rand(0.5, 1.8)));
        if (typeof m.visible === "boolean" && chance(0.2)) m.visible = !m.visible;
        count++;
      }
    }
    log(`Monitor Chaos: rearranged ${count} monitors`, "ok");
  }

  // ---------- Main corrupt pipeline ----------
  async function runCorruption() {
    if (!originalZip || !projectJson) {
      log("No project loaded.", "err");
      return;
    }

    corruptBtn.disabled = true;
    downloadBtn.classList.add("hidden");
    log("— Starting corruption —", "info");

    const factor = intensityFactor();
    // Deep clone project.json so we don't mutate the original parse
    const proj = JSON.parse(JSON.stringify(projectJson));
    // Clone the zip so we can modify assets
    const zip = await JSZip.loadAsync(await originalZip.generateAsync({ type: "arraybuffer" }));

    try {
      if (document.getElementById("optCostumeShuffle").checked) {
        corruptCostumeShuffle(proj, factor);
      }
      if (document.getElementById("optSoundScramble").checked) {
        corruptSoundScramble(proj, factor);
      }
      if (document.getElementById("optBlockChaos").checked) {
        corruptBlockChaos(proj, factor);
      }
      if (document.getElementById("optNameMangle").checked) {
        corruptNameMangle(proj, factor);
      }
      if (document.getElementById("optCoordJitter").checked) {
        corruptCoordJitter(proj, factor);
      }
      if (document.getElementById("optBroadcastMess").checked) {
        corruptBroadcastMess(proj, factor);
      }
      if (document.getElementById("optMonitorChaos").checked) {
        corruptMonitorChaos(proj, factor);
      }
      if (document.getElementById("optSvgGlitch").checked) {
        await corruptSvgGlitch(zip, factor);
      }
      if (document.getElementById("optPngGlitch").checked) {
        await corruptPngGlitch(zip, factor);
      }

      // Write mutated project.json back
      zip.file("project.json", JSON.stringify(proj));

      // Generate the new sb3
      log("Packing corrupted archive…", "info");
      const blob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });
      corruptedBlob = blob;

      const outName = originalFileName.replace(/\.(sb3|zip)$/i, "") + "_corrupted.sb3";
      log(`Done! Ready to download as ${outName}`, "ok");
      downloadBtn.classList.remove("hidden");
      downloadBtn.onclick = () => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(corruptedBlob);
        a.download = outName;
        a.click();
        URL.revokeObjectURL(a.href);
      };
    } catch (err) {
      log(`Corruption failed: ${err.message}`, "err");
      console.error(err);
    } finally {
      corruptBtn.disabled = false;
    }
  }

  corruptBtn.addEventListener("click", runCorruption);
})();
