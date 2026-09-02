// ===========================================
// --- Achievements & Time Tracker Setup ----
// ===========================================

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

// ==========================================
// --- Visit Tracking System ---
// ==========================================

let visitedProjects = JSON.parse(localStorage.getItem('orgeyt-visited-projects')) || {};

function getProjectVisitCount(projectName) {
    const key = projectName.toLowerCase();
    if (visitedProjects[key]) {
        return visitedProjects[key].count || 0;
    }
    return 0;
}

function getProjectLastVisit(projectName) {
    const key = projectName.toLowerCase();
    if (visitedProjects[key]) {
        return visitedProjects[key].lastVisit || null;
    }
    return null;
}

function recordProjectVisit(projectName) {
    const key = projectName.toLowerCase();
    const now = Date.now();
    if (!visitedProjects[key]) {
        visitedProjects[key] = { count: 0, visits: [] };
    }
    visitedProjects[key].count++;
    visitedProjects[key].lastVisit = now;
    if (!visitedProjects[key].visits) {
        visitedProjects[key].visits = [];
    }
    visitedProjects[key].visits.push(now);
    localStorage.setItem('orgeyt-visited-projects', JSON.stringify(visitedProjects));
}

function getRelativeTimeText(timestamp) {
    if (!timestamp) return 'Never';
    const now = Date.now();
    const diff = now - timestamp;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (seconds < 60) return 'Visited just now';
    if (minutes < 60) {
        return `Visited ${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    }
    if (hours < 24) {
        return `Visited ${hours} hour${hours === 1 ? '' : 's'} ago`;
    }
    if (days === 1) return 'Visited yesterday';
    if (days < 7) {
        return `Visited ${days} days ago`;
    }
    if (days < 30) {
        const weeks = Math.floor(days / 7);
        return `Visited ${weeks} week${weeks === 1 ? '' : 's'} ago`;
    }
    if (days < 365) {
        const months = Math.floor(days / 30);
        return `Visited ${months} month${months === 1 ? '' : 's'} ago`;
    }
    const years = Math.floor(days / 365);
    return `Visited ${years} year${years === 1 ? '' : 's'} ago`;
}

function clearVisitedProjects() {
    if (confirm('Are you sure you want to clear all visit history? This cannot be undone.')) {
        visitedProjects = {};
        localStorage.removeItem('orgeyt-visited-projects');
        if (typeof renderProjectList === 'function') renderProjectList();
    }
}

// Keep "Visited X minutes/hours ago" text updated live
setInterval(() => {
    const list = document.getElementById('file-list');
    if (!list) return;
    const buttons = list.querySelectorAll('.file-btn');

    buttons.forEach(button => {
        const projectName = button.dataset.projectName;
        if (!projectName) return;

        const lastVisit = getProjectLastVisit(projectName);
        if (!lastVisit) return;

        const visitInfo = button.querySelector('[data-visit-info]');
        if (visitInfo) {
            visitInfo.textContent = `Visited ${getProjectVisitCount(projectName)} time${getProjectVisitCount(projectName) === 1 ? '' : 's'} • ${getRelativeTimeText(lastVisit).replace('Visited ', '')}`;
        }
    });
}, 1000);

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
    if (!toast) return;
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
    if (!list) return;
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
    if (weeks > 0) display.push(`${weeks}w`);
    if (days > 0) display.push(`${days}d`);
    if (hours > 0) display.push(`${hours}h`);
    if (mins > 0) display.push(`${mins}m`);
    display.push(`${secs}s`);

    const el = document.getElementById('time-counter');
    if (el) el.textContent = `Time: ${display.join(' ')}`;
}

setInterval(() => {
    timeSpent++;
    localStorage.setItem('orgeyt-time', timeSpent);
    updateTimeDisplay();

    if (timeSpent >= 60) unlockAchievement('time_1m');
    if (timeSpent >= 600) unlockAchievement('time_10m');
    if (timeSpent >= 1800) unlockAchievement('time_30m');
    if (timeSpent >= 3600) unlockAchievement('time_1h');
    if (timeSpent >= 86400) unlockAchievement('time_24h');
    if (timeSpent >= 604800) unlockAchievement('time_1w');
}, 1000);

// Initialize on boot
if (unlockedAchievements.length === 0) unlockAchievement('welcome');
renderAchievements();
updateTimeDisplay();
