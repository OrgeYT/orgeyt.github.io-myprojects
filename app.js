// yall should i remove this comment? this comment is useless af
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

// Track the current project identifier and exact file path
let currentProjectParam = "welcome";
let currentFilePath = "html_welcome.html";

// Favorites Storage
let favorites = JSON.parse(localStorage.getItem('orgeyt-favorites')) || [];

function updateFavoriteButtonText() {
    if (favorites.includes(currentProjectParam.toLowerCase())) {
        favoriteBtn.textContent = "Unfavorite Current Project";
    } else {
        favoriteBtn.textContent = "Favorite Current Project";
    }
}

// Display Total Project Count
document.getElementById('project-counter').textContent = `Total Projects: ${projects.length}`;

// Apply search filter (separated so it can be re-applied after rendering)
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

// Generate the project list UI
function renderProjectList() {
    fileList.innerHTML = ''; // Clear current list

    const isWelcome = (p) => {
        let name = typeof p === 'object' ? p.name : p;
        return name.toLowerCase() === 'welcome';
    };

    const isFavorite = (p) => {
        let name = typeof p === 'object' ? p.name : p;
        return favorites.includes(name.toLowerCase());
    };

    // Sort into categories: Welcome -> Favorites -> Rest
    const welcomeProjects = projects.filter(p => isWelcome(p));
    const favoritedProjects = projects.filter(p => !isWelcome(p) && isFavorite(p));
    const regularProjects = projects.filter(p => !isWelcome(p) && !isFavorite(p));

    const sortedProjects = [...welcomeProjects, ...favoritedProjects, ...regularProjects];

    sortedProjects.forEach(project => {
        const button = document.createElement('button');
        let projectParam = (typeof project === 'object') ? project.name : project;
        let isFav = isFavorite(project);
        
        button.className = 'file-btn';
        if (isFav) {
            button.classList.add('favorited-item');
        }
        
        button.dataset.projectName = projectParam.toLowerCase();
        
        let btnText = (typeof project === 'object') ? `Launch ${project.name}` : `Launch ${project}`;
        if (isFav) {
            btnText += " ⭐";
        }
        button.textContent = btnText;
        
        button.onclick = () => { loadProject(project); };
        fileList.appendChild(button);
    });

    applySearchFilter();
}

// Helper: Unified function to load a project
function loadProject(project) {
    let projectParam = (typeof project === 'object') ? project.name : project;
    let filePath = (typeof project === 'object') ? project.path : `html_${project}.html`;
    
    runnerFrame.src = filePath;
    currentProjectParam = projectParam;
    currentFilePath = filePath;

    updateFavoriteButtonText();
}

// Initialize list
renderProjectList();

// Favorite Button Logic
favoriteBtn.addEventListener('click', () => {
    const currentParamLower = currentProjectParam.toLowerCase();
    
    if (favorites.includes(currentParamLower)) {
        // Remove from favorites
        favorites = favorites.filter(f => f !== currentParamLower);
    } else {
        // Add to favorites
        favorites.push(currentParamLower);
    }
    
    localStorage.setItem('orgeyt-favorites', JSON.stringify(favorites));
    renderProjectList();
    updateFavoriteButtonText();
});

// Random Project Logic
randomProjectBtn.addEventListener('click', () => {
    const randomProject = projects[Math.floor(Math.random() * projects.length)];
    loadProject(randomProject);
});

// Search Filter Logic
if (searchBar) {
    searchBar.addEventListener('input', applySearchFilter);
}

// --- URL Parameter Auto-Open Logic ---
const urlParams = new URLSearchParams(window.location.search);
const projectToLoad = urlParams.get('project');

if (projectToLoad) {
    const foundProject = projects.find(p => {
        if (typeof p === 'object') {
            return p.name.toLowerCase() == projectToLoad.toLowerCase();
        }
        return p.toLowerCase() === projectToLoad.toLowerCase();
    });

    if (foundProject) {
        loadProject(foundProject);
    } else {
        loadProject("welcome");
    }
} else {
    loadProject("welcome");
}

// ==========================================
// --- Unified UI & Button Controls Logic ---
// ==========================================

const shareBtn = document.getElementById('share-btn');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const openFullBtn = document.getElementById('open-full-btn');
const toggleBtn = document.getElementById('toggle-ui-btn');
const mainContent = document.querySelector('.main-content');

// --- Open Full Project Page Logic ---
openFullBtn.addEventListener('click', () => {
    window.open(currentFilePath, '_blank');
});

