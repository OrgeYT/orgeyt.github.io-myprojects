import './three-shim.js'; // small shim to ensure OrbitControls attaches to THREE in module context (optional)

const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#111827');

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(5, 5, 7);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

const orbitControls = new THREE.OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true;
orbitControls.dampingFactor = 0.05;
orbitControls.minDistance = 3;
orbitControls.maxDistance = 30;

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);
const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
backLight.position.set(-10, -10, -10);
scene.add(backLight);

let cubes = [];
let cubeGroup = new THREE.Group();
scene.add(cubeGroup);
const pivot = new THREE.Object3D();

let isAnimating = false;
let moveHistory = [];
let animationQueue = [];
let currentSize = 3;
let currentOffset = 1;
let botSpeed = 1; // 1.0 = normal speed, higher = faster, lower = slower

const colors = [
    0xef4444, // Right: Red
    0xf97316, // Left: Orange
    0xffffff, // Top: White
    0xeab308, // Bottom: Yellow
    0x22c55e, // Front: Green
    0x3b82f6  // Back: Blue
];
const geometry = new THREE.BoxGeometry(0.96, 0.96, 0.96);

function buildCube(size) {
    currentSize = size;
    currentOffset = (size - 1) / 2;

    while (cubeGroup.children.length > 0) {
        const child = cubeGroup.children[0];
        cubeGroup.remove(child);
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
            if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
            else child.material.dispose();
        }
    }
    cubes.length = 0;
    moveHistory = [];
    animationQueue = [];

    cubeGroup.add(pivot);

    const coreGeo = new THREE.SphereGeometry(size * 0.47, 32, 32);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x080808 });
    const core = new THREE.Mesh(coreGeo, coreMat);
    cubeGroup.add(core);

    for (let x = -currentOffset; x <= currentOffset; x++) {
        for (let y = -currentOffset; y <= currentOffset; y++) {
            for (let z = -currentOffset; z <= currentOffset; z++) {
                if (Math.abs(x) !== currentOffset && Math.abs(y) !== currentOffset && Math.abs(z) !== currentOffset) continue;

                const materials = colors.map((color, index) => {
                    if (index === 0 && x === currentOffset) return new THREE.MeshPhongMaterial({ color, shininess: 30 });
                    if (index === 1 && x === -currentOffset) return new THREE.MeshPhongMaterial({ color, shininess: 30 });
                    if (index === 2 && y === currentOffset) return new THREE.MeshPhongMaterial({ color, shininess: 30 });
                    if (index === 3 && y === -currentOffset) return new THREE.MeshPhongMaterial({ color, shininess: 30 });
                    if (index === 4 && z === currentOffset) return new THREE.MeshPhongMaterial({ color, shininess: 30 });
                    if (index === 5 && z === -currentOffset) return new THREE.MeshPhongMaterial({ color, shininess: 30 });
                    return new THREE.MeshPhongMaterial({ color: 0x080808 });
                });

                const mesh = new THREE.Mesh(geometry, materials);
                mesh.position.set(x, y, z);
                mesh.userData = { initialPosition: new THREE.Vector3(x, y, z), uuid: mesh.uuid };
                cubeGroup.add(mesh);
                cubes.push(mesh);
            }
        }
    }

    camera.position.set(size * 1.5, size * 1.5, size * 2.2);
    orbitControls.target.set(0,0,0);
    orbitControls.update();

    buildControls();
}

const controlsContainer = document.getElementById('controls-container');

