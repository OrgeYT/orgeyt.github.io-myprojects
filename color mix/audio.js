/* audio.js — encapsulated sfx handling */

let audioCtx;

export function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

export const sfx = {
    init: initAudio,
    playTone: (freq, type, duration, vol = 0.1) => {
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(vol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    },
    click: () => sfx.playTone(600, 'sine', 0.1, 0.05),
    mix: () => {
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    },
    correct: () => {
        sfx.playTone(523.25, 'sine', 0.1, 0.05);
        setTimeout(() => sfx.playTone(659.25, 'sine', 0.1, 0.05), 100);
        setTimeout(() => sfx.playTone(783.99, 'sine', 0.2, 0.05), 200);
    },
    wrong: () => {
        sfx.playTone(150, 'sawtooth', 0.2, 0.05);
        setTimeout(() => sfx.playTone(100, 'sawtooth', 0.3, 0.05), 150);
    },
    gameover: () => {
        sfx.playTone(300, 'square', 0.2, 0.05);
        setTimeout(() => sfx.playTone(250, 'square', 0.2, 0.05), 250);
        setTimeout(() => sfx.playTone(200, 'square', 0.4, 0.05), 500);
    }
};