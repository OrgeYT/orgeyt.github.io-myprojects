(function () {
  const grid = document.getElementById("games-grid");
  const tabs = document.querySelectorAll(".tab");

  let currentSystem = "all";

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
        </div>
      `;

      card.addEventListener("click", () => {
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

  renderGames();
})();
