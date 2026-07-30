/* src/ui/ui_main.js
   Refactored UI delegator. Specific UI responsibilities were moved to smaller modules:
     - src/ui/title_ui.js
     - src/ui/pause_ui.js
     - src/ui/mod_loader.js
   Tombstones: larger functions were removed and are now implemented in submodules.
     // removed large monolithic wireUI() { ... }
     // removed in-file mod ZIP handling {}
     // removed pause modal injection {}
     // removed title-screen wiring {}
*/
import { wireTitleUI } from './title_ui.js';
import { wirePauseUI } from './pause_ui.js';
import { wireModLoader } from './mod_loader.js';

// small shared helpers retained here
function showJudgment(text, color) {
  const el = document.getElementById('judgment-display');
  if (!el) return;
  el.innerText = text;
  el.style.color = color;
  el.classList.remove('pop-anim');
  void el.offsetWidth;
  el.classList.add('pop-anim');
}

function updateHUD(state) {
  const s = document.getElementById('score-display');
  const c = document.getElementById('combo-display');
  const m = document.getElementById('misses-display');
  const a = document.getElementById('accuracy-display');
  if (s) s.innerText = `Score: ${state.score}`;
  if (c) c.innerText = `Combo: ${state.combo}`;
  if (m) m.innerText = `Misses: ${state.stats ? state.stats.miss : 0}`;

  if (a && state.stats) {
    const total = state.stats.totalNotes || 0;
    const weighted = ((state.stats.sick || 0) * 1.0) + ((state.stats.good || 0) * 0.66) + ((state.stats.bad || 0) * 0.33);
    const acc = total > 0 ? Math.round((weighted / total) * 100) : 100;
    a.innerText = `Accuracy: ${isFinite(acc) ? acc : 0}%`;
  }
}

function resetCombo(state) {
  state.combo = 0;
  updateHUD(state);
}

// top-level wireUI delegates to focused modules to keep code manageable
function wireUI(config, state, hooks = {}) {
  // wire title-screen controls (play random, title settings, chart file input, play custom button)
  wireTitleUI(config, state, hooks, { showJudgment, updateHUD, resetCombo });

  // wire pause modal & its controls
  wirePauseUI(config, state, hooks, { showJudgment, updateHUD, resetCombo });

  // wire the mod zip loader (chooser-based flow)
  wireModLoader(config, state, hooks, { showJudgment, updateHUD, resetCombo });
}

export default {
  wireUI,
  showJudgment,
  updateHUD,
  resetCombo
};