/* src/debug.js
   Attach engine internals for debugging in dev consoles.
*/
import Engine from './engine.js';

window.__ENGINE__ = {
  get state() { return Engine._state; },
  get config() { return Engine._config; },
  start: (...a) => Engine.startGame(...a),
  stop: () => Engine.stopAndClearGame()
};