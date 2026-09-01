/* main.js
   Full application logic migrated from original app.js into this module to improve structure.
   This file contains the original behavior (highlighting, ASMR, selection toolbar, modals, file handling).
*/

import { asmSoundFiles, idleGif, yeahGif, voiceLine } from './assets.js';

const editor = document.getElementById('editor');
const highlighting = document.getElementById('highlighting');
const htmlRoot = document.getElementById('html-root');
const fileUpload = document.getElementById('file-upload');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toast-message');

let asmrEnabled = false;
let audioCtx = null;
let lastKeyTime = 0;

// ----------- Highlighting / Markdown-ish preview -----------
function updateHighlighting() {
    const val = editor.value;
    if (val === '') {
        highlighting.innerHTML = '<span class="text-gray-400 dark:text-gray-600">Start Typing...</span>';
        return;
    }

    // Determine current caret line index and column
    const caretPos = editor.selectionStart || 0;
    const before = val.substring(0, caretPos);
    const caretLineIndex = before.split('\n').length - 1;
    const lines = val.split('\n');
    const caretLineText = lines[caretLineIndex] || '';
    const lastNewline = before.lastIndexOf('\n');
    const colIndex = caretPos - (lastNewline + 1); // column within the line

    // Escape HTML
    const escapeHtml = (str) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Build processed lines and inject typing-line with an inline caret for exact placement
    const processed = lines.map((rawLine, idx) => {
        let lineHtml = escapeHtml(rawLine);

        // Headings (line-level)
        if (/^### (.*$)/.test(lineHtml)) {
            lineHtml = lineHtml.replace(/^### (.*$)/, '<div class="text-xl font-bold"><span class="opacity-40">### </span>$1</div>');
        } else if (/^## (.*$)/.test(lineHtml)) {
            lineHtml = lineHtml.replace(/^## (.*$)/, '<div class="text-2xl font-bold"><span class="opacity-40">## </span>$1</div>');
        } else if (/^# (.*$)/.test(lineHtml)) {
            lineHtml = lineHtml.replace(/^# (.*$)/, '<div class="text-3xl font-bold"><span class="opacity-40"># </span>$1</div>');
        } else {
            // Inline Styles (non-greedy)
            lineHtml = lineHtml
                .replace(/\*\*([\s\S]*?)\*\*/g, '<span class="font-bold"><span class="opacity-40">**</span>$1<span class="opacity-40">**</span></span>')
                .replace(/\*([\s\S]*?)\*/g, '<span class="italic"><span class="opacity-40">*</span>$1<span class="opacity-40">*</span></span>')
                .replace(/__([\s\S]*?)__/g, '<span class="underline"><span class="opacity-40">__</span>$1<span class="opacity-40">__</span></span>')
                .replace(/~~([\s\S]*?)~~/g, '<span class="line-through"><span class="opacity-40">~~</span>$1<span class="opacity-40">~~</span></span>');
            // wrap plain lines in a div for consistent spacing
            lineHtml = `<div>${lineHtml || '<br>'}</div>`;
        }

        // If this is the caret line, insert an inline caret span exactly at the column position.
        if (idx === caretLineIndex) {
            // Work with raw (un-HTML) parts to ensure caret lands at the character boundary
            const beforeCaretRaw = caretLineText.substring(0, colIndex);
            const afterCaretRaw = caretLineText.substring(colIndex);

            // Escape both halves for HTML insertion
            const beforeEsc = escapeHtml(beforeCaretRaw) || '';
            const afterEsc = escapeHtml(afterCaretRaw) || '';

            // If heading produced a <div> wrapper, preserve heading markup but inject caret inline.
            if (lineHtml.startsWith('<div')) {
                // find contents inside the first div tag
                lineHtml = lineHtml.replace(/^(<div[^>]*>)([\s\S]*?)(<\/div>)$/, (m, open, content, close) => {
                    return `<div class="typing-line">${open === '<div>' ? '' : ''}${open}${beforeEsc}<span class="caret-pos-inline"></span>${afterEsc}${close}</div>`;
                });
            } else {
                // Normal line: create typing-line with inline caret between the halves
                lineHtml = `<div class="typing-line">${beforeEsc}<span class="caret-pos-inline"></span>${afterEsc || '<br>'}</div>`;
            }
        }

        return lineHtml;
    });

    highlighting.innerHTML = processed.join('');

    // Keep highlighting scrolled to match editor (including horizontal)
    highlighting.scrollTop = editor.scrollTop;
    highlighting.scrollLeft = editor.scrollLeft;
}

// Keep scroll positions in sync
editor.addEventListener('input', updateHighlighting);
editor.addEventListener('scroll', () => { highlighting.scrollTop = editor.scrollTop; });

// Also update highlighting when caret/selection changes without input (arrow keys, clicks, mouse selection, programmatic changes).
// keyup covers arrow/home/end/pgup/pgdn; click/mouseup handle mouse caret moves; selectionchange detects other selection changes.
editor.addEventListener('keyup', (e) => {
    // ignore modifier-only keys to avoid redundant work
    const ignored = ['Shift', 'Control', 'Alt', 'Meta'];
    if (ignored.includes(e.key)) return;
    // slight defer to let browser update selection/caret
    setTimeout(updateHighlighting, 0);
});
editor.addEventListener('click', () => setTimeout(updateHighlighting, 0));
editor.addEventListener('mouseup', () => setTimeout(updateHighlighting, 0));

// document-level selectionchange: only update when editor is focused (covers programmatic moves)
document.addEventListener('selectionchange', () => {
    if (document.activeElement === editor) {
        setTimeout(updateHighlighting, 0);
    }
});

// Basic formatting actions
function applyFormat(tag) {
    const start = editor.selectionStart, end = editor.selectionEnd;
    const t = editor.value;
    editor.value = t.substring(0, start) + tag + t.substring(start, end) + tag + t.substring(end);
    updateHighlighting();
    editor.focus();
    // restore selection inside tags
    editor.selectionStart = start + tag.length;
    editor.selectionEnd = end + tag.length;
}

function applyHeading() {
    const lines = editor.value.split('\n');
    const row = editor.value.substring(0, editor.selectionStart).split('\n').length - 1;
    let line = lines[row] || '';
    if (line.startsWith('### ')) lines[row] = line.replace('### ', '');
    else if (line.startsWith('## ')) lines[row] = '### ' + line.replace('## ', '');
    else if (line.startsWith('# ')) lines[row] = '## ' + line.replace('# ', '');
    else lines[row] = '# ' + line;
    editor.value = lines.join('\n');
    updateHighlighting();
    editor.focus();
}

// Theme toggle
function toggleTheme() {
    htmlRoot.classList.toggle('dark');
}

// Modals
function showModal(id) {
    const modal = document.getElementById(id);
    const backdrop = document.getElementById('modal-backdrop');
    if (!modal) return;
    backdrop.classList.remove('hidden');
    setTimeout(() => backdrop.classList.remove('opacity-0'), 10);
    modal.classList.remove('hidden');
    const content = modal.querySelector('div');
    if (content) {
        setTimeout(() => {
            content.classList.remove('scale-95');
            content.classList.remove('opacity-0');
        }, 10);
    }
}

function hideModal(id) {
    const modal = document.getElementById(id);
    const backdrop = document.getElementById('modal-backdrop');
    if (!modal) return;
    const content = modal.querySelector('div');
    if (content) {
        content.classList.add('scale-95');
        content.classList.add('opacity-0');
    }
    setTimeout(() => {
        modal.classList.add('hidden');
        backdrop.classList.add('hidden');
        backdrop.classList.add('opacity-0');
    }, 200);
}

// Clear flow
function confirmClear() {
    editor.value = '';
    updateHighlighting();
    hideModal('clear-modal');
    showToast('Cleared');
}

// Save flow
function confirmSave() {
    const filenameInput = document.getElementById('filename');
    const name = (filenameInput && filenameInput.value.trim()) ? filenameInput.value.trim() : 'untitled';
    const blob = new Blob([editor.value], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name.endsWith('.txt') || name.endsWith('.md') ? name : name + '.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    hideModal('save-modal');
    showToast('Saved');
}

// File upload handling
function handleFileUpload(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
        editor.value = String(reader.result || '');
        updateHighlighting();
        showToast('File loaded');
    };
    reader.onerror = () => showToast('Failed to load file');
    reader.readAsText(f);
    // reset input so same file can be selected again
    fileUpload.value = '';
}

// Toast
let toastTimer = null;
function showToast(msg, duration = 2500) {
    if (toastTimer) clearTimeout(toastTimer);
    toastMessage.textContent = msg;
    toast.classList.remove('translate-y-20','opacity-0');
    setTimeout(() => toast.classList.remove('opacity-0'), 10);
    toastTimer = setTimeout(() => {
        toast.classList.add('translate-y-20','opacity-0');
    }, duration);
}

/* ASMR using provided keyboard .wav assets.
   Preload audio elements and play them in a rotating sequence for each keypress.
   Asset paths are provided by ./assets.js */
const asmAudioPool = asmSoundFiles.map(src => {
  const a = new Audio(src);
  a.preload = 'auto';
  a.volume = 0.18; // keep pleasant, adjust if needed
  return a;
});
let asmAudioIndex = 0;

function ensureAudioCtx() {
    // keep for compatibility (some browsers require user gesture to resume context)
    if (!audioCtx) {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            // fallback - silence if AudioContext unavailable
            audioCtx = null;
        }
    }
}

function playClick() {
    if (!asmrEnabled) return;
    // Try to use simple HTMLAudioElements (preloaded). Clone to allow overlapping quick presses.
    const idx = asmAudioIndex % asmAudioPool.length;
    const srcElem = asmAudioPool[idx];
    asmAudioIndex = (asmAudioIndex + 1) % asmAudioPool.length;
    try {
        // cloneNode so multiple rapid keypresses can overlap
        const inst = srcElem.cloneNode();
        inst.volume = srcElem.volume;
        // reset playback position immediately to avoid per-device startup delay
        try {
            inst.currentTime = 0;
        } catch (err) {
            // some browsers disallow setting currentTime until loaded; ignore and proceed
        }
        // attempt to play; if blocked, try resuming AudioContext then replay
        inst.play().catch(() => {
            if (audioCtx && audioCtx.state === 'suspended') {
                audioCtx.resume().catch(() => {}).then(() => {
                    // try to restart audio after resuming context
                    try { inst.currentTime = 0; } catch (e) {}
                    inst.play().catch(() => {});
                });
            }
        });
    } catch (e) {
        // fallback to tiny oscillator if audio elements fail
        ensureAudioCtx();
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(1300, now);
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.04, now + 0.001);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        o.connect(g);
        g.connect(audioCtx.destination);
        o.start(now);
        o.stop(now + 0.08);
    }
}

// Hook up buttons and events
document.getElementById('btn-bold').addEventListener('click', () => applyFormat('**'));
document.getElementById('btn-italic').addEventListener('click', () => applyFormat('*'));
document.getElementById('btn-underline').addEventListener('click', () => applyFormat('__'));
document.getElementById('btn-strike').addEventListener('click', () => applyFormat('~~'));
document.getElementById('btn-heading').addEventListener('click', applyHeading);

document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

const asmrBtn = document.getElementById('asmr-btn');
asmrBtn.addEventListener('click', toggleAsmr);

document.getElementById('btn-upload').addEventListener('click', () => fileUpload.click());
fileUpload.addEventListener('change', handleFileUpload);

document.getElementById('btn-clear').addEventListener('click', () => showModal('clear-modal'));
document.getElementById('clear-cancel').addEventListener('click', () => hideModal('clear-modal'));
document.getElementById('clear-confirm').addEventListener('click', confirmClear);

document.getElementById('btn-save').addEventListener('click', () => showModal('save-modal'));
document.getElementById('save-confirm').addEventListener('click', confirmSave);

// Keyboard ASMR toggle
function toggleAsmr() {
    asmrEnabled = !asmrEnabled;
    document.getElementById('icon-asmr-off').classList.toggle('hidden', asmrEnabled);
    document.getElementById('icon-asmr-on').classList.toggle('hidden', !asmrEnabled);
    showToast(asmrEnabled ? 'ASMR on' : 'ASMR off', 1200);
    if (asmrEnabled) ensureAudioCtx();
}

 // Play click on typing
 editor.addEventListener('keydown', (e) => {
     // allow system interactions without sound (ctrl/meta/alt)
     if (e.ctrlKey || e.altKey || e.metaKey) return;
     // play sound on every keydown (no rate-limit)
     playClick();
 });

// Keep highlight updated initially and ensure there's no maxlength cap
window.addEventListener('load', () => {
    // remove any maxlength attribute so typing is effectively unlimited
    if (editor.hasAttribute && editor.hasAttribute('maxlength')) editor.removeAttribute('maxlength');
    editor.focus();
    updateHighlighting();
});

// sync scroll when content changed via script
new MutationObserver(() => {
    highlighting.scrollTop = editor.scrollTop;
}).observe(highlighting, { childList: true, subtree: true });

 // Accessibility: close modals on backdrop click or Escape
document.getElementById('modal-backdrop').addEventListener('click', () => {
    hideModal('clear-modal');
    hideModal('save-modal');
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        hideModal('clear-modal');
        hideModal('save-modal');
    }
});

