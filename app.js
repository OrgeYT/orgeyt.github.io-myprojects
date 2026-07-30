// ==========================================
// --- Achievements & Time Tracker Setup ---
// ==========================================

const achievementData = {
    "welcome": { title: "Welcome!", desc: "Launch the site with no achievements unlocked." },
    "customisation": { title: "Customisation", desc: "Change the favicon and theme." },
    "secret": { title: "Secret", desc: "Type up up down down left right left right b a." },
    "liker": { title: "Liker", desc: "Favourite a project." },
    "disliker": { title: "Disliker", desc: "Unfavourite a project." },
    "explorer": { title: "Explorer", desc: "Change the project." },
    "control": { title: "Control?", desc: "Get the secret page from the logo." },
    "gallery": { title: "Gallery", desc: "View all gallery images." },
    "searcher": { title: "Searcher", desc: "Search something then go to a project in that search." },
    "fcr": { title: "Flying Car Retake", desc: "Go to Friend's website." },
    "randomizer": { title: "Randomizer", desc: "Click on random project." },
    "time_1m": { title: "Try it out", desc: "Be on the site for 1 min." },
    "time_10m": { title: "Why is this fun?", desc: "Be on the site for 10 min." },
    "time_30m": { title: "Focused", desc: "Be on the site for half an hour." },
    "time_1h": { title: "True master", desc: "Be on the site for an hour." },
    "time_24h": { title: "Insane", desc: "Be on the site for a whole day." },
    "time_1w": { title: "True fan", desc: "Be on the site for a week." }
};

let unlockedAchievements = JSON.parse(localStorage.getItem('orgeyt-achievements')) || [];
let timeSpent = parseInt(localStorage.getItem('orgeyt-time')) || 0;

// Variables to track combo-achievements
let hasChangedTheme = false;
let hasChangedFavicon = false;
let isInitialLoad = true;

function unlockAchievement(id) {
    if (!unlockedAchievements.includes(id)) {
        unlockedAchievements.push(id);
        localStorage.setItem('orgeyt-achievements', JSON.stringify(unlockedAchievements));
        showAchievementToast(achievementData[id].title);
        renderAchievements();
    }
}

function showAchievementToast(title) {
    const toast = document.getElementById('achievement-toast');
    document.getElementById('toast-text').textContent = title;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('show'), 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.classList.add('hidden'), 400);
    }, 4000);
}

function renderAchievements() {
    const list = document.getElementById('achievements-list');
    if(!list) return;
    list.innerHTML = '';
    
    for (const [id, data] of Object.entries(achievementData)) {
        const item = document.createElement('div');
        item.className = 'achievement-item' + (unlockedAchievements.includes(id) ? ' unlocked' : '');
        item.innerHTML = `
            <div class="achievement-title">${data.title}</div>
            <div class="achievement-desc">${unlockedAchievements.includes(id) ? data.desc : '???'}</div>
        `;
        list.appendChild(item);
    }
}

// Time Tracker Loop
function updateTimeDisplay() {
    let t = timeSpent;
    const weeks = Math.floor(t / 604800); t %= 604800;
    const days = Math.floor(t / 86400); t %= 86400;
    const hours = Math.floor(t / 3600); t %= 3600;
    const mins = Math.floor(t / 60); t %= 60;
    const secs = t;

    let display = [];
    if(weeks > 0) display.push(`${weeks}w`);
    if(days > 0) display.push(`${days}d`);
    if(hours > 0) display.push(`${hours}h`);
    if(mins > 0) display.push(`${mins}m`);
    display.push(`${secs}s`);

    document.getElementById('time-counter').textContent = `Time: ${display.join(' ')}`;
}

setInterval(() => {
    timeSpent++;
    localStorage.setItem('orgeyt-time', timeSpent);
    updateTimeDisplay();

    // Time Checkers
    if(timeSpent >= 60) unlockAchievement('time_1m');
    if(timeSpent >= 600) unlockAchievement('time_10m');
    if(timeSpent >= 1800) unlockAchievement('time_30m');
    if(timeSpent >= 3600) unlockAchievement('time_1h');
    if(timeSpent >= 86400) unlockAchievement('time_24h');
    if(timeSpent >= 604800) unlockAchievement('time_1w');
}, 1000);

// Initialize on boot
if (unlockedAchievements.length === 0) unlockAchievement('welcome');
renderAchievements();
updateTimeDisplay();

