/* Game logic (split from original scripts.js). Relies on playSound() from audio.js */

 // State variables
const TOTAL_QUESTIONS = 15; // updated total questions (now includes Q12, Q13, Q14 & Q15)
let lives = 3;
let currentQuestion = 1;
let temporaryFailCount = 0; // For tracking Q9 ball progression

// DOM elements
const gameWindow = document.getElementById('game-window');
const questionNumber = document.getElementById('question-number');
const questionBox = document.getElementById('question-box');
const livesContainer = document.getElementById('lives-container');
const quizMessage = document.getElementById('quiz-message');
const gameOverOverlay = document.getElementById('game-over-overlay');
const winOverlay = document.getElementById('win-overlay');
const restartBtn = document.getElementById('restart-btn');
const playAgainBtn = document.getElementById('play-again-btn');

// Dev tool elements
const devModal = document.getElementById('dev-modal');
const devLevelInput = document.getElementById('dev-level-input');
const devGoBtn = document.getElementById('dev-go-btn');
const devCloseBtn = document.getElementById('dev-close-btn');

// Cheat code buffer
let keyBuffer = '';

// Initial setup
function initGame() {
  lives = 3;
  currentQuestion = 1;
  temporaryFailCount = 0;
  gameOverOverlay.classList.add('hidden');
  winOverlay.classList.add('hidden');
  renderLives();
  loadQuestion();
}

function renderLives() {
  livesContainer.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const heart = document.createElement('span');
    heart.className = `text-2xl transition-all duration-300 ${i < lives ? 'text-red-500 opacity-100 scale-100' : 'text-slate-700 opacity-40 scale-75'}`;
    heart.innerHTML = '❤️';
    livesContainer.appendChild(heart);
  }
}

function flashRed() {
  gameWindow.classList.add('border-red-600', 'bg-red-950/20', 'shake-screen');
  setTimeout(() => gameWindow.classList.remove('border-red-600', 'bg-red-950/20', 'shake-screen'), 400);
}

function flashGreen() {
  gameWindow.classList.add('border-green-500', 'bg-green-950/20');
  setTimeout(() => gameWindow.classList.remove('border-green-500', 'bg-green-950/20'), 400);
}

function loseLife(message = "WRONG!") {
  lives--;
  playSound('wrong');
  flashRed();
  renderLives();

  quizMessage.innerText = message;
  setTimeout(() => { quizMessage.innerText = ''; }, 1800);

  if (lives <= 0) {
    gameOverOverlay.classList.remove('hidden');
  } else {
    loadQuestion(); // Reset current question on fail
  }
}

function nextQuestion() {
  playSound('correct');
  flashGreen();
  currentQuestion++;
  if (currentQuestion > TOTAL_QUESTIONS) triggerWin();
  else loadQuestion();
}

function triggerWin() {
  playSound('victory');
  winOverlay.classList.remove('hidden');
}

// Global key listeners for key-based questions and dev tools
document.addEventListener('keydown', (e) => {
  // Q4 Handle physical Enter press
  if (currentQuestion === 4 && e.key === 'Enter') {
    e.preventDefault();
    nextQuestion();
  }
  // Q7 Handle physical 4 press
  if (currentQuestion === 7 && e.key === '4') nextQuestion();

  // Dev Tool cheat code: type "levelselect"
  if (e.key && e.key.length === 1) {
    keyBuffer += e.key.toLowerCase();
    if (keyBuffer.length > 11) keyBuffer = keyBuffer.slice(-11);
    if (keyBuffer === 'levelselect') {
      devModal.classList.remove('hidden');
      devLevelInput.value = '';
      devLevelInput.focus();
      keyBuffer = '';
    }
  }
});

// Dev tool level select logic
devGoBtn.addEventListener('click', () => {
  const lvl = parseInt(devLevelInput.value);
  if (lvl >= 1 && lvl <= TOTAL_QUESTIONS) {
    currentQuestion = lvl;
    temporaryFailCount = 0;
    devModal.classList.add('hidden');
    gameOverOverlay.classList.add('hidden');
    winOverlay.classList.add('hidden');
    loadQuestion();
  } else {
    devLevelInput.value = '';
  }
});

