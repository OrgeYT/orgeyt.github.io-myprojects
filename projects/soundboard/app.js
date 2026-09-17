/**
 * OrgeYT Soundboard – Main application logic
 */
(function () {
  "use strict";

  // ── State ──────────────────────────────────────────────────────────────
  let currentAudio = null;
  let currentPlayingId = null;
  let resolvedSounds = [];

  // ── DOM refs ───────────────────────────────────────────────────────────
  const grid = document.getElementById("sound-grid");
  const searchInput = document.getElementById("search-input");
  const randomBtn = document.getElementById("random-btn");
  const stopBtn = document.getElementById("stop-btn");
  const statusEl = document.getElementById("status-text");
  const countEl = document.getElementById("sound-count");

  // ── Helpers ────────────────────────────────────────────────────────────
  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg;
  }

  /** Hash a string → stable HSL color (saturated, readable) */
  function colorFromName(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    // Avoid muddy browns: keep saturation high, lightness mid
    const sat = 65 + (Math.abs(hash >> 8) % 20); // 65–84%
    const light = 42 + (Math.abs(hash >> 16) % 12); // 42–53%
    return {
      top: `hsl(${hue}, ${sat}%, ${light}%)`,
      edge: `hsl(${hue}, ${sat}%, ${Math.max(18, light - 22)}%)`
    };
  }

  function urlExists(url) {
    return fetch(url, { method: "HEAD" })
      .then((res) => res.ok)
      .catch(() =>
        fetch(url, { method: "GET", headers: { Range: "bytes=0-0" } })
          .then((res) => res.ok || res.status === 206)
          .catch(() => false)
      );
  }

  function resolveAudio(baseName) {
    return new Promise((resolve) => {
      if (!baseName) {
        resolve(null);
        return;
      }
      let index = 0;
      async function tryNext() {
        if (index >= CONFIG.audioFormats.length) {
          resolve(null);
          return;
        }
        const ext = CONFIG.audioFormats[index++];
        const url = `${CONFIG.audioFolder}/${baseName}.${ext}`;
        const exists = await urlExists(url);
        if (exists) resolve(url);
        else tryNext();
      }
      tryNext();
    });
  }

  async function resolveAllSounds() {
    setStatus("Checking assets…");
    const promises = SOUNDS.map(async (sound, index) => {
      const audioUrl = await resolveAudio(sound.audio);
      const colors = colorFromName(sound.name);
      return {
        id: index,
        name: sound.name,
        audioBase: sound.audio,
        color: colors.top,
        edge: colors.edge,
        audioUrl,
        audioMissing: !audioUrl
      };
    });
    resolvedSounds = await Promise.all(promises);
    setStatus("Ready");
    updateCount();
  }

  function updateCount() {
    if (!countEl) return;
    const total = resolvedSounds.length;
    const missing = resolvedSounds.filter((s) => s.audioMissing).length;
    countEl.textContent =
      missing > 0
        ? `${total} sounds (${missing} missing audio)`
        : `${total} sounds`;
  }

  // ── Rendering ──────────────────────────────────────────────────────────
  function createSoundCard(sound) {
    const container = document.createElement("div");
    container.className = "instant-container";
    container.dataset.id = sound.id;
    if (sound.audioMissing) container.classList.add("audio-missing");

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "instant-btn";
    btn.setAttribute("aria-label", `Play ${sound.name}`);
    btn.style.setProperty("--btn-color", sound.color);
    btn.style.setProperty("--btn-edge", sound.edge);

    const top = document.createElement("span");
    top.className = "btn-top";

    const label = document.createElement("span");
    label.className = "btn-label";
    label.textContent = sound.name;
    top.appendChild(label);

    btn.appendChild(top);
    container.appendChild(btn);

    if (sound.audioMissing) {
      const warn = document.createElement("span");
      warn.className = "warning-badge";
      warn.textContent = "No sound";
      warn.title = "Cannot find sound file";
      container.appendChild(warn);
    }

    const trigger = () => playSound(sound);
    btn.addEventListener("click", trigger);
    btn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        trigger();
      }
    });

    return container;
  }

  function renderGrid(filter = "") {
    const query = filter.trim().toLowerCase();
    const filtered = query
      ? resolvedSounds.filter((s) => s.name.toLowerCase().includes(query))
      : resolvedSounds;

    grid.innerHTML = "";

    if (filtered.length === 0) {
      grid.innerHTML = `<p class="empty-state">No sounds match “${filter}”</p>`;
      return;
    }

    const fragment = document.createDocumentFragment();
    filtered.forEach((sound) => fragment.appendChild(createSoundCard(sound)));
    grid.appendChild(fragment);

    if (currentPlayingId !== null) {
      const active = grid.querySelector(
        `.instant-container[data-id="${currentPlayingId}"] .instant-btn`
      );
      if (active) active.classList.add("playing");
    }
  }

  // ── Playback ───────────────────────────────────────────────────────────
  function stopCurrent() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }
    if (currentPlayingId !== null) {
      const prev = document.querySelector(
        `.instant-container[data-id="${currentPlayingId}"] .instant-btn`
      );
      if (prev) prev.classList.remove("playing");
      currentPlayingId = null;
    }
    stopBtn.disabled = true;
    setStatus("Ready");
  }

  function playSound(sound) {
    if (sound.audioMissing) {
      setStatus(`Missing audio: ${sound.name}`);
      const card = document.querySelector(
        `.instant-container[data-id="${sound.id}"]`
      );
      if (card) {
        card.classList.add("shake");
        setTimeout(() => card.classList.remove("shake"), 400);
      }
      return;
    }

    stopCurrent();

    const audio = new Audio(sound.audioUrl);
    currentAudio = audio;
    currentPlayingId = sound.id;

    const btn = document.querySelector(
      `.instant-container[data-id="${sound.id}"] .instant-btn`
    );
    if (btn) btn.classList.add("playing");
    stopBtn.disabled = false;
    setStatus(`Playing: ${sound.name}`);

    audio.addEventListener("ended", stopCurrent);
    audio.addEventListener("error", () => {
      setStatus(`Error playing: ${sound.name}`);
      stopCurrent();
    });

    audio.play().catch((err) => {
      console.warn("Playback failed:", err);
      setStatus(`Could not play: ${sound.name}`);
      stopCurrent();
    });
  }

  function playRandom() {
    const playable = resolvedSounds.filter((s) => !s.audioMissing);
    if (playable.length === 0) {
      setStatus("No playable sounds available");
      return;
    }
    playSound(playable[Math.floor(Math.random() * playable.length)]);
  }

  // ── Keyboard ───────────────────────────────────────────────────────────
  function handleGlobalKeys(e) {
    if (e.target === searchInput) return;
    if (e.key === "Escape") stopCurrent();
    else if ((e.key === "r" || e.key === "R") && !e.ctrlKey && !e.metaKey && !e.altKey) {
      playRandom();
    }
  }

  // ── Init ───────────────────────────────────────────────────────────────
  async function init() {
    if (typeof CONFIG === "undefined" || typeof SOUNDS === "undefined") {
      setStatus("Error: config or sounds failed to load");
      return;
    }

    await resolveAllSounds();
    renderGrid();

    searchInput.addEventListener("input", () => renderGrid(searchInput.value));
    randomBtn.addEventListener("click", playRandom);
    stopBtn.addEventListener("click", stopCurrent);
    document.addEventListener("keydown", handleGlobalKeys);
    document.addEventListener("keydown", (e) => {
      if (e.key === "/" && e.target !== searchInput) {
        e.preventDefault();
        searchInput.focus();
      }
    });

    stopBtn.disabled = true;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
