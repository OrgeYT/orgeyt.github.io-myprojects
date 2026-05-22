/*
Sprite manager module - initializes the modal and exposes mgrStore and spriteImgs.
This was split from main.js to separate editor UI from gameplay logic.
*/
export const spriteImgs = {
  idle: new Image(),
  idle_bomb: new Image(),
  jump: new Image(),
  fall: new Image(),
  down: new Image(),
  down_bomb: new Image(),
  jump_bomb: new Image(),
  fall_bomb: new Image(),
  give_bomb: new Image(),
  getting_bomb: new Image(),
  exploded: new Image()
};
spriteImgs.idle.src = '/Idle_move.png';
spriteImgs.idle_bomb.src = '/Idle_move has bomb.png';
spriteImgs.jump.src = '/Jump.png';
spriteImgs.fall.src = '/Fall.png';
spriteImgs.down.src = '/Down key.png';
spriteImgs.fall_bomb.src = '/Fall has bomb.png';
spriteImgs.down_bomb.src = '/down key has bomb.png';
spriteImgs.jump_bomb.src = '/Jump has bomb.png';
spriteImgs.give_bomb.src = '/give bomb.png';
spriteImgs.getting_bomb.src = '/getting bomb.png';
spriteImgs.exploded.src = '/Exploded.png';

export const mgrStore = {}; // populated with defaults on init

export function initSpriteManager(){
  // recreate minimal sprite manager UI bindings from original main.js but keep the heavy logic local to manager
  const spriteMgrBtn = document.getElementById('spriteMgrBtn');
  if(!spriteMgrBtn) return;
  spriteMgrBtn.addEventListener('click', ()=>{
    // open a compact manager (reuse existing modal created by game.js path if present)
    // For simplicity we rely on the existing manager in DOM if present; otherwise we create a lightweight prompt to export/import.
    try {
      const modal = document.getElementById('spriteMgrModal');
      if(modal) modal.classList.add('active');
    } catch(e){}
  });

  // load preset defaults
  const presetMgrStore = {
    "idle": { "offset": { "x": 0.24777231499029995, "y": 4.277936987157773 }, "scale": 0.4343539466154037, "flip": false },
    "idle_bomb": { "offset": { "x": -3.3722023049332392, "y": 3.7541378960545444 }, "scale": 0.41675854774259313, "flip": false },
    "jump": { "offset": { "x": 0.2990702045517253, "y": 5.1575341753947725 }, "scale": 0.4328594936976954, "flip": false },
    "fall": { "offset": { "x": 0.6998661928877254, "y": 7.568215707864994 }, "scale": 0.43609669129029255, "flip": false },
    "down": { "offset": { "x": 0.024336618795530285, "y": 1.6907859257037217 }, "scale": 0.3968754949172493, "flip": false },
    "down_bomb": { "offset": { "x": 0.6176954475581624, "y": 4.968219316479292 }, "scale": 0.38294777127911384, "flip": false },
    "jump_bomb": { "offset": { "x": -9.70212891045827, "y": 7.673139547486471 }, "scale": 0.409434029866726, "flip": false },
    "fall_bomb": { "offset": { "x": -12.221157897823986, "y": 5.939561764577462 }, "scale": 0.4218856739019693, "flip": false },
    "give_bomb": { "offset": { "x": 8.025723250681096, "y": 0.4687420937715956 }, "scale": 0.3977248108960914, "flip": false },
    "getting_bomb": { "offset": { "x": 7.050594431348713, "y": 1.5178356355753806 }, "scale": 0.4054846476884287, "flip": false },
    "exploded": { "offset": { "x": 3.8055232010764257, "y": 9.267103112204637 }, "scale": 0.39264761313406066, "flip": false }
  };
  for(const k of Object.keys(spriteImgs)){
    if(presetMgrStore[k]) mgrStore[k] = { offset:{x: presetMgrStore[k].offset.x, y: presetMgrStore[k].offset.y}, scale: presetMgrStore[k].scale, flip: !!presetMgrStore[k].flip };
    else mgrStore[k] = { offset:{x:0,y:0}, scale:1, flip:false };
  }
}