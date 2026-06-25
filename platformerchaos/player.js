export class Player {
  constructor(x, y) {
    this.initialX = x;
    this.initialY = y;
    this.x = x;
    this.y = y;
    this.width = 40;
    this.height = 60;
    this.shape = 'rect'; // 'rect' or 'ball' for visual mode
    this.velocityX = 0;
    this.velocityY = 0;
    this.speed = 5;
    this.jumpForce = 15;
    this.gravity = 0.8;
    // friction factor applied to horizontal velocity each update (0 < f < 1). Default 0.9
    this.friction = 0.9;
    this.isJumping = false;

    // Skin system: define available skins (face, palette, rotate flag)
    this._skins = {
      'p1 default': { face: ':)', palette: ['#ff3b3b','#ff8a00','#ffd400','#4caf50','#2196f3','#9c27b0'], rotate: true },
      'p2 default': { face: ':D', palette: ['#8d6e63','#90a4ae','#7c4dff','#f06292'], rotate: true },
      '˃⩌˂':      { face: '˃⩌˂', palette: ['#ff9800','#1565c0'], rotate: false },
      '´ཀ`':      { face: '´ཀ`', palette: ['#000000','#ffffff'], rotate: false },
      ':3':       { face: ':3', palette: ['#ffc0cb','#ffb6c1','#ff69b4'], rotate: true },
      ':o':       { face: ':o', palette: ['#4caf50','#2e7d32'], rotate: true },
      '•֊•':      { face: '•֊•', palette: ['#f5c27a','#c08fbd','#ffd7e6'], rotate: false },
      '눈‸눈':    { face: '눈‸눈', palette: ['#0b2340','#031b2b','#1b263b'], rotate: false },
      '☺︎':       { face: '☺︎', palette: ['#fff176','#ffd54f','#fdd835'], rotate: false },
      '>⩊<':      { face: '>⩊<', palette: ['#ffd1e8','#ffe6cc','#cbeccc'], rotate: false },
      'ノ_<':     { face: 'ノ_<', palette: ['#e53935','#ffeb3b'], rotate: false },
      '=]':       { face: '=]', palette: ['#90a4ae','#cfd8dc','#b0bec5'], rotate: true },
      '(loading svg)': { face: '⏳', palette: ['#00bcd4','#03a9f4','#b3e5fc'], rotate: false },

      // NEW skins requested + shop skins visual definitions
      'Frostbite': { face: ';{', palette: ['#e6f7ff','#cfefff','#9bd4f0','#74c8ee','#dff7ff'], rotate: true },
      'Rust Circuit': { face: ':\\', palette: ['#6b3f1f','#8f4b2a','#c07a52','#4b3621','#2f1a0f'], rotate: true },
      'Verdant Leaf': { face: '=D', palette: ['#e6f9ec','#b8f0b9','#7ad07a','#3a9a3a','#0b5e10'], rotate: true },
      'Nebula Wave': { face: '╵o╵', palette: ['#0b1226','#2b2e6b','#4b19a6','#2aa6ff','#9bf0ff'], rotate: false },
      'Neon Pop': { face: 'ᴗ_ᴗ', palette: ['#ff007f','#ffdd00','#00ffe1','#7cff00','#ff4dff'], rotate: false },

      // Added skins requested by user
      'Bluey sky': { face: '^_^', palette: ['#d0f0ff','#90d8ff','#4db8ff','#2b9cff','#0b75d6'], rotate: false },
      'Earthy grounds': { face: ':)', palette: ['#f0e6d8','#d1b38a','#a37a4a','#6b4b2b','#3b2a18'], rotate: false },
      'Golden shine': { face: 'o_o', palette: ['#fff3b0','#ffe066','#ffd400','#ffbf00','#e6ac00'], rotate: true },

      // NEW skins requested (other custom ones kept)
      'o~o':      { face: 'o~o', palette: ['#00d4ff','#00b0ff','#4dd0e1'], rotate: false },
      '⟁⨀⩊⨀⟁': { face: '⟁⨀⩊⨀⟁', palette: ['#0f9d58','#1b5e20','#2e7d32'], rotate: false },
      'chaser default': { face: '>:(', palette: ['#cc4444','#802222','#330000'], rotate: false },
      'UWU':      { face: 'UWU', palette: ['#000000','#000000'], rotate: false },
      ':P':       { face: ':P', palette: ['#bdbdbd','#9e9e9e','#757575'], rotate: true },
      ':|':       { face: ':|', palette: ['#d2b48c','#c2a77a','#b89a5a'], rotate: true },
      '^_^':      { face: '^_^', palette: ['#ffffff','#f8f9fa','#ffffff'], rotate: false },
      // '>:3' needs a black face with a mostly-black palette but include a random bright green tone for body color
      '>:3':      { face: '>:3', palette: (function(){ return ['#000000', Math.random() > 0.5 ? '#00ff00' : '#00aa00']; })(), rotate: true }
    };

    // Default skin values
    this._skin = 'p1 default';
    this.face = this._skins[this._skin].face;
    this.palette = this._skins[this._skin].palette.slice();
    this._skinRotate = !!this._skins[this._skin].rotate;
  }

  // allow external control of respawn position
  respawn(toX = null, toY = null) {
    // If coordinates provided, use them, otherwise use initial spawn
    this.x = (toX !== null) ? toX : this.initialX;
    this.y = (toY !== null) ? toY : this.initialY;
    // Reset velocities
    this.velocityX = 0;
    this.velocityY = 0;
    this.isJumping = false;
  }

  moveLeft() {
    this.velocityX = -this.speed;
  }

  moveRight() {
    this.velocityX = this.speed;
  }

  jump() {
    if (!this.isJumping) {
      // If gravity is inverted (negative), push the player downward in world coords
      // so the jump feels inverted (i.e., jumping with inverted gravity moves them down).
      if (typeof this.gravity === 'number' && this.gravity < 0) {
        this.velocityY = this.jumpForce;
      } else {
        this.velocityY = -this.jumpForce;
      }
      this.isJumping = true;
      return true;
    }
    return false;
  }

  update() {
    // Apply gravity
    this.velocityY += this.gravity;

    // Update position
    this.x += this.velocityX;
    this.y += this.velocityY;

    // Apply friction
    // apply configurable friction so modes (speedrun/snappy) can tune horizontal damping
    this.velocityX *= (typeof this.friction === 'number' ? this.friction : 0.9);

    // NOTE: falling/respawn checks moved to Game so respawn target can be used
  }

  // Axis-aligned vs possibly-rotated-rect collision test.
  // If the platform carries a `_spinAngle` property, we rotate the player's AABB into the platform's local (unrotated) frame
  // and perform a simple AABB overlap test. This keeps resolution cheap while letting spinning visuals have matching hitboxes.
  checkCollision(platform) {
    try {
      // fast path: axis-aligned platform
      if (typeof platform._spinAngle === 'undefined' || platform._spinAngle === 0) {
        return (
          this.x < platform.x + platform.width &&
          this.x + this.width > platform.x &&
          this.y < platform.y + platform.height &&
          this.y + this.height > platform.y
        );
      }

      // rotate player's center into platform space (inverse rotation)
      const angle = -platform._spinAngle;
      const px = this.x + this.width / 2;
      const py = this.y + this.height / 2;
      const cx = platform.x + platform.width / 2;
      const cy = platform.y + platform.height / 2;

      // translate to platform center
      const tx = px - cx;
      const ty = py - cy;
      // rotate by -angle
      const cos = Math.cos(angle), sin = Math.sin(angle);
      const rx = tx * cos - ty * sin;
      const ry = tx * sin + ty * cos;
      // map back to world coords in platform-aligned space
      const playerAlignedLeft = (rx + cx) - this.width / 2;
      const playerAlignedTop = (ry + cy) - this.height / 2;

      // axis-aligned overlap test against platform rect
      return (
        playerAlignedLeft < platform.x + platform.width &&
        playerAlignedLeft + this.width > platform.x &&
        playerAlignedTop < platform.y + platform.height &&
        playerAlignedTop + this.height > platform.y
      );
    } catch (e) {
      // fallback to safe axis-aligned check on error
      return (
        this.x < platform.x + platform.width &&
        this.x + this.width > platform.x &&
        this.y < platform.y + platform.height &&
        this.y + this.height > platform.y
      );
    }
  }

  handleCollision(platform) {
    try {
      // If platform not rotated, use previous axis-aligned resolution.
      if (typeof platform._spinAngle === 'undefined' || platform._spinAngle === 0) {
        // Calculate overlap on each axis
        const overlapX = Math.min(
          Math.abs((this.x + this.width) - platform.x),
          Math.abs(this.x - (platform.x + platform.width))
        );

        const overlapY = Math.min(
          Math.abs((this.y + this.height) - platform.y),
          Math.abs(this.y - (platform.y + platform.height))
        );

        // Resolve collision on axis with smallest overlap
        if (overlapX < overlapY) {
          // Horizontal collision
          if (this.x < platform.x) {
            this.x = platform.x - this.width;
          } else {
            this.x = platform.x + platform.width;
          }
          this.velocityX = 0;
        } else {
          // Vertical collision  
          if (this.y < platform.y) {
            this.y = platform.y - this.height;
            this.velocityY = 0;
            this.isJumping = false;
          } else {
            this.y = platform.y + platform.height;
            this.velocityY = 0;
          }
        }
        return;
      }

      // For rotated platforms: resolve by rotating player's center into platform-local (unrotated) frame,
      // compute minimal translation vector in that frame, then rotate the translation back and apply to player.
      const angle = -platform._spinAngle; // inverse rotation to platform-local
      const cos = Math.cos(angle), sin = Math.sin(angle);

      // player's center in world coords
      const pcx = this.x + this.width / 2;
      const pcy = this.y + this.height / 2;

      // platform center
      const cx = platform.x + platform.width / 2;
      const cy = platform.y + platform.height / 2;

      // translate center to platform origin then rotate to align with axis-aligned platform
      const tx = pcx - cx;
      const ty = pcy - cy;
      const rx = tx * cos - ty * sin;
      const ry = tx * sin + ty * cos;

      // compute player's AABB in platform-local coords
      const palLeft = rx - this.width / 2 + cx;
      const palTop = ry - this.height / 2 + cy;
      const palRight = palLeft + this.width;
      const palBottom = palTop + this.height;

      // platform rect in same coords is platform.x .. platform.x+width, platform.y .. platform.y+height

      // compute overlaps in platform-local coords
      const overlapLeft = palRight - platform.x;
      const overlapRight = (platform.x + platform.width) - palLeft;
      const overlapTop = palBottom - platform.y;
      const overlapBottom = (platform.y + platform.height) - palTop;

      // if any overlap is negative, there's no collision (shouldn't be called in that case)
      if (overlapLeft <= 0 || overlapRight <= 0 || overlapTop <= 0 || overlapBottom <= 0) return;

      // minimal translation distance and axis
      const minX = Math.min(overlapLeft, overlapRight);
      const minY = Math.min(overlapTop, overlapBottom);

      let moveX = 0, moveY = 0;
      if (minX < minY) {
        // resolve horizontally in platform-local frame
        if (overlapLeft < overlapRight) {
          // push player left in platform-local
          moveX = -minX;
        } else {
          // push player right
          moveX = minX;
        }
      } else {
        // resolve vertically in platform-local frame
        if (overlapTop < overlapBottom) {
          // push player up (toward negative y)
          moveY = -minY;
        } else {
          // push player down
          moveY = minY;
        }
      }

      // rotate the local translation back into world-space (apply platform rotation)
      const cosBack = Math.cos(platform._spinAngle);
      const sinBack = Math.sin(platform._spinAngle);
      const worldDx = moveX * cosBack - moveY * sinBack;
      const worldDy = moveX * sinBack + moveY * cosBack;

      // Apply translation to player's position (move player's top-left by computed delta)
      this.x += worldDx;
      this.y += worldDy;

      // If resolution had a vertical component (in platform-local), zero vertical velocity and clear jumping when pushing up
      if (Math.abs(moveY) > Math.abs(moveX)) {
        this.velocityY = 0;
        // if we were placed above the platform, consider landing
        if (moveY < 0) this.isJumping = false;
      } else {
        // horizontal resolution: stop horizontal velocity
        this.velocityX = 0;
      }
    } catch (e) {
      // fallback to axis-aligned behavior on error
      const overlapX = Math.min(
        Math.abs((this.x + this.width) - platform.x),
        Math.abs(this.x - (platform.x + platform.width))
      );

      const overlapY = Math.min(
        Math.abs((this.y + this.height) - platform.y),
        Math.abs(this.y - (platform.y + platform.height))
      );

      if (overlapX < overlapY) {
        if (this.x < platform.x) this.x = platform.x - this.width; else this.x = platform.x + platform.width;
        this.velocityX = 0;
      } else {
        if (this.y < platform.y) {
          this.y = platform.y - this.height;
          this.velocityY = 0;
          this.isJumping = false;
        } else {
          this.y = platform.y + platform.height;
          this.velocityY = 0;
        }
      }
    }
  }

  // Set skin by key; updates face, palette and rotation flag
  setSkin(name) {
    if (this._skins && this._skins[name]) {
      this._skin = name;
      const s = this._skins[name];
      this.face = s.face;
      this.palette = Array.isArray(s.palette) ? s.palette.slice() : ['#fff'];
      this._skinRotate = !!s.rotate;
    }
  }

  draw(ctx) {
    // If in ball visual mode, draw a circular rolling ball; otherwise draw the rounded rectangle with face.
    const gradWidth = Math.max(this.width, 120);
    const time = Date.now() * 0.002; // controls animation speed
    const gx = this.x - gradWidth + (Math.sin(time) * gradWidth * 0.5);

    // Build gradient from current palette
    const g = ctx.createLinearGradient(gx, this.y, gx + gradWidth * 2, this.y);
    const pal = Array.isArray(this.palette) && this.palette.length ? this.palette : ['#ff3b3b','#ff8a00','#ffd400','#4caf50','#2196f3','#9c27b0'];
    for (let i = 0; i < pal.length; i++) {
      const stop = i / Math.max(1, pal.length - 1);
      g.addColorStop(stop, pal[i]);
    }

    // Helper: draw centered text that is guaranteed to fit inside a bounding box (w,h) with optional rotation.
    const drawFittingText = (text, centerX, centerY, boxW, boxH, rotate = false) => {
      if (!text) return;
      // padding inside box so text doesn't touch edges
      const PAD = 6;
      // start with an estimated font size based on box height
      let fontSize = Math.floor(boxH * 0.55);
      fontSize = Math.max(8, fontSize);

      ctx.save();
      // Determine whether palette is dark — compute average luminance and choose white for dark palettes
      const computeFaceColorFromPalette = (palette) => {
        if (!Array.isArray(palette) || palette.length === 0) return '#000';
        let totalL = 0;
        for (const col of palette) {
          try {
            const h = (col || '#000').replace('#','');
            const bigint = parseInt(h.length === 3 ? h.split('').map(c=>c+c).join('') : h, 16);
            const r = (bigint >> 16) & 255;
            const g = (bigint >> 8) & 255;
            const b = bigint & 255;
            // relative luminance approximation (Rec. 709)
            const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            totalL += l;
          } catch (e) {
            totalL += 255;
          }
        }
        const avg = totalL / palette.length;
        // threshold: if average luminance below ~110 treat as dark -> use white text
        return (avg < 110) ? '#ffffff' : '#000000';
      };

      const faceColor = computeFaceColorFromPalette(this.palette);
      ctx.fillStyle = faceColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // reduce font until the measured width fits within boxW - PAD*2, or until fontSize minimal
      const maxWidth = Math.max(8, boxW - PAD * 2);
      while (fontSize >= 8) {
        ctx.font = `${fontSize}px Arial`;
        const metrics = ctx.measureText(text);
        const textWidth = metrics.width;
        // Also account for potential rotation which swaps width/height constraints:
        if (rotate) {
          // when rotated 90deg, width constraint becomes boxH; ensure textWidth fits within boxH - PAD*2
          if (textWidth <= Math.max(8, boxH - PAD * 2)) break;
        } else if (textWidth <= maxWidth) {
          break;
        }
        fontSize -= 1;
      }

      ctx.font = `${fontSize}px Arial`;

      if (rotate) {
        ctx.translate(centerX, centerY);
        ctx.rotate(Math.PI / 2);
        ctx.fillText(text, 0, 0);
      } else {
        ctx.fillText(text, centerX, centerY);
      }

      ctx.restore();
    };

    if (this.shape === 'ball') {
      // Draw circle centered in player's rectangle area
      ctx.save();
      const cx = this.x + this.width / 2;
      const cy = this.y + this.height / 2;
      const radius = Math.max(6, Math.min(this.width, this.height) / 2);
      ctx.beginPath();
      ctx.fillStyle = g;
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      // subtle glossy highlight
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(cx - radius * 0.35, cy - radius * 0.45, radius * 0.5, radius * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // face (no rotation for ball) - ensure it fits inside the circle diameter
      drawFittingText(this.face || ':)', cx, cy + 1, radius * 2, radius * 2, false);
      ctx.restore();
    } else {
      // Rounded-rectangle body
      ctx.save();
      const r = 6;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(this.x + r, this.y);
      ctx.lineTo(this.x + this.width - r, this.y);
      ctx.quadraticCurveTo(this.x + this.width, this.y, this.x + this.width, this.y + r);
      ctx.lineTo(this.x + this.width, this.y + this.height - r);
      ctx.quadraticCurveTo(this.x + this.width, this.y + this.height, this.x + this.width - r, this.y + this.height);
      ctx.lineTo(this.x + r, this.y + this.height);
      ctx.quadraticCurveTo(this.x, this.y + this.height, this.x, this.y + this.height - r);
      ctx.lineTo(this.x, this.y + r);
      ctx.quadraticCurveTo(this.x, this.y, this.x + r, this.y);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Draw face. Rotation depends on skin flag (_skinRotate)
      const faceX = this.x + this.width / 2;
      const faceY = this.y + this.height / 2 - 1;

      // Use helper to ensure the face fits inside the player's rectangle.
      drawFittingText(this.face || ':)', faceX, faceY, this.width, this.height, !!this._skinRotate);
    }
  }
}