/** Bot solvers: BFS, least-click, click-max */

import {
  TILE_SIZE, GAME_HEIGHT, SPEED, PHYSICS_HZ, LEGACY_PHYSICS_HZ,
} from './config.js';
import { S, els } from './state.js';
import { checkCollisions } from './collisions.js';

function withinVerticalBounds(y, size) {
  return y > 0 && y + size < GAME_HEIGHT;
}

// Provided by main.js after init — avoids circular import
let updateFrameCounterFn = () => {};
export function setUpdateFrameCounter(fn) {
  updateFrameCounterFn = fn;
}

function runBotSolver() {
    // Deterministic BFS solver using current UI S.player size with adaptive vertical exploration.
    S.playbackActions = [];
    if (S.level.length === 0) {
        els.botStatus.style.display = 'block';
        els.botStatus.textContent = 'Bot: Empty level';
        els.botStatus.style.borderLeftColor = '#ff4d4d';
        return;
    }

    els.botStatus.style.display = 'block';
    els.botStatus.textContent = 'Bot: Scanning...';
    els.botStatus.style.borderLeftColor = '#ffcc00';

    // Determine target X based on S.level extents
    let maxBlockX = 0;
    for (let b of S.level) maxBlockX = Math.max(maxBlockX, b.x);
    const targetX = (maxBlockX + 2) * TILE_SIZE;

    // Use UI wave size for simulation and make S.player match for visuals
    const simPlayerSize = parseFloat(els.waveSizeInput ? els.waveSizeInput.value : S.player.size) || S.player.size;
    S.player.size = simPlayerSize;

    // Heuristic scan: find vertical corridors that are least obstructed between start and target
    // We'll sample candidate center Ys and score how often a S.player placed at that Y would collide
    const scanSamplesX = Math.max(8, Math.floor((targetX - 100) / (TILE_SIZE * 2))); // how many columns to sample
    const sampleXs = [];
    for (let i = 0; i < scanSamplesX; i++) sampleXs.push(100 + Math.floor((i / Math.max(1, scanSamplesX - 1)) * (targetX - 100)));

    const candidateCenters = [];
    const stepY = 8;
    for (let cy = stepY; cy < GAME_HEIGHT - stepY - simPlayerSize; cy += stepY) candidateCenters.push(cy);

    let bestCenter = Math.floor(GAME_HEIGHT / 2);
    let bestScore = Infinity;

    for (let cy of candidateCenters) {
        let score = 0;
        // sample across x positions, for each sample compute if a small vertical sweep around cy is clear
        for (let sx of sampleXs) {
            // simulate a small vertical neighborhood to prefer wider corridors
            let colBlocked = 0;
            const checkY = Math.round(cy);
            if (!withinVerticalBounds(checkY, simPlayerSize)) { colBlocked += 3; }
            else if (checkCollisions(sx, checkY, simPlayerSize, 0)) colBlocked += 1;
            // also check a few nearby offsets to favor roomy spaces
            if (!withinVerticalBounds(checkY - 12, simPlayerSize) || checkCollisions(sx, checkY - 12, simPlayerSize, 0)) colBlocked += 1;
            if (!withinVerticalBounds(checkY + 12, simPlayerSize) || checkCollisions(sx, checkY + 12, simPlayerSize, 0)) colBlocked += 1;
            score += colBlocked;
        }
        // normalize by number of samples
        score = score / sampleXs.length;
        // small preference for centers near screen midpoint to avoid extreme top/bottom when scores tie
        score += Math.abs(cy - GAME_HEIGHT / 2) / (GAME_HEIGHT * 2);
        if (score < bestScore) {
            bestScore = score;
            bestCenter = cy;
        }
    }

    // If bestScore is very high, fallback to center
    if (!isFinite(bestScore) || bestScore > 0.9) bestCenter = Math.floor(GAME_HEIGHT / 2);

    els.botStatus.textContent = `Bot: Targeting Y≈${Math.round(bestCenter)} (scan score ${bestScore.toFixed(2)})`;
    els.botStatus.style.borderLeftColor = '#ffcc00';

    // BFS state: {x, y, hold, actions}
    const startX = 100;
    const startY = Math.floor(GAME_HEIGHT / 2);
    const maxSteps = Math.ceil((targetX - startX) / SPEED) + Math.ceil(300 * PHYSICS_HZ / LEGACY_PHYSICS_HZ); // safety margin

    // visited set to avoid re-exploring similar states: key = xIdx|y|hold (coarse)
    const visited = new Set();
    const queue = [];
    queue.push({ x: startX, y: startY, hold: false, actions: [] });
    visited.add(`${Math.round(startX * PHYSICS_HZ / LEGACY_PHYSICS_HZ)}|${Math.round(startY)}|0`);

    const withinBounds = (x, y) => {
        if (y <= 0 || y + simPlayerSize >= GAME_HEIGHT) return false;
        return true;
    };
    function withinVerticalBounds(y, size) {
        return !(y <= 0 || y + size >= GAME_HEIGHT);
    }

    // simulate one frame move given state and nextHold boolean
    const simulateStep = (x, y, nextHold) => {
        const nx = x + SPEED;
        const ny = y + (nextHold ? -SPEED : SPEED);
        return { nx, ny };
    };

    let found = null;
    const startTime = performance.now();
    const TIME_LIMIT = 1500; // ms to allow for search

    // center bias: push states closer to bestCenter forward in queue
    const centerBiasThreshold = Math.max(48, Math.abs(bestCenter - GAME_HEIGHT / 2) * 0.6 + 60);

    while (queue.length) {
        const state = queue.shift();

        // time cutoff
        if (performance.now() - startTime > TIME_LIMIT) break;

        // If we've progressed far enough, accept actions
        if (state.x >= targetX) {
            found = state.actions.slice();
            break;
        }

        if (state.actions.length > maxSteps) continue;

        // Try both hold states for next frame, prefer not-holding first to avoid constant upward bias
        for (let nextHold of [false, true]) {
            const { nx, ny } = simulateStep(state.x, state.y, nextHold);

            // coarse round for visited key
            const keyX = Math.round(nx * PHYSICS_HZ / LEGACY_PHYSICS_HZ);
            const keyY = Math.round(ny / 2) * 2; // coarser Y bins
            const key = `${keyX}|${keyY}|${nextHold ? 1 : 0}`;
            if (visited.has(key)) continue;

            // quick bounds check
            if (!withinBounds(nx, ny)) continue;

            // Check collisions using same checker (buffer 0)
            if (checkCollisions(nx, ny, simPlayerSize, 0)) continue;

            visited.add(key);
            const newActions = state.actions.concat([nextHold]);

            // Bias: prefer states nearer the chosen center so bot explores the chosen corridor
            const distanceFromPreferred = Math.abs(ny - bestCenter);
            if (distanceFromPreferred <= centerBiasThreshold) {
                // push to front to explore corridor-area states earlier
                queue.unshift({ x: nx, y: ny, hold: nextHold, actions: newActions });
            } else {
                queue.push({ x: nx, y: ny, hold: nextHold, actions: newActions });
            }

            // small optimization: if nx passed targetX accept immediately
            if (nx >= targetX) {
                found = newActions.slice();
                queue.length = 0;
                break;
            }
        }
    }

    if (found && found.length > 0) {
        S.playbackActions = found;
        els.botStatus.textContent = `Bot: Found Path (${S.playbackActions.length} frames)`;
        els.botStatus.style.borderLeftColor = '#28a745';
    } else {
        els.botStatus.textContent = 'Bot: No path found';
        els.botStatus.style.borderLeftColor = '#ff4d4d';
        S.player.active = false;
    }
}

