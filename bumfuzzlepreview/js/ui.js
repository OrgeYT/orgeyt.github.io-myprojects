// DOM wiring for buttons and top-level interactions
import { loadAssets, startGame, pauseGame, resumeGame, restartGame, gameState } from './game.js';

const loadingUI = document.getElementById('loading');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const pauseMenu = document.getElementById('pauseMenu');
const resumeBtn = document.getElementById('resumeBtn');
const restartBtn = document.getElementById('restartBtn');
const toStartBtn = document.getElementById('toStartBtn');

export async function initUI() {
  try {
    await loadAssets();

    // show loaded assets list
    const h1 = document.querySelector('#loading h1');
    if (h1) {
      h1.innerText = "Ready!";
      h1.classList.remove('animate-pulse');
    }

    // create assets list display
    const assetsContainer = document.createElement('div');
    assetsContainer.style.marginTop = '14px';
    assetsContainer.style.maxWidth = '80%';
    assetsContainer.style.textAlign = 'left';
    assetsContainer.style.background = 'rgba(0,0,0,0.04)';
    assetsContainer.style.padding = '12px 16px';
    assetsContainer.style.borderRadius = '12px';
    assetsContainer.style.boxShadow = '0 6px 18px rgba(0,0,0,0.06)';

    const title = document.createElement('div');
    title.innerText = "Loaded Assets:";
    title.style.fontWeight = '700';
    title.style.marginBottom = '8px';
    assetsContainer.appendChild(title);

    const list = document.createElement('ul');
    list.style.margin = '0';
    list.style.padding = '0';
    list.style.listStyle = 'none';
    list.style.maxHeight = '220px';
    list.style.overflow = 'auto';

    const assets = (gameState && gameState.loadedAssets) ? gameState.loadedAssets : [];
    assets.forEach(a => {
      const li = document.createElement('li');
      li.style.fontSize = '14px';
      li.style.padding = '6px 4px';
      li.style.borderBottom = '1px solid rgba(0,0,0,0.04)';
      li.innerText = (a.name ? a.name + " — " : "") + (a.url || a);
      list.appendChild(li);
    });

    if (assets.length === 0) {
      const li = document.createElement('li');
      li.style.fontSize = '14px';
      li.style.padding = '6px 4px';
      li.innerText = 'No asset metadata available.';
      list.appendChild(li);
    }

    assetsContainer.appendChild(list);
    loadingUI.appendChild(assetsContainer);

    startBtn.style.display = 'block';
  } catch (e) {
    const h1 = document.querySelector('#loading h1');
    if (h1) h1.innerText = "Error loading assets.";
    console.error(e);
  }

  startBtn.addEventListener('click', () => {
    loadingUI.style.display = 'none';
    pauseBtn.style.display = 'block';
    startGame();
  });

  pauseBtn.addEventListener('click', () => {
    pauseGame();
    pauseBtn.style.display = 'none';
    pauseMenu.style.display = 'flex';
  });

  resumeBtn.addEventListener('click', () => {
    resumeGame();
    pauseMenu.style.display = 'none';
    pauseBtn.style.display = 'block';
  });

  restartBtn.addEventListener('click', () => {
    restartGame();
    pauseMenu.style.display = 'none';
    pauseBtn.style.display = 'block';
  });

  // go back to main menu (refresh to reset state)
  toStartBtn.addEventListener('click', () => {
    // stop audio if playing to avoid lingering sound during reload
    try {
      if (window.instAudio) { window.instAudio.pause(); window.instAudio.currentTime = 0; }
      if (window.oppVoicesAudio) { window.oppVoicesAudio.pause(); window.oppVoicesAudio.currentTime = 0; }
      if (window.bfVoicesAudio) { window.bfVoicesAudio.pause(); window.bfVoicesAudio.currentTime = 0; }
    } catch (e) {
      // ignore if not accessible
    }
    // show main menu by reloading page (resets UI and game state)
    location.reload();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      // toggle by checking visibility
      if (pauseMenu.style.display === 'flex') {
        resumeBtn.click();
      } else if (pauseBtn.style.display !== 'none') {
        pauseBtn.click();
      }
    }
  });
}