/* Custom selection toolbar:
   - Shows when user selects text in the editor
   - Positions itself above the selection (keeps inside viewport)
   - Buttons reuse existing formatting functions
*/
const selectionToolbar = document.getElementById('selection-toolbar');

function showSelectionToolbar() {
    const selStart = editor.selectionStart;
    const selEnd = editor.selectionEnd;
    if (document.activeElement !== editor || selStart === selEnd) {
        hideSelectionToolbar();
        return;
    }

    // Compute screen position of the selection using textarea caret coordinates via mirror technique
    // Build mirror
    let mirror = document.getElementById('caret-mirror');
    if (!mirror) {
        mirror = document.createElement('div');
        mirror.id = 'caret-mirror';
        document.body.appendChild(mirror);
    }

    const style = window.getComputedStyle(editor);
    const props = [
        'font-size','font-family','font-weight','line-height','padding-top','padding-left',
        'padding-right','padding-bottom','border-left-width','border-top-width','white-space',
        'letter-spacing','word-spacing','text-transform','text-indent'
    ];
    const mStyle = mirror.style;
    mStyle.whiteSpace = 'pre-wrap';
    mStyle.wordWrap = 'break-word';
    mStyle.position = 'absolute';
    mStyle.visibility = 'hidden';
    mStyle.pointerEvents = 'none';

    props.forEach(p => {
        mStyle[p] = style.getPropertyValue(p);
    });

    // mirror content up to selection start and selection content
    const before = editor.value.substring(0, selStart);
    const selected = editor.value.substring(selStart, selEnd) || ' ';
    // To force measuring, replace spaces with nbsp where appropriate
    const esc = (s) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/ /g, '\u00a0');
    mirror.innerHTML = esc(before) + '<span id="sel-measure">' + esc(selected) + '</span>';

    // measure position relative to textarea
    const textareaRect = editor.getBoundingClientRect();
    const span = document.getElementById('sel-measure');
    if (!span) { hideSelectionToolbar(); return; }
    const spanRect = span.getBoundingClientRect();

    // compute toolbar center x near selection center and y above the selection rect
    const selCenterX = Math.min(Math.max(spanRect.left + spanRect.width / 2, textareaRect.left + 8), textareaRect.right - 8);
    const toolbarRect = selectionToolbar.getBoundingClientRect();
    const top = Math.max(window.scrollY + textareaRect.top + (spanRect.top - textareaRect.top) - toolbarRect.height - 8, window.scrollY + 8);
    const left = Math.min(Math.max(window.scrollX + selCenterX - (toolbarRect.width / 2), 8), window.scrollX + document.documentElement.clientWidth - toolbarRect.width - 8);

    selectionToolbar.style.left = `${left}px`;
    selectionToolbar.style.top = `${top}px`;
    selectionToolbar.classList.remove('opacity-0');
    selectionToolbar.style.pointerEvents = 'auto';
    selectionToolbar.style.transform = 'translateY(0)';
}

