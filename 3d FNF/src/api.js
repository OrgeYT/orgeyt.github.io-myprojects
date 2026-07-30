/* src/api.js
   Expose simple start/stop helpers on window for quick testing.
*/
import Engine from './engine.js';

window.gameAPI = {
  startRandom: () => Engine.startGame(),
  stop: () => Engine.stopAndClearGame(),
  generateChart: (s, n) => Engine.generateRandomChart(s, n)
};