# Recovery Center MIDI Player

BFDI / BFB / TPOT style recovery center that plays MIDI files using the official-style **button press** samples (A = lowest pitch → Z = highest pitch).

## Features

- Visual recovery center matching the classic look (keypad, GO, TRY AGAIN, screen)
- Upload any standard MIDI (`.mid` / `.midi`)
- Play / Pause / Stop (also GO and TRY AGAIN on the machine)
- Per-track enable/disable — average pitch is recomputed from selected tracks only
- Automatic pitch centering so songs aren’t stuck at the top or bottom of the keyboard
- Manual pitch offset (±12 semitones)
- Volume control
- Keys light up when their note plays; click keys to audition samples
- No held notes — each MIDI note is a single button press

## How to run

Open `index.html` in a modern browser (Chrome / Firefox / Edge recommended).

Because of browser security, **serve the folder over HTTP** if `file://` blocks loading the WAVs or the MIDI library:

```bash
# from this folder
npx serve .
# or
python -m http.server 8080
```

Then open the URL shown (e.g. `http://localhost:8080`).

## Files

| Path | Purpose |
|------|---------|
| `index.html` | Structure |
| `styles.css` | Layout + recovery center look |
| `app.js` | MIDI parse, pitch map, playback, UI |
| `sounds/PressA.wav` … `PressZ.wav` | Button press samples (low → high) |
| `recovery-center.png` | Reference screenshot |

## Pitch mapping

1. On load (and when track selection changes), the **average MIDI note number** of all notes in the selected tracks is computed.
2. That average is mapped to the middle of A–Z.
3. Each note is snapped to the nearest letter key; extreme notes clamp to A or Z.
4. The **Pitch offset** slider shifts the center by ±12 semitones so you can fine-tune the sound.

## Credits

Button press samples: Normal Button Presses (A–Z).  
UI inspired by the BFDI/BFB/TPOT Recovery Center.
