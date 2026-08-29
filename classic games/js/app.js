(function () {
  const grid = document.getElementById("games-grid");
  const tabs = document.querySelectorAll(".tab");
  const customCore = document.getElementById("custom-core");
  const customFile = document.getElementById("custom-rom-file");
  const fileNameEl = document.getElementById("file-name");
  const playCustomBtn = document.getElementById("play-custom-btn");
  const playOverlay = document.getElementById("play-overlay");
  const playTitle = document.getElementById("play-title");
  const playBox = document.getElementById("play-box");
  const closePlayBtn = document.getElementById("close-play-btn");
  const fsPlayBtn = document.getElementById("fs-play-btn");

  let currentSystem = "all";
  let selectedFile = null;
  let currentBlobUrl = null;

  function systemLabel(sys) {
    const map = {
      nes: "NES",
      snes: "SNES",
      genesis: "Genesis",
      sms: "SMS"
    };
    return map[sys] || sys.toUpperCase();
  }

  function renderGames() {
    const filtered =
      currentSystem === "all"
        ? GAMES
        : currentSystem === "hacks"
          ? GAMES.filter((g) => g.hack)
          : GAMES.filter((g) => g.system === currentSystem);

    grid.innerHTML = "";

    filtered.forEach((game) => {
      const card = document.createElement("article");
      card.className = "game-card" + (game.hack ? " hack" : "");
      card.dataset.id = game.id;

      card.innerHTML = `
        <div class="thumb ${game.system}">
          <img src="${game.thumb}" alt="${game.title}" loading="lazy">
          <span class="system-badge ${game.system}">${systemLabel(game.system)}</span>
        </div>
        <div class="info">
          <h3>${game.title}</h3>
          <div class="meta">${game.year}${game.hack ? " · ROM Hack" : ""}</div>
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

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      currentSystem = tab.dataset.system;
      renderGames();
    });
  });

  customFile.addEventListener("change", () => {
    selectedFile = customFile.files && customFile.files[0] ? customFile.files[0] : null;
    if (selectedFile) {
      fileNameEl.textContent = selectedFile.name;
      playCustomBtn.disabled = false;
    } else {
      fileNameEl.textContent = "No file chosen";
      playCustomBtn.disabled = true;
    }
  });

  function startCustomRom(file, core, title) {
    if (currentBlobUrl) {
      try { URL.revokeObjectURL(currentBlobUrl); } catch (_) {}
      currentBlobUrl = null;
    }

    // Official EmulatorJS pattern: pass File object OR blob URL created on same page
    // Using both approaches — File first (as official demo), blob URL as the string form
    currentBlobUrl = URL.createObjectURL(file);

    playTitle.textContent = title;
    playOverlay.classList.remove("hidden");
    document.body.style.overflow = "hidden";

    // Fresh container each time (matches official demo clearing UI)
    playBox.innerHTML = '<div id="game" style="width:100%;height:100%;"></div>';

    // Force layout so EmulatorJS sees non-zero size
    playOverlay.offsetHeight;

    window.EJS_player = "#game";
    window.EJS_core = core;
    // Blob URL on same page (EmulatorJS handles blob: without network/CORS issues)
    window.EJS_gameUrl = currentBlobUrl;
    window.EJS_pathtodata = "https://cdn.emulatorjs.org/stable/data/";
    window.EJS_color = "#00f5d4";
    window.EJS_startOnLoaded = true;
    window.EJS_gameName = title;
    window.EJS_fullscreenOnLoaded = false;
    window.EJS_gameID = Date.now();

    const s = document.createElement("script");
    s.src = "https://cdn.emulatorjs.org/stable/data/loader.js";
    s.onerror = function () {
      playTitle.textContent = "Failed to load EmulatorJS (check network / CDN)";
    };
    document.body.appendChild(s);
  }

  playCustomBtn.addEventListener("click", () => {
    if (!selectedFile) return;
    const core = customCore.value;
    const title = selectedFile.name.replace(/\.[^/.]+$/, "") || "Custom ROM";
    startCustomRom(selectedFile, core, title);
  });

  function closeOverlay() {
    playOverlay.classList.add("hidden");
    document.body.style.overflow = "";
    playBox.innerHTML = "";
    if (currentBlobUrl) {
      try { URL.revokeObjectURL(currentBlobUrl); } catch (_) {}
      currentBlobUrl = null;
    }
  }

  closePlayBtn.addEventListener("click", closeOverlay);

  fsPlayBtn.addEventListener("click", () => {
    const el = document.querySelector(".play-emulator-box");
    if (!el) return;
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !playOverlay.classList.contains("hidden")) {
      closeOverlay();
    }
  });

  renderGames();
})();
