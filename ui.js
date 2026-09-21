// ui.js VERSION 2026-09-04-menu-music
// ===========================================
// --- UI: Sidebar, sounds, modals, effects ---
// ===========================================

// Sounds
const hoverSound = new Audio('hover.mp3');
const clickSound = new Audio('click.mp3');
hoverSound.volume = 0.35;
clickSound.volume = 0.45;

function playHover() {
    try {
        hoverSound.currentTime = 0;
        hoverSound.play().catch(() => {});
    } catch (_) {}
}

function playClick() {
    try {
        clickSound.currentTime = 0;
        clickSound.play().catch(() => {});
    } catch (_) {}
}

function attachSidebarSounds() {
    const sidebar = document.getElementById('sidebar');
    const rail = document.getElementById('sidebar-rail');
    if (!sidebar) return;

    const targets = [
        ...sidebar.querySelectorAll('button, .file-btn, .tab-btn, .toggle-btn'),
        ...(rail ? rail.querySelectorAll('button') : [])
    ];

    targets.forEach(el => {
        if (el.dataset.soundBound) return;
        el.dataset.soundBound = '1';
        el.addEventListener('mouseenter', playHover);
        el.addEventListener('click', playClick);
    });
}

// ===========================================
// --- Menu Theme Song System ---
// Easy to add songs: just push a new object into menuSongs.
// id = localStorage key, name = button label, src = path to mp3
// ===========================================
const menuSongs = [
    { id: 'lock-in',        name: 'Lock In',         src: 'music/lock-in.mp3' },
    { id: 'ultimate-fight', name: 'Ultimate Fight',  src: 'music/ultimate-fight.mp3' },
    { id: 'mechanics',      name: 'Mechanics',       src: 'music/mechanics.mp3' },
    { id: 'boss-master',    name: 'Boss Master',     src: 'music/Boss master.mp3' },
    { id: 'focus-prog',     name: 'Focus on Programming', src: 'music/Focus on programming.mp3' },
    { id: 'longname-two',   name: 'LONGNAME TWO',    src: 'music/LONGNAME TWO..mp3' },
    { id: 'soon-cult',      name: 'SOON CULT',       src: 'music/SOON CULT.mp3' },
    { id: 'settle-master',  name: 'Settle Master',   src: 'music/Settle Master.mp3' },
    { id: 'window',         name: 'Window',          src: 'music/Window.mp3' },
    { id: 'oiia',           name: 'Oiia',            src: 'music/oiia.mp3' },
    { id: 'ultraname',      name: 'Ultraname',       src: 'music/Ultraname.mp3' },
    { id: 'piano-master',   name: 'Piano Master',    src: 'music/Piano master.mp3' },
    { id: 'catpanic',       name: 'Catpanic',        src: 'music/Catpanic.mp3' },
    { id: 'settle-peace',   name: 'Settle Peace',    src: 'music/Settle peace.mp3' },
    { id: 'yowie-master',   name: 'Yowie Master PIANO Remix', src: 'music/Yowie Master PIANO Remix (1).mp3' },
    { id: 'slide-master',   name: 'Slide Master', src: 'music/Slide master.mp3' },
];

const MENU_SONG_LS_KEY = 'orgeyt-menu-song';
const MENU_VOL_LS_KEY = 'orgeyt-menu-volume';
const MENU_WANT_PLAY_LS_KEY = 'orgeyt-menu-music-want-play';
const MENU_KEEP_PROJECT_LS_KEY = 'orgeyt-menu-music-keep-project';

let menuAudio = null;
let currentMenuSongId = localStorage.getItem(MENU_SONG_LS_KEY) || 'lock-in'; // default to first song
let menuMusicVolume = parseInt(localStorage.getItem(MENU_VOL_LS_KEY) || '40', 10) / 100;
// Keep theme song playing after closing the menu / opening a project (user option, default off)
let menuKeepInProject = localStorage.getItem(MENU_KEEP_PROJECT_LS_KEY) === 'true';
// Alias used by closeSidebar: only true when user opted to keep music in projects
let menuMusicPinned = menuKeepInProject;
let menuFadeTimer = null;
let menuMusicUnlockBound = false;
let menuMusicPendingUnlock = false;

function setMenuWantPlay(want) {
    // Remember that menu music should start when the menu is open / on refresh
    const v = !!want && currentMenuSongId !== 'mute';
    try {
        if (v) localStorage.setItem(MENU_WANT_PLAY_LS_KEY, 'true');
        else localStorage.removeItem(MENU_WANT_PLAY_LS_KEY);
    } catch (_) {}
}

function setMenuKeepInProject(keep) {
    menuKeepInProject = !!keep;
    menuMusicPinned = menuKeepInProject;
    try {
        if (menuKeepInProject) localStorage.setItem(MENU_KEEP_PROJECT_LS_KEY, 'true');
        else localStorage.removeItem(MENU_KEEP_PROJECT_LS_KEY);
    } catch (_) {}
}

/** If autoplay was blocked, start music on the next user gesture. */
function armMenuMusicUnlock() {
    if (menuMusicUnlockBound || currentMenuSongId === 'mute') return;
    menuMusicUnlockBound = true;
    menuMusicPendingUnlock = true;
    const unlock = () => {
        if (!menuMusicPendingUnlock) return;
        menuMusicPendingUnlock = false;
        if (currentMenuSongId === 'mute') return;
        // User had music on (or sidebar is open) — resume
        if (localStorage.getItem(MENU_WANT_PLAY_LS_KEY) === 'true' ||
            document.body.classList.contains('sidebar-open')) {
            playMenuMusic();
        }
    };
    // capture so it fires even if something stops propagation
    document.addEventListener('pointerdown', unlock, { once: true, capture: true });
    document.addEventListener('keydown', unlock, { once: true, capture: true });
}

// Non-repeating menu music (sessionStorage)
const MENU_NONREPEAT_LS_KEY = 'orgeyt-menu-nonrepeat';
const MENU_PLAYED_SS_KEY = 'orgeyt-menu-played';
let menuNonRepeat = localStorage.getItem(MENU_NONREPEAT_LS_KEY) === 'true';

function getPlayedSongIds() {
    try {
        return JSON.parse(sessionStorage.getItem(MENU_PLAYED_SS_KEY) || '[]');
    } catch (_) {
        return [];
    }
}

function setPlayedSongIds(ids) {
    sessionStorage.setItem(MENU_PLAYED_SS_KEY, JSON.stringify(ids));
}

function clearPlayedSongIds() {
    sessionStorage.removeItem(MENU_PLAYED_SS_KEY);
}

function markSongPlayed(id) {
    if (!id || id === 'mute') return;
    const played = getPlayedSongIds();
    if (!played.includes(id)) {
        played.push(id);
        setPlayedSongIds(played);
    }
}

