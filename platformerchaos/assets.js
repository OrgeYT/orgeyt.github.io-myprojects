/*
  assets.js
  Centralized registry of project asset paths. Exposes window.ASSETS and default export.
  Other modules can reference window.ASSETS.<key> or import default to access the paths.
*/

const ASSETS = {
  audio: {
    littleRunmo: 'Little Runmo.mp3',
    placeBlock: 'Place block.mp3',
    hurt: 'Hurt.mp3',
    win: 'Win.mp3',
    jump: 'Jump.mp3',
    jumpAlt: 'Jump (mp3cut.net).mp3',
    checkpoint: 'Checkpoint (mp3cut.net).mp3',
    checkpointAlt: 'Checkpoint (34).mp3',
    background: 'Backgroundmusic.mp3',
    vvvvvv: 'VVVVVV_ Passion for Exploring (Indie Game Music HD).mp3',
    coincollect: 'coincollect.mp3',
    // any other mp3 assets can be added here
  },
  images: {
    smileyFaceAndGreenSquares: 'Screenshot 2026-03-07 1.20.17 PM.png',
    platformerScreenshot: 'Screenshot 2026-03-07 173627.png',
    coinsSpriteSheet: 'coinspritesheet.png',
    coinGif: 'coin.gif'
  },
  soundEffects: {
    placeBlock: 'Place block.mp3',
    changeBlockColor: 'Change block color.mp3'
  },
  scripts: {
    threeMode: 'threeMode.js',
    camera: 'camera.js',
    player: 'player.js',
    shop: 'shop.js',
    touchControls: 'touchControls.js',
    platform: 'platform.js',
    map: 'map.js',
    game: 'game.js'
  }
};

// Expose globally for easy access from legacy code that expects window globals.
window.ASSETS = window.ASSETS || {};
Object.assign(window.ASSETS, ASSETS);

export default ASSETS;