devCloseBtn.addEventListener('click', () => {
  devModal.classList.add('hidden');
  keyBuffer = '';
});

// Question Loader Factory
function loadQuestion() {
  if (window.question6Timer) clearInterval(window.question6Timer);

  // Ensure two-digit question display and use configured total
  const qNum = String(currentQuestion).padStart(2, '0');
  questionNumber.innerText = `QUESTION ${qNum}/${String(TOTAL_QUESTIONS).padStart(2, '0')}`;
  questionBox.innerHTML = '';

  switch (currentQuestion) {
    case 1: setupQ1(); break;
    case 2: setupQ2(); break;
    case 3: setupQ3(); break;
    case 4: setupQ4(); break;
    case 5: setupQ5(); break;
    case 6: setupQ6(); break;
    case 7: setupQ7(); break;
    case 8: setupQ8(); break;
    case 9: setupQ9(); break;
    case 10: setupQ10(); break;
    case 11: setupQ11(); break;
    case 12: setupQ12(); break;
    case 13: setupQ13(); break;
    case 14: setupQ14(); break;
    case 15: setupQ15(); break;
  }
}

/* ================= QUESTION SECTIONS ================= */

// Q1
function setupQ1() {
  questionBox.innerHTML = `
    <div class="text-center mb-6">
      <p class="text-xl sm:text-2xl font-bold">What is 2 and 5 put together?</p>
    </div>
    <div class="grid grid-cols-2 gap-4 w-full max-w-md">
      <button class="choice-btn py-3 px-6 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold border-2 border-slate-500 hover:scale-[1.02] active:scale-[0.98] transition-all" data-correct="false">7</button>
      <button class="choice-btn py-3 px-6 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold border-2 border-slate-500 hover:scale-[1.02] active:scale-[0.98] transition-all" data-correct="true">25</button>
      <button class="choice-btn py-3 px-6 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold border-2 border-slate-500 hover:scale-[1.02] active:scale-[0.98] transition-all" data-correct="false">10</button>
      <button class="choice-btn py-3 px-6 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold border-2 border-slate-500 hover:scale-[1.02] active:scale-[0.98] transition-all" data-correct="false">2.5</button>
    </div>
  `;
  attachStandardListeners();
}

// Q2
function setupQ2() {
  questionBox.innerHTML = `
    <div class="text-center mb-6 px-4">
      <p class="text-lg sm:text-xl font-bold break-all">What is (1000 + 500 × 487,460 - 56,855 / 4,857,345 × 58,674,886) / 0?</p>
    </div>
    <div class="grid grid-cols-2 gap-4 w-full max-w-md">
      <button class="choice-btn py-3 px-6 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold border-2 border-slate-500 hover:scale-[1.02] active:scale-[0.98] transition-all" data-correct="false">Undefined</button>
      <button class="choice-btn py-3 px-6 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold border-2 border-slate-500 hover:scale-[1.02] active:scale-[0.98] transition-all" data-correct="false">Infinity</button>
      <button class="choice-btn py-3 px-6 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold border-2 border-slate-500 hover:scale-[1.02] active:scale-[0.98] transition-all" data-correct="true">0</button>
      <button class="choice-btn py-3 px-6 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold border-2 border-slate-500 hover:scale-[1.02] active:scale-[0.98] transition-all" data-correct="false">Error</button>
    </div>
  `;
  attachStandardListeners();
}