function pickNextNonRepeatSong(excludeId) {
    const available = menuSongs.map(s => s.id).filter(id => id !== excludeId);
    if (available.length === 0) return excludeId; // only one song total
    let played = getPlayedSongIds();
    // Candidates not yet played this cycle
    let candidates = available.filter(id => !played.includes(id));
    if (candidates.length === 0) {
        // Cycle complete — clear and start fresh (still avoid immediate repeat)
        clearPlayedSongIds();
        played = [];
        candidates = available.filter(id => id !== excludeId);
        if (candidates.length === 0) candidates = available;
    }
    const next = candidates[Math.floor(Math.random() * candidates.length)];
    return next;
}

function onMenuSongEnded() {
    if (!menuNonRepeat || currentMenuSongId === 'mute') return;
    const finished = currentMenuSongId;
    markSongPlayed(finished);
    const nextId = pickNextNonRepeatSong(finished);
    if (nextId && nextId !== finished) {
        currentMenuSongId = nextId;
        localStorage.setItem(MENU_SONG_LS_KEY, nextId);
        // Load and play next without treating as manual select (do not clear played list)
        if (menuAudio) {
            menuAudio.pause();
            menuAudio = null;
        }
        playMenuMusic();
        updateMenuMusicButtons();
    }
}
const MENU_FADE_MS = 450;
const MENU_FADE_STEPS = 18;

function getMenuSongById(id) {
    return menuSongs.find(s => s.id === id) || null;
}

function isMenuMusicPlaying() {
    return !!(menuAudio && !menuAudio.paused);
}

function clearMenuFade() {
    if (menuFadeTimer) {
        clearInterval(menuFadeTimer);
        menuFadeTimer = null;
    }
}

function updateRailMusicToggleIcon() {
    const btn = document.getElementById('rail-music-toggle-btn');
    if (!btn) return;
    if (isMenuMusicPlaying()) {
        btn.textContent = '⏸';
        btn.setAttribute('data-tooltip', 'Pause theme song');
    } else {
        btn.textContent = '▶';
        btn.setAttribute('data-tooltip', 'Play / continue theme song');
    }
}

function fadeMenuVolume(from, to, onDone) {
    clearMenuFade();
    if (!menuAudio) {
        if (onDone) onDone();
        return;
    }
    const steps = MENU_FADE_STEPS;
    const stepMs = MENU_FADE_MS / steps;
    let i = 0;
    menuAudio.volume = from;
    menuFadeTimer = setInterval(() => {
        i++;
        const t = i / steps;
        const v = from + (to - from) * t;
        if (menuAudio) menuAudio.volume = Math.max(0, Math.min(1, v));
        if (i >= steps) {
            clearMenuFade();
            if (menuAudio) menuAudio.volume = to;
            if (onDone) onDone();
        }
    }, stepMs);
}

// Pause only — keeps currentTime so reopening continues the track (with fade out)
function pauseMenuMusic() {
    clearMenuFade();
    if (!menuAudio || menuAudio.paused) {
        updateRailMusicToggleIcon();
        return;
    }
    const startVol = menuAudio.volume;
    fadeMenuVolume(startVol, 0, () => {
        if (menuAudio) {
            menuAudio.pause();
            // do NOT reset currentTime — continue from here next time
            menuAudio.volume = menuMusicVolume; // restore for next play
        }
        updateRailMusicToggleIcon();
    });
}

// Hard stop + rewind (only used when switching songs or muting)
function stopMenuMusic() {
    clearMenuFade();
    if (menuAudio) {
        menuAudio.pause();
        menuAudio.currentTime = 0;
        menuAudio.volume = menuMusicVolume;
    }
    updateRailMusicToggleIcon();
}

function playMenuMusic() {
    if (currentMenuSongId === 'mute') {
        pauseMenuMusic();
        return;
    }
    const song = getMenuSongById(currentMenuSongId);
    if (!song) {
        pauseMenuMusic();
        return;
    }

    clearMenuFade();

    // Reuse same Audio element when possible (preserves position)
    if (!menuAudio || menuAudio._songId !== song.id) {
        if (menuAudio) {
            menuAudio.pause();
            menuAudio = null;
        }
        menuAudio = new Audio(song.src);
        menuAudio._songId = song.id;
        menuAudio.loop = !menuNonRepeat;
        menuAudio.volume = 0;
        menuAudio.addEventListener('play', updateRailMusicToggleIcon);
        menuAudio.addEventListener('pause', updateRailMusicToggleIcon);
        menuAudio.addEventListener('ended', onMenuSongEnded);
    } else {
        // Keep loop flag in sync with toggle
        menuAudio.loop = !menuNonRepeat;
    }
    // Track as played when starting in non-repeat mode
    if (menuNonRepeat) markSongPlayed(song.id);

    // Start silent, then fade in
    menuAudio.volume = 0;
    menuAudio.play().then(() => {
        fadeMenuVolume(0, menuMusicVolume);
        updateRailMusicToggleIcon();
        // Successfully playing — remember across refresh
        if (currentMenuSongId !== 'mute') {
            try { localStorage.setItem(MENU_WANT_PLAY_LS_KEY, 'true'); } catch (_) {}
            menuMusicPendingUnlock = false;
        }
    }).catch(() => {
        // Autoplay blocked — start on first click/key
        updateRailMusicToggleIcon();
        armMenuMusicUnlock();
    });
}

function toggleMenuMusic() {
    if (currentMenuSongId === 'mute') return;
    if (isMenuMusicPlaying()) {
        setMenuWantPlay(false);
        pauseMenuMusic();
    } else {
        setMenuWantPlay(true);
        // If starting from rail while project is open, treat as temporary keep until menu closes next time
        if (!document.body.classList.contains('sidebar-open')) {
            menuMusicPinned = true;
        }
        playMenuMusic();
    }
}

function setMenuSong(id) {
    const wasPlaying = isMenuMusicPlaying() || document.body.classList.contains('sidebar-open') || menuMusicPinned ||
        localStorage.getItem(MENU_WANT_PLAY_LS_KEY) === 'true';
    currentMenuSongId = id;
    localStorage.setItem(MENU_SONG_LS_KEY, id);

    // Manual selection always clears played-song tracking
    clearPlayedSongIds();
    if (id !== 'mute') markSongPlayed(id);

    if (id === 'mute') {
        setMenuWantPlay(false);
        stopMenuMusic();
    } else {
        // Choosing a song means user wants music on
        setMenuWantPlay(true);
        if (wasPlaying || document.body.classList.contains('sidebar-open')) {
            stopMenuMusic();
            playMenuMusic();
        }
    }
    updateMenuMusicButtons();
    updateRailMusicToggleIcon();
}

function setMenuMusicVolume(pct) {
    menuMusicVolume = Math.max(0, Math.min(1, pct / 100));
    localStorage.setItem(MENU_VOL_LS_KEY, String(Math.round(pct)));
    // Only apply immediately if not mid-fade and currently playing
    if (menuAudio && !menuFadeTimer && isMenuMusicPlaying()) {
        menuAudio.volume = menuMusicVolume;
    }
    const valEl = document.getElementById('menu-music-vol-val');
    if (valEl) valEl.textContent = Math.round(pct) + '%';
}

