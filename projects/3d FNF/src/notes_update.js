/* src/notes_update.js
   Note update loop and hold-piece processing (player + opponent logic).
   Imports are intentionally local to avoid cyclic deps; this module expects
   removeNote and removePieceFromGroup behavior implemented similarly to notes_core.
*/
import { removeNote, removePieceFromGroup, UI_showJudgment, UI_updateHUD, UI_resetCombo } from './notes_core.js';

export function updateNotes(state, config, delta) {
  if (!state) return;
  if (!state._three) return;
  if (!Array.isArray(state.notes) || state.notes.length === 0) return;

  for (let i = state.notes.length - 1; i >= 0; i--) {
    try {
      const noteObj = state.notes[i];
      if (!noteObj || !noteObj.data || !noteObj.mesh) {
        state.notes.splice(i, 1);
        continue;
      }
      const timeDiff = (noteObj.data.time || 0) - (state.time || 0);
      const yDist = timeDiff * (config.scrollSpeed || 0);

      try {
        if (config.scrollDirection === 'up') {
          noteObj.mesh.position.y = config.receptorY - yDist;
        } else {
          noteObj.mesh.position.y = config.receptorY + yDist;
        }
      } catch (e) {
        state.notes.splice(i, 1);
        continue;
      }

      // Opponent auto-hit logic
      if (noteObj.data.isOpponent) {
        if (!noteObj.headHit && timeDiff <= 0) {
          noteObj.headHit = true;
          const oppReceptor = state.receptors && state.receptors.opponent ? state.receptors.opponent[noteObj.data.lane] : null;
          if (oppReceptor) oppReceptor.userData.glowTimer = noteObj.data.holdTime > 0 ? noteObj.data.holdTime : 0.15;
          if (noteObj.data.holdTime > 0) {
            try {
              (noteObj.mesh.children || []).forEach(ch => {
                if (ch && ch.userData && (ch.userData.type === 'head' || ch.userData.type === 'outline')) ch.visible = false;
              });
            } catch (e) {}
          } else {
            removeNote(state, i);
            continue;
          }
        }

        if (noteObj.headHit && noteObj.data.holdTime > 0) {
          const children = Array.from(noteObj.mesh.children || []);
          for (let ci = children.length - 1; ci >= 0; ci--) {
            const child = children[ci];
            if (!child || !child.userData || child.userData.type !== 'holdPiece') continue;
            if (child.userData.hit) continue;
            const worldY = (noteObj.mesh.position.y || 0) + (child.position.y || 0);
            const distToReceptor = Math.abs(worldY - config.receptorY);
            if (distToReceptor < 0.6) {
              child.userData.hit = true;
              try { removePieceFromGroup(noteObj.mesh, child); } catch (e) {}
              const oppReceptor = state.receptors && state.receptors.opponent ? state.receptors.opponent[noteObj.data.lane] : null;
              if (oppReceptor) oppReceptor.userData.glowTimer = 0.06;
            }
          }

          if (timeDiff < -noteObj.data.holdTime) removeNote(state, i);
        }

        continue;
      }

      // Player-side botplay head hit
      if (!noteObj.headHit && timeDiff <= 0 && (config.botplay || state.botplay)) {
        const absDiff = Math.abs(timeDiff);
        state.combo++;
        let points = 0;
        state.stats.totalNotes = (state.stats.totalNotes || 0) + 1;
        if (absDiff < 0.045) {
          points = 350;
          state.stats.sick = (state.stats.sick || 0) + 1;
          UI_showJudgment("Sick!", "#00ffff");
        } else if (absDiff < 0.090) {
          points = 200;
          state.stats.good = (state.stats.good || 0) + 1;
          UI_showJudgment("Good", "#00ff00");
        } else {
          points = 50;
          state.stats.bad = (state.stats.bad || 0) + 1;
          UI_showJudgment("Bad", "#ffff00");
        }
        state.score += points;
        UI_updateHUD(state);

        if (noteObj.data.holdTime > 0) {
          // mark head as hit and prepare hold pieces for bot-hitting
          noteObj.headHit = true;
          noteObj.dropped = false;
          noteObj.graceTimer = 0;
          // hide both the head and its outline (not just the first child)
          try {
            (noteObj.mesh.children || []).forEach(ch => {
              if (ch && ch.userData && (ch.userData.type === 'head' || ch.userData.type === 'outline')) {
                ch.visible = false;
              }
            });
          } catch (e) {}
          (noteObj.mesh.children || []).forEach(child => {
            if (child && child.userData && child.userData.type === 'holdPiece') {
              if (child.material) child.material.opacity = 0.6;
              // do not mark them as 'hit' yet; let the hold-piece processing handle timing
              child.userData.hit = false;
            }
          });
          if (state.receptors.player && state.receptors.player[noteObj.data.lane]) state.receptors.player[noteObj.data.lane].userData.glowTimer = Math.max(noteObj.data.holdTime, 0.15);

          // Let the bot "hold" the corresponding key so hold pieces get detected the same way as when a real key is held.
          try {
            if (Array.isArray(state.keysHeld)) state.keysHeld[noteObj.data.lane] = true;
          } catch (e) {}

          // Immediately try to auto-hit any hold pieces that are already within the receptor range
          try {
            const children = Array.from(noteObj.mesh.children || []);
            for (let ci = children.length - 1; ci >= 0; ci--) {
              const child = children[ci];
              if (!child || !child.userData || child.userData.type !== 'holdPiece') continue;
              if (child.userData.hit) continue;
              const worldY = (noteObj.mesh.position.y || 0) + (child.position.y || 0);
              const distToReceptor = Math.abs(worldY - config.receptorY);
              if (distToReceptor < 0.6) {
                child.userData.hit = true;
                try { removePieceFromGroup(noteObj.mesh, child); } catch (e) {}
                if (state.receptors.player && state.receptors.player[noteObj.data.lane]) {
                  state.receptors.player[noteObj.data.lane].userData.glowTimer = 0.06;
                }
              }
            }
          } catch (e) {}
        } else {
          if (state.receptors.player && state.receptors.player[noteObj.data.lane]) state.receptors.player[noteObj.data.lane].userData.glowTimer = 0.15;
          removeNote(state, i);
          continue;
        }
      }

      // Head miss detection
      if (!noteObj.headHit && timeDiff < -config.hitWindow) {
        state.stats.totalNotes = (state.stats.totalNotes || 0) + 1;
        state.stats.miss = (state.stats.miss || 0) + 1;
        UI_showJudgment("Oh No", "#ff4444");
        UI_resetCombo(state);

        if (noteObj.data.holdTime > 0) {
          noteObj.headHit = true;
          noteObj.dropped = true;
          (noteObj.mesh.children || []).forEach(child => {
            if (child && child.userData && child.userData.type === 'holdPiece') {
              if (child.material) child.material.opacity = 0.2;
            }
          });
        } else {
          removeNote(state, i);
          continue;
        }
      }

      // Hold continuation logic
      if (noteObj.headHit && noteObj.data.holdTime > 0) {
        if (timeDiff < -noteObj.data.holdTime) {
          removeNote(state, i);
          continue;
        }

        if (!noteObj.dropped && !state.keysHeld[noteObj.data.lane]) {
          noteObj.graceTimer += delta;
          if (noteObj.graceTimer > 0.2) {
            noteObj.dropped = true;
            (noteObj.mesh.children || []).forEach(child => {
              if (child && child.userData && child.userData.type === 'holdPiece') {
                if (child.material) child.material.opacity = 0.2;
              }
            });
            if (!(config.botplay || state.botplay)) {
              UI_resetCombo(state);
            }
          }
        } else if (state.keysHeld[noteObj.data.lane]) {
          noteObj.graceTimer = 0;
          if (!noteObj.dropped) {
            state.score += Math.floor(200 * (delta > 0 ? delta : 0));
            UI_updateHUD(state);
          }
        }
      }

      // Hit hold pieces when they reach receptor (player hold or botplay)
      const children = Array.from(noteObj.mesh.children || []);
      for (let ci = children.length - 1; ci >= 0; ci--) {
        const child = children[ci];
        if (!child || !child.userData || child.userData.type !== 'holdPiece') continue;
        if (child.userData.hit) continue;
        const worldY = (noteObj.mesh.position.y || 0) + (child.position.y || 0);
        const distToReceptor = Math.abs(worldY - config.receptorY);
        if ((state.keysHeld[noteObj.data.lane] || config.botplay || state.botplay) && distToReceptor < 0.6) {
          child.userData.hit = true;
          removePieceFromGroup(noteObj.mesh, child);
          if (state.receptors.player && state.receptors.player[noteObj.data.lane]) {
            state.receptors.player[noteObj.data.lane].userData.glowTimer = 0.06;
          }
        }
      }

      if (timeDiff < -(noteObj.data.holdTime + 3)) {
        removeNote(state, i);
      }
    } catch (err) {
      try { console.error('Error updating note, removing it to prevent crash:', err); } catch (e) {}
      try { if (state && Array.isArray(state.notes) && state.notes[i]) removeNote(state, i); } catch (e) {}
      continue;
    }
  }
}