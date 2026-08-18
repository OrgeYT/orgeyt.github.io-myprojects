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

const projects = [
    "welcome", // the first one
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
    { name: "Ultimate Dodging TWO", path: "scratch-1331390137" },
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
    { name: "idk (By Brad)", path: "idk/index.html" }, // silly project
    { name: "magnet playground", path: "magnet/index.html" },
    "batsurvival",
    "websimprojects",
    "wheelmaker",
    "popit",
    "sb3corrupter",
    { name: "Polygon printer 2", path: "scratch-1328269671" },
    { name: "Polygon printer 1", path: "scratch-1288760669" },
    "jsrunner",
    "rainbowparkour", // "GAYYYY gAY GAY" stfu rainbow is not the gay flag
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
    { name: "pixel art creator", path: "scratch-1350162529" },
    "shapemaker",
    { name: "beat catch", path: "scratch-1350648798" },
    "beatcatchautocharter",
    "buddiner", // hey can i get a 10k big mac
    { name: "control yeah", path: "control.png" }, // the txt was not for the young i changed it
    "faviconplatformer",
    "hp", // just hp huh? i wonder why????
    "nyancatlostinspace",
    "nyancatlostinspaceairemakebygemini",
    { name: "cursor death", path: "scratch-1361998604" },
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
    { name: "FNF Chart Playground Turbowarp", path: "scratch-1364891540" },
    "classic mobile game",
    { name: "3D game in scratch", path: "scratch-1365316275" },
    { name: "Maze game", path: "scratch-1365697884" },
    "pass the bomb 3D",
    { name: "Spider Escape", path: "scratch-1365895767" },
    "hot potato",
    { name: "Percision hopper", path: "scratch-1365781683" },
    "scratch explorer",
    { name: "Pass the bomb 3d expanded", path: "https://pass-the-bomb-3d--orgeyt.on.websim.com/?v=30" },
    { name: "Verity™ playground", path: "https://verity-playground--orgeyt.on.websim.com/" },
    "claudescratchtools",
    "coinpuzzle",
    "ABP worldpack extractor", // Cats are liquid game. thats what it supports only
    "obbygenerator",
    "noobmaker", // best friend for making noobs, but classic roblox obby is more than that bro
    { name: "Huzzrooms - Webrooms (not my game)", path: "data:text/html;base64,YGBgaHRtbAo8IURPQ1RZUEUgaHRtbD4KPGh0bWwgbGFuZz0iZW4iPgo8aGVhZD4KICA8bWV0YSBjaGFyc2V0PSJVVEYtOCI+CiAgPG1ldGEgbmFtZT0idmlld3BvcnQiIGNvbnRlbnQ9IndpZHRoPWRldmljZS13aWR0aCwgaW5pdGlhbC1zY2FsZT0xLjAiPgogIDx0aXRsZT5XZWJzaW0gR2FtZTwvdGl0bGU+CgogIDxzdHlsZT4KICAgIGgKICAgICogewogICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94OwogICAgfQoKICAgIGh0bWwsIGJvZHkgewogICAgICBtYXJnaW46IDA7CiAgICAgIHdpZHRoOiAxMDAlOwogICAgICBoZWlnaHQ6IDEwMCU7CiAgICAgIG92ZXJmbG93OiBoaWRkZW47CiAgICAgIGZvbnQtZmFtaWx5OiBBcmlhbCwgc2Fucy1zZXJpZjsKICAgICAgYmFja2dyb3VuZDogIzExMTsKICAgIH0KCiAgICAjZ2FtZSB7CiAgICAgIGRpc3BsYXk6IG5vbmU7CiAgICAgIHdpZHRoOiAxMDAlOwogICAgICBoZWlnaHQ6IDEwMCU7CiAgICAgIGJvcmRlcjogbm9uZTsKICAgIH0KCiAgICAjcG9wdXBPdmVybGF5IHsKICAgICAgcG9zaXRpb246IGZpeGVkOwogICAgICBpbnNldDogMDsKICAgICAgZGlzcGxheTogZmxleDsKICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjsKICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7CiAgICAgIGJhY2tncm91bmQ6IHJnYmEocCwgMCwgMCwgMC43NSk7CiAgICAgIHotaW5kZXg6IDEwOwogICAgfQoKICAgICNwb3B1cCB7CiAgICAgIHdpZHRoOiBtaW4oOTAlLCA1MDBweCk7CiAgICAgIHBhZGRpbmc6IDI4cHg7CiAgICAgIGJhY2tncm91bmQ6IHdoaXRlOwogICAgICBib3JkZXItcmFkaXVzOiAxMnB4OwogICAgICBib3gtc2hhZG93OiAwIDEwcHggNDBweCByZ2JhKDAsIDAsIDAsIDAuNSk7CiAgICAgIHRleHQtYWxpZ246IGNlbnRlcjsKICAgIH0KCiAgICAjcG9wdXAgcCB7CiAgICAgIG1hcmdpbjogMCAwIDI0cHg7CiAgICAgIGZvbnQtc2l6ZTogMThweDsKICAgICAgbGluZS1oZWlnaHQ6IDEuNTsKICAgICAgY29sb3I6ICMyMjI7CiAgICB9CgogICAgI29rQnV0dG9uIHsKICAgICAgcGFkZGluZzogMTBweCAyOHB4OwogICAgICBib3JkZXI6IG5vbmU7CiAgICAgIGJvcmRlci1yYWRpdXM6IDdweDsKICAgICAgYmFja2dyb3VuZDogIzU4NjVmMjsKICAgICAgY29sb3I6IHdoaXRlOwogICAgICBmb250LXNpemU6IDE2cHg7CiAgICAgIGZvbnQtd2VpZ2h0OiBib2xkOwogICAgICBjdXJzb3I6IHBvaW50ZXI7CiAgICB9CgogICAgI29rQnV0dG9uOmhvdmVyIHsKICAgICAgYmFja2dyb3VuZDogIzQ3NTJjNDsKICAgIH0KICA8L3N0eWxlPgo8L2hlYWQ+Cgo8Ym9keT4KCiAgPGRpdiBpZD0icG9wdXBPdmVybGF5Ij4KICAgIDxkaXYgaWQ9InBvcHVwIj4KICAgICAgPHA+VGhpcyBpcyBub3QgbXkgZ2FtZS4gdGhpcyBnYW1lIGlzIG1hZGUgYnkgTGFycHNvbGV0ZV9nYW1pbmcgb24gd2Vic2ltPC9wPgogICAgICA8YnV0dG9uIGlkPSJva0J1dHRvbiI+T0s8L2J1dHRvbj4KICAgIDwvZGl2PgogIDwvZGl2PgoKICA8aWZyYW1lCiAgICBpZD0iZ2FtZSIKICAgIHNyYz0iYWJvdXQ6YmxhbmsiCiAgICBhbGxvd2Z1bGxzY3JlZW4+CiAgPC9pZnJhbWU+CgogIDxzY3JpcHQ+CiAgICBjb25zdCBwb3B1cE92ZXJsYXkgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgicG9wdXBPdmVybGF5Iik7CiAgICBjb25zdCBva0J1dHRvbiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCJva0J1dHRvbiIpOwogICAgY29uc3QgZ2FtZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCJnYW1lIik7CgogICAgb2tCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcigiY2xpY2siLCAoKSA9PiB7CiAgICAgIGdhbWUuc3JjID0gImh0dHBzOi8vd2Vicm9vbXMtLWxhcnBzb2xldGVfZ2FtaW5nLm9uLndlYnNpbS5jb20vIjsKICAgICAgZ2FtZS5zdHlsZS5kaXNwbGF5ID0gImJsb2NrIjsKICAgICAgcG9wdXBPdmVybGF5LnN0eWxlLmRpc3BsYXkgPSAibm9uZSI7CiAgICB9KTsKICA8L3NjcmlwdD4KCjwvYm9keT4KPC9odG1sPgpgYGA=" },
    "emojibattle", // thank god we left the insane url
    "embed",
    "Vibin (Not my project)", // yeah not mine lol
    "imagefinder",
    "memorydrawing",
    "errormaker", // three new projects in a row! holy s\it bro!!
    "translate scratch projects", // when its japanese and you rlly want to understand it
    "oiiatranslator",
    "classicrobloxobby" // GROK@!!!!! GROK MADE THIS!!!!!! and its sooooooo PEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEAK
];