// Q3
function setupQ3() {
  questionBox.innerHTML = `
    <div class="text-center mb-4">
      <p class="text-xl sm:text-2xl font-bold">What color is my ball?</p>
    </div>
    <div id="magic-ball" class="w-20 h-20 rounded-full bg-stone-500 border-4 border-white mb-6 transition-all duration-150 shadow-inner"></div>
    <div class="grid grid-cols-2 gap-4 w-full max-w-md">
      <button class="color-hover-btn py-3 px-6 bg-slate-700 hover:bg-red-900 rounded-xl font-bold border-2 border-slate-500 transition-all" data-color="Red">Red</button>
      <button class="color-hover-btn py-3 px-6 bg-slate-700 hover:bg-blue-900 rounded-xl font-bold border-2 border-slate-500 transition-all" data-color="Blue">Blue</button>
      <button class="color-hover-btn py-3 px-6 bg-slate-700 hover:bg-green-900 rounded-xl font-bold border-2 border-slate-500 transition-all" data-color="Green">Green</button>
      <button class="color-hover-btn py-3 px-6 bg-slate-700 hover:bg-purple-900 rounded-xl font-bold border-2 border-slate-500 transition-all" data-color="Purple">Purple</button>
    </div>
  `;

  const ball = document.getElementById('magic-ball');
  const buttons = questionBox.querySelectorAll('.color-hover-btn');
  let hoverCount = 0;
  const colors = ['Red', 'Blue', 'Green', 'Purple'];
  const colorMap = {
    'Red': 'bg-red-500',
    'Blue': 'bg-blue-500',
    'Green': 'bg-green-500',
    'Purple': 'bg-purple-500'
  };

  ball.className = "w-20 h-20 rounded-full border-4 border-white mb-6 transition-all duration-150 shadow-inner bg-yellow-500";

  buttons.forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      hoverCount++;
      playSound('click');

      if (hoverCount < 10) {
        const selfColor = btn.getAttribute('data-color');
        const possibleColors = colors.filter(c => c !== selfColor);
        const randomColor = possibleColors[Math.floor(Math.random() * possibleColors.length)];
        ball.className = "w-20 h-20 rounded-full border-4 border-white mb-6 transition-all duration-150 shadow-inner " + colorMap[randomColor];
      } else {
        ball.className = "w-20 h-20 rounded-full border-4 border-white mb-6 transition-all duration-150 shadow-inner bg-purple-500";
      }
    });

    btn.addEventListener('click', () => {
      const chosenColor = btn.getAttribute('data-color');
      if (hoverCount >= 10 && chosenColor === 'Purple') nextQuestion();
      else loseLife("It keeps changing! Wait till it stops!");
    });
  });
}

// Q4
function setupQ4() {
  questionBox.innerHTML = `
    <div class="text-center mb-6">
      <p class="text-xl sm:text-2xl font-bold">Press enter key</p>
      <p class="text-xs text-slate-400 mt-2">(Use your interactive device correctly)</p>
    </div>
    <div class="w-full h-48 relative overflow-hidden bg-slate-900/50 rounded-xl border-2 border-slate-700" id="evasive-container">
      <button id="evasive-btn" class="absolute py-2 px-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold border-2 border-white shadow-lg select-none whitespace-nowrap" style="top: 40%; left: 40%;">Enter Key</button>
    </div>
  `;

  const btn = document.getElementById('evasive-btn');
  const container = document.getElementById('evasive-container');

  btn.addEventListener('mouseenter', () => {
    playSound('click');
    const containerRect = container.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const maxX = Math.max(10, containerRect.width - btnRect.width - 10);
    const maxY = Math.max(10, containerRect.height - btnRect.height - 10);
    const newX = Math.max(10, Math.floor(Math.random() * maxX));
    const newY = Math.max(10, Math.floor(Math.random() * maxY));
    btn.style.left = `${newX}px`;
    btn.style.top = `${newY}px`;
  });

  btn.addEventListener('click', () => {
    loseLife("Cheater! Or lucky... but still wrong! Try your keyboard!");
  });
}

