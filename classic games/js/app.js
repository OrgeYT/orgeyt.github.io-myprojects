(function () {
  const grid = document.getElementById("games-grid");
  const tabsNav = document.getElementById("system-tabs");

  let GAMES = [];
  let SYSTEMS = {};
  let currentSystem = "all";

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
      description: raw.description || ""
    };
  }

  function systemLabel(sys) {
    if (SYSTEMS[sys] && SYSTEMS[sys].label) return SYSTEMS[sys].label;
    const map = { nes: "NES", snes: "SNES", genesis: "Genesis", sms: "SMS" };
    return map[sys] || sys.toUpperCase();
  }

  function buildTabs() {
    // Keep All + Hacks; insert system tabs between them
    const allBtn = tabsNav.querySelector('[data-system="all"]');
    const hacksBtn = tabsNav.querySelector('[data-system="hacks"]');

    // Remove any previously injected system tabs
    tabsNav.querySelectorAll(".tab[data-system]").forEach((btn) => {
      const s = btn.dataset.system;
      if (s !== "all" && s !== "hacks") btn.remove();
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
          : GAMES.filter((g) => g.system === currentSystem);

    grid.innerHTML = "";

    if (!filtered.length) {
      grid.innerHTML = '<p class="loading-msg">No games in this section.</p>';
      return;
    }

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

  fetch("roms.json")
    .then((r) => {
      if (!r.ok) throw new Error("Could not load roms.json");
      return r.json();
    })
    .then((data) => {
      SYSTEMS = data.systems || {};
      GAMES = (data.games || []).map(resolveGame);
      // Expose for play.html / debugging
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
