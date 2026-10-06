(() => {
  "use strict";

  const NUM_SLICES = 21;
  const SAMPLE_PATHS = Array.from({ length: NUM_SLICES }, (_, i) =>
    `samples/snippet_${String(i + 1).padStart(2, "0")}.wav`
  );

  // ---------- DOM ----------
  const midiInput = document.getElementById("midiInput");
  const playBtn = document.getElementById("playBtn");
  const stopBtn = document.getElementById("stopBtn");
  const statusEl = document.getElementById("status");
  const volSlider = document.getElementById("volSlider");
  const timeDisplay = document.getElementById("timeDisplay");
  const markerList = document.getElementById("markerList");

  // ---------- Audio ----------
  let audioCtx = null;
  let masterGain = null;
  const buffers = new Array(NUM_SLICES); // AudioBuffer

  // Active voices: Map<sourceId, {source, markerIdx, gainNode}>
  let voiceId = 0;
  const activeVoices = new Map();
  // Per-marker active count (for polyphony highlight)
  const markerActiveCount = new Array(NUM_SLICES).fill(0);
  // NPS tracking – rolling 1s window of hit timestamps
  const npsHits = Array.from({ length: NUM_SLICES }, () => []);
  let npsRafId = null;
  const totalNpsEl = document.getElementById("totalNps");
  const maxNpsEl = document.getElementById("maxNps");
  const resetMaxNpsBtn = document.getElementById("resetMaxNps");
  let maxNps = 0;

  function recordNpsHit(idx) {
    const now = performance.now();
    npsHits[idx].push(now);
  }

  function updateNpsDisplay() {
    const now = performance.now();
    const windowMs = 1000;
    let total = 0;
    for (let i = 0; i < NUM_SLICES; i++) {
      // prune
      const arr = npsHits[i];
      while (arr.length && now - arr[0] > windowMs) arr.shift();
      const n = arr.length;
      total += n;
      const el = document.getElementById(`marker-nps-${i}`);
      if (el) el.textContent = String(n);
      const cell = document.getElementById(`marker-cell-${i}`);
      if (cell) cell.classList.toggle("active-nps", n > 0);
    }
    if (totalNpsEl) totalNpsEl.textContent = total + " NPS";
    if (total > maxNps) {
      maxNps = total;
      if (maxNpsEl) maxNpsEl.textContent = "MAX " + maxNps;
    }
    npsRafId = requestAnimationFrame(updateNpsDisplay);
  }

  if (resetMaxNpsBtn) {
    resetMaxNpsBtn.addEventListener("click", () => {
      maxNps = 0;
      if (maxNpsEl) maxNpsEl.textContent = "MAX 0";
    });
  }

  // start NPS updater once
  npsRafId = requestAnimationFrame(updateNpsDisplay);

  // ---------- MIDI ----------
  let events = []; // {t: seconds, type: 'on'|'off', note, vel}
  let midiDuration = 0;
  let isPlaying = false;
  let playStartCtxTime = 0; // audioCtx.currentTime when play started
  let playStartOffset = 0; // song position at play start
  let animFrameId = null;
  let nextEventIdx = 0;
  // note -> list of active voice ids (for matching note_off)
  const noteToVoices = new Map();

  // ---------- Helpers ----------
  // Example MIDI amen track uses exactly these 21 pitches: 42 + 60..79
  // Map relative to 60 so the main cluster lands cleanly on slices 0-19,
  // and any note outside wraps around (high ↔ low).
  const BASE_NOTE = 60;
  function noteToSlice(note) {
    return ((note - BASE_NOTE) % NUM_SLICES + NUM_SLICES) % NUM_SLICES;
  }

  function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  }

  function setStatus(msg) {
    statusEl.textContent = msg;
  }

  function buildMarkerUI() {
    markerList.innerHTML = "";
    for (let i = 0; i < NUM_SLICES; i++) {
      const cell = document.createElement("div");
      cell.className = "marker-cell";
      cell.id = `marker-cell-${i}`;

      const pad = document.createElement("div");
      pad.className = "marker-pad";
      pad.id = `marker-${i}`;
      pad.dataset.idx = i;
      pad.textContent = i + 1;
      pad.title = `Slice ${i + 1}`;

      const npsEl = document.createElement("div");
      npsEl.className = "marker-nps";
      npsEl.id = `marker-nps-${i}`;
      npsEl.textContent = "0";

      cell.appendChild(pad);
      cell.appendChild(npsEl);
      markerList.appendChild(cell);
    }
  }

  function setMarkerActive(idx, active) {
    const pad = document.getElementById(`marker-${idx}`);
    if (pad) pad.classList.toggle("active", !!active);
  }

  // ---------- Sample loading ----------
  async function loadSamples() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = parseFloat(volSlider.value);
      masterGain.connect(audioCtx.destination);
    }

    setStatus("Loading samples…");
    const promises = SAMPLE_PATHS.map(async (path, i) => {
      const resp = await fetch(path);
      if (!resp.ok) throw new Error(`Failed to load ${path}`);
      const arr = await resp.arrayBuffer();
      const buf = await audioCtx.decodeAudioData(arr);
      buffers[i] = buf;
    });

    await Promise.all(promises);
    setStatus("Samples ready · load a MIDI or play example");
  }

  // ---------- MIDI parsing (pure JS, no deps) ----------
  function ticksToSeconds(ticks, ticksPerBeat, tempoMap) {
    let sec = 0;
    let lastTick = 0;
    let usPerBeat = 500000;
    for (const tm of tempoMap) {
      if (tm.tick > ticks) break;
      const dt = tm.tick - lastTick;
      sec += (dt / ticksPerBeat) * (usPerBeat / 1e6);
      lastTick = tm.tick;
      usPerBeat = tm.usPerBeat;
    }
    const dt = ticks - lastTick;
    sec += (dt / ticksPerBeat) * (usPerBeat / 1e6);
    return sec;
  }

  function readVarLen(view, offset) {
    let value = 0;
    let b;
    do {
      b = view.getUint8(offset++);
      value = (value << 7) | (b & 0x7f);
    } while (b & 0x80);
    return { value, offset };
  }

  function parseMidiArrayBuffer(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    let o = 0;

    // Header chunk: "MThd" (4) + length (4) + data (usually 6)
    if (view.getUint32(o) !== 0x4d546864) throw new Error("Not a MIDI file (missing MThd)");
    o += 4;
    const headerLen = view.getUint32(o); o += 4;
    const format = view.getUint16(o); o += 2;
    const numTracks = view.getUint16(o); o += 2;
    const division = view.getUint16(o); o += 2;
    // Advance past any remaining header bytes (standard header data is 6 bytes)
    o = 8 + headerLen; // 4 (MThd) + 4 (len field) + headerLen

    const ticksPerBeat = division & 0x8000 ? 480 : division; // ignore SMPTE for simplicity
    const tempoMap = [{ tick: 0, usPerBeat: 500000 }];
    const raw = [];

    for (let t = 0; t < numTracks; t++) {
      if (o + 8 > view.byteLength) break;
      if (view.getUint32(o) !== 0x4d54726b) {
        // skip unknown
        o += 4;
        const skipLen = view.getUint32(o); o += 4 + skipLen;
        continue;
      }
      o += 4; // MTrk
      const trackLen = view.getUint32(o); o += 4;
      const trackEnd = o + trackLen;
      let absTick = 0;
      let runningStatus = 0;

      while (o < trackEnd) {
        const vl = readVarLen(view, o);
        absTick += vl.value;
        o = vl.offset;

        let status = view.getUint8(o);
        if (status < 0x80) {
          // running status
          status = runningStatus;
        } else {
          o++;
          runningStatus = status;
        }

        const type = status & 0xf0;
        const channel = status & 0x0f;

        if (status === 0xff) {
          // meta
          const metaType = view.getUint8(o++);
          const ml = readVarLen(view, o);
          o = ml.offset;
          const metaLen = ml.value;
          if (metaType === 0x51 && metaLen === 3) {
            const us = (view.getUint8(o) << 16) | (view.getUint8(o + 1) << 8) | view.getUint8(o + 2);
            tempoMap.push({ tick: absTick, usPerBeat: us });
          }
          o += metaLen;
        } else if (status === 0xf0 || status === 0xf7) {
          // sysex
          const sl = readVarLen(view, o);
          o = sl.offset + sl.value;
        } else if (type === 0x80 || type === 0x90) {
          // note off / note on
          const note = view.getUint8(o++);
          const vel = view.getUint8(o++);
          const isOn = type === 0x90 && vel > 0;
          const isOff = type === 0x80 || (type === 0x90 && vel === 0);
          if (isOn || isOff) {
            raw.push({
              tick: absTick,
              type: isOn ? "on" : "off",
              note,
              vel: isOn ? vel : 0,
            });
          }
        } else if (type === 0xa0 || type === 0xb0 || type === 0xe0) {
          o += 2; // two data bytes
        } else if (type === 0xc0 || type === 0xd0) {
          o += 1; // one data byte
        } else {
          // unknown, try to skip
          break;
        }
      }
      o = trackEnd;
    }

    // clean tempo map
    tempoMap.sort((a, b) => a.tick - b.tick);
    const cleanTempo = [];
    for (const tm of tempoMap) {
      if (cleanTempo.length && cleanTempo[cleanTempo.length - 1].tick === tm.tick) {
        cleanTempo[cleanTempo.length - 1] = tm;
      } else cleanTempo.push(tm);
    }

    const evs = raw.map((e) => ({
      t: ticksToSeconds(e.tick, ticksPerBeat, cleanTempo),
      type: e.type,
      note: e.note,
      vel: e.vel,
    }));
    evs.sort((a, b) => a.t - b.t || (a.type === "off" ? -1 : 1));

    midiDuration = evs.length ? evs[evs.length - 1].t + 0.5 : 0;
    return evs;
  }

  async function loadMidiFile(fileOrUrl, isUrl = false) {
    setStatus("Parsing MIDI…");
    let buf;
    if (isUrl) {
      const r = await fetch(fileOrUrl);
      buf = await r.arrayBuffer();
    } else {
      buf = await fileOrUrl.arrayBuffer();
    }
    events = parseMidiArrayBuffer(buf);
    nextEventIdx = 0;
    playStartOffset = 0;
    setStatus(`MIDI ready · ${events.length} events · ${formatTime(midiDuration)}`);
    playBtn.disabled = false;
    stopBtn.disabled = false;
    timeDisplay.textContent = `0:00 / ${formatTime(midiDuration)}`;
    if (typeof onMidiLoadedForRoll === "function") onMidiLoadedForRoll();
  }

  // ---------- Playback engine ----------
  const LOOKAHEAD = 0.03; // tiny look-ahead only for audio precision – keeps markers in sync

  function stopAllVoices() {
    for (const [, voice] of activeVoices) {
      try { voice.source.stop(); } catch (_) {}
      try { voice.source.disconnect(); } catch (_) {}
      try { voice.gainNode.disconnect(); } catch (_) {}
      if (voice.expireTimer) clearTimeout(voice.expireTimer);
    }
    activeVoices.clear();
    noteToVoices.clear();
    for (let i = 0; i < NUM_SLICES; i++) {
      markerActiveCount[i] = 0;
      setMarkerActive(i, false);
    }
  }

  function releaseVoice(id) {
    const voice = activeVoices.get(id);
    if (!voice) return;
    activeVoices.delete(id);
    if (voice.expireTimer) {
      clearTimeout(voice.expireTimer);
      voice.expireTimer = null;
    }
    const idx = voice.markerIdx;
    markerActiveCount[idx] = Math.max(0, markerActiveCount[idx] - 1);
    setMarkerActive(idx, markerActiveCount[idx] > 0);

    const list = noteToVoices.get(voice.note);
    if (list) {
      const pos = list.indexOf(id);
      if (pos >= 0) list.splice(pos, 1);
      if (list.length === 0) noteToVoices.delete(voice.note);
    }
    try { voice.source.disconnect(); } catch (_) {}
    try { voice.gainNode.disconnect(); } catch (_) {}
  }

  const interruptToggle = document.getElementById("interruptToggle");

  function interruptSlice(idx) {
    // stop every active voice on this slice
    const toKill = [];
    for (const [id, voice] of activeVoices) {
      if (voice.markerIdx === idx) toKill.push(id);
    }
    for (const id of toKill) {
      const voice = activeVoices.get(id);
      if (!voice) continue;
      try { voice.source.stop(); } catch (_) {}
      // releaseVoice cleans counts / highlights / timers
      releaseVoice(id);
    }
  }

  function triggerNoteOn(note, vel, when) {
    const now = audioCtx.currentTime;
    if (when < now - 0.01) when = now;

    const idx = noteToSlice(note);
    const buf = buffers[idx];
    if (!buf) return;

    // Interrupt mode: cut any still-playing hit on this slice first
    if (interruptToggle && interruptToggle.checked) {
      interruptSlice(idx);
    }

    const source = audioCtx.createBufferSource();
    source.buffer = buf;
    source.loop = false; // one-shot – never loop even if held

    const g = audioCtx.createGain();
    const v = Math.max(0.04, Math.min(1, (vel / 127) ** 0.65));
    g.gain.value = v;

    source.connect(g);
    g.connect(masterGain);

    const id = ++voiceId;
    const voice = { source, markerIdx: idx, gainNode: g, id, note, expireTimer: null };
    activeVoices.set(id, voice);

    if (!noteToVoices.has(note)) noteToVoices.set(note, []);
    noteToVoices.get(note).push(id);

    // light instantly
    markerActiveCount[idx]++;
    setMarkerActive(idx, true);
    recordNpsHit(idx);

    // auto-expire highlight after the real sample duration (no sticky trail)
    const ms = Math.max(10, (when + buf.duration - audioCtx.currentTime) * 1000);
    voice.expireTimer = setTimeout(() => {
      releaseVoice(id);
    }, ms);

    source.onended = () => {
      // backup cleanup if stop() or natural end happens first
      releaseVoice(id);
    };

    try {
      source.start(when);
    } catch (_) {
      releaseVoice(id);
    }
  }

  const endOnNoteOff = document.getElementById("endOnNoteOff");

  function triggerNoteOff(note, when) {
    // If "End when note ends" is off, let samples play fully (one-shot)
    if (endOnNoteOff && !endOnNoteOff.checked) return;

    const list = noteToVoices.get(note);
    if (!list || list.length === 0) return;
    const id = list.shift();
    if (list.length === 0) noteToVoices.delete(note);
    const voice = activeVoices.get(id);
    if (!voice) return;
    try {
      const stopAt = Math.max(when, audioCtx.currentTime + 0.002);
      voice.source.stop(stopAt);
    } catch (_) {}
    // also clear expire timer early via releaseVoice path from onended
  }

  function scheduleAhead(songPos) {
    const horizon = songPos + LOOKAHEAD;
    while (nextEventIdx < events.length && events[nextEventIdx].t <= horizon) {
      const ev = events[nextEventIdx++];
      const when = playStartCtxTime + (ev.t - playStartOffset);
      if (ev.type === "on") {
        triggerNoteOn(ev.note, ev.vel, when);
      } else {
        triggerNoteOff(ev.note, when);
      }
    }
  }

  function tick() {
    if (!isPlaying) return;
    const elapsed = audioCtx.currentTime - playStartCtxTime;
    const songPos = playStartOffset + elapsed;

    if (songPos >= midiDuration) {
      stopPlayback();
      return;
    }

    scheduleAhead(songPos);
    timeDisplay.textContent = `${formatTime(songPos)} / ${formatTime(midiDuration)}`;
    if (!isSeeking) {
      if (seekBar && midiDuration > 0) {
        seekBar.value = Math.round((songPos / midiDuration) * 1000);
      }
      if (seekTimeLabel) seekTimeLabel.textContent = formatTime(songPos);
      // 60 fps piano-roll camera
      refreshPianoRoll(songPos);
    }
    animFrameId = requestAnimationFrame(tick);
  }

  function startPlayback() {
    if (!events.length || !audioCtx) return;
    if (audioCtx.state === "suspended") audioCtx.resume();

    if (nextEventIdx >= events.length) {
      nextEventIdx = 0;
      playStartOffset = 0;
    }

    isPlaying = true;
    playStartCtxTime = audioCtx.currentTime;
    scheduleAhead(playStartOffset);
    playBtn.textContent = "Pause";
    playBtn.classList.add("active");
    setStatus("Playing…");
    animFrameId = requestAnimationFrame(tick);
  }

  function pausePlayback() {
    if (!isPlaying) return;
    isPlaying = false;
    if (animFrameId) cancelAnimationFrame(animFrameId);
    animFrameId = null;
    const elapsed = audioCtx.currentTime - playStartCtxTime;
    playStartOffset += elapsed;
    stopAllVoices();
    nextEventIdx = 0;
    while (nextEventIdx < events.length && events[nextEventIdx].t < playStartOffset - 0.01) {
      nextEventIdx++;
    }
    playBtn.textContent = "Play";
    playBtn.classList.remove("active");
    setStatus("Paused");
  }

  function stopPlayback() {
    isPlaying = false;
    if (animFrameId) cancelAnimationFrame(animFrameId);
    animFrameId = null;
    stopAllVoices();
    nextEventIdx = 0;
    playStartOffset = 0;
    playBtn.textContent = "Play";
    playBtn.classList.remove("active");
    timeDisplay.textContent = `0:00 / ${formatTime(midiDuration)}`;
    if (seekBar) seekBar.value = 0;
    if (seekTimeLabel) seekTimeLabel.textContent = "0:00";
    if (typeof refreshPianoRoll === "function") refreshPianoRoll(0);
    setStatus("Stopped");
  }