function updateMenuMusicButtons() {
    const container = document.getElementById('menu-music-options');
    if (!container) return;
    container.querySelectorAll('[data-menu-song]').forEach(btn => {
        const id = btn.dataset.menuSong;
        if (id === currentMenuSongId) {
            btn.style.backgroundColor = 'var(--accent-solid)';
            btn.style.fontWeight = 'bold';
        } else {
            btn.style.backgroundColor = '';
            btn.style.fontWeight = '';
        }
    });
}

function initMenuMusicUI() {
    const container = document.getElementById('menu-music-options');
    if (!container) return;

    container.innerHTML = '';

    // Mute option first
    const muteBtn = document.createElement('button');
    muteBtn.className = 'modal-btn';
    muteBtn.dataset.menuSong = 'mute';
    muteBtn.textContent = '🔇 Mute';
    muteBtn.addEventListener('click', () => setMenuSong('mute'));
    container.appendChild(muteBtn);

    menuSongs.forEach(song => {
        const btn = document.createElement('button');
        btn.className = 'modal-btn';
        btn.dataset.menuSong = song.id;
        btn.textContent = '🎵 ' + song.name;
        btn.addEventListener('click', () => setMenuSong(song.id));
        container.appendChild(btn);
    });

    updateMenuMusicButtons();

    // Non-repeat toggle
    const nonRepeatCb = document.getElementById('menu-music-nonrepeat');
    if (nonRepeatCb) {
        nonRepeatCb.checked = menuNonRepeat;
        nonRepeatCb.onchange = (e) => {
            menuNonRepeat = !!e.target.checked;
            localStorage.setItem(MENU_NONREPEAT_LS_KEY, menuNonRepeat ? 'true' : 'false');
            if (menuAudio) {
                menuAudio.loop = !menuNonRepeat;
            }
            if (menuNonRepeat) {
                // Starting non-repeat from current song
                clearPlayedSongIds();
                if (currentMenuSongId && currentMenuSongId !== 'mute') markSongPlayed(currentMenuSongId);
            } else {
                clearPlayedSongIds();
            }
        };
    }

    // Keep playing in project toggle (default off)
    const keepCb = document.getElementById('menu-music-keep-project');
    if (keepCb) {
        keepCb.checked = menuKeepInProject;
        keepCb.onchange = (e) => {
            setMenuKeepInProject(!!e.target.checked);
            // If turning off while project is open (menu closed), stop music now
            if (!menuKeepInProject && !document.body.classList.contains('sidebar-open')) {
                pauseMenuMusic();
            }
        };
    }

    // Volume slider
    const volSlider = document.getElementById('menu-music-volume');
    const volVal = document.getElementById('menu-music-vol-val');
    if (volSlider) {
        const savedPct = Math.round(menuMusicVolume * 100);
        volSlider.value = savedPct;
        if (volVal) volVal.textContent = savedPct + '%';
        // Avoid stacking multiple listeners if modal is opened repeatedly
        volSlider.oninput = (e) => {
            setMenuMusicVolume(parseInt(e.target.value, 10));
        };
    }
}

function openMenuMusicModal() {
    initMenuMusicUI();
    document.getElementById('menu-music-modal')?.classList.remove('hidden');
}

// Modal open/close (sidebar button + rail button)
document.getElementById('menu-music-btn')?.addEventListener('click', openMenuMusicModal);
document.getElementById('close-menu-music-btn')?.addEventListener('click', () => {
    document.getElementById('menu-music-modal')?.classList.add('hidden');
});

// Rail: play/pause toggle + open settings
document.getElementById('rail-music-toggle-btn')?.addEventListener('click', () => {
    toggleMenuMusic();
});
document.getElementById('rail-music-settings-btn')?.addEventListener('click', openMenuMusicModal);

// Sidebar open / close
const pauseOverlay = document.getElementById('project-pause-overlay');

// Resume-after-crash: only clear/set when the user opens/closes the menu (not during boot)
let sidebarUserGesture = false;
const RESUME_PENDING_KEY = 'orgeyt-resume-pending';
const LAST_PROJECT_KEY = 'orgeyt-last-project';

function markResumePending() {
    const name = window.currentProjectParam || '';
    if (!name) return;
    localStorage.setItem(LAST_PROJECT_KEY, name);
    localStorage.setItem(RESUME_PENDING_KEY, 'true');
}

function clearResumePending() {
    localStorage.removeItem(RESUME_PENDING_KEY);
}

function openSidebar() {
    document.body.classList.remove('sidebar-closed');
    document.body.classList.add('sidebar-open');
    if (pauseOverlay) pauseOverlay.classList.remove('hidden');
    // Pause: pointer-events already handled by CSS; try to soft-pause iframe media
    try {
        const frame = document.getElementById('runner-frame');
        if (frame && frame.contentWindow) {
            frame.contentWindow.postMessage({ type: 'pause' }, '*');
        }
    } catch (_) {}
    // Menu is open: theme song belongs here. Respect keep-in-project preference for pin state.
    menuMusicPinned = menuKeepInProject;
    playMenuMusic();
    // Home menu: clear resume so a normal menu visit won't prompt after refresh
    if (sidebarUserGesture) {
        clearResumePending();
    }
}

function closeSidebar() {
    document.body.classList.remove('sidebar-open');
    document.body.classList.add('sidebar-closed');
    if (pauseOverlay) pauseOverlay.classList.add('hidden');
    try {
        const frame = document.getElementById('runner-frame');
        if (frame && frame.contentWindow) {
            frame.contentWindow.postMessage({ type: 'resume' }, '*');
        }
    } catch (_) {}
    // Pause when leaving the menu unless user chose "Keep playing while in a project"
    // (or temporarily pinned via rail play while already in a project)
    if (!menuKeepInProject && !menuMusicPinned) {
        pauseMenuMusic();
    } else if (menuKeepInProject) {
        // ensure pinned flag matches preference
        menuMusicPinned = true;
    }
    // Playing a project: remember it in case of crash / close tab
    markResumePending();
}

document.getElementById('sidebar-open-btn')?.addEventListener('click', openSidebar);
document.getElementById('sidebar-close-btn')?.addEventListener('click', closeSidebar);

// Rail action buttons (mirror main overlay buttons)
const openFullBtn = document.getElementById('open-full-btn');
const shareBtn = document.getElementById('share-btn');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const mainContent = document.querySelector('.main-content');

function getCurrentProjectParam() {
    return window.currentProjectParam || 'welcome';
}

function getCurrentFilePath() {
    return window.currentFilePath || 'about:blank';
}

function buildProjectShareUrl() {
    const param = getCurrentProjectParam();
    const base = String(window.location.href).split('?')[0].split('#')[0];
    return base + '?project=' + encodeURIComponent(param);
}

// NEVER uses navigator.clipboard (undefined on non-HTTPS / some browsers)
function copyProjectLink() {
    const generatedUrl = buildProjectShareUrl();
    let copied = false;

    try {
        const ta = document.createElement('textarea');
        ta.value = generatedUrl;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:0;left:0;width:2px;height:2px;padding:0;border:none;opacity:0;';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ta.setSelectionRange(0, generatedUrl.length);
        try {
            copied = document.execCommand('copy');
        } catch (err) {
            copied = false;
        }
        document.body.removeChild(ta);
    } catch (err) {
        copied = false;
    }

    if (copied) {
        alert('Link copied to clipboard!\n' + generatedUrl);
    } else {
        window.prompt('Copy this link:', generatedUrl);
    }
}

