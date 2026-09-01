/* src/ui/title_ui.js
   Title screen controls and basic file inputs (play random, play custom, chart/audio inputs, title settings).
*/
export function wireTitleUI(config, state, hooks = {}, helpers = {}) {
  const btnPlayRandom = document.getElementById('btn-play-random');
  const btnPlayCustom = document.getElementById('btn-play-custom');
  const uploadChart = document.getElementById('upload-chart');
  const uploadAudio = document.getElementById('upload-audio');

  let loadedCustomChart = null;
  let loadedAudioFiles = [];

  btnPlayRandom && btnPlayRandom.addEventListener('click', () => hooks.startGame && hooks.startGame());

  function checkCustomReady() {
    if (!btnPlayCustom) return;
    if (loadedCustomChart && loadedAudioFiles.length > 0) {
      btnPlayCustom.disabled = false;
      btnPlayCustom.classList.remove('opacity-50', 'cursor-not-allowed');
      btnPlayCustom.classList.add('hover:shadow-blue-500/50');
    } else {
      btnPlayCustom.disabled = true;
      btnPlayCustom.classList.add('opacity-50', 'cursor-not-allowed');
      btnPlayCustom.classList.remove('hover:shadow-blue-500/50');
    }
  }

  // Title settings wiring
  const titleBot = document.getElementById('title-botplay');
  const titleScrollDir = document.getElementById('title-scroll-dir');
  const titleScrollMult = document.getElementById('title-scroll-mult');
  const titleBinds = [0,1,2,3].map(i => document.getElementById(`title-bind-${i}`));
  const titleApply = document.getElementById('title-apply-settings');

  if (titleBot) titleBot.checked = state.botplay || config.botplay;
  if (titleScrollDir) titleScrollDir.value = config.scrollDirection;
  if (titleScrollMult) titleScrollMult.value = config.scrollMultiplier || 1;
  for (let i=0;i<4;i++) if (titleBinds[i]) titleBinds[i].value = config.keybinds[i].toUpperCase();

  titleApply && titleApply.addEventListener('click', () => {
    for (let i = 0; i < 4; i++) {
      const el = titleBinds[i];
      if (el && el.value) config.keybinds[i] = el.value.toLowerCase();
    }
    if (titleBot) {
      config.botplay = titleBot.checked;
      state.botplay = titleBot.checked;
    }
    if (titleScrollDir) {
      const newScroll = titleScrollDir.value;
      if (newScroll !== config.scrollDirection) {
        config.scrollDirection = newScroll;
        config.receptorY = config.scrollDirection === 'up' ? 6 : -6;
        state.receptors.player.forEach(r => r.position.y = config.receptorY);
        state.receptors.opponent.forEach(r => r.position.y = config.receptorY);
      }
    }
    if (titleScrollMult) {
      const m = parseFloat(titleScrollMult.value) || 1;
      config.scrollMultiplier = m;
      config.scrollSpeed = (config._baseScrollSpeed || config.scrollSpeed) * m;
    }

    for (let i=0;i<4;i++) {
      const el = document.getElementById(`bind-${i}`);
      if (el) el.value = config.keybinds[i].toUpperCase();
    }
    const pauseBotEl = document.getElementById('pause-botplay');
    if (pauseBotEl) pauseBotEl.checked = state.botplay || config.botplay;
    const pauseScrollEl = document.getElementById('pause-scroll-mult');
    if (pauseScrollEl) pauseScrollEl.value = config.scrollMultiplier || 1;

    const infoP = document.querySelector('#ui-layer p');
    if (infoP) infoP.innerText = "Title settings applied";
  });

  // legacy chart JSON input
  uploadChart && uploadChart.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        loadedCustomChart = hooks.parsePsychChart ? hooks.parsePsychChart(json) : null;
        checkCustomReady();
      } catch (err) {
        alert("Error parsing JSON chart. Please ensure it's a valid Psych Engine format.");
        console.error(err);
      }
    };
    reader.readAsText(file);
  });

  // uploaded audio files
  uploadAudio && uploadAudio.addEventListener('change', (e) => {
    loadedAudioFiles = Array.from(e.target.files).slice(0, 3);
    checkCustomReady();
  });

  btnPlayCustom && btnPlayCustom.addEventListener('click', () => {
    // prefer local uploads, fall back to mod-loader-provided state values
    const chart = loadedCustomChart || (state && state.currentCustomChart) || null;
    const audioSources = (loadedAudioFiles && loadedAudioFiles.length > 0) ? loadedAudioFiles : ((state && state.currentAudios) || []);

    if (!chart) return;

    const audios = audioSources.map(item => {
      if (item instanceof Audio) return item;
      try {
        // if it's a File/Blob, create an object URL
        return new Audio(URL.createObjectURL(item));
      } catch (e) {
        if (typeof item === 'string') return new Audio(item);
        return null;
      }
    }).filter(Boolean);

    hooks.startGame && hooks.startGame(chart, audios);
  });

  // small UX niceties (keybind inputs)
  document.querySelectorAll('.keybind-input').forEach(input => {
    input.addEventListener('focus', function() { this.select(); });
    input.addEventListener('input', function() {
      if (this.value.length > 1) this.value = this.value[this.value.length - 1];
    });
  });
}