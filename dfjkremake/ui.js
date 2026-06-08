/* UI helpers and wiring between DOM and game */
export function getColorFromKey(keyStr) {
  let hash = 0;
  const char = (keyStr||'').toUpperCase();
  for(let i=0;i<char.length;i++){ hash = char.charCodeAt(i) + ((hash<<5)-hash); }
  let hue = Math.abs(hash * 137.5) % 360;
  return `hsl(${hue},80%,65%)`;
}

export function formatKeyDisplay(keyStr) {
  if (!keyStr) return '';
  if (keyStr === 'ARROWUP') return '↑';
  if (keyStr === 'ARROWDOWN') return '↓';
  if (keyStr === 'ARROWLEFT') return '←';
  if (keyStr === 'ARROWRIGHT') return '→';
  if (keyStr === ' ') return 'SPC';
  if (keyStr === 'SPACE') return 'SPC';
  return keyStr.length > 3 ? keyStr.substring(0,3) : keyStr;
}

import { startGame } from './game.js';
import { switchScreen } from './game.js';

/* Small YAML serializer for our settings object */
function settingsToYAML(s) {
  // produce readable YAML: keys as comma-separated for arrays, booleans/literals plain
  const lines = [];
  lines.push(`# DFJK settings export`);
  lines.push(`keys: "${s.keys.join(',')}"`);
  lines.push(`scroll: ${s.scroll}`);
  lines.push(`length: ${s.length}`);
  lines.push(`lives: ${s.lives}`);
  lines.push(`botNPS: ${s.botNPS}`);
  lines.push(`doubles: ${s.doubles}`);
  lines.push(`multis: ${s.multis}`);
  lines.push(`jacks: ${s.jacks}`);
  lines.push(`wave: ${s.wave}`);
  lines.push(`bot: ${s.bot}`);
  lines.push(`noteSkin: ${s.noteSkin}`);
  lines.push(`noteColor: ${s.noteColor}`);
  return lines.join("\n");
}

/* Minimal YAML parser tailored to the exported format */
function parseSettingsYAML(text) {
  const obj = {};
  const lines = text.split(/\r?\n/);
  for (let raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.substring(0,idx).trim();
    let val = line.substring(idx+1).trim();
    // strip surrounding quotes if present
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.substring(1,val.length-1);
    }
    // coerce types
    if (['doubles','multis','jacks','wave','bot'].includes(key)) {
      obj[key] = (val === 'true' || val === 'True');
    } else if (['length','lives','botNPS'].includes(key)) {
      obj[key] = parseInt(val,10) || 0;
    } else if (key === 'keys') {
      // keys are comma separated
      obj.keys = val.split(',').map(s=>s.trim()).filter(Boolean);
    } else {
      obj[key] = val;
    }
  }
  return obj;
}

/* Apply a settings object to the DOM controls */
function applySettingsToDOM(s) {
  if (s.keys && s.keys.length === 4) {
    document.getElementById('kb-0').dataset.key = s.keys[0]; document.getElementById('kb-0').value = formatKeyDisplay(s.keys[0]);
    document.getElementById('kb-1').dataset.key = s.keys[1]; document.getElementById('kb-1').value = formatKeyDisplay(s.keys[1]);
    document.getElementById('kb-2').dataset.key = s.keys[2]; document.getElementById('kb-2').value = formatKeyDisplay(s.keys[2]);
    document.getElementById('kb-3').dataset.key = s.keys[3]; document.getElementById('kb-3').value = formatKeyDisplay(s.keys[3]);
  }
  if (s.scroll) document.getElementById('setting-scroll').value = s.scroll;
  if (typeof s.length !== 'undefined') document.getElementById('setting-length').value = s.length;
  if (typeof s.lives !== 'undefined') document.getElementById('setting-lives').value = s.lives;
  if (typeof s.botNPS !== 'undefined') document.getElementById('setting-botNPS').value = s.botNPS;
  if (typeof s.doubles !== 'undefined') document.getElementById('setting-doubles').checked = !!s.doubles;
  if (typeof s.multis !== 'undefined') document.getElementById('setting-multis').checked = !!s.multis;
  if (typeof s.jacks !== 'undefined') document.getElementById('setting-jacks').checked = !!s.jacks;
  if (typeof s.wave !== 'undefined') document.getElementById('setting-wave').checked = !!s.wave;
  if (typeof s.bot !== 'undefined') document.getElementById('setting-bot').checked = !!s.bot;
  if (s.noteSkin) document.getElementById('setting-noteSkin').value = s.noteSkin;
  if (s.noteColor) document.getElementById('setting-noteColor').value = s.noteColor;
}