function buildControls() {
    controlsContainer.innerHTML = '';
    
    const axesConfig = [
        { title: 'X (R/L)', axis: 'x', pos: 'R', neg: 'L', mid: 'M' },
        { title: 'Y (U/D)', axis: 'y', pos: 'U', neg: 'D', mid: 'E' },
        { title: 'Z (F/B)', axis: 'z', pos: 'F', neg: 'B', mid: 'S' }
    ];

    axesConfig.forEach(cfg => {
        const header = document.createElement('div');
        header.className = "col-span-2 text-center text-xs font-bold text-gray-400 mt-2 border-b border-gray-700 pb-1";
        header.innerText = cfg.title;
        controlsContainer.appendChild(header);

        for (let layer = currentOffset; layer >= -currentOffset; layer--) {
            let moveLabel = '';
            
            if (layer === currentOffset) moveLabel = cfg.pos;
            else if (layer === -currentOffset) moveLabel = cfg.neg;
            else if (layer === 0) moveLabel = cfg.mid;
            else if (layer > 0) moveLabel = `${Math.round(currentOffset - layer + 1)}${cfg.pos}`;
            else moveLabel = `${Math.round(currentOffset + layer + 1)}${cfg.neg}`;

            let baseAngle = (layer > 0 || (layer === 0 && cfg.axis === 'y')) ? -Math.PI/2 : Math.PI/2;
            if (layer === 0) {
                if (cfg.axis === 'x') baseAngle = Math.PI/2;
                if (cfg.axis === 'y') baseAngle = Math.PI/2;
                if (cfg.axis === 'z') baseAngle = -Math.PI/2;
            }

            createBtn(moveLabel, cfg.axis, layer, baseAngle);
            createBtn(moveLabel + "'", cfg.axis, layer, -baseAngle);
        }
    });
}

function createBtn(label, axis, layer, angle) {
    const btn = document.createElement('button');
    btn.className = "bg-gray-800 hover:bg-gray-600 text-white font-mono font-bold text-sm py-1.5 rounded border border-gray-600 transition focus:ring-2 focus:ring-blue-500 focus:outline-none shadow";
    btn.innerText = label;
    btn.onclick = () => {
        if (isAnimating || animationQueue.length > 0) return;
        animationQueue.push({ axis, layer, angle, baseDuration: 150 });
        moveHistory.push({ axis, layer, angle, baseDuration: 150 });
        processQueue();
    };
    controlsContainer.appendChild(btn);
}

function snapToGrid(mesh) {
    const rem = currentOffset % 1; 
    
    mesh.position.x = Math.round(mesh.position.x - rem) + rem;
    mesh.position.y = Math.round(mesh.position.y - rem) + rem;
    mesh.position.z = Math.round(mesh.position.z - rem) + rem;
    
    const snap = Math.PI / 2;
    mesh.rotation.x = Math.round(mesh.rotation.x / snap) * snap;
    mesh.rotation.y = Math.round(mesh.rotation.y / snap) * snap;
    mesh.rotation.z = Math.round(mesh.rotation.z / snap) * snap;
    
    mesh.scale.set(1, 1, 1);
    mesh.updateMatrix();
}

function executeMove(axis, layer, angle, duration = 300, onComplete = null) {
    isAnimating = true;
    pivot.rotation.set(0, 0, 0);
    pivot.updateMatrixWorld();

    const activeCubes = [];
    cubes.forEach(cube => {
        if (Math.abs(cube.position[axis] - layer) < 0.1) {
            activeCubes.push(cube);
            pivot.attach(cube);
        }
    });

    const startAngle = pivot.rotation[axis];
    const endAngle = startAngle + angle;
    const startTime = performance.now();

    function animate(time) {
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        pivot.rotation[axis] = startAngle + (endAngle - startAngle) * ease;

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            pivot.rotation[axis] = endAngle;
            pivot.updateMatrixWorld();
            
            activeCubes.forEach(cube => {
                cubeGroup.attach(cube);
                snapToGrid(cube);
            });
            
            isAnimating = false;
            if (onComplete) onComplete();
        }
    }
    requestAnimationFrame(animate);
}

