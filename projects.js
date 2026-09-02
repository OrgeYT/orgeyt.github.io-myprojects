// ===========================================
// --- Project list, load, favorites, search ---
// ===========================================

const fileList = document.getElementById('file-list');
const runnerFrame = document.getElementById('runner-frame');
const searchBar = document.getElementById('search-bar');
const randomProjectBtn = document.getElementById('random-project-btn');
const favoriteBtn = document.getElementById('favorite-btn');

let currentProjectParam = "welcome";
let currentFilePath = "html_welcome.html";
window.currentProjectParam = currentProjectParam;
window.currentFilePath = currentFilePath;
let favorites = JSON.parse(localStorage.getItem('orgeyt-favorites')) || [];
let currentProjectTab = 'all';

document.getElementById('project-counter').textContent = `Total Projects: ${typeof projects !== 'undefined' ? projects.length : 0}`;

// Tab buttons
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
    if (!favoriteBtn) return;
    if (favorites.includes(currentProjectParam.toLowerCase())) {
        favoriteBtn.innerHTML = '<span class="btn-icon">⭐</span> Unfavorite';
    } else {
        favoriteBtn.innerHTML = '<span class="btn-icon">⭐</span> Favorite';
    }
}

function applySearchFilter() {
    if (!searchBar || !fileList) return;
    const searchTerm = searchBar.value.toLowerCase();
    const buttons = fileList.querySelectorAll('.file-btn');

    buttons.forEach(btn => {
        const projectName = btn.dataset.projectName || '';
        if (projectName.includes(searchTerm)) {
            btn.style.display = '';
        } else {
            btn.style.display = 'none';
        }
    });
}

function renderProjectList() {
    if (!fileList || typeof projects === 'undefined') return;
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

    const isVisited = (p) => {
        let name = typeof p === 'object' ? p.name : p;
        return getProjectVisitCount(name) > 0;
    };

    let sortedProjects;

    if (currentProjectTab === 'visited') {
        const visitedProjectsList = projects.filter(p => isVisited(p));
        sortedProjects = visitedProjectsList.sort((a, b) => {
            const nameA = typeof a === 'object' ? a.name : a;
            const nameB = typeof b === 'object' ? b.name : b;
            return getProjectVisitCount(nameB) - getProjectVisitCount(nameA);
        });
    } else {
        const welcomeProjects = projects.filter(p => isWelcome(p));
        const favoritedProjects = projects.filter(p => !isWelcome(p) && isFavorite(p));
        const regularProjects = projects.filter(p => !isWelcome(p) && !isFavorite(p));
        sortedProjects = [...welcomeProjects, ...favoritedProjects, ...regularProjects];
    }

    sortedProjects.forEach(project => {
        let projectParam = (typeof project === 'object') ? project.name : project;
        let isFav = isFavorite(project);

        if (currentProjectTab === 'favorites' && !isFav && !isWelcome(project)) return;
        if (currentProjectTab === 'unfavorited' && isFav && !isWelcome(project)) return;
        if (currentProjectTab === 'scratch' && !isScratch(project)) return;
        if (currentProjectTab === 'visited' && !isVisited(project)) return;

        const button = document.createElement('button');
        button.className = 'file-btn';
        if (isFav) button.classList.add('favorited-item');
        if (projectParam.toLowerCase() === (currentProjectParam || '').toLowerCase()) {
            button.classList.add('active-project');
        }
        button.dataset.projectName = projectParam.toLowerCase();
        button.dataset.sound = 'true';

        let btnText = (typeof project === 'object') ? `Launch ${project.name}` : `Launch ${project}`;
        if (isFav) btnText += " ⭐";

        const visitCount = getProjectVisitCount(projectParam);
        const lastVisitTime = getProjectLastVisit(projectParam);
        const relativeTime = getRelativeTimeText(lastVisitTime);

        if (visitCount > 0) {
            button.innerHTML = `<div style="display: flex; flex-direction: column; align-items: flex-start; width: 100%;">
                <div>${btnText}</div>
                <div data-visit-info style="font-size: 0.75rem; color: var(--text-accent); margin-top: 2px;">Visited ${visitCount} time${visitCount === 1 ? '' : 's'} • ${relativeTime.replace('Visited ', '')}</div>
            </div>`;
        } else {
            button.textContent = btnText;
        }

        button.onclick = () => {
            loadProject(project);
            if (typeof closeSidebar === 'function') closeSidebar();
        };
        fileList.appendChild(button);
    });

    applySearchFilter();
    // Re-attach sounds for new buttons
    if (typeof attachSidebarSounds === 'function') attachSidebarSounds();
}