const fileList = document.getElementById('file-list');
const runnerFrame = document.getElementById('runner-frame');
const searchBar = document.getElementById('search-bar');
const randomProjectBtn = document.getElementById('random-project-btn'); 
const favoriteBtn = document.getElementById('favorite-btn');

let currentProjectParam = "welcome";
let currentFilePath = "html_welcome.html";
let favorites = JSON.parse(localStorage.getItem('orgeyt-favorites')) || [];
let currentProjectTab = 'all';

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
    
    const isScratch = (p) => {
        let path = typeof p === 'object' ? p.path : `html_${p}.html`;
        return path.startsWith('scratch-');
    };

    const welcomeProjects = projects.filter(p => isWelcome(p));
    const favoritedProjects = projects.filter(p => !isWelcome(p) && isFavorite(p));
    const regularProjects = projects.filter(p => !isWelcome(p) && !isFavorite(p));

    const sortedProjects = [...welcomeProjects, ...favoritedProjects, ...regularProjects];

    sortedProjects.forEach(project => {
        let projectParam = (typeof project === 'object') ? project.name : project;
        let isFav = isFavorite(project);
        
        if (currentProjectTab === 'favorites' && !isFav && !isWelcome(project)) return;
        if (currentProjectTab === 'unfavorited' && isFav && !isWelcome(project)) return;
        if (currentProjectTab === 'scratch' && !isScratch(project)) return;

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
    
    if (filePath.startsWith("scratch-")) {
        const scratchId = filePath.replace("scratch-", "");
        filePath = `https://turbowarp.org/${scratchId}/embed?interpolate&hqpen&settings-button&addons=pause%2Cmute-project%2Cclones%2Cgamepad%2Cremove-curved-stage-border%2Cdrag-drop`;
    }
    
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
        unlockAchievement('disliker');
    } else {
        favorites.push(currentParamLower);
        unlockAchievement('liker');
    }
    
    localStorage.setItem('orgeyt-favorites', JSON.stringify(favorites));
    renderProjectList();
    updateFavoriteButtonText();
});