// ==========================================
// --- Core Project Array & Setup ---
// ==========================================

// welp i updated the layout for sure they are on new lines now

// DERTFGYHJKMJIUYTGFVHBNM<KJIHUGYTRGFHFY&YH*TFRDCFGVJBHNKJUGTTFHRDCTFGYHU

const projects = [
    "welcome",
    "fnftools",
    "spritesheetmerger",
    "3danimator",
    "catmemory",
    "midiplayer",
    "mandelbrot",
    "gswitch",
    "pfpmaker",
    "platformer",
    "throwplayground",
    { name: "boyfriend test", path: "boyfriend test/index.html" },
    "grapplinghook",
    "physicsandbox",
    "stacktower",
    "airhockey",
    "chess",
    "flappyarena",
    "solarsystem",
    "3dplatformerengine",
    "synchronizedsouls",
    { name: "midiplayerplus", path: "midiplayerplus/index.html" },
    "flockybird",
    { name: "bumfuzzle preview", path: "bumfuzzlepreview/index.html" },
    "bsodprank",
    { name: "speedysphere", path: "speedysphere/index.html" },
    { name: "cube brawlers", path: "cubebrawlers/index.html" },
    "randomwordgenerator",
    "fnfworldrecords",
    "easiestgameever",
    { name: "ragebait quiz", path: "ragebaitquiz/index.html" },
    "hexofthehour",
    "conwaysgameoflife",
    "fnfengine",
    { name: "DFJK Remake", path: "dfjkremake/index.html" },
    "sunset",
    { name: "Cardboard Ragdoll", path: "cardboard ragdoll/index.html" },
    { name: "Ultimate Dodging TWO", path: "ultimatedodgingtwo.html" },
    { name: "Notepad", path: "notepad/index.html" },
    "jumpscareprank",
    { name: "Rubix Cube", path: "rubixcube/index.html" },
    "rubixcubefixed",
    { name: "FNF Playground", path: "fnf playground/index.html" },
    "blobfighting",
    "faviconextractor",
    "freegamesorgeyt",
    "calculator",
    "orgeytbradwordle",
    "arrownesetranslator",
    "scratchlinker",
    "orgeytaccounts",
    { name: "COLOR MIX!", path: "color mix/index.html" },
    "sadfunsandbox",
    { name: "My OC's lore", path: "loredrop.txt" },
    "pongbutitsmadewithscratchblocks",
    "FCR",
    { name: "idk (By Brad)", path: "idk/index.html" },
    { name: "magnet playground", path: "magnet/index.html" },
    "batsurvival",
    "websimprojects",
    "wheelmaker",
    "popit",
    "sb3corrupter",
    "polygonprinter",
    "jsrunner",
    "rainbowparkour",
    { name: "First version of my website", path: "may20/index.html" },
    { name: "what the", path: "index.html" },
    "onlinebuilding",
    "piano",
    { name: "bounce and roll", path: "bounceandroll/index.html" },
    "makeyourownai",
    "midisinger",
    "art",
    "svgtopng",
    "beastbrawl",
    { name: "3d platformer turbowarp", path: "3dplatformerturbowarp/index.html" },
    "cubecare",
    "pixelartcreator",
    "shapemaker",
    "beatcatch",
    "beatcatchautocharter",
    "buddiner",
    { name: "dont look at this. look away. NO", path: "balls.txt" },
    "faviconplatformer",
    "hp",
    "nyancatlostinspace",
    "nyancatlostinspaceairemakebygemini",
    "cursordeath",
    "bfdiragdollplayground",
    { name: "Turbowarp hidden urls", path: "turbowarp hidden urls.md" },
    { name: "Minimal Snake", path: "minimal snake/index.html" },
    "3ddonut",
    "oscilloscope",
    { name: "Bad apple dodge", path: "https://bad-apple-dodge--orgeyt.on.websim.com/" },
    "climber",
    "chess10025",
    "cmmmplus",
    "AI remake of cmmm",
    { name: "Ball game :)", path: "https://rolling-skybound--orgeyt.on.websim.com/" },
    "emoji games",
    { name: "3D FNF chart loader", path: "3d FNF" },
    "infplatformer",
    { name: "Beat to Pitch MIDI Generator", path: "https://beat-to-pitch-midi-generator--orgeyt.on.websim.com/" },
    { name: "Neon Synth Piano", path: "https://neon-synth-piano--orgeyt.on.websim.com/" },
    { name: "My OCs list", path: "my OCs.txt" },
    { name: "FNF Chart Playground Turbowarp", path: "https://turbowarp.org/1364891540/embed?interpolate&hqpen&settings-button&addons=pause%2Cmute-project%2Cclones%2Cgamepad%2Cremove-curved-stage-border%2Cdrag-drop" }, // DAAAMN THATS A LONG URL
    "classic mobile game",
    { name: "3D game in scratch", path: "https://turbowarp.org/1365316275/embed?interpolate&hqpen&settings-button&addons=pause%2Cmute-project%2Cclones%2Cgamepad%2Cremove-curved-stage-border%2Cdrag-drop" } // DAAAMN THATS A LONG URL part 2
];
// rip fnfbot. you can download it somewhere else on the site now.