function triggerRewind() {
    // Smaller rewind on TAS death so you don't jump back too far
    const rewindAmount = Math.ceil(PHYSICS_HZ * 0.125); // Rewind about 0.125 seconds
    const actualRewind = Math.min(S.frameCount, rewindAmount);
    els.rewindFlash.style.display = 'block';
    setTimeout(() => els.rewindFlash.style.display = 'none', 100);
    S.frameCount -= actualRewind;
    S.recordedActions.splice(S.frameCount);
    S.player.x = 100 + (S.frameCount * SPEED);
    let tempY = GAME_HEIGHT / 2;
    for (let i = 0; i < S.frameCount; i++) tempY += S.recordedActions[i] ? -SPEED : SPEED;
    S.player.y = tempY;
    S.cameraX = S.player.x - 100;
    S.trail = S.trail.slice(0, Math.max(0, S.trail.length - actualRewind));
    S.player.dead = false;
    S.player.active = true;
    S.tasInputBuffer = false;
    updateFrameCounterFn();
}

// Logic tick: One discrete physics frame
async function runLeastClicksSolver() {
    const planningMode = S.mode;
    const searchId = ++S.leastClickSearchId;
    S.player.active = false;
    S.playbackActions = [];
    if (S.level.length === 0) {
        els.botStatus.textContent = 'Least-click Bot: Empty level';
        els.botStatus.style.borderLeftColor = '#ff4d4d';
        return;
    }

    const simPlayerSize = parseFloat(els.waveSizeInput ? els.waveSizeInput.value : S.player.size) || S.player.size;
    S.player.size = simPlayerSize;
    let maxBlockX = 0;
    for (const block of S.level) maxBlockX = Math.max(maxBlockX, block.x);
    const targetX = Math.max((maxBlockX + 2) * TILE_SIZE, S.player.x + SPEED);
    const maxFrames = Math.ceil((targetX - S.player.x) / SPEED);
    const yScale = 1000;
    const yStep = Math.round(SPEED * yScale);
    let x = S.player.x;
    let layer = {
        yUnits: new Int32Array([Math.round(S.player.y * yScale)]),
        holds: new Uint8Array([Number(S.player.isHolding)]),
        clicks: new Uint32Array([0]),
        parents: new Uint16Array([0])
    };
    const layers = [layer];
    let goalIndex = -1;

    for (let frame = 1; frame <= maxFrames; frame++) {
        x += SPEED;
        const yUnitValues = [];
        const holdValues = [];
        const clickValues = [];
        const parentValues = [];
        const stateIndices = new Map();

        for (let i = 0; i < layer.yUnits.length; i++) {
            const previousHold = layer.holds[i];
            for (let choice = 0; choice < 2; choice++) {
                const hold = choice === 0 ? previousHold : 1 - previousHold;
                const yUnits = layer.yUnits[i] + (hold ? -yStep : yStep);
                if (checkCollisions(x, yUnits / yScale, simPlayerSize, 0)) continue;

                const key = yUnits * 2 + hold;
                const clicks = layer.clicks[i] + (!previousHold && hold ? 1 : 0);
                const existing = stateIndices.get(key);
                if (existing === undefined) {
                    stateIndices.set(key, yUnitValues.length);
                    yUnitValues.push(yUnits);
                    holdValues.push(hold);
                    clickValues.push(clicks);
                    parentValues.push(i);
                } else if (clicks < clickValues[existing]) {
                    clickValues[existing] = clicks;
                    parentValues[existing] = i;
                }
            }
        }

        if (yUnitValues.length === 0) break;
        layer = {
            yUnits: new Int32Array(yUnitValues),
            holds: new Uint8Array(holdValues),
            clicks: new Uint32Array(clickValues),
            parents: new Uint16Array(parentValues)
        };
        layers.push(layer);

        if (x >= targetX) {
            for (let i = 0; i < layer.clicks.length; i++) {
                if (goalIndex < 0 || layer.clicks[i] < layer.clicks[goalIndex]) goalIndex = i;
            }
            break;
        }

        if (frame % 16 === 0) {
            if (S.mode !== planningMode || searchId !== S.leastClickSearchId) return;
            els.botStatus.textContent = `Least-click Bot: Searching ${Math.floor(frame / maxFrames * 100)}%`;
            await new Promise(resolve => requestAnimationFrame(resolve));
        }
    }

    if (S.mode !== planningMode || searchId !== S.leastClickSearchId) return;
    if (goalIndex < 0) {
        S.player.active = false;
        els.botStatus.textContent = 'Least-click Bot: No safe route found';
        els.botStatus.style.borderLeftColor = '#ff4d4d';
        return;
    }

    const actions = new Array(layers.length - 1);
    let stateIndex = goalIndex;
    for (let depth = layers.length - 1; depth > 0; depth--) {
        const current = layers[depth];
        actions[depth - 1] = Boolean(current.holds[stateIndex]);
        stateIndex = current.parents[stateIndex];
    }

    S.playbackActions = actions;
    S.player.active = true;
    els.botStatus.textContent = `Least-click Bot: ${layer.clicks[goalIndex]} clicks to finish`;
    els.botStatus.style.borderLeftColor = '#76e4ee';
}