document.getElementById('rail-open-full-btn')?.addEventListener('click', () => {
    window.open(getCurrentFilePath(), '_blank');
});

document.getElementById('rail-share-btn')?.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    copyProjectLink();
});

document.getElementById('rail-fullscreen-btn')?.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        mainContent.requestFullscreen().catch(err => alert('Error: ' + err.message));
    } else {
        document.exitFullscreen();
    }
});

if (openFullBtn) {
    openFullBtn.addEventListener('click', () => window.open(getCurrentFilePath(), '_blank'));
}

if (shareBtn) {
    shareBtn.addEventListener('click', function (e) {
        e.preventDefault();
        copyProjectLink();
    });
}

if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            mainContent.requestFullscreen().catch(err => alert(`Error: ${err.message}`));
            fullscreenBtn.textContent = "Exit Full Screen";
        } else {
            document.exitFullscreen();
            fullscreenBtn.textContent = "Full Screen";
        }
    });
}

document.addEventListener('fullscreenchange', () => {
    if (fullscreenBtn) {
        fullscreenBtn.textContent = document.fullscreenElement ? "Exit Full Screen" : "Full Screen";
    }
});

// Konami
const konamiCode = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
let konamiIndex = 0;
document.addEventListener("keydown", (e) => {
    if (e.key === konamiCode[konamiIndex]) {
        konamiIndex++;
        if (konamiIndex === konamiCode.length) {
            unlockAchievement('secret');
            konamiIndex = 0;
        }
    } else {
        konamiIndex = 0;
    }
});

// Effects Modal
const effectsModal = document.getElementById('effects-modal');
const effectsBtn = document.getElementById('effects-btn');
const closeEffectsBtn = document.getElementById('close-effects-btn');

effectsBtn?.addEventListener('click', () => effectsModal.classList.remove('hidden'));
closeEffectsBtn?.addEventListener('click', () => effectsModal.classList.add('hidden'));

const posterizeSlider = document.getElementById('posterize-slider');
const posterizeVal = document.getElementById('posterize-val');

function updatePosterizeFilter(levels) {
    if (posterizeVal) posterizeVal.textContent = levels;
    const rFunc = document.getElementById('posterize-r');
    const gFunc = document.getElementById('posterize-g');
    const bFunc = document.getElementById('posterize-b');

    let tableValues = [];
    for (let i = 0; i < levels; i++) {
        tableValues.push((i / (levels - 1)).toFixed(3));
    }
    const valString = tableValues.join(' ');

    if (rFunc && gFunc && bFunc) {
        rFunc.setAttribute('tableValues', valString);
        gFunc.setAttribute('tableValues', valString);
        bFunc.setAttribute('tableValues', valString);
    }
}

if (posterizeSlider) {
    posterizeSlider.addEventListener('input', (e) => {
        updatePosterizeFilter(parseInt(e.target.value));
    });
}

const colorHueSlider = document.getElementById('color-hue-slider');
const colorHueVal = document.getElementById('color-hue-val');

if (colorHueSlider) {
    colorHueSlider.addEventListener('input', (e) => {
        const val = e.target.value;
        if (colorHueVal) colorHueVal.textContent = val + '°';
        runnerFrame.style.setProperty('--fx-hue', val + 'deg');
    });
}

let discrationInterval = null;

function clearDiscrationElements() {
    if (discrationInterval) {
        clearInterval(discrationInterval);
        discrationInterval = null;
    }
    document.querySelectorAll('.discration-overlay').forEach(el => el.remove());
}

function spawnDiscrationElement() {
    const messages = ["LOOK HERE!", "DISTRACTION!", "SQUIRREL!", "CLICK ME!", "LOL", "DISTRACTED!", "HEY!"];
    const el = document.createElement('div');
    el.className = 'discration-overlay';
    el.textContent = messages[Math.floor(Math.random() * messages.length)];
    el.style.top = Math.floor(Math.random() * 80 + 10) + '%';
    el.style.left = Math.floor(Math.random() * 80 + 10) + '%';
    mainContent.appendChild(el);
    setTimeout(() => el.remove(), 2500);
}

const fxBtns = document.querySelectorAll('.fx-btn');
fxBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const fx = e.target.dataset.effect;
        runnerFrame.classList.toggle(`fx-${fx}`);
        e.target.classList.toggle('active-fx');

        if (e.target.classList.contains('active-fx')) {
            e.target.style.backgroundColor = 'var(--accent-solid)';
        } else {
            e.target.style.backgroundColor = 'var(--btn-primary)';
        }

        if (fx === 'discration') {
            if (runnerFrame.classList.contains('fx-discration')) {
                discrationInterval = setInterval(spawnDiscrationElement, 600);
            } else {
                clearDiscrationElements();
            }
        }

        if (fx === 'pixel') {
            if (!runnerFrame.classList.contains('fx-glow') && !runnerFrame.classList.contains('fx-wavy')) {
                runnerFrame.style.transform = 'none';
            }
            runnerFrame.style.width = '100%';
            runnerFrame.style.height = '100%';

            let overlay = document.getElementById('pixel-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'pixel-overlay';
                mainContent.appendChild(overlay);
            }
            if (runnerFrame.classList.contains('fx-pixel')) {
                overlay.classList.remove('hidden');
            } else {
                overlay.classList.add('hidden');
            }
        }
    });
});

// Theme Modal
const themeModal = document.getElementById('theme-modal');
const themeBtn = document.getElementById('theme-settings-btn');
const closeThemeBtn = document.getElementById('close-theme-btn');

themeBtn?.addEventListener('click', () => themeModal.classList.remove('hidden'));
closeThemeBtn?.addEventListener('click', () => themeModal.classList.add('hidden'));

const themeButtons = document.querySelectorAll('[data-set-theme]');
themeButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const theme = e.target.dataset.setTheme;
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('orgeyt-theme', theme);
        hasChangedTheme = true;
        if (hasChangedFavicon) unlockAchievement('customisation');
    });
});

const savedTheme = localStorage.getItem('orgeyt-theme');
if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
}

// Tab Settings Modal
const tabModal = document.getElementById('tab-modal');
const tabModifierBtn = document.getElementById('tab-modifier-btn');
const closeModalBtn = document.getElementById('close-modal-btn');

tabModifierBtn?.addEventListener('click', () => tabModal.classList.remove('hidden'));
closeModalBtn?.addEventListener('click', () => tabModal.classList.add('hidden'));

const applyTitleBtn = document.getElementById('apply-title-btn');
const tabTitleInput = document.getElementById('tab-title-input');

applyTitleBtn?.addEventListener('click', () => {
    if (tabTitleInput.value.trim() !== "") {
        document.title = tabTitleInput.value.trim();
    }
});

