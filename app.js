// 1. Add 'boyfriend test' to your array
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
    "boyfriend test" // <-- Added here
];

// 2. Grab the elements from the DOM
const fileList = document.getElementById('file-list');
const runnerFrame = document.getElementById('runner-frame');

// 3. Loop through the array and create a button for each project
projects.forEach(name => {
    const button = document.createElement('button');
    button.textContent = `Run ${name}`;
    button.className = 'file-btn';
    
    // 4. When clicked, load the corresponding path into the iframe
    button.onclick = () => {
        let filePath;
        
        // Check if it's the folder project
        if (name === "boyfriend test") {
            filePath = "boyfriend test/index.html"; 
        } else {
            // Your original working logic for single files
            filePath = `html_${name}.html`;
        }
        
        runnerFrame.src = filePath;
    };
    
    fileList.appendChild(button);
});

// Set default page to welcome
runnerFrame.src = 'html_welcome.html';
