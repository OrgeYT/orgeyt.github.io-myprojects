const CHARACTERS = [
  { id: 'heart-kinded-noob', name: 'Heart Kinded Noob', file: 'svgs/heart-kinded-noob.svg', target: '#ffee54' },
  { id: 'longname',          name: 'Longname',          file: 'svgs/longname.svg',          target: '#000000' },
  { id: 'ajax',              name: 'Ajax',              file: 'svgs/ajax.svg',              target: '#ff0000' },
  { id: 'bizblock',          name: 'BizBlock',          file: 'svgs/bizblock.svg',          target: '#222222' },
  { id: 'orge',              name: 'Orge',              file: 'svgs/orge.svg',              target: '#ff8500' },
  { id: 'flying-car',        name: 'Flying Car',        file: 'svgs/flying-car.svg',        target: '#fc0000' },
  { id: 'swagyt',            name: 'SwagYT',            file: 'svgs/swagyt.svg',            target: '#005ba7' },
  { id: 'orgeyt',            name: 'OrgeYT',            file: 'svgs/orgeyt.svg',            target: '#ffad00' },
  { id: 'noob',              name: 'Noob',              file: 'svgs/noob.svg',              target: '#0072ff' },
  { id: 'scratch-cat',       name: 'Scratch Cat',       file: 'svgs/scratch-cat.svg',       target: '#ffab19' },
  { id: 'bradbot2020',       name: 'Bradbot2020',       file: 'svgs/bradbot2020.svg',       target: '#2b2b2b' },
];

let currentIndex = 0;
let scores = [];
let currentGuess = null;
let hasAccepted = false;

const startScreen   = document.getElementById('start-screen');
const gameScreen    = document.getElementById('game-screen');
const finalScreen   = document.getElementById('final-screen');
const startBtn      = document.getElementById('start-btn');
const charCounter   = document.getElementById('char-counter');
const progressFill  = document.getElementById('progress-fill');
const charName      = document.getElementById('char-name');
const prevBtn       = document.getElementById('prev-btn');
const nextNavBtn    = document.getElementById('next-nav-btn');
const charSelect    = document.getElementById('char-select');
const svgDisplay    = document.getElementById('svg-display');
const colorPicker   = document.getElementById('color-picker');
const hexInput      = document.getElementById('hex-input');
const bigSwatch     = document.getElementById('big-swatch');
const acceptBtn     = document.getElementById('accept-btn');
const resultPanel   = document.getElementById('result-panel');
const showGuessBtn  = document.getElementById('show-guess-btn');
const showOrigBtn   = document.getElementById('show-orig-btn');
const scorePercent  = document.getElementById('score-percent');
const guessSwatch   = document.getElementById('guess-swatch');
const origSwatch    = document.getElementById('orig-swatch');
const guessHex      = document.getElementById('guess-hex');
const origHex       = document.getElementById('orig-hex');
const feedbackMsg   = document.getElementById('feedback-msg');
const nextBtn       = document.getElementById('next-btn');
const finalPercent  = document.getElementById('final-percent');
const finalMessage  = document.getElementById('final-message');
const breakdown     = document.getElementById('breakdown');
const restartBtn    = document.getElementById('restart-btn');