randomProjectBtn.addEventListener('click', () => {
    const buttons = Array.from(fileList.querySelectorAll('.file-btn')).filter(btn => btn.style.display !== 'none');
    if (buttons.length > 0) {
        const randomBtn = buttons[Math.floor(Math.random() * buttons.length)];
        randomBtn.click();
        unlockAchievement('randomizer');
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
            unlockAchievement('secret');
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

// Effects Modal & Sliders Logic
const effectsModal = document.getElementById('effects-modal');
const effectsBtn = document.getElementById('effects-btn');
const closeEffectsBtn = document.getElementById('close-effects-btn');

effectsBtn.addEventListener('click', () => effectsModal.classList.remove('hidden'));
closeEffectsBtn.addEventListener('click', () => effectsModal.classList.add('hidden'));

// Posterize Filter Slider Listener
const posterizeSlider = document.getElementById('posterize-slider');
const posterizeVal = document.getElementById('posterize-val');

function updatePosterizeFilter(levels) {
    posterizeVal.textContent = levels;
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

// Color Hue Filter Slider Listener
const colorHueSlider = document.getElementById('color-hue-slider');
const colorHueVal = document.getElementById('color-hue-val');

if (colorHueSlider) {
    colorHueSlider.addEventListener('input', (e) => {
        const val = e.target.value;
        colorHueVal.textContent = val + '°';
        runnerFrame.style.setProperty('--fx-hue', val + 'deg');
    });
}

// Discration Floater Generator
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

// FX Toggle Buttons Logic
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

        // Discration special handling
        if (fx === 'discration') {
            if (runnerFrame.classList.contains('fx-discration')) {
                discrationInterval = setInterval(spawnDiscrationElement, 600);
            } else {
                clearDiscrationElements();
            }
        }

        // Pixel Grid Overlay Fix
        if (fx === 'pixel') {
            if(!runnerFrame.classList.contains('fx-glow') && !runnerFrame.classList.contains('fx-wavy')) {
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

// Theme Modal Logic
const themeModal = document.getElementById('theme-modal');
const themeBtn = document.getElementById('theme-settings-btn');
const closeThemeBtn = document.getElementById('close-theme-btn');

themeBtn.addEventListener('click', () => themeModal.classList.remove('hidden'));
closeThemeBtn.addEventListener('click', () => themeModal.classList.add('hidden'));

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

// Tab Settings Modal Logic
const tabModal = document.getElementById('tab-modal');
const tabModifierBtn = document.getElementById('tab-modifier-btn');
const closeModalBtn = document.getElementById('close-modal-btn');

tabModifierBtn.addEventListener('click', () => tabModal.classList.remove('hidden'));
closeModalBtn.addEventListener('click', () => tabModal.classList.add('hidden'));

const applyTitleBtn = document.getElementById('apply-title-btn');
const tabTitleInput = document.getElementById('tab-title-input');

applyTitleBtn.addEventListener('click', () => {
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

const applyUrlBtn = document.getElementById('apply-url-btn');
const iconUrlInput = document.getElementById('icon-url-input');
applyUrlBtn.addEventListener('click', () => {
    if (iconUrlInput.value.trim() !== "") {
        changeFavicon(iconUrlInput.value.trim());
    }
});

const iconFileInput = document.getElementById('icon-file-input');
iconFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            changeFavicon(event.target.result);
        };
        reader.readAsDataURL(file);
    }
});

// Friends Modal Logic
const friendsModal = document.getElementById('friends-modal');
const friendsBtn = document.getElementById('friends-website-btn');
const closeFriendsBtn = document.getElementById('close-friends-modal-btn');
const fcrLink = document.getElementById('fcr-link');

friendsBtn.addEventListener('click', () => friendsModal.classList.remove('hidden'));
closeFriendsBtn.addEventListener('click', () => friendsModal.classList.add('hidden'));
if (fcrLink) {
    fcrLink.addEventListener('click', () => unlockAchievement('fcr'));
}

// Achievements Modal Logic
const achievementsModal = document.getElementById('achievements-modal');
const achievementsBtn = document.getElementById('achievements-btn');
const closeAchievementsBtn = document.getElementById('close-achievements-btn');

achievementsBtn.addEventListener('click', () => {
    renderAchievements();
    achievementsModal.classList.remove('hidden');
});
closeAchievementsBtn.addEventListener('click', () => achievementsModal.classList.add('hidden'));

// Downloads Modal Logic
const downloadsModal = document.getElementById('downloads-modal');
const downloadsBtn = document.getElementById('downloads-btn');
const closeDownloadsBtn = document.getElementById('close-downloads-btn');

downloadsBtn.addEventListener('click', () => downloadsModal.classList.remove('hidden'));
closeDownloadsBtn.addEventListener('click', () => downloadsModal.classList.add('hidden'));

// Gallery Modal Logic
const galleryModal = document.getElementById('gallery-modal');
const openGalleryBtn = document.getElementById('open-gallery-btn');
const closeGalleryBtn = document.getElementById('close-gallery-btn');
const galleryImg = document.getElementById('gallery-img');
const galleryCaption = document.getElementById('gallery-caption');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');

const galleryItems = [
    { src: "Gallery/AAUGH.png", caption: '"Fun fact, this was actually the first file uploaded."' },
    { src: "Gallery/NOO.png", caption: '"NOO THEY CHANGED THE GOOGLE DRIVE LOGO"' },
    { src: "Gallery/avatar.png", caption: '"this is fine"' },
    { src: "Gallery/cards.jpg", caption: "" },
    { src: "Gallery/finaltest.jpg", caption: "" },
    { src: "Gallery/darn.jpg", caption: "fr"},
    { src: "Gallery/amongus art.png", caption: "among us art i made on my phone. not my original character" },
    { src: "Gallery/Untitled178.png", caption: "more art i made on my phone xd"},
    { src: "Gallery/ugh....png", caption: "ok so something just happened (jul 8), and it actually scared me. i was updating my site with gemini, until my css got nuked. idk what happened but something happened with the css. luckly github had back ups which i used."},
    { src: "Gallery/ABP.png", caption: "I played 'cats are liquid: a better place' and it was peak. i played the full story, all 12 worlds, on my phone. the lore was awesome, and the new machanics every new world was awesome. the game was a 10/10, i highly recommend the game if your bored or smt. im some what in the game's community now, so maybe expect some content about the game on my channel or smt. this game is also old, but still getting updates (i hope)"},
    { src: "Gallery/ugh....png", caption: "Gemini decided to nuke the gallery lol but i fixed it"},
];

let galleryIndex = 0;
let viewedGalleryIndices = new Set();

function updateGalleryView() {
    if (galleryItems.length === 0) return;
    const item = galleryItems[galleryIndex];
    galleryImg.src = item.src;
    galleryCaption.textContent = item.caption;
    viewedGalleryIndices.add(galleryIndex);
    
    if (viewedGalleryIndices.size === galleryItems.length) {
        unlockAchievement('gallery');
    }
}

openGalleryBtn.addEventListener('click', () => {
    galleryModal.classList.remove('hidden');
    updateGalleryView();
});
closeGalleryBtn.addEventListener('click', () => galleryModal.classList.add('hidden'));

prevBtn.addEventListener('click', () => {
    galleryIndex = (galleryIndex - 1 + galleryItems.length) % galleryItems.length;
    updateGalleryView();
});
nextBtn.addEventListener('click', () => {
    galleryIndex = (galleryIndex + 1) % galleryItems.length;
    updateGalleryView();
});

// Logo Secret Easter Egg & Dev Grid Logic
const sidebarLogo = document.getElementById('sidebar-logo');
let logoClickCount = 0;

sidebarLogo.addEventListener('click', () => {
    logoClickCount++;

    if (logoClickCount >= 5) {
        unlockAchievement('control');
        window.location.href = "https://orgeyt.github.io/orgeyt.github.io-myprojects/secret_5Hd82K8Fb8.html";
        logoClickCount = 0;
    }
});

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

closeDevGridBtn.addEventListener('click', () => document.getElementById('dev-grid-modal').classList.add('hidden'));

submitGridBtn.addEventListener('click', () => {
    document.getElementById('dev-grid-modal').classList.add('hidden');
    document.getElementById('admin-btn').classList.remove('hidden');
    document.getElementById('admin-modal').classList.remove('hidden');
    populateAdminLS();
});

// Admin Panel Logic
const adminBtn = document.getElementById('admin-btn');
const adminModal = document.getElementById('admin-modal');
const closeAdminBtn = document.getElementById('close-admin-btn');

adminBtn.addEventListener('click', () => {
    populateAdminLS();
    adminModal.classList.remove('hidden');
});
closeAdminBtn.addEventListener('click', () => adminModal.classList.add('hidden'));

function populateAdminLS() {
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

document.getElementById('admin-clear-ls').addEventListener('click', () => {
    if (confirm("Are you sure you want to clear all local storage?")) {
        localStorage.clear();
        location.reload();
    }
});

document.getElementById('admin-save-ls').addEventListener('click', () => {
    try {
        const data = JSON.parse(document.getElementById('admin-ls-editor').value);
        localStorage.clear();
        for (const [k, v] of Object.entries(data)) {
            localStorage.setItem(k, typeof v === 'object' ? JSON.stringify(v) : v);
        }
        alert("Local Storage updated successfully!");
        location.reload();
    } catch(err) {
        alert("Invalid JSON format.");
    }
});

document.getElementById('admin-unlock-ach').addEventListener('click', () => {
    const id = document.getElementById('admin-achievements-select').value;
    unlockAchievement(id);
    alert(`Achievement '${id}' unlocked!`);
});

document.getElementById('admin-remove-dev').addEventListener('click', () => {
    adminBtn.classList.add('hidden');
    adminModal.classList.add('hidden');
});
