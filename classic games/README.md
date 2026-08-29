# Classic Games

A browser-based collection of classic games and ROM hacks powered by [EmulatorJS](https://emulatorjs.org).

## Supported Systems

- **NES** – Super Mario Bros., Super Mario Bros. 2, Super Mario Bros. 3, Kirby's Adventure, Nyan Cat
- **SNES** – Super Mario World, Super Mario All-Stars
- **Sega Genesis / Mega Drive** – Sonic the Hedgehog 1–3, Sonic & Knuckles, Sonic 3 & Knuckles, Sonic 3-in-1, plus ROM hacks
- **Sega Master System** – Sonic the Hedgehog

## How to Run

```bash
cd classic-games
python3 -m http.server 8080
```

Open http://localhost:8080 in your browser.

Or use any static file server / Live Server extension.

## Controls

| Action          | Keyboard          |
|-----------------|-------------------|
| D-Pad           | Arrow keys / WASD |
| A / B buttons   | Z / X or A / S    |
| Start           | Enter             |
| Select          | Shift             |

You can also use a connected gamepad. Click the game screen once so the browser captures keyboard input.

## Notes

- ROMs are in the `roms/` folder; thumbnails in `thumbs/`.
- Emulator cores load from the public EmulatorJS CDN.
- Save states and battery saves are supported via the EmulatorJS menu.

Enjoy!