function changeFavicon(src) {
    // Prefer existing icon link; keep rel="icon" (works in all modern browsers)
    let link = document.querySelector("link[rel='icon']") ||
               document.querySelector("link[rel*='icon']") ||
               document.createElement('link');
    link.type = 'image/x-icon';
    link.rel = 'icon';
    link.href = src;
    if (!link.parentNode) {
        document.getElementsByTagName('head')[0].appendChild(link);
    }
    hasChangedFavicon = true;
    if (hasChangedTheme) unlockAchievement('customisation');
}

document.querySelectorAll('.icon-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        changeFavicon(e.target.dataset.icon);
    });
});

document.getElementById('apply-url-btn')?.addEventListener('click', () => {
    const iconUrlInput = document.getElementById('icon-url-input');
    if (iconUrlInput && iconUrlInput.value.trim() !== "") {
        changeFavicon(iconUrlInput.value.trim());
    }
});

document.getElementById('icon-file-input')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            changeFavicon(event.target.result);
        };
        reader.readAsDataURL(file);
    }
});

// Friends Modal
const friendsModal = document.getElementById('friends-modal');
const friendsBtn = document.getElementById('friends-website-btn');
const closeFriendsBtn = document.getElementById('close-friends-modal-btn');
const fcrLink = document.getElementById('fcr-link');

friendsBtn?.addEventListener('click', () => friendsModal.classList.remove('hidden'));
closeFriendsBtn?.addEventListener('click', () => friendsModal.classList.add('hidden'));
if (fcrLink) {
    fcrLink.addEventListener('click', () => unlockAchievement('fcr'));
}

// Achievements Modal
const achievementsModal = document.getElementById('achievements-modal');
const achievementsBtn = document.getElementById('achievements-btn');
const closeAchievementsBtn = document.getElementById('close-achievements-btn');

achievementsBtn?.addEventListener('click', () => {
    renderAchievements();
    achievementsModal.classList.remove('hidden');
});
closeAchievementsBtn?.addEventListener('click', () => achievementsModal.classList.add('hidden'));

// Downloads Modal
const downloadsModal = document.getElementById('downloads-modal');
const downloadsBtn = document.getElementById('downloads-btn');
const closeDownloadsBtn = document.getElementById('close-downloads-btn');

downloadsBtn?.addEventListener('click', () => downloadsModal.classList.remove('hidden'));
closeDownloadsBtn?.addEventListener('click', () => downloadsModal.classList.add('hidden'));

// Gallery Modal
const galleryModal = document.getElementById('gallery-modal');
const openGalleryBtn = document.getElementById('open-gallery-btn');
const closeGalleryBtn = document.getElementById('close-gallery-btn');
const galleryImg = document.getElementById('gallery-img');
const galleryCaption = document.getElementById('gallery-caption');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');

let galleryIndex = 0;
let viewedGalleryIndices = new Set();

function updateGalleryView() {
    if (typeof galleryItems === 'undefined' || galleryItems.length === 0) return;
    const item = galleryItems[galleryIndex];
    galleryImg.src = item.src;
    galleryCaption.textContent = item.caption;
    viewedGalleryIndices.add(galleryIndex);

    if (viewedGalleryIndices.size === galleryItems.length) {
        unlockAchievement('gallery');
    }
}

openGalleryBtn?.addEventListener('click', () => {
    galleryModal.classList.remove('hidden');
    updateGalleryView();
});
closeGalleryBtn?.addEventListener('click', () => galleryModal.classList.add('hidden'));

prevBtn?.addEventListener('click', () => {
    if (typeof galleryItems === 'undefined') return;
    galleryIndex = (galleryIndex - 1 + galleryItems.length) % galleryItems.length;
    updateGalleryView();
});
nextBtn?.addEventListener('click', () => {
    if (typeof galleryItems === 'undefined') return;
    galleryIndex = (galleryIndex + 1) % galleryItems.length;
    updateGalleryView();
});

// Logo secret
const sidebarLogo = document.getElementById('sidebar-logo');
let logoClickCount = 0;

sidebarLogo?.addEventListener('click', () => {
    logoClickCount++;
    if (logoClickCount >= 5) {
        unlockAchievement('control');
        window.location.href = "https://orgeyt.github.io/orgeyt.github.io-myprojects/secret_5Hd82K8Fb8.html";
        logoClickCount = 0;
    }
});

// Dev grid
const devGrid = document.getElementById('dev-grid');
const closeDevGridBtn = document.getElementById('close-dev-grid-btn');
const submitGridBtn = document.getElementById('submit-grid-btn');
let gridState = Array(25).fill(false);

if (devGrid) {
    devGrid.innerHTML = '';
    for (let i = 0; i < 25; i++) {
        const cell = document.createElement('div');
        cell.className = 'dev-grid-cell';
        cell.addEventListener('click', () => {
            gridState[i] = !gridState[i];
            cell.classList.toggle('white', gridState[i]);
        });
        devGrid.appendChild(cell);
    }
}

closeDevGridBtn?.addEventListener('click', () => document.getElementById('dev-grid-modal').classList.add('hidden'));

submitGridBtn?.addEventListener('click', () => {
    document.getElementById('dev-grid-modal').classList.add('hidden');
    document.getElementById('admin-btn').classList.remove('hidden');
    document.getElementById('admin-modal').classList.remove('hidden');
    populateAdminLists();
});

// Admin
const adminBtn = document.getElementById('admin-btn');
const adminModal = document.getElementById('admin-modal');
const closeAdminBtn = document.getElementById('close-admin-btn');

adminBtn?.addEventListener('click', () => {
    populateAdminLists();
    adminModal.classList.remove('hidden');
});
closeAdminBtn?.addEventListener('click', () => adminModal.classList.add('hidden'));

function populateAdminLists() {
    const lsEditor = document.getElementById('admin-ls-editor');
    if (lsEditor) {
        lsEditor.value = JSON.stringify(localStorage, null, 2);
    }

    const achSelect = document.getElementById('admin-achievements-select');
    if (achSelect) {
        achSelect.innerHTML = '';
        for (const [id, data] of Object.entries(achievementData)) {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = `${data.title} (${id})`;
            achSelect.appendChild(opt);
        }
    }
}

document.getElementById('admin-clear-ls')?.addEventListener('click', () => {
    if (confirm("Are you sure you want to clear all local storage?")) {
        localStorage.clear();
        location.reload();
    }
});

document.getElementById('admin-save-ls')?.addEventListener('click', () => {
    try {
        const data = JSON.parse(document.getElementById('admin-ls-editor').value);
        localStorage.clear();
        for (const [k, v] of Object.entries(data)) {
            localStorage.setItem(k, typeof v === 'object' ? JSON.stringify(v) : v);
        }
        alert("Local Storage updated successfully!");
        location.reload();
    } catch (err) {
        alert("Invalid JSON format.");
    }
});

document.getElementById('admin-unlock-ach')?.addEventListener('click', () => {
    const id = document.getElementById('admin-achievements-select').value;
    unlockAchievement(id);
    alert(`Achievement '${id}' unlocked!`);
});