const fileList = document.getElementById('file-list');
const runnerFrame = document.getElementById('runner-frame');
const searchBar = document.getElementById('search-bar');
const randomProjectBtn = document.getElementById('random-project-btn'); 
const favoriteBtn = document.getElementById('favorite-btn');

let currentProjectParam = "welcome";
let currentFilePath = "html_welcome.html";
let favorites = JSON.parse(localStorage.getItem('orgeyt-favorites')) || [];
let currentProjectTab = 'all'; // For All/Favorited/Unfavorited sorting

// Setup Sidebar Pos logic
const sidebarPosBtn = document.getElementById('sidebar-pos-btn');
const sidebarPositions = ['left', 'right', 'up', 'down'];
let currentSidebarPos = localStorage.getItem('orgeyt-sidebar-pos') || 'left';

function applySidebarPosition(pos) {
    document.body.classList.remove('layout-left', 'layout-right', 'layout-up', 'layout-down');
    if (pos !== 'left') document.body.classList.add(`layout-${pos}`);
    if (sidebarPosBtn) {
        sidebarPosBtn.textContent = `Sidebar: ${pos.charAt(0).toUpperCase() + pos.slice(1)}`;
    }
    localStorage.setItem('orgeyt-sidebar-pos', pos);
}

if (sidebarPosBtn) {
    sidebarPosBtn.addEventListener('click', () => {
        let idx = sidebarPositions.indexOf(currentSidebarPos);
        currentSidebarPos = sidebarPositions[(idx + 1) % sidebarPositions.length];
        applySidebarPosition(currentSidebarPos);
    });
}
// Apply on boot
applySidebarPosition(currentSidebarPos);

// Setup Tab Buttons
const tabBtns = document.querySelectorAll('.tab-btn');
tabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        tabBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentProjectTab = e.target.dataset.tab;
        renderProjectList();
    });
});

function updateFavoriteButtonText() {
    if (favorites.includes(currentProjectParam.toLowerCase())) {
        favoriteBtn.textContent = "Unfavorite Project";
    } else {
        favoriteBtn.textContent = "Favorite Project";
    }
}

document.getElementById('project-counter').textContent = `Total Projects: ${projects.length}`;

function applySearchFilter() {
    if (!searchBar) return;
    const searchTerm = searchBar.value.toLowerCase();
    const buttons = fileList.querySelectorAll('.file-btn');
    
    buttons.forEach(btn => {
        const projectName = btn.dataset.projectName;
        if (projectName.includes(searchTerm)) {
            btn.style.display = 'block';
        } else {
            btn.style.display = 'none';
        }
    });
}

function renderProjectList() {
    fileList.innerHTML = ''; 

    const isWelcome = (p) => {
        let name = typeof p === 'object' ? p.name : p;
        return name.toLowerCase() === 'welcome';
    };

    const isFavorite = (p) => {
        let name = typeof p === 'object' ? p.name : p;
        return favorites.includes(name.toLowerCase());
    };

    const welcomeProjects = projects.filter(p => isWelcome(p));
    const favoritedProjects = projects.filter(p => !isWelcome(p) && isFavorite(p));
    const regularProjects = projects.filter(p => !isWelcome(p) && !isFavorite(p));

    const sortedProjects = [...welcomeProjects, ...favoritedProjects, ...regularProjects];

    sortedProjects.forEach(project => {
        let projectParam = (typeof project === 'object') ? project.name : project;
        let isFav = isFavorite(project);
        
        // Filter based on currently selected tab
        if (currentProjectTab === 'favorites' && !isFav && !isWelcome(project)) return;
        if (currentProjectTab === 'unfavorited' && isFav && !isWelcome(project)) return;

        const button = document.createElement('button');
        
        button.className = 'file-btn';
        if (isFav) button.classList.add('favorited-item');
        
        button.dataset.projectName = projectParam.toLowerCase();
        
        let btnText = (typeof project === 'object') ? `Launch ${project.name}` : `Launch ${project}`;
        if (isFav) btnText += " ⭐";
        
        button.textContent = btnText;
        button.onclick = () => { loadProject(project); };
        fileList.appendChild(button);
    });

    applySearchFilter();
}

