// ===========================================
// --- Custom Theme Editor ---
// Colors + optional background images (IndexedDB)
// Integrates with data-theme + existing backup system
// ===========================================

(function () {
    'use strict';

    const CUSTOM_THEMES_LS_KEY = 'orgeyt-custom-themes';
    const ACTIVE_CUSTOM_ID_KEY = 'orgeyt-active-custom-theme-id';
    const THEME_LS_KEY = 'orgeyt-theme';
    const CUSTOM_THEME_ATTR = 'custom';
    const DB_NAME = 'orgeyt-custom-theme-images';
    const DB_VERSION = 1;
    const STORE_NAME = 'images';
    const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
    const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

    const COLOR_VARS = [
        { key: '--bg-main', label: 'Main background' },
        { key: '--bg-sidebar', label: 'Sidebar background' },
        { key: '--border-main', label: 'Borders' },
        { key: '--text-main', label: 'Main text' },
        { key: '--text-accent', label: 'Accent text' },
        { key: '--btn-primary', label: 'Primary button' },
        { key: '--btn-primary-hover', label: 'Primary button hover' },
        { key: '--btn-secondary', label: 'Secondary button' },
        { key: '--btn-secondary-hover', label: 'Secondary button hover' },
        { key: '--accent-solid', label: 'Accent solid' }
        // --accent-transparent is derived
    ];

    const IMAGE_SLOTS = [
        { key: 'main', label: 'Main background', targets: 'body' },
        { key: 'sidebar', label: 'Sidebar background', targets: '.sidebar, .sidebar-rail' },
        { key: 'cards', label: 'Card / modal backgrounds', targets: '.modal-content, .whats-new, .website-update-card' }
    ];

    const DEFAULT_COLORS = {
        '--bg-main': '#1a0a00',
        '--bg-sidebar': '#331400',
        '--border-main': '#662900',
        '--text-main': '#ffffff',
        '--text-accent': '#cc8855',
        '--btn-primary': '#993d00',
        '--btn-primary-hover': '#b34700',
        '--btn-secondary': '#4d1f00',
        '--btn-secondary-hover': '#662900',
        '--accent-solid': '#cc5500',
        '--accent-transparent': 'rgba(204, 85, 0, 0.2)'
    };

    const DEFAULT_IMAGE_SETTINGS = {
        opacity: 1,
        blur: 0,
        size: 'cover',
        position: 'center'
    };

    let dbPromise = null;
    let objectUrlCache = Object.create(null); // imageId -> objectURL
    let editorState = null; // working copy while editor is open
    let editingThemeId = null; // null = new theme
    let styleEl = null;

    // ---------- IndexedDB ----------
    function openDB() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
            req.onsuccess = () => resolve(req.result);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            };
        });
        return dbPromise;
    }

    function idbPut(record) {
        return openDB().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put(record);
            tx.oncomplete = () => resolve(record.id);
            tx.onerror = () => reject(tx.error);
        }));
    }

    function idbGet(id) {
        return openDB().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).get(id);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        }));
    }

    function idbDelete(id) {
        return openDB().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        }));
    }

    function idbGetAll() {
        return openDB().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        }));
    }

    function revokeObjectUrl(id) {
        if (objectUrlCache[id]) {
            try { URL.revokeObjectURL(objectUrlCache[id]); } catch (_) {}
            delete objectUrlCache[id];
        }
    }

    async function getObjectUrl(imageId) {
        if (!imageId) return null;
        if (objectUrlCache[imageId]) return objectUrlCache[imageId];
        try {
            const rec = await idbGet(imageId);
            if (!rec || !rec.blob) return null;
            const url = URL.createObjectURL(rec.blob);
            objectUrlCache[imageId] = url;
            return url;
        } catch (_) {
            return null;
        }
    }

    function generateId(prefix) {
        return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    }

    // ---------- Theme list in localStorage ----------
    function loadCustomThemes() {
        try {
            const raw = localStorage.getItem(CUSTOM_THEMES_LS_KEY);
            if (!raw) return [];
            const arr = JSON.parse(raw);
            return Array.isArray(arr) ? arr : [];
        } catch (_) {
            return [];
        }
    }

    function saveCustomThemes(list) {
        localStorage.setItem(CUSTOM_THEMES_LS_KEY, JSON.stringify(list));
    }

    function getThemeById(id) {
        return loadCustomThemes().find(t => t.id === id) || null;
    }

    function getActiveCustomId() {
        return localStorage.getItem(ACTIVE_CUSTOM_ID_KEY) || null;
    }

    function setActiveCustomId(id) {
        if (id) localStorage.setItem(ACTIVE_CUSTOM_ID_KEY, id);
        else localStorage.removeItem(ACTIVE_CUSTOM_ID_KEY);
    }

    function hexToRgb(hex) {
        let h = String(hex || '').replace('#', '').trim();
        if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        if (h.length !== 6) return { r: 204, g: 85, b: 0 };
        const n = parseInt(h, 16);
        if (Number.isNaN(n)) return { r: 204, g: 85, b: 0 };
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }

    function makeTransparent(hex, opacity) {
        const { r, g, b } = hexToRgb(hex);
        const o = Math.max(0, Math.min(1, Number(opacity) || 0.2));
        return `rgba(${r}, ${g}, ${b}, ${o})`;
    }

    function normalizeColors(colors, accentOpacity) {
        const out = Object.assign({}, DEFAULT_COLORS, colors || {});
        const solid = out['--accent-solid'] || DEFAULT_COLORS['--accent-solid'];
        out['--accent-transparent'] = makeTransparent(solid, accentOpacity != null ? accentOpacity : 0.2);
        return out;
    }

    function createEmptyTheme(name) {
        return {
            id: generateId('ct'),
            name: name || 'My Custom Theme',
            colors: Object.assign({}, DEFAULT_COLORS),
            accentOpacity: 0.2,
            images: { main: null, sidebar: null, cards: null },
            imageSettings: {
                main: Object.assign({}, DEFAULT_IMAGE_SETTINGS),
                sidebar: Object.assign({}, DEFAULT_IMAGE_SETTINGS),
                cards: Object.assign({}, DEFAULT_IMAGE_SETTINGS)
            }
        };
    }

    // ---------- Apply theme to document ----------
    function ensureStyleEl() {
        if (styleEl && styleEl.parentNode) return styleEl;
        styleEl = document.getElementById('orgeyt-custom-theme-style');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'orgeyt-custom-theme-style';
            document.head.appendChild(styleEl);
        }
        return styleEl;
    }

    function clearCustomStyles() {
        const el = document.getElementById('orgeyt-custom-theme-style');
        if (el) el.textContent = '';
        document.documentElement.removeAttribute('data-custom-theme');
    }

    async function applyCustomTheme(theme) {
        if (!theme) {
            clearCustomStyles();
            return;
        }
        const colors = normalizeColors(theme.colors, theme.accentOpacity);
        const lines = [];
        lines.push(':root[data-theme="custom"], :root[data-custom-theme="1"] {');
        COLOR_VARS.forEach(({ key }) => {
            if (colors[key]) lines.push(`  ${key}: ${colors[key]};`);
        });
        lines.push(`  --accent-transparent: ${colors['--accent-transparent']};`);
        lines.push('}');

        // Background images
        const img = theme.images || {};
        const settings = theme.imageSettings || {};

        async function bgRule(selector, slotKey) {
            const id = img[slotKey];
            if (!id) return;
            const url = await getObjectUrl(id);
            if (!url) return;
            const s = Object.assign({}, DEFAULT_IMAGE_SETTINGS, settings[slotKey] || {});
            const opacity = Math.max(0, Math.min(1, Number(s.opacity) || 1));
            const blur = Math.max(0, Math.min(40, Number(s.blur) || 0));
            const size = s.size === 'contain' ? 'contain' : 'cover';
            const pos = s.position || 'center';
            // Overlay color under image so text stays readable when opacity < 1
            lines.push(`${selector} {`);
            lines.push(`  background-image: linear-gradient(rgba(0,0,0,${(1 - opacity).toFixed(3)}), rgba(0,0,0,${(1 - opacity).toFixed(3)})), url("${url}");`);
            lines.push(`  background-size: ${size}, ${size};`);
            lines.push(`  background-position: ${pos}, ${pos};`);
            lines.push(`  background-repeat: no-repeat, no-repeat;`);
            if (blur > 0) {
                // blur on element is harsh; use filter only lightly if needed — skip full element blur
            }
            lines.push('}');
        }

        await bgRule('body', 'main');
        await bgRule('.sidebar, .sidebar-rail', 'sidebar');
        await bgRule('.modal-content, .whats-new, .website-update-card', 'cards');

        ensureStyleEl().textContent = lines.join('\n');
        document.documentElement.setAttribute('data-theme', CUSTOM_THEME_ATTR);
        document.documentElement.setAttribute('data-custom-theme', '1');
        localStorage.setItem(THEME_LS_KEY, CUSTOM_THEME_ATTR);
        setActiveCustomId(theme.id);
    }

    async function applyCustomThemeById(id) {
        const theme = getThemeById(id);
        if (!theme) {
            clearCustomStyles();
            return false;
        }
        await applyCustomTheme(theme);
        return true;
    }

    // ---------- Editor UI ----------
    function getEditorModal() {
        return document.getElementById('custom-theme-modal');
    }

    function buildEditorStateFromTheme(theme) {
        return JSON.parse(JSON.stringify(theme));
    }

    function fillSavedThemesList() {
        const list = document.getElementById('cte-saved-list');
        if (!list) return;
        const themes = loadCustomThemes();
        list.innerHTML = '';
        if (themes.length === 0) {
            list.innerHTML = '<p class="cte-empty">No saved custom themes yet.</p>';
            return;
        }
        const activeId = getActiveCustomId();
        themes.forEach(t => {
            const row = document.createElement('div');
            row.className = 'cte-saved-row' + (t.id === activeId ? ' cte-active' : '');
            row.innerHTML = `
                <button type="button" class="modal-btn cte-select-btn" data-cte-select="${t.id}" title="Apply this theme">${escapeHtml(t.name)}</button>
                <button type="button" class="modal-btn cte-export-btn" data-cte-export="${t.id}" title="Export theme as JSON">📤</button>
                <button type="button" class="modal-btn cte-edit-btn" data-cte-edit="${t.id}" title="Edit">✎</button>
                <button type="button" class="modal-btn cte-delete-btn" data-cte-delete="${t.id}" title="Delete">🗑</button>
            `;
            list.appendChild(row);
        });
        list.querySelectorAll('[data-cte-select]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-cte-select');
                await applyCustomThemeById(id);
                if (typeof hasChangedTheme !== 'undefined') hasChangedTheme = true;
                fillSavedThemesList();
                updateThemeModalHighlight();
            });
        });
        list.querySelectorAll('[data-cte-export]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-cte-export');
                try {
                    await exportSingleThemeFile(id);
                } catch (err) {
                    alert('Could not export theme: ' + (err && err.message ? err.message : 'unknown error'));
                }
            });
        });
        list.querySelectorAll('[data-cte-edit]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-cte-edit');
                openEditorForTheme(id);
            });
        });
        list.querySelectorAll('[data-cte-delete]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-cte-delete');
                if (!confirm('Delete this custom theme? Images used only by it will be removed.')) return;
                await deleteCustomTheme(id);
                fillSavedThemesList();
                if (editingThemeId === id) {
                    startNewTheme();
                }
            });
        });
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[c]);
    }

    async function deleteCustomTheme(id) {
        const themes = loadCustomThemes();
        const theme = themes.find(t => t.id === id);
        if (!theme) return;
        const remaining = themes.filter(t => t.id !== id);
        // Collect image ids still in use
        const used = new Set();
        remaining.forEach(t => {
            Object.values(t.images || {}).forEach(imgId => { if (imgId) used.add(imgId); });
        });
        const toRemove = [];
        Object.values(theme.images || {}).forEach(imgId => {
            if (imgId && !used.has(imgId)) toRemove.push(imgId);
        });
        for (const imgId of toRemove) {
            revokeObjectUrl(imgId);
            try { await idbDelete(imgId); } catch (_) {}
        }
        saveCustomThemes(remaining);
        if (getActiveCustomId() === id) {
            setActiveCustomId(null);
            clearCustomStyles();
            // fall back to default theme attr only if currently custom
            if (document.documentElement.getAttribute('data-theme') === CUSTOM_THEME_ATTR) {
                document.documentElement.setAttribute('data-theme', 'default');
                localStorage.setItem(THEME_LS_KEY, 'default');
            }
        }
    }

    function renderColorControls() {
        const container = document.getElementById('cte-colors');
        if (!container || !editorState) return;
        container.innerHTML = '';
        COLOR_VARS.forEach(({ key, label }) => {
            const val = editorState.colors[key] || DEFAULT_COLORS[key];
            const row = document.createElement('div');
            row.className = 'cte-color-row';
            row.innerHTML = `
                <label class="cte-color-label">${escapeHtml(label)}</label>
                <input type="color" class="cte-color-picker" data-var="${key}" value="${normalizeHexForPicker(val)}">
                <input type="text" class="cte-color-hex" data-var="${key}" value="${escapeHtml(val)}" maxlength="9" spellcheck="false">
            `;
            container.appendChild(row);
        });
        // Accent opacity
        const opRow = document.createElement('div');
        opRow.className = 'cte-color-row cte-opacity-row';
        const op = Math.round((editorState.accentOpacity != null ? editorState.accentOpacity : 0.2) * 100);
        opRow.innerHTML = `
            <label class="cte-color-label">Accent transparency</label>
            <input type="range" id="cte-accent-opacity" min="0" max="100" value="${op}" style="flex:1;">
            <span id="cte-accent-opacity-val" class="cte-opacity-val">${op}%</span>
        `;
        container.appendChild(opRow);

        container.querySelectorAll('.cte-color-picker').forEach(inp => {
            inp.addEventListener('input', () => {
                const key = inp.dataset.var;
                editorState.colors[key] = inp.value;
                const hexInput = container.querySelector(`.cte-color-hex[data-var="${key}"]`);
                if (hexInput) hexInput.value = inp.value;
                if (key === '--accent-solid') {
                    editorState.colors['--accent-transparent'] = makeTransparent(inp.value, editorState.accentOpacity);
                }
                updateLivePreview();
            });
        });
        container.querySelectorAll('.cte-color-hex').forEach(inp => {
            inp.addEventListener('change', () => {
                const key = inp.dataset.var;
                let v = inp.value.trim();
                if (!v.startsWith('#')) v = '#' + v;
                if (!/^#[0-9a-fA-F]{3,8}$/.test(v)) {
                    inp.value = editorState.colors[key] || DEFAULT_COLORS[key];
                    return;
                }
                editorState.colors[key] = v;
                const picker = container.querySelector(`.cte-color-picker[data-var="${key}"]`);
                if (picker) picker.value = normalizeHexForPicker(v);
                if (key === '--accent-solid') {
                    editorState.colors['--accent-transparent'] = makeTransparent(v, editorState.accentOpacity);
                }
                updateLivePreview();
            });
        });
        const opSlider = document.getElementById('cte-accent-opacity');
        if (opSlider) {
            opSlider.oninput = () => {
                const pct = parseInt(opSlider.value, 10);
                editorState.accentOpacity = pct / 100;
                const valEl = document.getElementById('cte-accent-opacity-val');
                if (valEl) valEl.textContent = pct + '%';
                editorState.colors['--accent-transparent'] = makeTransparent(
                    editorState.colors['--accent-solid'], editorState.accentOpacity
                );
                updateLivePreview();
            };
        }
    }

    function normalizeHexForPicker(hex) {
        let h = String(hex || '#000000').replace('#', '');
        if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        if (h.length === 8) h = h.slice(0, 6); // drop alpha for color input
        if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return '#000000';
        return '#' + h;
    }

    async function renderImageControls() {
        const container = document.getElementById('cte-images');
        if (!container || !editorState) return;
        container.innerHTML = '';
        for (const slot of IMAGE_SLOTS) {
            const settings = Object.assign({}, DEFAULT_IMAGE_SETTINGS, (editorState.imageSettings || {})[slot.key] || {});
            const imgId = (editorState.images || {})[slot.key] || null;
            let previewUrl = null;
            if (imgId) previewUrl = await getObjectUrl(imgId);

            const block = document.createElement('div');
            block.className = 'cte-image-slot';
            block.dataset.slot = slot.key;
            block.innerHTML = `
                <div class="cte-image-slot-header">
                    <strong>${escapeHtml(slot.label)}</strong>
                    <span class="cte-image-status">${imgId ? 'Image set' : 'No image'}</span>
                </div>
                <div class="cte-image-preview-wrap">
                    ${previewUrl
                        ? `<img class="cte-image-preview" src="${previewUrl}" alt="Preview">`
                        : `<div class="cte-image-preview cte-image-empty">No image</div>`}
                </div>
                <div class="cte-image-actions">
                    <label class="modal-btn cte-upload-label">
                        ${imgId ? 'Replace' : 'Upload'}
                        <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" class="cte-file-input" data-slot="${slot.key}" hidden>
                    </label>
                    <button type="button" class="modal-btn cte-remove-img" data-slot="${slot.key}" ${imgId ? '' : 'disabled'}>Remove</button>
                </div>
                <div class="cte-image-settings">
                    <label>Opacity <input type="range" class="cte-img-opacity" data-slot="${slot.key}" min="0" max="100" value="${Math.round(settings.opacity * 100)}"> <span class="cte-img-op-val">${Math.round(settings.opacity * 100)}%</span></label>
                    <label>Blur <input type="range" class="cte-img-blur" data-slot="${slot.key}" min="0" max="20" value="${settings.blur || 0}"> <span class="cte-img-blur-val">${settings.blur || 0}px</span></label>
                    <label>Size
                        <select class="cte-img-size" data-slot="${slot.key}">
                            <option value="cover" ${settings.size === 'cover' ? 'selected' : ''}>Cover</option>
                            <option value="contain" ${settings.size === 'contain' ? 'selected' : ''}>Contain</option>
                        </select>
                    </label>
                    <label>Position
                        <select class="cte-img-pos" data-slot="${slot.key}">
                            <option value="center" ${settings.position === 'center' ? 'selected' : ''}>Center</option>
                            <option value="top" ${settings.position === 'top' ? 'selected' : ''}>Top</option>
                            <option value="bottom" ${settings.position === 'bottom' ? 'selected' : ''}>Bottom</option>
                            <option value="left" ${settings.position === 'left' ? 'selected' : ''}>Left</option>
                            <option value="right" ${settings.position === 'right' ? 'selected' : ''}>Right</option>
                        </select>
                    </label>
                </div>
            `;
            container.appendChild(block);
        }

        container.querySelectorAll('.cte-file-input').forEach(inp => {
            inp.addEventListener('change', async (e) => {
                const file = e.target.files && e.target.files[0];
                const slot = inp.dataset.slot;
                if (!file || !slot) return;
                if (!ACCEPTED_IMAGE_TYPES.includes(file.type) && !/\.(png|jpe?g|webp)$/i.test(file.name)) {
                    alert('Please use PNG, JPG, JPEG, or WebP.');
                    inp.value = '';
                    return;
                }
                if (file.size > MAX_IMAGE_BYTES) {
                    alert('Image must be 5 MB or smaller.');
                    inp.value = '';
                    return;
                }
                try {
                    const oldId = editorState.images[slot];
                    const newId = generateId('img');
                    await idbPut({ id: newId, blob: file, mime: file.type, name: file.name, createdAt: Date.now() });
                    editorState.images[slot] = newId;
                    // Old image kept until save/delete cleanup — ok for editor session
                    if (oldId) revokeObjectUrl(oldId);
                    await renderImageControls();
                    updateLivePreview();
                } catch (err) {
                    alert('Could not store image: ' + (err && err.message ? err.message : 'unknown error'));
                }
                inp.value = '';
            });
        });

        container.querySelectorAll('.cte-remove-img').forEach(btn => {
            btn.addEventListener('click', async () => {
                const slot = btn.dataset.slot;
                const oldId = editorState.images[slot];
                editorState.images[slot] = null;
                if (oldId) revokeObjectUrl(oldId);
                await renderImageControls();
                updateLivePreview();
            });
        });

        container.querySelectorAll('.cte-img-opacity').forEach(inp => {
            inp.addEventListener('input', () => {
                const slot = inp.dataset.slot;
                if (!editorState.imageSettings[slot]) editorState.imageSettings[slot] = Object.assign({}, DEFAULT_IMAGE_SETTINGS);
                editorState.imageSettings[slot].opacity = parseInt(inp.value, 10) / 100;
                const span = inp.parentElement.querySelector('.cte-img-op-val');
                if (span) span.textContent = inp.value + '%';
                updateLivePreview();
            });
        });
        container.querySelectorAll('.cte-img-blur').forEach(inp => {
            inp.addEventListener('input', () => {
                const slot = inp.dataset.slot;
                if (!editorState.imageSettings[slot]) editorState.imageSettings[slot] = Object.assign({}, DEFAULT_IMAGE_SETTINGS);
                editorState.imageSettings[slot].blur = parseInt(inp.value, 10);
                const span = inp.parentElement.querySelector('.cte-img-blur-val');
                if (span) span.textContent = inp.value + 'px';
                updateLivePreview();
            });
        });
        container.querySelectorAll('.cte-img-size').forEach(sel => {
            sel.addEventListener('change', () => {
                const slot = sel.dataset.slot;
                if (!editorState.imageSettings[slot]) editorState.imageSettings[slot] = Object.assign({}, DEFAULT_IMAGE_SETTINGS);
                editorState.imageSettings[slot].size = sel.value;
                updateLivePreview();
            });
        });
        container.querySelectorAll('.cte-img-pos').forEach(sel => {
            sel.addEventListener('change', () => {
                const slot = sel.dataset.slot;
                if (!editorState.imageSettings[slot]) editorState.imageSettings[slot] = Object.assign({}, DEFAULT_IMAGE_SETTINGS);
                editorState.imageSettings[slot].position = sel.value;
                updateLivePreview();
            });
        });
    }

    async function updateLivePreview() {
        const preview = document.getElementById('cte-preview');
        if (!preview || !editorState) return;
        const c = normalizeColors(editorState.colors, editorState.accentOpacity);
        preview.style.setProperty('--cte-bg', c['--bg-main']);
        preview.style.setProperty('--cte-side', c['--bg-sidebar']);
        preview.style.setProperty('--cte-border', c['--border-main']);
        preview.style.setProperty('--cte-text', c['--text-main']);
        preview.style.setProperty('--cte-accent', c['--text-accent']);
        preview.style.setProperty('--cte-btn', c['--btn-primary']);
        preview.style.setProperty('--cte-btn-h', c['--btn-primary-hover']);
        preview.style.setProperty('--cte-btn2', c['--btn-secondary']);
        preview.style.setProperty('--cte-solid', c['--accent-solid']);

        const bodyEl = preview.querySelector('.cte-preview-body');
        const sideEl = preview.querySelector('.cte-preview-sidebar');
        const cardEl = preview.querySelector('.cte-preview-card');

        async function setBg(el, slot) {
            if (!el) return;
            const id = editorState.images[slot];
            const s = Object.assign({}, DEFAULT_IMAGE_SETTINGS, editorState.imageSettings[slot] || {});
            if (!id) {
                el.style.backgroundImage = '';
                return;
            }
            const url = await getObjectUrl(id);
            if (!url) {
                el.style.backgroundImage = '';
                return;
            }
            const opacity = Math.max(0, Math.min(1, Number(s.opacity) || 1));
            el.style.backgroundImage = `linear-gradient(rgba(0,0,0,${(1 - opacity).toFixed(3)}), rgba(0,0,0,${(1 - opacity).toFixed(3)})), url("${url}")`;
            el.style.backgroundSize = (s.size || 'cover') + ', ' + (s.size || 'cover');
            el.style.backgroundPosition = (s.position || 'center') + ', ' + (s.position || 'center');
            el.style.backgroundRepeat = 'no-repeat';
        }
        await setBg(bodyEl, 'main');
        await setBg(sideEl, 'sidebar');
        await setBg(cardEl, 'cards');
    }

    function startNewTheme() {
        editingThemeId = null;
        editorState = createEmptyTheme();
        const nameInput = document.getElementById('cte-theme-name');
        if (nameInput) nameInput.value = editorState.name;
        renderColorControls();
        renderImageControls().then(updateLivePreview);
        const status = document.getElementById('cte-edit-status');
        if (status) status.textContent = 'Creating new theme';
    }

    function openEditorForTheme(id) {
        const theme = getThemeById(id);
        if (!theme) {
            startNewTheme();
            return;
        }
        editingThemeId = id;
        editorState = buildEditorStateFromTheme(theme);
        if (!editorState.images) editorState.images = { main: null, sidebar: null, cards: null };
        if (!editorState.imageSettings) {
            editorState.imageSettings = {
                main: Object.assign({}, DEFAULT_IMAGE_SETTINGS),
                sidebar: Object.assign({}, DEFAULT_IMAGE_SETTINGS),
                cards: Object.assign({}, DEFAULT_IMAGE_SETTINGS)
            };
        }
        const nameInput = document.getElementById('cte-theme-name');
        if (nameInput) nameInput.value = editorState.name;
        renderColorControls();
        renderImageControls().then(updateLivePreview);
        const status = document.getElementById('cte-edit-status');
        if (status) status.textContent = 'Editing: ' + theme.name;
    }

    function saveEditorTheme() {
        if (!editorState) return;
        const nameInput = document.getElementById('cte-theme-name');
        const name = (nameInput && nameInput.value.trim()) || 'My Custom Theme';
        editorState.name = name;
        editorState.colors = normalizeColors(editorState.colors, editorState.accentOpacity);

        const list = loadCustomThemes();
        if (editingThemeId) {
            const idx = list.findIndex(t => t.id === editingThemeId);
            if (idx >= 0) {
                editorState.id = editingThemeId;
                list[idx] = JSON.parse(JSON.stringify(editorState));
            } else {
                editorState.id = generateId('ct');
                editingThemeId = editorState.id;
                list.push(JSON.parse(JSON.stringify(editorState)));
            }
        } else {
            editorState.id = generateId('ct');
            editingThemeId = editorState.id;
            list.push(JSON.parse(JSON.stringify(editorState)));
        }
        saveCustomThemes(list);
        fillSavedThemesList();
        const status = document.getElementById('cte-edit-status');
        if (status) status.textContent = 'Saved: ' + editorState.name;

        // Apply immediately so user sees it
        applyCustomTheme(editorState).then(() => {
            if (typeof hasChangedTheme !== 'undefined') hasChangedTheme = true;
            updateThemeModalHighlight();
        });
    }

    function openCustomThemeModal() {
        const modal = getEditorModal();
        if (!modal) return;
        fillSavedThemesList();
        // If already on a custom theme, open that for edit; else new
        const active = getActiveCustomId();
        if (active && getThemeById(active)) {
            openEditorForTheme(active);
        } else {
            startNewTheme();
        }
        modal.classList.remove('hidden');
    }

    function closeCustomThemeModal() {
        getEditorModal()?.classList.add('hidden');
    }

    function updateThemeModalHighlight() {
        // optional visual cue on Custom Theme button
        const btn = document.getElementById('open-custom-theme-btn');
        if (!btn) return;
        const isCustom = document.documentElement.getAttribute('data-theme') === CUSTOM_THEME_ATTR;
        if (isCustom) {
            btn.style.backgroundColor = 'var(--accent-solid)';
            btn.style.fontWeight = 'bold';
        } else {
            btn.style.backgroundColor = '';
            btn.style.fontWeight = '';
        }
    }

    // ---------- Export / Import helpers (called from ui.js) ----------
    function blobToDataURL(blob) {
        return new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result);
            r.onerror = () => reject(r.error);
            r.readAsDataURL(blob);
        });
    }

    function dataURLToBlob(dataUrl) {
        try {
            const parts = String(dataUrl).split(',');
            const mime = (parts[0].match(/:(.*?);/) || [])[1] || 'image/png';
            const bin = atob(parts[1] || '');
            const arr = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
            return new Blob([arr], { type: mime });
        } catch (_) {
            return null;
        }
    }

    function safeThemeFilename(name) {
        const base = String(name || 'custom-theme')
            .replace(/[^a-zA-Z0-9._-]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 48);
        return (base || 'custom-theme') + '.json';
    }

    /** Export one saved theme (colors + images) as a standalone JSON file. */
    async function exportSingleThemeFile(themeId) {
        const theme = getThemeById(themeId);
        if (!theme) {
            alert('Theme not found.');
            return;
        }
        const images = {};
        const slots = theme.images || {};
        for (const slot of Object.keys(slots)) {
            const imgId = slots[slot];
            if (!imgId) continue;
            try {
                const rec = await idbGet(imgId);
                if (rec && rec.blob) {
                    images[imgId] = {
                        dataUrl: await blobToDataURL(rec.blob),
                        mime: rec.mime || rec.blob.type,
                        name: rec.name || ''
                    };
                }
            } catch (_) {}
        }
        const payload = {
            _meta: {
                type: 'orgeyt-custom-theme',
                version: 1,
                exportedAt: new Date().toISOString()
            },
            theme: JSON.parse(JSON.stringify(theme)),
            images
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = safeThemeFilename(theme.name);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /** Import a single-theme JSON (or a multi-theme _customThemes-style payload). Returns new theme id or null. */
    async function importSingleThemeFile(file) {
        const text = await new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result);
            r.onerror = () => reject(r.error || new Error('read failed'));
            r.readAsText(file);
        });
        let data;
        try {
            data = JSON.parse(text);
        } catch (_) {
            throw new Error('File is not valid JSON.');
        }
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid theme file.');
        }

        // Single theme format
        if (data.theme && typeof data.theme === 'object') {
            const images = data.images && typeof data.images === 'object' ? data.images : {};
            const payload = {
                themes: [data.theme],
                images
            };
            const count = await importCustomThemePayload(payload);
            if (count < 1) throw new Error('Could not import theme.');
            // Find the newest matching name
            const list = loadCustomThemes();
            const baseName = data.theme.name || 'Imported Theme';
            const found = list.slice().reverse().find(t =>
                t.name === baseName || t.name === baseName + ' (imported)' || t.name.startsWith(baseName)
            );
            return found ? found.id : (list.length ? list[list.length - 1].id : null);
        }

        // Full custom-themes payload from site backup
        if (Array.isArray(data.themes)) {
            const count = await importCustomThemePayload(data);
            if (count < 1) throw new Error('No themes found in file.');
            const list = loadCustomThemes();
            return list.length ? list[list.length - 1].id : null;
        }

        // Accidentally a full website backup with _customThemes
        if (data._customThemes) {
            const count = await importCustomThemePayload(data._customThemes);
            if (count < 1) throw new Error('No custom themes in this backup.');
            const list = loadCustomThemes();
            return list.length ? list[list.length - 1].id : null;
        }

        throw new Error('Unrecognized theme file format.');
    }

    async function handleLoadThemeFile(file) {
        if (!file) return;
        try {
            const newId = await importSingleThemeFile(file);
            fillSavedThemesList();
            if (newId) {
                openEditorForTheme(newId);
                await applyCustomThemeById(newId);
                if (typeof hasChangedTheme !== 'undefined') hasChangedTheme = true;
                updateThemeModalHighlight();
            }
            alert('Theme loaded successfully.');
        } catch (err) {
            alert('Could not load theme: ' + (err && err.message ? err.message : 'unknown error'));
        }
    }

    async function exportCustomThemePayload() {
        const themes = loadCustomThemes();
        const imageIds = new Set();
        themes.forEach(t => {
            Object.values(t.images || {}).forEach(id => { if (id) imageIds.add(id); });
        });
        const images = {};
        for (const id of imageIds) {
            try {
                const rec = await idbGet(id);
                if (rec && rec.blob) {
                    images[id] = {
                        dataUrl: await blobToDataURL(rec.blob),
                        mime: rec.mime || rec.blob.type,
                        name: rec.name || ''
                    };
                }
            } catch (_) {}
        }
        return {
            themes,
            activeCustomThemeId: getActiveCustomId(),
            images
        };
    }

    async function importCustomThemePayload(payload) {
        if (!payload || typeof payload !== 'object') return 0;
        const themes = Array.isArray(payload.themes) ? payload.themes : [];
        const images = payload.images && typeof payload.images === 'object' ? payload.images : {};
        const idMap = Object.create(null); // old image id -> new id

        for (const oldId of Object.keys(images)) {
            const info = images[oldId];
            if (!info || !info.dataUrl) continue;
            const blob = dataURLToBlob(info.dataUrl);
            if (!blob) continue;
            const newId = generateId('img');
            try {
                await idbPut({ id: newId, blob, mime: info.mime || blob.type, name: info.name || '', createdAt: Date.now() });
                idMap[oldId] = newId;
            } catch (_) {}
        }

        const existing = loadCustomThemes();
        const existingNames = new Set(existing.map(t => t.name.toLowerCase()));
        const existingIds = new Set(existing.map(t => t.id));
        let imported = 0;

        themes.forEach(t => {
            if (!t || typeof t !== 'object') return;
            let id = t.id || generateId('ct');
            if (existingIds.has(id)) id = generateId('ct');
            let name = t.name || 'Imported Theme';
            if (existingNames.has(name.toLowerCase())) {
                name = name + ' (imported)';
            }
            const imagesMapped = { main: null, sidebar: null, cards: null };
            Object.keys(imagesMapped).forEach(slot => {
                const oldImg = (t.images || {})[slot];
                if (oldImg && idMap[oldImg]) imagesMapped[slot] = idMap[oldImg];
            });
            const theme = {
                id,
                name,
                colors: normalizeColors(t.colors, t.accentOpacity),
                accentOpacity: t.accentOpacity != null ? t.accentOpacity : 0.2,
                images: imagesMapped,
                imageSettings: t.imageSettings || {
                    main: Object.assign({}, DEFAULT_IMAGE_SETTINGS),
                    sidebar: Object.assign({}, DEFAULT_IMAGE_SETTINGS),
                    cards: Object.assign({}, DEFAULT_IMAGE_SETTINGS)
                }
            };
            existing.push(theme);
            existingIds.add(id);
            existingNames.add(name.toLowerCase());
            imported++;
        });

        if (imported > 0) saveCustomThemes(existing);
        if (payload.activeCustomThemeId && idMap) {
            // active theme id might still match if we kept ids; try apply later
        }
        return imported;
    }

    // ---------- Boot: restore custom theme ----------
    async function bootCustomTheme() {
        const savedTheme = localStorage.getItem(THEME_LS_KEY);
        if (savedTheme === CUSTOM_THEME_ATTR) {
            const id = getActiveCustomId();
            if (id) {
                const ok = await applyCustomThemeById(id);
                if (!ok) {
                    document.documentElement.setAttribute('data-theme', 'default');
                    localStorage.setItem(THEME_LS_KEY, 'default');
                    clearCustomStyles();
                }
            } else {
                clearCustomStyles();
                document.documentElement.setAttribute('data-theme', 'default');
                localStorage.setItem(THEME_LS_KEY, 'default');
            }
        }
        updateThemeModalHighlight();
    }

    // When user picks a premade theme, clear custom overrides
    function onPremadeThemeSelected() {
        clearCustomStyles();
        setActiveCustomId(null);
        updateThemeModalHighlight();
    }

    function init() {
        document.getElementById('open-custom-theme-btn')?.addEventListener('click', () => {
            openCustomThemeModal();
        });
        document.getElementById('close-custom-theme-btn')?.addEventListener('click', closeCustomThemeModal);
        document.getElementById('custom-theme-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'custom-theme-modal') closeCustomThemeModal();
        });
        document.getElementById('cte-new-btn')?.addEventListener('click', startNewTheme);
        document.getElementById('cte-save-btn')?.addEventListener('click', saveEditorTheme);
        document.getElementById('cte-load-theme-btn')?.addEventListener('click', () => {
            document.getElementById('cte-load-theme-file')?.click();
        });
        document.getElementById('cte-load-theme-file')?.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) {
                handleLoadThemeFile(file).finally(() => {
                    e.target.value = '';
                });
            }
        });
        document.getElementById('cte-apply-btn')?.addEventListener('click', () => {
            if (!editorState) return;
            // Apply without saving to list (preview on site); still useful
            applyCustomTheme(editorState).then(() => {
                if (typeof hasChangedTheme !== 'undefined') hasChangedTheme = true;
                updateThemeModalHighlight();
            });
        });
        document.getElementById('cte-reset-btn')?.addEventListener('click', () => {
            if (!confirm('Reset editor colors and images to defaults? (Does not delete saved themes)')) return;
            const name = editorState && editorState.name;
            const id = editorState && editorState.id;
            editorState = createEmptyTheme(name);
            if (editingThemeId) {
                editorState.id = editingThemeId;
            } else if (id) {
                editorState.id = id;
            }
            const nameInput = document.getElementById('cte-theme-name');
            if (nameInput) nameInput.value = editorState.name;
            renderColorControls();
            renderImageControls().then(updateLivePreview);
        });

        // Hook premade theme buttons
        document.querySelectorAll('[data-set-theme]').forEach(btn => {
            btn.addEventListener('click', () => {
                onPremadeThemeSelected();
            });
        });

        bootCustomTheme();
    }

    // Public API for ui.js backup
    window.OrgeytCustomTheme = {
        exportPayload: exportCustomThemePayload,
        importPayload: importCustomThemePayload,
        clearStyles: clearCustomStyles,
        applyActive: bootCustomTheme,
        LS_KEYS: [CUSTOM_THEMES_LS_KEY, ACTIVE_CUSTOM_ID_KEY],
        CUSTOM_THEME_ATTR
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