function planClickMaxActions() {
    const horizon = Math.ceil(TILE_SIZE * 2 / SPEED);
    const commitFrames = Math.ceil(20 / SPEED);
    const beamLimit = 360;
    const score = (state) => {
        const margin = Math.min(state.y, GAME_HEIGHT - S.player.size - state.y);
        return state.clicks * 1000 + margin + (state.firstSwitch ? 0.25 : 0);
    };

    let beam = [{
        x: S.player.x, y: S.player.y, hold: S.player.isHolding, clicks: 0,
        firstSwitch: false, parent: null, action: null
    }];
    let deepest = beam;

    for (let depth = 0; depth < horizon; depth++) {
        const nextStates = new Map();
        for (const state of beam) {
            for (const hold of [!state.hold, state.hold]) {
                const x = state.x + SPEED;
                const y = state.y + (hold ? -SPEED : SPEED);
                if (checkCollisions(x, y, S.player.size, 0)) continue;

                const clicked = !state.hold && hold;
                const next = {
                    x, y, hold,
                    clicks: state.clicks + (clicked ? 1 : 0),
                    firstSwitch: state.parent ? state.firstSwitch : clicked,
                    parent: state,
                    action: hold
                };
                const key = `${Math.round(y * 1000)}|${hold ? 1 : 0}`;
                const previous = nextStates.get(key);
                if (!previous || score(next) > score(previous)) nextStates.set(key, next);
            }
        }

        beam = Array.from(nextStates.values());
        if (!beam.length) break;
        if (beam.length > beamLimit) {
            beam.sort((a, b) => score(b) - score(a));
            beam.length = beamLimit;
        }
        deepest = beam;
    }

    let best = deepest.reduce((chosen, state) => score(state) > score(chosen) ? state : chosen);
    const actions = [];
    while (best && best.parent) {
        actions.unshift(best.action);
        best = best.parent;
    }

    if (!actions.length) {
        const reverse = !S.player.isHolding;
        const nextY = S.player.y + (reverse ? -SPEED : SPEED);
        actions.push(checkCollisions(S.player.x + SPEED, nextY, S.player.size, 0) ? S.player.isHolding : reverse);
    }
    return actions.slice(0, commitFrames);
}


export { runBotSolver, runLeastClicksSolver, planClickMaxActions, triggerRewind };
