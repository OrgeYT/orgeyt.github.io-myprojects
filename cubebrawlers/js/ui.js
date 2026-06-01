import { Engine } from "./engine.js";
const THREE = Engine.THREE;

export const UI = {
  uiHpBar: null,
  uiHpText: null,
  uiUltBar: null,
  uiUltTimer: null,
  cdElements: {},
  init() {
    this.uiHpBar = document.getElementById('health-bar');
    this.uiHpText = document.getElementById('hp-text');
    this.uiUltBar = document.getElementById('ult-bar');
    this.uiUltTimer = document.getElementById('ult-timer');

    // cooldown elements for moves
    this.cdElements = {
      punch: document.getElementById('cd-punch'),
      skill1: document.getElementById('cd-skill1'),
      skill2: document.getElementById('cd-skill2'),
      skill3: document.getElementById('cd-skill3'),
      skill4: document.getElementById('cd-skill4'),
      dash: document.getElementById('cd-dash'),
    };
  },
  updatePlayerUI() {
    const p = Engine.player;
    if (!p) return;
    this.uiHpBar.style.width = (p.hp / p.maxHp) * 100 + '%';
    this.uiHpText.innerText = `${Math.ceil(p.hp)}/${p.maxHp}`;

    if (p.isUlt) {
      this.uiUltBar.style.width = '100%';
      this.uiUltBar.style.background = '#00ffff';
    } else {
      this.uiUltBar.style.width = (p.ultCharge / p.maxUltCharge) * 100 + '%';
      this.uiUltBar.style.background = '#eab308';
    }

    // update cooldown bars (show remaining fraction)
    const cds = p.cds || {};
    const maxCds = p.maxCds || {};
    for (let key in this.cdElements) {
      const el = this.cdElements[key];
      if (!el) continue;
      const rem = Math.max(0, cds[key] || 0);
      const maxv = Math.max(0.0001, maxCds[key] || 1);
      const frac = Math.min(1, rem / maxv);
      // Show cooldown bar proportional to remaining cooldown: full width when rem == max, shrinking as rem -> 0
      el.style.width = `${frac * 100}%`;
      // visually emphasize when actively cooling down
      el.style.opacity = rem > 0 ? 0.95 : 1.0;
    }
  },
  createFloatingText(text, position, colorHex = 0xffffff) {
    const el = document.createElement('div');
    el.style.position = 'absolute';
    el.style.color = '#' + colorHex.toString(16).padStart(6, '0');
    el.style.fontWeight = 'bold';
    el.style.fontSize = '20px';
    el.style.textShadow = '1px 1px 2px black';
    el.style.pointerEvents = 'none';
    el.innerText = text;
    document.body.appendChild(el);

    let age = 0;
    const upSpeed = 2;
    const pos = position.clone();

    function anim() {
      age += 0.016;
      pos.y += upSpeed * 0.016;

      const vector = pos.clone().project(Engine.camera);
      const x = (vector.x * .5 + .5) * window.innerWidth;
      const y = (vector.y * -.5 + .5) * window.innerHeight;

      if (vector.z < 1) {
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.style.opacity = 1 - (age / 1.5);
      } else {
        el.style.display = 'none';
      }

      if (age < 1.5) requestAnimationFrame(anim);
      else el.remove();
    }
    anim();
  },
  updateActionDescriptions() {
    const player = Engine.player;
    if (!player) return;
    if (player.isUlt) {
      document.getElementById('desc-move1').innerHTML = `<span class="move-hotkey ult-key">1</span> Awesome Rageout (Dash & Multi-hit)`;
      document.getElementById('desc-move2').innerHTML = `<span class="move-hotkey ult-key">2</span> Ultra Uppercut (Chain juggle)`;
      document.getElementById('desc-move3').innerHTML = `<span class="move-hotkey ult-key">3</span> Ultra Combo (AoE Slam)`;
      document.getElementById('desc-move4').innerHTML = `<span class="move-hotkey ult-key">4</span> Cutscene (Clones & Insta-kill)`;
      document.getElementById('desc-ult').innerHTML = `<span class="move-hotkey" style="color: #eab308; opacity: 0.5;">R</span> Transform (Active)`;
    } else {
      document.getElementById('desc-move1').innerHTML = `<span class="move-hotkey">1</span> Strong Punch`;
      document.getElementById('desc-move2').innerHTML = `<span class="move-hotkey">2</span> Take Away (Dash & Grab)`;
      document.getElementById('desc-move3').innerHTML = `<span class="move-hotkey">3</span> Uppercut`;
      document.getElementById('desc-move4').innerHTML = `<span class="move-hotkey">4</span> Combo 'em up`;
      document.getElementById('desc-ult').innerHTML = `<span class="move-hotkey" style="color: #eab308;">R</span> Transform (When meter full)`;
    }
  },
  setUltTimerText(n) {
    this.uiUltTimer.innerText = `ULT ACTIVE: ${n}s`;
  },
  showUltTimer(yes) {
    this.uiUltTimer.style.display = yes ? 'block' : 'none';
  }
};