function loadProject(project) {
    let projectParam = (typeof project === 'object') ? project.name : project;
    let filePath = (typeof project === 'object') ? project.path : `html_${project}.html`;
    
    // Achievements Logic checks
    if (!isInitialLoad && currentProjectParam.toLowerCase() !== projectParam.toLowerCase()) {
        unlockAchievement('explorer');
    }
    
    if (!isInitialLoad && searchBar.value.trim() !== "") {
        unlockAchievement('searcher');
    }
    
    isInitialLoad = false;
    
    runnerFrame.src = filePath;
    currentProjectParam = projectParam;
    currentFilePath = filePath;
    updateFavoriteButtonText();
}

renderProjectList();

// ==========================================
// --- Buttons & Interactivity ---
// ==========================================

favoriteBtn.addEventListener('click', () => {
    const currentParamLower = currentProjectParam.toLowerCase();
    
    if (favorites.includes(currentParamLower)) {
        favorites = favorites.filter(f => f !== currentParamLower);
        unlockAchievement('disliker'); // Unlock Disliker
    } else {
        favorites.push(currentParamLower);
        unlockAchievement('liker'); // Unlock Liker
    }
    
    localStorage.setItem('orgeyt-favorites', JSON.stringify(favorites));
    renderProjectList();
    updateFavoriteButtonText();
});

randomProjectBtn.addEventListener('click', () => {
    // Only pick from currently visible elements if tabs are active
    const buttons = Array.from(fileList.querySelectorAll('.file-btn')).filter(btn => btn.style.display !== 'none');
    if (buttons.length > 0) {
        const randomBtn = buttons[Math.floor(Math.random() * buttons.length)];
        randomBtn.click();
        unlockAchievement('randomizer'); // Unlock Randomizer
    }
});

if (searchBar) {
    searchBar.addEventListener('input', applySearchFilter);
}

// Konami Code Secret Logic
const konamiCode = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
let konamiIndex = 0;
document.addEventListener("keydown", (e) => {
    if (e.key === konamiCode[konamiIndex]) {
        konamiIndex++;
        if (konamiIndex === konamiCode.length) {
            unlockAchievement('secret'); // Unlock Secret
            konamiIndex = 0;
        }
    } else {
        konamiIndex = 0;
    }
});

const urlParams = new URLSearchParams(window.location.search);
const projectToLoad = urlParams.get('project');

if (projectToLoad) {
    const foundProject = projects.find(p => {
        if (typeof p === 'object') {
            return p.name.toLowerCase() == projectToLoad.toLowerCase();
        }
        return p.toLowerCase() === projectToLoad.toLowerCase();
    });
    if (foundProject) loadProject(foundProject);
    else loadProject("welcome");
} else {
    loadProject("welcome");
}

const shareBtn = document.getElementById('share-btn');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const openFullBtn = document.getElementById('open-full-btn');
const toggleBtn = document.getElementById('toggle-ui-btn');
const mainContent = document.querySelector('.main-content');

openFullBtn.addEventListener('click', () => window.open(currentFilePath, '_blank'));

shareBtn.addEventListener('click', () => {
    const generatedUrl = `${window.location.origin}${window.location.pathname}?project=${encodeURIComponent(currentProjectParam)}`;
    navigator.clipboard.writeText(generatedUrl).then(() => {
        alert(`Link copied to clipboard!\n${generatedUrl}`);
    }).catch(err => alert(`Failed to copy link: ${err}`));
});

fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        mainContent.requestFullscreen().catch(err => alert(`Error: ${err.message}`));
        fullscreenBtn.textContent = "Exit Full Screen";
    } else {
        document.exitFullscreen();
        fullscreenBtn.textContent = "Full Screen";
    }
});

