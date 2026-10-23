/** Bot solvers: BFS, least-click, click-max */

import {
  TILE_SIZE, GAME_HEIGHT, SPEED, PHYSICS_HZ, LEGACY_PHYSICS_HZ,
  STEEP_SIZE_MULT, STEEP_VY_FACTOR,
} from './config.js';
import { S, els } from './state.js';
import { checkCollisions } from './collisions.js';

function withinVerticalBounds(y, size) {
  return y > 0 && y + size < GAME_HEIGHT;
}

function botSpeedX() { return SPEED; }
function botSpeedY() { return S.steepMode ? SPEED * STEEP_VY_FACTOR : SPEED; }
function botSize(base) {
  const b = base ?? S.player.size;
  return S.steepMode ? b * STEEP_SIZE_MULT : b;
}

// Provided by main.js after init — avoids circular import
let updateFrameCounterFn = () => {};
export function setUpdateFrameCounter(fn) {
  updateFrameCounterFn = fn;
}

function runBotSolver() {
    // Deterministic BFS solver using current UI S.player size with adaptive vertical exploration.
    S.playbackActions = [];
    if (S.spawnY != null && Number.isFinite(S.spawnY)) {
        const sz = parseFloat(els.waveSizeInput ? els.waveSizeInput.value : S.player.size) || S.player.size;
        S.player.y = Math.max(2, Math.min(GAME_HEIGHT - sz - 2, S.spawnY));
    }
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
    const baseSize = parseFloat(els.waveSizeInput ? els.waveSizeInput.value : S.player.size) || S.player.size;
    const simPlayerSize = botSize(baseSize);
    S.player.size = simPlayerSize;
    const sx = botSpeedX();
    const sy = botSpeedY();

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
        for (let sampleX of sampleXs) {
            // simulate a small vertical neighborhood to prefer wider corridors
            let colBlocked = 0;
            const checkY = Math.round(cy);
            if (!withinVerticalBounds(checkY, simPlayerSize)) { colBlocked += 3; }
            else if (checkCollisions(sampleX, checkY, simPlayerSize, 0)) colBlocked += 1;
            // also check a few nearby offsets to favor roomy spaces
            if (!withinVerticalBounds(checkY - 12, simPlayerSize) || checkCollisions(sampleX, checkY - 12, simPlayerSize, 0)) colBlocked += 1;
            if (!withinVerticalBounds(checkY + 12, simPlayerSize) || checkCollisions(sampleX, checkY + 12, simPlayerSize, 0)) colBlocked += 1;
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
    const startY = (S.spawnY != null && Number.isFinite(S.spawnY))
      ? Math.max(2, Math.min(GAME_HEIGHT - simPlayerSize - 2, S.spawnY))
      : Math.floor(GAME_HEIGHT / 2);
    const maxSteps = Math.ceil((targetX - startX) / sx) + Math.ceil(300 * PHYSICS_HZ / LEGACY_PHYSICS_HZ); // safety margin

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
        const nx = x + sx;
        const ny = y + (nextHold ? -sy : sy);
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
    const rsx = botSpeedX();
    const rsy = botSpeedY();
    S.player.x = 100 + (S.frameCount * rsx);
    let tempY = (S.spawnY != null && Number.isFinite(S.spawnY)) ? S.spawnY : GAME_HEIGHT / 2;
    for (let i = 0; i < S.frameCount; i++) tempY += S.recordedActions[i] ? -rsy : rsy;
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
        els.botStatus.style.display = 'block';
        els.botStatus.textContent = 'Least-click Bot: Empty level';
        els.botStatus.style.borderLeftColor = '#ff4d4d';
        return;
    }

    const baseSize = parseFloat(els.waveSizeInput ? els.waveSizeInput.value : S.player.size) || S.player.size;
    const simPlayerSize = botSize(baseSize);
    S.player.size = simPlayerSize;

    const sx = botSpeedX();
    const sy = botSpeedY();

    // Always use the real spawn X — do not skip the entrance
    const startX = 100;

    let maxBlockX = 0;
    let minTileY = Infinity;
    let maxTileY = -Infinity;
    for (const block of S.level) {
        maxBlockX = Math.max(maxBlockX, block.x);
        minTileY = Math.min(minTileY, block.y);
        maxTileY = Math.max(maxTileY, block.y);
    }
    // Keep the wave inside the level's vertical band so it can't skip the
    // entrance by flying over / under the entire structure in open air.
    const marginTiles = 2;
    const minY = Math.max(2, (minTileY - marginTiles) * TILE_SIZE);
    const maxY = Math.min(GAME_HEIGHT - simPlayerSize - 2, (maxTileY + 1 + marginTiles) * TILE_SIZE);

    const targetX = Math.max((maxBlockX + 2) * TILE_SIZE, startX + sx * 20);
    const maxFrames = Math.ceil((targetX - startX) / sx) + 4;

    // Exact discrete steps matching physics
    const yScale = 1000;
    const yStep = Math.round(sy * yScale);

    function collides(x, y) {
        if (y <= 0 || y + simPlayerSize >= GAME_HEIGHT) return true;
        // Soft band: allow a little slack but prevent full open-air skips
        if (y < minY || y + simPlayerSize > maxY) return true;
        return checkCollisions(x, y, simPlayerSize, 0);
    }

    // Seed only Y positions that are free at the real spawn
    const seedYs = [];
    if (S.spawnY != null && Number.isFinite(S.spawnY)) {
        // Level-defined spawn: bots must start exactly here (with tiny float-safe clamp)
        const y = Math.max(2, Math.min(GAME_HEIGHT - simPlayerSize - 2, S.spawnY));
        if (!collides(startX, y)) {
            seedYs.push(y);
        } else {
            // If exact spawn overlaps a block, still force it — human would start there too
            seedYs.push(y);
        }
    } else {
        const mid = Math.max(minY, Math.min(maxY - simPlayerSize, (minY + maxY - simPlayerSize) / 2));
        for (let dy = 0; dy <= 240; dy += 6) {
            for (const sign of (dy === 0 ? [0] : [-1, 1])) {
                const y = mid + sign * dy;
                if (y < minY || y + simPlayerSize > maxY) continue;
                if (!collides(startX, y)) seedYs.push(y);
            }
        }
    }
    if (seedYs.length === 0) {
        els.botStatus.style.display = 'block';
        els.botStatus.textContent = 'Least-click Bot: No safe starting position';
        els.botStatus.style.borderLeftColor = '#ff4d4d';
        return;
    }

    // Layer storage: each node = { yUnits, hold, clicks, parentIdx }
    // We keep parallel typed arrays per layer for speed.
    let yUnitsArr = [];
    let holdsArr = [];
    let clicksArr = [];
    let parentsArr = [];
    const seen0 = new Map();
    for (const y of seedYs) {
        for (const hold of [0, 1]) {
            const yu = Math.round(y * yScale);
            const key = yu * 2 + hold;
            if (seen0.has(key)) continue;
            seen0.set(key, yUnitsArr.length);
            yUnitsArr.push(yu);
            holdsArr.push(hold);
            clicksArr.push(0);
            parentsArr.push(-1);
        }
    }

    const layers = [{
        yUnits: new Int32Array(yUnitsArr),
        holds: new Uint8Array(holdsArr),
        clicks: new Uint32Array(clicksArr),
        parents: new Int32Array(parentsArr),
    }];

    let goalLayer = -1;
    let goalIndex = -1;
    let x = startX;
    const MAX_STATES = 14000;

    for (let frame = 1; frame <= maxFrames; frame++) {
        x += sx;
        yUnitsArr = [];
        holdsArr = [];
        clicksArr = [];
        parentsArr = [];
        const seen = new Map();
        const prev = layers[frame - 1];

        for (let i = 0; i < prev.yUnits.length; i++) {
            const prevHold = prev.holds[i];
            for (let choice = 0; choice < 2; choice++) {
                const hold = choice === 0 ? prevHold : (1 - prevHold);
                const yu = prev.yUnits[i] + (hold ? -yStep : yStep);
                const y = yu / yScale;
                if (collides(x, y)) continue;

                const key = yu * 2 + hold;
                const clicks = prev.clicks[i] + (!prevHold && hold ? 1 : 0);
                const existing = seen.get(key);
                if (existing === undefined) {
                    seen.set(key, yUnitsArr.length);
                    yUnitsArr.push(yu);
                    holdsArr.push(hold);
                    clicksArr.push(clicks);
                    parentsArr.push(i);
                } else if (clicks < clicksArr[existing]) {
                    clicksArr[existing] = clicks;
                    parentsArr[existing] = i;
                }
            }
        }

        if (yUnitsArr.length === 0) break;

        if (yUnitsArr.length > MAX_STATES) {
            const order = Array.from({ length: yUnitsArr.length }, (_, i) => i);
            order.sort((a, b) => clicksArr[a] - clicksArr[b] || yUnitsArr[a] - yUnitsArr[b]);
            const keep = order.slice(0, MAX_STATES);
            yUnitsArr = keep.map((i) => yUnitsArr[i]);
            holdsArr = keep.map((i) => holdsArr[i]);
            clicksArr = keep.map((i) => clicksArr[i]);
            parentsArr = keep.map((i) => parentsArr[i]);
        }

        layers.push({
            yUnits: new Int32Array(yUnitsArr),
            holds: new Uint8Array(holdsArr),
            clicks: new Uint32Array(clicksArr),
            parents: new Int32Array(parentsArr),
        });

        if (x >= targetX) {
            const layer = layers[layers.length - 1];
            for (let i = 0; i < layer.clicks.length; i++) {
                if (goalIndex < 0 || layer.clicks[i] < layer.clicks[goalIndex]) {
                    goalIndex = i;
                    goalLayer = layers.length - 1;
                }
            }
            break;
        }

        if (frame % 10 === 0) {
            if (S.mode !== planningMode || searchId !== S.leastClickSearchId) return;
            const pct = Math.min(99, Math.floor((frame / maxFrames) * 100));
            els.botStatus.style.display = 'block';
            els.botStatus.textContent = `Least-click Bot: Searching ${pct}%`;
            await new Promise((r) => requestAnimationFrame(r));
        }
    }

    if (S.mode !== planningMode || searchId !== S.leastClickSearchId) return;

    if (goalIndex < 0 || goalLayer < 1) {
        els.botStatus.style.display = 'block';
        els.botStatus.textContent = 'Least-click Bot: No safe route found';
        els.botStatus.style.borderLeftColor = '#ff4d4d';
        return;
    }

    // Reconstruct hold sequence (actions[f] = hold used while moving on frame f+1)
    const actions = new Array(goalLayer);
    let idx = goalIndex;
    for (let depth = goalLayer; depth > 0; depth--) {
        actions[depth - 1] = Boolean(layers[depth].holds[idx]);
        idx = layers[depth].parents[idx];
    }
    // idx is now the seed index in layer 0
    const seedY = layers[0].yUnits[idx] / yScale;
    const seedHold = Boolean(layers[0].holds[idx]);

    // --- Verify the path with the exact same integration as tick() ---
    let vx = startX;
    let vy = seedY;
    let vHold = seedHold;
    let dead = false;
    for (let f = 0; f < actions.length; f++) {
        vHold = actions[f];
        vx += sx;
        vy += vHold ? -sy : sy;
        if (collides(vx, vy)) {
            dead = true;
            break;
        }
    }

    if (dead || vx < targetX - sx * 2) {
        els.botStatus.style.display = 'block';
        els.botStatus.textContent = 'Least-click Bot: No safe route found';
        els.botStatus.style.borderLeftColor = '#ff4d4d';
        return;
    }

    // Apply verified path
    S.player.x = startX;
    S.player.y = seedY;
    S.player.isHolding = seedHold;
    S.player.size = simPlayerSize;
    S.player.dead = false;
    S.cameraX = Math.max(0, startX - 100);
    S.trail = [{ x: startX, y: seedY }];
    S.frameCount = 0;
    S.playbackActions = actions;
    S.player.active = true;

    els.botStatus.style.display = 'block';
    els.botStatus.textContent = `Least-click Bot: ${layers[goalLayer].clicks[goalIndex]} clicks to finish`;
    els.botStatus.style.borderLeftColor = '#76e4ee';
}

function planClickMaxActions() {
    const sx = botSpeedX();
    const sy = botSpeedY();
    const horizon = Math.ceil(TILE_SIZE * 2 / sx);
    const commitFrames = Math.ceil(20 / sx);
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
                const x = state.x + sx;
                const y = state.y + (hold ? -sy : sy);
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
        const nextY = S.player.y + (reverse ? -sy : sy);
        actions.push(checkCollisions(S.player.x + sx, nextY, S.player.size, 0) ? S.player.isHolding : reverse);
    }
    return actions.slice(0, commitFrames);
}


export { runBotSolver, runLeastClicksSolver, planClickMaxActions, triggerRewind };
