# UltraBox JSON Player

A small multi-file web player that loads **UltraBox / BeepBox-family `.json` songs** and plays them with the **official UltraBox synth** for accurate sound.

## Files

| File | Role |
|------|------|
| `index.html` | UI shell |
| `style.css` | Dark theme styling |
| `player.js` | Load JSON → `Song.fromJsonObject` → `Synth` playback |
| `beepbox_synth.min.js` | Official UltraBox audio engine (from ultraabox.github.io) |
| `example-song.json` | Sample song (“Piano master”) |

## How to run

Because the example is loaded via `fetch`, serve the folder over HTTP (not `file://`):

```bash
cd ultrabox-player
python3 -m http.server 8080
# open http://localhost:8080
```

Or drop any UltraBox/JummBox/BeepBox JSON onto the page (works from `file://` too for local files).

## How UltraBox JSON works

- Export format is a plain JSON object with `"format": "UltraBox"` (or BeepBox / JummBox / …).
- Top-level fields: `name`, `version`, `scale` / `customScale`, `key`, `beatsPerBar`, `ticksPerBeat`, `beatsPerMinute`, `introBars`, `loopBars`, `channels`, …
- Each **channel** has `type` (`pitch` | `noise` | `mod` / `drum`), `instruments[]`, `patterns[]`, and a `sequence[]` of pattern indices (one entry per bar).
- **Instruments** describe synthesis type (`Picked String`, `FM`, `harmonics`, `drumset`, chip waves, etc.), envelopes, filters, effects, unison, harmonics spectrum, etc.
- **Patterns** hold `notes[]`; each note has `pitches[]` and `points[]` (pins: tick, pitchBend, volume).

The official synth reconstructs the full instrument graph and plays it through the Web Audio API. This player does not re-implement synthesis — it only feeds the JSON into `beepbox.Song` / `beepbox.Synth`.

## Controls

- **Space** – play / pause  
- **R** – restart  
- **S** – stop  
- Volume slider, per-channel mute, progress bar (seek is best-effort)

## License notes

- Synth engine: © John Nesky & contributors, MIT (same as BeepBox / UltraBox).
- This wrapper UI is free to reuse.
