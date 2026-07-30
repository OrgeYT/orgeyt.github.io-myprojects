/* src/events.js
   Misc runtime events (visibility, focus) to keep audio in sync and pause on blur.
   Added: global error/unhandled rejection handlers that freeze the game and show an error modal.
*/
import Engine from './engine.js';

window.addEventListener('visibilitychange', () => {
  const st = Engine._state;
  if (document.hidden && st.isPlaying && !st.isPaused) {
    st.isPaused = true;
    if (st.audioElements) st.audioElements.forEach(a => a.pause());
    const pm = document.getElementById('pause-modal');
    if (pm) pm.classList.add('active');
  } else if (!document.hidden && st.isPlaying && st.isPaused) {
    // do not auto-resume — keep paused but update HUD
    const infoP = document.querySelector('#ui-layer p');
    if (infoP) infoP.innerText = "Paused (Tab switch)";
  }
});

// Centralized freeze-and-show-error routine
function showFatalError(message) {
  try {
    // Pause engine and audio
    const st = Engine._state;
    if (st) {
      st.isPaused = true;
      st.isPlaying = false;
      if (st.audioElements) st.audioElements.forEach(a => { try { a.pause(); } catch(e){} });
    }

    // Show the pause modal as well to prevent further interaction
    const pauseModal = document.getElementById('pause-modal');
    if (pauseModal) pauseModal.classList.add('active');

    // Populate and show error modal
    const em = document.getElementById('error-message');
    const errModal = document.getElementById('error-modal');
    if (em) {
      em.innerText = message || 'Unknown error';
    }
    if (errModal) {
      errModal.style.display = 'flex';
    }

    // Also log to console for debugging
    console.error('Fatal game error:', message);
  } catch (e) {
    console.error('Error while showing fatal error modal:', e);
  }
}

// Catch synchronous exceptions
window.onerror = function(message, source, lineno, colno, error) {
  const msg = [
    `Message: ${message}`,
    source ? `Source: ${source}` : '',
    typeof lineno !== 'undefined' ? `Line: ${lineno}:${colno}` : '',
    error && error.stack ? `Stack: ${error.stack}` : ''
  ].filter(Boolean).join('\n');
  showFatalError(msg);
  // return false to let browser also report; we handled freeze
  return false;
};

// Catch unhandled promise rejections
window.addEventListener('unhandledrejection', function(evt) {
  const reason = evt && evt.reason ? (evt.reason.stack || evt.reason.message || String(evt.reason)) : 'Unhandled rejection';
  const msg = `UnhandledRejection: ${reason}`;
  showFatalError(msg);
});