import { area_tile_w, area_tile_h, max_snake, D_UP, D_DOWN, D_LEFT, D_RIGHT } from './constants.js';
import { pos_equal } from './utils.js';

let phys_timer = null;
let dir = 0;
let started = false;
let paused = false;
let pos = [{ x: Math.round(area_tile_w / 2), y: Math.round(area_tile_h / 2) }];
let food = null;
let ctrl_stack = [];
let forgive = false;
let score = 0;

let onScore = null;
let onGameOver = null;

export function initEngine(opts = {}) {
    onScore = opts.onScore || null;
    onGameOver = opts.onGameOver || null;
}

export function getState() {
    return { pos, food, score };
}

export function setDirStack(stack) {
    ctrl_stack = stack;
}

export function place_food() {
    let collision;
    do {
        food = {
            x: Math.floor(Math.random() * area_tile_w),
            y: Math.floor(Math.random() * area_tile_h)
        };
        collision = false;
        for (let a = 0; a < pos.length; a++) {
            if (pos_equal(pos[a], food)) {
                collision = true;
                break;
            }
        }
    } while (collision);
}

function dir_is_opposing(e, a) {
    return e == D_DOWN && a == D_UP || a == D_DOWN && e == D_UP || e == D_LEFT && a == D_RIGHT || a == D_LEFT && e == D_RIGHT;
}

export function physics_loop() {
    let e = Object.assign({}, pos[pos.length - 1]);
    while (ctrl_stack.length > 0) {
        const a = ctrl_stack[0];
        ctrl_stack.shift();
        if (!dir_is_opposing(dir, a)) {
            dir = a;
            break;
        }
    }
    switch (dir) {
        case D_UP: e.y--; break;
        case D_DOWN: e.y++; break;
        case D_LEFT: e.x--; break;
        case D_RIGHT: e.x++; break;
    }
    if (e.x < 0) e.x = area_tile_w - 1;
    else if (e.x >= area_tile_w) e.x = 0;
    if (e.y < 0) e.y = area_tile_h - 1;
    else if (e.y >= area_tile_h) e.y = 0;

    let collision = false;
    const ate = pos_equal(e, food);

    if (!ate) {
        for (let i = 1; i < pos.length; i++) {
            if (pos_equal(pos[i], e)) {
                collision = true;
                break;
            }
        }
        if (collision) {
            if (forgive) {
                end_game("Game over!");
                return;
            } else {
                forgive = true;
            }
        }
    }

    if (!collision) {
        if (!ate) pos.shift();
        pos.push(e);
        if (ate) {
            score++;
            if (onScore) onScore(score);
            if (pos.length == max_snake) {
                food = null;
                end_game("YOU'RE WINNER !");
            } else {
                place_food();
            }
            forgive = false;
        }
    }
}

export function start_game() {
    if (phys_timer) clearInterval(phys_timer);
    phys_timer = setInterval(physics_loop, 150);
}

export function stop_game() {
    if (phys_timer) {
        clearInterval(phys_timer);
        phys_timer = null;
    }
}

export function end_game(msg) {
    stop_game();
    if (onGameOver) onGameOver(msg);
}

export function reset() {
    stop_game();
    dir = 0;
    started = false;
    paused = false;
    pos = [{ x: Math.round(area_tile_w / 2), y: Math.round(area_tile_h / 2) }];
    food = null;
    ctrl_stack = [];
    forgive = false;
    score = 0;
    if (onScore) onScore(score);
    place_food();
}

export function setStarted(v) { started = v; }
export function isStarted() { return started; }
export function setPaused(v) { paused = v; }
export function isPaused() { return paused; }