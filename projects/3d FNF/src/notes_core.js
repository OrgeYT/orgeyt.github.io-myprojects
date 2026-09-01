/* src/notes_core.js
   Core helpers: chart generation, parsing, basic note removal/cleanup and input handler.
*/
export function generateRandomChart(durationSeconds, notesPerSecond) {
  const chart = [];
  const totalNotes = Math.floor(durationSeconds * notesPerSecond);

  for (let i = 0; i < totalNotes; i++) {
    const time = (i / notesPerSecond) + (Math.random() * 0.2 - 0.1);
    const isOpponent = Math.random() > 0.5;
    const lane = Math.floor(Math.random() * 4);
    const holdTime = Math.random() > 0.8 ? 1.0 : 0;
    chart.push({ time, lane, isOpponent, holdTime });
  }
  return chart.sort((a, b) => a.time - b.time);
}

export function parsePsychChart(json) {
  const chart = [];
  let songData = json.song ? json.song : json;
  if (typeof songData === 'string') songData = json;

  const speed = songData.speed || 1;
  const offset = songData.offset || 0;

  if (songData.notes) {
    songData.notes.forEach(section => {
      if (section.sectionNotes) {
        section.sectionNotes.forEach(note => {
          const timeSec = (note[0] + offset) / 1000;
          const rawLane = note[1];
          const holdTime = (note[2] || 0) / 1000;
          const isOpponent = rawLane >= 4;
          const lane = rawLane % 4;
          if (lane >= 0 && lane <= 3) {
            chart.push({ time: timeSec, lane: lane, isOpponent: isOpponent, holdTime: holdTime });
          }
        });
      }
    });
  }

  return chart.sort((a, b) => a.time - b.time);
}

// safe removal helpers
export function removeNote(state, index) {
  if (!state) return;
  // attempt to clear any held key for this note's lane so botplay / input state stays consistent
  try {
    if (state.notes && state.notes[index] && state.notes[index].data) {
      const lane = state.notes[index].data.lane;
      if (typeof lane === 'number' && Array.isArray(state.keysHeld)) {
        state.keysHeld[lane] = false;
      }
    }
  } catch (e) {}

  if (!state._three || !state._three.scene) {
    if (state.notes && state.notes[index]) state.notes.splice(index, 1);
    return;
  }
  const { scene } = state._three;
  if (!state.notes || !state.notes[index]) return;
  const mesh = state.notes[index].mesh;
  try {
    if (mesh && scene) scene.remove(mesh);
  } catch (e) {}
  state.notes.splice(index, 1);
}

export function removePieceFromGroup(group, piece) {
  if (!group || !piece) return;
  try {
    const y = piece.position.y;
    const toRemove = [];
    group.children.forEach(ch => {
      if (ch === piece) return;
      if (ch.userData && ch.userData.type === 'holdPieceOutline' && Math.abs((ch.position.y || 0) - y) < 0.001) {
        toRemove.push(ch);
      }
    });
    toRemove.forEach(o => {
      try {
        group.remove(o);
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach(m => m.dispose && m.dispose());
          else o.material.dispose && o.material.dispose();
        }
      } catch (e) {}
    });

    group.remove(piece);
    if (piece.geometry) piece.geometry.dispose();
    if (piece.material) {
      if (Array.isArray(piece.material)) piece.material.forEach(m => m.dispose && m.dispose());
      else piece.material.dispose && piece.material.dispose();
    }
  } catch (e) {
    // ignore
  }
}

export function clearAll(state) {
  if (!state) return;
  if (state._three && state._three.scene) {
    const { scene } = state._three;
    state.notes.forEach(n => {
      try { if (n && n.mesh) scene.remove(n.mesh); } catch (e) {}
    });
  }
  state.notes = [];
}

// Minimal UI helpers (kept local so core remains usable without UI import)
export function UI_showJudgment(t, c) {
  const el = document.getElementById('judgment-display');
  if (!el) return;
  el.innerText = t;
  el.style.color = c;
  el.classList.remove('pop-anim');
  void el.offsetWidth;
  el.classList.add('pop-anim');
}

export function UI_updateHUD(state) {
  const s = document.getElementById('score-display');
  const c = document.getElementById('combo-display');
  const m = document.getElementById('misses-display');
  const a = document.getElementById('accuracy-display');
  if (s) s.innerText = `Score: ${state.score}`;
  if (c) c.innerText = `Combo: ${state.combo}`;
  if (m) m.innerText = `Misses: ${state.stats ? state.stats.miss : 0}`;

  if (a && state.stats) {
    const total = state.stats.totalNotes || 0;
    const weighted = ((state.stats.sick || 0) * 1.0) + ((state.stats.good || 0) * 0.66) + ((state.stats.bad || 0) * 0.33);
    const acc = total > 0 ? Math.round((weighted / total) * 100) : 100;
    a.innerText = `Accuracy: ${isFinite(acc) ? acc : 0}%`;
  }
}

export function UI_resetCombo(state) {
  state.combo = 0;
  UI_updateHUD(state);
}

// Player input handler (relies on the helpers above and removeNote)
export function handlePlayerInput(config, state, laneIndex) {
  let closestNoteIdx = -1;
  let closestTimeDiff = Infinity;

  for (let i = 0; i < state.notes.length; i++) {
    const n = state.notes[i];
    if (!n.data.isOpponent && n.data.lane === laneIndex) {
      if (!n.headHit && !n.dropped) {
        const absTimeDiff = Math.abs(n.data.time - state.time);
        if (absTimeDiff < closestTimeDiff && absTimeDiff <= config.hitWindow) {
          closestTimeDiff = absTimeDiff;
          closestNoteIdx = i;
        }
      } else if (n.dropped && n.data.holdTime > 0) {
        const timeDiff = n.data.time - state.time;
        if (timeDiff < 0 && timeDiff > -n.data.holdTime) {
          n.dropped = false;
          n.headHit = true;
          n.graceTimer = 0;
          n.mesh.children.forEach(child => {
            if (child.userData && child.userData.type === 'holdPiece') child.material.opacity = 0.6;
          });
          return;
        }
      }
    }
  }

  if (closestNoteIdx !== -1) {
    const n = state.notes[closestNoteIdx];
    state.stats.totalNotes = (state.stats.totalNotes || 0) + 1;
    state.combo++;
    let points = 0;
    if (closestTimeDiff < 0.045) {
      points = 350;
      state.stats.sick = (state.stats.sick || 0) + 1;
      UI_showJudgment("Sick!", "#00ffff");
    } else if (closestTimeDiff < 0.090) {
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

    if (n.data.holdTime > 0) {
      n.headHit = true;
      n.dropped = false;
      n.graceTimer = 0;
      try {
        n.mesh.children.forEach(ch => {
          if (ch.userData && (ch.userData.type === 'head' || ch.userData.type === 'outline')) ch.visible = false;
        });
      } catch (e) {}
      n.mesh.children.forEach(child => {
        if (child.userData && child.userData.type === 'holdPiece') {
          if (child.material) child.material.opacity = 0.6;
          child.userData.hit = false;
        }
      });
      if (state.receptors.player[n.data.lane]) state.receptors.player[n.data.lane].userData.glowTimer = Math.max(n.data.holdTime, 0.15);
    } else {
      if (state.receptors.player[n.data.lane]) state.receptors.player[n.data.lane].userData.glowTimer = 0.15;
      removeNote(state, closestNoteIdx);
    }
  } else {
    UI_showJudgment("Tap", "#888888");
  }
}