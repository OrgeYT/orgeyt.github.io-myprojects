// 1. List your projects.
const projects = [
    "welcome", "fnftools", "spritesheetmerger", "3danimator", "catmemory", 
    "midiplayer", "mandelbrot", "gswitch", "pfpmaker", "platformer", 
    "throwplayground", { name: "boyfriend test", path: "boyfriend test/index.html" }, 
    "grapplinghook", "physicsandbox", "stacktower", "airhockey", "chess", "flappyarena", "solarsystem"
];

const fileList = document.getElementById('file-list');
const runnerFrame = document.getElementById('runner-frame');

projects.forEach(project => {
    const button = document.createElement('button');
    button.className = 'file-btn';
    let filePath = (typeof project === 'object') ? project.path : `html_${project}.html`;
    button.textContent = (typeof project === 'object') ? `Run ${project.name}` : `Run ${project}`;
    button.onclick = () => { runnerFrame.src = filePath; };
    fileList.appendChild(button);
});

runnerFrame.src = 'html_welcome.html';

// Fullscreen logic
const fullscreenBtn = document.getElementById('fullscreen-btn');
const mainContent = document.querySelector('.main-content');

fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        mainContent.requestFullscreen().catch(err => alert(`Error: ${err.message}`));
        fullscreenBtn.textContent = "Exit Full Screen";
    } else {
        document.exitFullscreen();
        fullscreenBtn.textContent = "Full Screen";
    }
});