function toggleOverlayButtons() {
    fullscreenBtn.classList.toggle('hidden');
    shareBtn.classList.toggle('hidden');
    openFullBtn.classList.toggle('hidden');
}

if (toggleBtn) toggleBtn.addEventListener('click', toggleOverlayButtons);

document.addEventListener('keydown', (event) => {
    if (event.key === '`') toggleOverlayButtons();
});

runnerFrame.addEventListener('load', () => {
    try {
        runnerFrame.contentWindow.document.addEventListener('keydown', (event) => {
            if (event.key === '`') toggleOverlayButtons();
        });
    } catch (error) {
        console.warn("Could not attach keyboard shortcut to iframe.");
    }
});

// ==========================================
// --- Modals & Options ---
// ==========================================

// Effects Modal Logic
const effectsModal = document.getElementById('effects-modal');
const effectsBtn = document.getElementById('effects-btn');
const closeEffectsBtn = document.getElementById('close-effects-btn');

effectsBtn.addEventListener('click', () => effectsModal.classList.remove('hidden'));
closeEffectsBtn.addEventListener('click', () => effectsModal.classList.add('hidden'));

const fxBtns = document.querySelectorAll('.fx-btn');
fxBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const fx = e.target.dataset.effect;
        runnerFrame.classList.toggle(`fx-${fx}`);
        e.target.classList.toggle('active-fx');
        
        // Button style to visually show it's active
        if (e.target.classList.contains('active-fx')) {
            e.target.style.backgroundColor = 'var(--accent-solid)';
        } else {
            e.target.style.backgroundColor = 'var(--btn-primary)';
        }

        // --- NEW PIXEL EFFECT FIX (Grid Overlay) ---
        if (fx === 'pixel') {
            // Revert any scaling from the old trick to fix the zoom issue
            runnerFrame.style.width = '100%';
            runnerFrame.style.height = '100%';
            runnerFrame.style.transform = 'none';

            let overlay = document.getElementById('pixel-overlay');
            
            // Create a pixel-grid overlay the first time it's clicked
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'pixel-overlay';
                overlay.style.position = 'absolute';
                overlay.style.top = '0';
                overlay.style.left = '0';
                overlay.style.width = '100%';
                overlay.style.height = '100%';
                overlay.style.pointerEvents = 'none'; // Crucial: lets you still click the game!
                overlay.style.zIndex = '5';
                
                // Creates a retro dot-matrix/scanline overlay
                overlay.style.backgroundImage = `
                    repeating-linear-gradient(transparent 0, transparent 2px, rgba(0,0,0,0.25) 2px, rgba(0,0,0,0.25) 4px), 
                    repeating-linear-gradient(90deg, transparent 0, transparent 2px, rgba(0,0,0,0.25) 2px, rgba(0,0,0,0.25) 4px)
                `;
                
                document.querySelector('.main-content').appendChild(overlay);
            }
            
            // Show or hide the overlay based on the button state
            if (e.target.classList.contains('active-fx')) {
                overlay.style.display = 'block';
            } else {
                overlay.style.display = 'none';
            }
        }
    });
});

// Downloads Modal Logic
const downloadsModal = document.getElementById('downloads-modal');
const downloadsBtn = document.getElementById('downloads-btn');
const closeDownloadsBtn = document.getElementById('close-downloads-btn');

downloadsBtn.addEventListener('click', () => downloadsModal.classList.remove('hidden'));
closeDownloadsBtn.addEventListener('click', () => downloadsModal.classList.add('hidden'));

// Theme Modal
const themeModal = document.getElementById('theme-modal');
const themeBtn = document.getElementById('theme-settings-btn');
document.getElementById('close-theme-btn').addEventListener('click', () => themeModal.classList.add('hidden'));
themeBtn.addEventListener('click', () => themeModal.classList.remove('hidden'));

const savedTheme = localStorage.getItem('orgeyt-theme') || 'default';
document.documentElement.setAttribute('data-theme', savedTheme);

document.querySelectorAll('[data-set-theme]').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const theme = e.currentTarget.getAttribute('data-set-theme');
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('orgeyt-theme', theme);
        
        hasChangedTheme = true;
        if (hasChangedFavicon) unlockAchievement('customisation'); // Unlock Customisation
    });
});

// Tab Modal
const tabModal = document.getElementById('tab-modal');
const tabModifierBtn = document.getElementById('tab-modifier-btn');
document.getElementById('close-modal-btn').addEventListener('click', () => tabModal.classList.add('hidden'));
tabModifierBtn.addEventListener('click', () => tabModal.classList.remove('hidden'));

