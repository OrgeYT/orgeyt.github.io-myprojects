(function () {
  const grid = document.getElementById("games-grid");
  const tabs = document.querySelectorAll(".tab");
  const customCore = document.getElementById("custom-core");
  const customFile = document.getElementById("custom-rom-file");
  const fileNameEl = document.getElementById("file-name");
  const playCustomBtn = document.getElementById("play-custom-btn");

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

  // Custom ROM upload
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

  playCustomBtn.addEventListener("click", () => {
    if (!selectedFile) return;

    const core = customCore.value;
    const title = selectedFile.name.replace(/\.[^/.]+$/, "") || "Custom ROM";
    const objectUrl = URL.createObjectURL(selectedFile);

    // Store in sessionStorage so play.html can pick it up (blob URLs work same-origin)
    sessionStorage.setItem(
      "customRom",
      JSON.stringify({
        core: core,
        title: title,
        romUrl: objectUrl,
        fileName: selectedFile.name
      })
    );

    window.location.href = "play.html?custom=1";
  });

  renderGames();
})();
