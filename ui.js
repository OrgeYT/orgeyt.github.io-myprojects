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

let menuAudio = null;
let currentMenuSongId = localStorage.getItem(MENU_SONG_LS_KEY) || 'lock-in'; // default to first song
let menuMusicVolume = parseInt(localStorage.getItem(MENU_VOL_LS_KEY) || '40', 10) / 100;
// When true, music keeps playing even if the sidebar is closed (user pressed play on the rail)
let menuMusicPinned = false;
let menuFadeTimer = null;

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
    }).catch(() => {
        // Autoplay may be blocked until user interacts; ignore
        updateRailMusicToggleIcon();
    });
}

function toggleMenuMusic() {
    if (currentMenuSongId === 'mute') return;
    if (isMenuMusicPlaying()) {
        menuMusicPinned = false;
        pauseMenuMusic();
    } else {
        menuMusicPinned = true;
        playMenuMusic();
    }
}

function setMenuSong(id) {
    const wasPlaying = isMenuMusicPlaying() || document.body.classList.contains('sidebar-open') || menuMusicPinned;
    currentMenuSongId = id;
    localStorage.setItem(MENU_SONG_LS_KEY, id);

    // Manual selection always clears played-song tracking
    clearPlayedSongIds();
    if (id !== 'mute') markSongPlayed(id);

    if (id === 'mute') {
        menuMusicPinned = false;
        stopMenuMusic();
    } else if (wasPlaying) {
        // Switch track: load new song from the start
        stopMenuMusic();
        playMenuMusic();
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
    // Resume / start menu theme song (continues from last position)
    playMenuMusic();
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
    // Pause (don't reset) unless user pinned playback from the rail
    if (!menuMusicPinned) {
        pauseMenuMusic();
    }
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
