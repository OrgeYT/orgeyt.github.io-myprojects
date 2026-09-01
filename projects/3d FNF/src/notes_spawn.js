/* src/notes_spawn.js
   Spawning logic for notes (head + optional hold pieces).
   Relies on THREE global and state._three note material/geometries.
*/
export function spawnNote(state, config, noteData) {
  if (!state || !state._three) return;
  const { scene, noteGeometry, noteMats, noteOutlineMats } = state._three || {};
  if (!scene || !noteGeometry || !noteMats) return;

  const group = new THREE.Group();

  const headMat = noteMats[noteData.lane];
  const head = new THREE.Mesh(noteGeometry, headMat);
  head.userData = { type: 'head' };
  head.renderOrder = 1;
  head.position.z = 0;

  const outline = new THREE.Mesh(noteGeometry.clone(), noteOutlineMats ? noteOutlineMats[noteData.lane] : headMat);
  outline.scale.set(1.08, 1.08, 1.08);
  outline.position.z = -0.02;
  outline.userData = { type: 'outline' };
  outline.renderOrder = 0;

  group.add(outline);
  group.add(head);

  if (noteData.holdTime > 0) {
    const tailLen = noteData.holdTime * (config.scrollSpeed || 0);
    const pieceDuration = 0.125;
    const pieceCount = Math.max(1, Math.ceil(noteData.holdTime / pieceDuration));
    const pieceHeight = pieceCount > 0 ? tailLen / pieceCount : tailLen;
    const pieceGeo = new THREE.BoxGeometry(0.35, Math.max(0.04, pieceHeight * 0.9), 0.06);

    for (let p = 0; p < pieceCount; p++) {
      const mat = (noteMats[noteData.lane] && noteMats[noteData.lane].clone) ? noteMats[noteData.lane].clone() : noteMats[0];
      if (mat) { mat.transparent = true; mat.opacity = 0.65; }
      const piece = new THREE.Mesh(pieceGeo, mat);
      piece.userData = {
        type: 'holdPiece',
        hit: false,
        index: p,
        pieceCount,
        pieceDuration
      };

      const pieceOutlineMat = state._three.noteOutlineMats ? state._three.noteOutlineMats[noteData.lane] : null;
      let pieceOutline = null;
      if (pieceOutlineMat) {
        pieceOutline = new THREE.Mesh(pieceGeo.clone(), pieceOutlineMat);
        pieceOutline.scale.set(1.06, 1.06, 1.06);
        pieceOutline.position.z = -0.015;
        pieceOutline.userData = { type: 'holdPieceOutline' };
        group.add(pieceOutline);
      }

      const offsetFromHead = (p + 0.5) * pieceHeight;
      const yOffset = config.scrollDirection === 'up' ? -offsetFromHead : offsetFromHead;
      piece.position.y = yOffset;
      piece.position.z = 0;
      group.add(piece);

      if (pieceOutline) pieceOutline.position.y = piece.position.y;
    }
  }

  const xOffset = noteData.isOpponent ? config.opponentXOffset : config.playerXOffset;
  group.position.x = xOffset + (noteData.lane - 1.5) * config.laneWidth;
  const spawnY = config.scrollDirection === 'up' ? -15 : 15;
  group.position.y = spawnY;
  group.position.z = 0;

  try { scene.add(group); } catch (e) {}
  state.notes.push({
    mesh: group,
    data: noteData,
    headHit: false,
    dropped: false,
    graceTimer: 0
  });
}