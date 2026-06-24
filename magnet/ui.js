/* UI wiring: DOM hooks, input handling and event routing */
import { updateMagneticStrength, ENV } from './physics.js';
import { setDraggingMagnet, Wall } from './entities.js';

export function initUI({ onResize, onSpawn, onChain, onReset, getState, setDragging }) {
  const canvasEl = document.getElementById('canvas');
  const gameWrapper = document.getElementById('game-wrapper');
  const strengthSlider = document.getElementById('strength-slider');
  const strengthDisplay = document.getElementById('strength-val');
  const toggleBtn = document.getElementById('toggle-ui-btn');
  const toggleIcon = document.getElementById('toggle-icon');

  function resize() {
    canvasEl.width = gameWrapper.clientWidth;
    canvasEl.height = gameWrapper.clientHeight;
    if (onResize) onResize();
  }
  window.addEventListener('resize', resize);
  resize();

  let sidebarOpen = true;
  toggleBtn.addEventListener('click', () => {
    sidebarOpen = !sidebarOpen;
    document.getElementById('sidebar').classList.toggle('collapsed');
    toggleIcon.style.transform = sidebarOpen ? "rotate(0deg)" : "rotate(180deg)";
    setTimeout(resize, 350);
  });

  strengthSlider.oninput = function() {
    updateMagneticStrength(parseInt(this.value));
    if (ENV.globalMagneticStrength < 1200) strengthDisplay.innerText = "Low";
    else if (ENV.globalMagneticStrength < 3000) strengthDisplay.innerText = "Med";
    else if (ENV.globalMagneticStrength < 5500) strengthDisplay.innerText = "High";
    else strengthDisplay.innerText = "Extreme";
  };

  document.querySelectorAll('[data-action="spawn"]').forEach(btn => {
    btn.addEventListener('click', () => onSpawn(btn.dataset.type));
  });
  document.querySelector('[data-action="chain"]').addEventListener('click', onChain);
  document.getElementById('reset-btn').addEventListener('click', onReset);

  // simplified interaction wiring: drag / spawn / remove modes
  let interactionMode = 'drag';
  const lastMousePos = { x: 0, y: 0 };
  let dragOffset = { x: 0, y: 0 };
  let mouseVelocity = { x: 0, y: 0 };

  function setMode(mode) {
    interactionMode = (interactionMode === mode) ? 'drag' : mode;
    const btns = [
      { id: 'wall-n', el: document.getElementById('wall-n-btn') },
      { id: 'wall-s', el: document.getElementById('wall-s-btn') },
      { id: 'wall-plain', el: document.getElementById('wall-plain-btn') },
      { id: 'remove-wall', el: document.getElementById('remove-btn') },
      { id: 'remove-mag', el: document.getElementById('rem-mag-btn') }
    ];
    btns.forEach(b => b.el.classList.toggle('active', interactionMode === b.id));
  }
  document.querySelectorAll('[data-action="mode"]').forEach(btn => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  });

  function getCanvasPos(e) {
    const rect = canvasEl.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: cx - rect.left, y: cy - rect.top };
  }

  function onStart(e) {
    const pos = getCanvasPos(e);
    const state = getState();
    if (interactionMode === 'drag') {
      for (let i = state.magnets.length - 1; i >= 0; i--) {
        const m = state.magnets[i];
        if (Math.abs(pos.x - m.x) < m.width/2 && Math.abs(pos.y - m.y) < m.height/2) {
          setDragging(m);
          dragOffset = { x: pos.x - m.x, y: pos.y - m.y };
          return;
        }
      }
    } else if (interactionMode === 'remove-wall') {
      // remove walls under cursor
      const newWalls = state.walls.filter(w => Math.sqrt((pos.x-w.x)**2 + (pos.y-w.y)**2) > w.size/2);
      state.walls.length = 0; state.walls.push(...newWalls);
    } else if (interactionMode === 'remove-mag') {
      const newM = state.magnets.filter(m => Math.sqrt((pos.x-m.x)**2 + (pos.y-m.y)**2) > 30);
      state.magnets.length = 0; state.magnets.push(...newM);
    } else if (interactionMode.startsWith('wall-')) {
      const type = interactionMode.split('-')[1];
      state.walls.push(new Wall(pos.x, pos.y, type === 'n' ? 'north' : (type === 's' ? 'south' : 'plain')));
    }
  }

  function onMove(e) {
    const pos = getCanvasPos(e);
    mouseVelocity.x = pos.x - lastMousePos.x; mouseVelocity.y = pos.y - lastMousePos.y;
    lastMousePos.x = pos.x; lastMousePos.y = pos.y;
    const state = getState();
    if (state.draggingMagnet) {
      state.draggingMagnet.x = pos.x - dragOffset.x;
      state.draggingMagnet.y = pos.y - dragOffset.y;
      state.draggingMagnet.vx = 0; state.draggingMagnet.vy = 0; state.draggingMagnet.va = 0;
    }
  }

  canvasEl.addEventListener('mousedown', onStart);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', () => {
    const state = getState();
    if (state.draggingMagnet) {
      state.draggingMagnet.vx = mouseVelocity.x;
      state.draggingMagnet.vy = mouseVelocity.y;
    }
    setDragging(null);
  });
  canvasEl.addEventListener('touchstart', (e) => { e.preventDefault(); onStart(e); }, { passive:false });
  window.addEventListener('touchmove', (e) => { e.preventDefault(); onMove(e); }, { passive:false });
  window.addEventListener('touchend', () => {
    const state = getState();
    if (state.draggingMagnet) {
      state.draggingMagnet.vx = mouseVelocity.x;
      state.draggingMagnet.vy = mouseVelocity.y;
    }
    setDragging(null);
  });

  return { resize };
};