function hideSelectionToolbar() {
    if (!selectionToolbar) return;
    selectionToolbar.classList.add('opacity-0');
    selectionToolbar.style.pointerEvents = 'none';
    selectionToolbar.style.transform = 'translateY(-8px)';
}

// react to selection/caret changes
editor.addEventListener('mouseup', () => setTimeout(showSelectionToolbar, 0));
editor.addEventListener('keyup', (e) => {
    const ignored = ['Shift','Control','Alt','Meta','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'];
    if (!ignored.includes(e.key)) setTimeout(showSelectionToolbar, 0);
    else setTimeout(() => {
        // arrow keys may still move caret and should hide toolbar if no selection
        showSelectionToolbar();
    }, 0);
});

// Hide toolbar when editor loses focus or selection cleared
editor.addEventListener('blur', () => setTimeout(hideSelectionToolbar, 150));
document.addEventListener('selectionchange', () => {
    if (document.activeElement === editor) setTimeout(showSelectionToolbar, 0);
});

// Wire up toolbar buttons to existing formatting functions
selectionToolbar.querySelectorAll('.sel-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const act = btn.getAttribute('data-act');
        const start = editor.selectionStart, end = editor.selectionEnd;
        if (start === end) return;
        // applyFormat works by inserting tags around the selection; reuse for inline tags
        if (act === 'bold') {
            applyFormat('**');
        } else if (act === 'italic') {
            applyFormat('*');
        } else if (act === 'underline') {
            applyFormat('__');
        } else if (act === 'strike') {
            applyFormat('~~');
        } else if (act === 'heading') {
            // apply heading to the entire lines spanned by selection
            const val = editor.value;
            const lines = val.split('\n');
            const startLine = val.substring(0, start).split('\n').length - 1;
            const endLine = val.substring(0, end).split('\n').length - 1;
            for (let i = startLine; i <= endLine; i++) {
                const line = lines[i] || '';
                lines[i] = line.startsWith('# ') ? '## ' + line.replace(/^# /, '') : '# ' + line;
            }
            editor.value = lines.join('\n');
            updateHighlighting();
        }
        // refocus and keep selection adjusted (applyFormat already focuses)
        editor.focus();
        // hide toolbar slightly after action
        setTimeout(hideSelectionToolbar, 120);
    });
});

