// 1. List your projects..
const projects = [
    "welcome", "fnftools", "spritesheetmerger", "3danimator", "catmemory", 
    "midiplayer", "mandelbrot", "gswitch", "pfpmaker", "platformer", 
    "throwplayground", { name: "boyfriend test", path: "boyfriend test/index.html" }, 
    "grapplinghook", "physicsandbox", "stacktower", "airhockey", "chess", "flappyarena", "solarsystem", "3dplatformerengine", "synchronizedsouls", { name: "midiplayerplus", path: "midiplayerplus/index.html" }, 
    "flockybird", { name: "bumfuzzle preview", path: "bumfuzzlepreview/index.html" }, "bsodprank", { name: "speedysphere", path: "speedysphere/index.html" }, { name: "cube brawlers", path: "cubebrawlers/index.html" }, 
    "randomwordgenerator", "fnfworldrecords", "easiestgameever", { name: "ragebait quiz", path: "ragebaitquiz/index.html" }, "hexofthehour", "conwaysgameoflife",
    "fnfengine", { name: "DFJK Remake", path: "dfjkremake/index.html" }, "sunset", { name: "Cardboard Ragdoll", path: "cardboard ragdoll/index.html" }, { name: "Ultimate Dodging TWO", path: "ultimatedodgingtwo.html" },
    { name: "Notepad", path: "notepad/index.html" }, "jumpscareprank", { name: "Rubix Cube", path: "rubixcube/index.html" }, "rubixcubefixed", { name: "FNF Playground", path: "fnf playground/index.html" },
    "blobfighting"
];

const fileList = document.getElementById('file-list');
const runnerFrame = document.getElementById('runner-frame');

// Track the current project identifier for URL generation
let currentProjectParam = "welcome";

projects.forEach(project => {
    const button = document.createElement('button');
    button.className = 'file-btn';
    
    // Determine the identifier string for the URL parameter
    let projectParam = (typeof project === 'object') ? project.name : project;
    let filePath = (typeof project === 'object') ? project.path : `html_${project}.html`;
    
    button.textContent = (typeof project === 'object') ? `Run ${project.name}` : `Run ${project}`;
    
    button.onclick = () => { 
        runnerFrame.src = filePath; 
        currentProjectParam = projectParam;
    };
    fileList.appendChild(button);
});

// --- URL Parameter Auto-Open Logic ---
const urlParams = new URLSearchParams(window.location.search);
const projectToLoad = urlParams.get('project');

if (projectToLoad) {
    // Find matching project by string name or object name properties
    const foundProject = projects.find(p => {
        if (typeof p === 'object') {
            return p.name.toLowerCase() == projectToLoad.toLowerCase();
        }
        return p.toLowerCase() === projectToLoad.toLowerCase();
    });

    if (foundProject) {
        let filePath = (typeof foundProject === 'object') ? foundProject.path : `html_${foundProject}.html`;
        runnerFrame.src = filePath;
        currentProjectParam = (typeof foundProject === 'object') ? foundProject.name : foundProject;
    } else {
        runnerFrame.src = 'html_welcome.html';
    }
} else {
    runnerFrame.src = 'html_welcome.html';
}

// ==========================================
// --- Unified UI & Button Controls Logic ---
// ==========================================

const shareBtn = document.getElementById('share-btn');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const toggleBtn = document.getElementById('toggle-ui-btn');
const mainContent = document.querySelector('.main-content');

// --- Share URL Generator Logic ---
shareBtn.addEventListener('click', () => {
    // Dynamically builds the URL based on the current domain and active project parameter
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
}

// Bind toggle to the button click
if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleOverlayButtons);
}

// Bind toggle to the backtick (`) keypress on the main window
document.addEventListener('keydown', (event) => {
    if (event.key === '`') {
        toggleOverlayButtons();
    }
});

// FIX: Bind the shortcut inside the iframe so it works when a project is focused!
runnerFrame.addEventListener('load', () => {
    try {
        runnerFrame.contentWindow.document.addEventListener('keydown', (event) => {
            if (event.key === '`') {
                toggleOverlayButtons();
            }
        });
    } catch (error) {
        // This catch block prevents the page from breaking if you ever load an external website in the iframe
        console.warn("Could not attach keyboard shortcut to iframe.");
    }
});

// ==========================================
// --- Tab Modifier (Cloak) Logic ---
// ==========================================

const tabModal = document.getElementById('tab-modal');
const tabModifierBtn = document.getElementById('tab-modifier-btn');
const closeModalBtn = document.getElementById('close-modal-btn');

// Open and Close Menu
tabModifierBtn.addEventListener('click', () => {
    tabModal.classList.remove('hidden');
});

closeModalBtn.addEventListener('click', () => {
    tabModal.classList.add('hidden');
});

// Helper function to update the Favicon dynamically
function changeFavicon(src) {
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
    }
    link.href = src;
}

// 1. Apply Title Change
document.getElementById('apply-title-btn').addEventListener('click', () => {
    const newTitle = document.getElementById('tab-title-input').value.trim();
    if (newTitle) {
        document.title = newTitle;
    }
});

// 2. Apply Quick Icons (Default, Mungus, Classroom)
document.querySelectorAll('.icon-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        changeFavicon(e.target.dataset.icon);
    });
});

// 3. Apply Custom Icon via URL
document.getElementById('apply-url-btn').addEventListener('click', () => {
    const newUrl = document.getElementById('icon-url-input').value.trim();
    if (newUrl) {
        changeFavicon(newUrl);
    }
});

// 4. Apply Custom Icon via Local File Upload
document.getElementById('icon-file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            changeFavicon(event.target.result); // Converts the file to a base64 string
        };
        reader.readAsDataURL(file);
    }
});
