(function () {
  const grid = document.getElementById("games-grid");
  const tabs = document.querySelectorAll(".tab");
  const customCore = document.getElementById("custom-core");
  const customFile = document.getElementById("custom-rom-file");
  const fileNameEl = document.getElementById("file-name");
  const playCustomBtn = document.getElementById("play-custom-btn");
  const playOverlay = document.getElementById("play-overlay");
  const playTitle = document.getElementById("play-title");
  const playGame = document.getElementById("play-game");
  const closePlayBtn = document.getElementById("close-play-btn");
  const fsPlayBtn = document.getElementById("fs-play-btn");

  let currentSystem = "all";
  let selectedFile = null;

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

  function clearEmulator() {
    playGame.innerHTML = "";
    const keys = Object.keys(window).filter((k) => k.startsWith("EJS_"));
    keys.forEach((k) => {
      try { delete window[k]; } catch (_) {}
    });
  }

  function startCustomRom(file, core, title) {
    clearEmulator();

    playTitle.textContent = title;
    playOverlay.classList.remove("hidden");
    document.body.style.overflow = "hidden";

    // EmulatorJS accepts a File/Blob directly — avoids network fetch / Network error
    window.EJS_player = "#play-game";
    window.EJS_core = core;
    window.EJS_gameUrl = file;
    window.EJS_pathtodata = "https://cdn.emulatorjs.org/stable/data/";
    window.EJS_color = "#00f5d4";
    window.EJS_startOnLoaded = true;
    window.EJS_gameName = title;
    window.EJS_fullscreenOnLoaded = false;

    const s = document.createElement("script");
    s.src = "https://cdn.emulatorjs.org/stable/data/loader.js";
    s.async = true;
    s.onerror = function () {
      playTitle.textContent = "Failed to load emulator";
    };
    document.body.appendChild(s);
  }

  playCustomBtn.addEventListener("click", () => {
    if (!selectedFile) return;
    const core = customCore.value;
    const title = selectedFile.name.replace(/\.[^/.]+$/, "") || "Custom ROM";
    startCustomRom(selectedFile, core, title);
  });

  closePlayBtn.addEventListener("click", () => {
    playOverlay.classList.add("hidden");
    document.body.style.overflow = "";
    clearEmulator();
  });

  fsPlayBtn.addEventListener("click", () => {
    const el = document.querySelector(".play-emulator-box");
    if (!el) return;
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !playOverlay.classList.contains("hidden")) {
      closePlayBtn.click();
    }
  });

  renderGames();
})();
