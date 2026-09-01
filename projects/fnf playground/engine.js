/* engine.js - game state, entities, loop, rendering */
import { parseXML, CHAR_XML, NOTE_XML } from "./assets.js";

const canvas = document.getElementById('gameCanvas');
export const ctx = canvas.getContext('2d', { alpha: false });

/* --- STATE --- */
export let charImg = null;
export let noteImg = null;
export let charAtlas = {};
export let noteAtlas = {};

let lastTime = 0;
export let notes = [];
export let keysDown = {};
export const RECEPTOR_Y = 100;
export const SCALE_NOTE = 0.65;
export const SCALE_CHAR = 0.8;
export let canvasWidth, canvasHeight;

/* Settings (will be read inside loop from DOM) */
export let modchart = false;
export let botMissing = false;
export let playHitSound = false;
export let scrollSpeed = 10;
export let spamDelay = 50;

/* Trackers */
export let spamTimers = { q: 0, w: 0, i: 0, o: 0, e: 0 };
export let hitTimestamps = [];
export let maxNps = 0;

export const noteColors = ["purple", "blue", "green", "red"];
export const dirNames = ["left", "down", "up", "right"];

/* --- ENTITIES --- */
export class Character {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.anim = "idle pose";
        this.frameIndex = 0;
        this.frameTimer = 0;
        this.fps = 24;
        this.holdTimer = 0;
    }
    playAnim(name, force = false) {
        if (this.anim !== name || force) {
            this.anim = name;
            this.frameIndex = 0;
            this.frameTimer = 0;
        }
        this.holdTimer = 0.4;
    }
    update(dt) {
        this.frameTimer += dt;
        let frameDuration = 1 / this.fps;
        if (this.frameTimer >= frameDuration) {
            this.frameTimer -= frameDuration;
            this.frameIndex++;
            if (!charAtlas[this.anim]) this.frameIndex = 0;
            else if (this.frameIndex >= charAtlas[this.anim].length) {
                if (this.anim === "idle pose") this.frameIndex = 0;
                else this.frameIndex = charAtlas[this.anim].length - 1;
            }
        }
        if (this.anim !== "idle pose") {
            this.holdTimer -= dt;
            if (this.holdTimer <= 0) this.playAnim("idle pose");
        }
    }
    draw(ctx) {
        if (!charAtlas[this.anim]) return;
        let frame = charAtlas[this.anim][this.frameIndex];
        if (!frame) return;
        let destX = this.x - (frame.frameW * SCALE_CHAR) / 2 - (frame.frameX * SCALE_CHAR);
        let destY = this.y - (frame.frameH * SCALE_CHAR) / 2 - (frame.frameY * SCALE_CHAR);
        ctx.drawImage(charImg, frame.x, frame.y, frame.w, frame.h, destX, destY, frame.w * SCALE_CHAR, frame.h * SCALE_CHAR);
    }
}

export class Receptor {
    constructor(dir, index) {
        this.dir = dir;
        this.index = index;
        this.anim = "arrow" + dirNames[dir].toUpperCase();
        this.frameIndex = 0;
        this.frameTimer = 0;
        this.state = "static";
        this.baseX = 0;
        this.baseY = RECEPTOR_Y;
        this.modX = 0;
        this.modY = 0;
        this.fps = 24;
    }
    playAnim(state) {
        this.state = state;
        this.frameIndex = 0;
        this.frameTimer = 0;
        if (state === "static") this.anim = "arrow" + dirNames[this.dir].toUpperCase();
        else if (state === "press") this.anim = dirNames[this.dir] + " press";
        else if (state === "confirm") this.anim = dirNames[this.dir] + " confirm";
    }
    update(dt, time) {
        if (modchart) {
            this.modX = Math.sin(time * 3 + this.index * 0.8) * 40;
            this.modY = Math.cos(time * 2 + this.index * 0.8) * 20;
        } else {
            this.modX = 0;
            this.modY = 0;
        }
        let animData = noteAtlas[this.anim];
        if (animData && animData.length > 1) {
            this.frameTimer += dt;
            if (this.frameTimer >= 1/this.fps) {
                this.frameTimer = 0;
                this.frameIndex++;
                if (this.frameIndex >= animData.length) {
                    if (this.state === "confirm") this.playAnim("static");
                    else this.frameIndex = animData.length - 1;
                }
            }
        }
    }
    draw(ctx) {
        let animData = noteAtlas[this.anim];
        if (!animData) return;
        let frame = animData[this.frameIndex] || animData[0];
        let targetX = this.baseX + this.modX;
        let targetY = this.baseY + this.modY;
        let destX = targetX - (frame.w * SCALE_NOTE) / 2;
        let destY = targetY - (frame.h * SCALE_NOTE) / 2;
        ctx.drawImage(noteImg, frame.x, frame.y, frame.w, frame.h, destX, destY, frame.w * SCALE_NOTE, frame.h * SCALE_NOTE);
    }
}

export class Note {
    constructor(dir, isDanger) {
        this.dir = dir;
        this.isDanger = isDanger;
        this.anim = noteColors[dir];
        this.y = canvasHeight + 100;
        this.active = true;
    }
    update(dt) {
        this.y -= (scrollSpeed * 120) * dt;
    }
    draw(ctx, receptors) {
        let animData = noteAtlas[this.anim];
        if (!animData) return;
        let frame = animData[0];
        let targetX = receptors[this.dir].baseX + receptors[this.dir].modX;
        let modY = receptors[this.dir].modY;
        let destX = targetX - (frame.w * SCALE_NOTE) / 2;
        let destY = this.y + modY - (frame.h * SCALE_NOTE) / 2;
        ctx.save();
        if (this.isDanger) ctx.filter = "invert(0.8) hue-rotate(180deg) saturate(3)";
        ctx.drawImage(noteImg, frame.x, frame.y, frame.w, frame.h, destX, destY, frame.w * SCALE_NOTE, frame.h * SCALE_NOTE);
        ctx.restore();
    }
}