function hexToRgb(hex) {
  hex = (hex || '').replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const num = parseInt(hex, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function colorAccuracy(guess, target) {
  const c1 = hexToRgb(guess);
  const c2 = hexToRgb(target);
  const dr = c1.r - c2.r, dg = c1.g - c2.g, db = c1.b - c2.b;
  const dist = Math.sqrt(dr*dr + dg*dg + db*db);
  const maxDist = 441.67;
  let pct = Math.max(0, 100 * (1 - dist / maxDist));
  if (dist < 12) pct = Math.min(100, pct + 8);
  if (dist < 4)  pct = 100;
  return Math.round(pct);
}

function getFeedback(pct) {
  if (pct >= 95) return 'Perfect match! 🎯';
  if (pct >= 85) return 'Excellent eye!';
  if (pct >= 70) return 'Really close!';
  if (pct >= 50) return 'Not bad!';
  if (pct >= 30) return 'A bit off…';
  return 'Oof, that was tough.';
}

function getFinalMessage(avg) {
  if (avg >= 90) return 'Legendary color sense!';
  if (avg >= 75) return 'Great job! You know these characters well.';
  if (avg >= 55) return 'Solid effort — a few more tries and you’d nail it.';
  if (avg >= 35) return 'The OrgeYT crew is mildly disappointed.';
  return 'Oof… maybe stick to black & white next time?';
}

function normalizeHex(val) {
  val = (val || '').trim().toLowerCase();
  if (!val.startsWith('#')) val = '#' + val;
  if (/^#[0-9a-f]{3}$/.test(val)) {
    val = '#' + val[1]+val[1] + val[2]+val[2] + val[3]+val[3];
  }
  return /^#[0-9a-f]{6}$/.test(val) ? val : null;
}

function setColorUI(hex) {
  colorPicker.value = hex;
  hexInput.value = hex.toUpperCase();
  bigSwatch.style.background = hex;
}

function applyFillInstantly(hex) {
  const liveSvg = svgDisplay.querySelector('svg');
  if (!liveSvg) return;
  liveSvg.querySelectorAll('path[data-target="1"]').forEach(p => {
    p.setAttribute('fill', hex);
  });
  currentGuess = hex;
}

async function loadCharacter(index) {
  currentIndex = index;
  const char = CHARACTERS[index];
  charName.textContent = char.name;
  charCounter.textContent = `${index + 1} / ${CHARACTERS.length}`;
  progressFill.style.width = `${(index / CHARACTERS.length) * 100}%`;
  charSelect.value = String(index);
  prevBtn.disabled = index === 0;
  nextNavBtn.disabled = index === CHARACTERS.length - 1;

  svgDisplay.innerHTML = '<p class="loading">Loading…</p>';
  resultPanel.classList.add('hidden');
  hasAccepted = false;
  acceptBtn.disabled = false;
  colorPicker.disabled = false;
  hexInput.disabled = false;

  // neutral starting color so the answer isn’t visible
  setColorUI('#9a9a9a');
  currentGuess = '#9a9a9a';

  try {
    const res = await fetch(char.file);
    const text = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'image/svg+xml');
    const svg = doc.documentElement;

    // set target shapes to neutral gray so user must guess
    svg.querySelectorAll('path[data-target="1"]').forEach(p => {
      p.setAttribute('fill', '#9a9a9a');
    });

    svgDisplay.innerHTML = '';
    const imported = document.importNode(svg, true);
    imported.removeAttribute('width');
    imported.removeAttribute('height');
    imported.style.maxWidth = '100%';
    imported.style.maxHeight = '400px';
    svgDisplay.appendChild(imported);
  } catch (e) {
    console.error(e);
    svgDisplay.innerHTML = `<p style="color:var(--danger)">Failed to load ${char.name}</p>`;
  }
}

function showResult() {
  const char = CHARACTERS[currentIndex];
  const pct = colorAccuracy(currentGuess, char.target);
  scores[currentIndex] = { name: char.name, pct, guess: currentGuess, target: char.target };

  scorePercent.textContent = pct + '%';
  scorePercent.className = 'score-value ' + (pct >= 75 ? 'high' : pct >= 45 ? 'mid' : 'low');

  guessSwatch.style.background = currentGuess;
  origSwatch.style.background = char.target;
  guessHex.textContent = currentGuess.toUpperCase();
  origHex.textContent = char.target.toUpperCase();
  feedbackMsg.textContent = getFeedback(pct);

  // Default to showing original after accept (but keep currentGuess as user's pick)
  const savedGuess = currentGuess;
  applyFillInstantly(char.target);
  currentGuess = savedGuess;
  showOrigBtn.classList.add('active');
  showGuessBtn.classList.remove('active');

  resultPanel.classList.remove('hidden');
  hasAccepted = true;
  colorPicker.disabled = true;
  hexInput.disabled = true;
  acceptBtn.disabled = true;
}



function nextCharacter() {
  // From result panel: go next, or finish if last
  if (currentIndex >= CHARACTERS.length - 1) {
    showFinal();
  } else {
    loadCharacter(currentIndex + 1);
  }
}

function goToCharacter(index) {
  if (index < 0 || index >= CHARACTERS.length) return;
  loadCharacter(index);
}

function showFinal() {
  gameScreen.classList.remove('active');
  finalScreen.classList.add('active');
  const valid = scores.filter(Boolean);
  const avg = valid.length ? Math.round(valid.reduce((a, s) => a + s.pct, 0) / valid.length) : 0;
  finalPercent.textContent = avg + '%';
  finalMessage.textContent = getFinalMessage(avg);
  breakdown.innerHTML = valid.map(s => `
    <div class="breakdown-item">
      <span class="name" title="${s.name}">${s.name}</span>
      <span class="pct" style="color:${s.pct >= 75 ? 'var(--success)' : s.pct >= 45 ? 'var(--warning)' : 'var(--danger)'}">${s.pct}%</span>
    </div>
  `).join('');
  progressFill.style.width = '100%';
}

function restart() {
  currentIndex = 0;
  scores = [];
  finalScreen.classList.remove('active');
  startScreen.classList.add('active');
}

// Events — color applies INSTANTLY
startBtn.addEventListener('click', () => {
  startScreen.classList.remove('active');
  gameScreen.classList.add('active');
  loadCharacter(0);
});

colorPicker.addEventListener('input', () => {
  const hex = colorPicker.value;
  setColorUI(hex);
  if (!hasAccepted) applyFillInstantly(hex);
});

hexInput.addEventListener('input', () => {
  const norm = normalizeHex(hexInput.value);
  if (norm) {
    colorPicker.value = norm;
    bigSwatch.style.background = norm;
    if (!hasAccepted) applyFillInstantly(norm);
  }
});

hexInput.addEventListener('change', () => {
  const norm = normalizeHex(hexInput.value);
  if (norm) {
    setColorUI(norm);
    if (!hasAccepted) applyFillInstantly(norm);
  } else {
    hexInput.value = colorPicker.value.toUpperCase();
  }
});

acceptBtn.addEventListener('click', () => {
  if (!currentGuess) return;
  showResult();
});

nextBtn.addEventListener('click', nextCharacter);
restartBtn.addEventListener('click', restart);

prevBtn.addEventListener('click', () => goToCharacter(currentIndex - 1));
nextNavBtn.addEventListener('click', () => goToCharacter(currentIndex + 1));
charSelect.addEventListener('change', () => {
  const idx = parseInt(charSelect.value, 10);
  if (!isNaN(idx)) goToCharacter(idx);
});

// Populate character dropdown
CHARACTERS.forEach((c, i) => {
  const opt = document.createElement('option');
  opt.value = String(i);
  opt.textContent = `${i + 1}. ${c.name}`;
  charSelect.appendChild(opt);
});

showGuessBtn.addEventListener('click', () => {
  if (!hasAccepted || !currentGuess) return;
  const liveSvg = svgDisplay.querySelector('svg');
  if (liveSvg) {
    liveSvg.querySelectorAll('path[data-target="1"]').forEach(p => p.setAttribute('fill', currentGuess));
  }
  showGuessBtn.classList.add('active');
  showOrigBtn.classList.remove('active');
});

showOrigBtn.addEventListener('click', () => {
  if (!hasAccepted) return;
  const char = CHARACTERS[currentIndex];
  const liveSvg = svgDisplay.querySelector('svg');
  if (liveSvg) {
    liveSvg.querySelectorAll('path[data-target="1"]').forEach(p => p.setAttribute('fill', char.target));
  }
  showOrigBtn.classList.add('active');
  showGuessBtn.classList.remove('active');
});

setColorUI('#9a9a9a');
