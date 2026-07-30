/* src/boot.js
   Lightweight bootstrap that initializes the Engine when the window loads.
*/
import Engine from './engine.js';

window.addEventListener('load', () => {
  Engine.init();
});