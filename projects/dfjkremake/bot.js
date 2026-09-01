/* Simple bot controller */
import { processHit } from './game.js';

let botInterval = null;

export function startBot(getProcessor) {
  // getProcessor may be a function or callback; we will use processHit from game module directly
  const settingsKeys = document.getElementById('setting-botNPS') ? parseInt(document.getElementById('setting-botNPS').value) || 10 : 10;
  const intervalMs = 1000 / Math.max(1, settingsKeys);
  botInterval = setInterval(()=>{
    // attempt to read current required lanes from DOM-managed state: rely on game.processHit closure via import
    // find current required notes by scanning .note elements at current row (best-effort)
    const toHitEls = document.querySelectorAll('.note:not(.cleared)');
    // pick earliest row (smallest index in id)
    const lanesByRow = {};
    toHitEls.forEach(el=>{
      const id = el.id; // note-<row>-<lane>
      const parts = id.split('-');
      if (parts.length === 3) {
        const row = parseInt(parts[1],10);
        const lane = parseInt(parts[2],10);
        lanesByRow[row] = lanesByRow[row] || [];
        lanesByRow[row].push(lane);
      }
    });
    const rows = Object.keys(lanesByRow).map(n=>parseInt(n,10)).sort((a,b)=>a-b);
    if (rows.length === 0) return;
    const row = rows[0];
    const lanes = lanesByRow[row];
    lanes.forEach(l => {
      // call game's processHit
      processHit(l);
    });
  }, intervalMs);
}

export function stopBot() {
  if (botInterval) { clearInterval(botInterval); botInterval = null; }
}