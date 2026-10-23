// UI helper functions for MIDI track routing

export function buildTrackInstrumentRoutingUI(
  midi,
  trackInstrumentsContainer,
  trackInstrumentMap,
  trackVolumeMap,
  trackPitchShiftMap,
  currentInstrument
) {
  if (!trackInstrumentsContainer) return;
  trackInstrumentsContainer.innerHTML = '';

  if (!midi || !midi.track || midi.track.length === 0) {
    const placeholder = document.createElement('div');
    placeholder.textContent = 'Load a MIDI file to route tracks to instruments.';
    placeholder.style.opacity = '0.6';
    trackInstrumentsContainer.appendChild(placeholder);
    return;
  }

  midi.track.forEach((track, index) => {
    let trackName = null;
    let tick = 0;
    if (track.event) {
      for (const ev of track.event) {
        tick += ev.deltaTime || 0;
        if (ev.type === 255 && ev.metaType === 3 && ev.data) {
          try {
            trackName = String.fromCharCode(...ev.data);
          } catch {
            trackName = null;
          }
          break;
        }
      }
    }

    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '6px';
    row.style.padding = '4px 6px';
    row.style.borderRadius = '8px';
    row.style.border = '1px solid rgba(255,255,255,0.2)';

    const label = document.createElement('span');
    label.textContent = trackName
      ? `Track ${index}: ${trackName}`
      : `Track ${index}`;
    label.style.flex = '1 1 auto';
    label.style.whiteSpace = 'nowrap';
    label.style.overflow = 'hidden';
    label.style.textOverflow = 'ellipsis';

    const select = document.createElement('select');
    select.style.flex = '0 0 auto';
    select.style.padding = '4px 6px';
    select.style.borderRadius = '6px';
    select.style.border = '1px solid rgba(255,255,255,0.2)';
    select.style.background = 'rgba(0,0,0,0.4)';
    select.style.color = '#e6e6e6';

    ['piano','boyfriend','bf2','daddy','orge','bambi','bandu','cedric','catto','bigboi','hello','fresh','burger','redmungus','none'].forEach(id => {
      const opt = document.createElement('option');
      opt.value = id;
      if (id === 'boyfriend') opt.textContent = 'Boyfriend';
      if (id === 'orge') opt.textContent = 'Orge';
      if (id === 'daddy') opt.textContent = 'Daddy Dearest';
      if (id === 'bambi') opt.textContent = 'Bambi';
      if (id === 'bandu') opt.textContent = 'Bandu';
      if (id === 'bf2') opt.textContent = 'BF2';
      if (id === 'cedric') opt.textContent = 'Cedric';
      if (id === 'catto') opt.textContent = 'Catto boi';
      if (id === 'bigboi') opt.textContent = 'Big boi';
      if (id === 'hello') opt.textContent = 'Hello Penguin';
      if (id === 'fresh') opt.textContent = 'Fresh BF';
      if (id === 'burger') opt.textContent = 'Burger';
      if (id === 'redmungus') opt.textContent = 'Red Mungus';
      if (id === 'none') opt.textContent = 'None';
      select.appendChild(opt);
    });

    select.value = Object.prototype.hasOwnProperty.call(trackInstrumentMap, index)
      ? trackInstrumentMap[index]
      : currentInstrument;
    trackInstrumentMap[index] = select.value;

    const volumeContainer = document.createElement('div');
    volumeContainer.style.display = 'flex';
    volumeContainer.style.alignItems = 'center';
    volumeContainer.style.gap = '4px';
    volumeContainer.style.flex = '0 0 120px';

    const volumeLabel = document.createElement('span');
    volumeLabel.textContent = 'Vol';
    volumeLabel.style.fontSize = '0.8em';
    volumeLabel.style.opacity = '0.8';

    const volumeInput = document.createElement('input');
    volumeInput.type = 'range';
    volumeInput.min = '1';
    volumeInput.max = '200';
    volumeInput.value = (trackVolumeMap[index] != null ? trackVolumeMap[index] : 100).toString();
    volumeInput.style.flex = '1 1 auto';

    const volumeValue = document.createElement('span');
    volumeValue.textContent = volumeInput.value;
    volumeValue.style.fontSize = '0.8em';
    volumeValue.style.minWidth = '30px';
    volumeValue.style.textAlign = 'right';

    volumeInput.addEventListener('input', () => {
      const val = Math.max(1, Math.min(200, parseInt(volumeInput.value, 10) || 100));
      trackVolumeMap[index] = val;
      volumeInput.value = val.toString();
      volumeValue.textContent = val.toString();
    });

    volumeContainer.appendChild(volumeLabel);
    volumeContainer.appendChild(volumeInput);
    volumeContainer.appendChild(volumeValue);

    // Pitch Shift Control
    const pitchContainer = document.createElement('div');
    pitchContainer.style.display = 'flex';
    pitchContainer.style.alignItems = 'center';
    pitchContainer.style.gap = '4px';
    pitchContainer.style.flex = '0 0 auto';
    pitchContainer.title = "Pitch shift (semitones)";

    const pitchLabel = document.createElement('span');
    pitchLabel.textContent = 'Pitch';
    pitchLabel.style.fontSize = '0.8em';
    pitchLabel.style.opacity = '0.8';

    const pitchInput = document.createElement('input');
    pitchInput.type = 'number';
    pitchInput.min = '-48';
    pitchInput.max = '48';
    pitchInput.step = '1';
    pitchInput.value = (trackPitchShiftMap[index] != null ? trackPitchShiftMap[index] : 0).toString();
    pitchInput.style.width = '45px';
    pitchInput.style.background = 'rgba(0,0,0,0.3)';
    pitchInput.style.border = '1px solid rgba(255,255,255,0.2)';
    pitchInput.style.borderRadius = '4px';
    pitchInput.style.color = '#e6e6e6';
    pitchInput.style.padding = '2px';
    pitchInput.style.fontSize = '0.9em';
    pitchInput.style.textAlign = 'center';

    pitchInput.addEventListener('change', () => {
      const val = parseInt(pitchInput.value, 10);
      trackPitchShiftMap[index] = isNaN(val) ? 0 : val;
    });

    pitchContainer.appendChild(pitchLabel);
    pitchContainer.appendChild(pitchInput);

    select.addEventListener('change', () => {
      trackInstrumentMap[index] = select.value;
      applyTrackRowStyles(row, select.value);
    });

    row.appendChild(label);
    row.appendChild(select);
    row.appendChild(volumeContainer);
    row.appendChild(pitchContainer);
    applyTrackRowStyles(row, select.value);

    trackInstrumentsContainer.appendChild(row);
  });
}