document.getElementById('admin-remove-dev')?.addEventListener('click', () => {
    adminBtn.classList.add('hidden');
    adminModal.classList.add('hidden');
});

// Init sounds after DOM ready
attachSidebarSounds();
// Re-attach after short delay for any late buttons
setTimeout(attachSidebarSounds, 500);


// ===========================================
// --- Sidebar controls groups (collapsible) ---
// ===========================================

const CONTROLS_GROUP_TITLES = {
    discover: 'Discover',
    settings: 'Settings',
    extras: 'Extras',
    data: 'Data & Info'
};

function setControlsMenuView(view, groupId) {
    const modal = document.getElementById('buttons-menu-modal');
    const hub = document.getElementById('controls-menu-hub');
    const backBtn = document.getElementById('controls-menu-back-btn');
    const titleEl = document.getElementById('controls-menu-title');
    if (!modal) return;

    modal.querySelectorAll('.controls-group[data-controls-group]').forEach(el => {
        el.classList.add('hidden');
    });

    if (view === 'closed') {
        modal.classList.add('hidden');
        if (hub) hub.classList.remove('hidden');
        if (backBtn) backBtn.classList.add('hidden');
        if (titleEl) titleEl.textContent = 'Buttons';
        return;
    }

    modal.classList.remove('hidden');

    if (view === 'hub') {
        if (hub) hub.classList.remove('hidden');
        if (backBtn) backBtn.classList.add('hidden');
        if (titleEl) titleEl.textContent = 'Buttons';
        return;
    }

    // group
    if (hub) hub.classList.add('hidden');
    if (backBtn) backBtn.classList.remove('hidden');
    if (titleEl) titleEl.textContent = CONTROLS_GROUP_TITLES[groupId] || 'Buttons';
    const groupEl = modal.querySelector('.controls-group[data-controls-group="' + groupId + '"]');
    if (groupEl) groupEl.classList.remove('hidden');
}

function openControlsMenu() {
    setControlsMenuView('hub');
}

function closeControlsMenu() {
    setControlsMenuView('closed');
}

function controlsMenuGoBack() {
    const modal = document.getElementById('buttons-menu-modal');
    if (!modal || modal.classList.contains('hidden')) {
        setControlsMenuView('closed');
        return;
    }
    const anyGroupOpen = modal.querySelector('.controls-group[data-controls-group]:not(.hidden)');
    if (anyGroupOpen) {
        setControlsMenuView('hub');
    } else {
        setControlsMenuView('closed');
    }
}

function initControlsMenu() {
    const openBtn = document.getElementById('controls-menu-open-btn');
    const closeBtn = document.getElementById('controls-menu-close-btn');
    const backBtn = document.getElementById('controls-menu-back-btn');
    const modal = document.getElementById('buttons-menu-modal');

    if (openBtn && openBtn.dataset.controlsBound !== '1') {
        openBtn.dataset.controlsBound = '1';
        openBtn.addEventListener('click', openControlsMenu);
    }
    if (closeBtn && closeBtn.dataset.controlsBound !== '1') {
        closeBtn.dataset.controlsBound = '1';
        closeBtn.addEventListener('click', closeControlsMenu);
    }
    if (backBtn && backBtn.dataset.controlsBound !== '1') {
        backBtn.dataset.controlsBound = '1';
        backBtn.addEventListener('click', controlsMenuGoBack);
    }
    if (modal && modal.dataset.controlsBound !== '1') {
        modal.dataset.controlsBound = '1';
        modal.addEventListener('click', (e) => {
            if (e.target.id === 'buttons-menu-modal') {
                closeControlsMenu();
                return;
            }
            // Action button in a group → close so another modal can show cleanly
            const actionBtn = e.target.closest('.controls-group .toggle-btn');
            if (actionBtn && !actionBtn.classList.contains('hidden')) {
                setTimeout(closeControlsMenu, 0);
            }
        });
    }

    document.querySelectorAll('#buttons-menu-modal [data-open-group]').forEach(btn => {
        if (btn.dataset.controlsBound === '1') return;
        btn.dataset.controlsBound = '1';
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-open-group');
            if (id) setControlsMenuView('group', id);
        });
    });

    setControlsMenuView('closed');
    if (typeof attachSidebarSounds === 'function') attachSidebarSounds();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initControlsMenu);
} else {
    initControlsMenu();
}


// ===========================================
// --- localStorage Export / Import ---
// ===========================================

const ORGEYT_LS_KEYS = [
    'orgeyt-achievements',
    'orgeyt-time',
    'orgeyt-visited-projects',
    'orgeyt-favorites',
    'orgeyt-theme',
    'orgeyt-menu-song',
    'orgeyt-menu-volume',
    'orgeyt-menu-nonrepeat',
    'orgeyt-whats-new-collapsed',
    'orgeyt-changelog-snapshot',
    'orgeyt-welcome-dont-show',
    'orgeyt-recently-played',
    'orgeyt-last-project',
    'orgeyt-resume-pending',
    'orgeyt-controls-collapsed',
    'orgeyt-orgepet-interactions',
    'orgeyt-orgepet-enabled',
    'orgeyt-menu-music-want-play'
];