/* bootstrap-managed globals exported for UI or input modules */
export let player;
export let receptors = [];

/* --- LAYOUT / RESIZE / LOOP --- */
export function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvasWidth = canvas.width;
    canvasHeight = canvas.height;
    if (player) { player.x = canvasWidth / 2; player.y = canvasHeight - 250; }
    const spacing = 120;
    const startX = canvasWidth / 2 - (spacing * 1.5);
    receptors.forEach((r, i) => r.baseX = startX + (i * spacing));
}

export function initGame(_charImg, _noteImg) {
    charImg = _charImg;
    noteImg = _noteImg;
    charAtlas = parseXML(CHAR_XML);
    noteAtlas = parseXML(NOTE_XML);
    player = new Character();
    receptors = [];
    for (let i = 0; i < 4; i++) receptors.push(new Receptor(i, i));
    resize();
    window.addEventListener('resize', resize);
    requestAnimationFrame(gameLoop);
}

function handleSpam(dt) {
    let interval = spamDelay / 1000;
    if (interval < 0.001) interval = 0.001;
    let spammers = [{ key: 'q', dir: 0 }, { key: 'w', dir: 1 }, { key: 'i', dir: 2 }, { key: 'o', dir: 3 }];
    spammers.forEach(sp => {
        if (keysDown[sp.key]) {
            spamTimers[sp.key] += dt;
            if (spamTimers[sp.key] >= interval) {
                let counts = Math.floor(spamTimers[sp.key] / interval);
                spamTimers[sp.key] -= counts * interval;
                if (counts > 50) counts = 50;
                for (let j = 0; j < counts; j++) {
                    let yOffset = j * interval * (scrollSpeed * 120);
                    spawnNote(sp.dir, false, yOffset);
                }
            }
        } else {
            spamTimers[sp.key] = interval;
        }
    });
    if (keysDown['e']) {
        spamTimers['e'] += dt;
        if (spamTimers['e'] >= interval) {
            let counts = Math.floor(spamTimers['e'] / interval);
            spamTimers['e'] -= counts * interval;
            if (counts > 50) counts = 50;
            for (let j = 0; j < counts; j++) {
                let yOffset = j * interval * (scrollSpeed * 120);
                spawnNote(0, false, yOffset); spawnNote(1, false, yOffset);
                spawnNote(2, false, yOffset); spawnNote(3, false, yOffset);
            }
        }
    } else {
        spamTimers['e'] = interval;
    }
}

export function spawnNote(dir, isDanger, yOffset = 0) {
    let newNote = new Note(dir, isDanger);
    newNote.y += yOffset;
    notes.push(newNote);
}

function gameLoop(timestamp) {
    let dt = (timestamp - lastTime) / 1000;
    if (dt > 0.1) dt = 0.1;
    lastTime = timestamp;
    let totalTime = timestamp / 1000;

    /* read settings from DOM (bootstrap keeps UI updated) */
    modchart = document.getElementById('setting-modchart').checked;
    botMissing = document.getElementById('setting-botmiss').checked;
    playHitSound = document.getElementById('setting-hitsound').checked;
    scrollSpeed = parseFloat(document.getElementById('setting-speed').value);
    spamDelay = parseFloat(document.getElementById('setting-spam').value);

    document.getElementById('val-speed').innerText = scrollSpeed.toFixed(1);
    document.getElementById('val-spam').innerText = spamDelay.toFixed(1);

    handleSpam(dt);

    player.update(dt);
    receptors.forEach(r => r.update(dt, totalTime));

    let hitRadius = 30;

    for (let i = notes.length - 1; i >= 0; i--) {
        let note = notes[i];
        note.update(dt);
        // Allow the bot to register hits even if the note has passed the receptor
        if (note.y <= RECEPTOR_Y + hitRadius) {
            if (note.isDanger) {
                // ignore danger notes
            } else if (!botMissing) {
                receptors[note.dir].playAnim("confirm");
                player.playAnim(dirNames[note.dir] + " pose", true);
                if (playHitSound) {
                    import("./assets.js").then(mod => {
                        let s = mod.hitAudio.cloneNode();
                        s.volume = 0.4;
                        s.play().catch(() => {});
                    });
                }
                hitTimestamps.push(totalTime);
                notes.splice(i, 1);
                continue;
            }
        }
        if (note.y < -200) notes.splice(i, 1);
    }

    document.getElementById('note-count').innerText = notes.length;

    while (hitTimestamps.length > 0 && hitTimestamps[0] < totalTime - 1) hitTimestamps.shift();
    let currentNps = hitTimestamps.length;
    if (currentNps > maxNps) maxNps = currentNps;
    document.getElementById('val-nps').innerText = currentNps;
    document.getElementById('val-maxnps').innerText = maxNps;

    /* RENDER */
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < canvasWidth; i += 50) { ctx.moveTo(i, 0); ctx.lineTo(i, canvasHeight); }
    for (let j = 0; j < canvasHeight; j += 50) { ctx.moveTo(0, j); ctx.lineTo(canvasWidth, j); }
    ctx.stroke();

    player.draw(ctx);
    receptors.forEach(r => r.draw(ctx));
    notes.forEach(note => note.draw(ctx, receptors));

    requestAnimationFrame(gameLoop);
}