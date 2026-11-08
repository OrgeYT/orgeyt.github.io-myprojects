(() => {
  const ESC = '\u001b';

  // Elements
  const inputText = document.getElementById('inputText');
  const outputText = document.getElementById('outputText');
  const previewBody = document.getElementById('previewBody');
  const copyBtn = document.getElementById('copyBtn');
  const clearBtn = document.getElementById('clearBtn');
  const copyFeedback = document.getElementById('copyFeedback');

  // State for ANSI styles
  let ansiBold = false;
  let ansiUnderline = false;

  // ========== Tabs ==========
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    });
  });

  // ========== Helpers ==========
  function getSelection() {
    const start = inputText.selectionStart;
    const end = inputText.selectionEnd;
    const value = inputText.value;
    return {
      start,
      end,
      selected: value.slice(start, end),
      before: value.slice(0, start),
      after: value.slice(end)
    };
  }

  function setValue(newValue, cursorPos) {
    inputText.value = newValue;
    inputText.focus();
    if (typeof cursorPos === 'number') {
      inputText.setSelectionRange(cursorPos, cursorPos);
    }
    updateOutput();
  }

  function wrapSelection(before, after = before) {
    const { start, end, selected, before: b, after: a } = getSelection();
    const text = selected || 'text';
    const newVal = b + before + text + after + a;
    setValue(newVal, start + before.length + text.length + after.length);
  }

  function insertAtCursor(text) {
    const { start, before, after } = getSelection();
    setValue(before + text + after, start + text.length);
  }

  function prefixLines(prefix) {
    const { start, end, selected, before, after } = getSelection();
    if (!selected) {
      // Apply to current line
      const lines = inputText.value.split('\n');
      let charCount = 0;
      let lineIndex = 0;
      for (let i = 0; i < lines.length; i++) {
        if (charCount + lines[i].length >= start) {
          lineIndex = i;
          break;
        }
        charCount += lines[i].length + 1;
      }
      lines[lineIndex] = prefix + lines[lineIndex];
      setValue(lines.join('\n'), start + prefix.length);
      return;
    }
    const newSelected = selected
      .split('\n')
      .map(line => prefix + line)
      .join('\n');
    setValue(before + newSelected + after, start + newSelected.length);
  }

  // ========== Markdown Format Buttons ==========
  document.querySelectorAll('[data-fmt]').forEach(btn => {
    btn.addEventListener('click', () => {
      const fmt = btn.dataset.fmt;
      switch (fmt) {
        case 'bold':
          wrapSelection('**');
          break;
        case 'italic':
          wrapSelection('*');
          break;
        case 'underline':
          wrapSelection('__');
          break;
        case 'strike':
          wrapSelection('~~');
          break;
        case 'spoiler':
          wrapSelection('||');
          break;
        case 'code':
          wrapSelection('`');
          break;
        case 'h1':
          prefixLines('# ');
          break;
        case 'h2':
          prefixLines('## ');
          break;
        case 'h3':
          prefixLines('### ');
          break;
        case 'subtext':
          prefixLines('-# ');
          break;
        case 'quote':
          prefixLines('> ');
          break;
        case 'quote-all':
          insertAtCursor('>>> ');
          break;
        case 'bullet':
          prefixLines('- ');
          break;
        case 'number':
          prefixLines('1. ');
          break;
        case 'codeblock': {
          const { selected, before, after, start } = getSelection();
          const text = selected || 'code here';
          const block = '```\n' + text + '\n```';
          setValue(before + block + after, start + block.length);
          break;
        }
        case 'link': {
          const { selected, before, after, start } = getSelection();
          const text = selected || 'link text';
          const link = `[${text}](https://example.com)`;
          setValue(before + link + after, start + link.length);
          break;
        }
      }
    });
  });

  // ========== ANSI ==========
  function buildAnsiCode(fg, bg, styles) {
    const parts = [];
    if (styles.includes(1)) parts.push('1');
    if (styles.includes(4)) parts.push('4');
    if (fg) parts.push(String(fg));
    if (bg) parts.push(String(bg));
    if (parts.length === 0) return '';
    return ESC + '[' + parts.join(';') + 'm';
  }

  const ansiTextInput = document.getElementById('ansiTextInput');
  let skipAnsiBlock = false;

  // ========== Chat / Dialogue Builder ==========
  const chatNameInput = document.getElementById('chatName');
  const chatMessageInput = document.getElementById('chatMessage');
  const chatPreview = document.getElementById('chatPreview');
  let chatLines = []; // { raw, html, type: 'chat'|'narration' }
  let selectedNameColor = 33; // default yellow
  let nameBold = false;
  let nameUnderline = false;
  let undoStack = [];
  let redoStack = [];

  function snapshotChat() {
    return chatLines.map(l => ({ raw: l.raw, html: l.html, type: l.type }));
  }

  function pushHistory() {
    undoStack.push(snapshotChat());
    if (undoStack.length > 50) undoStack.shift();
    redoStack = [];
  }

  function restoreSnapshot(snap) {
    chatLines = snap.map(l => ({ raw: l.raw, html: l.html, type: l.type }));
    updateChatPreview();
  }

  document.querySelectorAll('#chatNameColors .mini-color').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#chatNameColors .mini-color').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedNameColor = parseInt(btn.dataset.code, 10);
    });
  });
  const defaultColorBtn = document.querySelector('#chatNameColors .mini-color[data-code="33"]');
  if (defaultColorBtn) defaultColorBtn.classList.add('active');

  document.getElementById('nameBold').addEventListener('click', function () {
    nameBold = !nameBold;
    this.classList.toggle('active', nameBold);
  });
  document.getElementById('nameUnderline').addEventListener('click', function () {
    nameUnderline = !nameUnderline;
    this.classList.toggle('active', nameUnderline);
  });

  function buildNameCode(code) {
    const parts = [];
    if (nameBold) parts.push('1');
    if (nameUnderline) parts.push('4');
    parts.push(String(code));
    return ESC + '[' + parts.join(';') + 'm';
  }

  function colorName(name, code) {
    return buildNameCode(code) + name + ESC + '[0m';
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function updateChatPreview() {
    if (chatLines.length === 0) {
      chatPreview.innerHTML = '<span class="placeholder">Lines will appear here...</span>';
      return;
    }
    chatPreview.innerHTML = chatLines.map(l => l.html).join('<br>');
  }

  function getDialogueOutput() {
    if (chatLines.length === 0) return '';
    const body = chatLines.map(l => l.raw).join('\n');
    return '```ansi\n' + body + '\n```';
  }

  function addChatLine(isNarration = false) {
    const name = chatNameInput.value.trim();
    const msg = chatMessageInput.value.trim();

    if (isNarration) {
      const text = msg || name;
      if (!text) return;
      pushHistory();
      const raw = ESC + '[4;30m' + text + ESC + '[0m';
      const html = '<span class="ansi-30 ansi-underline">' + escapeHtml(text) + '</span>';
      chatLines.push({ raw, html, type: 'narration' });
    } else {
      if (!name && !msg) return;
      pushHistory();
      const displayName = name || '???';
      const raw = colorName(displayName + ':', selectedNameColor) + (msg ? ' ' + msg : '');
      const classes = ['ansi-' + selectedNameColor];
      if (nameBold) classes.push('ansi-bold');
      if (nameUnderline) classes.push('ansi-underline');
      const html = '<span class="' + classes.join(' ') + '">' + escapeHtml(displayName) + ':</span>' + (msg ? ' ' + escapeHtml(msg) : '');
      chatLines.push({ raw, html, type: 'chat' });
    }

    chatMessageInput.value = '';
    chatMessageInput.focus();
    updateChatPreview();
  }

  function removeLastOfType(type) {
    for (let i = chatLines.length - 1; i >= 0; i--) {
      if (chatLines[i].type === type) {
        pushHistory();
        chatLines.splice(i, 1);
        updateChatPreview();
        return;
      }
    }
  }

  function undoChat() {
    if (undoStack.length === 0) return;
    redoStack.push(snapshotChat());
    restoreSnapshot(undoStack.pop());
  }

  function redoChat() {
    if (redoStack.length === 0) return;
    undoStack.push(snapshotChat());
    restoreSnapshot(redoStack.pop());
  }

  document.getElementById('addChatLine').addEventListener('click', () => addChatLine(false));
  document.getElementById('addNarration').addEventListener('click', () => addChatLine(true));

  document.getElementById('insertChatBlock').addEventListener('click', () => {
    const output = getDialogueOutput();
    if (!output) return;
    insertAtCursor(output + '\n');
  });

  document.getElementById('copyChatBlock').addEventListener('click', async () => {
    const output = getDialogueOutput();
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      const btn = document.getElementById('copyChatBlock');
      const old = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = old; }, 1500);
    } catch (err) {
      const ta = document.createElement('textarea');
      ta.value = output;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      const btn = document.getElementById('copyChatBlock');
      const old = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = old; }, 1500);
    }
  });

  document.getElementById('removeLastChat').addEventListener('click', () => removeLastOfType('chat'));
  document.getElementById('removeLastNarration').addEventListener('click', () => removeLastOfType('narration'));
  document.getElementById('undoChat').addEventListener('click', undoChat);
  document.getElementById('redoChat').addEventListener('click', redoChat);

  document.getElementById('clearChatBuilder').addEventListener('click', () => {
    if (chatLines.length === 0) return;
    pushHistory();
    chatLines = [];
    updateChatPreview();
  });

  chatMessageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addChatLine(false);
    }
  });
  chatNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      chatMessageInput.focus();
    }
  });

  function getAnsiText() {
    // Prefer the dedicated input, then selection, then a default
    const fromInput = ansiTextInput.value.trim();
    if (fromInput) return fromInput;

    const { selected } = getSelection();
    if (selected) return selected;

    return 'colored text';
  }

  function wrapAnsiIfNeeded(colored) {
    if (skipAnsiBlock) return colored;
    return '```ansi\n' + colored + '\n```';
  }

  function applyAnsi(fg = null, bg = null) {
    const styles = [];
    if (ansiBold) styles.push(1);
    if (ansiUnderline) styles.push(4);

    const text = getAnsiText();
    const open = buildAnsiCode(fg, bg, styles);
    const close = ESC + '[0m';
    const colored = open + text + close;
    const output = wrapAnsiIfNeeded(colored);

    insertAtCursor(output + (skipAnsiBlock ? '' : '\n'));
  }

  // Foreground colors
  document.querySelectorAll('#fgColors .color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      applyAnsi(parseInt(btn.dataset.code, 10), null);
    });
  });

  // Background colors
  document.querySelectorAll('#bgColors .color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      applyAnsi(null, parseInt(btn.dataset.code, 10));
    });
  });

  // Bold / Underline toggles
  document.getElementById('ansiBold').addEventListener('click', function () {
    ansiBold = !ansiBold;
    this.classList.toggle('active', ansiBold);
  });

  document.getElementById('ansiUnderline').addEventListener('click', function () {
    ansiUnderline = !ansiUnderline;
    this.classList.toggle('active', ansiUnderline);
  });

  document.getElementById('ansiReset').addEventListener('click', () => {
    ansiBold = false;
    ansiUnderline = false;
    document.getElementById('ansiBold').classList.remove('active');
    document.getElementById('ansiUnderline').classList.remove('active');
  });

  // Skip ```ansi wrapper toggle
  document.getElementById('skipAnsiBlock').addEventListener('click', function () {
    skipAnsiBlock = !skipAnsiBlock;
    this.classList.toggle('active', skipAnsiBlock);
  });

  // Rainbow (no white / no gray) – cycles: Red → Yellow → Green → Cyan → Blue → Pink
  const RAINBOW_COLORS = [31, 33, 32, 36, 34, 35]; // no 30 (gray) or 37 (white)

  function applyRainbow() {
    const text = getAnsiText() === 'colored text' ? 'Rainbow text' : getAnsiText();
    let result = '';
    let colorIndex = 0;

    for (const char of text) {
      if (char === ' ' || char === '\n') {
        result += char;
        continue;
      }
      const code = RAINBOW_COLORS[colorIndex % RAINBOW_COLORS.length];
      result += ESC + '[' + code + 'm' + char + ESC + '[0m';
      colorIndex++;
    }

    const output = wrapAnsiIfNeeded(result);
    insertAtCursor(output + (skipAnsiBlock ? '' : '\n'));
  }

  document.getElementById('ansiRainbow').addEventListener('click', applyRainbow);

  ansiTextInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
    }
  });

  // ========== Symbols ==========
  const symbolSets = {
    symbolsStars: ['★', '☆', '✦', '✧', '✩', '✪', '✫', '✬', '✭', '✮', '✯', '✰', '⋆', '∗', '＊', '❇', '❈', '❉', '❊', '❋', '✨', '💫', '⭐', '🌟'],
    symbolsArrows: ['→', '←', '↑', '↓', '↔', '↕', '⇒', '⇐', '⇑', '⇓', '⇔', '➔', '➜', '➝', '➞', '➟', '➠', '➢', '➤', '➥', '➦', '➧', '➨', '➩', '➪', '➫', '➬', '➭', '➮', '➯', '➱', '➲', '➳', '➴', '➵', '➶', '➷', '➸', '➹', '➺', '➻', '➼', '➽', '➾'],
    symbolsStatus: ['✓', '✔', '✅', '☑', '✕', '✖', '❌', '❎', '⚠', '⚡', '❗', '❓', '❕', '❔', 'ℹ', '☑', '☐', '◉', '◎', '●', '○', '◐', '◑', '◒', '◓', '✓', '✗'],
    symbolsMisc: ['◆', '◇', '■', '□', '▪', '▫', '●', '○', '◆', '◈', '◊', '△', '▲', '▽', '▼', '◁', '▷', '◁', '▷', '♠', '♣', '♥', '♦', '♤', '♧', '♡', '♢', '♪', '♫', '♬', '♭', '♮', '♯', '☀', '☁', '☂', '☃', '☄', '☾', '☽', '✦', '✧'],
    symbolsBoxes: ['─', '│', '┌', '┐', '└', '┘', '├', '┤', '┬', '┴', '┼', '═', '║', '╔', '╗', '╚', '╝', '╠', '╣', '╦', '╩', '╬', '╭', '╮', '╯', '╰', '╱', '╲', '╳', '╴', '╵', '╶', '╷']
  };

  Object.keys(symbolSets).forEach(id => {
    const container = document.getElementById(id);
    if (!container) return;
    symbolSets[id].forEach(sym => {
      const btn = document.createElement('button');
      btn.className = 'symbol-btn';
      btn.textContent = sym;
      btn.title = 'Insert ' + sym;
      btn.addEventListener('click', () => insertAtCursor(sym));
      container.appendChild(btn);
    });
  });

  // ========== Presets ==========
  const presets = {
    warning: '```ansi\n' + ESC + '[1;31m⚠ WARNING' + ESC + '[0m\n' + ESC + '[31mSomething important needs attention.' + ESC + '[0m\n```',
    success: '```ansi\n' + ESC + '[1;32m✓ SUCCESS' + ESC + '[0m\n' + ESC + '[32mOperation completed successfully.' + ESC + '[0m\n```',
    info: '```ansi\n' + ESC + '[1;36mℹ INFO' + ESC + '[0m\n' + ESC + '[36mHere is some useful information.' + ESC + '[0m\n```',
    error: '```ansi\n' + ESC + '[1;37;41m ✕ ERROR ' + ESC + '[0m\n' + ESC + '[31mSomething went wrong. Please try again.' + ESC + '[0m\n```',
    title: '```ansi\n' + ESC + '[1;33m✦ Announcement Title' + ESC + '[0m\n```',
    code: '```js\nconst greeting = "Hello Discord!";\nconsole.log(greeting);\n```',
    rules: `# Server Rules\n\n1. Be respectful to everyone\n2. No spam or self-promotion\n3. Keep discussions in the right channels\n4. Have fun!\n\n-# Last updated: today`,
    rainbow: (() => {
      const word = 'Rainbow';
      let out = '```ansi\n';
      const colors = [31, 33, 32, 36, 34, 35];
      for (let i = 0; i < word.length; i++) {
        out += ESC + '[' + colors[i % colors.length] + 'm' + word[i] + ESC + '[0m';
      }
      out += ' text!\n```';
      return out;
    })()
  };

  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.preset;
      if (presets[key]) {
        inputText.value = presets[key];
        updateOutput();
        inputText.focus();
      }
    });
  });

  // ========== Output & Preview ==========
  function updateOutput() {
    const raw = inputText.value;
    outputText.textContent = raw || '';
    renderPreview(raw);
  }

  function renderPreview(text) {
    if (!text.trim()) {
      previewBody.innerHTML = '<span class="placeholder">Your formatted message will appear here...</span>';
      return;
    }

    // Very lightweight Discord-like rendering
    let html = text
      // Escape HTML first
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // ANSI blocks
    html = html.replace(/```ansi\n?([\s\S]*?)```/g, (_, content) => {
      let rendered = content;
      // Replace ANSI sequences with spans
      rendered = rendered.replace(/\u001b\[([0-9;]+)m/g, (_, codes) => {
        const parts = codes.split(';').map(Number);
        const classes = [];
        parts.forEach(c => {
          if (c === 0) return; // reset handled by closing
          if (c === 1) classes.push('ansi-bold');
          if (c === 4) classes.push('ansi-underline');
          if (c >= 30 && c <= 37) classes.push('ansi-' + c);
          if (c >= 40 && c <= 47) classes.push('ansi-bg-' + c);
        });
        if (parts.includes(0) || parts.length === 0) {
          return '</span>';
        }
        return `<span class="${classes.join(' ')}">`;
      });
      // Clean leftover resets
      rendered = rendered.replace(/\u001b\[0m/g, '</span>');
      return `<div class="preview-codeblock">${rendered}</div>`;
    });

    // Other code blocks
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, content) => {
      return `<div class="preview-codeblock">${content}</div>`;
    });

    // Headers
    html = html.replace(/^### (.+)$/gm, '<div class="preview-h3">$1</div>');
    html = html.replace(/^## (.+)$/gm, '<div class="preview-h2">$1</div>');
    html = html.replace(/^# (.+)$/gm, '<div class="preview-h1">$1</div>');

    // Subtext
    html = html.replace(/^-# (.+)$/gm, '<div class="preview-subtext">$1</div>');

    // Quotes
    html = html.replace(/^&gt; (.+)$/gm, '<div class="preview-quote">$1</div>');
    html = html.replace(/^&gt;&gt;&gt; (.+)$/gm, '<div class="preview-quote">$1</div>');

    // Lists (simple)
    html = html.replace(/^- (.+)$/gm, '<div class="preview-list">• $1</div>');
    html = html.replace(/^\d+\. (.+)$/gm, '<div class="preview-list">$1</div>');

    // Inline styles (order matters)
    html = html.replace(/\|\|(.+?)\|\|/g, '<span class="preview-spoiler" onclick="this.classList.toggle(\'revealed\')">$1</span>');
    html = html.replace(/`([^`]+)`/g, '<span class="preview-code">$1</span>');
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<span class="preview-bold preview-italic">$1</span>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<span class="preview-bold">$1</span>');
    html = html.replace(/\*(.+?)\*/g, '<span class="preview-italic">$1</span>');
    html = html.replace(/__(.+?)__/g, '<span class="preview-underline">$1</span>');
    html = html.replace(/~~(.+?)~~/g, '<span class="preview-strike">$1</span>');

    // Masked links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:#00a8fc;text-decoration:none;">$1</a>');

    // Newlines
    html = html.replace(/\n/g, '<br>');

    previewBody.innerHTML = html;
  }

  // ========== Events ==========
  inputText.addEventListener('input', updateOutput);
  inputText.addEventListener('keyup', updateOutput);

  clearBtn.addEventListener('click', () => {
    inputText.value = '';
    updateOutput();
    inputText.focus();
  });

  copyBtn.addEventListener('click', async () => {
    const text = outputText.textContent;
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      copyFeedback.classList.add('show');
      setTimeout(() => copyFeedback.classList.remove('show'), 1500);
    } catch (err) {
      // Fallback
      const range = document.createRange();
      range.selectNode(outputText);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      document.execCommand('copy');
      window.getSelection().removeAllRanges();
      copyFeedback.classList.add('show');
      setTimeout(() => copyFeedback.classList.remove('show'), 1500);
    }
  });

  // Initial
  updateOutput();
})();