// Q5
function setupQ5() {
  questionBox.innerHTML = `
    <div class="text-center mb-4">
      <p class="text-lg sm:text-xl font-bold">Put your cursor on START, then reach the GOAL!</p>
      <p class="text-xs text-slate-400">Warning: The red line blocks you. Find another way...</p>
    </div>

    <div class="relative w-full h-64 bg-slate-950 border-4 border-slate-700 rounded-xl overflow-visible flex justify-between items-center px-8" id="maze-container">
      <div id="maze-wall" class="absolute inset-y-0 left-[48%] w-[4%] bg-red-600 border-x-2 border-red-400 hidden flex items-center justify-center">
        <span class="text-white text-[10px] uppercase font-bold tracking-widest rotate-90 whitespace-nowrap">WALL</span>
      </div>

      <div id="start-dot" class="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center font-bold text-xs text-black cursor-pointer shadow-lg animate-pulse z-10 hover:scale-105 transition-transform">START</div>

      <div id="goal-dot" class="w-12 h-12 bg-blue-500 opacity-20 rounded-full flex items-center justify-center font-bold text-[10px] text-white z-10 pointer-events-none transition-all duration-300">GOAL</div>
    </div>
  `;

  const startDot = document.getElementById('start-dot');
  const goalDot = document.getElementById('goal-dot');
  const mazeWall = document.getElementById('maze-wall');
  const mazeContainer = document.getElementById('maze-container');

  let challengeActive = false;

  startDot.addEventListener('mouseenter', () => {
    if (!challengeActive) {
      challengeActive = true;
      playSound('click');
      mazeWall.classList.remove('hidden');
      goalDot.classList.remove('opacity-20');
      goalDot.classList.add('bg-green-500', 'animate-pulse');
      goalDot.classList.remove('pointer-events-none');
      quizMessage.innerText = "CHALLENGE ACTIVE! DON'T TOUCH RED!";
    }
  });

  mazeWall.addEventListener('mouseenter', () => {
    if (challengeActive) resetChallenge("You touched the Wall!");
  });

  goalDot.addEventListener('mouseenter', () => {
    if (challengeActive) nextQuestion();
  });

  mazeContainer.addEventListener('mousemove', (e) => {
    if (!challengeActive) return;
    const containerRect = mazeContainer.getBoundingClientRect();
    const mouseXInContainer = e.clientX - containerRect.left;
    const wallLeft = containerRect.width * 0.45;
    const wallRight = containerRect.width * 0.53;
    if (mouseXInContainer > wallLeft && mouseXInContainer < wallRight) resetChallenge("You crossed the blockade!");
  });

  function resetChallenge(msg) {
    challengeActive = false;
    loseLife(msg);
  }
}

// Q6
function setupQ6() {
  questionBox.innerHTML = `
    <div class="text-center flex flex-col items-center justify-center h-full">
      <p class="text-xl sm:text-2xl font-bold mb-4">Patiently wait for 20 seconds...</p>
      <div class="w-24 h-24 rounded-full border-8 border-yellow-500 border-t-transparent animate-spin mb-4"></div>
      <div id="timer-display" class="pixel-font text-3xl text-yellow-400">20s</div>
    </div>
    <div id="annoying-ad" class="hidden absolute top-[15%] left-[10%] right-[10%] bg-amber-100 border-8 border-red-600 rounded-2xl p-6 text-black shadow-2xl z-30 flex flex-col items-center justify-between transition-all duration-300 transform scale-95">
      <div class="w-full flex justify-between items-center border-b-2 border-red-500 pb-2 mb-4">
        <span class="font-extrabold text-red-600 animate-pulse text-base sm:text-lg">⚠️ ANTI-VIRUS WARNING ⚠️</span>
        <button id="ad-close-btn" class="bg-red-600 hover:bg-red-700 text-white font-bold w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-transform active:scale-90">X</button>
      </div>
      <p class="text-center font-bold text-sm sm:text-base mb-4">Your device is infected with <strong>99+ system viruses</strong>! Proceed to clean immediately!</p>
      <button id="ad-action-btn" class="bg-blue-600 hover:bg-blue-700 text-white font-black py-3 px-6 rounded-lg shadow-lg text-sm sm:text-base transition-transform hover:scale-105 active:scale-95">[FREE CLEAN NOW]</button>
    </div>
  `;

  const timerDisplay = document.getElementById('timer-display');
  const annoyingAd = document.getElementById('annoying-ad');
  const closeBtn = document.getElementById('ad-close-btn');
  const actionBtn = document.getElementById('ad-action-btn');

  let timeLeft = 20;
  window.question6Timer = setInterval(() => {
    timeLeft--;
    timerDisplay.innerText = `${timeLeft}s`;
    if (timeLeft === 10) {
      playSound('spawn');
      annoyingAd.classList.remove('hidden');
    }
    if (timeLeft <= 0) {
      clearInterval(window.question6Timer);
      nextQuestion();
    }
  }, 1000);

  closeBtn.addEventListener('click', () => {
    clearInterval(window.question6Timer);
    loseLife("Never trust pop-up close buttons!");
  });

  actionBtn.addEventListener('click', () => {
    clearInterval(window.question6Timer);
    loseLife("You downloaded more RAM instead.");
  });
}

