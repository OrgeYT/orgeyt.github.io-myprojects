// Mini-games module
const MiniGames = {
  currentGame: null,
  onComplete: null,
  audioCtx: null,

  init(onCompleteCallback) {
    this.onComplete = onCompleteCallback;
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  },

  playBeep(freq = 440, duration = 0.1, type = 'square') {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.15, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start();
    osc.stop(this.audioCtx.currentTime + duration);
  },

  clearArea() {
    const area = document.getElementById('minigame-area');
    area.innerHTML = '';
    this.currentGame = null;
  },

  // ========== SIMON SAYS ==========
  startSimon() {
    this.clearArea();
    const area = document.getElementById('minigame-area');
    const sequenceLength = 2 + Math.floor(Math.random() * 2); // 2-3 (quick)
    const colors = ['red', 'green', 'blue', 'yellow'];
    const sequence = [];
    for (let i = 0; i < sequenceLength; i++) {
      sequence.push(colors[Math.floor(Math.random() * 4)]);
    }

    area.innerHTML = `
      <div class="mg-title">SIMON SAYS</div>
      <div class="mg-info">Watch the sequence, then repeat it. Length: ${sequenceLength}</div>
      <div class="mg-score">Round: 1 / ${sequenceLength}</div>
      <div class="simon-grid">
        <div class="simon-btn red" data-color="red"></div>
        <div class="simon-btn green" data-color="green"></div>
        <div class="simon-btn blue" data-color="blue"></div>
        <div class="simon-btn yellow" data-color="yellow"></div>
      </div>
      <div class="feedback" id="simon-feedback">Get ready...</div>
    `;

    const buttons = area.querySelectorAll('.simon-btn');
    let playerIndex = 0;
    let showing = true;
    let currentShow = 0;

    const freqs = { red: 330, green: 370, blue: 415, yellow: 466 };

    const lightBtn = (color, on) => {
      const btn = area.querySelector(`.simon-btn.${color}`);
      if (on) {
        btn.classList.add('lit');
        this.playBeep(freqs[color], 0.25);
      } else {
        btn.classList.remove('lit');
      }
    };

    const showSequence = async () => {
      showing = true;
      document.getElementById('simon-feedback').textContent = 'Watch carefully...';
      document.getElementById('simon-feedback').className = 'feedback';
      await new Promise(r => setTimeout(r, 600));
      for (let i = 0; i <= currentShow; i++) {
        lightBtn(sequence[i], true);
        await new Promise(r => setTimeout(r, 400));
        lightBtn(sequence[i], false);
        await new Promise(r => setTimeout(r, 200));
      }
      showing = false;
      document.getElementById('simon-feedback').textContent = 'Your turn!';
    };

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        if (showing) return;
        const color = btn.dataset.color;
        lightBtn(color, true);
        setTimeout(() => lightBtn(color, false), 200);

        if (color === sequence[playerIndex]) {
          playerIndex++;
          if (playerIndex > currentShow) {
            currentShow++;
            playerIndex = 0;
            area.querySelector('.mg-score').textContent = `Round: ${currentShow + 1} / ${sequenceLength}`;
            if (currentShow >= sequenceLength) {
              document.getElementById('simon-feedback').textContent = 'SUCCESS! +1 POWER';
              document.getElementById('simon-feedback').className = 'feedback correct';
              this.playBeep(523, 0.15);
              setTimeout(() => this.playBeep(659, 0.2), 150);
              setTimeout(() => {
                this.onComplete();
                this.clearArea();
                area.innerHTML = '<p class="placeholder">Mini-game complete! Select another.</p>';
              }, 1200);
            } else {
              setTimeout(showSequence, 500);
            }
          }
        } else {
          document.getElementById('simon-feedback').textContent = 'WRONG! Try again.';
          document.getElementById('simon-feedback').className = 'feedback wrong';
          this.playBeep(150, 0.3, 'sawtooth');
          playerIndex = 0;
          setTimeout(showSequence, 1000);
        }
      });
    });

    setTimeout(showSequence, 800);
    this.currentGame = 'simon';
  },

  // ========== PLATFORMER ==========
  startPlatformer() {
    this.clearArea();
    const area = document.getElementById('minigame-area');
    area.innerHTML = `
      <div class="mg-title">PLATFORMER</div>
      <div class="mg-info">Arrow keys / WASD to move. Reach the green flag! 2 levels.</div>
      <div class="mg-score">Level: 1 / 2</div>
      <canvas id="platformer-canvas" width="340" height="240"></canvas>
      <div class="feedback" id="plat-feedback">Level 1 - Go!</div>
    `;

    const canvas = document.getElementById('platformer-canvas');
    const ctx = canvas.getContext('2d');
    const W = 340, H = 240;

    let level = 0;
    let player = { x: 20, y: 180, vx: 0, vy: 0, w: 14, h: 18, onGround: false };
    let keys = {};
    let platforms = [];
    let flag = { x: 300, y: 50 };
    let animId = null;
    let completed = false;

    const generateLevel = (lv) => {
      platforms = [{ x: 0, y: 220, w: W, h: 20 }]; // floor
      const density = 3 + lv;
      for (let i = 0; i < density; i++) {
        platforms.push({
          x: 30 + Math.random() * 250,
          y: 40 + Math.random() * 150,
          w: 40 + Math.random() * 50,
          h: 12
        });
      }
      // Ensure reachable-ish path
      platforms.push({ x: 80, y: 170, w: 60, h: 12 });
      platforms.push({ x: 160, y: 130, w: 50, h: 12 });
      platforms.push({ x: 240, y: 90, w: 50, h: 12 });
      flag = { x: 280 + Math.random() * 30, y: 40 + Math.random() * 40 };
      player = { x: 20, y: 180, vx: 0, vy: 0, w: 14, h: 18, onGround: false };
    };

    generateLevel(0);

    const handleKey = (e) => {
      keys[e.key.toLowerCase()] = e.type === 'keydown';
      if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(e.key.toLowerCase())) e.preventDefault();
    };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('keyup', handleKey);

    const update = () => {
      if (completed) return;
      // Input
      if (keys['arrowleft'] || keys['a']) player.vx = -3;
      else if (keys['arrowright'] || keys['d']) player.vx = 3;
      else player.vx *= 0.7;

      if ((keys['arrowup'] || keys['w'] || keys[' ']) && player.onGround) {
        player.vy = -7.5;
        player.onGround = false;
        this.playBeep(300, 0.05);
      }

      // Physics
      player.vy += 0.35;
      player.x += player.vx;
      player.y += player.vy;

      // Bounds
      if (player.x < 0) player.x = 0;
      if (player.x + player.w > W) player.x = W - player.w;
      if (player.y > H) {
        // Fall - reset level
        player.x = 20; player.y = 180; player.vx = 0; player.vy = 0;
      }

      // Platform collision
      player.onGround = false;
      for (const p of platforms) {
        if (player.x + player.w > p.x && player.x < p.x + p.w &&
            player.y + player.h > p.y && player.y + player.h < p.y + p.h + 10 &&
            player.vy >= 0) {
          player.y = p.y - player.h;
          player.vy = 0;
          player.onGround = true;
        }
      }

      // Flag
      if (Math.abs(player.x - flag.x) < 20 && Math.abs(player.y - flag.y) < 25) {
        level++;
        this.playBeep(523, 0.1);
        setTimeout(() => this.playBeep(659, 0.1), 100);
        if (level >= 2) {
          completed = true;
          document.getElementById('plat-feedback').textContent = 'ALL LEVELS COMPLETE! +1 POWER';
          document.getElementById('plat-feedback').className = 'feedback correct';
          cancelAnimationFrame(animId);
          window.removeEventListener('keydown', handleKey);
          window.removeEventListener('keyup', handleKey);
          setTimeout(() => {
            this.onComplete();
            this.clearArea();
            area.innerHTML = '<p class="placeholder">Mini-game complete! Select another.</p>';
          }, 1200);
          return;
        }
        area.querySelector('.mg-score').textContent = `Level: ${level + 1} / 2`;
        document.getElementById('plat-feedback').textContent = `Level ${level + 1} - Go!`;
        generateLevel(level);
      }

      // Draw
      ctx.fillStyle = '#0a0a12';
      ctx.fillRect(0, 0, W, H);

      // Platforms
      ctx.fillStyle = '#333';
      for (const p of platforms) {
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = '#2a2a3a';
        ctx.fillRect(p.x, p.y, p.w, 3);
        ctx.fillStyle = '#333';
      }

      // Flag
      ctx.fillStyle = '#0f0';
      ctx.fillRect(flag.x, flag.y - 25, 3, 30);
      ctx.beginPath();
      ctx.moveTo(flag.x + 3, flag.y - 25);
      ctx.lineTo(flag.x + 18, flag.y - 18);
      ctx.lineTo(flag.x + 3, flag.y - 10);
      ctx.fill();

      // Player
      ctx.fillStyle = '#0af';
      ctx.fillRect(player.x, player.y, player.w, player.h);
      ctx.fillStyle = '#fff';
      ctx.fillRect(player.x + 3, player.y + 3, 3, 3);
      ctx.fillRect(player.x + 8, player.y + 3, 3, 3);

      animId = requestAnimationFrame(update);
    };
    update();
    this.currentGame = 'platformer';
  },

  // ========== FOLLOW THE PATH ==========
  startPath() {
    this.clearArea();
    const area = document.getElementById('minigame-area');
    const size = 6 + Math.floor(Math.random() * 2); // 6-7
    const pathLen = 4 + Math.floor(Math.random() * 3); // 4-6 (quick)

    // Generate a path
    let path = [{ x: 0, y: Math.floor(size / 2) }];
    let visited = new Set(['0,' + path[0].y]);
    const dirs = [[1,0], [0,1], [0,-1], [-1,0]];
    while (path.length < pathLen) {
      const last = path[path.length - 1];
      const candidates = dirs
        .map(d => ({ x: last.x + d[0], y: last.y + d[1] }))
        .filter(p => p.x >= 0 && p.x < size && p.y >= 0 && p.y < size && !visited.has(p.x + ',' + p.y));
      if (candidates.length === 0) break;
      const next = candidates[Math.floor(Math.random() * candidates.length)];
      path.push(next);
      visited.add(next.x + ',' + next.y);
    }

    const start = path[0];
    const end = path[path.length - 1];
    const pathSet = new Set(path.map(p => p.x + ',' + p.y));

    area.innerHTML = `
      <div class="mg-title">FOLLOW THE PATH</div>
      <div class="mg-info">Click cells from START (green) to END (red) following the path.</div>
      <div class="mg-score">Progress: 0 / ${path.length}</div>
      <div class="path-grid" id="path-grid" style="grid-template-columns: repeat(${size}, 32px);"></div>
      <div class="feedback" id="path-feedback">Start at the green cell</div>
    `;

    const grid = document.getElementById('path-grid');
    let currentIdx = 0;
    let selected = [];

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const cell = document.createElement('div');
        cell.className = 'path-cell';
        cell.dataset.x = x;
        cell.dataset.y = y;
        if (x === start.x && y === start.y) cell.classList.add('start');
        if (x === end.x && y === end.y) cell.classList.add('end');
        if (pathSet.has(x + ',' + y) && !(x === start.x && y === start.y) && !(x === end.x && y === end.y)) {
          // subtle path hint? or not - make it findable by logic, but for ease show faintly? User said unique, but keep fair.
        }
        grid.appendChild(cell);
      }
    }

    // Show the path briefly then hide
    path.forEach((p, i) => {
      const cell = grid.querySelector(`[data-x="${p.x}"][data-y="${p.y}"]`);
      if (cell && !cell.classList.contains('start') && !cell.classList.contains('end')) {
        cell.classList.add('path');
      }
    });
    setTimeout(() => {
      path.forEach(p => {
        const cell = grid.querySelector(`[data-x="${p.x}"][data-y="${p.y}"]`);
        if (cell && !cell.classList.contains('start') && !cell.classList.contains('end')) {
          cell.classList.remove('path');
        }
      });
      document.getElementById('path-feedback').textContent = 'Path hidden! Trace it from green to red.';
    }, 2000);

    grid.addEventListener('click', (e) => {
      const cell = e.target.closest('.path-cell');
      if (!cell) return;
      const x = +cell.dataset.x;
      const y = +cell.dataset.y;
      const expected = path[currentIdx];
      if (x === expected.x && y === expected.y) {
        cell.classList.add('correct');
        this.playBeep(400 + currentIdx * 30, 0.08);
        currentIdx++;
        area.querySelector('.mg-score').textContent = `Progress: ${currentIdx} / ${path.length}`;
        if (currentIdx >= path.length) {
          document.getElementById('path-feedback').textContent = 'PATH COMPLETE! +1 POWER';
          document.getElementById('path-feedback').className = 'feedback correct';
          this.playBeep(523, 0.15);
          setTimeout(() => this.playBeep(659, 0.2), 150);
          setTimeout(() => {
            this.onComplete();
            this.clearArea();
            area.innerHTML = '<p class="placeholder">Mini-game complete! Select another.</p>';
          }, 1200);
        }
      } else {
        cell.classList.add('wrong');
        this.playBeep(150, 0.2, 'sawtooth');
        document.getElementById('path-feedback').textContent = 'Wrong cell! Start over.';
        document.getElementById('path-feedback').className = 'feedback wrong';
        setTimeout(() => {
          grid.querySelectorAll('.correct, .wrong').forEach(c => {
            c.classList.remove('correct', 'wrong');
          });
          currentIdx = 0;
          area.querySelector('.mg-score').textContent = `Progress: 0 / ${path.length}`;
          document.getElementById('path-feedback').textContent = 'Try again from green.';
          document.getElementById('path-feedback').className = 'feedback';
        }, 600);
      }
    });

    this.currentGame = 'path';
  },

  // ========== MATH ==========
  startMath() {
    this.clearArea();
    const area = document.getElementById('minigame-area');
    const questions = [];
    // Simple only: + - ×  (no divide). Small numbers.
    const ops = ['+', '-', '×'];

    for (let i = 0; i < 3; i++) {
      const op = ops[Math.floor(Math.random() * 3)];
      let a, b, ans;
      if (op === '+') {
        a = Math.floor(Math.random() * 15) + 1;
        b = Math.floor(Math.random() * 15) + 1;
        ans = a + b;
      } else if (op === '-') {
        a = Math.floor(Math.random() * 20) + 5;
        b = Math.floor(Math.random() * a);
        ans = a - b;
      } else {
        a = Math.floor(Math.random() * 9) + 1;
        b = Math.floor(Math.random() * 9) + 1;
        ans = a * b;
      }
      questions.push({ text: `${a} ${op} ${b}`, answer: ans });
    }

    let qIndex = 0;
    let correct = 0;

    const renderQ = () => {
      if (qIndex >= 3) {
        area.innerHTML = `
          <div class="mg-title">MATH CHALLENGE</div>
          <div class="feedback correct">All 3 correct! +1 POWER</div>
        `;
        this.playBeep(523, 0.15);
        setTimeout(() => this.playBeep(659, 0.2), 150);
        setTimeout(() => {
          this.onComplete();
          this.clearArea();
          area.innerHTML = '<p class="placeholder">Mini-game complete! Select another.</p>';
        }, 1200);
        return;
      }
      const q = questions[qIndex];
      area.innerHTML = `
        <div class="mg-title">MATH CHALLENGE</div>
        <div class="mg-info">Answer 3 questions correctly. Question ${qIndex + 1} / 3</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${(qIndex/3)*100}%"></div></div>
        <div class="question-box">
          <div class="question-text">${q.text} = ?</div>
          <input type="number" class="answer-input" id="math-ans" autofocus>
          <br><br>
          <button class="answer-btn" id="math-submit">Submit</button>
        </div>
        <div class="feedback" id="math-feedback"></div>
      `;
      const submit = () => {
        const val = parseInt(document.getElementById('math-ans').value, 10);
        if (val === q.answer) {
          correct++;
          document.getElementById('math-feedback').textContent = 'Correct!';
          document.getElementById('math-feedback').className = 'feedback correct';
          this.playBeep(500, 0.1);
          qIndex++;
          setTimeout(renderQ, 600);
        } else {
          document.getElementById('math-feedback').textContent = `Wrong! Answer was ${q.answer}. Try a new set.`;
          document.getElementById('math-feedback').className = 'feedback wrong';
          this.playBeep(150, 0.25, 'sawtooth');
          // Restart with new questions
          setTimeout(() => this.startMath(), 1200);
        }
      };
      document.getElementById('math-submit').onclick = submit;
      document.getElementById('math-ans').onkeydown = (e) => { if (e.key === 'Enter') submit(); };
    };
    renderQ();
    this.currentGame = 'math';
  },

  // ========== QUIZ ==========
  startQuiz() {
    this.clearArea();
    const area = document.getElementById('minigame-area');

    const allQuestions = [
      { q: "What color is the sky on a clear day?", opts: ["Blue", "Green", "Red", "Purple"], a: 0 },
      { q: "How many legs does a dog typically have?", opts: ["2", "4", "6", "8"], a: 1 },
      { q: "What is 2 + 2?", opts: ["3", "4", "5", "22"], a: 1 },
      { q: "Which animal says 'meow'?", opts: ["Dog", "Cat", "Cow", "Bird"], a: 1 },
      { q: "What do you use to write on paper?", opts: ["Spoon", "Pen", "Shoe", "Phone"], a: 1 },
      { q: "How many days in a week?", opts: ["5", "6", "7", "8"], a: 2 },
      { q: "What is the opposite of hot?", opts: ["Warm", "Cold", "Big", "Fast"], a: 1 },
      { q: "Which is a fruit?", opts: ["Carrot", "Apple", "Broccoli", "Potato"], a: 1 },
      { q: "What comes after Monday?", opts: ["Sunday", "Tuesday", "Friday", "Wednesday"], a: 1 },
      { q: "How many wheels on a bicycle?", opts: ["1", "2", "3", "4"], a: 1 },
      { q: "What do bees make?", opts: ["Milk", "Honey", "Bread", "Cheese"], a: 1 },
      { q: "Which is bigger: elephant or mouse?", opts: ["Mouse", "Elephant", "Same", "Neither"], a: 1 },
      { q: "What do you wear on your feet?", opts: ["Hat", "Gloves", "Shoes", "Scarf"], a: 2 },
      { q: "How many letters in the English alphabet?", opts: ["24", "25", "26", "27"], a: 2 },
      { q: "What is frozen water called?", opts: ["Steam", "Ice", "Rain", "Cloud"], a: 1 }
    ];

    // Pick 5 unique random
    const shuffled = allQuestions.sort(() => Math.random() - 0.5).slice(0, 3);
    let qIndex = 0;

    const renderQ = () => {
      if (qIndex >= 3) {
        area.innerHTML = `
          <div class="mg-title">QUIZ TIME</div>
          <div class="feedback correct">All answers correct! +1 POWER</div>
        `;
        this.playBeep(523, 0.15);
        setTimeout(() => this.playBeep(659, 0.2), 150);
        setTimeout(() => {
          this.onComplete();
          this.clearArea();
          area.innerHTML = '<p class="placeholder">Mini-game complete! Select another.</p>';
        }, 1200);
        return;
      }
      const q = shuffled[qIndex];
      area.innerHTML = `
        <div class="mg-title">QUIZ TIME</div>
        <div class="mg-info">Question ${qIndex + 1} / 3</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${(qIndex/3)*100}%"></div></div>
        <div class="question-box">
          <div class="question-text" style="font-size:16px;">${q.q}</div>
          <div id="quiz-opts"></div>
        </div>
        <div class="feedback" id="quiz-feedback"></div>
      `;
      const optsDiv = document.getElementById('quiz-opts');
      q.opts.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'quiz-option';
        btn.textContent = opt;
        btn.onclick = () => {
          if (i === q.a) {
            document.getElementById('quiz-feedback').textContent = 'Correct!';
            document.getElementById('quiz-feedback').className = 'feedback correct';
            this.playBeep(500, 0.1);
            qIndex++;
            setTimeout(renderQ, 600);
          } else {
            document.getElementById('quiz-feedback').textContent = 'Wrong! Starting over with new questions.';
            document.getElementById('quiz-feedback').className = 'feedback wrong';
            this.playBeep(150, 0.25, 'sawtooth');
            setTimeout(() => this.startQuiz(), 1200);
          }
        };
        optsDiv.appendChild(btn);
      });
    };
    renderQ();
    this.currentGame = 'quiz';
  }
};