// Mascot: idle GIF next to Save, click to play voice and switch to "yeah" GIF briefly
(function setupMascot() {
    const mascot = document.getElementById('mascot');
    const bubbleWrap = document.getElementById('mascot-bubble');
    if (!mascot) return;
    const idleSrc = idleGif;
    const yeahSrc = yeahGif;
    const voice = new Audio(voiceLine);
    voice.preload = 'auto';

    // allow rapid/spammable clicks: clear previous revert timer and restart visuals & audio
    let revertTimeout = null;
    function showBubble(duration = 1400) {
        if (!bubbleWrap) return;
        // make visible so we can measure its size
        bubbleWrap.classList.remove('hidden');

        // reposition bubble centered beneath mascot
        const mRect = mascot.getBoundingClientRect();
        // allow the DOM to update and then measure the bubble size
        requestAnimationFrame(() => {
            const bRect = bubbleWrap.getBoundingClientRect();
            // compute left so bubble is horizontally centered under the mascot
            const left = mRect.left + window.scrollX + (mRect.width / 2) - (bRect.width / 2);
            const top = mRect.bottom + 8 + window.scrollY; // small gap underneath mascot
            bubbleWrap.style.left = `${Math.max(8, Math.min(left, document.documentElement.clientWidth - bRect.width - 8))}px`;
            bubbleWrap.style.top = `${top}px`;
        });

        if (revertTimeout) clearTimeout(revertTimeout);
        revertTimeout = setTimeout(() => {
            bubbleWrap.classList.add('hidden');
            revertTimeout = null;
        }, duration);
    }

    mascot.addEventListener('click', () => {
        // switch to "yeah" animation (may be clicked repeatedly)
        mascot.src = yeahSrc;
        // play voice from start; allow overlapping by creating short clone
        try {
            const inst = voice.cloneNode();
            inst.preload = 'auto';
            inst.currentTime = 0;
            inst.play().catch(() => {});
        } catch (e) {
            // fallback: try to play main voice object
            try { voice.currentTime = 0; voice.play().catch(() => {}); } catch (e) {}
        }

        // show speech bubble (not toast)
        showBubble(1200);

        // revert mascot gif after a short time; reset any previous timer so spammable clicks extend it
        if (revertTimeout) clearTimeout(revertTimeout);
        revertTimeout = setTimeout(() => {
            mascot.src = idleSrc;
            // hide bubble if still visible
            if (bubbleWrap) bubbleWrap.classList.add('hidden');
            revertTimeout = null;
        }, 1200);
    });

    // ensure initial src is idle and bubble hidden
    mascot.src = idleSrc;
    if (bubbleWrap) bubbleWrap.classList.add('hidden');
})();