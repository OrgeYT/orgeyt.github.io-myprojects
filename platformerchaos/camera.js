export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.scale = 1;

    // smoothing factor (0 = no movement, 1 = instant). Lower -> smoother/slower follow.
    this.smoothFactor = 0.12;

    // zoom limits
    this._minScale = 0.5;
    this._maxScale = 2.5;
    // zoom step multiplier per wheel tick (multiplicative for smooth feel)
    this._zoomStep = 1.08;
  }

  // simple linear interpolation helper
  _lerp(a, b, t) {
    return a + (b - a) * t;
  }

  update(target) {
    // Allow a temporary forced view size to be used (useful for split-screen rendering).
    // If set, this._forcedViewWidth/_forcedViewHeight will be used instead of window.innerWidth/innerHeight.
    const viewW = (typeof this._forcedViewWidth === 'number') ? this._forcedViewWidth : window.innerWidth;
    const viewH = (typeof this._forcedViewHeight === 'number') ? this._forcedViewHeight : window.innerHeight;

    // Support either a single target object {x,y,width,height} or an array of targets.
    // When an array is provided, compute the midpoint between all targets and center on that.
    let tx = 0, ty = 0, tw = 0, th = 0;
    if (Array.isArray(target) && target.length) {
      // compute bounds and center across all targets
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const t of target) {
        if (!t) continue;
        minX = Math.min(minX, t.x);
        minY = Math.min(minY, t.y);
        maxX = Math.max(maxX, t.x + (t.width || 0));
        maxY = Math.max(maxY, t.y + (t.height || 0));
      }
      // If any targets were valid, compute center from bounding box
      if (minX !== Infinity) {
        tx = (minX + maxX) / 2;
        ty = (minY + maxY) / 2;
        tw = Math.max(1, maxX - minX);
        th = Math.max(1, maxY - minY);
      } else {
        // fallback to origin
        tx = 0; ty = 0; tw = 1; th = 1;
      }
    } else if (target && typeof target === 'object') {
      tx = target.x + (target.width || 0) / 2;
      ty = target.y + (target.height || 0) / 2;
      tw = target.width || 1;
      th = target.height || 1;
    } else {
      // fallback: center screen
      tx = window.innerWidth / 2;
      ty = window.innerHeight / 2;
      tw = 1; th = 1;
    }

    // Compute desired camera offset to center the computed center point.
    // Use the local view width/height (which may be forced for split-screen) instead of window.innerWidth/innerHeight.
    const desiredX = -tx + (viewW / 2) - (tw / 2);
    const desiredY = -ty + (viewH / 2) - (th / 2);

    // Smoothly interpolate current camera position toward desired position
    this.x = this._lerp(this.x, desiredX, this.smoothFactor);
    this.y = this._lerp(this.y, desiredY, this.smoothFactor);
  }

  // Change zoom by a multiplicative factor, optionally keeping center point stable (worldX/worldY in screen coords)
  zoomBy(factor, anchorScreenX = null, anchorScreenY = null) {
    const oldScale = this.scale;
    let newScale = oldScale * factor;
    newScale = Math.max(this._minScale, Math.min(this._maxScale, newScale));
    if (newScale === oldScale) return;

    // If an anchor point provided (client/screen coords), adjust camera.x/y so that the world point under the cursor remains fixed.
    if (anchorScreenX !== null && anchorScreenY !== null) {
      // Convert screen coords to world coords before zoom
      const viewW = window.innerWidth;
      const viewH = window.innerHeight;
      // world coords considering current transforms
      const worldBeforeX = (anchorScreenX - viewW / 2) / oldScale + viewW / 2 - this.x;
      const worldBeforeY = (anchorScreenY - viewH / 2) / oldScale + viewH / 2 - this.y;

      // After scale change, compute where that same world point would appear and shift camera so it remains at the same screen pos
      const worldAfterX = (anchorScreenX - viewW / 2) / newScale + viewW / 2 - this.x;
      const worldAfterY = (anchorScreenY - viewH / 2) / newScale + viewH / 2 - this.y;

      // The difference (worldAfter - worldBefore) is in screen-space units, convert to camera translation
      const dx = (worldAfterX - worldBeforeX);
      const dy = (worldAfterY - worldBeforeY);

      // Adjust camera translation to compensate so visual anchor stays put
      this.x += dx;
      this.y += dy;
    }

    this.scale = newScale;
  }

  setScale(s) {
    this.scale = Math.max(this._minScale, Math.min(this._maxScale, s));
  }

  apply(ctx, viewWidth = window.innerWidth, viewHeight = window.innerHeight) {
    // Center drawing, apply scale, then translate so player is centered on screen
    // Accept view width/height so camera stays correct when canvas size changes
    ctx.translate(viewWidth / 2, viewHeight / 2);
    ctx.scale(this.scale, this.scale);
    ctx.translate(-viewWidth / 2 + this.x, -viewHeight / 2 + this.y);
  }
}