// Q7
function setupQ7() {
  questionBox.innerHTML = `
    <div class="text-center mb-6">
      <p class="text-2xl font-extrabold">Press 4</p>
    </div>
    <div class="grid grid-cols-2 gap-4 w-full max-w-md">
      <button class="choice-btn py-3 px-6 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold border-2 border-slate-500 hover:scale-[1.02] active:scale-[0.98] transition-all" data-correct="false">Four</button>
      <button class="choice-btn py-3 px-6 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold border-2 border-slate-500 hover:scale-[1.02] active:scale-[0.98] transition-all" data-correct="false">IV</button>
      <button class="choice-btn py-3 px-6 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold border-2 border-slate-500 hover:scale-[1.02] active:scale-[0.98] transition-all" data-correct="false">For</button>
      <button class="choice-btn py-3 px-6 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold border-2 border-slate-500 hover:scale-[1.02] active:scale-[0.98] transition-all" data-correct="false">Fore</button>
    </div>
  `;
  attachStandardListeners();
}

// Q8
function setupQ8() {
  questionBox.innerHTML = `
    <div class="text-center mb-6">
      <p class="text-xl sm:text-2xl font-bold">Bob teleports 110,000 pixels in Y. Did he survive?</p>
    </div>
    <div class="grid grid-cols-2 gap-4 w-full max-w-md">
      <button class="choice-btn py-3 px-6 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold border-2 border-slate-500 hover:scale-[1.02] active:scale-[0.98] transition-all" data-correct="false">Yes</button>
      <button class="choice-btn py-3 px-6 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold border-2 border-slate-500 hover:scale-[1.02] active:scale-[0.98] transition-all" data-correct="true">No</button>
      <button class="choice-btn py-3 px-6 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold border-2 border-slate-500 hover:scale-[1.02] active:scale-[0.98] transition-all" data-correct="false">Who is Bob?</button>
      <button class="choice-btn py-3 px-6 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold border-2 border-slate-500 hover:scale-[1.02] active:scale-[0.98] transition-all" data-correct="false">He is fine</button>
    </div>
  `;
  attachStandardListeners();
}

// Q9
function setupQ9() {
  let countTarget = 4;
  if (temporaryFailCount === 1) countTarget = 8;
  if (temporaryFailCount === 2) countTarget = 12;
  if (temporaryFailCount >= 3) countTarget = 16;

  questionBox.innerHTML = `
    <div class="text-center mb-4">
      <p class="text-xl font-bold">How many balls are there?</p>
    </div>
    <div id="balls-grid" class="grid grid-cols-4 gap-4 max-w-sm mb-6 bg-slate-900/40 p-6 rounded-2xl border border-slate-700"></div>
    <div class="flex flex-col sm:flex-row gap-3 w-full max-w-md justify-center items-center">
      <input type="number" id="ball-count-input" placeholder="Type count..." min="0" max="99" class="w-full sm:w-48 py-3 px-4 rounded-xl bg-slate-950 text-white font-bold border-2 border-slate-600 focus:border-cyan-400 focus:outline-none text-center text-lg">
      <button id="ball-submit-btn" class="w-full sm:w-auto py-3 px-8 bg-cyan-600 hover:bg-cyan-500 text-white font-extrabold rounded-xl border-2 border-white tracking-wide transition-all active:scale-95">SUBMIT</button>
    </div>
  `;

  const grid = document.getElementById('balls-grid');
  const input = document.getElementById('ball-count-input');
  const submitBtn = document.getElementById('ball-submit-btn');

  for (let i = 0; i < countTarget; i++) {
    const ball = document.createElement('div');
    ball.className = 'w-10 h-10 rounded-full bg-gradient-to-tr from-rose-600 to-orange-400 border-2 border-white shadow-md animate-bounce';
    ball.style.animationDelay = `${(i * 0.15).toFixed(2)}s`;
    grid.appendChild(ball);
  }

  input.focus();

  input.addEventListener('input', () => {
    const value = parseInt(input.value.trim());
    if (value === countTarget) {
      if (countTarget === 4) {
        playSound('spawn');
        temporaryFailCount = 1;
        loadQuestion();
        quizMessage.innerText = "Suddenly, more appeared!";
      } else if (countTarget === 8) {
        playSound('spawn');
        temporaryFailCount = 2;
        loadQuestion();
        quizMessage.innerText = "Wait... they keep spawning!";
      } else if (countTarget === 12) {
        playSound('spawn');
        temporaryFailCount = 3;
        loadQuestion();
        quizMessage.innerText = "This is getting absurd!";
      } else if (countTarget === 16) {
        nextQuestion();
      }
    }
  });

  submitBtn.addEventListener('click', () => {
    const value = parseInt(input.value.trim());
    if (value === countTarget && countTarget === 16) nextQuestion();
    else loseLife("Incorrect count! Learn to count!");
  });
}