// ---------- Event listeners ----------
  playBtn.addEventListener("click", () => {
    if (isPlaying) pausePlayback();
    else startPlayback();
  });

  stopBtn.addEventListener("click", stopPlayback);

  volSlider.addEventListener("input", () => {
    if (masterGain) masterGain.gain.value = parseFloat(volSlider.value);
  });

  midiInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    stopPlayback();
    try {
      await loadMidiFile(file);
    } catch (err) {
      console.error(err);
      setStatus("Failed to parse MIDI");
    }
  });

  // drag & drop
  document.body.addEventListener("dragover", (e) => {
    e.preventDefault();
  });
  document.body.addEventListener("drop", async (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".mid") || file.name.endsWith(".midi"))) {
      stopPlayback();
      try {
        await loadMidiFile(file);
      } catch (err) {
        console.error(err);
        setStatus("Failed to parse MIDI");
      }
    }
  });

  async function loadExampleMidi(path, label) {
    stopPlayback();
    try {
      await loadMidiFile(path, true);
      setStatus(label + " loaded");
    } catch (err) {
      console.error(err);
      setStatus("Failed to load " + label);
    }
  }
  document.getElementById("loadDeathByAmenBtn").addEventListener("click", () => {
    loadExampleMidi("death-by-amen.mid", "Death by Amen");
  });
  document.getElementById("loadAmenDeathBtn").addEventListener("click", () => {
    loadExampleMidi("amen-death.mid", "Amen Death");
  });

  // ---------- Spam Converter ----------
  const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const A4_FREQ = 440;
  // Fixed trigger MIDI = BASE_NOTE + (sliceIndex) when pitch-map is off

  const examples = {
    scale: "C4 0.5\nD4 0.5\nE4 0.5\nF4 0.5\nG4 0.5\nA4 0.5\nB4 0.5\nC5 1",
    arpeggio: "C4 0.25\nE4 0.25\nG4 0.25\nC5 0.5\nRest 0.25\nG4 0.25\nE4 0.25\nC4 0.5",
    mario: "E5 0.125\nE5 0.125\nRest 0.125\nE5 0.125\nRest 0.125\nC5 0.125\nE5 0.25\nG5 0.25\nRest 0.25\nG4 0.25\nRest 0.25"
  };

  const melodyInput = document.getElementById("melodyInput");
  const convBpm = document.getElementById("convBpm");
  const convPitchMap = document.getElementById("convPitchMap");
  const convFixedSlice = document.getElementById("convFixedSlice");
  const fixedSliceLabel = document.getElementById("fixedSliceLabel");
  const convDouble = document.getElementById("convDouble");
  const convSlide = document.getElementById("convSlide");
  const convLegacyRate = document.getElementById("convLegacyRate");
  const convertBtn = document.getElementById("convertBtn");
  const downloadConvBtn = document.getElementById("downloadConvBtn");
  const loadConvBtn = document.getElementById("loadConvBtn");
  const convStatus = document.getElementById("convStatus");
  const convMidiInput = document.getElementById("convMidiInput");
  const convMidiName = document.getElementById("convMidiName");

  melodyInput.value = examples.scale;

  document.getElementById("exScale").addEventListener("click", () => { melodyInput.value = examples.scale; });
  document.getElementById("exArp").addEventListener("click", () => { melodyInput.value = examples.arpeggio; });
  document.getElementById("exMario").addEventListener("click", () => { melodyInput.value = examples.mario; });

  function updateFixedSliceUI() {
    const on = convPitchMap.checked;
    fixedSliceLabel.classList.toggle("disabled", on);
  }
  convPitchMap.addEventListener("change", updateFixedSliceUI);
  updateFixedSliceUI();


  function noteNameToMidi(name) {
    if (!name || name.toLowerCase() === "rest") return null;
    const m = name.match(/^([A-Ga-g]#?)(-?\d+)$/);
    if (!m) return null;
    const n = m[1].toUpperCase();
    const oct = parseInt(m[2], 10);
    const idx = noteNames.indexOf(n);
    if (idx < 0) return null;
    return (oct + 1) * 12 + idx;
  }

  function midiToNoteName(midi) {
    midi = Math.round(midi);
    const name = noteNames[((midi % 12) + 12) % 12];
    const oct = Math.floor(midi / 12) - 1;
    return name + oct;
  }

  function midiToFreq(midi) {
    return A4_FREQ * Math.pow(2, (midi - 69) / 12);
  }

  function parseMelodyText(raw) {
    const lines = raw.split("\n");
    const out = [];
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith("//")) continue;
      const parts = t.split(/\s+/);
      if (parts.length < 2) continue;
      const dur = parseFloat(parts[1]);
      if (isNaN(dur) || dur <= 0) continue;
      const names = parts[0].split(/[+,]/).map(s => s.trim()).filter(Boolean);
      if (names.length === 1 && names[0].toLowerCase() === "rest") {
        out.push({ rest: true, duration: dur, midis: [] });
        continue;
      }
      const midis = [];
      for (const nm of names) {
        const mi = noteNameToMidi(nm);
        if (mi !== null) midis.push(mi);
      }
      if (midis.length === 0) continue;
      out.push({ rest: false, midis, duration: dur });
    }
    return out;
  }

  // Convert parsed player events (from any MIDI) into melody items for the spam converter
  function eventsToMelody(evs) {
    // Build note-on → matching note-off pairs with durations in whole-notes at current BPM display
    const bpm = Math.max(1, parseFloat(convBpm.value) || 120);
    const secPerWhole = (60 / bpm) * 4;
    const ons = {}; // note -> [{t, vel}]
    const pairs = []; // {midi, start, end}

    for (const ev of evs) {
      if (ev.type === "on") {
        if (!ons[ev.note]) ons[ev.note] = [];
        ons[ev.note].push(ev.t);
      } else if (ev.type === "off") {
        const stack = ons[ev.note];
        if (stack && stack.length) {
          const start = stack.shift();
          pairs.push({ midi: ev.note, start, end: Math.max(ev.t, start + 0.01) });
        }
      }
    }
    // any hanging ons: give a short duration
    for (const note of Object.keys(ons)) {
      for (const start of ons[note]) {
        pairs.push({ midi: +note, start, end: start + 0.1 });
      }
    }
    pairs.sort((a, b) => a.start - b.start || a.midi - b.midi);

    // Group simultaneous starts into chords; insert rests for gaps
    const melody = [];
    let cursor = 0;
    let i = 0;
    while (i < pairs.length) {
      const start = pairs[i].start;
      if (start > cursor + 0.005) {
        const restDur = (start - cursor) / secPerWhole;
        if (restDur > 0.001) melody.push({ rest: true, duration: restDur, midis: [] });
      }
      // collect chord at this start time
      const chord = [];
      const groupStart = start;
      let minEnd = pairs[i].end;
      while (i < pairs.length && Math.abs(pairs[i].start - groupStart) < 0.008) {
        chord.push(pairs[i].midi);
        if (pairs[i].end < minEnd) minEnd = pairs[i].end;
        i++;
      }
      const dur = Math.max(0.01, (minEnd - groupStart) / secPerWhole);
      melody.push({ rest: false, midis: chord, duration: dur });
      cursor = minEnd;
    }
    return melody;
  }

  function melodyToText(melody) {
    const lines = [];
    for (const item of melody) {
      if (item.rest) {
        lines.push(`Rest ${parseFloat(item.duration.toFixed(4))}`);
      } else {
        const names = item.midis.map(midiToNoteName).join("+");
        lines.push(`${names} ${parseFloat(item.duration.toFixed(4))}`);
      }
    }
    return lines.join("\n");
  }

  // MIDI binary helpers
  function toBytes(arr) { return String.fromCharCode.apply(null, arr); }
  function writeInt32(num) {
    return toBytes([(num >> 24) & 255, (num >> 16) & 255, (num >> 8) & 255, num & 255]);
  }
  function writeInt16(num) {
    return toBytes([(num >> 8) & 255, num & 255]);
  }
  function writeVLQ(val) {
    const buffer = [val & 0x7f];
    while ((val >>= 7)) buffer.push((val & 0x7f) | 0x80);
    return toBytes(buffer.reverse());
  }

  let lastConvertedBytes = null;

  function buildSpamMidi(melody, bpm, opts) {
    const ticksPerBeat = 480;
    const secondsPerQuarter = 60 / bpm;
    const secondsPerWhole = secondsPerQuarter * 4;

    let track = "";
    const uspq = Math.round(60000000 / bpm);
    track += writeVLQ(0) + String.fromCharCode(0xff, 0x51, 0x03) +
      toBytes([(uspq >> 16) & 255, (uspq >> 8) & 255, uspq & 255]);

    let absTick = 0;
    let prevTick = 0;
    let slideFromMidi = null;

    function emitNote(tick, midi, velOn = 100) {
      midi = Math.max(0, Math.min(127, Math.round(midi)));
      let delta = tick - prevTick;
      if (delta < 0) delta = 0;
      track += writeVLQ(delta) + String.fromCharCode(0x90, midi, velOn);
      track += writeVLQ(0) + String.fromCharCode(0x80, midi, 0);
      prevTick = tick;
    }

    for (let i = 0; i < melody.length; i++) {
      const item = melody[i];
      const totalTicks = Math.max(1, Math.round(item.duration * 4 * ticksPerBeat));
      const durationSec = item.duration * secondsPerWhole;

      if (item.rest || !item.midis || item.midis.length === 0) {
        absTick += totalTicks;
        // keep slideFromMidi so a rest doesn't break slide context optionally –
        // clear it so slide only connects adjacent sounding notes
        slideFromMidi = null;
        continue;
      }

      const primaryMidi = item.midis[0];
      // Frequency always comes from the real pitch (for density)
      const freq = midiToFreq(primaryMidi);

      // Target pitch for the spam hits
      // pitch-map ON  → actual melody pitch (correct amen slice)
      // pitch-map OFF → user-chosen slice 1–21 → MIDI note BASE_NOTE + (slice-1)
      const fixedMidi = BASE_NOTE + ((opts.fixedSlice - 1 + NUM_SLICES) % NUM_SLICES);
      const baseTarget = opts.pitchMap ? primaryMidi : fixedMidi;

      // Full rate: A4 (440 Hz) × durationSec → 440 triggers/sec
      // Legacy half-rate: same formula × 0.5 (old converter behaviour)
      const rateScale = opts.legacyRate ? 0.5 : 1;
      let numTriggers = Math.max(1, Math.round(freq * durationSec * rateScale));

      const ticksBetween = totalTicks / numTriggers;

      // Slide: interpolate from previous sounding note to this one
      const doSlide = opts.slide && slideFromMidi !== null;
      const startMidi = doSlide
        ? (opts.pitchMap ? slideFromMidi : fixedMidi)
        : baseTarget;
      const endMidi = baseTarget;

      for (let t = 0; t < numTriggers; t++) {
        const frac = numTriggers === 1 ? 1 : t / (numTriggers - 1);
        let midi = doSlide
          ? startMidi + (endMidi - startMidi) * frac
          : baseTarget;

        // Double-note: alternate with adjacent pitch (from the MIDI / melody)
        if (opts.double && (t % 2 === 1)) {
          // Prefer a real adjacent chord tone if present, else +1
          if (item.midis.length > 1) {
            midi = item.midis[1];
            if (!opts.pitchMap) {
              // when not pitch-mapped, still offset the fixed trigger
              midi = fixedMidi + 1;
            }
          } else {
            midi = (opts.pitchMap ? primaryMidi : fixedMidi) + 1;
          }
        }

        // Extra chord tones: occasional round-robin when pitch-mapped
        if (opts.pitchMap && item.midis.length > 1 && !opts.double && t % item.midis.length !== 0) {
          midi = item.midis[t % item.midis.length];
        }

        const eventTick = absTick + Math.round(t * ticksBetween);
        emitNote(eventTick, midi);
      }

      absTick += totalTicks;
      slideFromMidi = primaryMidi;
    }

    track += writeVLQ(0) + String.fromCharCode(0xff, 0x2f, 0x00);

    let midiFile = "MThd" + writeInt32(6) + writeInt16(0) + writeInt16(1) + writeInt16(ticksPerBeat);
    midiFile += "MTrk" + writeInt32(track.length) + track;

    const bytes = new Uint8Array(midiFile.length);
    for (let i = 0; i < midiFile.length; i++) bytes[i] = midiFile.charCodeAt(i);
    return bytes;
  }

  // Upload MIDI → fill textarea + set BPM from file if possible
  convMidiInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    convMidiName.textContent = file.name;
    convStatus.textContent = "Parsing MIDI…";
    try {
      const buf = await file.arrayBuffer();
      const evs = parseMidiArrayBuffer(buf);
      // try to keep a sensible BPM: leave user BPM, but show event count
      const melody = eventsToMelody(evs);
      if (melody.length === 0) throw new Error("No notes found");
      melodyInput.value = melodyToText(melody);
      convStatus.textContent = `MIDI loaded · ${melody.length} events → text`;
      // enable convert immediately
      downloadConvBtn.disabled = true;
      loadConvBtn.disabled = true;
    } catch (err) {
      console.error(err);
      convStatus.textContent = "MIDI parse error: " + (err.message || err);
    } finally {
      e.target.value = "";
    }
  });

  convertBtn.addEventListener("click", () => {
    convStatus.textContent = "Converting…";
    try {
      const melody = parseMelodyText(melodyInput.value);
      if (melody.length === 0) throw new Error("No valid notes");
      const bpm = Math.max(1, parseFloat(convBpm.value) || 120);
      const sliceNum = Math.max(1, Math.min(21, parseInt(convFixedSlice.value, 10) || 1));
      const bytes = buildSpamMidi(melody, bpm, {
        pitchMap: convPitchMap.checked,
        fixedSlice: sliceNum,
        double: convDouble.checked,
        slide: convSlide.checked,
        legacyRate: convLegacyRate.checked
      });
      lastConvertedBytes = bytes;
      downloadConvBtn.disabled = false;
      loadConvBtn.disabled = false;
      const modes = [];
      if (convPitchMap.checked) modes.push("pitch-map");
      if (convDouble.checked) modes.push("double");
      if (convSlide.checked) modes.push("slide");
      if (convLegacyRate.checked) modes.push("half-rate");
      convStatus.textContent = `Done · ${(bytes.length / 1024).toFixed(1)} KB` +
        (modes.length ? ` (${modes.join(", ")})` : "");
    } catch (err) {
      console.error(err);
      convStatus.textContent = "Error: " + (err.message || err);
      lastConvertedBytes = null;
      downloadConvBtn.disabled = true;
      loadConvBtn.disabled = true;
    }
  });

  downloadConvBtn.addEventListener("click", () => {
    if (!lastConvertedBytes) return;
    const blob = new Blob([lastConvertedBytes], { type: "audio/midi" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "amen-spam.mid";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  loadConvBtn.addEventListener("click", async () => {
    if (!lastConvertedBytes) return;
    stopPlayback();
    try {
      const ab = lastConvertedBytes.buffer.slice(
        lastConvertedBytes.byteOffset,
        lastConvertedBytes.byteOffset + lastConvertedBytes.byteLength
      );
      events = parseMidiArrayBuffer(ab);
      nextEventIdx = 0;
      playStartOffset = 0;
      playBtn.disabled = false;
      stopBtn.disabled = false;
      timeDisplay.textContent = `0:00 / ${formatTime(midiDuration)}`;
      setStatus(`Converted MIDI loaded · ${events.length} events · ${formatTime(midiDuration)}`);
      convStatus.textContent = "Loaded into player";
      if (typeof onMidiLoadedForRoll === "function") onMidiLoadedForRoll();
    } catch (err) {
      console.error(err);
      setStatus("Failed to load converted MIDI");
      convStatus.textContent = "Load failed";
    }
  });


  // ---------- Keyboard play ----------
  const keyboardToggle = document.getElementById("keyboardToggle");
  const keyboardLegend = document.getElementById("keyboardLegend");
  // 21 keys left-to-right → slices 0..20
  const KEY_MAP = {
    "a": 0, "s": 1, "d": 2, "f": 3, "g": 4, "h": 5, "j": 6, "k": 7, "l": 8,
    ";": 9, "'": 10,
    "z": 11, "x": 12, "c": 13, "v": 14, "b": 15, "n": 16, "m": 17,
    ",": 18, ".": 19, "/": 20
  };
  const heldKeys = new Set(); // prevent key-repeat retrigger
  const keyToVoiceId = new Map(); // key → voice id for end-on-release

  keyboardToggle.addEventListener("change", () => {
    const on = keyboardToggle.checked;
    keyboardLegend.classList.toggle("hidden", !on);
    if (!on) {
      // release any held visual
      heldKeys.clear();
    }
  });

  function playSliceFromKeyboard(idx, vel = 100, key = null) {
    if (!audioCtx || !buffers[idx]) return;
    if (audioCtx.state === "suspended") audioCtx.resume();

    if (interruptToggle && interruptToggle.checked) {
      interruptSlice(idx);
    }

    const buf = buffers[idx];
    const source = audioCtx.createBufferSource();
    source.buffer = buf;
    source.loop = false;
    const g = audioCtx.createGain();
    g.gain.value = Math.max(0.05, Math.min(1, (vel / 127) ** 0.65));
    source.connect(g);
    g.connect(masterGain);

    const id = ++voiceId;
    const voice = { source, markerIdx: idx, gainNode: g, id, note: -1, expireTimer: null };
    activeVoices.set(id, voice);

    markerActiveCount[idx]++;
    setMarkerActive(idx, true);
    recordNpsHit(idx);

    const ms = Math.max(10, buf.duration * 1000);
    voice.expireTimer = setTimeout(() => releaseVoice(id), ms);
    source.onended = () => releaseVoice(id);

    try { source.start(); } catch (_) { releaseVoice(id); }
    return id;
  }

  window.addEventListener("keydown", (e) => {
    if (!keyboardToggle.checked) return;
    // ignore when typing in inputs/textarea
    const tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable) return;
    if (e.repeat) return;

    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (!(key in KEY_MAP)) return;
    e.preventDefault();
    if (heldKeys.has(key)) return;
    heldKeys.add(key);
    const vid = playSliceFromKeyboard(KEY_MAP[key], 110, key);
    if (vid != null) keyToVoiceId.set(key, vid);
  });

  window.addEventListener("keyup", (e) => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    heldKeys.delete(key);
    const vid = keyToVoiceId.get(key);
    keyToVoiceId.delete(key);
    if (vid == null) return;
    if (endOnNoteOff && endOnNoteOff.checked) {
      const voice = activeVoices.get(vid);
      if (voice) {
        try { voice.source.stop(); } catch (_) {}
        // onended → releaseVoice
      }
    }
  });


  // ---------- Piano roll + seek ----------
  const pianoCanvas = document.getElementById("pianoRoll");
  const pianoCtx = pianoCanvas.getContext("2d");
  const seekBar = document.getElementById("seekBar");
  const seekTimeLabel = document.getElementById("seekTimeLabel");
  let isSeeking = false;

  // Camera state for the piano roll
  const ROLL_WINDOW = 6; // seconds visible horizontally
  let camNoteMin = 48;
  let camNoteMax = 72;
  let camTargetMin = 48;
  let camTargetMax = 72;

  function notesNearTime(centerSec, halfWindow) {
    const loT = centerSec - halfWindow;
    const hiT = centerSec + halfWindow;
    let lo = 127, hi = 0, found = false;
    for (const ev of events) {
      if (ev.type !== "on") continue;
      if (ev.t < loT) continue;
      if (ev.t > hiT) break;
      found = true;
      if (ev.note < lo) lo = ev.note;
      if (ev.note > hi) hi = ev.note;
    }
    // Silence / gap: keep the current camera range (no jump to other notes)
    if (!found) {
      return { min: Math.round(camNoteMin), max: Math.round(camNoteMax) };
    }
    // pad
    lo = Math.max(0, lo - 2);
    hi = Math.min(127, hi + 2);
    if (hi - lo < 11) {
      const mid = (lo + hi) / 2;
      lo = Math.max(0, Math.floor(mid - 6));
      hi = Math.min(127, Math.ceil(mid + 6));
    }
    return { min: lo, max: hi };
  }

  function updateCamera(playheadSec) {
    const half = ROLL_WINDOW / 2;
    const range = notesNearTime(playheadSec, half);
    // only retarget when notes exist in the window — silence keeps last target
    if (range.min !== Math.round(camNoteMin) || range.max !== Math.round(camNoteMax) ||
        (range.min !== camTargetMin || range.max !== camTargetMax)) {
      // notesNearTime already returns current cam on empty; still safe to assign
      camTargetMin = range.min;
      camTargetMax = range.max;
    }
    const lerp = 0.22;
    camNoteMin += (camTargetMin - camNoteMin) * lerp;
    camNoteMax += (camTargetMax - camNoteMax) * lerp;
  }

  function drawPianoRoll(playheadSec) {
    const w = pianoCanvas.width;
    const h = pianoCanvas.height;
    const ctx = pianoCtx;
    ctx.fillStyle = "#0d1117";
    ctx.fillRect(0, 0, w, h);

    if (playheadSec == null) playheadSec = 0;
    updateCamera(playheadSec);

    const half = ROLL_WINDOW / 2;
    // camera window: keep playhead at ~35% from left so you see upcoming notes
    const viewStart = Math.max(0, playheadSec - half * 0.35);
    const viewEnd = viewStart + ROLL_WINDOW;
    const viewDur = Math.max(0.01, viewEnd - viewStart);

    const noteMin = camNoteMin;
    const noteMax = camNoteMax;
    const noteSpan = Math.max(1, noteMax - noteMin);
    const rowH = h / (noteSpan + 1);

    // lane lines + octave labels
    ctx.lineWidth = 1;
    for (let n = Math.floor(noteMin); n <= Math.ceil(noteMax); n++) {
      const y = h - ((n - noteMin + 0.5) / (noteSpan + 1)) * h;
      const isC = n % 12 === 0;
      ctx.strokeStyle = isC ? "#30363d" : "#1a1f26";
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
      if (isC) {
        ctx.fillStyle = "#484f58";
        ctx.font = "10px sans-serif";
        ctx.fillText("C" + (Math.floor(n / 12) - 1), 4, y - 2);
      }
    }

    // vertical time grid (1s)
    ctx.strokeStyle = "#1a1f26";
    const t0 = Math.ceil(viewStart);
    for (let t = t0; t <= viewEnd; t++) {
      const x = ((t - viewStart) / viewDur) * w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // notes in view
    const maxDraw = 6000;
    let drawn = 0;
    for (const ev of events) {
      if (ev.type !== "on") continue;
      if (ev.t < viewStart - 0.05) continue;
      if (ev.t > viewEnd + 0.05) break;
      if (ev.note < noteMin - 1 || ev.note > noteMax + 1) continue;
      if (drawn++ > maxDraw) break;

      const x = ((ev.t - viewStart) / viewDur) * w;
      const y = h - ((ev.note - noteMin + 0.5) / (noteSpan + 1)) * h;
      const vel = ev.vel || 100;
      const alpha = 0.4 + 0.6 * (vel / 127);
      const slice = noteToSlice(ev.note);
      const hue = (slice / NUM_SLICES) * 300;
      ctx.fillStyle = `hsla(${hue}, 80%, 60%, ${alpha})`;
      const nw = Math.max(2, (0.03 / viewDur) * w);
      ctx.fillRect(x, y - rowH * 0.4, nw, Math.max(3, rowH * 0.8));
    }

    // playhead
    const px = ((playheadSec - viewStart) / viewDur) * w;
    ctx.strokeStyle = "#f78166";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, h);
    ctx.stroke();

    // time labels
    ctx.fillStyle = "#8b949e";
    ctx.font = "10px sans-serif";
    ctx.fillText(formatTime(viewStart), 6, h - 6);
    ctx.fillText(formatTime(viewEnd), w - 36, h - 6);
  }

  function refreshPianoRoll(playheadSec) {
    const rect = pianoCanvas.getBoundingClientRect();
    const cssW = Math.max(300, Math.floor(rect.width));
    if (pianoCanvas.width !== cssW) {
      pianoCanvas.width = cssW;
      pianoCanvas.height = 220;
    }
    let ph = playheadSec;
    if (ph == null) {
      ph = isPlaying && audioCtx
        ? playStartOffset + (audioCtx.currentTime - playStartCtxTime)
        : playStartOffset;
    }
    drawPianoRoll(ph);
  }

  function seekTo(sec) {
    sec = Math.max(0, Math.min(midiDuration, sec));
    const wasPlaying = isPlaying;
    if (wasPlaying) {
      // pause without full stop
      isPlaying = false;
      if (animFrameId) cancelAnimationFrame(animFrameId);
      animFrameId = null;
      stopAllVoices();
    } else {
      stopAllVoices();
    }

    playStartOffset = sec;
    // advance event pointer to this time
    nextEventIdx = 0;
    while (nextEventIdx < events.length && events[nextEventIdx].t < sec - 0.001) {
      nextEventIdx++;
    }

    if (seekBar && midiDuration > 0) {
      seekBar.value = Math.round((sec / midiDuration) * 1000);
    }
    if (seekTimeLabel) seekTimeLabel.textContent = formatTime(sec);
    if (timeDisplay) timeDisplay.textContent = `${formatTime(sec)} / ${formatTime(midiDuration)}`;
    refreshPianoRoll(sec);

    if (wasPlaying) {
      startPlayback();
    }
  }

  // seek bar interaction
  if (seekBar) {
    seekBar.addEventListener("input", () => {
      isSeeking = true;
      if (!midiDuration) return;
      const sec = (parseInt(seekBar.value, 10) / 1000) * midiDuration;
      if (seekTimeLabel) seekTimeLabel.textContent = formatTime(sec);
      refreshPianoRoll(sec);
    });
    seekBar.addEventListener("change", () => {
      isSeeking = false;
      if (!midiDuration) return;
      const sec = (parseInt(seekBar.value, 10) / 1000) * midiDuration;
      seekTo(sec);
    });
  }

  // click on piano roll to seek (within current camera window)
  if (pianoCanvas) {
    pianoCanvas.addEventListener("click", (e) => {
      if (!midiDuration) return;
      const rect = pianoCanvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ph = isPlaying && audioCtx
        ? playStartOffset + (audioCtx.currentTime - playStartCtxTime)
        : playStartOffset;
      const half = ROLL_WINDOW / 2;
      const viewStart = Math.max(0, ph - half * 0.35);
      const sec = viewStart + (x / rect.width) * ROLL_WINDOW;
      seekTo(Math.max(0, Math.min(midiDuration, sec)));
    });
  }

  function onMidiLoadedForRoll() {
    const r = notesNearTime(0, ROLL_WINDOW);
    camNoteMin = camTargetMin = r.min;
    camNoteMax = camTargetMax = r.max;
    if (seekBar) {
      seekBar.value = 0;
      seekBar.max = 1000;
    }
    if (seekTimeLabel) seekTimeLabel.textContent = "0:00";
    const exportWavBtn = document.getElementById("exportWavBtn");
    const exportWebmBtn = document.getElementById("exportWebmBtn");
    if (exportWavBtn) exportWavBtn.disabled = !events.length;
    if (exportWebmBtn) exportWebmBtn.disabled = !events.length;
    requestAnimationFrame(() => refreshPianoRoll(0));
  }

  // Hook into existing load paths: patch loadMidiFile success side
  const _origLoadMidiFile = loadMidiFile;
  // loadMidiFile is async function – wrap by reassignment won't work easily for const
  // Instead call onMidiLoadedForRoll from places that set events


  // ---------- Export WAV / WebM ----------
  const exportWavBtn = document.getElementById("exportWavBtn");
  const exportWebmBtn = document.getElementById("exportWebmBtn");
  const exportStatus = document.getElementById("exportStatus");

  function encodeWav(audioBuffer) {
    const numCh = audioBuffer.numberOfChannels;
    const sr = audioBuffer.sampleRate;
    const len = audioBuffer.length;
    const dataLen = len * numCh * 2;
    const buf = new ArrayBuffer(44 + dataLen);
    const v = new DataView(buf);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, "RIFF");
    v.setUint32(4, 36 + dataLen, true);
    w(8, "WAVE");
    w(12, "fmt ");
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, numCh, true);
    v.setUint32(24, sr, true);
    v.setUint32(28, sr * numCh * 2, true);
    v.setUint16(32, numCh * 2, true);
    v.setUint16(34, 16, true);
    w(36, "data");
    v.setUint32(40, dataLen, true);
    let off = 44;
    const chans = [];
    for (let c = 0; c < numCh; c++) chans.push(audioBuffer.getChannelData(c));
    for (let i = 0; i < len; i++) {
      for (let c = 0; c < numCh; c++) {
        let s = Math.max(-1, Math.min(1, chans[c][i]));
        v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        off += 2;
      }
    }
    return new Blob([buf], { type: "audio/wav" });
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function exportWav() {
    if (!events.length || !buffers[0]) return;
    exportStatus.textContent = "Rendering WAV…";
    exportWavBtn.disabled = true;
    try {
      const dur = Math.max(midiDuration, 0.5) + 0.5;
      const sr = audioCtx ? audioCtx.sampleRate : 44100;
      const offline = new OfflineAudioContext(2, Math.ceil(dur * sr), sr);
      const offlineGain = offline.createGain();
      offlineGain.gain.value = masterGain ? masterGain.gain.value : 0.7;
      offlineGain.connect(offline.destination);

      const endOn = endOnNoteOff && endOnNoteOff.checked;
      // schedule all note ons; track for offs
      const voiceEnds = []; // {note, start, src}
      for (const ev of events) {
        if (ev.type === "on") {
          const idx = noteToSlice(ev.note);
          const buf = buffers[idx];
          if (!buf) continue;
          const src = offline.createBufferSource();
          src.buffer = buf;
          src.loop = false;
          const g = offline.createGain();
          const v = Math.max(0.04, Math.min(1, ((ev.vel || 100) / 127) ** 0.65));
          g.gain.value = v;
          src.connect(g);
          g.connect(offlineGain);
          const t = Math.max(0, ev.t);
          try { src.start(t); } catch (_) {}
          voiceEnds.push({ note: ev.note, start: t, src, dur: buf.duration });
        } else if (ev.type === "off" && endOn) {
          // stop oldest matching note
          for (let i = 0; i < voiceEnds.length; i++) {
            const ve = voiceEnds[i];
            if (ve.note === ev.note && !ve.stopped) {
              try { ve.src.stop(Math.max(ev.t, ve.start + 0.002)); } catch (_) {}
              ve.stopped = true;
              break;
            }
          }
        }
      }

      const rendered = await offline.startRendering();
      const blob = encodeWav(rendered);
      downloadBlob(blob, "amen-export.wav");
      exportStatus.textContent = "WAV downloaded";
    } catch (err) {
      console.error(err);
      exportStatus.textContent = "WAV error: " + (err.message || err);
    } finally {
      exportWavBtn.disabled = false;
      setTimeout(() => { if (exportStatus.textContent.startsWith("WAV")) exportStatus.textContent = ""; }, 2500);
    }
  }

  async function exportWebm() {
    if (!events.length || !buffers[0] || !audioCtx) return;
    exportStatus.textContent = "Recording WebM…";
    exportWebmBtn.disabled = true;
    exportWavBtn.disabled = true;

    if (isPlaying) stopPlayback();

    try {
      if (audioCtx.state === "suspended") await audioCtx.resume();

      const comp = document.createElement("canvas");
      const cw = 1280, ch = 520;
      comp.width = cw;
      comp.height = ch;
      const cctx = comp.getContext("2d", { alpha: false });

      // --- Audio graph for recording ---
      const dest = audioCtx.createMediaStreamDestination();
      masterGain.connect(dest);

      // Continuous keep-alive on the RECORD bus so MediaRecorder never sees
      // pure silence (that is what caused timeline skips in the exported file).
      // Inaudible on speakers — only feeds the recorder.
      const keepOsc = audioCtx.createOscillator();
      const keepGain = audioCtx.createGain();
      keepGain.gain.value = 0.0003; // non-zero energy, still inaudible
      keepOsc.frequency.value = 20;
      keepOsc.connect(keepGain);
      keepGain.connect(dest);
      keepOsc.start();

      const vStream = comp.captureStream(60);
      const combined = new MediaStream([
        ...vStream.getVideoTracks(),
        ...dest.stream.getAudioTracks()
      ]);

      const chunks = [];
      let mime = "video/webm;codecs=vp9,opus";
      if (!MediaRecorder.isTypeSupported(mime)) mime = "video/webm;codecs=vp8,opus";
      if (!MediaRecorder.isTypeSupported(mime)) mime = "video/webm";

      const recorder = new MediaRecorder(combined, {
        mimeType: mime,
        videoBitsPerSecond: 5000000,
        audioBitsPerSecond: 192000
      });
      recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      const stopped = new Promise((resolve) => { recorder.onstop = () => resolve(); });

      function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
      }

      let recActive = true;
      let frameId = 0;
      // Wall-clock anchors — video timeline is independent of note density
      const wallStart = performance.now();
      const totalMs = (midiDuration + 0.4) * 1000;

      function currentSongPos() {
        // Prefer audio-context clock once playback has started
        if (isPlaying && playStartCtxTime > 0) {
          return Math.min(midiDuration, Math.max(0, playStartOffset + (audioCtx.currentTime - playStartCtxTime)));
        }
        return Math.min(midiDuration, Math.max(0, (performance.now() - wallStart) / 1000));
      }

      function drawFrame() {
        if (!recActive) return;
        frameId++;
        const songPos = currentSongPos();

        cctx.fillStyle = "#0d1117";
        cctx.fillRect(0, 0, cw, ch);
        // Force a unique pixel every frame so captureStream cannot drop "static" frames
        cctx.fillStyle = (frameId & 1) ? "#0d1117" : "#0d1118";
        cctx.fillRect(cw - 1, ch - 1, 1, 1);
        // Also vary a second pixel with frame count (belt & suspenders)
        cctx.fillStyle = `rgb(${frameId % 3},${(frameId * 2) % 3},0)`;
        cctx.fillRect(0, 0, 1, 1);

        cctx.fillStyle = "#e6edf3";
        cctx.font = "bold 22px sans-serif";
        cctx.fillText("Amen Break MIDI Player", 24, 36);
        cctx.font = "16px sans-serif";
        cctx.fillStyle = "#f78166";
        cctx.fillText(
          (totalNpsEl ? totalNpsEl.textContent : "0 NPS") + "  |  " + formatTime(songPos) + " / " + formatTime(midiDuration),
          24, 62
        );

        // Marker pads
        const padSize = 44, gap = 8;
        const totalW = NUM_SLICES * padSize + (NUM_SLICES - 1) * gap;
        const x0 = (cw - totalW) / 2, y0 = 90;
        for (let i = 0; i < NUM_SLICES; i++) {
          const on = markerActiveCount[i] > 0;
          cctx.fillStyle = on ? "#f78166" : "#161b22";
          cctx.strokeStyle = on ? "#f78166" : "#30363d";
          cctx.lineWidth = 2;
          const x = x0 + i * (padSize + gap);
          roundRect(cctx, x, y0, padSize, padSize, 6);
          cctx.fill();
          cctx.stroke();
          cctx.fillStyle = on ? "#0d1117" : "#8b949e";
          cctx.font = "bold 14px sans-serif";
          cctx.textAlign = "center";
          cctx.fillText(String(i + 1), x + padSize / 2, y0 + padSize / 2 + 5);
          const npsEl = document.getElementById(`marker-nps-${i}`);
          cctx.fillStyle = on ? "#f78166" : "#484f58";
          cctx.font = "11px sans-serif";
          cctx.fillText(npsEl ? npsEl.textContent : "0", x + padSize / 2, y0 + padSize + 14);
        }
        cctx.textAlign = "left";

        refreshPianoRoll(songPos);
        const prY = 170, prH = ch - prY - 20;
        cctx.drawImage(pianoCanvas, 0, 0, pianoCanvas.width, pianoCanvas.height, 24, prY, cw - 48, prH);

        requestAnimationFrame(drawFrame);
      }

      // Start recorder first, then playback, so the keep-alive is already flowing
      recorder.start(50); // small timeslice → steady chunks even in quiet sections
      drawFrame();
      await new Promise((r) => setTimeout(r, 80)); // prime a few frames + audio
      startPlayback();

      // Wait the FULL duration on wall clock — never end early on silence
      await new Promise((r) => setTimeout(r, totalMs));

      recActive = false;
      if (isPlaying) stopPlayback();
      await new Promise((r) => setTimeout(r, 200));
      try { keepOsc.stop(); } catch (_) {}
      if (recorder.state === "recording") recorder.stop();
      await stopped;

      try { masterGain.disconnect(dest); } catch (_) {}
      try { keepGain.disconnect(); } catch (_) {}

      const blob = new Blob(chunks, { type: mime.split(";")[0] });
      downloadBlob(blob, "amen-export.webm");
      exportStatus.textContent = "WebM downloaded (" + (blob.size / 1024 / 1024).toFixed(1) + " MB)";
    } catch (err) {
      console.error(err);
      exportStatus.textContent = "WebM error: " + (err.message || err);
      if (isPlaying) stopPlayback();
    } finally {
      exportWebmBtn.disabled = false;
      exportWavBtn.disabled = false;
      setTimeout(() => {
        if (/WebM|Recording/.test(exportStatus.textContent)) exportStatus.textContent = "";
      }, 3500);
    }
  }

  if (exportWavBtn) exportWavBtn.addEventListener("click", exportWav);
  if (exportWebmBtn) exportWebmBtn.addEventListener("click", exportWebm);

  // ---------- Init ----------
  buildMarkerUI();

  (async () => {
    try {
      await loadSamples();
      // auto-load example
      await loadMidiFile("death-by-amen.mid", true);
      setStatus("Ready · Death by Amen loaded · press Play");
    } catch (err) {
      console.error(err);
      setStatus("Error loading assets: " + err.message);
    }
  })();
})();