// Apply instrument-specific colors to track rows
export function applyTrackRowStyles(row, instrumentId) {
  let colorConfig;
  switch (instrumentId) {
    case 'orge':
      colorConfig = {
        border: '1px solid rgba(255,167,38,0.7)',
        background: 'linear-gradient(90deg, rgba(255,183,77,0.12), rgba(255,138,0,0.06))'
      };
      break;
    case 'bambi':
      colorConfig = {
        border: '1px solid rgba(102,187,106,0.8)',
        background: 'linear-gradient(90deg, rgba(129,199,132,0.16), rgba(56,142,60,0.06))'
      };
      break;
    case 'bandu':
      colorConfig = {
        border: '1px solid rgba(0,242,255,0.8)',
        background: 'linear-gradient(90deg, rgba(102,187,106,0.15), rgba(0,242,255,0.15))'
      };
      break;
    case 'bf2':
      colorConfig = {
        border: '1px solid rgba(255,235,59,0.9)',
        background: 'linear-gradient(90deg, rgba(255,241,118,0.2), rgba(255,235,59,0.08))'
      };
      break;
    case 'cedric':
      colorConfig = {
        border: '1px solid rgba(141,110,99,0.9)',
        background: 'linear-gradient(90deg, rgba(161,136,127,0.18), rgba(93,64,55,0.08))'
      };
      break;
    case 'catto':
      colorConfig = {
        border: '1px solid rgba(255,171,64,0.9)',
        background: 'linear-gradient(90deg, rgba(255,204,128,0.2), rgba(255,112,67,0.1))'
      };
      break;
    case 'bigboi':
      colorConfig = {
        border: '1px solid rgba(158,158,158,0.9)',
        background: 'linear-gradient(90deg, rgba(189,189,189,0.2), rgba(117,117,117,0.1))'
      };
      break;
    case 'hello':
      colorConfig = {
        border: '1px solid rgba(129,212,250,0.9)',
        background: 'linear-gradient(90deg, rgba(179,229,252,0.16), rgba(129,212,250,0.06))'
      };
      break;
    case 'fresh':
      colorConfig = {
        border: '1px solid rgba(255,64,129,0.9)',
        background: 'linear-gradient(90deg, rgba(255,64,129,0.16), rgba(124,77,255,0.06))'
      };
      break;
    case 'burger':
      colorConfig = {
        border: '1px solid rgba(111,85,47,0.95)',
        background: 'linear-gradient(90deg, rgba(139,107,69,0.14), rgba(111,85,47,0.06))'
      };
      break;
    case 'redmungus':
      colorConfig = {
        border: '1px solid rgba(138,56,56,0.95)',
        background: 'linear-gradient(90deg, rgba(183,59,59,0.12), rgba(74,42,42,0.06))'
      };
      break;
    case 'daddy':
      colorConfig = {
        border: '1px solid rgba(186,104,200,0.9)',
        background: 'linear-gradient(90deg, rgba(186,104,200,0.18), rgba(123,31,162,0.08))'
      };
      break;
    case 'boyfriend':
    default:
      colorConfig = {
        border: '1px solid rgba(0,242,255,0.7)',
        background: 'linear-gradient(90deg, rgba(0,242,255,0.14), rgba(0,184,212,0.05))'
      };
      break;
    case 'none':
      colorConfig = {
        border: '1px solid rgba(255,255,255,0.3)',
        background: 'linear-gradient(90deg, rgba(255,255,255,0.08), rgba(0,0,0,0.2))'
      };
      row.style.opacity = '0.5';
      row.style.filter = 'grayscale(0.4)';
      break;
  }
  if (instrumentId !== 'none') {
    row.style.opacity = '1';
    row.style.filter = 'none';
  }
  row.style.border = colorConfig.border;
  row.style.background = colorConfig.background;
}