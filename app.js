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
    "grapplinghook",
    "physicsandbox",
    "stacktower"
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
        runnerFrame.src = filePath;
    };
    
    fileList.appendChild(button);
});

// Set default page to welcome
runnerFrame.src = 'html_welcome.html';