/* ================= QUESTION 10 ================= */

function setupQ10() {
  questionBox.innerHTML = `
    <div class="text-center mb-4 relative">
      <p class="text-xl font-bold">What is the smallest dot<span id="question-period" class="subtle-dot" data-correct="true" title="period">.</span></p>
      <p class="text-sm text-slate-400">There are different sized dots — click the smallest one.</p>
    </div>
    <div id="dots-area" class="flex flex-wrap gap-4 justify-center items-center w-full max-w-sm p-4 bg-slate-900/30 rounded-xl border border-slate-700">
      <div class="dot tiny cursor-pointer" data-correct="false" title="tiny">.</div>
      <div class="dot small cursor-pointer" data-correct="false" title="small">•</div>
      <div class="dot med cursor-pointer" data-correct="false" title="medium">◦</div>
      <div class="dot big cursor-pointer" data-correct="false" title="big">◉</div>
      <div class="dot huge cursor-pointer" data-correct="false" title="huge">●</div>
    </div>
    <style>
      /* dots area visuals (kept subtle) */
      #dots-area .dot { display:flex; align-items:center; justify-content:center; background:transparent; color:var(--dot-color,#fff); border-radius:999px; border:2px solid rgba(255,255,255,0.06); padding:6px; }
      #dots-area .tiny { font-size:10px; padding:2px 6px; opacity:1; }
      #dots-area .small { font-size:18px; padding:6px 8px; opacity:0.95; }
      #dots-area .med { font-size:26px; padding:8px 10px; opacity:0.9; }
      #dots-area .big { font-size:40px; padding:10px 12px; opacity:0.9; }
      #dots-area .huge { font-size:56px; padding:12px 14px; opacity:0.85; }
      #dots-area .dot:hover { transform:scale(1.05); transition:transform .08s; }

      /* Subtle clickable period in the question text:
         - keeps same color as text, minimal padding and a tiny hit area
         - slightly increases hover opacity so it's discoverable only on close inspection */
      .subtle-dot {
        display: inline-block;
        margin-left: 2px;
        padding: 2px 3px;
        border-radius: 3px;
        color: inherit;
        background: transparent;
        opacity: 0.98;
        cursor: pointer;
        transition: background-color .12s, transform .08s, opacity .12s;
        line-height: 0.8;
        font-size: 20px; /* matches question text */
        user-select: none;
      }
      .subtle-dot:hover {
        background: rgba(255,255,255,0.03);
        transform: translateY(-1px) scale(1.05);
        opacity: 1;
      }
    </style>
  `;

  // Hook listeners: the period in the question text is the true target
  const dots = questionBox.querySelectorAll('#dots-area .dot');
  dots.forEach(d => {
    d.addEventListener('click', () => {
      // All visible dots are decoys now
      loseLife("Not the smallest one!");
    });
  });

  // Make the period at the end of the question the hidden correct button
  const periodBtn = questionBox.querySelector('#question-period');
  if (periodBtn) {
    periodBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      playSound('correct');
      // tiny visual feedback: subtle flash
      periodBtn.style.background = 'rgba(255,255,255,0.04)';
      setTimeout(() => { periodBtn.style.background = 'transparent'; }, 180);
      nextQuestion();
    });

    // Also allow accidental keyboard "Enter" to not trigger it; keep it very discrete
    periodBtn.addEventListener('mouseenter', () => {
      // minimal feedback sound so it's not noisy but hints at interactivity
      playSound('click');
    });
  }
}

