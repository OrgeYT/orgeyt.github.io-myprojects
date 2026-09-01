// 1. Add the NAME of your files here. 
// If your file is called "html_test.html", just type "test".
const projects = [
    "welcome"
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
        // This constructs the exact file name: html_NAME.html
        const fileName = `html_${name}.html`;
        runnerFrame.src = fileName;
    };
    
    fileList.appendChild(button);
});