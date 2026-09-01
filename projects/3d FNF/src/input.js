/* src/input.js
   Keyboard wiring extracted. Keeps pressed keys and delegates to Notes.
   Added: Enter key toggles pause/resume during gameplay.
*/
const Input = (() => {
  const pressedKeys = new Set();

  function wireInput(config, state, hooks = {}) {
    function onKeyDown(e) {
      const titleVisible = document.getElementById('title-screen').style.display !== 'none';

      // If Enter is pressed while in-game, toggle pause/resume
      if (!titleVisible && state.isPlaying && e.key === 'Enter') {
        state.isPaused = !state.isPaused;
        const pauseModal = document.getElementById('pause-modal');
        if (state.isPaused) {
          // Pausing: stop audio and show modal
          if (state.audioElements) state.audioElements.forEach(a => a.pause());
          if (pauseModal) pauseModal.classList.add('active');
        } else {
          // Resuming: hide modal, sync clock, resume audio
          if (pauseModal) pauseModal.classList.remove('active');
          const three = state._three;
          if (three && three.clock) three.clock.getDelta();
          if (state.audioElements) state.audioElements.forEach(a => a.play());
          // ensure window focus for input
          try { window.focus(); } catch (e) {}
        }
        return;
      }

      if (titleVisible || state.isPaused) return;

      if (e.key === ' ' && !state.isPlaying) {
        if (state.currentCustomChart) {
          hooks.startGame && hooks.startGame(state.currentCustomChart, state.currentAudios);
        } else {
          hooks.startGame && hooks.startGame();
        }
        return;
      }

      if (!state.isPlaying) return;

      const key = e.key.toLowerCase();
      if (pressedKeys.has(key)) return;
      pressedKeys.add(key);

      const laneIndex = config.keybinds.indexOf(key);
      if (laneIndex !== -1) {
        state.keysHeld[laneIndex] = true;
        hooks.handlePlayerInput && hooks.handlePlayerInput(laneIndex);
      }
    }

    function onKeyUp(e) {
      const key = e.key.toLowerCase();
      pressedKeys.delete(key);

      const laneIndex = config.keybinds.indexOf(key);
      if (laneIndex !== -1) {
        state.keysHeld[laneIndex] = false;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
  }

  return { wireInput };
})();

export default Input;