function changeFavicon(src) {
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
    }
    link.href = src;
    
    hasChangedFavicon = true;
    if (hasChangedTheme) unlockAchievement('customisation'); // Unlock Customisation
}

document.getElementById('apply-title-btn').addEventListener('click', () => {
    const newTitle = document.getElementById('tab-title-input').value.trim();
    if (newTitle) document.title = newTitle;
});

document.querySelectorAll('.icon-btn').forEach(btn => {
    btn.addEventListener('click', (e) => changeFavicon(e.target.dataset.icon));
});

document.getElementById('apply-url-btn').addEventListener('click', () => {
    const newUrl = document.getElementById('icon-url-input').value.trim();
    if (newUrl) changeFavicon(newUrl);
});

document.getElementById('icon-file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => changeFavicon(event.target.result);
        reader.readAsDataURL(file);
    }
});

// Friends Modal
const friendsModal = document.getElementById('friends-modal');
const friendsWebsiteBtn = document.getElementById('friends-website-btn');
document.getElementById('close-friends-modal-btn').addEventListener('click', () => friendsModal.classList.add('hidden'));
friendsWebsiteBtn.addEventListener('click', () => friendsModal.classList.remove('hidden'));

// Friend Link Click Tracker
document.getElementById('fcr-link').addEventListener('click', () => {
    unlockAchievement('fcr'); // Unlock Flying Car Retake
});

// Achievements Modal
const achievementsModal = document.getElementById('achievements-modal');
const achievementsBtn = document.getElementById('achievements-btn');
document.getElementById('close-achievements-btn').addEventListener('click', () => achievementsModal.classList.add('hidden'));
achievementsBtn.addEventListener('click', () => achievementsModal.classList.remove('hidden'));

// Gallery Modal Logic
const galleryModal = document.getElementById('gallery-modal');
const openGalleryBtn = document.getElementById('open-gallery-btn');
document.getElementById('close-gallery-btn').addEventListener('click', () => galleryModal.classList.add('hidden'));
openGalleryBtn.addEventListener('click', () => galleryModal.classList.remove('hidden'));

// Secret Logo Click
const sidebarLogo = document.getElementById('sidebar-logo');
let logoClickCount = 0;
let secretUnlocked = false;

if (sidebarLogo) {
    sidebarLogo.addEventListener('click', () => {
        if (secretUnlocked) return; 
        logoClickCount++;
        if (logoClickCount === 15) {
            secretUnlocked = true; 
            unlockAchievement('control'); // Unlock Control?
            window.open('https://orgeyt.github.io/orgeyt.github.io-myprojects/secret_5Hd82K8Fb8.html', '_blank');
        }
    });
}

// Gallery Tracking Hook
const originalGalleryImages = [
    { src: "Gallery/AAUGH.png", caption: '"Fun fact, this was actually the first file uploaded."' },
    { src: "Gallery/NOO.png", caption: '"NOO THEY CHANGED THE GOOGLE DRIVE LOGO"' },
    { src: "Gallery/avatar.png", caption: '"this is fine"' },
    { src: "Gallery/cards.jpg", caption: "" },
    { src: "Gallery/finaltest.jpg", caption: "" },
    { src: "Gallery/darn.jpg", caption: "fr"},
    { src: "Gallery/amongus art.png", caption: "among us art i made on my phone. not my original character" },
    { src: "Gallery/Untitled178.png", caption: "more art i made on my phone xd"},
    { src: "Gallery/ugh....png", caption: "ok so something just happened (jul 8), and it actually scared me. i was updating my site with gemini, until my css got nuked. idk what happened but something happened with the css. luckly github had back ups which i used."}
];

let globalCurrentIndex = 0;

// Load viewed array from local storage
let viewedGalleryImagesArray = JSON.parse(localStorage.getItem('orgeyt-gallery-seen')) || [];
let viewedGalleryImages = new Set(viewedGalleryImagesArray);