/* ================= QUESTION 11 ================= */

function setupQ11() {
  questionBox.innerHTML = `
    <div class="text-center mb-4 relative">
      <p class="text-xl font-bold">Click on the answer to: 5 + 6</p>
      <p class="text-sm text-slate-400">The correct number is not in the choices below.</p>
    </div>
    <div class="grid grid-cols-2 gap-4 w-full max-w-md">
      <button class="choice-btn py-3 px-6 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold border-2 border-slate-500" data-correct="false">9</button>
      <button class="choice-btn py-3 px-6 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold border-2 border-slate-500" data-correct="false">10</button>
      <button class="choice-btn py-3 px-6 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold border-2 border-slate-500" data-correct="false">21</button>
      <button class="choice-btn py-3 px-6 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold border-2 border-slate-500" data-correct="false">12</button>
    </div>
  `;

  // All visible choices are decoys
  const buttons = questionBox.querySelectorAll('.choice-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      loseLife("Not listed — look at the UI itself!");
    });
  });

  // The real correct target is the top-left question marker (#question-number)
  const topMarker = document.getElementById('question-number');
  function markerHandler(e) {
    // Only count as correct if currently on Q11
    if (currentQuestion !== 11) return;
    playSound('correct');
    flashGreen();
    // small visual cue on marker
    topMarker.style.opacity = '0.6';
    setTimeout(() => { topMarker.style.opacity = ''; }, 220);
    // remove listener after success
    topMarker.removeEventListener('click', markerHandler);
    nextQuestion();
  }
  // Attach the click listener (keeps discrete)
  topMarker.addEventListener('click', markerHandler);
}

/* ================= QUESTION 12 =================
   Who made everything? (Answer: Big Bang)
*/
function setupQ12() {
  questionBox.innerHTML = `
    <div class="text-center mb-6">
      <p class="text-2xl font-bold">Who made everything?</p>
      <p class="text-sm text-slate-400 mt-2">Choose the correct origin.</p>
    </div>
    <div class="grid grid-cols-2 gap-4 w-full max-w-md">
      <button class="choice-btn py-3 px-6 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold border-2 border-slate-500" data-correct="false">God</button>
      <button class="choice-btn py-3 px-6 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold border-2 border-slate-500" data-correct="true">Big Bang</button>
      <button class="choice-btn py-3 px-6 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold border-2 border-slate-500" data-correct="false">Aliens</button>
      <button class="choice-btn py-3 px-6 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold border-2 border-slate-500" data-correct="false">A cat walked by</button>
    </div>
  `;
  attachStandardListeners();
}

/* ================= QUESTION 13 =================
   How many questions have you answered? (type in the answer) (answer: 12)
*/
function setupQ13() {
  questionBox.innerHTML = `
    <div class="text-center mb-4">
      <p class="text-xl font-bold">How many questions have you answered?</p>
      <p class="text-sm text-slate-400">Type the count to finish the quiz.</p>
    </div>
    <div class="flex flex-col sm:flex-row gap-3 w-full max-w-md justify-center items-center">
      <input type="number" id="answered-count-input" placeholder="Type number..." min="0" max="99" class="w-full sm:w-48 py-3 px-4 rounded-xl bg-slate-950 text-white font-bold border-2 border-slate-600 focus:border-cyan-400 focus:outline-none text-center text-lg">
      <button id="answered-count-submit" class="w-full sm:w-auto py-3 px-8 bg-cyan-600 hover:bg-cyan-500 text-white font-extrabold rounded-xl border-2 border-white tracking-wide transition-all active:scale-95">SUBMIT</button>
    </div>
  `;

  const input = document.getElementById('answered-count-input');
  const submit = document.getElementById('answered-count-submit');

  // The user has been through (currentQuestion - 1) questions so far; the intended correct response is 12
  // but we enforce the static answer per design: 12
  submit.addEventListener('click', () => {
    const value = parseInt(input.value.trim());
    if (value === 12) nextQuestion();
    else loseLife("Wrong count! You didn't keep track!");
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      submit.click();
    }
  });

  input.focus();
}

