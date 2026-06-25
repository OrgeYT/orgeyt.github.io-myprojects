export class Platform {
  constructor(x, y, width, height, color = '#43a047') {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.color = color;
    this.type = 'platform';
  }

  draw(ctx) {
    // Draw platform body with configurable color
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.width, this.height);
  }
}

// KillBlock: harms player on contact and draws a colored glow
export class KillBlock {
  constructor(x, y, width, height, color = '#ff1744') {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.color = color;
    this.type = 'kill';
  }

  draw(ctx) {
    // Glow effect
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 24;
    ctx.fillRect(this.x, this.y, this.width, this.height);

    // Inner block to reduce over-glow
    ctx.shadowBlur = 0;
    ctx.fillStyle = this.color;
    ctx.globalAlpha = 0.95;
    ctx.fillRect(this.x + 2, this.y + 2, this.width - 4, this.height - 4);
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

// Checkpoint: cycles between its color and yellow; when touched it becomes the active respawn
export class Checkpoint {
  constructor(x, y, width, height, color = '#43a047') {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.baseColor = color;
    this.type = 'checkpoint';
    this.unlocked = false;
    this._timeOffset = Math.random() * 10000;
  }

  // helper to interpolate colors (simple linear between rgb)
  _lerpColor(colA, colB, t) {
    const a = this._hexToRgb(colA);
    const b = this._hexToRgb(colB);
    const r = Math.round(a.r + (b.r - a.r) * t);
    const g = Math.round(a.g + (b.g - a.g) * t);
    const bl = Math.round(a.b + (b.b - a.b) * t);
    return `rgb(${r},${g},${bl})`;
  }

  _hexToRgb(hex) {
    const h = hex.replace('#', '');
    const bigint = parseInt(h, 16);
    if (h.length === 6) {
      return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
    } else {
      // fallback
      return { r: 200, g: 200, b: 200 };
    }
  }

  draw(ctx) {
    // animate color between baseColor and yellow
    const t = (Math.sin((Date.now() + this._timeOffset) * 0.002) + 1) / 2;
    const animated = this._lerpColor(this.baseColor, '#FFD600', t);

    ctx.save();
    // glowing effect if unlocked
    ctx.fillStyle = animated;
    ctx.shadowColor = animated;
    ctx.shadowBlur = this.unlocked ? 32 : 18;
    ctx.fillRect(this.x, this.y, this.width, this.height);

    // inner box
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = animated;
    ctx.fillRect(this.x + 3, this.y + 3, this.width - 6, this.height - 6);

    // draw a small tick if unlocked
    if (this.unlocked) {
      ctx.fillStyle = '#fff';
      ctx.font = '18px Arial';
      ctx.fillText('✓', this.x + this.width / 2 - 6, this.y + this.height / 2 + 6);
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

export class WinBlock {
  constructor(x, y, width, height, color = '#64dd17') {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.color = color;
    this.type = 'win';
  }

  draw(ctx) {
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 28;
    ctx.fillRect(this.x, this.y, this.width, this.height);

    // inner white star
    ctx.fillStyle = '#fff';
    ctx.font = `${Math.max(12, Math.round(this.height * 0.6))}px Arial`;
    ctx.fillText('★', this.x + this.width / 2 - (this.height * 0.3), this.y + this.height / 2 + (this.height * 0.2));
    ctx.restore();
  }
}

// Door: semi-transparent, phase-through block with an ID that links two doors; placing, drawing and simple metadata.
export class Door {
  constructor(x, y, width, height, color = 'rgba(160,160,255,0.36)', id = null) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.color = color;
    this.id = id; // string identifier linking two doors
    this.type = 'door';
  }

  draw(ctx) {
    ctx.save();
    // translucent fill with slight glow
    try {
      ctx.fillStyle = this.color;
    } catch (e) {
      ctx.fillStyle = 'rgba(160,160,255,0.36)';
    }
    ctx.globalAlpha = 0.76;
    ctx.fillRect(this.x, this.y, this.width, this.height);

    // outline and subtle inner rect for depth
    ctx.globalAlpha = 0.98;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    ctx.strokeRect(this.x + 1, this.y + 1, this.width - 2, this.height - 2);

    // show ID in editor (the editor UI will toggle showing it) — in-game code will avoid drawing it in gameplay
    if (this._showIdForEditor) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = String(this.id || '');
      ctx.fillText(label, this.x + this.width / 2, this.y + this.height / 2);
    }
    ctx.restore();
  }
}

/*
  Coin: collectible sprite that uses a packed sprite sheet (coinspritesheet.png).
  Sheet layout: rows = 2, cols = 3, skip the last frame; animate at 15 FPS.
*/
export class Coin {
  constructor(x, y, width = 32, height = 32) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.type = 'coin';

    // Sprite sheet settings (rows x cols, skip last frame)
    this._sheetRows = 2;
    this._sheetCols = 3;
    this._skipLast = true;
    this._fps = 15;

    // Ensure a shared sheet image exists; it will be assigned by Game to Coin._img (preferred),
    // but create a fallback image pointing to the same asset so code is robust.
    if (!Coin._img) {
      Coin._img = new Image();
      Coin._img.crossOrigin = 'anonymous';
      Coin._img.src = '/coinspritesheet.png';
    }
  }

  draw(ctx) {
    try {
      // Prefer the game's shared coin image instance for consistent loading; fallback to Coin._img.
      let img = null;
      try {
        if (window && window.game && window.game._coinImage && window.game._coinImage.complete) {
          img = window.game._coinImage;
        }
      } catch (e) {
        img = null;
      }
      if (!img) img = Coin._img;

      // If sheet isn't ready, fallback to a simple gold circle.
      if (!img || !img.complete || !img.naturalWidth) {
        ctx.save();
        ctx.fillStyle = '#ffd54f';
        ctx.beginPath();
        ctx.ellipse(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, this.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
      }

      // Compute frame width/height from the sheet natural size and configured rows/cols.
      const cols = this._sheetCols;
      const rows = this._sheetRows;
      const totalFrames = cols * rows - (this._skipLast ? 1 : 0);
      const frameW = Math.floor(img.naturalWidth / cols);
      const frameH = Math.floor(img.naturalHeight / rows);

      // Determine current frame index based on time and FPS (looping)
      const now = Date.now();
      const msPerFrame = Math.max(1, Math.floor(1000 / Math.max(1, this._fps)));
      const frameIndex = Math.floor(now / msPerFrame) % totalFrames;

      // Map index to sheet coordinates (skipping last frame if requested)
      const sx = (frameIndex % cols) * frameW;
      const sy = Math.floor(frameIndex / cols) * frameH;

      // Draw the selected frame from the sheet to match coin size
      ctx.drawImage(img, sx, sy, frameW, frameH, this.x, this.y, this.width, this.height);
    } catch (e) {
      // fallback to simple circle if anything goes wrong
      try {
        ctx.save();
        ctx.fillStyle = '#ffd54f';
        ctx.beginPath();
        ctx.ellipse(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, this.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } catch (err) {}
    }
  }
}

// CoinShooter: placed in editor, aims at nearest player and periodically spawns physics-enabled dropped coins toward them
export class CoinShooter {
  constructor(x, y, width = 48, height = 32, color = '#ffd54f') {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.color = color;
    this.type = 'coin_shooter';
    // internal timer for shooting
    this._lastShot = 0;
    this._shootInterval = 500; // ms per coin
  }

  // draw a small shooter sprite: a box with a muzzle pointing toward player (muzzle drawn in runtime)
  draw(ctx) {
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 10;
    ctx.fillRect(this.x, this.y, this.width, this.height);
    ctx.shadowBlur = 0;
    // muzzle
    ctx.fillStyle = '#444';
    ctx.fillRect(this.x + this.width - 6, this.y + this.height / 2 - 6, 12, 12);
    ctx.restore();
  }
}