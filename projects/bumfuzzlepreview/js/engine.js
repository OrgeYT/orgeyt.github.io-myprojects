 // parsing and Character class
export function parseXML(xmlString) {
  const frames = {};
  const regex = /<SubTexture\s+name="([A-Za-z]+)(\d+)"\s+x="(\d+)"\s+y="(\d+)"\s+width="(\d+)"\s+height="(\d+)"/g;
  let match;
  while ((match = regex.exec(xmlString)) !== null) {
    let animName = match[1].toLowerCase().replace(/^(bf|gf)/, '');
    const frameData = {
      x: parseInt(match[3], 10),
      y: parseInt(match[4], 10),
      w: parseInt(match[5], 10),
      h: parseInt(match[6], 10)
    };
    if (!frames[animName]) frames[animName] = [];
    frames[animName].push(frameData);
  }
  return frames;
}

export class Character {
  constructor(image, framesMap, scale = 1, flipX = false) {
    this.img = image;
    this.frames = framesMap;
    this.scale = scale;
    this.flipX = flipX;

    this.x = 0;
    this.y = 0;

    this.currentAnim = 'idle';
    this.frameIndex = 0;
    this.frameTimer = 0;
    this.fps = 24;

    this.singDuration = 0;

    // whether the current animation should loop; default false so animations stop on last frame
    this.looping = false;
  }

  // added loop parameter: play(animName, force=false, loop=false)
  play(animName, force = false, loop = false) {
    if (!this.frames[animName]) animName = Object.keys(this.frames)[0];
    if (this.currentAnim === animName && !force) return;
    this.currentAnim = animName;
    this.frameIndex = 0;
    this.frameTimer = 0;
    this.looping = !!loop;
  }

  update(dt) {
    if (this.singDuration > 0) this.singDuration -= dt;
    const frameList = this.frames[this.currentAnim];
    if (!frameList) return;
    this.frameTimer += dt;
    const frameDuration = 1000 / this.fps;
    while (this.frameTimer >= frameDuration) {
      this.frameTimer -= frameDuration;
      this.frameIndex++;
      // if looping enabled, wrap; otherwise clamp to last frame and stop advancing
      if (this.frameIndex >= frameList.length) {
        if (this.looping) {
          this.frameIndex = 0;
        } else {
          this.frameIndex = frameList.length - 1;
          // stop consuming further frames by zeroing frameTimer to avoid large drift
          this.frameTimer = 0;
          break;
        }
      }
    }
  }

  draw(ctx) {
    const frameList = this.frames[this.currentAnim];
    if (!frameList || frameList.length === 0) return;
    const frame = frameList[Math.min(this.frameIndex, frameList.length - 1)];
    ctx.save();
    const drawW = frame.w * this.scale;
    const drawH = frame.h * this.scale;
    ctx.translate(this.x, this.y);
    if (this.flipX) ctx.scale(-1, 1);
    ctx.drawImage(this.img, frame.x, frame.y, frame.w, frame.h, -drawW / 2, -drawH, drawW, drawH);
    ctx.restore();
  }
}