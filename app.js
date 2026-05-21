// 1. Add the NAME of your files here. 
const projects = [
    "welcome",
    "fnftools",
    "spritesheetmerger",
    "3danimator",
    "catmemory",
    "midiplayer"
    ];

// 2. Grab the elements from the DOM
const fileList = document.getElementById('file-list');
const runnerFrame = document.getElementById('runner-frame');

// 3. Loop through the array and create a button for each project
projects.forEach(name => {
    const button = document.createElement('button');
    button.textContent = `Run ${name}`;
    button.className = 'file-btn';
    
    // 4. When clicked, load the corresponding file into the iframe
    button.onclick = () => {
        const fileName = `html_${name}.html`;
        runnerFrame.src = fileName;
    };
    
    fileList.appendChild(button);
});

// --- ADD THIS LINE BELOW ---
// Set default page to welcome
runnerFrame.src = 'html_welcome.html';