// --- Share URL Generator Logic ---
shareBtn.addEventListener('click', () => {
    const generatedUrl = `${window.location.origin}${window.location.pathname}?project=${encodeURIComponent(currentProjectParam)}`;
    
    navigator.clipboard.writeText(generatedUrl).then(() => {
        alert(`Link copied to clipboard!\n${generatedUrl}`);
    }).catch(err => {
        alert(`Failed to copy link: ${err}`);
    });
});

// --- Fullscreen Logic ---
fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        mainContent.requestFullscreen().catch(err => alert(`Error: ${err.message}`));
        fullscreenBtn.textContent = "Exit Full Screen";
    } else {
        document.exitFullscreen();
        fullscreenBtn.textContent = "Full Screen";
    }
});

// --- UI Toggle Logic ---
function toggleOverlayButtons() {
    fullscreenBtn.classList.toggle('hidden');
    shareBtn.classList.toggle('hidden');
    openFullBtn.classList.toggle('hidden');
}

if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleOverlayButtons);
}

document.addEventListener('keydown', (event) => {
    if (event.key === '`') {
        toggleOverlayButtons();
    }
});

runnerFrame.addEventListener('load', () => {
    try {
        runnerFrame.contentWindow.document.addEventListener('keydown', (event) => {
            if (event.key === '`') {
                toggleOverlayButtons();
            }
        });
    } catch (error) {
        console.warn("Could not attach keyboard shortcut to iframe.");
    }
});

// ==========================================
// --- Theme Settings Modal Logic ---
// ==========================================

const themeModal = document.getElementById('theme-modal');
const themeBtn = document.getElementById('theme-settings-btn');
const closeThemeBtn = document.getElementById('close-theme-btn');

themeBtn.addEventListener('click', () => {
    themeModal.classList.remove('hidden');
});

closeThemeBtn.addEventListener('click', () => {
    themeModal.classList.add('hidden');
});

// Load saved theme on startup using documentElement instead of body
const savedTheme = localStorage.getItem('orgeyt-theme') || 'default';
document.documentElement.setAttribute('data-theme', savedTheme);

// Handle theme button clicks
const themeButtons = document.querySelectorAll('[data-set-theme]');
themeButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        // Use currentTarget to strictly get the button, even if text is clicked
        const theme = e.currentTarget.getAttribute('data-set-theme');
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('orgeyt-theme', theme); // Saves it so it stays when you refresh!
    });
});


// ==========================================
// --- Tab Modifier (Cloak) Logic ---
// ==========================================

const tabModal = document.getElementById('tab-modal');
const tabModifierBtn = document.getElementById('tab-modifier-btn');
const closeModalBtn = document.getElementById('close-modal-btn');

tabModifierBtn.addEventListener('click', () => {
    tabModal.classList.remove('hidden');
});

closeModalBtn.addEventListener('click', () => {
    tabModal.classList.add('hidden');
});

function changeFavicon(src) {
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
    }
    link.href = src;
}

document.getElementById('apply-title-btn').addEventListener('click', () => {
    const newTitle = document.getElementById('tab-title-input').value.trim();
    if (newTitle) {
        document.title = newTitle;
    }
});

document.querySelectorAll('.icon-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        changeFavicon(e.target.dataset.icon);
    });
});

document.getElementById('apply-url-btn').addEventListener('click', () => {
    const newUrl = document.getElementById('icon-url-input').value.trim();
    if (newUrl) {
        changeFavicon(newUrl);
    }
});

document.getElementById('icon-file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            changeFavicon(event.target.result);
        };
        reader.readAsDataURL(file);
    }
});

// ==========================================
// --- Friend's Website Modal Logic ---
// ==========================================

const friendsModal = document.getElementById('friends-modal');
const friendsWebsiteBtn = document.getElementById('friends-website-btn');
const closeFriendsModalBtn = document.getElementById('close-friends-modal-btn');

friendsWebsiteBtn.addEventListener('click', () => {
    friendsModal.classList.remove('hidden');
});

closeFriendsModalBtn.addEventListener('click', () => {
    friendsModal.classList.add('hidden');
});

// ==========================================
// --- Secret Logo Click Logic ---
// ==========================================

const sidebarLogo = document.getElementById('sidebar-logo');
let logoClickCount = 0;
let secretUnlocked = false;

if (sidebarLogo) {
    sidebarLogo.addEventListener('click', () => {
        if (secretUnlocked) return; 
        
        logoClickCount++;
        
        if (logoClickCount === 15) {
            secretUnlocked = true; 
            window.open('https://orgeyt.github.io/orgeyt.github.io-myprojects/secret_5Hd82K8Fb8.html', '_blank');
        }
    });
}
