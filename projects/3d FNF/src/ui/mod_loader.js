/* src/ui/mod_loader.js
   Mod ZIP handling: reads ZIP, presents folder/chart chooser, loads audio.
   Relocated from ui_main to keep concerns separated.
*/
import createChooser from './chooser.js';

export function wireModLoader(config, state, hooks = {}, helpers = {}) {
  const uploadMod = document.getElementById('upload-mod');
  const modInfoEl = document.getElementById('mod-info');
  if (!uploadMod) return;

  // keep the last chosen zip in memory until refresh or new zip picked
  window.currentModZip = null;
  window.currentModName = null;

  uploadMod.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (typeof JSZip === 'undefined') {
      alert('JSZip library not loaded; cannot read mod zip.');
      return;
    }

    const originalInfo = modInfoEl ? modInfoEl.innerText : '';
    if (modInfoEl) modInfoEl.innerText = `Reading ${file.name}...`;
    uploadMod.disabled = true;
    try {
      const zip = await JSZip.loadAsync(file);

      const dataFolders = new Set();
      zip.forEach((relativePath, zipEntry) => {
        const parts = relativePath.split('/').filter(p => p.length);
        const dataIdx = parts.indexOf('data');
        if (dataIdx === -1) return;
        if (parts.length > dataIdx + 1) dataFolders.add(parts[dataIdx + 1]);
      });

      const folders = Array.from(dataFolders);
      if (folders.length === 0) {
        alert('No data folders found under ZIP/data. Mod must contain ZIP/data/<folder>/.');
        uploadMod.disabled = false;
        if (modInfoEl) modInfoEl.innerText = originalInfo || 'No mod loaded';
        return;
      }

      createChooser('Choose folder in ZIP/data', folders, async (folderIdx) => {
        if (folderIdx < 0) {
          if (modInfoEl) modInfoEl.innerText = originalInfo || 'No mod loaded';
          uploadMod.disabled = false;
          return;
        }
        const folderChoice = folders[folderIdx];

        // list JSON files under chosen data folder
        const jsonPaths = [];
        zip.forEach((relativePath, zipEntry) => {
          if (zipEntry.dir) return;
          const parts = relativePath.split('/').filter(p => p.length);
          const dataIdx = parts.indexOf('data');
          if (dataIdx === -1) return;
          if (parts.length > dataIdx + 1 && parts[dataIdx + 1] === folderChoice && relativePath.toLowerCase().endsWith('.json')) {
            jsonPaths.push(relativePath);
          }
        });

        if (jsonPaths.length === 0) {
          alert('No JSON chart files found in chosen folder.');
          uploadMod.disabled = false;
          if (modInfoEl) modInfoEl.innerText = originalInfo || 'No mod loaded';
          return;
        }

        const viableCharts = [];
        for (const p of jsonPaths) {
          try {
            const fileEntry = zip.file(p);
            if (!fileEntry) continue;
            const txt = await fileEntry.async('string');
            const parsed = JSON.parse(txt);
            const candidate = hooks.parsePsychChart ? hooks.parsePsychChart(parsed) : (Array.isArray(parsed) ? parsed : (parsed.notes ? parsed.notes : []));
            if (Array.isArray(candidate) && candidate.length >= 2) viableCharts.push({ path: p, raw: parsed });
          } catch (err) {
            console.warn('Skipping chart', p, err);
          }
        }

        if (viableCharts.length === 0) {
          alert('No valid charts with >=2 notes found in that folder.');
          uploadMod.disabled = false;
          if (modInfoEl) modInfoEl.innerText = originalInfo || 'No mod loaded';
          return;
        }

        const pickChart = async (chartIdx) => {
          if (chartIdx < 0) {
            uploadMod.disabled = false;
            if (modInfoEl) modInfoEl.innerText = originalInfo || 'No mod loaded';
            return;
          }
          const loadedCustomChart = hooks.parsePsychChart ? hooks.parsePsychChart(viableCharts[chartIdx].raw) : (Array.isArray(viableCharts[chartIdx].raw) ? viableCharts[chartIdx].raw : []);

          // collect audio files under songs/<folderChoice>/
          const audioEntries = [];
          zip.forEach((relativePath, zipEntry) => {
            if (zipEntry.dir) return;
            const parts = relativePath.split('/').filter(p => p.length);
            const songsIdx = parts.indexOf('songs');
            if (songsIdx === -1) return;
            const lower = relativePath.toLowerCase();
            if (parts.length > songsIdx + 1 && parts[songsIdx + 1] === folderChoice &&
                (lower.endsWith('.mp3') || lower.endsWith('.ogg') || lower.endsWith('.wav') || lower.endsWith('.m4a') || lower.endsWith('.aac'))) {
              audioEntries.push(relativePath);
            }
          });

          if (audioEntries.length === 0) {
            alert('No audio files found under ZIP/songs/' + folderChoice + '/. The chart requires audio.');
            if (modInfoEl) modInfoEl.innerText = originalInfo || 'No mod loaded';
            uploadMod.disabled = false;
            return;
          }

          if (modInfoEl) modInfoEl.innerText = `Loading audio from ${file.name}...`;
          const loadedAudioFiles = [];
          for (const ap of audioEntries.slice(0, 8)) {
            try {
              const fileEntry = zip.file(ap);
              if (!fileEntry) continue;
              const uint8 = await fileEntry.async('uint8array');
              const blob = new Blob([uint8], { type: 'audio/*' });
              const url = URL.createObjectURL(blob);
              const audio = new Audio(url);
              audio.preload = 'auto';
              loadedAudioFiles.push(audio);
            } catch (err) {
              console.error('Failed to load audio', ap, err);
            }
          }

          window.currentModZip = zip;
          window.currentModName = folderChoice;

          if (modInfoEl) modInfoEl.innerText = `Mod loaded: ${file.name} → folder: ${folderChoice} (charts: ${viableCharts.length}, audio: ${loadedAudioFiles.length})`;

          // expose loaded chart/audio to hooks.startGame path by attaching to state for play
          state.currentCustomChart = loadedCustomChart;
          state.currentAudios = loadedAudioFiles;

          // Enable the Play Custom Chart button if we have a chart and at least one audio
          const btnPlayCustom = document.getElementById('btn-play-custom');
          if (btnPlayCustom) {
            if (state.currentCustomChart && Array.isArray(state.currentAudios) && state.currentAudios.length > 0) {
              btnPlayCustom.disabled = false;
              btnPlayCustom.classList.remove('opacity-50', 'cursor-not-allowed');
              btnPlayCustom.classList.add('hover:shadow-blue-500/50');
            } else {
              btnPlayCustom.disabled = true;
              btnPlayCustom.classList.add('opacity-50', 'cursor-not-allowed');
              btnPlayCustom.classList.remove('hover:shadow-blue-500/50');
            }
          }

          if (typeof hooks.onModLoaded === 'function') hooks.onModLoaded(loadedCustomChart, loadedAudioFiles);

          uploadMod.disabled = false;
        };

        if (viableCharts.length === 1) {
          await pickChart(0);
        } else {
          const names = viableCharts.map(c => c.path);
          createChooser('Choose chart in folder', names, async (chosen) => {
            await pickChart(chosen);
          });
        }
      }, true);
    } catch (err) {
      console.error('Error reading mod zip:', err);
      alert('Failed to read mod zip. See console for details.');
      uploadMod.disabled = false;
      if (modInfoEl) modInfoEl.innerText = originalInfo || 'No mod loaded';
    }
  });
}