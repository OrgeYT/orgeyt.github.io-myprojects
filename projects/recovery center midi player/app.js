(() => {
  "use strict";

  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const NUM_KEYS = 26;

  // DOM
  const keysEl = document.getElementById("keys");
  const keypadScreen = document.getElementById("keypadScreen");
  const midiFileInput = document.getElementById("midiFile");
  const fileNameEl = document.getElementById("fileName");
  const playBtn = document.getElementById("playBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const stopBtn = document.getElementById("stopBtn");
  const goBtn = document.getElementById("goBtn");
  const tryAgainBtn = document.getElementById("tryAgainBtn");
  const pitchOffsetInput = document.getElementById("pitchOffset");
  const pitchOffsetVal = document.getElementById("pitchOffsetVal");
  const volumeInput = document.getElementById("volume");
  const trackListEl = document.getElementById("trackList");
  const selectAllTracksBtn = document.getElementById("selectAllTracks");
  const selectNoneTracksBtn = document.getElementById("selectNoneTracks");
  const statusEl = document.getElementById("status");
  const timeDisplay = document.getElementById("timeDisplay");
  const progressBar = document.getElementById("progressBar");
  const progressWrap = document.getElementById("progressWrap");
  const pianoRollCanvas = document.getElementById("pianoRoll");
  const typeInput = document.getElementById("typeInput");
  const typeBtn = document.getElementById("typeBtn");
  const monoModeInput = document.getElementById("monoMode");
  const zoomSlider = document.getElementById("zoomSlider");
  const zoomInBtn = document.getElementById("zoomInBtn");
  const zoomOutBtn = document.getElementById("zoomOutBtn");
  const zoomLabel = document.getElementById("zoomLabel");
  const pianoCtx = pianoRollCanvas.getContext("2d");

  /** Horizontal zoom: 1 = full song, higher = closer */
  let rollZoom = 1;
  /** Left edge of visible time window (seconds) */
  let viewStart = 0;

  // Audio
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.85;
  masterGain.connect(audioCtx.destination);

  /** @type {Map<string, AudioBuffer>} */
  const buffers = new Map();
  /** @type {HTMLButtonElement[]} */
  const keyButtons = [];
  /**
   * Active sample voices for mono/cutoff.
   * @type {{ source: AudioBufferSourceNode, gain: GainNode, startTime: number }[]}
   */
  let activeVoices = [];
  let monoMode = false;

  // MIDI state
  let midi = null;
  /** @type {{ midi: number, time: number, duration: number, track: number }[]} */
  let allNotes = [];
  /** @type {number[]} */
  let selectedTrackIndices = [];
  let avgMidi = 60;
  let pitchOffset = 0;
  let isPlaying = false;
  let isPaused = false;
  let playStartCtxTime = 0;
  let pauseOffset = 0;
  /** Current transport position in seconds (updated while playing / on seek) */
  let transportTime = 0;
  let duration = 0;
  let animFrame = null;
  /** @type {number[]} */
  let scheduledTimeouts = [];
  /** @type {string[]} last letters pressed (newest at end), max 10 */
  const recentLetters = [];
  const MAX_RECENT = 10;
  /** typing-out sequence in progress */
  let isTyping = false;
  /** @type {number[]} */
  let typeTimeouts = [];

  function updateLetterPreview() {
    if (recentLetters.length === 0) {
      keypadScreen.textContent = ":-)";
      return;
    }
    keypadScreen.textContent = recentLetters.join("");
  }

  function pushLetter(letter) {
    recentLetters.push(letter);
    while (recentLetters.length > MAX_RECENT) recentLetters.shift();
    updateLetterPreview();
  }

  function clearLetterPreview() {
    recentLetters.length = 0;
    updateLetterPreview();
  }

  function clearTypeSequence() {
    typeTimeouts.forEach((id) => clearTimeout(id));
    typeTimeouts = [];
    isTyping = false;
    typeBtn.disabled = false;
    typeBtn.textContent = "Type";
  }

  /**
   * Type out text using button-press sounds.
   * Only A–Z letters are played; other characters are skipped (with a short gap).
   */
  function typeText(raw) {
    if (isTyping) {
      clearTypeSequence();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();

    const chars = String(raw || "").toUpperCase().split("");
    const letters = chars.filter((c) => c >= "A" && c <= "Z");
    if (letters.length === 0) {
      statusEl.textContent = "No A–Z letters to type";
      return;
    }

    isTyping = true;
    typeBtn.disabled = true;
    typeBtn.textContent = "Typing…";
    statusEl.textContent = `Typing ${letters.length} letter${letters.length === 1 ? "" : "s"}…`;

    // ~180ms between presses — snappy but readable
    const gapMs = 180;
    letters.forEach((letter, i) => {
      const tid = setTimeout(() => {
        const idx = LETTERS.indexOf(letter);
        if (idx >= 0) {
          playLetter(idx);
          flashKey(idx);
          pushLetter(letter);
        }
        if (i === letters.length - 1) {
          isTyping = false;
          typeBtn.disabled = false;
          typeBtn.textContent = "Type";
          statusEl.textContent = "Done typing";
        }
      }, i * gapMs);
      typeTimeouts.push(tid);
    });
  }

  // —— Build keypad UI ——
  function buildKeys() {
    keysEl.innerHTML = "";
    keyButtons.length = 0;
    // Layout like screenshot: 8 columns, A–H row1, I–N + round, O–T, U–Z
    LETTERS.forEach((letter, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "key";
      btn.textContent = letter;
      btn.dataset.letter = letter;
      btn.dataset.index = String(i);
      btn.addEventListener("click", () => {
        playLetter(i);
        flashKey(i);
        pushLetter(letter);
      });
      keysEl.appendChild(btn);
      keyButtons.push(btn);
    });
  }

  function flashKey(index) {
    const btn = keyButtons[index];
    if (!btn) return;
    btn.classList.add("pressed");
    clearTimeout(btn._flashTimer);
    btn._flashTimer = setTimeout(() => btn.classList.remove("pressed"), 120);
  }

  // —— Load sounds ——
  async function loadSounds() {
    const loads = LETTERS.map(async (letter) => {
      const url = `sounds/Press${letter}.wav`;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(res.statusText);
        const arr = await res.arrayBuffer();
        const buf = await audioCtx.decodeAudioData(arr);
        buffers.set(letter, buf);
      } catch (e) {
        console.warn("Failed to load", letter, e);
      }
    });
    await Promise.all(loads);
    statusEl.textContent = `Loaded ${buffers.size}/26 button sounds · ready`;
  }

  function stopVoicesBefore(beforeTime) {
    // Cut only voices that started earlier — same-time (double) notes stay
    const keep = [];
    for (const v of activeVoices) {
      if (v.startTime < beforeTime - 0.001) {
        try {
          // Quick mute then stop to avoid click
          const now = audioCtx.currentTime;
          const muteAt = Math.max(now, beforeTime - 0.008);
          v.gain.gain.cancelScheduledValues(now);
          v.gain.gain.setValueAtTime(v.gain.gain.value, now);
          v.gain.gain.linearRampToValueAtTime(0, muteAt + 0.008);
          v.source.stop(muteAt + 0.01);
        } catch (_) {}
      } else {
        keep.push(v);
      }
    }
    activeVoices = keep;
  }

  function playLetter(index, when = 0) {
    const letter = LETTERS[index];
    const buf = buffers.get(letter);
    if (!buf) return;
    const t = when > 0 ? when : audioCtx.currentTime;

    if (monoMode) {
      stopVoicesBefore(t);
    }

    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const gain = audioCtx.createGain();
    gain.gain.value = 1;
    src.connect(gain);
    gain.connect(masterGain);

    const voice = { source: src, gain, startTime: t };
    activeVoices.push(voice);
    src.onended = () => {
      activeVoices = activeVoices.filter((v) => v !== voice);
    };

    try {
      src.start(t);
    } catch (_) {}
  }

  function stopAllVoices() {
    for (const v of activeVoices) {
      try {
        v.source.stop();
      } catch (_) {}
    }
    activeVoices = [];
  }

  // —— Pitch mapping ——
  // Map MIDI note number to key index 0–25 (A–Z)
  // Center around avgMidi + pitchOffset so the song sits in the middle of A–Z
  function midiToKeyIndex(midiNote) {
    const center = avgMidi + pitchOffset;
    // Spread: use roughly 1 semitone per key around center
    // Clamp to 0..25
    let idx = Math.round(midiNote - center + (NUM_KEYS - 1) / 2);
    if (idx < 0) idx = 0;
    if (idx > NUM_KEYS - 1) idx = NUM_KEYS - 1;
    return idx;
  }

  function recomputeAverage() {
    if (!midi || selectedTrackIndices.length === 0) {
      avgMidi = 60;
      return;
    }
    let sum = 0;
    let count = 0;
    const set = new Set(selectedTrackIndices);
    for (const n of allNotes) {
      if (set.has(n.track)) {
        sum += n.midi;
        count++;
      }
    }
    avgMidi = count > 0 ? sum / count : 60;
  }

  // —— MIDI load ——
  function parseMidi(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const m = new Midi(reader.result);
          resolve(m);
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }

  function extractNotes(m) {
    const notes = [];
    m.tracks.forEach((track, ti) => {
      track.notes.forEach((note) => {
        notes.push({
          midi: note.midi,
          time: note.time,
          duration: note.duration,
          track: ti,
        });
      });
    });
    notes.sort((a, b) => a.time - b.time);
    return notes;
  }

  function renderTrackList() {
    trackListEl.innerHTML = "";
    if (!midi) {
      trackListEl.innerHTML = '<p class="hint">Load a MIDI to see tracks</p>';
      selectAllTracksBtn.disabled = true;
      selectNoneTracksBtn.disabled = true;
      return;
    }
    selectAllTracksBtn.disabled = false;
    selectNoneTracksBtn.disabled = false;
    midi.tracks.forEach((track, i) => {
      const name = track.name || `Track ${i + 1}`;
      const noteCount = track.notes.length;
      const label = document.createElement("label");
      label.className = "track-item";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = selectedTrackIndices.includes(i);
      cb.dataset.track = String(i);
      cb.addEventListener("change", () => {
        if (cb.checked) {
          if (!selectedTrackIndices.includes(i)) selectedTrackIndices.push(i);
        } else {
          selectedTrackIndices = selectedTrackIndices.filter((x) => x !== i);
        }
        recomputeAverage();
        updateStatusAfterTrackChange();
        drawPianoRoll(transportTime);
      });
      label.appendChild(cb);
      label.appendChild(document.createTextNode(`${name} (${noteCount} notes)`));
      trackListEl.appendChild(label);
    });
  }

  function updateStatusAfterTrackChange() {
    const n = selectedTrackIndices.length;
    statusEl.textContent = n
      ? `Tracks selected: ${n} · avg pitch ≈ ${avgMidi.toFixed(1)} · offset ${pitchOffset}`
      : "No tracks selected";
  }

  // —— Playback ——
  function getActiveNotes() {
    const set = new Set(selectedTrackIndices);
    return allNotes.filter((n) => set.has(n.track));
  }

  function clearScheduled() {
    scheduledTimeouts.forEach((id) => clearTimeout(id));
    scheduledTimeouts = [];
  }

  function scheduleFrom(offsetSec) {
    clearScheduled();
    const notes = getActiveNotes();
    const now = audioCtx.currentTime;
    playStartCtxTime = now - offsetSec;
    transportTime = offsetSec;

    for (const note of notes) {
      if (note.time < offsetSec - 0.01) continue;
      const delayMs = (note.time - offsetSec) * 1000;
      const when = now + (note.time - offsetSec);
      const keyIdx = midiToKeyIndex(note.midi);
      const tid = setTimeout(() => {
        playLetter(keyIdx, when);
        flashKey(keyIdx);
        pushLetter(LETTERS[keyIdx]);
      }, Math.max(0, delayMs - 5));
      scheduledTimeouts.push(tid);
    }
  }

  function updateTransportUI(elapsed) {
    transportTime = elapsed;
    const pct = duration > 0 ? (elapsed / duration) * 100 : 0;
    progressBar.style.width = `${Math.min(100, Math.max(0, pct))}%`;
    timeDisplay.textContent = `${fmt(elapsed)} / ${fmt(duration)}`;
    drawPianoRoll(elapsed);
  }

  function tick() {
    if (!isPlaying || isPaused) return;
    const elapsed = audioCtx.currentTime - playStartCtxTime;
    if (elapsed >= duration) {
      stopPlayback();
      statusEl.textContent = "Finished";
      return;
    }
    updateTransportUI(elapsed);
    animFrame = requestAnimationFrame(tick);
  }

  function fmt(sec) {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
  }

  /**
   * Seek to a time in seconds. Works while playing, paused, or stopped.
   */
  function seekTo(sec) {
    if (!midi || duration <= 0) return;
    sec = Math.max(0, Math.min(duration, sec));
    stopAllVoices();
    clearScheduled();
    transportTime = sec;
    pauseOffset = sec;

    if (isPlaying && !isPaused) {
      if (audioCtx.state === "suspended") audioCtx.resume();
      scheduleFrom(sec);
      cancelAnimationFrame(animFrame);
      animFrame = requestAnimationFrame(tick);
      statusEl.textContent = "Playing…";
    } else if (isPlaying && isPaused) {
      updateTransportUI(sec);
      statusEl.textContent = "Paused";
    } else {
      // stopped — arm position so Play starts from here
      isPlaying = false;
      isPaused = false;
      updateTransportUI(sec);
      playBtn.disabled = false;
      pauseBtn.disabled = true;
      stopBtn.disabled = false;
      statusEl.textContent = `Seek · ${fmt(sec)}`;
    }
  }

  function timeFromClientX(clientX, el) {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || duration <= 0) return 0;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * duration;
  }

  function startPlayback() {
    if (!midi || selectedTrackIndices.length === 0) {
      statusEl.textContent = "Select at least one track";
      return;
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    isPlaying = true;
    isPaused = false;
    // Resume from last seek / pause position if set
    const startAt = pauseOffset > 0 && pauseOffset < duration ? pauseOffset : 0;
    clearLetterPreview();
    scheduleFrom(startAt);
    playBtn.disabled = true;
    pauseBtn.disabled = false;
    stopBtn.disabled = false;
    statusEl.textContent = "Playing…";
    cancelAnimationFrame(animFrame);
    animFrame = requestAnimationFrame(tick);
  }

  function pausePlayback() {
    if (!isPlaying || isPaused) return;
    isPaused = true;
    pauseOffset = audioCtx.currentTime - playStartCtxTime;
    transportTime = pauseOffset;
    clearScheduled();
    stopAllVoices();
    cancelAnimationFrame(animFrame);
    playBtn.disabled = false;
    pauseBtn.disabled = true;
    statusEl.textContent = "Paused";
    drawPianoRoll(pauseOffset);
  }

  function resumePlayback() {
    if (!isPlaying || !isPaused) return;
    isPaused = false;
    if (audioCtx.state === "suspended") audioCtx.resume();
    scheduleFrom(pauseOffset);
    playBtn.disabled = true;
    pauseBtn.disabled = false;
    statusEl.textContent = "Playing…";
    cancelAnimationFrame(animFrame);
    animFrame = requestAnimationFrame(tick);
  }

  function stopPlayback() {
    isPlaying = false;
    isPaused = false;
    pauseOffset = 0;
    transportTime = 0;
    clearScheduled();
    stopAllVoices();
    cancelAnimationFrame(animFrame);
    progressBar.style.width = "0%";
    timeDisplay.textContent = `0:00 / ${fmt(duration)}`;
    playBtn.disabled = !midi;
    pauseBtn.disabled = true;
    stopBtn.disabled = true;
    clearLetterPreview();
    keyButtons.forEach((b) => b.classList.remove("pressed"));
    drawPianoRoll(0);
  }

  // —— Piano roll ——
  function visibleWindowSec() {
    if (duration <= 0) return 1;
    return Math.max(0.05, duration / rollZoom);
  }

  /**
   * Keep playhead in view when zoomed. At 1× show the whole song.
   * When zoomed in, center on the red playhead (clamped to song bounds).
   */
  function updateViewStart(playheadSec) {
    if (duration <= 0 || rollZoom <= 1.001) {
      viewStart = 0;
      return;
    }
    const win = visibleWindowSec();
    // Center playhead in the window
    let start = playheadSec - win * 0.35;
    if (start < 0) start = 0;
    if (start + win > duration) start = Math.max(0, duration - win);
    viewStart = start;
  }

  function setZoom(z) {
    const min = 1;
    const max = 64;
    rollZoom = Math.max(min, Math.min(max, z));
    zoomSlider.value = String(rollZoom);
    const label = rollZoom % 1 === 0 ? `${rollZoom}×` : `${rollZoom.toFixed(1)}×`;
    zoomLabel.textContent = label;
    updateViewStart(transportTime);
    drawPianoRoll(transportTime);
  }

  function resizePianoCanvas() {
    const wrap = pianoRollCanvas.parentElement;
    if (!wrap) return;
    const w = Math.max(200, Math.floor(wrap.clientWidth));
    const h = 160;
    const dpr = window.devicePixelRatio || 1;
    pianoRollCanvas.width = Math.floor(w * dpr);
    pianoRollCanvas.height = Math.floor(h * dpr);
    pianoRollCanvas.style.width = w + "px";
    pianoRollCanvas.style.height = h + "px";
    pianoCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawPianoRoll(playheadSec) {
    const wrap = pianoRollCanvas.parentElement;
    const cssW = wrap ? wrap.clientWidth : 600;
    const cssH = 160;
    resizePianoCanvas();
    const w = cssW;
    const h = cssH;

    updateViewStart(playheadSec);

    pianoCtx.fillStyle = "#1a1a1e";
    pianoCtx.fillRect(0, 0, w, h);

    const labelW = 22;
    const rowH = (h - 4) / NUM_KEYS;
    const plotW = w - labelW - 4;
    const plotX = labelW;
    const plotY = 2;
    const win = duration > 0 ? visibleWindowSec() : 1;
    const viewEnd = viewStart + win;

    // Row backgrounds + labels (Z at top = high, A at bottom = low)
    for (let i = 0; i < NUM_KEYS; i++) {
      const keyIdx = NUM_KEYS - 1 - i; // top = Z
      const y = plotY + i * rowH;
      pianoCtx.fillStyle = i % 2 === 0 ? "#222228" : "#1e1e24";
      pianoCtx.fillRect(plotX, y, plotW, rowH);
      pianoCtx.fillStyle = "#888";
      pianoCtx.font = "9px monospace";
      pianoCtx.textAlign = "right";
      pianoCtx.textBaseline = "middle";
      pianoCtx.fillText(LETTERS[keyIdx], plotX - 3, y + rowH / 2);
    }

    // Notes
    if (midi && duration > 0) {
      const notes = getActiveNotes();
      // Note width scales with zoom so presses stay visible when zoomed out
      const noteDur = Math.max(0.04, Math.min(0.25, win * 0.02));
      for (const note of notes) {
        if (note.time + noteDur < viewStart || note.time > viewEnd) continue;
        const keyIdx = midiToKeyIndex(note.midi);
        const row = NUM_KEYS - 1 - keyIdx;
        const x = plotX + ((note.time - viewStart) / win) * plotW;
        const nw = Math.max(2, (noteDur / win) * plotW);
        const y = plotY + row * rowH + 1;
        const nh = Math.max(2, rowH - 2);
        const past = note.time < playheadSec;
        pianoCtx.fillStyle = past ? "#3d9b5f" : "#5ad67a";
        pianoCtx.fillRect(x, y, nw, nh);
      }

      // Playhead (only if in view)
      if (playheadSec >= viewStart && playheadSec <= viewEnd) {
        const px = plotX + ((playheadSec - viewStart) / win) * plotW;
        pianoCtx.strokeStyle = "#ff5c5c";
        pianoCtx.lineWidth = 1.5;
        pianoCtx.beginPath();
        pianoCtx.moveTo(px, plotY);
        pianoCtx.lineTo(px, plotY + NUM_KEYS * rowH);
        pianoCtx.stroke();
      }

      // Time ruler hints at edges
      pianoCtx.fillStyle = "#666";
      pianoCtx.font = "9px monospace";
      pianoCtx.textAlign = "left";
      pianoCtx.textBaseline = "top";
      pianoCtx.fillText(fmt(viewStart), plotX + 2, 2);
      pianoCtx.textAlign = "right";
      pianoCtx.fillText(fmt(Math.min(duration, viewEnd)), plotX + plotW - 2, 2);
    } else {
      pianoCtx.fillStyle = "#666";
      pianoCtx.font = "12px sans-serif";
      pianoCtx.textAlign = "center";
      pianoCtx.textBaseline = "middle";
      pianoCtx.fillText("Load a MIDI to see the piano roll", w / 2, h / 2);
    }
  }

  // —— Events ——
  midiFileInput.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    stopPlayback();
    fileNameEl.textContent = file.name;
    statusEl.textContent = "Loading MIDI…";
    try {
      midi = await parseMidi(file);
      allNotes = extractNotes(midi);
      duration = midi.duration || (allNotes.length ? allNotes[allNotes.length - 1].time + 0.5 : 0);
      selectedTrackIndices = midi.tracks.map((_, i) => i).filter((i) => midi.tracks[i].notes.length > 0);
      if (selectedTrackIndices.length === 0) {
        selectedTrackIndices = midi.tracks.map((_, i) => i);
      }
      recomputeAverage();
      renderTrackList();
      playBtn.disabled = false;
      stopBtn.disabled = true;
      pauseBtn.disabled = true;
      timeDisplay.textContent = `0:00 / ${fmt(duration)}`;
      statusEl.textContent = `Loaded · ${allNotes.length} notes · avg pitch ≈ ${avgMidi.toFixed(1)}`;
      clearLetterPreview();
      transportTime = 0;
      pauseOffset = 0;
      progressBar.style.width = "0%";
      drawPianoRoll(0);
    } catch (err) {
      console.error(err);
      statusEl.textContent = "Failed to parse MIDI";
      midi = null;
      playBtn.disabled = true;
      drawPianoRoll(0);
    }
  });

  // Seek on progress bar
  progressWrap.addEventListener("click", (e) => {
    if (!midi || duration <= 0) return;
    seekTo(timeFromClientX(e.clientX, progressWrap));
  });

  // Seek on piano roll (respects zoom window)
  pianoRollCanvas.addEventListener("click", (e) => {
    if (!midi || duration <= 0) return;
    const rect = pianoRollCanvas.getBoundingClientRect();
    const labelW = 22;
    const plotW = rect.width - labelW - 4;
    if (plotW <= 0) return;
    const x = e.clientX - rect.left - labelW;
    const ratio = Math.max(0, Math.min(1, x / plotW));
    const win = visibleWindowSec();
    seekTo(viewStart + ratio * win);
  });

  // Zoom controls
  zoomSlider.addEventListener("input", () => {
    setZoom(parseFloat(zoomSlider.value) || 1);
  });
  zoomInBtn.addEventListener("click", () => {
    setZoom(rollZoom * 1.5);
  });
  zoomOutBtn.addEventListener("click", () => {
    setZoom(rollZoom / 1.5);
  });
  // Mouse wheel zoom over the roll
  pianoRollCanvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      if (e.deltaY < 0) setZoom(rollZoom * 1.15);
      else setZoom(rollZoom / 1.15);
    },
    { passive: false }
  );

  window.addEventListener("resize", () => {
    drawPianoRoll(transportTime);
  });

  typeBtn.addEventListener("click", () => {
    typeText(typeInput.value);
  });
  typeInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      typeText(typeInput.value);
    }
  });

  playBtn.addEventListener("click", () => {
    if (isPaused) resumePlayback();
    else startPlayback();
  });
  pauseBtn.addEventListener("click", pausePlayback);
  stopBtn.addEventListener("click", () => {
    stopPlayback();
    statusEl.textContent = "Stopped";
  });
  goBtn.addEventListener("click", () => {
    if (isPaused) resumePlayback();
    else if (!isPlaying) startPlayback();
  });
  tryAgainBtn.addEventListener("click", () => {
    stopPlayback();
    statusEl.textContent = "Stopped";
  });

  pitchOffsetInput.addEventListener("input", () => {
    pitchOffset = parseInt(pitchOffsetInput.value, 10) || 0;
    pitchOffsetVal.textContent = String(pitchOffset);
    if (midi) {
      updateStatusAfterTrackChange();
      drawPianoRoll(transportTime);
    }
  });

  volumeInput.addEventListener("input", () => {
    masterGain.gain.value = parseFloat(volumeInput.value);
  });

  monoModeInput.addEventListener("change", () => {
    monoMode = monoModeInput.checked;
  });
  monoMode = monoModeInput.checked;

  selectAllTracksBtn.addEventListener("click", () => {
    if (!midi) return;
    selectedTrackIndices = midi.tracks.map((_, i) => i);
    renderTrackList();
    recomputeAverage();
    updateStatusAfterTrackChange();
    drawPianoRoll(transportTime);
  });

  selectNoneTracksBtn.addEventListener("click", () => {
    selectedTrackIndices = [];
    renderTrackList();
    recomputeAverage();
    updateStatusAfterTrackChange();
    drawPianoRoll(transportTime);
  });

  // Init
  buildKeys();
  loadSounds();
  drawPianoRoll(0);
})();