function executeTwist(cubeUUID, angle, duration = 300, onComplete = null) {
    isAnimating = true;
    const cube = cubes.find(c => c.uuid === cubeUUID);
    if (!cube) {
        isAnimating = false;
        if (onComplete) onComplete();
        return;
    }

    const twistAxis = cube.position.clone().normalize();
    const startQuat = cube.quaternion.clone();
    const targetQuat = cube.quaternion.clone().premultiply(
        new THREE.Quaternion().setFromAxisAngle(twistAxis, angle)
    );

    const startTime = performance.now();

    function animate(time) {
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        cube.quaternion.slerpQuaternions(startQuat, targetQuat, ease);

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            cube.quaternion.copy(targetQuat);
            snapToGrid(cube);
            isAnimating = false;
            if (onComplete) onComplete();
        }
    }
    requestAnimationFrame(animate);
}

function processQueue() {
    if (animationQueue.length === 0) {
        if(isAnimating) {
            showStatus("Cube Solved!", "text-green-400");
            setTimeout(() => document.getElementById('status-panel').classList.remove('opacity-100', '-translate-y-0'), 3000);
        }
        return;
    }
    if (isAnimating) return;

    const move = animationQueue.shift();
    // compute duration at execution time using current botSpeed; fallback to any existing duration value
    const base = move.baseDuration != null ? move.baseDuration : move.duration || 180;
    const duration = Math.max(10, Math.round(base / Math.max(0.001, botSpeed)));

    if (move.type === 'twist') {
        executeTwist(move.cubeUUID, move.angle, duration, processQueue);
    } else {
        executeMove(move.axis, move.layer, move.angle, duration, processQueue);
    }
}

function showStatus(text, colorClass = "text-blue-400") {
    const panel = document.getElementById('status-panel');
    const p = document.getElementById('status-text');
    p.className = `text-xl font-mono font-bold tracking-wide ${colorClass}`;
    p.innerText = text;
    panel.classList.remove('opacity-0', 'translate-y-4');
    panel.classList.add('opacity-100', 'translate-y-0');
}

function optimizeBotSequence(history) {
    let seq = history.slice().reverse().map(m => ({ ...m, angle: -m.angle }));
    let changed = true;
    while(changed) {
        changed = false;
        for (let i = 0; i < seq.length - 1; i++) {
            const m1 = seq[i], m2 = seq[i+1];
            if (m1.type === 'twist' || m2.type === 'twist') continue;
            
            if (m1.axis === m2.axis && m1.layer !== m2.layer) {
                if (i + 2 < seq.length && seq[i+2].axis === m1.axis && seq[i+2].layer === m1.layer) {
                    seq[i+1] = seq[i+2]; seq[i+2] = m2;
                    changed = true; continue;
                }
            }

            if (m1.axis === m2.axis && m1.layer === m2.layer) {
                let newAngle = (m1.angle + m2.angle) % (Math.PI * 2);
                if (newAngle > Math.PI + 0.01) newAngle -= Math.PI * 2;
                if (newAngle < -Math.PI - 0.01) newAngle += Math.PI * 2;

                if (Math.abs(newAngle) < 0.01) {
                    seq.splice(i, 2);
                    changed = true; break;
                } else {
                    seq.splice(i, 2, { axis: m1.axis, layer: m1.layer, angle: newAngle });
                    changed = true; break;
                }
            }
        }
    }
    return seq;
}

document.getElementById('size-selector').addEventListener('change', (e) => {
    const newSize = parseInt(e.target.value, 10);

    if (isAnimating || animationQueue.length > 0) {
        e.target.value = currentSize;
        showStatus("Wait for animation to finish!", "text-red-400");
        return;
    }

    // Prompt the user if they choose the heavy 21x21 option
    if (newSize === 21) {
        const ok = window.confirm("Are you sure? this might lag your device");
        if (!ok) {
            e.target.value = currentSize;
            showStatus("Cancelled 21x21 initialization.", "text-yellow-400");
            setTimeout(() => {
                const panel = document.getElementById('status-panel');
                panel.classList.remove('opacity-100', 'translate-y-0');
                panel.classList.add('opacity-0', 'translate-y-4');
            }, 1200);
            return;
        }
    }

    buildCube(newSize);
    showStatus(`${newSize}x${newSize} Initialized!`, "text-blue-400");
});

