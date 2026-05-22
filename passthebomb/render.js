/*
Render module: accepts scene state and draws to the canvas.
Extracted from main.js render() to keep rendering concerns separate.
*/
export function syncCanvasSize(canvas){
  const W = innerWidth, H = innerHeight;
  canvas.width = W * devicePixelRatio;
  canvas.height = H * devicePixelRatio;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
}

// helper to pick a canvas font string that respects the pixel-font toggle.
// When pixel-font is enabled we use the Jersey15 face, slightly scale up sizes,
// and avoid bold weights so text appears crisp for the pixel font.
export function getCanvasFont(sizePx){
  try{
    const enabled = !!(window && window.pixelFontEnabled);
    if(enabled){
      // scale pixel-font up a bit for readability on canvas and avoid bold
      const scaled = Math.round(sizePx * 1.28);
      return `${scaled}px Jersey15, system-ui, Arial`;
    }
  }catch(e){}
  // default fallback
  return `${sizePx}px system-ui,Arial`;
}

export function renderAll(opts){
  const { ctx, canvas, players, platforms, explosions, passAnimations, camX, camY, W, H, worldW, bombTimer, spriteImgs, mgrStore, user } = opts;

  // Reset transform and fully clear the backing buffer in device pixels
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // now set the device-pixel transform for rendering
  ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);

  ctx.save();
  ctx.translate(-Math.round(camX), -Math.round(camY));

  // optimized hat recoloring: reuse hat image cache, single temp canvas for color parsing, and cache parsed colors
  const _hatCache = renderAll._hatCache || (renderAll._hatCache = {});
  const _tintedHatCache = renderAll._tintedHatCache || (renderAll._tintedHatCache = {});
  const _hatColorCache = renderAll._hatColorCache || (renderAll._hatColorCache = {});
  // single shared tmp canvas for color parsing
  const _tinyCanvas = renderAll._tinyCanvas || (renderAll._tinyCanvas = (()=>{
    const c = document.createElement('canvas'); c.width = c.height = 1; return c;
  })());
  const _tinyCtx = _tinyCanvas.getContext('2d');

  function ensureHat(src){
    if(!src) return null;
    if(!_hatCache[src]){
      const im = new Image();
      im.crossOrigin = 'anonymous';
      im.src = src;
      _hatCache[src] = im;
    }
    return _hatCache[src];
  }

  function parseColor(css){
    if(!css) return {r:255,g:0,b:0,hex:'#ff0000'};
    if(_hatColorCache[css]) return _hatColorCache[css];
    try{
      _tinyCtx.clearRect(0,0,1,1);
      _tinyCtx.fillStyle = css;
      _tinyCtx.fillRect(0,0,1,1);
      const d = _tinyCtx.getImageData(0,0,1,1).data;
      const parsed = { r: d[0], g: d[1], b: d[2], hex: css };
      _hatColorCache[css] = parsed;
      return parsed;
    }catch(e){
      return {r:255,g:0,b:0,hex:'#ff0000'};
    }
  }

  // helpers to nudge color saturation to max (used so hat recolors are vivid)
  function rgbToHsl(r,g,b){
    r/=255; g/=255; b/=255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    let h=0, s=0, l=(max+min)/2;
    if(max !== min){
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch(max){
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return {h: h*360, s: s*100, l: l*100};
  }
  function hslToHex(h,s,l){
    s/=100; l/=100;
    const k = n => {
      const a = (n + h/30) % 12;
      const c = l - s * Math.min(l, 1 - l) * Math.max(Math.min(a - 3, 9 - a, 1), -1);
      return Math.round(255 * c);
    };
    const r = k(0), g = k(8), b = k(4);
    return '#' + [r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('');
  }

  function tintRedToColor(img, color){
    if(!img || !img.complete) return null;
    const parsed = parseColor(color || '#ff0000');
    // normalize to vivid color and cache the normalized hex
    let normHex = _hatColorCache['norm|' + parsed.hex];
    if(!normHex){
      const rgb = parsed;
      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
      hsl.s = 100;
      if(hsl.l < 45) hsl.l = 65;
      normHex = hslToHex(hsl.h, hsl.s, hsl.l);
      _hatColorCache['norm|' + parsed.hex] = normHex;
    }
    const key = img.src + '|' + normHex;
    if(_tintedHatCache[key]) return _tintedHatCache[key];

    // reuse base canvas for image pixels if available
    let baseKey = img.src + '|base';
    let base = _tintedHatCache[baseKey];
    if(!base){
      base = document.createElement('canvas');
      base.width = img.width; base.height = img.height;
      const bx = base.getContext('2d');
      bx.drawImage(img,0,0);
      _tintedHatCache[baseKey] = base;
    }
    // create result canvas and copy base into it
    const off = document.createElement('canvas');
    off.width = base.width; off.height = base.height;
    const ox = off.getContext('2d');
    ox.drawImage(base,0,0);

    let data;
    try {
      data = ox.getImageData(0,0,off.width,off.height);
    } catch(e){
      // cross-origin fallback: cache and return base to avoid repeated attempts
      _tintedHatCache[key] = base;
      return base;
    }

    const cols = parseColor(normHex);
    for(let i=0;i<data.data.length;i+=4){
      const r = data.data[i], g = data.data[i+1], b = data.data[i+2], a = data.data[i+3];
      if(a < 16) continue;
      if(r > g + 20 && r > b + 20){
        const lum = (0.2126*r + 0.7152*g + 0.0722*b)/255;
        data.data[i]   = Math.min(255, Math.round(cols.r * lum));
        data.data[i+1] = Math.min(255, Math.round(cols.g * lum));
        data.data[i+2] = Math.min(255, Math.round(cols.b * lum));
      }
    }
    ox.putImageData(data,0,0);
    _tintedHatCache[key] = off;
    return off;
  }

  // background simple fill to avoid heavy image dependency in renderer module
  ctx.fillStyle = '#0b1220';
  ctx.fillRect(0,0,W,H);

  for(const plat of platforms){
    const isGround = plat.h > 40;
    if(isGround){ ctx.fillStyle = '#2f8e2f'; ctx.fillRect(plat.x, plat.y, plat.w, plat.h); ctx.fillStyle = '#267426'; ctx.fillRect(plat.x, plat.y + plat.h - 8, plat.w, 8); }
    else { ctx.fillStyle = '#a3a7ab'; ctx.fillRect(plat.x, plat.y, plat.w, plat.h); ctx.fillStyle = '#8f9396'; ctx.fillRect(plat.x, plat.y + plat.h - 6, plat.w, 6); }

    const studSize = Math.min(14, Math.floor(plat.h * 0.9) + 4);
    const studGap = studSize + 8;
    const startX = plat.x + 8;
    const endX = plat.x + plat.w - 8 - studSize;
    let sx = startX;
    const studY = Math.max(plat.y - Math.floor(studSize * 0.8), plat.y - studSize);
    while(sx <= endX){
      if(isGround) ctx.fillStyle = '#3aa33a'; else ctx.fillStyle = '#c9cbcd';
      ctx.fillRect(sx, studY, studSize, studSize);
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx + 0.5, studY + 0.5, studSize - 1, studSize - 1);
      sx += studGap;
    }
  }

  // lightweight player rendering using tinted sprites if available
  for(const p of players){
    if(!p.alive) continue;
    let baseImg = spriteImgs.idle;
    if(p.isGiving && spriteImgs.give_bomb && spriteImgs.give_bomb.complete) baseImg = spriteImgs.give_bomb;
    else if(p.isGetting && spriteImgs.getting_bomb && spriteImgs.getting_bomb.complete) baseImg = spriteImgs.getting_bomb;
    else if(p.hasBomb && spriteImgs.idle_bomb && spriteImgs.idle_bomb.complete) baseImg = spriteImgs.idle_bomb;
    else baseImg = spriteImgs.idle;

    // simple placeholder if images aren't loaded yet
    if(!baseImg || !baseImg.complete){
      ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.w, p.h);
    } else {
      // attempt to tint using simple offscreen canvas (reuse approach from original main.js)
      const off = document.createElement('canvas');
      off.width = baseImg.width; off.height = baseImg.height;
      const ox = off.getContext('2d');
      ox.drawImage(baseImg,0,0);
      ctx.drawImage(off, p.x - (off.width - p.w)/2, p.y - (off.height - p.h), off.width * 0.5, off.height * 0.5);
    }

    if(p.hasBomb){
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,0,0,0.5)';
      ctx.strokeRect(p.x - 3, p.y - 3, p.w + 6, p.h + 6);
    }

    // draw hat if assigned: load image, recolor red areas to player color, and draw above head
    if(p.hat){
      try{
        const hatImg = ensureHat(p.hat);
        if(hatImg && hatImg.complete){
          // prefer hat recolor color specified on the player (p.hatColor), fallback to player color
          const recolorTarget = (p.hatColor && typeof p.hatColor === 'string') ? p.hatColor : p.color;
          const t = tintRedToColor(hatImg, recolorTarget) || hatImg;
          const hatW = Math.min(56, p.w * 1.4, t.width * 0.6);
          const hatH = (t.height / t.width) * hatW;
          // position above head with slight offset
          const hx = p.x + p.w/2 - hatW/2;
          const hy = p.y - hatH - 6;
          ctx.drawImage(t, hx, hy, hatW, hatH);
        }
      }catch(e){}
    }

    // append a small tag for NPC type (PRO / NOOB / AVG) for non-user players
    let label = p.isUser ? (window.myUsername ? window.myUsername.toUpperCase() : 'YOU') : p.name;
    if(!p.isUser){
      const typeTag = (p.npcType === 'pro' ? 'PRO' : (p.npcType === 'noob' ? 'NOOB' : 'AVG'));
      label = `${label} [${typeTag}]`;
    }
    ctx.fillStyle = '#0008';
    const labelW = Math.max(p.w, Math.min(180, 8 + ctx.measureText(label).width));
    ctx.fillRect(p.x + p.w/2 - labelW/2, p.y-18, labelW, 14);
    ctx.fillStyle = '#fff';
    ctx.font = getCanvasFont(11);
    ctx.textAlign = 'center';
    ctx.fillText(label, p.x + p.w/2, p.y-7);

    const isAirborne = (p.vy < -220 || p.vy > 220);
    if(p.hasBomb && !isAirborne){
      const bx = p.x + p.w/2; const by = p.y - 18;
      ctx.beginPath(); ctx.fillStyle = '#0d1113'; ctx.arc(bx, by, 12, 0, Math.PI*2); ctx.fill();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '14px serif'; ctx.fillText('💣', bx, by+1);
      ctx.fillStyle = '#ff4b4b'; ctx.font = '11px system-ui,Arial'; ctx.fillText(Math.ceil(bombTimer), bx, by-2);
    }
  }

  // simple explosions
  for(let i = explosions.length - 1; i >= 0; i--){
    const e = explosions[i];
    e.t = (e.t || 0) + 0.016;
    const pT = Math.min(1, e.t / e.life);
    const maxR = 80; const r = maxR * (0.3 + pT*0.9);
    const alpha = Math.max(0, 1 - pT);
    const grad = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r);
    grad.addColorStop(0, `rgba(255,230,180,${0.95*alpha})`);
    grad.addColorStop(0.4, `rgba(255,120,80,${0.6*alpha})`);
    grad.addColorStop(1, `rgba(80,20,20,${0.08*alpha})`);
    ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(e.x,e.y,r,0,Math.PI*2); ctx.fill();
    for(const part of e.particles){
      part.vy += 700 * 0.016;
      part.x += part.vx * 0.016; part.y += part.vy * 0.016;
      const lifeFactor = Math.max(0, 1 - (e.t / e.life));
      ctx.globalAlpha = lifeFactor;
      ctx.fillStyle = part.color; ctx.beginPath(); ctx.arc(e.x + part.x, e.y + part.y, Math.max(1, part.r * lifeFactor), 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if(e.t >= e.life) explosions.splice(i,1);
  }

  // pass animations (simplified)
  for(let i = passAnimations.length - 1; i >= 0; i--){
    const trav = passAnimations[i];
    trav.t = (trav.t || 0) + 0.016;
    const tNorm = Math.min(1, trav.t / trav.life);
    const cx = trav.x0 + (trav.x1 - trav.x0) * tNorm;
    const baseY = trav.y0 + (trav.y1 - trav.y0) * tNorm;
    const cy = baseY - (Math.max(34, Math.min(120, 160 * (1 - Math.abs(0.5 - tNorm)))) * Math.sin(Math.PI * tNorm));
    ctx.save(); ctx.translate(cx, cy); ctx.beginPath(); ctx.fillStyle = '#0d1113'; ctx.arc(0,0,18,0,Math.PI*2); ctx.fill();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '22px serif'; ctx.fillText('💣', 0, 1);
    ctx.restore();
    if(trav.t >= trav.life){
      if(trav.toPlayer && trav.toPlayer.alive){ trav.toPlayer.hasBomb = true; trav.toPlayer.isGetting = false; }
      if(trav.fromPlayer) trav.fromPlayer.isGiving = false;
      passAnimations.splice(i,1);
    }
  }

  ctx.restore();

  ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
  ctx.fillStyle = 'rgba(255,255,255,0.02)';
  ctx.fillRect(W-160,10,150,44);
}