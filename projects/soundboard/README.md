# OrgeYT Soundboard

A meme arcade-button soundboard (static HTML/CSS/JS).

## Structure

```
index.html
style.css
config.js
sounds.js
app.js
sounds/          ← all audio files go here
  metal-pipe.mp3
  ...
```

## Run

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`.

## Add a sound

1. Put the file in `sounds/` (e.g. `bonk.mp3`)
2. Add a line to `sounds.js`:

```js
{ name: "Bonk", audio: "bonk" },
```

Button color is generated automatically from the name.
