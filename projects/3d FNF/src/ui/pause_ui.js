/* src/ui/pause_ui.js
   Pause modal wiring and injection of extra pause controls.
*/
export function wirePauseUI(config, state, hooks = {}, helpers = {}) {
  const pauseModal = document.getElementById('pause-modal');
  const btnPause = document.getElementById('btn-pause');
  const btnResume = document.getElementById('btn-resume');
  const btnRestart = document.getElementById('btn-restart');
  const btnExit = document.getElementById('btn-exit');
  const btnSave = document.getElementById('btn-save-settings');

  if (!btnPause) return;

  btnPause.addEventListener('click', () => {
    if (!state.isPlaying || state.isPaused) return;
    state.isPaused = true;
    if (state.audioElements) state.audioElements.forEach(a => a.pause());
    if (pauseModal) pauseModal.classList.add('active');

    config.keybinds.forEach((k, i) => {
      const el = document.getElementById(`bind-${i}`);
      if (el) el.value = k;
    });

    const sd = document.getElementById('scroll-dir');
    if (sd) sd.value = config.scrollDirection;

    const pauseBotEl = document.getElementById('pause-botplay');
    if (pauseBotEl) pauseBotEl.checked = state.botplay || config.botplay;
    const pauseScrollEl = document.getElementById('pause-scroll-mult');
    if (pauseScrollEl) pauseScrollEl.value = config.scrollMultiplier || 1;
  });

  btnResume && btnResume.addEventListener('click', () => {
    if (pauseModal) pauseModal.classList.remove('active');
    const three = state._three;
    if (three && three.clock) three.clock.getDelta();
    state.isPaused = false;
    if (state.audioElements) state.audioElements.forEach(a => a.play());
    try { window.focus(); } catch (e) {}
  });

  btnRestart && btnRestart.addEventListener('click', () => {
    if (state.currentCustomChart) {
      hooks.startGame && hooks.startGame(state.currentCustomChart, state.currentAudios);
    } else {
      hooks.startGame && hooks.startGame();
    }
  });

  btnExit && btnExit.addEventListener('click', () => location.reload());

  btnSave && btnSave.addEventListener('click', () => {
    for (let i = 0; i < 4; i++) {
      const val = document.getElementById(`bind-${i}`).value.toLowerCase();
      if (val) config.keybinds[i] = val;
    }
    const newScroll = document.getElementById('scroll-dir').value;
    if (newScroll !== config.scrollDirection) {
      config.scrollDirection = newScroll;
      config.receptorY = config.scrollDirection === 'up' ? 6 : -6;
      state.receptors.player.forEach(r => r.position.y = config.receptorY);
      state.receptors.opponent.forEach(r => r.position.y = config.receptorY);
    }

    const pauseBot = document.getElementById('pause-botplay');
    const pauseScrollMult = document.getElementById('pause-scroll-mult');
    if (pauseBot) {
      config.botplay = pauseBot.checked;
      state.botplay = pauseBot.checked;
    }
    if (pauseScrollMult) {
      const m = parseFloat(pauseScrollMult.value) || 1;
      config.scrollMultiplier = m;
      config.scrollSpeed = (config._baseScrollSpeed || config.scrollSpeed) * m;
    }
  });

  // inject pause modal extra controls if missing
  const pausePanel = document.querySelector('#pause-modal .border-t');
  if (pausePanel && !document.getElementById('pause-botplay')) {
    const container = document.createElement('div');
    container.className = 'border-t border-gray-700 pt-4 flex flex-col gap-3';
    container.innerHTML = `
      <div class="flex items-center justify-between">
        <label class="text-sm text-gray-300">Botplay</label>
        <input type="checkbox" id="pause-botplay" ${state.botplay || config.botplay ? 'checked' : ''}/>
      </div>
      <div class="flex items-center justify-between">
        <label class="text-sm text-gray-300">Scroll Speed ×</label>
        <input type="number" id="pause-scroll-mult" class="bg-gray-800 border border-gray-600 rounded p-2 text-white w-24" min="0.25" max="4" step="0.05" value="${config.scrollMultiplier || 1}">
      </div>
    `;
    pausePanel.parentNode.insertBefore(container, pausePanel.nextSibling);
  }
}