function updateGalleryNotif() {
    const notif = document.getElementById('gallery-notif');
    if (!notif) return;
    
    const missed = originalGalleryImages.length - viewedGalleryImages.size;
    
    if (missed > 0) {
        notif.textContent = missed;
        notif.classList.remove('hidden');
    } else {
        notif.classList.add('hidden');
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const galleryImg = document.getElementById("gallery-img");
    const galleryCaption = document.getElementById("gallery-caption");
    
    function overrideUpdateGallery() {
        if (!galleryImg || !galleryCaption) return;
        galleryImg.src = originalGalleryImages[globalCurrentIndex].src;
        galleryCaption.textContent = originalGalleryImages[globalCurrentIndex].caption;
        
        viewedGalleryImages.add(globalCurrentIndex);
        
        // Save to local storage whenever a new image is seen
        localStorage.setItem('orgeyt-gallery-seen', JSON.stringify(Array.from(viewedGalleryImages)));
        updateGalleryNotif(); // Update badge
        
        if (viewedGalleryImages.size === originalGalleryImages.length) {
            unlockAchievement('gallery'); // Unlock Gallery
        }
    }

    const prevBtn = document.getElementById("prev-btn");
    const nextBtn = document.getElementById("next-btn");
    
    if(prevBtn && nextBtn) {
        const newPrev = prevBtn.cloneNode(true);
        const newNext = nextBtn.cloneNode(true);
        prevBtn.parentNode.replaceChild(newPrev, prevBtn);
        nextBtn.parentNode.replaceChild(newNext, nextBtn);
        
        newPrev.addEventListener("click", () => {
            globalCurrentIndex = (globalCurrentIndex - 1 + originalGalleryImages.length) % originalGalleryImages.length;
            overrideUpdateGallery();
        });

        newNext.addEventListener("click", () => {
            globalCurrentIndex = (globalCurrentIndex + 1) % originalGalleryImages.length;
            overrideUpdateGallery();
        });
        
        overrideUpdateGallery(); // Track the first one on boot
        updateGalleryNotif(); // Boot UI check
    }
});

// ==========================================
// --- Dev Mode & Admin Panel ---
// ==========================================

const adminBtn = document.getElementById('admin-btn');
const isDevMode = localStorage.getItem('orgeyt-dev-mode') === 'true';

// Show Admin button if dev mode is saved
if (isDevMode && adminBtn) {
    adminBtn.classList.remove('hidden');
}

// 1. Ctrl + Z Hook
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === 'z') {
        e.preventDefault(); 
        document.getElementById('dev-grid-modal').classList.remove('hidden');
        initDevGrid();
    }
});

// 2. 5x5 Grid Puzzle Logic
const devGrid = document.getElementById('dev-grid');
function initDevGrid() {
    if(!devGrid) return;
    devGrid.innerHTML = '';
    for (let i = 0; i < 25; i++) {
        const cell = document.createElement('div');
        cell.className = 'dev-grid-cell';
        cell.dataset.state = '0';
        cell.addEventListener('click', () => {
            cell.classList.toggle('white');
            cell.dataset.state = cell.classList.contains('white') ? '1' : '0';
        });
        devGrid.appendChild(cell);
    }
}

document.getElementById('close-dev-grid-btn').addEventListener('click', () => {
    document.getElementById('dev-grid-modal').classList.add('hidden');
});

document.getElementById('submit-grid-btn').addEventListener('click', () => {
    const cells = Array.from(document.querySelectorAll('.dev-grid-cell'));
    const currentPattern = cells.map(c => c.dataset.state).join('');
    const targetPattern = "1010101110111110111010101";

    if (currentPattern === targetPattern) {
        alert("ACCESS GRANTED: Dev Mode Activated.");
        localStorage.setItem('orgeyt-dev-mode', 'true');
        adminBtn.classList.remove('hidden');
        document.getElementById('dev-grid-modal').classList.add('hidden');
    } else {
        alert("ACCESS DENIED: Incorrect Pattern.");
        initDevGrid(); // Reset the grid
    }
});

// 3. Admin Modal Logic
const adminModal = document.getElementById('admin-modal');
if(adminBtn) {
    adminBtn.addEventListener('click', () => {
        adminModal.classList.remove('hidden');
        refreshAdminPanel();
    });
}
document.getElementById('close-admin-btn').addEventListener('click', () => adminModal.classList.add('hidden'));