function generateScramble(moves = 20) {
    const axes = ['x', 'y', 'z'];
    const angles = [Math.PI / 2, -Math.PI / 2];
    
    let layers = [];
    for(let i = -currentOffset; i <= currentOffset; i++) layers.push(i);
    
    for (let i = 0; i < moves; i++) {
        const axis = axes[Math.floor(Math.random() * axes.length)];
        const layer = layers[Math.floor(Math.random() * layers.length)];
        const angle = angles[Math.floor(Math.random() * angles.length)];
        
        animationQueue.push({ axis, layer, angle, baseDuration: 60 });
        moveHistory.push({ axis, layer, angle, baseDuration: 60 });
    }
}

document.getElementById('btn-scramble').addEventListener('click', () => {
    if (isAnimating || animationQueue.length > 0) return;
    showStatus("Scrambling System...", "text-yellow-400");
    generateScramble(currentSize * 10);
    processQueue();
});

document.getElementById('btn-scramble-twist').addEventListener('click', () => {
    if (isAnimating || animationQueue.length > 0) return;
    showStatus("Injecting Parity Error...", "text-purple-400");
    generateScramble(currentSize * 8);
    
    const corners = cubes.filter(c => Math.abs(c.position.x) > currentOffset - 0.1 && Math.abs(c.position.y) > currentOffset - 0.1 && Math.abs(c.position.z) > currentOffset - 0.1);
    const cornerToTwist = corners[Math.floor(Math.random() * corners.length)];
    const twistAngle = (Math.PI * 2) / 3;
    
    animationQueue.push({ type: 'twist', cubeUUID: cornerToTwist.uuid, angle: twistAngle, baseDuration: 300 });
    moveHistory.push({ type: 'twist', cubeUUID: cornerToTwist.uuid, angle: twistAngle, baseDuration: 300 });
    
    processQueue();
});

document.getElementById('btn-solve').addEventListener('click', () => {
    if (isAnimating || animationQueue.length > 0) return;
    if (moveHistory.length === 0) {
        showStatus("Cube is already solved.", "text-green-400");
        setTimeout(() => document.getElementById('status-panel').classList.remove('opacity-100', '-translate-y-0'), 2000);
        return;
    }

    showStatus("Bot Analyzing History...", "text-blue-400");
    
    setTimeout(() => {
        const originalLength = moveHistory.length;
        const optimizedMoves = optimizeBotSequence(moveHistory);
        const reduction = originalLength - optimizedMoves.length;

        showStatus(`Path Optimized: Removed ${reduction} redundant moves. Executing...`, "text-cyan-400");
        
        // Store baseDuration so execution uses the live botSpeed when each move runs
        optimizedMoves.forEach(m => {
            const base = Math.max(50, 180 - currentSize * 5);
            animationQueue.push({ ...m, baseDuration: base });
        });
        
        moveHistory = [];
        processQueue();
    }, 800);
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Hook up bot-speed UI
const botSpeedEl = document.getElementById('bot-speed');
const botSpeedValEl = document.getElementById('bot-speed-value');
if (botSpeedEl && botSpeedValEl) {
    botSpeedEl.addEventListener('input', (e) => {
        botSpeed = parseFloat(e.target.value) || 1;
        botSpeedValEl.innerText = botSpeed.toFixed(2) + 'x';
        showStatus(`Bot speed: ${botSpeed.toFixed(2)}x`, "text-blue-300");
        setTimeout(() => {
            const panel = document.getElementById('status-panel');
            panel.classList.remove('opacity-100', 'translate-y-0');
            panel.classList.add('opacity-0', 'translate-y-4');
        }, 900);
    });
}

function animateLoop() {
    requestAnimationFrame(animateLoop);
    orbitControls.update();
    renderer.render(scene, camera);
}

buildCube(3);
animateLoop();