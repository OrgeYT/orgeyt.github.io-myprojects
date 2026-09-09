/**
 * UltraBox Player
 * Accurate timing, URL/JSON load, piano roll (1-based sequence), live piano keys
 */

(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const dropZone = $("#dropZone");
  const fileInput = $("#fileInput");
  const controls = $("#controls");
  const songTitle = $("#songTitle");
  const songInfo = $("#songInfo");
  const btnPlay = $("#btnPlay");
  const btnStop = $("#btnStop");
  const btnRestart = $("#btnRestart");
  const btnPianoRoll = $("#btnPianoRoll");
  const btnShowPianos = $("#btnShowPianos");
  const progressBar = $("#progressBar");
  const progressFill = $("#progressFill");
  const progressPlayhead = $("#progressPlayhead");
  const timeCurrent = $("#timeCurrent");
  const timeTotal = $("#timeTotal");
  const barInfo = $("#barInfo");
  const volume = $("#volume");
  const volumeLabel = $("#volumeLabel");
  const channelList = $("#channelList");
  const loadExampleBtn = $("#loadExample");
  const urlInput = $("#urlInput");
  const btnLoadUrl = $("#btnLoadUrl");
  const pianoRollWrap = $("#pianoRollWrap");
  const pianoRollCanvas = $("#pianoRollCanvas");
  const pianoRollChannel = $("#pianoRollChannel");
  const pianoRollScroll = $("#pianoRollScroll");
  const pianoKeysWrap = $("#pianoKeysWrap");
  const pianoKeysChannel = $("#pianoKeysChannel");
  const pianoKeysEl = $("#pianoKeys");

  let synth = null;
  let song = null;
  let lastJson = null;
  let animFrame = null;
  let totalSeconds = 0;
  let barCount = 0;
  let pianoRollVisible = false;
  let pianoKeysVisible = false;

  // Cached roll data for the selected channel
  let rollNotes = []; // { startBeat, endBeat, pitch }
  let rollMeta = null; // { minP, maxP, bpb, totalBeats, width, height }

  const PR = {
    keyW: 40,
    rowH: 14,
    pxPerBeat: 32,
  };

  // ---------- Time ----------

  function formatTime(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ":" + s.toFixed(1).padStart(4, "0");
  }

  function getSecondsPerBar() {
    if (!synth || !song) return 2;
    try {
      if (typeof synth.getSamplesPerBar === "function" && synth.samplesPerSecond) {
        return synth.getSamplesPerBar() / synth.samplesPerSecond;
      }
    } catch (_) {}
    const bpm = (song.getBeatsPerMinute && song.getBeatsPerMinute()) || song.tempo || 150;
    return ((song.beatsPerBar || 8) * 60) / bpm;
  }

  function recomputeDuration() {
    if (!song) {
      totalSeconds = 0;
      barCount = 0;
      return;
    }
    barCount = song.barCount || 0;
    totalSeconds = barCount * getSecondsPerBar();
  }

  function getCurrentBar() {
    if (!synth) return 0;
    try {
      return typeof synth.playhead === "number" ? synth.playhead : 0;
    } catch (_) {
      return 0;
    }
  }

  function getCurrentBeat() {
    if (!song) return 0;
    const bpb = song.beatsPerBar || 8;
    return getCurrentBar() * bpb;
  }

  // ---------- URL parsing ----------

  function extractSongString(input) {
    let s = String(input || "").trim();
    if (!s) return null;
    try {
      if (/^https?:\/\//i.test(s)) {
        const u = new URL(s);
        s = u.hash || s;
      }
    } catch (_) {}
    if (s.startsWith("#")) s = s.slice(1);
    const songMatch = s.match(/(?:^|&)song=([^&]*)/);
    if (songMatch) {
      try {
        return decodeURIComponent(songMatch[1]);
      } catch (_) {
        return songMatch[1];
      }
    }
    if (s.length > 20) {
      try {
        return decodeURIComponent(s);
      } catch (_) {
        return s;
      }
    }
    return s.length > 8 ? s : null;
  }

  // ---------- Progress UI ----------

  function updateProgress() {
    if (!synth || !song) return;
    recomputeDuration();

    const bars = getCurrentBar();
    const t = bars * getSecondsPerBar();
    const frac = barCount > 0 ? Math.max(0, Math.min(1, bars / barCount)) : 0;

    progressFill.style.width = frac * 100 + "%";
    progressPlayhead.style.left = frac * 100 + "%";
    timeCurrent.textContent = formatTime(t);
    timeTotal.textContent = formatTime(totalSeconds);

    const barFloor = Math.floor(bars);
    const beat =
      typeof synth.beat === "number"
        ? synth.beat + 1
        : Math.floor((bars - barFloor) * (song.beatsPerBar || 8)) + 1;
    barInfo.textContent =
      "Bar " +
      Math.min(barFloor + 1, Math.max(barCount, 1)) +
      "/" +
      barCount +
      " · Beat " +
      beat;

    btnPlay.textContent = synth.isPlayingSong ? "⏸ Pause" : "▶ Play";

    if (pianoRollVisible) updateRollHighlight();
    if (pianoKeysVisible) updatePianoKeys();
  }

  function startAnim() {
    stopAnim();
    function tick() {
      updateProgress();
      animFrame = requestAnimationFrame(tick);
    }
    animFrame = requestAnimationFrame(tick);
  }

  function stopAnim() {
    if (animFrame != null) {
      cancelAnimationFrame(animFrame);
      animFrame = null;
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function channelType(ch) {
    if (!ch) return "pitch";
    if (ch.type) return String(ch.type).toLowerCase();
    if (ch.isMod) return "mod";
    if (ch.isNoise) return "noise";
    return "pitch";
  }

  function listChannels() {
    if (lastJson && lastJson.channels) return lastJson.channels;
    if (song && song.channels) return song.channels;
    return [];
  }

  function renderChannels() {
    channelList.innerHTML = "";
    const channels = listChannels();
    channels.forEach((ch, i) => {
      const type = channelType(ch);
      const name = ch.name && String(ch.name).trim() ? ch.name : "Channel " + (i + 1);
      const el = document.createElement("div");
      el.className = "channel-item";
      el.innerHTML =
        '<span class="ch-type">' +
        type +
        '</span><span class="ch-name">' +
        escapeHtml(name) +
        '</span><button type="button" class="ch-mute" data-idx="' +
        i +
        '">Mute</button>';
      channelList.appendChild(el);
    });

    channelList.querySelectorAll(".ch-mute").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = +btn.dataset.idx;
        if (!synth || !synth.song || !synth.song.channels[idx]) return;
        try {
          const ch = synth.song.channels[idx];
          ch.muted = !ch.muted;
          if (synth.channels && synth.channels[idx]) synth.channels[idx].muted = ch.muted;
          btn.classList.toggle("muted", !!ch.muted);
          btn.textContent = ch.muted ? "Unmute" : "Mute";
        } catch (e) {
          console.warn(e);
        }
      });
    });

    fillChannelSelect(pianoRollChannel, true);
    fillChannelSelect(pianoKeysChannel, true);
  }

  function fillChannelSelect(selectEl, skipMod) {
    if (!selectEl) return;
    const prev = selectEl.value;
    selectEl.innerHTML = "";
    listChannels().forEach((ch, i) => {
      const type = channelType(ch);
      if (skipMod && type === "mod") return;
      const opt = document.createElement("option");
      opt.value = String(i);
      const name = ch.name && String(ch.name).trim() ? ch.name : type;
      opt.textContent = i + 1 + ". " + name;
      selectEl.appendChild(opt);
    });
    if (prev && [...selectEl.options].some((o) => o.value === prev)) {
      selectEl.value = prev;
    }
  }

  function applyVolume() {
    if (!synth) return;
    const v = Number(volume.value) / 100;
    volumeLabel.textContent = volume.value + "%";
    try {
      synth.volume = v;
    } catch (_) {}
  }

  // ---------- Load ----------

  function afterSongLoaded(title, metaExtra) {
    applyVolume();
    songTitle.textContent = title || (song && song.title) || "Untitled";
    const bpm =
      (song.getBeatsPerMinute && song.getBeatsPerMinute()) || song.tempo || "—";
    const bars = song.barCount || 0;
    const chCount = song.getChannelCount ? song.getChannelCount() : song.channels.length;
    songInfo.textContent =
      (metaExtra || "UltraBox") +
      " · " +
      bpm +
      " BPM · " +
      bars +
      " bars · " +
      chCount +
      " channels";

    recomputeDuration();
    renderChannels();
    controls.hidden = false;

    if (pianoRollVisible) buildPianoRoll();
    if (pianoKeysVisible) buildPianoKeys();

    updateProgress();
    startAnim();
    try {
      synth.play();
    } catch (e) {
      console.warn("Auto-play:", e);
    }
  }

  function disposeSynth() {
    if (synth) {
      try {
        synth.pause();
      } catch (_) {}
      synth = null;
    }
    song = null;
    lastJson = null;
    rollNotes = [];
    rollMeta = null;
    stopAnim();
  }

  function loadJsonObject(data, sourceName) {
    if (!window.beepbox || !beepbox.Song || !beepbox.Synth) {
      alert("Synth library failed to load.");
      return;
    }
    disposeSynth();
    try {
      lastJson = data;
      song = new beepbox.Song();
      song.fromJsonObject(data, "auto");
      synth = new beepbox.Synth(song);
      afterSongLoaded(data.name || sourceName || "Untitled", data.format || "JSON");
    } catch (err) {
      console.error(err);
      alert("Failed to load JSON:\n" + (err && err.message ? err.message : String(err)));
      controls.hidden = true;
    }
  }

  function loadSongString(base64, sourceName) {
    if (!window.beepbox || !beepbox.Song || !beepbox.Synth) {
      alert("Synth library failed to load.");
      return;
    }
    disposeSynth();
    try {
      song = new beepbox.Song(base64);
      synth = new beepbox.Synth(song);
      lastJson = null;
      try {
        // Export full loop for piano roll (intro + 1× loop + outro)
        if (typeof song.toJsonObject === "function") {
          lastJson = song.toJsonObject(true, 1, true);
        }
      } catch (_) {}
      afterSongLoaded(sourceName || song.title || "URL song", "URL");
    } catch (err) {
      console.error(err);
      alert("Failed to load URL song:\n" + (err && err.message ? err.message : String(err)));
      controls.hidden = true;
    }
  }

  function loadFromFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        loadJsonObject(JSON.parse(reader.result), file.name.replace(/\.json$/i, ""));
      } catch (e) {
        alert("Invalid JSON file.");
      }
    };
    reader.onerror = () => alert("Could not read file.");
    reader.readAsText(file);
  }

  function loadFromUrlInput() {
    const payload = extractSongString(urlInput.value);
    if (!payload) {
      alert("Could not find song data in that URL / string.");
      return;
    }
    loadSongString(payload, "Pasted URL");
  }

  // ---------- Note collection (CORRECT sequence indexing) ----------
  //
  // UltraBox JSON "sequence" is a copy of Song.channel.bars[]:
  //   0  = empty bar
  //   1  = patterns[0]
  //   2  = patterns[1]
  //   …
  // getPattern uses: patterns[bars[bar] - 1]
  //
  // ticks in JSON points are in song ticksPerBeat units.
  // beat = bar * beatsPerBar + tick / ticksPerBeat

  function collectNotesForChannel(chIndex) {
    const notes = [];

    // Prefer original JSON
    if (lastJson && lastJson.channels && lastJson.channels[chIndex]) {
      const ch = lastJson.channels[chIndex];
      const seq = ch.sequence || [];
      const patterns = ch.patterns || [];
      const tpb = lastJson.ticksPerBeat || 4;
      const bpb = lastJson.beatsPerBar || (song && song.beatsPerBar) || 8;

      seq.forEach((seqVal, bar) => {
        // 1-based pattern ref; 0 = empty
        const patIdx = seqVal >>> 0;
        if (patIdx <= 0) return;
        const pat = patterns[patIdx - 1];
        if (!pat || !pat.notes) return;

        pat.notes.forEach((n) => {
          const pitches = n.pitches || [];
          const points = n.points || [];
          if (pitches.length < 1 || points.length < 2) return;

          // Build pin list: beat + pitchBend (interval relative to base pitch)
          const basePins = [];
          for (let i = 0; i < points.length; i++) {
            const pt = points[i];
            if (pt == null || pt.tick == null) continue;
            basePins.push({
              beat: bar * bpb + (+pt.tick) / tpb,
              bend: 0 | (pt.pitchBend || 0),
              volume: pt.volume != null ? +pt.volume : 100,
            });
          }
          if (basePins.length < 2) return;

          // Each chord tone slides by the same bend intervals
          pitches.forEach((basePitch) => {
            const pins = basePins.map((bp) => ({
              beat: bp.beat,
              pitch: (0 | basePitch) + bp.bend,
              volume: bp.volume,
            }));
            const startBeat = pins[0].beat;
            const endBeat = pins[pins.length - 1].beat;
            const isSlide = pins.some((p) => p.pitch !== pins[0].pitch);
            notes.push({
              pins,
              startBeat,
              endBeat: endBeat > startBeat ? endBeat : startBeat + 0.01,
              pitch: 0 | basePitch, // base (pre-slide) for range calc
              isSlide,
            });
          });
        });
      });
      return notes;
    }

    // Fallback: live Song object (pins use .interval and .time in parts)
    try {
      const ch = song.channels[chIndex];
      if (!ch) return notes;
      const bpb = song.beatsPerBar || 8;
      const partsPerBeat =
        (window.beepbox && beepbox.Config && beepbox.Config.partsPerBeat) || 4;

      for (let bar = 0; bar < song.barCount; bar++) {
        let pat = null;
        if (typeof song.getPattern === "function") {
          pat = song.getPattern(chIndex, bar);
        } else if (ch.bars && ch.patterns) {
          const b = ch.bars[bar];
          if (b > 0) pat = ch.patterns[b - 1];
        }
        if (!pat || !pat.notes) continue;

        pat.notes.forEach((n) => {
          const basePitches = n.pitches || [];
          if (!basePitches.length) return;
          const noteStart = n.start || 0;
          const pinSrc = n.pins || [];
          if (pinSrc.length < 2) {
            // fallback flat note from start/end
            const startBeat = bar * bpb + noteStart / partsPerBeat;
            const endBeat =
              bar * bpb + (n.end != null ? n.end : noteStart + 1) / partsPerBeat;
            basePitches.forEach((p) => {
              notes.push({
                pins: [
                  { beat: startBeat, pitch: 0 | p },
                  { beat: endBeat, pitch: 0 | p },
                ],
                startBeat,
                endBeat,
                pitch: 0 | p,
                isSlide: false,
              });
            });
            return;
          }

          basePitches.forEach((basePitch) => {
            const pins = pinSrc.map((pin) => ({
              beat: bar * bpb + (noteStart + (pin.time || 0)) / partsPerBeat,
              pitch: (0 | basePitch) + (0 | (pin.interval || 0)),
              volume: pin.size,
            }));
            const startBeat = pins[0].beat;
            const endBeat = pins[pins.length - 1].beat;
            const isSlide = pins.some((p) => p.pitch !== pins[0].pitch);
            notes.push({
              pins,
              startBeat,
              endBeat: endBeat > startBeat ? endBeat : startBeat + 0.01,
              pitch: 0 | basePitch,
              isSlide,
            });
          });
        });
      }
    } catch (e) {
      console.warn("Note collect failed:", e);
    }
    return notes;
  }

  /** Interpolate continuous pitch of a note at a given beat (for slides). */
  function pitchAtBeat(note, beat) {
    const pins = note.pins;
    if (!pins || pins.length === 0) return note.pitch;
    if (beat <= pins[0].beat) return pins[0].pitch;
    if (beat >= pins[pins.length - 1].beat) return pins[pins.length - 1].pitch;
    for (let i = 0; i < pins.length - 1; i++) {
      const a = pins[i];
      const b = pins[i + 1];
      if (beat >= a.beat && beat <= b.beat) {
        const span = b.beat - a.beat;
        if (span <= 0) return a.pitch;
        const t = (beat - a.beat) / span;
        return a.pitch + t * (b.pitch - a.pitch);
      }
    }
    return note.pitch;
  }

  function pitchLabel(p) {
    const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    return names[((p % 12) + 12) % 12] + Math.floor(p / 12);
  }

  function isBlackKey(p) {
    return [1, 3, 6, 8, 10].includes(((p % 12) + 12) % 12);
  }

  // ---------- Piano roll ----------

  function buildPianoRoll() {
    if (!song) return;
    const chIdx = parseInt(pianoRollChannel.value, 10);
    if (isNaN(chIdx)) return;

    rollNotes = collectNotesForChannel(chIdx);

    let minP = 24;
    let maxP = 48;
    if (rollNotes.length) {
      const allPitches = [];
      rollNotes.forEach((n) => {
        if (n.pins) n.pins.forEach((p) => allPitches.push(p.pitch));
        else allPitches.push(n.pitch);
      });
      minP = Math.min(...allPitches) - 2;
      maxP = Math.max(...allPitches) + 2;
      minP = Math.max(0, minP);
      maxP = Math.min(96, maxP);
    }

    const pitchCount = maxP - minP + 1;
    const bpb = song.beatsPerBar || 8;
    const totalBeats = Math.max(1, (song.barCount || 1) * bpb);
    const width = Math.max(480, Math.ceil(PR.keyW + totalBeats * PR.pxPerBeat + 4));
    const height = Math.max(140, pitchCount * PR.rowH + 4);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    pianoRollCanvas.width = Math.floor(width * dpr);
    pianoRollCanvas.height = Math.floor(height * dpr);
    pianoRollCanvas.style.width = width + "px";
    pianoRollCanvas.style.height = height + "px";

    const ctx = pianoRollCanvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Background
    ctx.fillStyle = "#0e1016";
    ctx.fillRect(0, 0, width, height);

    // Rows
    for (let i = 0; i < pitchCount; i++) {
      const pitch = maxP - i;
      const y = i * PR.rowH;
      ctx.fillStyle = isBlackKey(pitch) ? "#151820" : "#12151c";
      ctx.fillRect(PR.keyW, y, width - PR.keyW, PR.rowH);

      ctx.fillStyle = isBlackKey(pitch) ? "#2c3140" : "#e8ecf4";
      ctx.fillRect(0, y, PR.keyW - 1, PR.rowH - 1);

      if (!isBlackKey(pitch) || pitch % 12 === 0) {
        ctx.fillStyle = isBlackKey(pitch) ? "#bbb" : "#333";
        ctx.font = "10px ui-sans-serif, system-ui, sans-serif";
        ctx.fillText(pitchLabel(pitch), 4, y + PR.rowH - 3);
      }
    }

    // Grid
    for (let b = 0; b <= totalBeats; b++) {
      const x = PR.keyW + b * PR.pxPerBeat;
      const isBar = b % bpb === 0;
      ctx.strokeStyle = isBar ? "rgba(124,156,255,0.4)" : "rgba(255,255,255,0.05)";
      ctx.lineWidth = isBar ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
      if (isBar) {
        ctx.fillStyle = "rgba(180,200,255,0.85)";
        ctx.font = "10px ui-sans-serif, system-ui, sans-serif";
        ctx.fillText(String(b / bpb + 1), x + 3, 11);
      }
    }

    // Notes — flat rectangles or slide polygons following pitchBend pins
    function pitchToY(p) {
      return (maxP - p) * PR.rowH;
    }

    rollNotes.forEach((n, idx) => {
      n._idx = idx;
      const pins = n.pins;
      if (!pins || pins.length < 2) return;

      const isSlide = !!n.isSlide;
      ctx.fillStyle = isSlide ? "#8b6cff" : "#5b7fd6";
      ctx.strokeStyle = isSlide ? "rgba(200,180,255,0.5)" : "rgba(0,0,0,0.3)";
      ctx.lineWidth = 1;

      if (!isSlide) {
        // Flat note
        const p = pins[0].pitch;
        if (p < minP || p > maxP) return;
        const y = pitchToY(p) + 1;
        const x = PR.keyW + n.startBeat * PR.pxPerBeat;
        const w = Math.max(3, (n.endBeat - n.startBeat) * PR.pxPerBeat - 1);
        n._flat = { x, y, w, h: PR.rowH - 2 };
        ctx.fillRect(x, y, w, PR.rowH - 2);
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, PR.rowH - 3);
      } else {
        // Slide: filled strip following pitch over time (parallelogram-ish polygon)
        const half = (PR.rowH - 2) / 2;
        ctx.beginPath();
        // Top edge following pitch center - half
        for (let i = 0; i < pins.length; i++) {
          const x = PR.keyW + pins[i].beat * PR.pxPerBeat;
          const y = pitchToY(pins[i].pitch) + PR.rowH / 2 - half;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        // Bottom edge reverse
        for (let i = pins.length - 1; i >= 0; i--) {
          const x = PR.keyW + pins[i].beat * PR.pxPerBeat;
          const y = pitchToY(pins[i].pitch) + PR.rowH / 2 + half;
          ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw center slide line
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.beginPath();
        for (let i = 0; i < pins.length; i++) {
          const x = PR.keyW + pins[i].beat * PR.pxPerBeat;
          const y = pitchToY(pins[i].pitch) + PR.rowH / 2;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        n._flat = null; // mark as polygon
      }
    });

    rollMeta = { minP, maxP, pitchCount, totalBeats, width, height, bpb, dpr };
    ensureRollPlayhead(height);
    updateRollHighlight();
  }

  function ensureRollPlayhead(height) {
    let line = $("#prPlayheadLine");
    if (!line) {
      line = document.createElement("div");
      line.id = "prPlayheadLine";
      line.style.cssText =
        "position:absolute;top:0;left:0;width:2px;height:100%;" +
        "background:#ffb84d;box-shadow:0 0 8px rgba(255,184,77,0.8);" +
        "pointer-events:none;z-index:3;will-change:transform;";
      pianoRollScroll.appendChild(line);
    }
    line.style.height = height + "px";
  }

  /** Redraw active notes brighter + move playhead; slides show a glowing dot at current pitch */
  function updateRollHighlight() {
    if (!rollMeta || !pianoRollCanvas) return;
    const beat = getCurrentBeat();
    const { minP, maxP, dpr } = rollMeta;

    const ctx = pianoRollCanvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    function pitchToY(p) {
      return (maxP - p) * PR.rowH;
    }

    rollNotes.forEach((n) => {
      const active = beat >= n.startBeat && beat < n.endBeat;
      const pins = n.pins;
      if (!pins || pins.length < 2) return;

      if (!n.isSlide && n._flat) {
        const f = n._flat;
        ctx.fillStyle = active ? "#ffe08a" : "#5b7fd6";
        ctx.fillRect(f.x, f.y, f.w, f.h);
        ctx.strokeStyle = active ? "#fff3c4" : "rgba(0,0,0,0.3)";
        ctx.lineWidth = active ? 1.5 : 1;
        ctx.strokeRect(f.x + 0.5, f.y + 0.5, f.w - 1, f.h - 1);
        ctx.lineWidth = 1;
      } else if (n.isSlide) {
        // Redraw slide body
        const half = (PR.rowH - 2) / 2;
        ctx.fillStyle = active ? "#ffe08a" : "#8b6cff";
        ctx.strokeStyle = active ? "#fff3c4" : "rgba(200,180,255,0.5)";
        ctx.beginPath();
        for (let i = 0; i < pins.length; i++) {
          const x = PR.keyW + pins[i].beat * PR.pxPerBeat;
          const y = pitchToY(pins[i].pitch) + PR.rowH / 2 - half;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        for (let i = pins.length - 1; i >= 0; i--) {
          const x = PR.keyW + pins[i].beat * PR.pxPerBeat;
          const y = pitchToY(pins[i].pitch) + PR.rowH / 2 + half;
          ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Center path
        ctx.strokeStyle = active ? "rgba(120,80,0,0.45)" : "rgba(255,255,255,0.35)";
        ctx.beginPath();
        for (let i = 0; i < pins.length; i++) {
          const x = PR.keyW + pins[i].beat * PR.pxPerBeat;
          const y = pitchToY(pins[i].pitch) + PR.rowH / 2;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Glowing playhead marker on the slide curve
        if (active) {
          const curP = pitchAtBeat(n, beat);
          const x = PR.keyW + beat * PR.pxPerBeat;
          const y = pitchToY(curP) + PR.rowH / 2;
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#ff9f1a";
          ctx.beginPath();
          ctx.arc(x, y, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });

    const x = PR.keyW + beat * PR.pxPerBeat;
    const line = $("#prPlayheadLine");
    if (line) line.style.transform = "translateX(" + x + "px)";

    if (pianoRollScroll && synth && synth.isPlayingSong) {
      const viewW = pianoRollScroll.clientWidth;
      const target = x - viewW * 0.3;
      if (
        x < pianoRollScroll.scrollLeft + 40 ||
        x > pianoRollScroll.scrollLeft + viewW - 80
      ) {
        pianoRollScroll.scrollLeft = Math.max(0, target);
      }
    }
  }

  function togglePianoRoll() {
    pianoRollVisible = !pianoRollVisible;
    pianoRollWrap.hidden = !pianoRollVisible;
    btnPianoRoll.classList.toggle("active", pianoRollVisible);
    if (pianoRollVisible) buildPianoRoll();
  }

  // ---------- Live piano keyboard ----------

  function buildPianoKeys() {
    if (!pianoKeysEl || !song) return;
    const chIdx = parseInt(pianoKeysChannel.value, 10);
    if (isNaN(chIdx)) return;

    const notes = collectNotesForChannel(chIdx);
    let minP = 24;
    let maxP = 48;
    if (notes.length) {
      const allP = [];
      notes.forEach((n) => {
        if (n.pins) n.pins.forEach((p) => allP.push(p.pitch));
        else allP.push(n.pitch);
      });
      minP = Math.min(...allP);
      maxP = Math.max(...allP);
      // Expand to full octaves for nicer keyboard
      minP = Math.floor(minP / 12) * 12;
      maxP = Math.ceil((maxP + 1) / 12) * 12 - 1;
      minP = Math.max(0, minP);
      maxP = Math.min(96, maxP);
    } else {
      minP = 24;
      maxP = 48;
    }

    // Count white keys for width
    const whites = [];
    for (let p = minP; p <= maxP; p++) {
      if (!isBlackKey(p)) whites.push(p);
    }

    pianoKeysEl.innerHTML = "";
    pianoKeysEl.style.position = "relative";
    pianoKeysEl.dataset.minP = String(minP);
    pianoKeysEl.dataset.maxP = String(maxP);

    const whiteW = 28;
    const blackW = 18;
    const whiteH = 120;
    const blackH = 72;

    pianoKeysEl.style.height = whiteH + "px";
    pianoKeysEl.style.width = whites.length * whiteW + "px";

    // White keys first
    const keyEls = {};
    let wi = 0;
    for (let p = minP; p <= maxP; p++) {
      if (isBlackKey(p)) continue;
      const key = document.createElement("div");
      key.className = "pkey white";
      key.dataset.pitch = String(p);
      key.style.left = wi * whiteW + "px";
      key.style.width = whiteW - 1 + "px";
      key.style.height = whiteH + "px";
      const lab = document.createElement("span");
      lab.className = "pkey-label";
      lab.textContent = pitchLabel(p);
      key.appendChild(lab);
      pianoKeysEl.appendChild(key);
      keyEls[p] = key;
      wi++;
    }

    // Black keys positioned over whites
    // Map pitch → white-index of the white key to the left
    function whiteIndexBefore(pitch) {
      let idx = 0;
      for (let p = minP; p < pitch; p++) {
        if (!isBlackKey(p)) idx++;
      }
      return idx;
    }

    for (let p = minP; p <= maxP; p++) {
      if (!isBlackKey(p)) continue;
      const key = document.createElement("div");
      key.className = "pkey black";
      key.dataset.pitch = String(p);
      const leftWhite = whiteIndexBefore(p);
      key.style.left = leftWhite * whiteW - blackW / 2 + "px";
      key.style.width = blackW + "px";
      key.style.height = blackH + "px";
      pianoKeysEl.appendChild(key);
      keyEls[p] = key;
    }

    pianoKeysEl._keyEls = keyEls;
    pianoKeysEl._notes = notes;
    updatePianoKeys();
  }

  function updatePianoKeys() {
    if (!pianoKeysEl || !pianoKeysEl._keyEls) return;
    const beat = getCurrentBeat();
    const notes = pianoKeysEl._notes || [];
    const active = new Set();
    // Also track fractional slide position for soft highlight of neighbor keys
    const slideGlow = new Map(); // pitch -> intensity 0-1

    notes.forEach((n) => {
      if (beat < n.startBeat || beat >= n.endBeat) return;
      if (n.isSlide && n.pins) {
        const cur = pitchAtBeat(n, beat);
        const lo = Math.floor(cur);
        const hi = Math.ceil(cur);
        active.add(lo);
        if (hi !== lo) {
          active.add(hi);
          // stronger on nearer key
          const frac = cur - lo;
          slideGlow.set(lo, Math.max(slideGlow.get(lo) || 0, 1 - frac));
          slideGlow.set(hi, Math.max(slideGlow.get(hi) || 0, frac));
        } else {
          slideGlow.set(lo, 1);
        }
      } else {
        active.add(n.pitch);
        slideGlow.set(n.pitch, 1);
      }
    });

    const els = pianoKeysEl._keyEls;
    for (const p in els) {
      const pitch = +p;
      const on = active.has(pitch);
      els[p].classList.toggle("active", on);
      els[p].classList.toggle("slide", on && (slideGlow.get(pitch) || 0) < 0.999);
      // Optional: opacity by how close the slide is to this key
      if (on && slideGlow.has(pitch)) {
        const inten = slideGlow.get(pitch);
        els[p].style.setProperty("--hit", String(0.55 + 0.45 * inten));
      } else {
        els[p].style.removeProperty("--hit");
      }
    }
  }

  function togglePianoKeys() {
    pianoKeysVisible = !pianoKeysVisible;
    if (pianoKeysWrap) pianoKeysWrap.hidden = !pianoKeysVisible;
    if (btnShowPianos) btnShowPianos.classList.toggle("active", pianoKeysVisible);
    if (pianoKeysVisible) buildPianoKeys();
  }

  // ---------- Events ----------

  dropZone.addEventListener("click", () => fileInput.click());
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) loadFromFile(f);
  });

  fileInput.addEventListener("change", () => {
    const f = fileInput.files && fileInput.files[0];
    if (f) loadFromFile(f);
    fileInput.value = "";
  });

  btnLoadUrl.addEventListener("click", loadFromUrlInput);
  urlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") loadFromUrlInput();
  });

  btnPlay.addEventListener("click", () => {
    if (!synth) return;
    try {
      if (synth.isPlayingSong) synth.pause();
      else synth.play();
      updateProgress();
    } catch (e) {
      console.error(e);
    }
  });

  btnStop.addEventListener("click", () => {
    if (!synth) return;
    try {
      synth.pause();
      if (typeof synth.snapToStart === "function") synth.snapToStart();
      updateProgress();
    } catch (e) {
      console.error(e);
    }
  });

  btnRestart.addEventListener("click", () => {
    if (!synth) return;
    try {
      if (typeof synth.snapToStart === "function") synth.snapToStart();
      synth.play();
      updateProgress();
    } catch (e) {
      console.error(e);
    }
  });

  if (btnPianoRoll) btnPianoRoll.addEventListener("click", togglePianoRoll);
  if (btnShowPianos) btnShowPianos.addEventListener("click", togglePianoKeys);

  if (pianoRollChannel) {
    pianoRollChannel.addEventListener("change", () => {
      if (pianoRollVisible) buildPianoRoll();
    });
  }
  if (pianoKeysChannel) {
    pianoKeysChannel.addEventListener("change", () => {
      if (pianoKeysVisible) buildPianoKeys();
    });
  }

  volume.addEventListener("input", applyVolume);

  progressBar.addEventListener("click", (e) => {
    if (!synth || !song || barCount <= 0) return;
    const rect = progressBar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    try {
      synth.playhead = ratio * barCount;
      updateProgress();
    } catch (_) {}
  });

  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea, select")) return;
    if (e.code === "Space") {
      e.preventDefault();
      btnPlay.click();
    } else if (e.code === "KeyR" && !e.metaKey && !e.ctrlKey) {
      btnRestart.click();
    } else if (e.code === "KeyS" && !e.metaKey && !e.ctrlKey) {
      btnStop.click();
    } else if (e.code === "KeyP" && !e.metaKey && !e.ctrlKey) {
      togglePianoRoll();
    } else if (e.code === "KeyK" && !e.metaKey && !e.ctrlKey) {
      togglePianoKeys();
    }
  });

  loadExampleBtn.addEventListener("click", async () => {
    try {
      const res = await fetch("example-song.json");
      if (!res.ok) throw new Error("HTTP " + res.status);
      loadJsonObject(await res.json(), "Piano master");
    } catch (e) {
      console.error(e);
      alert("Could not load example-song.json (serve this folder over HTTP).");
    }
  });

  // Intentionally do NOT read/write song data from/to the page URL.
  // Large UltraBox songs exceed practical URL length limits and would break the page.

  window.ubPlayer = {
    get synth() {
      return synth;
    },
    get song() {
      return song;
    },
    collectNotesForChannel,
    loadJsonObject,
    loadSongString,
  };
})();