function refreshAdminPanel() {
    // Populate Local Storage Editor
    const lsData = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        // Exclude the dev-mode toggle itself to prevent accidental lockouts
        if(key !== 'orgeyt-dev-mode') {
            lsData[key] = localStorage.getItem(key);
        }
    }
    document.getElementById('admin-ls-editor').value = JSON.stringify(lsData, null, 2);

    // Populate Achievements Dropdown
    const achSelect = document.getElementById('admin-achievements-select');
    achSelect.innerHTML = '';
    for (const key in achievementData) {
        const opt = document.createElement('option');
        opt.value = key;
        const isUnlocked = unlockedAchievements.includes(key);
        opt.textContent = `${achievementData[key].title} ${isUnlocked ? "✅ (Unlocked)" : "🔒 (Locked)"}`;
        achSelect.appendChild(opt);
    }

    // Populate Theme Creator inputs
    const themeVars = [
        '--bg-main', '--bg-sidebar', '--border-main', '--text-main', '--text-accent',
        '--btn-primary', '--btn-primary-hover', '--btn-secondary', '--btn-secondary-hover',
        '--accent-transparent', '--accent-solid'
    ];
    const themeContainer = document.getElementById('theme-creator-inputs');
    themeContainer.innerHTML = '';
    const computedStyles = getComputedStyle(document.documentElement);
    
    themeVars.forEach(v => {
        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.justifyContent = 'space-between';
        wrapper.style.alignItems = 'center';
        
        const label = document.createElement('label');
        label.textContent = v.replace('--', '');
        
        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'theme-var-' + v;
        input.value = computedStyles.getPropertyValue(v).trim();
        input.style.width = '55%';
        input.style.padding = '3px';
        input.style.background = 'var(--bg-main)';
        input.style.color = 'var(--text-main)';
        input.style.border = '1px solid var(--border-main)';
        
        wrapper.appendChild(label);
        wrapper.appendChild(input);
        themeContainer.appendChild(wrapper);
    });
}

// Admin: Edit Local Storage
document.getElementById('admin-save-ls').addEventListener('click', () => {
    try {
        const parsed = JSON.parse(document.getElementById('admin-ls-editor').value);
        // Save current dev mode state before wiping
        const devState = localStorage.getItem('orgeyt-dev-mode');
        localStorage.clear();
        
        // Restore Dev Mode
        if(devState) localStorage.setItem('orgeyt-dev-mode', devState);
        
        for (const key in parsed) {
            let val = parsed[key];
            // Fix parsing if it's supposed to be an array or object
            if (typeof val === 'object') {
                val = JSON.stringify(val);
            }
            localStorage.setItem(key, val);
        }
        alert("Local Storage Successfully Updated! Page will refresh.");
        location.reload();
    } catch(e) {
        alert("ERROR: Invalid JSON format. Please check your syntax.");
    }
});

// Admin: Clear Local Storage
document.getElementById('admin-clear-ls').addEventListener('click', () => {
    if(confirm("WARNING: This will delete ALL data (time, favorites, achievements). Are you sure?")) {
        const devState = localStorage.getItem('orgeyt-dev-mode');
        localStorage.clear();
        if(devState) localStorage.setItem('orgeyt-dev-mode', devState);
        alert("Storage cleared. Page will refresh.");
        location.reload();
    }
});

// Admin: Unlock Achievement
document.getElementById('admin-unlock-ach').addEventListener('click', () => {
    const achId = document.getElementById('admin-achievements-select').value;
    unlockAchievement(achId);
    refreshAdminPanel(); 
});

// Admin: Preview Custom Theme
document.getElementById('admin-preview-theme').addEventListener('click', () => {
    const inputs = document.querySelectorAll('[id^="theme-var-"]');
    inputs.forEach(input => {
        const cssVar = input.id.replace('theme-var-', '');
        document.documentElement.style.setProperty(cssVar, input.value);
    });
});

// Admin: Generate CSS
document.getElementById('admin-generate-css').addEventListener('click', () => {
    let cssCode = `:root[data-theme="custom-theme-name"] {\n`;
    const inputs = document.querySelectorAll('[id^="theme-var-"]');
    inputs.forEach(input => {
        const cssVar = input.id.replace('theme-var-', '');
        cssCode += `    ${cssVar}: ${input.value};\n`;
    });
    cssCode += `}`;
    document.getElementById('admin-css-output').value = cssCode;
});

// Admin: Remove Dev Mode
document.getElementById('admin-remove-dev').addEventListener('click', () => {
    if(confirm("This will disable Dev Mode and hide the Admin panel. Continue?")) {
        localStorage.removeItem('orgeyt-dev-mode');
        location.reload();
    }
});