function loadProject(project) {
    let projectParam = (typeof project === 'object') ? project.name : project;
    let filePath = (typeof project === 'object') ? project.path : `html_${project}.html`;

    if (!filePath.startsWith('http') &&
        !filePath.startsWith('data:') &&
        !filePath.startsWith('scratch-') &&
        !filePath.startsWith('projects/')) {
        filePath = `projects/${filePath}`;
    }

    let isExternalUrl = false;

    if (filePath.startsWith("scratch-")) {
        const scratchId = filePath.replace("scratch-", "");
        filePath = `https://turbowarp.org/${scratchId}/embed?interpolate&hqpen&settings-button&addons=pause%2Cmute-project%2Cclones%2Cgamepad%2Cremove-curved-stage-border%2Cdrag-drop`;
        isExternalUrl = true;
    } else if (filePath.startsWith("http") || filePath.startsWith("data:")) {
        isExternalUrl = true;
    }

    const viewRepoBtn = document.getElementById('view-repo-btn');
    if (viewRepoBtn) {
        viewRepoBtn.onclick = () => {
            window.open('https://github.com/OrgeYT/orgeyt.github.io-myprojects', '_blank');
        };
    }

    if (!isInitialLoad && currentProjectParam.toLowerCase() !== projectParam.toLowerCase()) {
        unlockAchievement('explorer');
    }

    if (!isInitialLoad && searchBar && searchBar.value.trim() !== "") {
        unlockAchievement('searcher');
    }

    isInitialLoad = false;

    recordProjectVisit(projectParam);

    const clickedButton = fileList?.querySelector(
        `[data-project-name="${CSS.escape(projectParam.toLowerCase())}"]`
    );

    if (clickedButton) {
        const count = getProjectVisitCount(projectParam);
        const lastVisit = getProjectLastVisit(projectParam);

        let visitInfo = clickedButton.querySelector('[data-visit-info]');

        if (!visitInfo) {
            let container = clickedButton.querySelector('div');

            if (!container) {
                const oldText = clickedButton.textContent;
                clickedButton.innerHTML = '';
                container = document.createElement('div');
                container.style.display = 'flex';
                container.style.flexDirection = 'column';
                container.style.alignItems = 'flex-start';
                container.style.width = '100%';
                const title = document.createElement('div');
                title.textContent = oldText;
                container.appendChild(title);
                clickedButton.appendChild(container);
            }

            visitInfo = document.createElement('div');
            visitInfo.dataset.visitInfo = '';
            visitInfo.style.fontSize = '0.75rem';
            visitInfo.style.color = 'var(--text-accent)';
            visitInfo.style.marginTop = '2px';
            container.appendChild(visitInfo);
        }

        visitInfo.textContent =
            `Visited ${count} time${count === 1 ? '' : 's'} • ${getRelativeTimeText(lastVisit).replace(/^Visited /, '')}`;
    }

    runnerFrame.src = filePath;
    currentProjectParam = projectParam;
    currentFilePath = filePath;
    window.currentProjectParam = currentProjectParam;
    window.currentFilePath = currentFilePath;
    updateFavoriteButtonText();

    // Highlight active project in the list without full re-render when possible
    if (fileList) {
        fileList.querySelectorAll('.file-btn').forEach(btn => {
            const name = (btn.dataset.projectName || '').toLowerCase();
            if (name === projectParam.toLowerCase()) {
                btn.classList.add('active-project');
            } else {
                btn.classList.remove('active-project');
            }
        });
    }
}

