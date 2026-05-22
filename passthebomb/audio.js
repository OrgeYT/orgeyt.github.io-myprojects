/*
Audio helper module - handles AudioContext and preloading SFX into buffers
*/
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const audioBuffers = {};

export function ensureAudioStarted(){
  if(audioCtx.state === 'suspended'){
    audioCtx.resume().catch(()=>{});
  }
}
['pointerdown','keydown','touchstart'].forEach(ev=>addEventListener(ev, ensureAudioStarted, {once:true}));

export async function loadAllSfx(map){
  const entries = Object.entries(map);
  await Promise.all(entries.map(async ([k,url])=>{
    try{
      const res = await fetch(url);
      const ab = await res.arrayBuffer();
      const buf = await audioCtx.decodeAudioData(ab);
      audioBuffers[k] = buf;
    }catch(e){
      console.warn('Failed to load sfx', k, url, e);
    }
  }));
}

/*
  playSound(tokenOrAudio, volume)
  - tokenOrAudio: string key previously loaded via loadAllSfx (preferred) OR an HTMLAudio-like element
  - volume: number 0..1 (default 1). When using token key, a GainNode is created per-play to set volume.
*/
export function playSound(tokenOrAudio, volume = 1){
  try{ ensureAudioStarted(); }catch(e){}

  // if caller passed a string key that matches a decoded AudioBuffer
  if(typeof tokenOrAudio === 'string'){
    const buf = audioBuffers[tokenOrAudio];
    if(!buf) return;
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    // create gain node to control per-sound volume
    const gain = audioCtx.createGain();
    gain.gain.value = typeof volume === 'number' ? Math.max(0, Math.min(1, volume)) : 1;
    src.connect(gain);
    gain.connect(audioCtx.destination);
    src.start(0);
    return;
  }

  // legacy: if an HTMLAudio element was passed, try to play it directly (kept for compatibility)
  try{
    if(tokenOrAudio && typeof tokenOrAudio.currentTime === 'number'){
      tokenOrAudio.volume = typeof volume === 'number' ? Math.max(0, Math.min(1, volume)) : 1;
      tokenOrAudio.currentTime = 0;
      tokenOrAudio.play().catch(()=>{});
      return;
    }
  }catch(e){}
}