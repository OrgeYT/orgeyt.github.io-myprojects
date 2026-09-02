// ui.js VERSION 2026-09-02-share-v3
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
    let link = document.querySelector("link[rel*='icon']") || document.createElement('link');
    link.type = 'image/x-icon';
    link.rel = 'shortcut icon';
    link.href = src;
    document.getElementsByTagName('head')[0].appendChild(link);
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