renderProjectList();

// Favorites
if (favoriteBtn) {
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
}

// Random — minimize sidebar and load
if (randomProjectBtn) {
    randomProjectBtn.addEventListener('click', () => {
        const buttons = Array.from(fileList.querySelectorAll('.file-btn')).filter(btn => btn.style.display !== 'none');
        if (buttons.length > 0) {
            const randomBtn = buttons[Math.floor(Math.random() * buttons.length)];
            randomBtn.click();
            unlockAchievement('randomizer');
            if (typeof closeSidebar === 'function') closeSidebar();
        }
    });
}

if (searchBar) {
    searchBar.addEventListener('input', applySearchFilter);
}

// URL project load
const urlParams = new URLSearchParams(window.location.search);
const projectToLoad = urlParams.get('project');

if (projectToLoad && typeof projects !== 'undefined') {
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

// ==========================================
// --- Line Graph Feature ---
// ==========================================

const LG_SERIES = [
    { key: 'downloadable',   label: 'Downloadable',    color: '#3b82f6' },
    { key: 'undownloadable', label: 'Undownloadable',  color: '#a855f7' },
    { key: 'html',           label: 'HTML only',       color: '#ef4444' },
    { key: 'multi',          label: 'Multi-file',      color: '#eab308' },
    { key: 'scratch',        label: 'Scratch',         color: '#f97316' },
    { key: 'text',           label: 'Text file',       color: '#e5e5e5' },
    { key: 'embed',          label: 'Website embed',   color: '#ec4899' }
];

function lgClassify(project) {
    const path = (typeof project === 'object') ? project.path : `html_${project}.html`;
    if (path.startsWith('scratch-')) return 'scratch';
    if (path.startsWith('http') || path.startsWith('data:')) return 'embed';
    if (/\.(txt|md|png)$/i.test(path)) return 'text';
    if (path.includes('/')) return 'multi';
    return 'html';
}

function lgIsDownloadable(project) {
    const path = (typeof project === 'object') ? project.path : `html_${project}.html`;
    return !(path.startsWith('scratch-') || path.startsWith('http') || path.startsWith('data:'));
}

function lgName(project) {
    return (typeof project === 'object') ? project.name : project;
}

function lgBuildCumulativeData() {
    const totals = { downloadable: 0, undownloadable: 0, html: 0, multi: 0, scratch: 0, text: 0, embed: 0 };
    const series = {};
    LG_SERIES.forEach(s => { series[s.key] = []; });

    projects.forEach((p) => {
        const type = lgClassify(p);
        const dl = lgIsDownloadable(p);
        if (dl) totals.downloadable++;
        else totals.undownloadable++;
        totals[type]++;
        LG_SERIES.forEach(s => {
            series[s.key].push(totals[s.key]);
        });
    });
    return { series, final: { ...totals } };
}

let lgIndex = 0;
let lgData = null;

function lgDrawChart() {
    const canvas = document.getElementById('line-graph-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || 800;
    const cssH = 360;
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const W = cssW;
    const H = cssH;
    const pad = { top: 28, right: 18, bottom: 42, left: 48 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;

    if (!lgData) lgData = lgBuildCumulativeData();
    const n = projects.length;
    const maxY = Math.max(...Object.values(lgData.final), 1);

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#888';
    ctx.font = '11px Segoe UI, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
        const v = (maxY * i) / yTicks;
        const y = pad.top + plotH - (v / maxY) * plotH;
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(pad.left + plotW, y);
        ctx.stroke();
        ctx.fillText(Math.round(v).toString(), pad.left - 8, y);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const xStep = Math.max(1, Math.ceil(n / 10));
    for (let i = 0; i < n; i += xStep) {
        const x = pad.left + (i / (n - 1 || 1)) * plotW;
        ctx.fillText(String(i + 1), x, pad.top + plotH + 8);
    }
    if ((n - 1) % xStep !== 0) {
        const x = pad.left + plotW;
        ctx.fillText(String(n), x, pad.top + plotH + 8);
    }

    ctx.fillStyle = '#aaa';
    ctx.font = '12px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Project index (order in list)', pad.left + plotW / 2, H - 12);
    ctx.save();
    ctx.translate(14, pad.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Cumulative count', 0, 0);
    ctx.restore();

    ctx.fillStyle = '#ddd';
    ctx.font = 'bold 13px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Cumulative project types over the list', pad.left + plotW / 2, 14);

    function xOf(i) { return pad.left + (i / (n - 1 || 1)) * plotW; }
    function yOf(v) { return pad.top + plotH - (v / maxY) * plotH; }

    LG_SERIES.forEach(s => {
        const pts = lgData.series[s.key];
        ctx.beginPath();
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 2.2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        pts.forEach((v, i) => {
            const x = xOf(i);
            const y = yOf(v);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();
    });

    const cx = xOf(lgIndex);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cx, pad.top);
    ctx.lineTo(cx, pad.top + plotH);
    ctx.stroke();
    ctx.setLineDash([]);

    LG_SERIES.forEach(s => {
        const v = lgData.series[s.key][lgIndex];
        const y = yOf(v);
        ctx.beginPath();
        ctx.fillStyle = s.color;
        ctx.arc(cx, y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1;
        ctx.stroke();
    });
}

function lgUpdateLabel() {
    const p = projects[lgIndex];
    const name = lgName(p);
    const type = lgClassify(p);
    const dl = lgIsDownloadable(p);
    const el = document.getElementById('line-graph-current-label');
    if (el) {
        el.textContent = `#${lgIndex + 1} / ${projects.length}: ${name}  [${type}${dl ? ' · downloadable' : ' · undownloadable'}]`;
    }
}

function lgRenderLegendAndTotals() {
    if (!lgData) lgData = lgBuildCumulativeData();
    const legend = document.getElementById('line-graph-legend');
    const totalsEl = document.getElementById('line-graph-totals');
    if (!legend || !totalsEl) return;

    legend.innerHTML = LG_SERIES.map(s => `
        <div class="lg-legend-item">
            <span class="lg-legend-swatch" style="background:${s.color}"></span>
            ${s.label}
        </div>
    `).join('');

    const f = lgData.final;
    totalsEl.innerHTML = LG_SERIES.map(s =>
        `<div><strong style="color:${s.color}">${f[s.key]}</strong> ${s.label}</div>`
    ).join('') + `<div><strong>${projects.length}</strong> Total projects</div>`;
}

function lgRefresh() {
    lgUpdateLabel();
    lgDrawChart();
}

const lineGraphModal = document.getElementById('line-graph-modal');
const lineGraphBtn = document.getElementById('line-graph-btn');
const closeLineGraphBtn = document.getElementById('close-line-graph-btn');

if (lineGraphBtn) {
    lineGraphBtn.addEventListener('click', () => {
        lgData = lgBuildCumulativeData();
        const found = projects.findIndex(p => lgName(p).toLowerCase() === (currentProjectParam || '').toLowerCase());
        lgIndex = found >= 0 ? found : 0;
        lgRenderLegendAndTotals();
        lineGraphModal.classList.remove('hidden');
        requestAnimationFrame(() => lgRefresh());
    });
}
if (closeLineGraphBtn) {
    closeLineGraphBtn.addEventListener('click', () => lineGraphModal.classList.add('hidden'));
}

document.getElementById('line-graph-prev')?.addEventListener('click', () => {
    lgIndex = (lgIndex - 1 + projects.length) % projects.length;
    lgRefresh();
});
document.getElementById('line-graph-next')?.addEventListener('click', () => {
    lgIndex = (lgIndex + 1) % projects.length;
    lgRefresh();
});

window.addEventListener('resize', () => {
    if (lineGraphModal && !lineGraphModal.classList.contains('hidden')) {
        lgDrawChart();
    }
});

// ===========================================
// --- Project of the Hour/Day/Year ---
// ===========================================

function getHashSeed(type) {
    const now = new Date();
    let period;

    if (type === 'hour') {
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const date = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');
        period = `${year}-${month}-${date}-${hour}`;
    } else if (type === 'day') {
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const date = String(now.getDate()).padStart(2, '0');
        period = `${year}-${month}-${date}`;
    } else if (type === 'year') {
        const year = now.getFullYear();
        period = `${year}`;
    }

    return period;
}

function getProjectOfThePeriod(type) {
    if (projects.length === 0) return null;

    const seed = getHashSeed(type);
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        const char = seed.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }

    const index = Math.abs(hash) % projects.length;
    return projects[index];
}

function displayProjectOfTime(type) {
    const project = getProjectOfThePeriod(type);
    if (!project) return;

    const displayName = typeof project === 'object' ? project.name : project;
    let timeLabel = type.charAt(0).toUpperCase() + type.slice(1);

    document.getElementById('pot-project-name').textContent = `Project of the ${timeLabel}`;
    document.getElementById('pot-project-info').textContent = displayName;
}

const projectOfTimeBtn = document.getElementById('project-of-time-btn');
const projectOfTimeModal = document.getElementById('project-of-time-modal');
const closeProjectOfTimeBtn = document.getElementById('close-project-of-time-btn');
const potPlayBtn = document.getElementById('pot-play-btn');

let currentPotType = 'hour';
let currentPotProject = null;

if (projectOfTimeBtn) {
    projectOfTimeBtn.addEventListener('click', () => {
        currentPotType = 'hour';
        currentPotProject = getProjectOfThePeriod('hour');
        displayProjectOfTime('hour');

        document.querySelectorAll('.pot-time-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector('[data-pot-type="hour"]').classList.add('active');

        projectOfTimeModal.classList.remove('hidden');
    });
}

if (closeProjectOfTimeBtn) {
    closeProjectOfTimeBtn.addEventListener('click', () => projectOfTimeModal.classList.add('hidden'));
}

document.querySelectorAll('.pot-time-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const type = e.target.dataset.potType;
        currentPotType = type;
        currentPotProject = getProjectOfThePeriod(type);
        displayProjectOfTime(type);

        document.querySelectorAll('.pot-time-btn').forEach(b => {
            b.classList.remove('active');
        });
        e.target.classList.add('active');
    });
});

if (potPlayBtn) {
    potPlayBtn.addEventListener('click', () => {
        if (currentPotProject) {
            loadProject(currentPotProject);
            projectOfTimeModal.classList.add('hidden');
            if (typeof closeSidebar === 'function') closeSidebar();
        }
    });
}

const clearVisitedBtn = document.getElementById('clear-visited-btn');
if (clearVisitedBtn) {
    clearVisitedBtn.addEventListener('click', clearVisitedProjects);
}

// View lists.js
const viewListsBtn = document.getElementById('view-lists-btn');
const viewListsModal = document.getElementById('view-lists-modal');
const closeViewListsBtn = document.getElementById('close-view-lists-btn');
const listsCodeDisplay = document.getElementById('lists-code-display');

if (viewListsBtn) {
    viewListsBtn.addEventListener('click', () => {
        fetch('lists.js')
            .then(response => response.text())
            .then(code => {
                listsCodeDisplay.textContent = code;
                viewListsModal.classList.remove('hidden');
            })
            .catch(err => {
                listsCodeDisplay.textContent = 'Error loading lists.js: ' + err.message;
                viewListsModal.classList.remove('hidden');
            });
    });
}

if (closeViewListsBtn) {
    closeViewListsBtn.addEventListener('click', () => viewListsModal.classList.add('hidden'));
}
