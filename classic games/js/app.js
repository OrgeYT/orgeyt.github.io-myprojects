(function () {
  const grid = document.getElementById("games-grid");
  const tabsNav = document.getElementById("system-tabs");
  const libraryView = document.getElementById("library-view");
  const emulatorView = document.getElementById("emulator-view");

  let GAMES = [];
  let SYSTEMS = {};
  let currentSystem = "all";
  let ejsLoaded = false;

  // Extension → preferred EmulatorJS core
  const EXT_TO_CORE = {
    nes: "nes", fds: "nes", unf: "nes", unif: "nes",
    smc: "snes", sfc: "snes", fig: "snes", swc: "snes", gd3: "snes", gd7: "snes",
    gen: "segaMD", md: "segaMD", smd: "segaMD",
    sms: "segaMS",
    gg: "segaGG",
    gb: "gb", gbc: "gb",
    gba: "gba",
    n64: "n64", z64: "n64", v64: "n64",
    nds: "nds",
    a26: "atari2600",
    lnx: "lynx",
    ws: "ws", wsc: "ws",
    pce: "pce",
    col: "coleco",
    zip: "arcade"
  };

  function resolveGame(raw) {
    const sys = SYSTEMS[raw.system] || {};
    const folder = sys.folder || raw.system;
    const core = raw.core || sys.core || raw.system;
    return {
      id: raw.id,
      title: raw.title,
      system: raw.system,
      core: core,
      rom: raw.rom || ("roms/" + folder + "/" + raw.file),
      thumb: raw.thumb.startsWith("thumbs/") || raw.thumb.startsWith("http")
        ? raw.thumb
        : ("thumbs/" + raw.thumb),
      year: raw.year || "",
      hack: !!raw.hack,
      homebrew: !!raw.homebrew,
      description: raw.description || ""
    };
  }

  function systemLabel(sys) {
    if (SYSTEMS[sys] && SYSTEMS[sys].label) return SYSTEMS[sys].label;
    const map = {
      nes: "NES", snes: "SNES", genesis: "Genesis", sms: "SMS",
      segaMD: "Genesis", segaMS: "Master System", segaGG: "Game Gear",
      gb: "Game Boy", gba: "GBA", n64: "N64", nds: "NDS",
      psx: "PS1", atari2600: "Atari 2600", arcade: "Arcade"
    };
    return map[sys] || sys.toUpperCase();
  }

  function buildTabs() {
    const hacksBtn = tabsNav.querySelector('[data-system="hacks"]');

    tabsNav.querySelectorAll(".tab[data-system]").forEach((btn) => {
      const s = btn.dataset.system;
      if (s !== "all" && s !== "hacks" && s !== "homebrew") btn.remove();
    });

    Object.keys(SYSTEMS).forEach((key) => {
      const btn = document.createElement("button");
      btn.className = "tab";
      btn.dataset.system = key;
      btn.textContent = SYSTEMS[key].label || key.toUpperCase();
      tabsNav.insertBefore(btn, hacksBtn);
    });

    tabsNav.querySelectorAll(".tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        tabsNav.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        currentSystem = tab.dataset.system;
        renderGames();
      });
    });
  }

  function renderGames() {
    const filtered =
      currentSystem === "all"
        ? GAMES
        : currentSystem === "hacks"
          ? GAMES.filter((g) => g.hack)
          : currentSystem === "homebrew"
            ? GAMES.filter((g) => g.homebrew)
            : GAMES.filter((g) => g.system === currentSystem);

    grid.innerHTML = "";

    if (!filtered.length) {
      grid.innerHTML = '<p class="loading-msg">No games in this section.</p>';
      return;
    }

    filtered.forEach((game) => {
      const card = document.createElement("article");
      let extraClass = "";
      if (game.hack) extraClass += " hack";
      if (game.homebrew) extraClass += " homebrew";
      card.className = "game-card" + extraClass;
      card.dataset.id = game.id;

      let metaExtra = "";
      if (game.hack) metaExtra = " · ROM Hack";
      else if (game.homebrew) metaExtra = " · Homebrew";

      card.innerHTML = `
        <div class="thumb ${game.system}">
          <img src="${game.thumb}" alt="${game.title}" loading="lazy">
          <span class="system-badge ${game.system}">${systemLabel(game.system)}</span>
        </div>
        <div class="info">
          <h3>${game.title}</h3>
          <div class="meta">${game.year}${metaExtra}</div>
          <div class="description">${game.description}</div>
          <div class="card-actions">
            <button type="button" class="btn-play" data-id="${game.id}">Play</button>
            <a class="btn-download" href="${game.rom}" download title="Download ROM">Download</a>
          </div>
        </div>
      `;

      const playBtn = card.querySelector(".btn-play");
      playBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        window.location.href = "play.html?id=" + encodeURIComponent(game.id);
      });

      card.addEventListener("click", (e) => {
        if (e.target.closest(".btn-download") || e.target.closest(".btn-play")) return;
        window.location.href = "play.html?id=" + encodeURIComponent(game.id);
      });

      grid.appendChild(card);
    });
  }

  // ---------- Upload ROM (same-page File object — official EmulatorJS pattern) ----------
  const modal = document.getElementById("upload-modal");
  const uploadBtn = document.getElementById("upload-btn");
  const closeBtn = document.getElementById("upload-close");
  const systemSelect = document.getElementById("upload-system");
  const fileInput = document.getElementById("rom-file");
  const fileNameEl = document.getElementById("file-name");
  const playUploadBtn = document.getElementById("play-upload-btn");
  const errorEl = document.getElementById("upload-error");
  const fileDrop = document.getElementById("file-drop");

  let selectedFile = null;

  function openModal() {
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    errorEl.hidden = true;
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = "";
  }

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  }

  function setFile(file) {
    if (!file) return;
    selectedFile = file;
    fileNameEl.textContent = file.name + " (" + Math.round(file.size / 1024) + " KB)";
    playUploadBtn.disabled = false;
    errorEl.hidden = true;

    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (EXT_TO_CORE[ext]) {
      const core = EXT_TO_CORE[ext];
      const opt = Array.from(systemSelect.options).find((o) => o.value === core);
      if (opt) systemSelect.value = core;
    }
  }

  uploadBtn.addEventListener("click", openModal);
  closeBtn.addEventListener("click", closeModal);
  modal.querySelector(".upload-modal-backdrop").addEventListener("click", closeModal);

  fileInput.addEventListener("change", () => {
    if (fileInput.files && fileInput.files[0]) setFile(fileInput.files[0]);
  });

  ["dragenter", "dragover"].forEach((ev) => {
    fileDrop.addEventListener(ev, (e) => {
      e.preventDefault();
      e.stopPropagation();
      fileDrop.classList.add("dragover");
    });
  });
  ["dragleave", "drop"].forEach((ev) => {
    fileDrop.addEventListener(ev, (e) => {
      e.preventDefault();
      e.stopPropagation();
      fileDrop.classList.remove("dragover");
    });
  });
  fileDrop.addEventListener("drop", (e) => {
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) {
      try { fileInput.files = e.dataTransfer.files; } catch (_) {}
      setFile(f);
    }
  });

  /**
   * Launch uploaded ROM on the SAME page.
   * EmulatorJS accepts a File object directly as EJS_gameUrl.
   * This is the pattern used by official demos and working community examples.
   * Navigating away would invalidate the File / blob URL and cause Network Error.
   */
  function startUploadedGame(file, core) {
    closeModal();

    const title = (file.name || "Uploaded ROM").replace(/\.[^.]+$/, "");
    document.getElementById("emu-title").textContent = title;
    document.title = title + " – Classic Games";

    // Switch views
    libraryView.hidden = true;
    emulatorView.hidden = false;
    document.body.classList.add("playing");

    // Clear previous emulator if any
    const gameEl = document.getElementById("game");
    gameEl.innerHTML = "";

    // Configure EmulatorJS — pass the File object directly
    window.EJS_player = "#game";
    window.EJS_core = core;
    window.EJS_gameUrl = file;              // <-- File object (not a URL string)
    window.EJS_pathtodata = "https://cdn.emulatorjs.org/stable/data/";
    window.EJS_color = "#00f5d4";
    window.EJS_startOnLoaded = true;
    window.EJS_gameName = title;
    window.EJS_fullscreenOnLoaded = false;
    window.EJS_lightgun = false;

    // Load loader only once; if already loaded, EmulatorJS will pick up new globals
    // on a fresh page we always load it. For same-page re-run we force a new script.
    const existing = document.querySelector('script[data-ejs-loader]');
    if (existing) existing.remove();

    const s = document.createElement("script");
    s.src = "https://cdn.emulatorjs.org/stable/data/loader.js";
    s.setAttribute("data-ejs-loader", "1");
    s.onerror = function () {
      document.getElementById("emu-title").textContent = "Failed to load EmulatorJS";
      gameEl.innerHTML = '<p style="color:#ff6b8a;text-align:center;padding:2rem;font-size:1.2rem">Could not load EmulatorJS from CDN.<br>Check your internet connection.</p>';
    };
    document.body.appendChild(s);
  }

  playUploadBtn.addEventListener("click", () => {
    if (!selectedFile) {
      showError("Please select a ROM file first.");
      return;
    }
    const core = systemSelect.value;
    if (!core) {
      showError("Please choose a system.");
      return;
    }
    startUploadedGame(selectedFile, core);
  });

  // Back to library
  document.getElementById("back-btn").addEventListener("click", () => {
    // Reload the page to fully tear down EmulatorJS (cleanest way)
    window.location.href = "index.html";
  });

  document.getElementById("fs-btn").addEventListener("click", () => {
    const el = document.querySelector(".emulator-box");
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  });

  // ---------- Load library ----------
  fetch("roms.json")
    .then((r) => {
      if (!r.ok) throw new Error("Could not load roms.json");
      return r.json();
    })
    .then((data) => {
      SYSTEMS = data.systems || {};
      GAMES = (data.games || []).map(resolveGame);
      window.GAMES = GAMES;
      window.SYSTEMS = SYSTEMS;
      buildTabs();
      renderGames();
    })
    .catch((err) => {
      console.error(err);
      grid.innerHTML =
        '<p class="loading-msg">Failed to load <code>roms.json</code>. Serve this folder over HTTP and check the file exists.</p>';
    });
})();
