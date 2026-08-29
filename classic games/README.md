# Classic Games

A browser-based collection of classic games and ROM hacks powered by [EmulatorJS](https://emulatorjs.org).

## Supported Systems (built-in library)

- **NES** – Super Mario Bros., Super Mario Bros. 2, Super Mario Bros. 3, Kirby's Adventure, Nyan Cat
- **SNES** – Super Mario World, Super Mario All-Stars
- **Sega Genesis / Mega Drive** – Sonic the Hedgehog 1–3, Sonic & Knuckles, Sonic 3 & Knuckles, Sonic 3-in-1, plus ROM hacks
- **Sega Master System** – Sonic the Hedgehog

## Play Your Own ROMs

Use the **Play Your Own ROM** panel on the home page:

1. Select a console supported by EmulatorJS (NES, SNES, Genesis, Master System, Game Boy, GBA, N64, DS, PlayStation, Atari, Arcade, and more).
2. Upload a compatible ROM file.
3. Click **Play ROM**.

The emulator loads from the public EmulatorJS CDN. Core names match EmulatorJS conventions (`nes`, `snes`, `segaMD`, `segaMS`, `gb`, `gba`, `n64`, etc.).

## Download ROMs

Every game card has a **Download** button that saves the ROM file to your device.

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

- Built-in ROMs are in the `roms/` folder; thumbnails in `thumbs/`.
- Emulator cores load from the public EmulatorJS CDN.
- Save states and battery saves are supported via the EmulatorJS menu.
- Custom uploaded ROMs are played via a temporary blob URL (not stored on the server).

Enjoy!
