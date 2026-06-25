export class TouchControls {
  constructor() {
    this.buttonSize = 80;
    this.padding = 20;
    this.opacity = 0.3;
    
    this.leftPressed = false;
    this.rightPressed = false;
    this.jumpPressed = false;

    this.setupTouchEvents();
  }

  setupTouchEvents() {
    document.addEventListener('touchstart', (e) => {
      const touches = e.touches;
      for (let i = 0; i < touches.length; i++) {
        const touch = touches[i];
        this.handleTouch(touch.clientX, touch.clientY, true);
      }
    });

    document.addEventListener('touchmove', (e) => {
      // Reset all buttons
      this.leftPressed = false;
      this.rightPressed = false;
      this.jumpPressed = false;
      
      // Check all current touches
      const touches = e.touches;
      for (let i = 0; i < touches.length; i++) {
        const touch = touches[i];
        this.handleTouch(touch.clientX, touch.clientY, true);
      }
    });

    document.addEventListener('touchend', () => {
      this.leftPressed = false;
      this.rightPressed = false;
      this.jumpPressed = false;
    });
  }

  handleTouch(x, y, isPress) {
    const leftBtn = this.getLeftButtonBounds();
    const rightBtn = this.getRightButtonBounds();
    const jumpBtn = this.getJumpButtonBounds();

    if (this.isPointInRect(x, y, leftBtn)) {
      this.leftPressed = isPress;
    }
    if (this.isPointInRect(x, y, rightBtn)) {
      this.rightPressed = isPress;
    }
    if (this.isPointInRect(x, y, jumpBtn)) {
      this.jumpPressed = isPress;
    }
  }

  isPointInRect(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.width &&
           y >= rect.y && y <= rect.y + rect.height;
  }

  getLeftButtonBounds() {
    return {
      x: this.padding,
      y: window.innerHeight - this.buttonSize - this.padding,
      width: this.buttonSize,
      height: this.buttonSize
    };
  }

  getRightButtonBounds() {
    return {
      x: this.padding + this.buttonSize + this.padding,
      y: window.innerHeight - this.buttonSize - this.padding,
      width: this.buttonSize,
      height: this.buttonSize
    };
  }

  getJumpButtonBounds() {
    return {
      x: window.innerWidth - this.buttonSize - this.padding,
      y: window.innerHeight - this.buttonSize - this.padding,
      width: this.buttonSize,
      height: this.buttonSize
    };
  }

  getInput() {
    return {
      left: this.leftPressed,
      right: this.rightPressed,
      jump: this.jumpPressed
    };
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.opacity;

    // Draw movement buttons
    const leftBtn = this.getLeftButtonBounds();
    const rightBtn = this.getRightButtonBounds();
    const jumpBtn = this.getJumpButtonBounds();

    // Left button
    ctx.fillStyle = this.leftPressed ? '#666' : '#888';
    ctx.fillRect(leftBtn.x, leftBtn.y, leftBtn.width, leftBtn.height);
    ctx.fillStyle = '#fff';
    ctx.font = '24px Arial';
    ctx.fillText('←', leftBtn.x + 30, leftBtn.y + 50);

    // Right button
    ctx.fillStyle = this.rightPressed ? '#666' : '#888';
    ctx.fillRect(rightBtn.x, rightBtn.y, rightBtn.width, rightBtn.height);
    ctx.fillStyle = '#fff';
    ctx.font = '24px Arial';
    ctx.fillText('→', rightBtn.x + 30, rightBtn.y + 50);

    // Jump button
    ctx.fillStyle = this.jumpPressed ? '#666' : '#888';
    ctx.fillRect(jumpBtn.x, jumpBtn.y, jumpBtn.width, jumpBtn.height);
    ctx.fillStyle = '#fff';
    ctx.font = '24px Arial';
    ctx.fillText('↑', jumpBtn.x + 30, jumpBtn.y + 50);

    ctx.restore();
  }
}