function exportOrgeytData() {
    const data = {
        _meta: {
            type: 'orgeyt-website-backup',
            version: 1,
            exportedAt: new Date().toISOString()
        }
    };
    ORGEYT_LS_KEYS.forEach(key => {
        const val = localStorage.getItem(key);
        if (val !== null) data[key] = val;
    });

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 10);
    a.download = `orgeyt-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importOrgeytData(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const text = e.target.result;
            const data = JSON.parse(text);
            if (!data || typeof data !== 'object') {
                alert('Invalid backup file: not a valid JSON object.');
                return;
            }
            // Accept either our meta-tagged format or a plain object of orgeyt-* keys
            let imported = 0;
            for (const key of ORGEYT_LS_KEYS) {
                if (Object.prototype.hasOwnProperty.call(data, key) && typeof data[key] === 'string') {
                    localStorage.setItem(key, data[key]);
                    imported++;
                }
            }
            if (imported === 0) {
                alert('No recognized website data found in this file.');
                return;
            }
            alert(`Import successful! Restored ${imported} setting(s). The page will reload.`);
            location.reload();
        } catch (err) {
            alert('Could not import file: invalid or corrupted JSON.\n' + (err && err.message ? err.message : ''));
        }
    };
    reader.onerror = () => {
        alert('Failed to read the selected file.');
    };
    reader.readAsText(file);
}

// Data Backup modal
document.getElementById('data-backup-btn')?.addEventListener('click', () => {
    document.getElementById('data-backup-modal')?.classList.remove('hidden');
});
document.getElementById('close-data-backup-btn')?.addEventListener('click', () => {
    document.getElementById('data-backup-modal')?.classList.add('hidden');
});
document.getElementById('data-backup-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'data-backup-modal') e.target.classList.add('hidden');
});

document.getElementById('export-data-btn')?.addEventListener('click', () => {
    exportOrgeytData();
});

document.getElementById('import-data-btn')?.addEventListener('click', () => {
    const input = document.getElementById('import-data-file');
    if (input) input.click();
});

document.getElementById('import-data-file')?.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
        importOrgeytData(file);
        e.target.value = ''; // allow re-selecting same file later
    }
});

// ===========================================
// --- lists.js Comments viewer ---
// ===========================================

function parseListsJsComments(source) {
    // Extract trailing // comments on the same line as a project object close (}, // lore)
    // and associate them with the nearest preceding name: "..."
    const results = [];
    const lines = source.split(/\r?\n/);
    let lastName = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        const nameMatch = line.match(/^\s*name:\s*["']([^"']+)["']/);
        if (nameMatch) {
            lastName = nameMatch[1];
        }

        // Object-close with trailing comment: }, // comment   OR   } // comment
        const closeComment = line.match(/^\s*\},?\s*\/\/\s*(.+)\s*$/);
        if (closeComment && lastName) {
            const text = closeComment[1].trim();
            if (text && !text.startsWith('===')) {
                results.push({ project: lastName, comment: text });
            }
            lastName = null;
        }
    }
    return results;
}

function openListsCommentsModal() {
    const modal = document.getElementById('lists-comments-modal');
    const list = document.getElementById('lists-comments-list');
    if (!modal || !list) return;

    list.innerHTML = '<div class="lists-comments-empty">Loading comments…</div>';
    modal.classList.remove('hidden');

    fetch('lists.js')
        .then(r => r.text())
        .then(code => {
            const comments = parseListsJsComments(code);
            list.innerHTML = '';
            if (comments.length === 0) {
                list.innerHTML = '<div class="lists-comments-empty">No project comments found.</div>';
                return;
            }
            comments.forEach(entry => {
                const item = document.createElement('div');
                item.className = 'lists-comment-item';
                const project = document.createElement('div');
                project.className = 'lists-comment-project';
                project.textContent = entry.project;
                const text = document.createElement('div');
                text.className = 'lists-comment-text';
                text.textContent = '// ' + entry.comment;
                item.appendChild(project);
                item.appendChild(text);
                list.appendChild(item);
            });
        })
        .catch(err => {
            list.innerHTML = '<div class="lists-comments-empty">Failed to load lists.js: ' + (err && err.message ? err.message : 'unknown error') + '</div>';
        });
}

document.getElementById('lists-comments-btn')?.addEventListener('click', openListsCommentsModal);
document.getElementById('close-lists-comments-btn')?.addEventListener('click', () => {
    document.getElementById('lists-comments-modal')?.classList.add('hidden');
});
document.getElementById('lists-comments-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'lists-comments-modal') e.target.classList.add('hidden');
});

// ===========================================
// --- What's New (data from lists.js) ---
// ===========================================

const WHATS_NEW_COLLAPSED_KEY = 'orgeyt-whats-new-collapsed';
const CHANGELOG_SNAPSHOT_KEY = 'orgeyt-changelog-snapshot';

/** Parse changelog.txt into [{ date, items: string[] }, ...] — newest section first in file order */
function parseChangelogText(raw) {
    const text = String(raw || '').replace(/^\uFEFF/, '').trim();
    if (!text) return [];

    const sections = [];
    const lines = text.split(/\r?\n/);
    let current = null;

    for (const line of lines) {
        const header = line.match(/^\s*\[([^\]]+)\]\s*$/);
        if (header) {
            if (current) sections.push(current);
            current = { date: header[1].trim(), items: [] };
            continue;
        }
        if (!current) continue;
        const trimmed = line.trim();
        if (trimmed) current.items.push(trimmed);
    }
    if (current) sections.push(current);
    return sections;
}

function showWebsiteUpdatePopup(dateLabel, items) {
    const popup = document.getElementById('website-update-popup');
    if (!popup) return;

    const dateEl = document.getElementById('website-update-date-label');
    const listEl = document.getElementById('website-update-list');
    if (dateEl) dateEl.textContent = dateLabel || '';
    if (listEl) {
        listEl.innerHTML = '';
        (items || []).forEach(text => {
            const li = document.createElement('li');
            li.textContent = String(text);
            listEl.appendChild(li);
        });
        if (!items || items.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'Open Changelog in the menu for full details.';
            listEl.appendChild(li);
        }
    }

    popup.classList.remove('hidden');
    void popup.offsetWidth;
}

function hideWebsiteUpdatePopup() {
    const popup = document.getElementById('website-update-popup');
    if (!popup) return;
    popup.classList.add('hidden');
}

document.getElementById('website-update-dismiss')?.addEventListener('click', hideWebsiteUpdatePopup);
document.getElementById('website-update-popup')?.addEventListener('click', (e) => {
    if (e.target.id === 'website-update-popup') hideWebsiteUpdatePopup();
});

function setWhatsNewCollapsed(collapsed) {
    const root = document.getElementById('whats-new');
    const toggle = document.getElementById('whats-new-toggle');
    if (!root) return;
    if (collapsed) {
        root.classList.add('collapsed');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
    } else {
        root.classList.remove('collapsed');
        if (toggle) toggle.setAttribute('aria-expanded', 'true');
    }
    localStorage.setItem(WHATS_NEW_COLLAPSED_KEY, collapsed ? 'true' : 'false');
}

function fillWhatsNewFromLatest(latest) {
    const root = document.getElementById('whats-new');
    const listEl = document.getElementById('whats-new-list');
    const dateLabel = document.getElementById('whats-new-date-label');
    if (!root || !listEl) return;

    if (!latest) {
        root.classList.add('hidden');
        return;
    }
    root.classList.remove('hidden');
    if (dateLabel) dateLabel.textContent = latest.date;
    listEl.innerHTML = '';
    latest.items.forEach(text => {
        const li = document.createElement('li');
        li.textContent = text;
        listEl.appendChild(li);
    });
}

function renderChangelogSections(container, sections) {
    if (!container) return;
    container.innerHTML = '';
    if (!sections || sections.length === 0) {
        container.innerHTML = '<p class="changelog-empty">No changelog entries yet.</p>';
        return;
    }

    // File order is chronological; reverse so newest is first in the viewer
    const ordered = sections.slice().reverse();
    ordered.forEach((sec, idx) => {
        const block = document.createElement('section');
        block.className = 'changelog-section' + (idx === 0 ? ' changelog-latest' : '');
        const h = document.createElement('h4');
        h.className = 'changelog-date';
        h.textContent = sec.date + (idx === 0 ? ' · Latest' : '');
        block.appendChild(h);
        const ul = document.createElement('ul');
        ul.className = 'changelog-items';
        sec.items.forEach(item => {
            const li = document.createElement('li');
            li.textContent = item;
            ul.appendChild(li);
        });
        block.appendChild(ul);
        container.appendChild(block);
    });
}

function initChangelogAndWhatsNew() {
    const root = document.getElementById('whats-new');
    const toggle = document.getElementById('whats-new-toggle');

    fetch('changelog.txt')
        .then(r => {
            if (!r.ok) throw new Error('Could not load changelog.txt');
            return r.text();
        })
        .then(raw => {
            const normalized = String(raw).replace(/\r\n/g, '\n').trim();
            const sections = parseChangelogText(normalized);
            // Most recent = last [DATE] block in the file
            const latest = sections.length ? sections[sections.length - 1] : null;

            fillWhatsNewFromLatest(latest);

            const stored = localStorage.getItem(CHANGELOG_SNAPSHOT_KEY);
            const isNewUpdate = normalized && stored !== normalized;

            if (isNewUpdate) {
                setWhatsNewCollapsed(false);
                localStorage.setItem(CHANGELOG_SNAPSHOT_KEY, normalized);
                if (latest) {
                    showWebsiteUpdatePopup(latest.date, latest.items);
                } else {
                    showWebsiteUpdatePopup('Update', ['changelog.txt was updated.']);
                }
            } else {
                const wasCollapsed = localStorage.getItem(WHATS_NEW_COLLAPSED_KEY) === 'true';
                setWhatsNewCollapsed(wasCollapsed);
            }

            // Cache parsed sections for the modal
            window.__orgeytChangelogSections = sections;
            window.__orgeytChangelogRaw = normalized;
        })
        .catch(err => {
            console.warn('Changelog load failed:', err);
            if (root) {
                const listEl = document.getElementById('whats-new-list');
                const dateLabel = document.getElementById('whats-new-date-label');
                if (dateLabel) dateLabel.textContent = '';
                if (listEl) {
                    listEl.innerHTML = '<li style="color:var(--text-accent)">Could not load changelog.txt</li>';
                }
            }
        });

    if (toggle) {
        toggle.addEventListener('click', () => {
            const nowCollapsed = !root.classList.contains('collapsed');
            setWhatsNewCollapsed(nowCollapsed);
        });
    }
}

// Run after DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChangelogAndWhatsNew);
} else {
    initChangelogAndWhatsNew();
}

// ===========================================
// --- Welcome Modal ---
// ===========================================

const WELCOME_DONT_SHOW_KEY = 'orgeyt-welcome-dont-show';

function shouldShowWelcomeOnLoad() {
    return localStorage.getItem(WELCOME_DONT_SHOW_KEY) !== 'true';
}

function openWelcomeModal() {
    const modal = document.getElementById('welcome-modal');
    if (!modal) return;
    const cb = document.getElementById('welcome-dont-show-again');
    if (cb) cb.checked = localStorage.getItem(WELCOME_DONT_SHOW_KEY) === 'true';
    modal.classList.remove('hidden');
}

function closeWelcomeModal() {
    const modal = document.getElementById('welcome-modal');
    if (!modal) return;
    const cb = document.getElementById('welcome-dont-show-again');
    if (cb && cb.checked) {
        localStorage.setItem(WELCOME_DONT_SHOW_KEY, 'true');
    } else if (cb && !cb.checked) {
        localStorage.removeItem(WELCOME_DONT_SHOW_KEY);
    }
    modal.classList.add('hidden');
}

document.getElementById('welcome-btn')?.addEventListener('click', openWelcomeModal);
document.getElementById('close-welcome-btn')?.addEventListener('click', closeWelcomeModal);
document.getElementById('welcome-continue-btn')?.addEventListener('click', closeWelcomeModal);

document.getElementById('welcome-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'welcome-modal') closeWelcomeModal();
});

// Always open the menu on load; show welcome only for new visitors
function initMenuAndWelcomeOnLoad() {
    // Instant open: body already has sidebar-open; still run openSidebar for pause overlay + music
    // Boot open does NOT clear resume-pending (sidebarUserGesture is still false)
    if (typeof openSidebar === 'function') {
        openSidebar();
    } else {
        document.body.classList.remove('sidebar-closed');
        document.body.classList.add('sidebar-open');
        const pauseOverlay = document.getElementById('project-pause-overlay');
        if (pauseOverlay) pauseOverlay.classList.remove('hidden');
    }

    if (shouldShowWelcomeOnLoad()) {
        setTimeout(openWelcomeModal, 150);
    }

    // After first paint / welcome delay, allow resume prompt and enable menu clear behavior
    setTimeout(() => {
        maybeOfferResume();
        sidebarUserGesture = true;
    }, shouldShowWelcomeOnLoad() ? 400 : 200);
}

function maybeOfferResume() {
    const pending = localStorage.getItem(RESUME_PENDING_KEY) === 'true';
    const lastName = localStorage.getItem(LAST_PROJECT_KEY);
    if (!pending || !lastName) return;

    // Don't interrupt if a shared ?project= link was used
    try {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('project')) {
            clearResumePending();
            return;
        }
    } catch (_) {}

    const found = (typeof projects !== 'undefined' ? projects : []).find(
        p => (typeof getProjectName === 'function' ? getProjectName(p) : p.name).toLowerCase() === lastName.toLowerCase()
    );
    if (!found) {
        clearResumePending();
        return;
    }

    const modal = document.getElementById('resume-modal');
    const nameEl = document.getElementById('resume-project-name');
    if (nameEl) nameEl.textContent = typeof getProjectName === 'function' ? getProjectName(found) : lastName;
    if (!modal) return;
    modal.classList.remove('hidden');

    const yesBtn = document.getElementById('resume-yes-btn');
    const noBtn = document.getElementById('resume-no-btn');

    const cleanup = () => {
        modal.classList.add('hidden');
        if (yesBtn) yesBtn.onclick = null;
        if (noBtn) noBtn.onclick = null;
    };

    if (yesBtn) {
        yesBtn.onclick = () => {
            cleanup();
            if (typeof loadProject === 'function') loadProject(found);
            if (typeof closeSidebar === 'function') closeSidebar();
        };
    }
    if (noBtn) {
        noBtn.onclick = () => {
            clearResumePending();
            cleanup();
        };
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMenuAndWelcomeOnLoad);
} else {
    initMenuAndWelcomeOnLoad();
}

// ===========================================
// --- Changelog viewer ---
// ===========================================

function openChangelogModal() {
    const modal = document.getElementById('changelog-modal');
    const body = document.getElementById('changelog-body');
    if (!modal || !body) return;
    body.innerHTML = '<p class="changelog-empty">Loading changelog…</p>';
    modal.classList.remove('hidden');

    const apply = (sections) => {
        renderChangelogSections(body, sections);
    };

    if (window.__orgeytChangelogSections) {
        apply(window.__orgeytChangelogSections);
        return;
    }

    fetch('changelog.txt')
        .then(r => {
            if (!r.ok) throw new Error('Could not load changelog.txt');
            return r.text();
        })
        .then(text => {
            const sections = parseChangelogText(text);
            window.__orgeytChangelogSections = sections;
            apply(sections);
        })
        .catch(err => {
            body.innerHTML = '<p class="changelog-empty">Failed to load changelog: ' +
                (err && err.message ? err.message : 'unknown error') + '</p>';
        });
}

document.getElementById('changelog-btn')?.addEventListener('click', openChangelogModal);
document.getElementById('close-changelog-btn')?.addEventListener('click', () => {
    document.getElementById('changelog-modal')?.classList.add('hidden');
});
document.getElementById('changelog-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'changelog-modal') e.target.classList.add('hidden');
});
