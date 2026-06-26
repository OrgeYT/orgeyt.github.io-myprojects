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
let viewedGalleryImages = new Set();

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
    "welcome", "fnftools", "spritesheetmerger", "3danimator", "catmemory", 
    "midiplayer", "mandelbrot", "gswitch", "pfpmaker", "platformer", 
    "throwplayground", { name: "boyfriend test", path: "boyfriend test/index.html" }, 
    "grapplinghook", "physicsandbox", "stacktower", "airhockey", "chess", "flappyarena", "solarsystem", "3dplatformerengine", "synchronizedsouls", { name: "midiplayerplus", path: "midiplayerplus/index.html" }, 
    "flockybird", { name: "bumfuzzle preview", path: "bumfuzzlepreview/index.html" }, "bsodprank", { name: "speedysphere", path: "speedysphere/index.html" }, { name: "cube brawlers", path: "cubebrawlers/index.html" }, 
    "randomwordgenerator", "fnfworldrecords", "easiestgameever", { name: "ragebait quiz", path: "ragebaitquiz/index.html" }, "hexofthehour", "conwaysgameoflife",
    "fnfengine", { name: "DFJK Remake", path: "dfjkremake/index.html" }, "sunset", { name: "Cardboard Ragdoll", path: "cardboard ragdoll/index.html" }, { name: "Ultimate Dodging TWO", path: "ultimatedodgingtwo.html" },
    { name: "Notepad", path: "notepad/index.html" }, "jumpscareprank", { name: "Rubix Cube", path: "rubixcube/index.html" }, "rubixcubefixed", { name: "FNF Playground", path: "fnf playground/index.html" },
    "blobfighting", "faviconextractor", "freegamesorgeyt", "calculator", "orgeytbradwordle", "arrownesetranslator", "scratchlinker", "orgeytaccounts",
    { name: "COLOR MIX!", path: "color mix/index.html" }, "sadfunsandbox", { name: "My OC's lore", path: "loredrop.txt" }, "pongbutitsmadewithscratchblocks", "FCR",
    { name: "idk (By Brad)", path: "idk/index.html" }, { name: "magnet playground", path: "magnet/index.html" }, "batsurvival", "websimprojects", "wheelmaker", "popit", "sb3corrupter",
    "polygonprinter", "jsrunner", "rainbowparkour"
];

const fileList = document.getElementById('file-list');
const runnerFrame = document.getElementById('runner-frame');
const searchBar = document.getElementById('search-bar');
const randomProjectBtn = document.getElementById('random-project-btn'); 
const favoriteBtn = document.getElementById('favorite-btn');

let currentProjectParam = "welcome";
let currentFilePath = "html_welcome.html";
let favorites = JSON.parse(localStorage.getItem('orgeyt-favorites')) || [];

function updateFavoriteButtonText() {
    if (favorites.includes(currentProjectParam.toLowerCase())) {
        favoriteBtn.textContent = "Unfavorite Current Project";
    } else {
        favoriteBtn.textContent = "Favorite Current Project";
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
        const button = document.createElement('button');
        let projectParam = (typeof project === 'object') ? project.name : project;
        let isFav = isFavorite(project);
        
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
    const randomProject = projects[Math.floor(Math.random() * projects.length)];
    loadProject(randomProject);
    unlockAchievement('randomizer'); // Unlock Randomizer
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

// Gallery Tracking Hook (added to existing gallery script inside index.html)
// Note: Overriding the updateGallery function from index.html here globally
const originalGalleryImages = [
    { src: "Gallery/AAUGH.png", caption: '"Fun fact, this was actually the first file uploaded."' },
    { src: "Gallery/NOO.png", caption: '"NOO THEY CHANGED THE GOOGLE DRIVE LOGO"' },
    { src: "Gallery/avatar.png", caption: '"this is fine"' },
    { src: "Gallery/cards.jpg", caption: "" },
    { src: "Gallery/finaltest.jpg", caption: "" },
    { src: "Gallery/darn.jpg", caption: "fr"},
    { src: "Gallery/amongus art.png", caption: "among us art i made on my phone. not my original character" },
    { src: "Gallery/Untitled178.png", caption: "more art i made on my phone xd"}
];

let globalCurrentIndex = 0;

window.addEventListener('DOMContentLoaded', () => {
    // Injecting into the existing gallery scripts if they are running in inline script
    const galleryImg = document.getElementById("gallery-img");
    const galleryCaption = document.getElementById("gallery-caption");
    
    function overrideUpdateGallery() {
        if (!galleryImg || !galleryCaption) return;
        galleryImg.src = originalGalleryImages[globalCurrentIndex].src;
        galleryCaption.textContent = originalGalleryImages[globalCurrentIndex].caption;
        
        viewedGalleryImages.add(globalCurrentIndex);
        if (viewedGalleryImages.size === originalGalleryImages.length) {
            unlockAchievement('gallery'); // Unlock Gallery
        }
    }

    const prevBtn = document.getElementById("prev-btn");
    const nextBtn = document.getElementById("next-btn");
    
    // Replace the old event listeners by cloning the nodes
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
    }
});