/* ================= QUESTION 14 =================
   What is your fav color? (type in the color) - any color allowed except "brown"
*/
function setupQ14() {
  questionBox.innerHTML = `
    <div class="text-center mb-4">
      <p class="text-xl font-bold">What is your fav color?</p>
      <p class="text-sm text-slate-400">Type any color name except one forbidden color...</p>
    </div>
    <div class="flex flex-col sm:flex-row gap-3 w-full max-w-md justify-center items-center">
      <input type="text" id="fav-color-input" placeholder="Type color..." class="w-full sm:w-48 py-3 px-4 rounded-xl bg-slate-950 text-white font-bold border-2 border-slate-600 focus:border-cyan-400 focus:outline-none text-center text-lg">
      <button id="fav-color-submit" class="w-full sm:w-auto py-3 px-8 bg-cyan-600 hover:bg-cyan-500 text-white font-extrabold rounded-xl border-2 border-white tracking-wide transition-all active:scale-95">SUBMIT</button>
    </div>
  `;

  const input = document.getElementById('fav-color-input');
  const submit = document.getElementById('fav-color-submit');

  submit.addEventListener('click', () => {
    const val = (input.value || '').trim().toLowerCase();
    if (!val) {
      loseLife("You must type a color!");
      return;
    }
    if (val === 'brown') {
      loseLife("Brown is not allowed here!");
    } else {
      nextQuestion();
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit.click();
  });

  input.focus();
}

/* ================= QUESTION 15 =================
   Did you win yet? (Answer: No)
*/
function setupQ15() {
  questionBox.innerHTML = `
    <div class="text-center mb-6">
      <p class="text-2xl font-bold">Did you win yet?</p>
      <p class="text-sm text-slate-400 mt-2">Be honest.</p>
    </div>
    <div class="grid grid-cols-2 gap-4 w-full max-w-md">
      <button id="ans-yes" class="choice-btn py-3 px-6 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold border-2 border-slate-500" data-correct="false">Yes</button>
      <button id="ans-no" class="choice-btn py-3 px-6 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold border-2 border-slate-500" data-correct="true">No</button>
      <button id="ans-maybe" class="choice-btn py-3 px-6 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold border-2 border-slate-500" data-correct="false">Maybe</button>
      <button id="ans-quit" class="choice-btn py-3 px-6 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold border-2 border-slate-500" data-correct="false">I gave up</button>
    </div>
  `;

  const buttons = questionBox.querySelectorAll('.choice-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const isCorrect = btn.getAttribute('data-correct') === 'true';
      if (isCorrect) nextQuestion();
      else loseLife("Nope, that's not the truth here.");
    });
  });
}

/* ================= AUXILIARY UTILITIES ================= */

function attachStandardListeners() {
  const buttons = document.querySelectorAll('.choice-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const isCorrect = btn.getAttribute('data-correct') === 'true';
      if (isCorrect) nextQuestion();
      else loseLife();
    });
  });
}

// Reset / Replays
restartBtn.addEventListener('click', () => {
  playSound('click');
  initGame();
});

playAgainBtn.addEventListener('click', () => {
  playSound('click');
  initGame();
});

/* Title screen handling and Start flow */
const titleScreen = document.getElementById('title-screen');

function hideTitleScreen() {
  if (!titleScreen) return;
  titleScreen.classList.add('hidden');
}

function showTitleScreen() {
  if (!titleScreen) return;
  titleScreen.classList.remove('hidden');
}

const startBtn = document.getElementById('start-btn');
const skipBtn = document.getElementById('skip-btn');

if (startBtn) {
  startBtn.addEventListener('click', () => {
    playSound('click');
    hideTitleScreen();
    initGame();
  });
}
if (skipBtn) {
  skipBtn.addEventListener('click', () => {
    playSound('click');
    hideTitleScreen();
    initGame();
  });
}

// Show title screen on load (game initializes only after Start)
window.onload = () => {
  showTitleScreen();
};