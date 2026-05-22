// 1. List your projects. Strings for files, Objects for folder-based projects.
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
    { name: "passthebomb", path: "passthebomb/index.html" }
];

// 2. Grab the elements from the DOM
const fileList = document.getElementById('file-list');
const runnerFrame = document.getElementById('runner-frame');

// 3. Loop through the array and create a button for each project
projects.forEach(project => {
    const button = document.createElement('button');
    button.className = 'file-btn';
    
    let filePath;

    // 4. Determine if the project is a folder object or a single file string
    if (typeof project === 'object') {
        button.textContent = `Run ${project.name}`;
        filePath = project.path;
    } else {
        button.textContent = `Run ${project}`;
        filePath = `html_${project}.html`;
    }
    
    // 5. When clicked, load the correct path into the iframe
button.onclick = () => {

    // Load the project normally
    runnerFrame.src = filePath;

    // Special Pass The Bomb fix
    if (filePath === "passthebomb/index.html") {

        runnerFrame.onload = () => {

            try {
                const win = runnerFrame.contentWindow;

                // Override fetch inside iframe
                const originalFetch = win.fetch;

                win.fetch = (url, ...args) => {

                    // Remove leading slash ONLY if it exists
                    if (typeof url === "string" && url.startsWith("/")) {
                        url = url.substring(1);
                    }

                    return originalFetch.call(win, url, ...args);
                };

            } catch (e) {
                console.log("Pass The Bomb fetch patch failed:", e);
            }
        };
    }
};

// Set default page to welcome
runnerFrame.src = 'html_welcome.html';