export function initUI() {
  /* Keybind Inputs */
  document.querySelectorAll('.keybind-input').forEach(input=>{
    input.addEventListener('keydown', function(e){
      e.preventDefault();
      let upperKey = e.key.toUpperCase();
      this.dataset.key = upperKey;
      this.value = formatKeyDisplay(upperKey);
    });
  
    // allow clicking to focus so mobile can choose from keyboard if desired
    input.addEventListener('click', ()=> input.focus());
  });
  
  /* Buttons & UI */
  // Open settings screen
  document.getElementById('open-settings').addEventListener('click', ()=> {
    if (typeof switchScreen === 'function') switchScreen('settings');
  });
  // About modal open
  const aboutBtn = document.getElementById('open-about');
  if (aboutBtn) {
    aboutBtn.addEventListener('click', ()=> {
      const modal = document.getElementById('about-modal');
      if (modal) {
        modal.setAttribute('aria-hidden','false');
      }
    });
  }
  // About modal close wiring
  const aboutModal = document.getElementById('about-modal');
  if (aboutModal) {
    const close = document.getElementById('about-close');
    const ok = document.getElementById('about-ok');
    function closeAbout() {
      aboutModal.setAttribute('aria-hidden','true');
    }
    if (close) close.addEventListener('click', closeAbout);
    if (ok) ok.addEventListener('click', closeAbout);
    // close when clicking backdrop
    aboutModal.addEventListener('click', (ev)=> {
      if (ev.target === aboutModal) closeAbout();
    });
    // close on Esc
    document.addEventListener('keydown', (e)=> {
      if (e.key === 'Escape' && aboutModal.getAttribute('aria-hidden') === 'false') closeAbout();
    });
  }

  document.getElementById('apply-btn').addEventListener('click', ()=> {
    startGame();
    if (typeof switchScreen === 'function') switchScreen('game');
  });
  document.getElementById('cancel-btn').addEventListener('click', ()=> {
    if (typeof switchScreen === 'function') switchScreen('game');
  });
  document.getElementById('play-again').addEventListener('click', ()=> {
    startGame();
    if (typeof switchScreen === 'function') switchScreen('game');
  });

  // Save settings as YAML
  const saveBtn = document.getElementById('save-settings');
  if (saveBtn) {
    saveBtn.addEventListener('click', ()=> {
      const settingsObj = {
        keys: [
          document.getElementById('kb-0').dataset.key || 'D',
          document.getElementById('kb-1').dataset.key || 'F',
          document.getElementById('kb-2').dataset.key || 'J',
          document.getElementById('kb-3').dataset.key || 'K'
        ],
        scroll: document.getElementById('setting-scroll').value,
        length: parseInt(document.getElementById('setting-length').value) || 50,
        lives: parseInt(document.getElementById('setting-lives').value) || 10,
        botNPS: parseInt(document.getElementById('setting-botNPS').value) || 10,
        doubles: document.getElementById('setting-doubles').checked,
        multis: document.getElementById('setting-multis').checked,
        jacks: document.getElementById('setting-jacks').checked,
        wave: document.getElementById('setting-wave') ? document.getElementById('setting-wave').checked : false,
        bot: document.getElementById('setting-bot').checked,
        noteSkin: document.getElementById('setting-noteSkin') ? document.getElementById('setting-noteSkin').value : 'squares',
        noteColor: document.getElementById('setting-noteColor') ? document.getElementById('setting-noteColor').value : 'default'
      };
      const yaml = settingsToYAML(settingsObj);
      const blob = new Blob([yaml], { type: 'text/yaml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'dfjk-settings.yaml';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(()=>URL.revokeObjectURL(url), 3000);
    });
  }

  // Load settings from YAML file
  const loadBtn = document.getElementById('load-settings');
  const fileInput = document.getElementById('load-file-input');
  if (loadBtn && fileInput) {
    loadBtn.addEventListener('click', ()=> fileInput.click());
    fileInput.addEventListener('change', (e)=>{
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = function(ev) {
        try {
          const txt = ev.target.result || '';
          const parsed = parseSettingsYAML(txt);
          applySettingsToDOM(parsed);
        } catch(err) {
          console.warn('Failed to parse settings file', err);
        } finally {
          fileInput.value = '';
        }
      };
      reader.readAsText(f);
    });
  }

  // Load the premade OrgeYT settings packaged with the project
  const loadOrgeBtn = document.getElementById('load-orge');
  if (loadOrgeBtn) {
    loadOrgeBtn.addEventListener('click', async () => {
      try {
        const res = await fetch('OrgeYTsettings.yaml');
        if (!res.ok) throw new Error('Failed to fetch preset');
        const txt = await res.text();
        const parsed = parseSettingsYAML(txt);
        applySettingsToDOM(parsed);
      } catch (err) {
        console.warn('Could not load Orge preset', err);
      }
    });
  }

  // Allow pressing Enter on the result screen to auto-press "PLAY AGAIN"
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const resultScreen = document.getElementById('result-screen');
      if (resultScreen && resultScreen.classList.contains('active')) {
        const playBtn = document.getElementById('play-again');
        if (playBtn) playBtn.click();
      }
    }
  });
}
