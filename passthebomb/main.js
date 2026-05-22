/*
Pass The Bomb - improved NPC platform usage, camera follow, and safety teleport.
One-screen experience. Touch buttons to move/jump.
Bomb passes on collision between players. NPCs use platforms to dodge or chase.
*/

import { NPC_NAMES } from './npcnames.js';
import { npcMessages } from './npcchatmessages.js';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

/*
Audio loading/performance:
Use WebAudio (AudioContext + decoded AudioBuffer) and createBufferSource each play so effects
play immediately and can overlap without the HTMLAudio playback delays some devices exhibit.
*/
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const audioBuffers = {}; // map name -> AudioBuffer

// helper to load and decode an audio file
async function loadAudioBuffer(name, url){
  try{
    const res = await fetch(url);
    const ab = await res.arrayBuffer();
    const buf = await audioCtx.decodeAudioData(ab);
    audioBuffers[name] = buf;
  }catch(e){
    console.warn('Failed to load audio', name, url, e);
  }
}

 // kick off loading of all sfx
 loadAudioBuffer('jump', '/freesound_community-cartoon-jump-6462.mp3');
 loadAudioBuffer('land', '/freesound_community-land2-43790.mp3');
 loadAudioBuffer('explode', '/freesound_community-medium-explosion-40472.mp3');
 loadAudioBuffer('win', '/scratchonix-victory-chime-366449.mp3');
 // countdown tick SFX played each time the displayed bomb second drops
 loadAudioBuffer('countdown', '/countdownbomb.mp3');

 // background music loader (attempt requested track, fallback if missing) - plays on first user interaction
 let bgAudio = null;
 let _bgStarted = false;

 async function createBgAudio(preferredPath = '/Quick, Pass that bomb.mp3'){
   // try to fetch the preferred file first so we avoid creating an HTMLAudio that 404s
   try{
     const res = await fetch(preferredPath, { method: 'HEAD' });
     if(!res.ok) throw new Error('not found');
     const a = new Audio(preferredPath);
     a.loop = true;
     a.preload = 'auto';
     a.volume = 0.55;
     a.muted = false;
     return a;
   }catch(e){
     // fallback to an available bundled clip (use the short chime as a loop fallback)
     // this ensures something will play even if the preferred music is missing.
     try{
       const fallback = new Audio('/scratchonix-victory-chime-366449.mp3');
       fallback.loop = true;
       fallback.preload = 'auto';
       fallback.volume = 0.48;
       fallback.muted = false;
       return fallback;
     }catch(err){
       return null;
     }
   }
 }

 async function startBgMusic(){
   if(_bgStarted) return;
   _bgStarted = true;
   try{
     if(!bgAudio){
       bgAudio = await createBgAudio();
     }
     if(bgAudio){
       // ensure AudioContext resumed for browsers requiring it
       try{ await audioCtx && audioCtx.resume && audioCtx.resume(); }catch(e){}
       await bgAudio.play().catch(()=>{ /* ignore play failures */ });
     }
   }catch(e){}
 }

 // start music on first user gesture (best-effort)
 ['pointerdown','keydown','touchstart'].forEach(ev=>{
   addEventListener(ev, ()=>{ try{ startBgMusic(); }catch(e){} }, {once:true});
 });

// named sound tokens used throughout the code (map to the AudioBuffer keys)
const sndJump = 'jump';
const sndLand = 'land';
const sndExplode = 'explode';
const sndWin = 'win';

// resume AudioContext on first user interaction to satisfy browser autoplay policies
function ensureAudioStarted(){
  if(audioCtx.state === 'suspended'){
    audioCtx.resume().catch(()=>{});
  }
}
['pointerdown','keydown','touchstart'].forEach(ev=>addEventListener(ev, ensureAudioStarted, {once:true}));

// playSound now accepts either a name string (preferred) or falls back to an HTMLAudio-like object
function playSound(a, volume = 1){
  try{
    ensureAudioStarted();
  }catch(e){}

  // helper to perform a jump with unified behavior (consumes jumpsLeft, sets vy and plays SFX)
  function tryJump(p, strength = 480, vol = 1){
    if(!p) return;
    if(typeof p.jumpsLeft !== 'number') p.jumpsLeft = MAX_JUMPS;
    if(p.jumpsLeft > 0){
      p.vy = -strength;
      p.onGround = false;
      p.jumpsLeft = Math.max(0, p.jumpsLeft - 1);
      // play jump SFX via existing shim below (we call playSound after defining it)
      try{ playSound(sndJump, vol); }catch(e){}
    }
  }

  // if caller passed an AudioBuffer name (string)
  if(typeof a === 'string'){
    const buf = audioBuffers[a];
    if(!buf) return;
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    // create gain node to allow per-sound volume control
    const gain = audioCtx.createGain();
    gain.gain.value = typeof volume === 'number' ? Math.max(0, Math.min(1, volume)) : 1;
    src.connect(gain);
    gain.connect(audioCtx.destination);
    src.start(0);
    return;
  }

  // legacy: if an HTMLAudio element was passed, try to play it directly (kept for compatibility)
  try{
    if(a && typeof a.currentTime === 'number'){
      a.volume = typeof volume === 'number' ? Math.max(0, Math.min(1, volume)) : 1;
      a.currentTime = 0;
      a.play().catch(()=>{});
      return;
    }
  }catch(e){}
}

 // try to read a local Websim username (non-networked use of the API)
 // This will not make the game truly multiplayer — it just reads your local client username to label your player.
 let websimRoom = null;
 // feature flag: true when Websim successfully initialized; used to gate watch/multiplayer features
 window.websimAvailable = false;
 let myUsername = 'You'; // fallback

 (async function tryInitWebsim(){
   try{
     if(typeof WebsimSocket !== 'undefined'){
       websimRoom = new WebsimSocket();
       await websimRoom.initialize();
       const me = websimRoom.peers[websimRoom.clientId];
       if(me && me.username) myUsername = me.username;

       // Immediately publish an initial presence snapshot for watchers (include platforms)
       try {
         websimRoom.updatePresence({
           name: myUsername || 'Player',
           gameState: gameState,
           bombTimer: bombTimer,
           hasBomb: !!(user && user.hasBomb),
           aliveCount: players.filter(p=>p.alive).length,
           // include a compact players snapshot so watchers can render a mini-preview
           players: players.map(p => ({ id: p.id, name: p.name, alive: !!p.alive, x: p.x, y: p.y, hasBomb: !!p.hasBomb, isUser: !!p.isUser })),
           // include simplified platform geometry for preview rendering
           platforms: platforms.map(pl => ({ x: pl.x, y: pl.y, w: pl.w, h: pl.h })),
           playerCount: players.length,
           worldW: worldW,
           worldH: H,
           chatText: (user && user.chatText) ? user.chatText : ''
         });
       } catch(e){ /* ignore if updatePresence not available yet */ }

       // respond to explicit snapshot requests from other clients
       try {
         websimRoom.subscribePresenceUpdateRequests((updateRequest, fromClientId) => {
           if(updateRequest && updateRequest.type === 'requestSnapshot'){
             try {
               websimRoom.updatePresence({
                 name: myUsername || 'Player',
                 gameState: gameState,
                 bombTimer: bombTimer,
                 hasBomb: !!(user && user.hasBomb),
                 aliveCount: players.filter(p=>p.alive).length,
                 // small players snapshot (id, name, alive) to help remote viewer know counts
                 players: players.map(p => ({ id: p.id, name: p.name, alive: !!p.alive, hasBomb: !!p.hasBomb })),
                 chatText: (user && user.chatText) ? user.chatText : ''
               });
             } catch(e){}
           }
         });
       } catch(e){}

       // heartbeat: periodically update presence so watchers see live changes (include platforms)
       setInterval(()=>{
         try{
           websimRoom.updatePresence({
             name: myUsername || 'Player',
             gameState: gameState,
             bombTimer: bombTimer,
             hasBomb: !!(user && user.hasBomb),
             aliveCount: players.filter(p=>p.alive).length,
             // include live player snapshot to support mini preview and counts in watchers
             players: players.map(p => ({ id: p.id, name: p.name, alive: !!p.alive, x: p.x, y: p.y, hasBomb: !!p.hasBomb, isUser: !!p.isUser })),
             // include simplified platform geometry for preview rendering
             platforms: platforms.map(pl => ({ x: pl.x, y: pl.y, w: pl.w, h: pl.h })),
             playerCount: players.length,
             worldW: worldW,
             worldH: H,
             chatText: (user && user.chatText) ? user.chatText : ''
           });
         }catch(e){}
       }, 500); // 2 updates per second

       // Build Watch modal UI for viewing other players' presence/snapshots
       const watchBtn = document.getElementById('watchBtn');
       const watchModal = document.createElement('div');
       watchModal.id = 'watchModal';
       watchModal.style.position = 'fixed';
       watchModal.style.left = '50%';
       watchModal.style.top = '50%';
       watchModal.style.transform = 'translate(-50%,-50%)';
       watchModal.style.width = '84vw';
       watchModal.style.maxWidth = '720px';
       watchModal.style.maxHeight = '76vh';
       watchModal.style.background = 'var(--card)';
       watchModal.style.borderRadius = '12px';
       watchModal.style.boxShadow = '0 14px 40px rgba(0,0,0,0.6)';
       watchModal.style.display = 'none';
       watchModal.style.flexDirection = 'column';
       watchModal.style.zIndex = 120;
       watchModal.style.pointerEvents = 'auto';
       watchModal.innerHTML = `
         <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid rgba(0,0,0,0.06)">
           <h3 style="margin:0;font-size:16px;color:#111">Watch Player</h3>
           <div style="display:flex;gap:8px;align-items:center;">
             <button id="watchRefresh" style="padding:6px 8px;border-radius:8px;border:0;background:#10b981;color:#fff;cursor:pointer;">Refresh</button>
             <button id="watchClose" style="padding:6px 8px;border-radius:8px;border:0;background:#ef4444;color:#fff;cursor:pointer;">Close</button>
           </div>
         </div>
         <div style="display:flex;gap:12px;flex:1;overflow:hidden">
           <div id="watchList" style="width:260px;min-width:180px;max-width:280px;overflow:auto;padding:12px;background:rgba(0,0,0,0.03)"></div>
           <div id="watchViewer" style="flex:1;padding:12px;display:flex;flex-direction:column;gap:8px;align-items:stretch;justify-content:flex-start">
             <div id="watchHeader" style="font-weight:700;color:#111">Select a player to watch</div>
             <div id="watchContent" style="background:#fff;padding:12px;border-radius:8px;flex:1;overflow:auto;display:flex;align-items:center;justify-content:center;color:#333"></div>
           </div>
         </div>
       `;
       document.body.appendChild(watchModal);

       const watchList = watchModal.querySelector('#watchList');
       const watchContent = watchModal.querySelector('#watchContent');
       const watchHeader = watchModal.querySelector('#watchHeader');
       const watchClose = watchModal.querySelector('#watchClose');
       const watchRefresh = watchModal.querySelector('#watchRefresh');

       let watchedClientId = null;
       let presenceUnsub = null;

       function renderPeerRow(clientId, peer){
         const row = document.createElement('div');
         row.style.display = 'flex';
         row.style.alignItems = 'center';
         row.style.justifyContent = 'space-between';
         row.style.padding = '8px';
         row.style.borderRadius = '6px';
         row.style.cursor = 'pointer';
         row.style.marginBottom = '6px';
         row.style.background = 'rgba(255,255,255,0.02)';
         const name = document.createElement('div');
         name.textContent = peer.username || ('Player ' + clientId.slice(0,6));
         name.style.fontWeight = '700';
         name.style.color = '#111';
         const btn = document.createElement('button');
         btn.textContent = 'Watch';
         btn.style.padding = '6px 8px';
         btn.style.border = '0';
         btn.style.borderRadius = '6px';
         btn.style.background = '#2563eb';
         btn.style.color = '#fff';
         btn.onclick = (ev)=>{
           ev.stopPropagation();
           startWatching(clientId);
         };
         row.appendChild(name);
         row.appendChild(btn);
         row.addEventListener('click', ()=> startWatching(clientId));
         return row;
       }

       function refreshWatchList(){
         watchList.innerHTML = '';
         const peers = websimRoom && websimRoom.peers ? websimRoom.peers : {};
         // show local client first and then others
         const ids = Object.keys(peers).sort((a,b)=>{
           const na = peers[a] && peers[a].username ? peers[a].username.toLowerCase() : a;
           const nb = peers[b] && peers[b].username ? peers[b].username.toLowerCase() : b;
           return na.localeCompare(nb);
         });
         if(ids.length === 0){
           const t = document.createElement('div');
           t.textContent = 'No connected players found';
           t.style.color = '#666';
           watchList.appendChild(t);
           return;
         }
         for(const id of ids){
           const peer = peers[id];
           const row = renderPeerRow(id, peer);
           watchList.appendChild(row);
         }
       }

       function showViewerMessage(msg){
         watchHeader.textContent = watchedClientId ? (`Watching: ${watchedClientId}`) : 'Select a player to watch';
         watchContent.innerHTML = `<div style="color:#666;font-size:15px">${msg}</div>`;
       }

       function renderPresenceSnapshot(pres){
         // pres is arbitrary; we'll try to show common fields we expect: gameState, bombTimer, chat, players, etc
         if(!pres) { showViewerMessage('Player has no shared presence data.'); return; }

         // Build a richer snapshot card with a miniature live preview canvas
         // Note: even if a player is paused or not actively playing, we still render their mini-preview
         // but overlay a paused/not-ingame notice so watchers understand their state.
         const container = document.createElement('div');
         container.style.display = 'flex';
         container.style.flexDirection = 'column';
         container.style.gap = '8px';
         container.style.width = '100%';

         const head = document.createElement('div');
         head.style.display = 'flex';
         head.style.justifyContent = 'space-between';
         // show bomb timer in header and also show live connected player count if available
         const playerCountLabel = document.createElement('div');
         playerCountLabel.style.color = '#111';
         playerCountLabel.style.fontWeight = '700';
         // attempt to read live peers count from websimRoom when available
         const liveCount = (typeof websimRoom === 'object' && websimRoom.peers) ? Object.keys(websimRoom.peers).length : (pres.playerCount || (pres.players ? pres.players.length : 0));
         head.innerHTML = `<div style="font-weight:700">${pres.name || 'Player'}</div><div style="display:flex;gap:10px;align-items:center"><div style="color:#ff4b4b;font-weight:800">${typeof pres.bombTimer === 'number' ? Math.ceil(pres.bombTimer) : ''}</div><div style="font-size:13px;color:#555">Connected: <strong style="color:#111">${liveCount}</strong></div></div>`;
         container.appendChild(head);

         // chat snippet
         if(pres.chatText){
           const c = document.createElement('div');
           c.style.background = 'rgba(0,0,0,0.03)';
           c.style.padding = '8px';
           c.style.borderRadius = '6px';
           c.innerHTML = `<div style="font-size:13px;color:#444;font-weight:700">Chat</div><div style="color:#111">${pres.chatText}</div>`;
           container.appendChild(c);
         }

         // info row
         const info = document.createElement('div');
         info.style.display = 'flex';
         info.style.gap = '12px';
         info.style.flexWrap = 'wrap';
         info.innerHTML = `
           <div style="padding:6px 8px;background:#f3f4f6;border-radius:6px">State: ${pres.gameState||'unknown'}</div>
           <div style="padding:6px 8px;background:#f3f4f6;border-radius:6px">Alive: ${typeof pres.aliveCount === 'number' ? pres.aliveCount : (pres.players ? pres.players.filter(p=>p.alive).length : 'n/a')}</div>
           <div style="padding:6px 8px;background:#f3f4f6;border-radius:6px">HasBomb: ${pres.hasBomb ? 'Yes' : 'No'}</div>
         `;
         container.appendChild(info);

         // create a small preview canvas to visualize positions of player and NPCs
         const previewWrap = document.createElement('div');
         previewWrap.style.display = 'flex';
         previewWrap.style.gap = '8px';
         previewWrap.style.alignItems = 'center';
         const previewLabel = document.createElement('div');
         previewLabel.style.fontSize = '13px';
         previewLabel.style.fontWeight = '700';
         previewLabel.style.color = '#111';
         previewLabel.textContent = 'Mini Preview';
         previewWrap.appendChild(previewLabel);

         const cv = document.createElement('canvas');
         cv.width = 320;
         cv.height = 160;
         cv.style.width = '320px';
         cv.style.height = '160px';
         cv.style.border = '1px solid rgba(0,0,0,0.06)';
         cv.style.borderRadius = '6px';
         cv.style.background = '#fff';
         previewWrap.appendChild(cv);
         container.appendChild(previewWrap);

         // Maintain an animated interpolation state between previous snapshot and new one
         const previewStateKey = (pres._clientId || pres.name) + '_preview';
         renderPresenceSnapshot._prev = renderPresenceSnapshot._prev || {};
         const prev = renderPresenceSnapshot._prev[previewStateKey] || null;
         const now = {
           ts: performance.now(),
           worldW: (typeof pres.worldW === 'number' && pres.worldW > 0) ? pres.worldW : 2000,
           worldH: (typeof pres.worldH === 'number' && pres.worldH > 0) ? pres.worldH : 720,
           players: Array.isArray(pres.players) ? pres.players.map(p=>({ ...p })) : (pres.playersSnapshot ? pres.playersSnapshot.map(p=>({ ...p })) : []),
           x: pres.x, y: pres.y,
           hasBomb: !!pres.hasBomb,
           bombTimer: typeof pres.bombTimer === 'number' ? pres.bombTimer : null
         };
         // if no prev state, seed it so first frame isn't a jump
         if(!prev){
           renderPresenceSnapshot._prev[previewStateKey] = {
             ts: now.ts,
             worldW: now.worldW,
             worldH: now.worldH,
             players: now.players.map(p=>({ ...p })),
             x: now.x, y: now.y,
             hasBomb: now.hasBomb,
             bombTimer: now.bombTimer,
             animStart: now.ts,
             animEnd: now.ts
           };
         }

         // set up animation target
         const target = {
           ts: now.ts,
           worldW: now.worldW,
           worldH: now.worldH,
           players: now.players,
           x: now.x, y: now.y,
           hasBomb: now.hasBomb,
           bombTimer: now.bombTimer
         };
         const state = renderPresenceSnapshot._prev[previewStateKey];
         state.target = target;
         state.animStart = performance.now();
         state.animEnd = state.animStart + 300; // 300ms smooth transition

         // draw into preview with interpolation over time
         let rafId = null;
         function drawInterpolated(){
           try{
             const ctx = cv.getContext('2d');
             const tNow = performance.now();
             const t = Math.min(1, Math.max(0, (tNow - state.animStart) / Math.max(1, (state.animEnd - state.animStart))));
             const ease = (1 - Math.cos(t * Math.PI)) * 0.5;

             // clear
             ctx.fillStyle = '#eef2f6';
             ctx.fillRect(0,0,cv.width,cv.height);

             const worldW = state.worldW;
             const worldH = state.worldH;
             const margin = 12;
             const viewW = cv.width - margin*2;
             const viewH = cv.height - margin*2;

             function worldToCanvas(wx, wy){
               const x = margin + (wx / worldW) * viewW;
               const y = margin + (wy / worldH) * viewH;
               return {x, y};
             }

             // draw platforms if provided from latest target snapshot
             const plats = Array.isArray(pres.platforms) ? pres.platforms : [];
             if(plats && plats.length){
               ctx.save();
               ctx.fillStyle = '#c7d5cb';
               for(const plat of plats){
                 if(typeof plat.x !== 'number' || typeof plat.y !== 'number') continue;
                 const p0 = worldToCanvas(plat.x, plat.y);
                 const p1 = worldToCanvas(plat.x + plat.w, plat.y + Math.max(6, plat.h));
                 const pw = Math.max(2, p1.x - p0.x);
                 const ph = Math.max(4, Math.abs(p1.y - p0.y));
                 if(p0.x + pw < margin || p0.x > margin + viewW) continue;
                 ctx.fillStyle = '#c7d5cb';
                 ctx.fillRect(p0.x, p0.y - ph + 4, pw, ph);
                 ctx.fillStyle = '#b7c5b3';
                 ctx.fillRect(p0.x, p0.y - Math.max(6, Math.min(8, ph)), pw, Math.min(6, ph));
               }
               ctx.restore();
             } else {
               ctx.fillStyle = '#c7d5cb';
               ctx.fillRect(margin, cv.height - margin - 6, viewW, 6);
             }

             // Determine merged list of players from prev and target for smooth transitions.
             const prevList = state.players || [];
             const newList = (state.target && state.target.players) ? state.target.players : [];
             // build map by id or name to interpolate
             const map = new Map();
             for(const p of prevList){
               const key = (p.id != null) ? ('id:'+p.id) : ('name:'+p.name);
               map.set(key, { from: p, to: null });
             }
             for(const p of newList){
               const key = (p.id != null) ? ('id:'+p.id) : ('name:'+p.name);
               if(map.has(key)) map.get(key).to = p;
               else map.set(key, { from: null, to: p });
             }

             // draw each interpolated entity
             for(const [k, pair] of map.entries()){
               const from = pair.from;
               const to = pair.to;
               // interpolation helpers
               let ix = 0, iy = 0, alive = true, hasBomb = false, name = '', id = null;
               if(from && to){
                 ix = from.x + (to.x - from.x) * ease;
                 iy = from.y + (to.y - from.y) * ease;
                 alive = !!to.alive;
                 hasBomb = !!to.hasBomb;
                 name = to.name || from.name;
                 id = to.id != null ? to.id : from.id;
               } else if(from && !to){
                 // fading out or disappeared -> slide slightly away and fade
                 ix = from.x + (Math.random() - 0.5) * 6;
                 iy = from.y + (Math.random() - 0.5) * 6;
                 alive = !!from.alive;
                 hasBomb = !!from.hasBomb;
                 name = from.name;
                 id = from.id;
               } else if(!from && to){
                 // new arrival: animate from edge toward position
                 // starting point: interpolate from canvas margin edge
                 const startX = (Math.random() < 0.5) ? 0 : worldW;
                 ix = startX + (to.x - startX) * ease;
                 iy = to.y;
                 alive = !!to.alive;
                 hasBomb = !!to.hasBomb;
                 name = to.name;
                 id = to.id;
               }

               if(!alive) continue;
               const pos = worldToCanvas(ix, iy);
               let fill = '#7b8c8d';
               if(name === pres.name) fill = '#2563eb';
               if((to && to.isUser) || (from && from.isUser)) fill = '#10b981';
               if(hasBomb) fill = '#ff4b4b';
               ctx.beginPath();
               ctx.fillStyle = fill;
               ctx.arc(pos.x, pos.y, 8, 0, Math.PI*2);
               ctx.fill();
               if(name === pres.name){
                 ctx.lineWidth = 2;
                 ctx.strokeStyle = '#0008';
                 ctx.stroke();
               }
               ctx.font = '10px system-ui,Arial';
               ctx.fillStyle = '#111';
               ctx.textAlign = 'center';
               ctx.fillText(name ? (name.substring(0,10)) : ('P'+(id||'')), pos.x, pos.y - 12);
               if(hasBomb){
                 ctx.font = '12px serif';
                 ctx.fillText('💣', pos.x, pos.y + 2);
               }
             }

             // draw watched player's own interpolated marker if provided
             if(typeof state.target.x === 'number' && typeof state.target.y === 'number'){
               // interpolate x,y against prior values (if present)
               const fromX = (state.x != null) ? state.x : state.target.x;
               const fromY = (state.y != null) ? state.y : state.target.y;
               const ix = fromX + (state.target.x - fromX) * ease;
               const iy = fromY + (state.target.y - fromY) * ease;
               const wp = worldToCanvas(ix, iy);
               ctx.beginPath();
               ctx.fillStyle = '#0ea5e9';
               ctx.arc(wp.x, wp.y, 12, 0, Math.PI*2);
               ctx.fill();
               ctx.lineWidth = 2;
               ctx.strokeStyle = '#fff9';
               ctx.stroke();
               ctx.font = '12px system-ui,Arial';
               ctx.fillStyle = '#fff';
               ctx.fillText(pres.name || 'Player', wp.x, wp.y - 18);
             }

             // legend: show dynamic connected player count (prefer live peers count)
             const peerCount = (typeof websimRoom === 'object' && websimRoom.peers) ? Object.keys(websimRoom.peers).length : (newList.length || 0);
             const legX = margin + 6;
             const legY = 8;
             ctx.fillStyle = '#111';
             ctx.font = '11px system-ui,Arial';
             ctx.fillText(`Players: ${peerCount || (newList.length || 0)}`, legX, legY + 10);
             ctx.fillText(`Bomb: ${state.target.hasBomb ? 'Yes' : 'No'}  Timer:${typeof state.target.bombTimer === 'number' ? Math.ceil(state.target.bombTimer) : '-'}`, legX, legY + 26);

             // If the shared presence indicates the remote player's gameState is not 'playing',
             // overlay a translucent notice so watchers know the player is paused / not ingame.
             if(pres.gameState && pres.gameState !== 'playing'){
               ctx.fillStyle = 'rgba(0,0,0,0.45)';
               ctx.fillRect(0,0,cv.width,cv.height);
               ctx.fillStyle = '#fff';
               ctx.font = '14px system-ui,Arial';
               ctx.textAlign = 'center';
               ctx.fillText(pres.gameState === 'paused' ? 'Player paused their game' : 'Player not ingame', cv.width/2, cv.height/2);
               // stop animating further frames for this paused snapshot (keep overlay stable).
               // Future presence updates will trigger a new render when renderPresenceSnapshot is called again.
               return;
             }

             // continue animating until we've reached the end time
             if(tNow < state.animEnd){
               rafId = requestAnimationFrame(drawInterpolated);
             } else {
               // finalize prev state to match target (snap)
               state.worldW = state.target.worldW;
               state.worldH = state.target.worldH;
               state.players = state.target.players.map(p=>({ ...p }));
               state.x = state.target.x;
               state.y = state.target.y;
               state.hasBomb = state.target.hasBomb;
               state.bombTimer = state.target.bombTimer;
               // do one last draw at final state with t=1 to ensure crispness
               // (we already rendered the final frame above when t reached 1)
             }
           }catch(e){
             // fail silently
           }
         }

         // start the interpolated draw loop (cancel any previous)
         try{ if(previewWrap._raf) cancelAnimationFrame(previewWrap._raf); }catch(e){}
         previewWrap._raf = requestAnimationFrame(drawInterpolated);

         // raw debug area for more data (limited)
         const raw = document.createElement('pre');
         raw.style.background = 'rgba(0,0,0,0.02)';
         raw.style.padding = '8px';
         raw.style.borderRadius = '6px';
         raw.style.maxHeight = '160px';
         raw.style.overflow = 'auto';
         try{
           raw.textContent = JSON.stringify(pres, null, 2);
           container.appendChild(raw);
         }catch(e){}

         watchContent.innerHTML = '';
         watchContent.appendChild(container);
       }

       function startWatching(clientId){
         watchedClientId = clientId;
         watchHeader.textContent = `Watching: ${websimRoom.peers[clientId] ? (websimRoom.peers[clientId].username || clientId.slice(0,6)) : clientId}`;
         // unsubscribe previous
         if(presenceUnsub) { try { presenceUnsub(); }catch(e){}; presenceUnsub = null; }
         // subscribe to presence updates and render
         try{
           // initial render from current presence snapshot
           const pres = websimRoom && websimRoom.presence ? websimRoom.presence[clientId] : null;
           if(!pres) {
             // request the player to send a snapshot (best-effort) via requestPresenceUpdate
             try{ websimRoom.requestPresenceUpdate(clientId, { type: 'requestSnapshot' }); }catch(e){}
           }
           renderPresenceSnapshot(pres);
           // subscribe to presence changes to update viewer live
           presenceUnsub = websimRoom.subscribePresence((all)=> {
             const p = all[clientId] || null;
             if(!p){
               // if player not present or not in-match
               showViewerMessage('Player is not ingame or has no shared presence.');
             } else {
               // decide based on received presence fields
               renderPresenceSnapshot(p);
             }
           });
         }catch(e){
           showViewerMessage('Watching unavailable: Websim not fully initialized.');
         }
       }

       watchBtn && watchBtn.addEventListener('click', ()=>{
         refreshWatchList();
         watchModal.style.display = 'flex';
       });

       watchRefresh && watchRefresh.addEventListener('click', ()=> refreshWatchList());
       watchClose && watchClose.addEventListener('click', ()=>{
         watchModal.style.display = 'none';
         watchedClientId = null;
         if(presenceUnsub){ try{ presenceUnsub(); }catch(e){}; presenceUnsub = null; }
       });

       // refresh list when peers object changes (best-effort polling)
       setInterval(()=> {
         if(document.body.contains(watchModal) && watchModal.style.display === 'flex'){
           refreshWatchList();
         }
       }, 2000);
     }
   }catch(e){
     // ignore failures and keep fallback
     // console.warn('Websim init failed', e);
   }
 })();

 // hat image for OrgeYT NPC
const hatImg = new Image();
hatImg.src = '/OrgeYThat.png';
// cache raw hat Image objects so we don't recreate Image() each frame for player hats
const hatCache = new Map();

// sky background
const skyImg = new Image();
skyImg.src = '/Sky.webp';

// sprite assets uploaded by user
const spriteImgs = {
  idle: new Image(),            // default facing right
  idle_bomb: new Image(),       // idle with bomb variant
  jump: new Image(),
  fall: new Image(),
  down: new Image(),            // down-press (no bomb)
  down_bomb: new Image(),
  jump_bomb: new Image(),       // jump while holding bomb
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
spriteImgs.fall_bomb = new Image(); spriteImgs.fall_bomb.src = '/Fall has bomb.png';
spriteImgs.down_bomb.src = '/down key has bomb.png';
spriteImgs.jump_bomb.src = '/Jump has bomb.png';
spriteImgs.give_bomb.src = '/give bomb.png';
spriteImgs.getting_bomb.src = '/getting bomb.png';
spriteImgs.exploded.src = '/Exploded.png';

// cache for tinted sprites: key = img.src + '|' + color
const tintedCache = new Map();

// helper: convert CSS color (hsl/hex) to {r,g,b}
function cssToRgb(css){
  // create temp canvas to parse color
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  const cx = c.getContext('2d');
  cx.fillStyle = css;
  cx.fillRect(0,0,1,1);
  const d = cx.getImageData(0,0,1,1).data;
  return {r:d[0], g:d[1], b:d[2]};
}

// Green-screen tinting: replace green pixels (pure-ish green) with target color while preserving alpha and shading.
// Returns a canvas (cached) with the tinted sprite facing right.
function getTintedSprite(img, color){
  if(!img || !img.complete) return null;
  const key = img.src + '|' + color;
  if(tintedCache.has(key)) return tintedCache.get(key);

  // create offscreen canvas
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const cx = c.getContext('2d');
  cx.drawImage(img, 0, 0);
  const data = cx.getImageData(0,0,c.width,c.height);
  const cols = cssToRgb(color);
  // treat "green screen" as bright green-ish: prefer pixels where G is dominant
  for(let i=0;i<data.data.length;i+=4){
    const r = data.data[i], g = data.data[i+1], b = data.data[i+2], a = data.data[i+3];
    // skip transparent
    if(a < 16) continue;
    // if pixel is green-dominant and reasonably saturated (simple test)
    if(g > 90 && g > r + 20 && g > b + 20){
      // blend preserving luminance: compute luminance of original and apply to target color
      const lum = (0.2126*r + 0.7152*g + 0.0722*b)/255;
      data.data[i]   = Math.min(255, Math.round(cols.r * lum));
      data.data[i+1] = Math.min(255, Math.round(cols.g * lum));
      data.data[i+2] = Math.min(255, Math.round(cols.b * lum));
      // alpha keep
    }
  }
  cx.putImageData(data, 0, 0);
  tintedCache.set(key, c);
  return c;
}

/* Optimized hat recoloring: reuse temp canvases and cache parsed target colors */
const tintedHatCache = new Map();
const _hatColorCache = new Map();
// single temp canvas used only for color parsing and small operations to avoid repeat DOM canvas creation
const _tmpColorCanvas = document.createElement('canvas');
_tmpColorCanvas.width = _tmpColorCanvas.height = 1;
const _tmpColorCtx = _tmpColorCanvas.getContext('2d');

// tiny helpers to enforce vivid, not-dark hat colors
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

// parse a CSS color to rgb, cached for repeated uses
function parseColorToRgb(css){
  if(!css) return {r:255,g:0,b:0};
  if(_hatColorCache.has(css)) return _hatColorCache.get(css);
  try{
    _tmpColorCtx.clearRect(0,0,1,1);
    _tmpColorCtx.fillStyle = css;
    _tmpColorCtx.fillRect(0,0,1,1);
    const d = _tmpColorCtx.getImageData(0,0,1,1).data;
    const out = {r:d[0], g:d[1], b:d[2]};
    _hatColorCache.set(css, out);
    return out;
  }catch(e){
    return {r:255,g:0,b:0};
  }
}

function getTintedHat(img, color){
  if(!img || !img.complete) return null;
  // ensure vivid target color and cache the normalized version
  let safeColor = color || '#ff0000';
  if(_hatColorCache.has('norm|'+safeColor)){
    safeColor = _hatColorCache.get('norm|'+safeColor + '|hex') || safeColor;
  } else {
    try{
      _tmpColorCtx.clearRect(0,0,1,1);
      _tmpColorCtx.fillStyle = safeColor;
      _tmpColorCtx.fillRect(0,0,1,1);
      const d = _tmpColorCtx.getImageData(0,0,1,1).data;
      const hsl = rgbToHsl(d[0], d[1], d[2]);
      hsl.s = 100;
      if(hsl.l < 55) hsl.l = 55;
      safeColor = hslToHex(hsl.h, hsl.s, hsl.l);
    }catch(e){
      safeColor = color || '#ff0000';
    }
    _hatColorCache.set('norm|'+color, true);
    _hatColorCache.set('norm|'+color + '|hex', safeColor);
  }

  const key = img.src + '|' + safeColor;
  if(tintedHatCache.has(key)) return tintedHatCache.get(key);

  const cols = parseColorToRgb(safeColor);
  // try to re-use a single offscreen canvas per hat image size by key to reduce allocations
  let off = tintedHatCache.get(img.src + '|baseCanvas');
  if(!off){
    off = document.createElement('canvas');
    off.width = img.width;
    off.height = img.height;
    const ox = off.getContext('2d');
    ox.drawImage(img,0,0);
    tintedHatCache.set(img.src + '|baseCanvas', off);
  }
  // create a new canvas for the recolored result (we must not mutate baseCanvas)
  const c = document.createElement('canvas');
  c.width = off.width; c.height = off.height;
  const cx = c.getContext('2d');
  cx.drawImage(off, 0, 0);
  let data;
  try {
    data = cx.getImageData(0,0,c.width,c.height);
  } catch(e){
    // Cross-origin images may fail; cache the drawn base and return it to avoid repeated attempts
    tintedHatCache.set(key, off);
    return off;
  }
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
  cx.putImageData(data,0,0);
  tintedHatCache.set(key, c);
  return c;
}

let W=innerWidth, H=innerHeight;
let worldW = Math.max(Math.round(W * 3.6), 2000); // larger world for expanded map (ensure worldW exists before resize() runs)
function resize(){
  W=innerWidth; H=innerHeight;
  // world width is larger than the viewport to create an expanded map
  worldW = Math.max(Math.round(W * 2.4), 2000);

  canvas.width = W * devicePixelRatio;
  canvas.height = H * devicePixelRatio;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
}
addEventListener('resize', resize);
resize();

   // UI elements
 const overlay = document.getElementById('overlay');
 const startBtn = document.getElementById('startBtn');
 const spectateBtn = document.getElementById('spectateBtn');
 const toggleCheatsBtn = document.getElementById('toggleCheatsBtn');
 const pixelFontBtn = document.getElementById('pixelFontBtn');
 const hatBtn = document.getElementById('hatBtn');
 const unpauseBtn = document.getElementById('unpauseBtn');
 const npcRange = document.getElementById('npcRange');
 const npcCountLabel = document.getElementById('npcCountLabel');

 // wire mute button to bgAudio (if present in DOM)
 const muteBtn = document.getElementById('muteBtn');
 if(muteBtn){
   // set initial emoji based on muted state
   muteBtn.textContent = bgAudio && bgAudio.muted ? '🔇' : '🔊';
   muteBtn.addEventListener('click', ()=>{
     if(!bgAudio) return;
     bgAudio.muted = !bgAudio.muted;
     muteBtn.textContent = bgAudio.muted ? '🔇' : '🔊';
     // ensure music is started when unmuting via button (user intent)
     if(!bgAudio.muted) startBgMusic();
   });
 }

 // Pixel font toggle (enabled by default)
 window.pixelFontEnabled = (typeof window.pixelFontEnabled === 'boolean') ? window.pixelFontEnabled : true;
 // ensure body class matches default
 if(window.pixelFontEnabled){
   document.body.classList.add('pixel-font');
 } else {
   document.body.classList.remove('pixel-font');
 }
 if(pixelFontBtn){
   function refreshPixelBtn(){
     pixelFontBtn.textContent = window.pixelFontEnabled ? 'Pixel Font: ON' : 'Pixel Font: OFF';
     pixelFontBtn.style.boxShadow = window.pixelFontEnabled ? '0 6px 18px rgba(17,24,39,0.25)' : '';
     pixelFontBtn.style.background = window.pixelFontEnabled ? '#111827' : '#6b7280';
   }
   pixelFontBtn.addEventListener('click', ()=>{
     window.pixelFontEnabled = !window.pixelFontEnabled;
     if(window.pixelFontEnabled) document.body.classList.add('pixel-font');
     else document.body.classList.remove('pixel-font');
     refreshPixelBtn();
   });
   refreshPixelBtn();
 }

 // global hat selection state for user choices
 window.selectedHat = window.selectedHat || null; // e.g. '/beany.png' or null for none
 window.hatColor = window.hatColor || '#ff0000';
 // OrgeYT_Real toggle (title UI)
 window.orgeRealEnabled = window.orgeRealEnabled || false;

const gameOverEl = document.getElementById('gameOver');
const restartBtn = document.getElementById('restartBtn');
const bombTimerEl = document.getElementById('bombTimer');
const playersLeftEl = document.getElementById('playersLeft');
const pauseBtn = document.getElementById('pauseBtn');
const hidePauseBtn = document.getElementById('hidePauseBtn'); // may be null until inserted into DOM
const showPauseBtn = document.getElementById('showPauseBtn');
const focusPlayerBtn = document.getElementById('focusPlayerBtn'); // spectate focus toggle
// spectate focus state
let spectateFocus = false;
let spectateFocusIndex = 0;
let spectateFocusList = []; // array of player indices (ordered)

// Summon NPC: create HUD button next to pause and build summon modal
const summonBtn = document.createElement('button');
summonBtn.id = 'summonBtn';
summonBtn.className = 'info';
summonBtn.style.pointerEvents = 'auto';
summonBtn.style.minWidth = '120px';
summonBtn.style.marginLeft = '8px';
summonBtn.textContent = 'Summon NPC';
summonBtn.title = 'Open Summon NPC menu';
// insert after pauseBtn in HUD if present, otherwise append to #hud
try{
  const hud = document.getElementById('hud');
  if(hud){
    // place directly after pauseBtn if possible
    const pb = document.getElementById('pauseBtn');
    if(pb && pb.parentNode) pb.parentNode.insertBefore(summonBtn, pb.nextSibling);
    else hud.appendChild(summonBtn);
  } else {
    document.body.appendChild(summonBtn);
  }
}catch(e){ document.body.appendChild(summonBtn); }

// Build Summon modal UI (anchor near center)
const summonModal = document.createElement('div');
summonModal.id = 'summonModal';
summonModal.style.position = 'fixed';
summonModal.style.left = '50%';
summonModal.style.top = '50%';
summonModal.style.transform = 'translate(-50%,-50%)';
summonModal.style.width = '86vw';
summonModal.style.maxWidth = '420px';
summonModal.style.background = 'var(--card)';
summonModal.style.borderRadius = '12px';
summonModal.style.boxShadow = '0 14px 40px rgba(0,0,0,0.6)';
summonModal.style.display = 'none';
summonModal.style.flexDirection = 'column';
summonModal.style.zIndex = 130;
summonModal.style.pointerEvents = 'auto';
summonModal.style.padding = '12px';
summonModal.innerHTML = `
  <div style="display:flex;align-items:center;gap:8px;">
    <h3 style="margin:0;font-size:16px;color:#111">Summon NPC</h3>
    <div style="flex:1"></div>
    <button id="summonClose" style="background:#ef4444;color:#fff;border:0;padding:6px 8px;border-radius:8px;cursor:pointer;">Close</button>
  </div>
  <div style="display:flex;gap:10px;margin-top:10px;align-items:flex-start;">
    <div style="flex:1;display:flex;flex-direction:column;gap:8px;">
      <label style="font-size:13px;color:#222;">Name</label>
      <input id="summonName" type="text" placeholder="NPC Name" style="padding:8px;border-radius:8px;border:1px solid #ddd;width:100%"/>
      <label style="font-size:13px;color:#222;">Body color</label>
      <input id="summonColor" type="color" value="#ff8a00" style="height:40px;border-radius:8px;border:0;padding:0;"/>
      <label style="font-size:13px;color:#222;">Skill</label>
      <select id="summonSkill" style="padding:8px;border-radius:8px;border:1px solid #ddd;">
        <option value="average">Average</option>
        <option value="pro">Pro</option>
        <option value="noob">Noob</option>
      </select>
      <label style="font-size:13px;color:#222;">Hat</label>
      <select id="summonHat" style="padding:8px;border-radius:8px;border:1px solid #ddd;">
        <option value="">None</option>
        <option value="/beany.png">Beany</option>
        <option value="/top hat.png">Top hat</option>
        <option value="/traffic cone.png">Traffic cone</option>
        <option value="/santa hat.png">Santa</option>
        <option value="/mini player.png">Mini</option>
        <option value="/hele.png">Hele</option>
        <option value="/Bomb hat.png">Bomb hat</option>
      </select>
      <label style="font-size:13px;color:#222;">Hat color</label>
      <input id="summonHatColor" type="color" value="#000000" style="height:40px;border-radius:8px;border:0;padding:0;"/>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px;">
        <button id="summonCancel" style="padding:8px 10px;border-radius:8px;border:0;background:#9ca3af;color:#fff;cursor:pointer;">Cancel</button>
        <button id="summonConfirm" style="padding:8px 10px;border-radius:8px;border:0;background:#10b981;color:#fff;cursor:pointer;">Summon</button>
      </div>
    </div>
    <div style="width:140px;min-width:140px;display:flex;flex-direction:column;align-items:center;gap:8px;">
      <div style="font-size:13px;color:#222;font-weight:700">Preview</div>
      <canvas id="summonPreview" width="160" height="160" style="width:160px;height:160px;border-radius:8px;background:#000;"></canvas>
      <div id="summonPreviewLabel" style="font-size:12px;color:#555;text-align:center;"></div>
    </div>
  </div>
`;
document.body.appendChild(summonModal);

const summonOpen = summonBtn;
const summonClose = summonModal.querySelector('#summonClose');
const summonCancel = summonModal.querySelector('#summonCancel');
const summonConfirm = summonModal.querySelector('#summonConfirm');
const summonName = summonModal.querySelector('#summonName');
const summonColor = summonModal.querySelector('#summonColor');
const summonSkill = summonModal.querySelector('#summonSkill');
const summonHat = summonModal.querySelector('#summonHat');
const summonHatColor = summonModal.querySelector('#summonHatColor');
const summonPreview = summonModal.querySelector('#summonPreview');
const summonPreviewLabel = summonModal.querySelector('#summonPreviewLabel');

function openSummonModal(){
  summonModal.style.display = 'flex';
  // seed defaults
  summonName.value = `NPC${Math.floor(Math.random()*9000)}`;
  summonColor.value = '#'+Math.floor(Math.random()*16777215).toString(16).padStart(6,'0');
  summonSkill.value = 'average';
  summonHat.value = '';
  summonHatColor.value = '#000000';
  renderSummonPreview();
}
function closeSummonModal(){ summonModal.style.display = 'none'; }

// live preview draw
function renderSummonPreview(){
  const cv = summonPreview;
  const ctxp = cv.getContext('2d');
  ctxp.clearRect(0,0,cv.width,cv.height);
  // background
  ctxp.fillStyle = '#eef2f6';
  ctxp.fillRect(0,0,cv.width,cv.height);

  // attempt to draw the idle sprite tinted to the chosen body color (live preview)
  const col = summonColor.value || '#ff8a00';
  let drawn = false;
  try{
    // use the local spriteImgs.idle (not window.spriteImgs) and the getTintedSprite helper
    if(spriteImgs && spriteImgs.idle && spriteImgs.idle.complete){
      const tinted = getTintedSprite(spriteImgs.idle, col) || null;
      if(tinted){
        // scale to preview area and align feet to bottom like in-game
        // compute a friendly preview scale (fit into ~72px area)
        const maxDim = 72;
        const scale = Math.min(maxDim / Math.max(1, tinted.width), maxDim / Math.max(1, tinted.height));
        const dw = Math.round(tinted.width * scale);
        const dh = Math.round(tinted.height * scale);
        const dx = Math.round(cv.width/2 - dw/2);
        const dy = Math.round(cv.height - dh - 28);
        ctxp.drawImage(tinted, 0, 0, tinted.width, tinted.height, dx, dy, dw, dh);
        // store last drawn sprite metrics so hat positioning can use exact sprite placement
        renderSummonPreview._lastSprite = { dx, dy, dw, dh };
        drawn = true;
      }
    }
  }catch(e){
    drawn = false;
  }

  // fallback to simple colored square if sprite not ready
  if(!drawn){
    ctxp.fillStyle = col;
    const size = 44;
    const x = (cv.width - size)/2;
    const y = cv.height - size - 28;
    ctxp.fillRect(x,y,size,size);
    // record fallback sprite box so hat can be aligned above it
    renderSummonPreview._lastSprite = { dx: x, dy: y, dw: size, dh: size };
  }

  // draw hat if selected (position and scale adjusted to sit on the preview sprite head)
  const hat = summonHat.value;
  if(hat){
    // reuse single image instance per call (onload handles recolor/draw); if already cached/complete draw immediately
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.src = hat;

    function drawHatFromImage(img){
      try{
        // Recolor red parts of the hat similar to in-game behavior (best-effort)
        const off = document.createElement('canvas');
        off.width = img.width; off.height = img.height;
        const ox = off.getContext('2d');
        ox.drawImage(img,0,0);
        try{
          const data = ox.getImageData(0,0,off.width,off.height);
          const cols = (() => {
            const c = summonHatColor.value || '#000000';
            const tmp = document.createElement('canvas'); tmp.width=1; tmp.height=1;
            const tctx = tmp.getContext('2d'); tctx.fillStyle = c; tctx.fillRect(0,0,1,1);
            const d = tctx.getImageData(0,0,1,1).data;
            return {r:d[0],g:d[1],b:d[2]};
          })();
          for(let i=0;i<data.data.length;i+=4){
            const r = data.data[i], g = data.data[i+1], b = data.data[i+2], a = data.data[i+3];
            if(a < 10) continue;
            if(r > g + 20 && r > b + 20){
              const lum = (0.2126*r + 0.7152*g + 0.0722*b)/255;
              data.data[i]   = Math.min(255, Math.round(cols.r * lum));
              data.data[i+1] = Math.min(255, Math.round(cols.g * lum));
              data.data[i+2] = Math.min(255, Math.round(cols.b * lum));
            }
          }
          ox.putImageData(data,0,0);
        }catch(e){ /* cross-origin or getImageData failure: fall back to original image */ }

        // Use last sprite metrics to compute hat placement; fallback to centered box if not present
        const spriteInfo = renderSummonPreview._lastSprite || { dx: Math.round(cv.width/2 - 22), dy: cv.height - 44 - 28, dw: 44, dh: 44 };
        let hatW, hatH, hatX, hatY;

        // make hat width proportional to sprite width (so it sits neatly on head)
        const spriteW = spriteInfo.dw, spriteX = spriteInfo.dx, spriteY = spriteInfo.dy;
        const targetHatWidth = Math.max(22, Math.min(spriteW * 0.9, 56));
        const scale = targetHatWidth / Math.max(1, off.width);
        hatW = Math.round(off.width * scale);
        hatH = Math.round(off.height * scale);
        hatX = Math.round(spriteX + spriteW/2 - hatW/2);
        // place hat slightly above sprite's top (head sits near top of drawn sprite)
        hatY = Math.round(spriteY - hatH - 6);

        // draw hat onto preview
        ctxp.drawImage(off, hatX, hatY, hatW, hatH);
      }catch(e){}
    }

    if(im.complete){
      drawHatFromImage(im);
    } else {
      im.onload = ()=> drawHatFromImage(im);
      im.onerror = ()=>{};
    }
  }

  // name + skill label
  const nm = summonName.value || 'NPC';
  const sk = summonSkill.value || 'average';
  summonPreviewLabel.textContent = `${nm} — ${sk.toUpperCase()}`;
}

summonOpen.addEventListener('click', openSummonModal);
summonClose.addEventListener('click', closeSummonModal);
summonCancel.addEventListener('click', closeSummonModal);
[summonName, summonColor, summonSkill, summonHat, summonHatColor].forEach(el=>{
  el.addEventListener('input', renderSummonPreview);
});

// Summon action: create an NPC next to the user with chosen properties
summonConfirm.addEventListener('click', ()=>{
  try{
    const name = (summonName.value || '').trim() || ('NPC'+Math.floor(Math.random()*9999));
    const color = summonColor.value || '#ff8a00';
    const skill = summonSkill.value || 'average';
    const hat = summonHat.value || null;
    const hatColor = summonHatColor.value || null;

    // pick spawn location near user
    const spawnX = (user && typeof user.x === 'number') ? Math.min(worldW - 60, Math.max(16, user.x + 72)) : (Math.random() * Math.max(200, worldW - 200));
    const spawnY = (user && typeof user.y === 'number') ? user.y : (H - groundPadding - 44 - 2);

    // build player id as next index
    const newId = players.length > 0 ? Math.max(...players.map(p=>p.id)) + 1 : players.length;
    const p = new Player(newId, name, spawnX, spawnY, color, false);
    p.npcType = skill;
    if(skill === 'pro') p.fast = true;
    if(hat) { p.hat = hat; p.hatColor = hatColor; }
    players.push(p);

    pushChatLog({ name: p.name, color: p.hatColor || p.color || '#111', text: 'I have been summoned!', hasBomb: !!p.hasBomb });
    // close modal
    closeSummonModal();
  }catch(e){
    console.warn('Summon failed', e);
    closeSummonModal();
  }
});

// initialize npc UI label
if(npcRange){
  npcCountLabel.textContent = npcRange.value;
  npcRange.addEventListener('input', () => {
    npcCountLabel.textContent = npcRange.value;
  });
}

 // build hat picker modal (title screen) with live recolor previews
(function buildHatModal(){
  const modal = document.createElement('div');
  modal.id = 'hatModal';
  modal.innerHTML = `
    <div style="display:flex;align-items:center;">
      <h3>Edit character</h3>
      <button class="closeBtn">Close</button>
    </div>
    <div style="display:flex;gap:12px;align-items:flex-start;">
      <div style="flex:1;min-width:220px;">
        <div id="hatGrid"></div>
        <div style="margin-top:8px;" id="hatControls">
          <label style="font-size:13px;color:#222;display:block;margin-bottom:6px;">Recolor red to:</label>
          <!-- make hat color picker larger and easier to hit -->
          <input id="hatColor" type="color" value="${window.hatColor}" style="width:100%;height:40px;border-radius:8px;border:0;padding:0;"/>
          <div style="height:8px"></div>

          <label style="font-size:13px;color:#222;display:block;margin-bottom:6px;">Player color (choose or Random)</label>
          <div style="display:flex;gap:8px;align-items:center;">
            <!-- make player color picker match hat picker sizing (full-width swatch) -->
            <input id="playerColor" type="color" value="#ffffff" style="flex:1;height:44px;border-radius:8px;border:0;padding:0;min-width:0;"/>
            <button id="playerColorRandom" style="padding:8px 10px;border-radius:8px;border:0;background:#111827;color:#fff;cursor:pointer;width:92px;flex:0 0 92px;">Random</button>
            <!-- live sprite pose selector for previewing different poses -->
            <select id="spriteSelect" style="margin-left:8px;padding:8px;border-radius:8px;border:1px solid #ddd;background:#fff;">
              <option value="idle">Idle</option>
              <option value="idle_bomb">Idle (Bomb)</option>
              <option value="jump">Jump</option>
              <option value="fall">Fall</option>
              <option value="down">Down</option>
              <option value="down_bomb">Down (Bomb)</option>
              <option value="jump_bomb">Jump (Bomb)</option>
              <option value="fall_bomb">Fall (Bomb)</option>
              <option value="give_bomb">Give</option>
              <option value="getting_bomb">Receiving</option>
              <option value="exploded">Exploded</option>
            </select>
          </div>

          <div style="flex:1;"></div>
          <div style="margin-top:10px;display:flex;justify-content:flex-end;gap:8px;">
            <button id="hatSave" style="background:#10b981;color:#fff;padding:8px 10px;border-radius:8px;border:0;cursor:pointer;">Save</button>
            <button id="hatCancel" style="background:#9ca3af;color:#fff;padding:8px 10px;border-radius:8px;border:0;cursor:pointer;">Cancel</button>
          </div>
        </div>
      </div>
      <div style="width:200px;min-width:200px;display:flex;flex-direction:column;align-items:center;gap:8px;">
        <div style="font-size:13px;color:#222;font-weight:700">Preview</div>
        <canvas id="hatPlayerPreview" width="160" height="160" style="width:160px;height:160px;border-radius:8px;background:#fff;border:1px solid rgba(0,0,0,0.06);"></canvas>
        <div id="hatPreviewLabel" style="font-size:12px;color:#555;text-align:center;"></div>
      </div>
    </div>
    <div class="hint" style="margin-top:10px;">Tip: pick "None" for no hat. Select a sprite pose to preview different animations.</div>
  `;
  document.body.appendChild(modal);

  const hatGrid = modal.querySelector('#hatGrid');
  const colorInput = modal.querySelector('#hatColor');
  const spriteSelect = modal.querySelector('#spriteSelect');
  const playerColorInput = modal.querySelector('#playerColor');
  const playerRandomBtn = modal.querySelector('#playerColorRandom');
  const previewCanvas = modal.querySelector('#hatPlayerPreview');
  const previewLabel = modal.querySelector('#hatPreviewLabel');
  const previewCtx = previewCanvas.getContext('2d');

  const hats = [
    {name:'None', src: null},
    {name:'beany', src:'/beany.png'},
    {name:'top hat', src:'/top hat.png'},
    {name:'traffic cone', src:'/traffic cone.png'},
    {name:'santa', src:'/santa hat.png'},
    {name:'mini', src:'/mini player.png'},
    {name:'hele', src:'/hele.png'},
    {name:'bomb hat', src:'/Bomb hat.png'}
  ];

  // utility: parse CSS color string to rgb
  function cssToRgbLocal(css){
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    const cx = c.getContext('2d');
    cx.fillStyle = css;
    cx.fillRect(0,0,1,1);
    const d = cx.getImageData(0,0,1,1).data;
    return {r:d[0], g:d[1], b:d[2]};
  }

  // convert rgb to hsl and back utilities (for brightness adjustments)
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

  // ensure color is vivid and not too dark: force saturation to 100% and raise lightness to at least 50%
  function brightenColor(css){
    try {
      const rgb = cssToRgbLocal(css);
      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
      // force maximum saturation for punchy hat recolors
      hsl.s = 100;
      // ensure recolors are bright enough — raise threshold so results stay vivid
      if(hsl.l < 60){
        hsl.l = 70; // boost to a visibly bright level
      }
      return hslToHex(hsl.h, hsl.s, hsl.l);
    } catch(e){
      return css;
    }
  }

  // tint red-dominant pixels in an image to target color, drawing result onto a canvas and returning it
  function tintRedToColorCanvas(img, color){
    if(!img || !img.complete) return null;
    // brighten target so recolors remain vivid
    const safeColor = brightenColor(color || '#ff0000');
    const cols = cssToRgbLocal(safeColor);
    const off = document.createElement('canvas');
    off.width = img.width; off.height = img.height;
    const ox = off.getContext('2d');
    ox.drawImage(img,0,0);
    try{
      const data = ox.getImageData(0,0,off.width,off.height);
      for(let i=0;i<data.data.length;i+=4){
        const r = data.data[i], g = data.data[i+1], b = data.data[i+2], a = data.data[i+3];
        if(a < 16) continue;
        // detect red-dominant pixels (stronger than green/blue)
        if(r > g + 20 && r > b + 20){
          const lum = (0.2126*r + 0.7152*g + 0.0722*b)/255;
          data.data[i]   = Math.min(255, Math.round(cols.r * lum));
          data.data[i+1] = Math.min(255, Math.round(cols.g * lum));
          data.data[i+2] = Math.min(255, Math.round(cols.b * lum));
        }
      }
      ox.putImageData(data,0,0);
    }catch(e){
      // some browsers may restrict getImageData for cross-origin images; fallback to just draw the image
    }
    return off;
  }

  // keep references to original Image objects and canvas previews so we can redraw them when color changes
  const hatEntries = []; // {src, img, canvas, optionEl}

  hats.forEach(h=>{
    const el = document.createElement('div');
    el.className = 'hatOption';
    el.dataset.src = h.src || '';
    el.style.position = 'relative';
    el.style.overflow = 'hidden';
    if(!h.src){
      el.innerHTML = '<div style="color:#fff;font-size:12px;">None</div>';
      hatGrid.appendChild(el);
      hatEntries.push({src:null, img:null, canvas:null, optionEl:el});
      return;
    }
    // create an offscreen Image and a visible canvas for the preview
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = h.src;
    const cv = document.createElement('canvas');
    cv.style.maxWidth = '100%';
    cv.style.maxHeight = '100%';
    cv.width = 128; cv.height = 128;
    // draw placeholder until image loads
    const cctx = cv.getContext('2d');
    cctx.fillStyle = '#000';
    cctx.fillRect(0,0,cv.width,cv.height);

    // when loaded, draw tinted preview using current color
    function drawPreview(targetColor){
      // choose target color: provided or current picker color or window.hatColor
      const rawTarget = targetColor || colorInput.value || window.hatColor || '#ff0000';
      const target = brightenColor(rawTarget);
      const tinted = tintRedToColorCanvas(img, target);
      // scale and center tinted canvas content into preview canvas
      cctx.clearRect(0,0,cv.width,cv.height);
      cctx.fillStyle = '#000';
      cctx.fillRect(0,0,cv.width,cv.height);
      if(tinted){
        // compute fit
        const scale = Math.min((cv.width-8)/tinted.width, (cv.height-8)/tinted.height, 1);
        const dw = tinted.width * scale;
        const dh = tinted.height * scale;
        const dx = (cv.width - dw) / 2;
        const dy = (cv.height - dh) / 2;
        cctx.drawImage(tinted, 0, 0, tinted.width, tinted.height, dx, dy, dw, dh);
      } else if(img && img.complete){
        // fallback: draw original image scaled
        const scale = Math.min((cv.width-8)/img.width, (cv.height-8)/img.height, 1);
        const dw = img.width * scale;
        const dh = img.height * scale;
        const dx = (cv.width - dw) / 2;
        const dy = (cv.height - dh) / 2;
        cctx.drawImage(img, dx, dy, dw, dh);
      } else {
        // still loading: simple spinner/text
        cctx.fillStyle = '#666';
        cctx.font = '12px system-ui,Arial';
        cctx.textAlign = 'center';
        cctx.fillText('Loading', cv.width/2, cv.height/2);
      }
    }
    img.addEventListener('load', ()=> drawPreview());
    img.addEventListener('error', ()=> drawPreview());
    // initial attempt
    setTimeout(()=> drawPreview(), 50);

    el.appendChild(cv);
    hatGrid.appendChild(el);
    hatEntries.push({src:h.src, img, canvas:cv, optionEl:el, drawPreview});
  });

  function refreshSelection(){
    const opts = hatGrid.querySelectorAll('.hatOption');
    opts.forEach(o=>{
      if((o.dataset.src || '') === (window.selectedHat || '')) o.classList.add('selected');
      else o.classList.remove('selected');
    });
    colorInput.value = window.hatColor || '#ff0000';
    // initialize player preview color from current user color when available, fallback to previous or white
    if(user && user.isUser && user.color){
      window.playerPreviewColor = user.color;
    } else {
      if(!window.playerPreviewColor) window.playerPreviewColor = '#ffffff';
    }
    playerColorInput.value = window.playerPreviewColor;
  }

  hatGrid.addEventListener('click', (ev)=>{
    const opt = ev.target.closest('.hatOption');
    if(!opt) return;
    const src = opt.dataset.src || '';
    window.selectedHat = src || null;
    refreshSelection();
    renderPlayerPreview();
  });

  modal.querySelector('.closeBtn').addEventListener('click', ()=>{
    modal.classList.remove('active');
    if(modal._hatPreviewTimer){ clearInterval(modal._hatPreviewTimer); modal._hatPreviewTimer = null; }
  });

  modal.querySelector('#hatCancel').addEventListener('click', ()=>{
    modal.classList.remove('active');
    if(modal._hatPreviewTimer){ clearInterval(modal._hatPreviewTimer); modal._hatPreviewTimer = null; }
  });

  modal.querySelector('#hatSave').addEventListener('click', ()=>{
    // brighten then save the color so saved hat colors are always visibly bright
    const chosen = colorInput.value || '#ff0000';
    window.hatColor = brightenColor(chosen);
    // player color save
    window.playerPreviewColor = playerColorInput.value || '#ffffff';
    // apply to current user hat/color immediately if user exists
    if(user && user.isUser){
      user.hat = window.selectedHat;
      user.hatColor = window.hatColor;
      user.color = window.playerPreviewColor;
    }
    if(modal._hatPreviewTimer){ clearInterval(modal._hatPreviewTimer); modal._hatPreviewTimer = null; }
    modal.classList.remove('active');
  });

  // randomize player color
  playerRandomBtn.addEventListener('click', ()=>{
    const c = '#'+Math.floor(Math.random()*16777215).toString(16).padStart(6,'0');
    playerColorInput.value = c;
    window.playerPreviewColor = c;
    // apply live to actual user if present
    if(user && user.isUser){
      user.color = c;
    }
    renderPlayerPreview();
  });

  // wire sprite pose selector to update live preview
  if(spriteSelect){
    spriteSelect.addEventListener('change', ()=>{
      renderPlayerPreview();
    });
  }

  // update previews function (throttled by periodic timer)
  function updatePreviews(){
    const raw = colorInput.value || window.hatColor || '#ff0000';
    const target = brightenColor(raw);
    for(const entry of hatEntries){
      if(!entry.img || !entry.canvas) continue;
      try{
        if(entry.drawPreview) entry.drawPreview(target);
      }catch(e){}
    }
    // also update the "selected" user's hat color live in the preview (applies to in-game hat rendering while modal open)
    window.playerPreviewColor = playerColorInput.value || window.playerPreviewColor || '#ffffff';
    // apply live to actual user if present
    if(user && user.isUser){
      user.hatColor = colorInput.value || user.hatColor;
      user.color = playerColorInput.value || user.color;
    }
    renderPlayerPreview();
  }

  // render the small player preview: draws the idle sprite tinted to selected player color and draws chosen hat recolored to hatColor
  function renderPlayerPreview(){
    try{
      previewCtx.clearRect(0,0,previewCanvas.width, previewCanvas.height);
      // background
      previewCtx.fillStyle = '#eef2f6';
      previewCtx.fillRect(0,0,previewCanvas.width, previewCanvas.height);

      const bodyColor = playerColorInput.value || '#ffffff';
      // draw tinted idle sprite if available (use getTintedSprite helper defined earlier)
      let drawn = false;
      try{
        const poseKey = (spriteSelect && spriteSelect.value) ? spriteSelect.value : 'idle';
        const baseSprite = spriteImgs && spriteImgs[poseKey] ? spriteImgs[poseKey] : (spriteImgs && spriteImgs.idle ? spriteImgs.idle : null);
        if(baseSprite && baseSprite.complete){
          const tinted = getTintedSprite(baseSprite, bodyColor) || null;
          if(tinted){
            const maxDim = 72;
            const scale = Math.min(maxDim / Math.max(1, tinted.width), maxDim / Math.max(1, tinted.height));
            const dw = Math.round(tinted.width * scale);
            const dh = Math.round(tinted.height * scale);
            const dx = Math.round(previewCanvas.width/2 - dw/2);
            const dy = Math.round(previewCanvas.height - dh - 28);
            previewCtx.drawImage(tinted, 0,0, tinted.width, tinted.height, dx, dy, dw, dh);
            renderPlayerPreview._lastSprite = { dx, dy, dw, dh };
            drawn = true;
          }
        }
      }catch(e){ drawn = false; }

      if(!drawn){
        // fallback colored square
        previewCtx.fillStyle = bodyColor;
        const size = 44;
        const x = (previewCanvas.width - size)/2;
        const y = previewCanvas.height - size - 28;
        previewCtx.fillRect(x,y,size,size);
        renderPlayerPreview._lastSprite = { dx: x, dy: y, dw: size, dh: size };
      }

      // draw selected hat if any
      const hatSrc = window.selectedHat;
      if(hatSrc){
        const im = new Image();
        im.crossOrigin = 'anonymous';
        im.src = hatSrc;
        const drawHat = (img) => {
          try{
            const off = document.createElement('canvas');
            off.width = img.width; off.height = img.height;
            const ox = off.getContext('2d');
            ox.drawImage(img,0,0);
            try{
              const data = ox.getImageData(0,0,off.width,off.height);
              const cols = (() => {
                const c = colorInput.value || window.hatColor || '#ff0000';
                const tmp = document.createElement('canvas'); tmp.width=1; tmp.height=1;
                const tctx = tmp.getContext('2d'); tctx.fillStyle = c; tctx.fillRect(0,0,1,1);
                const d = tctx.getImageData(0,0,1,1).data;
                return {r:d[0],g:d[1],b:d[2]};
              })();
              for(let i=0;i<data.data.length;i+=4){
                const r = data.data[i], g = data.data[i+1], b = data.data[i+2], a = data.data[i+3];
                if(a < 10) continue;
                if(r > g + 20 && r > b + 20){
                  const lum = (0.2126*r + 0.7152*g + 0.0722*b)/255;
                  data.data[i]   = Math.min(255, Math.round(cols.r * lum));
                  data.data[i+1] = Math.min(255, Math.round(cols.g * lum));
                  data.data[i+2] = Math.min(255, Math.round(cols.b * lum));
                }
              }
              ox.putImageData(data,0,0);
            }catch(e){ /* cross-origin fallback */ }

            const spriteInfo = renderPlayerPreview._lastSprite || { dx: Math.round(previewCanvas.width/2 - 22), dy: previewCanvas.height - 44 - 28, dw: 44, dh: 44 };
            const spriteW = spriteInfo.dw, spriteX = spriteInfo.dx, spriteY = spriteInfo.dy;
            const targetHatWidth = Math.max(22, Math.min(spriteW * 0.9, 56));
            const scale = targetHatWidth / Math.max(1, off.width);
            const hatW = Math.round(off.width * scale);
            const hatH = Math.round(off.height * scale);
            const hatX = Math.round(spriteX + spriteW/2 - hatW/2);
            const hatY = Math.round(spriteY - hatH - 6);
            previewCtx.drawImage(off, hatX, hatY, hatW, hatH);
          }catch(e){}
        };
        if(im.complete) drawHat(im);
        else im.onload = ()=> drawHat(im);
      }

      // label
      const nm = 'PLAYER PREVIEW';
      previewLabel.textContent = nm;
    }catch(e){}
  }

  // when the color input value changes we only update the cached value; actual redraw occurs on the periodic timer
  colorInput.addEventListener('input', ()=>{
    const swatch = colorInput;
    if(swatch) swatch.value = colorInput.value;
  });
  playerColorInput.addEventListener('input', ()=>{
    window.playerPreviewColor = playerColorInput.value;
    // also apply the chosen color live to your in-game player
    try{
      if(user && user.isUser){
        user.color = window.playerPreviewColor;
      }
    }catch(e){}
    renderPlayerPreview();
  });

  // open modal on button
  if(hatBtn){
    hatBtn.addEventListener('click', ()=>{
      modal.classList.add('active');
      refreshSelection();
      // start periodic updates if not already running
      if(modal._hatPreviewTimer) clearInterval(modal._hatPreviewTimer);
      updatePreviews();
      modal._hatPreviewTimer = setInterval(updatePreviews, 500);
    });
  }

  // OrgeYT_Real toggle wiring (title button)
  const orgeBtn = document.getElementById('orgeRealBtn');
  if(orgeBtn){
    function refreshOrgeBtn(){
      orgeBtn.textContent = window.orgeRealEnabled ? 'OrgeYT_Real: ON' : 'OrgeYT_Real';
      orgeBtn.style.boxShadow = window.orgeRealEnabled ? '0 6px 18px rgba(14,165,233,0.25)' : '';
    }
    orgeBtn.addEventListener('click', ()=>{
      window.orgeRealEnabled = !window.orgeRealEnabled;
      refreshOrgeBtn();
    });
    refreshOrgeBtn();
  }

  // NPC chat toggle wiring (title button)
  window.npcChatEnabled = (typeof window.npcChatEnabled === 'boolean') ? window.npcChatEnabled : true;
  try {
    import('./npcchatmessages.js').then(mod => { window._npcMessages = mod.npcMessages; }).catch(()=>{});
  } catch(e){}

  const npcChatBtn = document.getElementById('npcChatBtn');
  if(npcChatBtn){
    function refreshNpcChatBtn(){
      npcChatBtn.textContent = window.npcChatEnabled ? 'NPC Chat: ON' : 'NPC Chat: OFF';
      npcChatBtn.style.boxShadow = window.npcChatEnabled ? '0 6px 18px rgba(16,185,129,0.22)' : '';
      npcChatBtn.style.background = window.npcChatEnabled ? '#10b981' : '#9ca3af';
    }
    npcChatBtn.addEventListener('click', ()=>{
      window.npcChatEnabled = !window.npcChatEnabled;
      refreshNpcChatBtn();
    });
    refreshNpcChatBtn();
  }

  // Ultra-Sheld toggle wiring (title button)
  const shieldBtn = document.getElementById('shieldBtn');
  if(shieldBtn){
    function refreshShieldBtn(){
      shieldBtn.textContent = window.ultraShieldEnabled ? 'Ultra-Sheld: ON' : 'Ultra-Sheld: OFF';
      shieldBtn.style.boxShadow = window.ultraShieldEnabled ? '0 6px 18px rgba(6,182,212,0.22)' : '';
      shieldBtn.style.background = window.ultraShieldEnabled ? '#06b6d4' : '#475569';
    }
    shieldBtn.addEventListener('click', ()=>{
      window.ultraShieldEnabled = !window.ultraShieldEnabled;
      refreshShieldBtn();
    });
    refreshShieldBtn();
  }
})();

const nipplejs = (await import('nipplejs')).default;

const jumpBtn = document.getElementById('jumpBtn');

let running=false;
let spectating = false; // when true, user is spectating bots
let last = 0;
let accum = 0;
const gravity = 1100; // px/s^2
const MAX_JUMPS = 2; // allow double jump (max jumps per airborne sequence)
const groundPadding = 80;

// Ultra shield state
window.ultraShieldEnabled = (typeof window.ultraShieldEnabled === 'boolean') ? window.ultraShieldEnabled : false;
let shieldRot = 0; // rotation angle for drawing the shield
let shieldRadius = 82; // visual & collision radius
let _shieldBusyTransfer = false; // to avoid repeated transfers while handling one

// cheats state
let cheatsEnabled = false;   // when true, cheats are available
let noclipFlyActive = false; // when true (and cheatsEnabled) the user has noclip/fly

// spectator pan velocities (px/s)
let camPanVX = 0;
let camPanVY = 0;
const camPanSpeed = 420;

// camera follow
let camX = 0;
let camY = 0;
const camLerp = 8;

// Camera zoom state (affects how much world fits on screen).
// Change cameraZoom to zoom in/out; view width = W / cameraZoom, view height = H / cameraZoom.
let cameraZoom = 1.0;
const CAMERA_MIN_ZOOM = 0.6;
const CAMERA_MAX_ZOOM = 1.6;

// update camera when zoom changes to keep focus on the same world point (center of view)
function setCameraZoom(newZoom){
  const prev = cameraZoom;
  newZoom = Math.max(CAMERA_MIN_ZOOM, Math.min(CAMERA_MAX_ZOOM, newZoom));
  if(Math.abs(newZoom - prev) < 1e-5) return;
  // world-space center before zoom change
  const prevViewW = W / prev;
  const prevViewH = H / prev;
  const centerX = camX + prevViewW * 0.5;
  const centerY = camY + prevViewH * 0.5;
  cameraZoom = newZoom;
  // compute new camera so the same world center remains centered in view
  const newViewW = W / cameraZoom;
  const newViewH = H / cameraZoom;
  camX = centerX - newViewW * 0.5;
  camY = centerY - newViewH * 0.5;
  // allow camera to go anywhere — do not clamp camX/camY here
  // (we intentionally leave camX/camY as computed above)
}

 // Game objects
class Player {
  constructor(id,name,x,y,color,isUser=false){
    this.id=id;
    this.name = name || `NPC ${id}`;
    this.x=x; this.y=y;
    this.w=44; this.h=44;
    this.vx=0; this.vy=0;
    this.onGround=false;
    this.color=color;
    this.isUser = isUser;
    this.alive = true;
    this.hasBomb = false;
    this.aiTimer = Math.random()*2;
    this._aiTargetVx = 0;
    this.recentPassed = 0; // seconds remaining where this player cannot receive the bomb

    // persistent facing state so a stopped player keeps their last facing direction
    this.facingLeft = false;

    // escape/pathing state for smarter fleeing
    this.escapeTarget = null;      // platform object to head towards
    this.escapeTimer = 0;          // how long to keep trying this escape
    this.escapeCooldown = 0;       // cooldown before being allowed to pick same target again

    // NPC skill/type: 'noob', 'average', 'pro' (default average)
    // For the user player this will remain 'average' unless explicitly assigned.
    this.npcType = 'average';
    // convenience flags altered later in level creation (e.g. fast for pros)
    this.fast = !!this.fast;
    this.cannotGetBomb = !!this.cannotGetBomb;
    // jump tracking for double-jump support
    this.jumpsLeft = MAX_JUMPS;
  }
  rect(){ return {x:this.x, y:this.y, w:this.w, h:this.h}; }
  center(){ return {x:this.x+this.w/2, y:this.y+this.h/2}; }
}

const players = [];
const platforms = [];
let user;
let bombTimer = 0;
let bombDuration = 15;
let prevBombSecond = null; // tracked to play countdown tick when the displayed second decreases
let bombActive = false;
let bombHolder = null;
let nextGiveTimer = 2;
let gameState = 'title'; // title, playing, gameover

// last round outcome shown on title screen: "None" | "You won" | "You exploded" | "NPC won"
let recentOutcome = 'None';

// adjustable NPC count (used by level generation)
let NPC_COUNT = 10;

 // active explosion effects (visuals)
const explosions = [];
// visual pass animations (bomb flying from one player to another)
const passAnimations = [];

function randColor(){
  // richer palette + fallback procedural HSL with higher saturation for punchy colors
  const palette = [
    '#ff4b4b','#ff8a00','#ffd60a','#00c853','#00b0ff',
    '#7c4dff','#ff4081','#00bfa5','#d500f9','#ff6d00',
    '#c62828','#2e7d32','#00695c','#0277bd','#5e35b1'
  ];
  if(Math.random() < 0.55){
    return palette[Math.floor(Math.random()*palette.length)];
  }
  const h = Math.floor(Math.random()*360);
  const s = 85 + Math.floor(Math.random()*10); // 85-94% saturation
  const l = 48 + Math.floor(Math.random()*9);  // 48-56% lightness
  return `hsl(${h} ${s}% ${l}%)`;
}

function makeLevel(){
  players.length = 0;
  platforms.length = 0;
  // taller map: ground placed lower to give more climbable vertical space
  platforms.push({x:0, y:H-groundPadding, w:worldW, h:groundPadding});

  // larger small scale so platform steps are slightly thicker and easier to land on
  const small = Math.max(12, Math.min(28, Math.round(H * 0.028)));
  const midGap = Math.max(72, Math.round(H * 0.12));
  const baseY = H * 0.82;

  // denser stepping platforms along the ground band to improve lateral movement and provide ledge stepping
  const stepping = [
    {x: worldW*0.04, w: 120, y: baseY},
    {x: worldW*0.12, w: 130, y: baseY - Math.round(H * 0.03)},
    {x: worldW*0.20, w: 140, y: baseY - Math.round(H * 0.06)},
    {x: worldW*0.28, w: 120, y: baseY - Math.round(H * 0.02)},
    {x: worldW*0.36, w: 150, y: baseY - Math.round(H * 0.05)},
    {x: worldW*0.44, w: 140, y: baseY - Math.round(H * 0.08)},
    {x: worldW*0.52, w: 130, y: baseY - Math.round(H * 0.04)},
    {x: worldW*0.60, w: 140, y: baseY - Math.round(H * 0.07)},
    {x: worldW*0.68, w: 120, y: baseY - Math.round(H * 0.03)},
    {x: worldW*0.76, w: 130, y: baseY - Math.round(H * 0.06)},
    {x: worldW*0.84, w: 110, y: baseY},
  ];
  for(const s of stepping) platforms.push({x: Math.max(8, s.x), y: s.y, w: s.w, h: small});

  // more mids to build vertical chains
  const mids = [
    {x: worldW*0.08, w: 200, y: Math.max(H*0.56, H*0.68 - midGap*0.08)},
    {x: worldW*0.18, w: 160, y: Math.max(H*0.50, H*0.62 - midGap*0.10)},
    {x: worldW*0.30, w: 220, y: Math.max(H*0.46, H*0.58 - midGap*0.12)},
    {x: worldW*0.40, w: 180, y: Math.max(H*0.40, H*0.52 - midGap*0.14)},
    {x: worldW*0.52, w: 200, y: Math.max(H*0.36, H*0.48 - midGap*0.16)},
    {x: worldW*0.64, w: 160, y: Math.max(H*0.32, H*0.44 - midGap*0.18)},
    {x: worldW*0.76, w: 160, y: Math.max(H*0.28, H*0.40 - midGap*0.20)},
  ];
  for(const s of mids) platforms.push({x: Math.max(8, s.x), y: s.y, w: s.w, h: small});

  // additional high reward platforms to allow multi-hop ascents
  const highs = [
    {x: worldW*0.06, w: 120, y: Math.max(H*0.22, H*0.40 - midGap*0.6)},
    {x: worldW*0.22, w: 140, y: Math.max(H*0.16, H*0.34 - midGap*0.8)},
    {x: worldW*0.36, w: 140, y: Math.max(H*0.12, H*0.30 - midGap*1.0)},
    {x: worldW*0.50, w: 120, y: Math.max(H*0.08, H*0.26 - midGap*1.2)},
    {x: worldW*0.66, w: 120, y: Math.max(H*0.06, H*0.22 - midGap*1.3)},
    {x: worldW*0.82, w: 120, y: Math.max(H*0.04, H*0.18 - midGap*1.4)}
  ];
  for(const s of highs) platforms.push({x: Math.max(8, s.x), y: s.y, w: s.w, h: Math.max(10, Math.round(small*0.9))});

  // isolated short platforms for extra vertical risk/reward
  platforms.push({x: worldW*0.42, y: Math.max(H*0.62, H*0.74 - midGap*0.06), w: 90, h: Math.max(10, Math.round(small*0.9))});
  platforms.push({x: worldW*0.58, y: Math.max(H*0.58, H*0.70 - midGap*0.08), w: 100, h: Math.max(10, Math.round(small*0.9))});

  // add 30 extra small/random platforms to increase vertical navigation options
  for(let i=0;i<30;i++){
    const pw = 60 + Math.round(Math.random()*120); // width 60-180
    const py = Math.round(H*0.08 + Math.random() * (H*0.72));
    const px = Math.round(20 + Math.random() * (worldW - pw - 40));
    platforms.push({ x: px, y: py, w: pw, h: Math.max(10, Math.round(small*0.9)) });
  }

  // top wall to block going above (span worldW)
  platforms.push({x: -200, y: -48, w: worldW+400, h: 48});

  // names list for NPCs
  const names = NPC_NAMES.slice();

  // players spread across the wider world, start on ground near platforms
  const startY = H - groundPadding - 44 - 2;

  // choose NPCs according to global NPC_COUNT
  const namePool = names.slice();
  const chosen = [];
  const take = Math.max(2, Math.min(50, Math.floor(NPC_COUNT) || 10));
  for(let k=0;k<take && namePool.length>0;k++){
    const idx = Math.floor(Math.random() * namePool.length);
    chosen.push(namePool.splice(idx,1)[0]);
  }

  // Ensure exactly one NPC is named "OrgeYT" (your username).
  // If it wasn't picked, replace a random chosen name with OrgeYT.
  if(!chosen.includes('OrgeYT')){
    if(chosen.length > 0){
      const replaceIdx = Math.floor(Math.random() * chosen.length);
      chosen[replaceIdx] = 'OrgeYT';
    } else {
      chosen.push('OrgeYT');
    }
  } else {
    // If by chance OrgeYT appeared more than once (shouldn't happen with no-replace selection),
    // dedupe so only one remains.
    let found = false;
    for(let i = 0; i < chosen.length; i++){
      if(chosen[i] === 'OrgeYT'){
        if(!found) found = true;
        else chosen[i] = namePool.length ? namePool.splice(Math.floor(Math.random()*namePool.length),1)[0] : ('OrgeYT_'+i);
      }
    }
  }

  // If OrgeYT_Real toggle enabled, ensure exactly one NPC named "OrgeYT_Real" is present.
  if(window.orgeRealEnabled){
    if(!chosen.includes('OrgeYT_Real')){
      if(chosen.length > 0){
        // replace a random non-OrgeYT entry (but don't replace OrgeYT)
        let idx = Math.floor(Math.random() * chosen.length);
        // ensure not replacing OrgeYT
        if(chosen[idx] === 'OrgeYT'){
          idx = (idx + 1) % chosen.length;
        }
        chosen[idx] = 'OrgeYT_Real';
      } else {
        chosen.push('OrgeYT_Real');
      }
    } else {
      // dedupe extra occurrences if any
      let found = false;
      for(let i = 0; i < chosen.length; i++){
        if(chosen[i] === 'OrgeYT_Real'){
          if(!found) found = true;
          else chosen[i] = namePool.length ? namePool.splice(Math.floor(Math.random()*namePool.length),1)[0] : ('OrgeYT_Real_'+i);
        }
      }
    }
  }

  // total players: user + chosen NPCs
  // If spectating, we will not create a "You" player — all entries are NPCs.
  const totalPlayers = 1 + chosen.length;
  // distribute players evenly across the expanded world to avoid clustering,
  // while allowing a small bounded jitter for more natural spacing
  const minSpacing = 120;
  const spacing = Math.max(minSpacing, worldW / (totalPlayers + 1));

  // small hat selection pool (some images may have red parts that we will recolor at render time)
  const HAT_POOL = [
    '/beany.png',
    '/top hat.png',
    '/traffic cone.png',
    '/santa hat.png',
    '/mini player.png',
    '/hele.png',
    '/Bomb hat.png'
  ];

  for(let i=0;i<totalPlayers;i++){
    const baseX = spacing * (i + 1);
    // small jitter but clamped so players remain a reasonable distance apart
    const jitterMax = Math.min(spacing * 0.12, 80);
    const jitter = (Math.random() * 2 - 1) * jitterMax;
    const px = Math.max(8, Math.min(worldW - 8 - 44, Math.round(baseX + jitter)));
    const isUser = (i===0 && !spectating); // only true if not spectating
    // name is "You" only when it's the actual user (not in spectate mode)
    const candidateName = isUser ? myUsername : chosen[i-1];
    const color = (!isUser && candidateName === 'OrgeYT') ? '#ff8a00' : randColor();
    const name = candidateName || `NPC ${i}`;
    const p = new Player(i, name, px, startY, color, isUser);

    // assign NPC type for non-user players using new rarity: 3% Pro, 12% Noob, 85% Average
    if(!isUser){
      const r = Math.random();
      if(r < 0.03){
        p.npcType = 'pro';
        p.fast = true;
      } else if(r < 0.15){
        p.npcType = 'noob';
      } else {
        p.npcType = 'average';
      }
    } else {
      // ensure user keeps their chosen hat/color but default npcType remains 'average'
      p.npcType = p.npcType || 'average';
    }

    // apply user's chosen hat and hatColor when this player is the user
    if(isUser){
      p.hat = window.selectedHat || null;
      p.hatColor = window.hatColor || color;
      // ensure the user's body color applies the saved preview/player color
      p.color = window.playerPreviewColor || p.color;
    } else {
      // Special OrgeYT_Real behavior: spawn a fast blue NPC with a black beany hat that cannot receive the bomb
      if(p.name === 'OrgeYT_Real'){
        p.color = '#00b0ff'; // bright blue
        p.hat = '/beany.png';
        p.hatColor = '#000000'; // render as black beany
        p.cannotGetBomb = true; // immune to bomb assignment/transfers
        p.fast = true; // movement/AI multiplier applied in updateAI
        p.npcType = 'pro';
      } else {
        // NPCs: 75% chance to have a hat; if so pick random model and give it a vivid random hat color.
        if(Math.random() < 0.75){
          p.hat = HAT_POOL[Math.floor(Math.random() * HAT_POOL.length)];
          p.hatColor = randColor();
        } else {
          p.hat = null;
          p.hatColor = null;
        }
      }
    }
    players.push(p);
    if(isUser) user = p;
  }

  // Ensure at least one NPC of each skill type (noob, pro, average) exists among non-user NPCs.
  (function ensureNpcTypeDiversity(){
    const npcs = players.filter(pp => !pp.isUser);
    if(npcs.length === 0) return;
    const has = { noob: false, pro: false, average: false };
    for(const n of npcs){
      has[n.npcType || 'average'] = true;
    }
    const missing = Object.keys(has).filter(k => !has[k]);
    // For each missing type, pick a random NPC and set their type accordingly.
    for(const m of missing){
      // prefer changing an NPC that isn't OrgeYT/OrgeYT_Real and isn't marked special (cannotGetBomb)
      const candidates = npcs.filter(x => !x.cannotGetBomb && x.name !== 'OrgeYT' && x.name !== 'OrgeYT_Real');
      const pool = candidates.length ? candidates : npcs;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      if(!pick) continue;
      pick.npcType = m;
      // if making a pro, keep movement fair but mark skillful
      if(m === 'pro'){
        pick.fast = pick.fast || true;
      }
      // ensure noob flag doesn't accidentally keep fastness
      if(m === 'noob'){
        pick.fast = false;
      }
    }
  })();

  // center camera initially on user if present, otherwise center on world
  if(user){
    // center camera on user using zoom-aware view size
    camX = user.x - (W / (2 * cameraZoom));
    camY = user.y - (H / (2 * cameraZoom));
  } else {
    camX = Math.max(0, Math.min(worldW - (W / cameraZoom), worldW/2 - (W / (2 * cameraZoom))));
    camY = 0;
  }
  // do not clamp camera on level creation — allow free camera positioning
}

function startGame(){
  makeLevel();
  bombActive=false;
  bombHolder=null;
  bombTimer=0;
  nextGiveTimer=2;
  gameState='playing';
  overlay.classList.add('hidden');
  gameOverEl.classList.add('hidden');
  // hide focus button when entering an active game (not spectating)
  if(focusPlayerBtn) focusPlayerBtn.classList.add('hidden');
  running=true;
  last = performance.now();
  playersLeftEl.textContent = `Players: ${players.filter(p=>p.alive).length}`;
  loop(last);
}

function endGame(text){
  // return player to the title overlay instead of a separate game-over screen
  gameState = 'title';
  running = false;

  // reset overlay to the original title card state
  overlay.classList.remove('hidden');
  gameOverEl.classList.add('hidden');

  // restore title card header and basic UI hints
  const card = overlay.querySelector('.card');
  if(card){
    const h1 = card.querySelector('h1');
    if(h1) h1.textContent = 'Pass The Bomb';
    // ensure the npc range label reflects current NPC_COUNT
    const label = card.querySelector('#npcCountLabel');
    const range = card.querySelector('#npcRange');
    if(label && range){
      range.value = NPC_COUNT;
      label.textContent = range.value;
    }
  }

  // update recent outcome label on title screen
  try{
    const recentEl = document.getElementById('recentLabel');
    if(recentEl) recentEl.textContent = recentOutcome || 'None';
  }catch(e){}

  // hide in-game specific UI
  bombTimerEl.classList.add('hidden');
  if(unpauseBtn) unpauseBtn.classList.add('hidden');

  // hide focus player HUD when returning to title / non-spectate mode
  if(focusPlayerBtn) focusPlayerBtn.classList.add('hidden');

  // ensure pause button appears in default state
  pauseBtn.classList.remove('paused');
  pauseBtn.textContent = 'Pause';
}

startBtn.onclick = () => { 
  // read chosen NPC count before starting
  NPC_COUNT = npcRange ? Math.max(2, Math.min(50, parseInt(npcRange.value)||10)) : 10;
  spectating = false; 
  startGame(); 
};
restartBtn.onclick = () => { 
  NPC_COUNT = npcRange ? Math.max(2, Math.min(50, parseInt(npcRange.value)||10)) : 10;
  spectating = false; 
  startGame(); 
};

// Toggle cheats button on title screen
if(typeof toggleCheatsBtn !== 'undefined' && toggleCheatsBtn){
  toggleCheatsBtn.addEventListener('click', ()=>{
    cheatsEnabled = !cheatsEnabled;
    toggleCheatsBtn.textContent = cheatsEnabled ? 'Cheats: ON (press F to toggle fly/noclip)' : 'Toggle cheats';
    // small visual hint in overlay card title when cheats are enabled
    if(cheatsEnabled){
      overlay.querySelector('.card').querySelector('h1').textContent = 'Pass The Bomb — Cheats Enabled';
    } else {
      overlay.querySelector('.card').querySelector('h1').textContent = 'Pass The Bomb';
      // ensure noclip/fly is turned off when disabling cheats
      noclipFlyActive = false;
    }
  });
}

// spectate button: let player watch bots and control camera
function updateSpectateFocusList(){
  // build ordered list of non-user players sorted alphabetically by name
  spectateFocusList = players
    .map((p, idx) => ({p, idx}))
    .filter(o => !o.p.isUser && o.p.alive)
    .sort((a,b) => (''+a.p.name).localeCompare(b.p.name))
    .map(o => o.idx);
  if(spectateFocusList.length === 0){
    spectateFocusIndex = -1;
  } else {
    spectateFocusIndex = Math.min(Math.max(0, spectateFocusIndex), spectateFocusList.length - 1);
  }
}

function setSpectateFocus(enabled){
  spectateFocus = !!enabled;
  if(spectateFocus){
    updateSpectateFocusList();
    if(spectateFocusList.length === 0) spectateFocus = false;
  }
  // update button label
  if(focusPlayerBtn){
    focusPlayerBtn.textContent = spectateFocus ? `Focus: ${getFocusedPlayerName()}` : 'Focus Player: OFF';
  }
}

function getFocusedPlayer(){
  if(!spectateFocus || spectateFocusList.length === 0) return null;
  const idx = spectateFocusList[spectateFocusIndex];
  return players[idx] || null;
}
function getFocusedPlayerName(){
  const fp = getFocusedPlayer();
  return fp ? fp.name : 'NONE';
}

function cycleSpectateFocus(delta){
  if(!spectateFocusList || spectateFocusList.length === 0) return;
  spectateFocusIndex = (spectateFocusIndex + delta + spectateFocusList.length) % spectateFocusList.length;
  if(focusPlayerBtn) focusPlayerBtn.textContent = `Focus: ${getFocusedPlayerName()}`;
}

function startSpectate(){
  // read chosen NPC count before starting spectate
  NPC_COUNT = npcRange ? Math.max(2, Math.min(20, parseInt(npcRange.value)||10)) : 10;
  spectating = true;
  makeLevel();
  // ensure the user is not controlling a player: keep the "user" flag false on the first player
  if(players[0]) players[0].isUser = false;
  bombActive=false;
  bombHolder=null;
  bombTimer=0;
  nextGiveTimer=2;
  gameState='playing';
  overlay.classList.add('hidden');
  gameOverEl.classList.add('hidden');
  running=true;
  last = performance.now();
  // place camera to center of world initial
  camX = worldW/2 - W/2;
  camY = 0;
  camPanVX = camPanVY = 0;
  // reset and show focus UI
  setSpectateFocus(false);
  if(focusPlayerBtn) focusPlayerBtn.classList.remove('hidden');
  loop(last);
}
spectateBtn.onclick = () => startSpectate();

// Pause state
let paused = false;
let autoPaused = false;

function pauseGame(auto=false){
  if(paused) return;
  paused = true;
  autoPaused = !!auto;
  running = false;
  pauseBtn.classList.add('paused');
  pauseBtn.textContent = 'Resume';
  // show overlay lightly so user sees paused state
  overlay.classList.remove('hidden');
  overlay.querySelector('.card').querySelector('h1').textContent = 'Paused';
  // reveal Unpause button in overlay if present
  if(typeof unpauseBtn !== 'undefined' && unpauseBtn){
    unpauseBtn.classList.remove('hidden');
  }
  // ensure showPauseBtn (HUD) is hidden while overlay is visible
  if(showPauseBtn) showPauseBtn.classList.add('hidden');

  // ensure a Hide Pause Menu button exists inside the overlay card
  try{
    const card = overlay.querySelector('.card');
    if(card && !card.querySelector('#hidePauseBtn')){
      const b = document.createElement('button');
      b.id = 'hidePauseBtn';
      b.textContent = 'Hide pause menu';
      b.style.marginTop = '8px';
      b.onclick = ()=>{
        // hide overlay but keep game paused; reveal HUD "Show Pause Menu" button
        overlay.classList.add('hidden');
        if(showPauseBtn) showPauseBtn.classList.remove('hidden');
      };
      // insert next to the unpause button if available, otherwise append
      const after = card.querySelector('#unpauseBtn');
      if(after && after.parentNode) after.parentNode.insertBefore(b, after.nextSibling);
      else card.appendChild(b);
    }
  }catch(e){}
}

function resumeGame(){
  if(!paused) return;
  paused = false;
  autoPaused = false;
  pauseBtn.classList.remove('paused');
  pauseBtn.textContent = 'Pause';
  overlay.classList.add('hidden');
  // hide Unpause button if present
  if(typeof unpauseBtn !== 'undefined' && unpauseBtn){
    unpauseBtn.classList.add('hidden');
  }
  // ensure HUD show button is hidden when resuming
  if(showPauseBtn) showPauseBtn.classList.add('hidden');
  // resume loop
  running = true;
  last = performance.now();
  loop(last);
}

pauseBtn.addEventListener('click', ()=>{
  if(paused) resumeGame();
  else pauseGame(false);
});
if(showPauseBtn){
  showPauseBtn.addEventListener('click', ()=>{
    // restore overlay (show the pause menu) but keep game paused
    overlay.classList.remove('hidden');
    // hide the HUD button once overlay is visible
    showPauseBtn.classList.add('hidden');
    // ensure Unpause button visible inside overlay
    if(typeof unpauseBtn !== 'undefined' && unpauseBtn){
      unpauseBtn.classList.remove('hidden');
    }
  });
}

 // unpause button (in-overlay) to resume quickly
 if(typeof unpauseBtn !== 'undefined' && unpauseBtn){
   unpauseBtn.addEventListener('click', ()=>{
     resumeGame();
   });
 }

 // Focus Player HUD button handler (spectating)
 if(focusPlayerBtn){
   focusPlayerBtn.addEventListener('click', ()=>{
     if(!spectating) return;
     // toggle focus mode
     setSpectateFocus(!spectateFocus);
     // if enabling focus, ensure list and label are updated
     if(spectateFocus){
       updateSpectateFocusList();
       if(spectateFocusList.length === 0){
         setSpectateFocus(false);
       } else {
         spectateFocusIndex = 0;
         focusPlayerBtn.textContent = `Focus: ${getFocusedPlayerName()}`;
       }
     } else {
       focusPlayerBtn.textContent = 'Focus Player: OFF';
     }
   });
   // hide focus when not spectating initially
   if(!spectating) focusPlayerBtn.classList.add('hidden');
 }

// auto-pause on blur, auto-resume on focus if we auto-paused
addEventListener('visibilitychange', ()=>{
  if(document.hidden){
    if(gameState === 'playing' && running){
      pauseGame(true);
    }
  } else {
    if(gameState === 'playing' && paused && autoPaused){
      resumeGame();
    }
  }
});

// also handle window blur/focus for browsers that don't toggle visibility quickly
addEventListener('blur', ()=>{
  if(gameState === 'playing' && running){
    pauseGame(true);
  }
});
addEventListener('focus', ()=>{
  if(gameState === 'playing' && paused && autoPaused){
    resumeGame();
  }
});

 // Controls state
 const input = {left:false,right:false,jump:false};
 jumpBtn.addEventListener('pointerdown',()=>{
   input.jump=true;
   setTimeout(()=>input.jump=false,150);
 });

 // Player chat input wiring: allow the real player to type messages that show as speech bubbles
 const chatInput = document.getElementById('chatInput');
 // chat log button and modal
 const chatLogBtn = document.getElementById('chatLogBtn');
 // chat log storage (recent messages)
 const chatLog = []; // {name, color, text, hasBomb, ts}
let chatAutoScroll = true; // when true, chat log auto-scrolls to the bottom when updated
 // helper to push a message into chatLog (keeps max entries)
 function pushChatLog(entry){
   if(!entry || !entry.text) return;
   chatLog.push({ name: entry.name||'?', color: entry.color||'#fff', text: entry.text, hasBomb: !!entry.hasBomb, ts: Date.now() });
   if(chatLog.length > 300) chatLog.splice(0, chatLog.length - 300);
   // if modal open, refresh
   const list = document.getElementById('chatLogList');
   if(list) renderChatLog();
 }
 // build chat log modal UI
 (function buildChatLogModal(){
   const modal = document.createElement('div');
   modal.id = 'chatLogModal';
   modal.innerHTML = `
    <div id="chatLogHeader" style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.04)">
      <h3 style="margin:0">Chat Log</h3>
      <div style="display:flex;gap:8px;align-items:center;">
        <button id="chatAutoScrollBtn" style="padding:6px 8px;border-radius:6px;border:0;background:#10b981;color:#fff;cursor:pointer;">Auto-scroll: ON</button>
        <button id="chatLogClear" style="padding:6px 8px;border-radius:6px;border:0;background:#ef4444;color:#fff;cursor:pointer;">Clear</button>
        <button id="chatCopyBtn" style="padding:6px 8px;border-radius:6px;border:0;background:#2563eb;color:#fff;cursor:pointer;">Copy</button>
        <button id="chatForceBtn" style="padding:6px 8px;border-radius:6px;border:0;background:#f59e0b;color:#111;cursor:pointer;">Force chat all</button>
      </div>
    </div>
    <div id="chatLogList"></div>
    <div id="chatLogFooter"><small style="color:#666;">Showing recent NPC & player messages</small></div>
  `;
  document.body.appendChild(modal);
  // Close now handled by the chat log toggle button (speech emoji). Only keep clear handler.
  modal.querySelector('#chatLogClear').addEventListener('click', ()=>{
    chatLog.length = 0;
    renderChatLog();
  });

  // Copy chat log button
  const copyBtn = modal.querySelector('#chatCopyBtn');
  if(copyBtn){
    copyBtn.addEventListener('click', async ()=>{
      try{
        // Build header with multiplayer id if available
        const mpId = (typeof websimRoom === 'object' && websimRoom && websimRoom.clientId) ? websimRoom.clientId : 'local';
        const header = `Pass the bomb CHAT LOG from (${mpId})\n\n`;

        // Format each chat entry: {Username} {has bomb or not}: {Message}
        const lines = chatLog.map(m => {
          const name = m.name || '?';
          const bombTag = m.hasBomb ? 'HAS BOMB' : 'NO BOMB';
          const text = m.text || '';
          return `${name} [${bombTag}]: ${text}`;
        });

        const out = header + lines.join('\n');
        if(navigator.clipboard && navigator.clipboard.writeText){
          await navigator.clipboard.writeText(out);
          copyBtn.textContent = 'Copied!';
          setTimeout(()=> copyBtn.textContent = 'Copy', 1400);
        } else {
          // fallback: open new window with the text so user can copy manually
          const w = window.open('', '_blank');
          if(w){
            w.document.title = 'Chat Log';
            const pre = w.document.createElement('pre');
            pre.textContent = out;
            w.document.body.appendChild(pre);
          }
        }
      }catch(e){
        console.warn('Copy failed', e);
        copyBtn.textContent = 'Failed';
        setTimeout(()=> copyBtn.textContent = 'Copy', 1400);
      }
    });
  }

  // Build category UI and Force chat all button: make all NPCs speak a random message from the selected npcchatmessages category
  // create a small category bar area in the modal header if available
  (function setupForceChatCategories(){
    const categoryBarId = 'chatCategoryBar';
    // ensure a container exists in the modal header (if not, create one)
    let categoryBar = modal.querySelector('#' + categoryBarId);
    if(!categoryBar){
      const header = modal.querySelector('#chatLogHeader');
      categoryBar = document.createElement('div');
      categoryBar.id = categoryBarId;
      categoryBar.style.display = 'flex';
      categoryBar.style.gap = '6px';
      categoryBar.style.overflow = 'auto';
      categoryBar.style.paddingTop = '4px';
      if(header) header.appendChild(categoryBar);
    }

    // determine available categories from npcMessages (prefer dynamic cache)
    let availableCategories = [];
    try{
      if(window._npcMessages && typeof window._npcMessages === 'object'){
        availableCategories = Object.keys(window._npcMessages).filter(k=>Array.isArray(window._npcMessages[k]));
      } else if(npcMessages && typeof npcMessages === 'object'){
        availableCategories = Object.keys(npcMessages).filter(k=>Array.isArray(npcMessages[k]));
      }
    }catch(e){ /* ignore */ }
    if(!availableCategories || availableCategories.length === 0) availableCategories = ['normal'];

    // create or reuse a category label in the footer
    let categoryLabel = modal.querySelector('#chatCategoryLabel');
    if(!categoryLabel){
      const footer = modal.querySelector('#chatLogFooter');
      if(footer){
        categoryLabel = document.createElement('div');
        categoryLabel.id = 'chatCategoryLabel';
        categoryLabel.style.fontSize = '12px';
        categoryLabel.style.color = '#999';
        categoryLabel.textContent = 'Category: normal';
        footer.appendChild(categoryLabel);
      }
    }

    // selected category state
    let selectedCategory = availableCategories.includes('normal') ? 'normal' : availableCategories[0];

    function renderCategoryButtons(){
      categoryBar.innerHTML = '';
      for(const cat of availableCategories){
        const b = document.createElement('button');
        b.className = 'chatCategoryBtn';
        b.textContent = cat;
        b.style.padding = '6px 10px';
        b.style.borderRadius = '8px';
        b.style.border = '0';
        b.style.cursor = 'pointer';
        b.style.background = (cat === selectedCategory) ? '#111827' : 'rgba(255,255,255,0.04)';
        b.style.color = (cat === selectedCategory) ? '#fff' : '#ddd';
        b.addEventListener('click', ()=>{
          selectedCategory = cat;
          if(categoryLabel) categoryLabel.textContent = `Category: ${selectedCategory}`;
          renderCategoryButtons();
        });
        categoryBar.appendChild(b);
      }
      if(categoryLabel) categoryLabel.textContent = `Category: ${selectedCategory}`;
    }
    renderCategoryButtons();

    // Wire the existing Force chat all button to use selectedCategory
    const forceBtn2 = modal.querySelector('#chatForceBtn');
    if(forceBtn2){
      forceBtn2.addEventListener('click', ()=>{
        try{
          const pool = (window._npcMessages && Array.isArray(window._npcMessages[selectedCategory])) ? window._npcMessages[selectedCategory]
                      : (npcMessages && Array.isArray(npcMessages[selectedCategory])) ? npcMessages[selectedCategory]
                      : null;
          if(!pool || !pool.length){
            forceBtn2.textContent = 'No msgs';
            setTimeout(()=> forceBtn2.textContent = 'Force chat all', 900);
            return;
          }
          for(const p of players){
            if(!p.alive || p.isUser) continue;
            const msg = pool[Math.floor(Math.random() * pool.length)];
            p.chatText = msg;
            p.chatTimer = 2.5 + Math.random() * 2.0;
            pushChatLog({ name: p.name, color: p.hatColor || p.color || '#111', text: p.chatText, hasBomb: !!p.hasBomb });
          }
          renderChatLog();
          forceBtn2.textContent = `Sent (${selectedCategory})`;
          setTimeout(()=> forceBtn2.textContent = 'Force chat all', 900);
        }catch(e){
          console.warn('Force chat failed', e);
        }
      });
    }
  })();

  // Wire auto-scroll toggle button to flip chatAutoScroll and refresh the UI
  const autoScrollBtn = modal.querySelector('#chatAutoScrollBtn');
  if(autoScrollBtn){
    autoScrollBtn.addEventListener('click', ()=>{
      chatAutoScroll = !chatAutoScroll;
      renderChatLog();
    });
  }
 })();
 function renderChatLog(){
   const list = document.getElementById('chatLogList');
   const modal = document.getElementById('chatLogModal');
   if(!list || !modal) return;
   list.innerHTML = '';
   // show last 120 messages most recent at bottom
   const slice = chatLog.slice(-120);
   for(const msg of slice){
     const row = document.createElement('div');
     row.className = 'chatLogRow';
     const nameEl = document.createElement('div');
     nameEl.className = 'chatLogName';
     nameEl.textContent = msg.name;
     nameEl.style.color = msg.color || '#111';
     const msgEl = document.createElement('div');
     msgEl.className = 'chatLogMsg';
     msgEl.textContent = msg.text;
     row.appendChild(nameEl);
     if(msg.hasBomb){
       const badge = document.createElement('div');
       badge.className = 'chatLogBadge';
       badge.textContent = 'HAS BOMB';
       nameEl.appendChild(badge);
     }
     row.appendChild(msgEl);
     list.appendChild(row);
   }

   // update auto-scroll button state if present
   const autoBtn = document.getElementById('chatAutoScrollBtn');
   if(autoBtn){
     autoBtn.textContent = chatAutoScroll ? 'Auto-scroll: ON' : 'Auto-scroll: OFF';
     autoBtn.style.background = chatAutoScroll ? '#10b981' : '#9ca3af';
   }

   // only auto-scroll when enabled; preserve user's scroll position otherwise
   if(chatAutoScroll){
     list.scrollTop = list.scrollHeight;
   }
 }
 if(chatLogBtn){
   chatLogBtn.addEventListener('click', ()=>{
     const modal = document.getElementById('chatLogModal');
     if(!modal) return;
     modal.classList.toggle('active');
     if(modal.classList.contains('active')) renderChatLog();
   });
 }

 if(chatInput){
   // small styling tweak to ensure touch targets are comfortable
   chatInput.style.width = '100%';
   chatInput.style.padding = '10px 12px';
   chatInput.style.borderRadius = '10px';
   chatInput.style.border = '1px solid rgba(0,0,0,0.12)';
   chatInput.style.fontSize = '14px';
   chatInput.style.boxSizing = 'border-box';
   chatInput.addEventListener('keydown', (e)=>{
     if(e.key === 'Enter'){
       const text = String(chatInput.value || '').trim();
       if(text.length === 0){ chatInput.value = ''; return; }
       // only allow sending when the local user player exists and is the user's player (not spectating)
       if(user && user.isUser && user.alive){
         user.chatText = text.slice(0, 120);
         user.chatTimer = 3.0; // show bubble for 3s
         // if user holds the bomb, reduce chance of immediate AI chatter overlap by clearing their aiTimer
         user.aiTimer = Math.max(0.4, user.aiTimer);
         // push to global chat log immediately (capture bomb state at time of send)
         pushChatLog({ name: user.name || 'You', color: user.hatColor || user.color || '#111', text: user.chatText, hasBomb: !!user.hasBomb });
       }
       chatInput.value = '';
     }
   });

   // focus behavior on tap so mobile users can type quickly
   chatInput.addEventListener('pointerdown', ()=> chatInput.focus());
 }

 // create nipple.js joystick in the left-bottom zone (static visible pad)
const joystickZone = document.getElementById('joystickZone');
const joystick = nipplejs.create({
  zone: joystickZone,
  mode: 'static',                 // static so the stick is visible by default
  position: { left: '80px', bottom: '80px' },
  color: '#fff',
  size: 110,
  multitouch: false
});

let joyActive = false;
joystick.on('start', () => { joyActive = true; });
joystick.on('move', (evt, data) => {
  if(!data) return;
  const angle = data.angle && data.angle.degree !== undefined ? data.angle.degree : 0;
  const dist = data.distance || 0;
  const TH = 8;
  if(dist < TH){
    input.left = input.right = input.up = input.down = false;
    return;
  }
  // map joystick direction to left/right/up/down for both play and spectate
  const rad = angle * Math.PI / 180;
  const nx = Math.cos(rad);
  const ny = Math.sin(rad);
  // horizontal
  if(nx > 0.25){ input.right = true; input.left = false; }
  else if(nx < -0.25){ input.left = true; input.right = false; }
  else { input.left = input.right = false; }
  // vertical (joystick up should pan camera up in spectate, or be ignored for gameplay)
  if(ny < -0.25){ input.up = true; input.down = false; }
  else if(ny > 0.25){ input.down = true; input.up = false; }
  else { input.up = input.down = false; }
});
joystick.on('end', () => {
  joyActive = false;
  input.left = input.right = false;
});

 // allow dragging the main canvas to pan camera while spectating (mouse/touch)
 // pointer-based pan: only active when spectating
 let canvasPanning = false;
 let canvasPanStart = null;
 let canvasCamStart = null;
 canvas.addEventListener('pointerdown', (ev)=>{
   // only start panning when spectating is active
   if(!spectating) return;
   canvas.setPointerCapture(ev.pointerId);
   canvasPanning = true;
   canvasPanStart = {x: ev.clientX, y: ev.clientY};
   canvasCamStart = {x: camX, y: camY};
 });
 canvas.addEventListener('pointermove', (ev)=>{
   if(!canvasPanning) return;
   const dx = (ev.clientX - canvasPanStart.x);
   const dy = (ev.clientY - canvasPanStart.y);
   // convert screen movement to world camera delta (respecting zoom)
   const worldDX = dx / cameraZoom;
   const worldDY = dy / cameraZoom;
   const newX = canvasCamStart.x - worldDX;
   const newY = canvasCamStart.y - worldDY;
   camX = Math.max(0, Math.min(worldW - (W / cameraZoom), newX));
   camY = Math.max(-H*0.2, Math.min(H*0.2, newY));
 });
 canvas.addEventListener('pointerup', (ev)=>{
   if(!canvasPanning) return;
   canvasPanning = false;
   try{ canvas.releasePointerCapture(ev.pointerId); }catch(e){}
 });
 canvas.addEventListener('pointercancel', (ev)=>{
   canvasPanning = false;
   try{ canvas.releasePointerCapture(ev.pointerId); }catch(e){}
 });

// also allow two-finger/touch pan via wheel-like gestures on touch by listening to wheel for trackpads
canvas.addEventListener('wheel', (ev)=>{
  // allow zoom with wheel when ctrl/shift not held; when spectating allow pan if zooming not desired
  ev.preventDefault();
  const delta = ev.deltaY;
  // if Alt or Meta pressed, treat wheel as zoom; otherwise if not spectating pan camera
  if(ev.altKey || ev.metaKey || ev.ctrlKey || !spectating){
    // zoom in/out: wheel up (negative delta) -> zoom in
    const factor = Math.pow(1.025, -Math.sign(delta) * Math.min(12, Math.abs(delta) / 53));
    setCameraZoom(cameraZoom * factor);
  } else {
    // panning via wheel while spectating
    const speed = 1.0;
    const worldDX = ev.deltaX / cameraZoom;
    const worldDY = ev.deltaY / cameraZoom;
    // free pan without clamping
    camX = camX + worldDX * speed;
    camY = camY + worldDY * speed;
  }
},{passive:false});

addEventListener('keydown',(e)=>{
  // movement / spectate pan
  if(e.key==='a' || e.key==='ArrowLeft') {
    input.left=true;
    // when spectate focus is active, left/right switch the focused player
    if(spectating && spectateFocus){
      cycleSpectateFocus(-1);
      e.preventDefault();
      return;
    }
  }
  if(e.key==='d' || e.key==='ArrowRight') {
    input.right=true;
    if(spectating && spectateFocus){
      cycleSpectateFocus(1);
      e.preventDefault();
      return;
    }
  }
  if(e.key==='w' || e.key==='ArrowUp') {
    if(spectating) input.up = true;
    else { 
      // when noclip/fly active, treat W as ascend; otherwise as jump
      if(noclipFlyActive && cheatsEnabled && user && user.isUser){
        input.up = true;
      } else {
        input.jump=true; setTimeout(()=>input.jump=false,150);
      }
    }
  }
  if(e.key==='s' || e.key==='ArrowDown') {
    if(spectating) input.down = true;
    else {
      if(noclipFlyActive && cheatsEnabled && user && user.isUser){
        input.down = true;
      }
    }
  }
  if(e.key===' ' && !spectating && !(noclipFlyActive && cheatsEnabled)) { input.jump=true; setTimeout(()=>input.jump=false,150); }

  // zoom keyboard shortcuts: '=' or '+' to zoom in, '-' to zoom out
  if(e.key === '=' || e.key === '+'){ setCameraZoom(cameraZoom * 1.08); }
  if(e.key === '-' || e.key === '_'){ setCameraZoom(cameraZoom / 1.08); }

  // Toggle noclip/fly with F when cheats are enabled
  if((e.key === 'f' || e.key === 'F') && cheatsEnabled){
    noclipFlyActive = !noclipFlyActive;
    // brief on-screen hint in overlay (only visible on title); if in-game, show HUD timer briefly by reusing bombTimerEl
    if(overlay && !overlay.classList.contains('hidden')){
      overlay.querySelector('.card').querySelector('h1').textContent = noclipFlyActive ? 'Pass The Bomb — Fly/Noclip ON' : 'Pass The Bomb — Cheats Enabled';
    } else {
      // show a quick HUD hint by toggling bombTimerEl text briefly
      bombTimerEl.classList.remove('hidden');
      bombTimerEl.textContent = noclipFlyActive ? 'FLY' : 'NOCLIP OFF';
      setTimeout(()=>{ if(!bombActive) bombTimerEl.classList.add('hidden'); }, 1200);
    }
  }

  // Escape toggles pause/resume
  if(e.key === 'Escape'){
    if(paused) resumeGame();
    else if(gameState === 'playing') pauseGame(false);
  }
});
addEventListener('keyup',(e)=>{
  if(e.key==='a' || e.key==='ArrowLeft') input.left=false;
  if(e.key==='d' || e.key==='ArrowRight') input.right=false;
  if(e.key==='w' || e.key==='ArrowUp') input.up=false;
  if(e.key==='s' || e.key==='ArrowDown') input.down=false;
});

// Physics helpers
function collideRect(a,b){
  return !(a.x+a.w < b.x || a.x > b.x+b.w || a.y+a.h < b.y || a.y > b.y+b.h);
}

function resolvePlatform(p, dt){
  p.onGround = false;
  for(const plat of platforms){
    // quick horizontal AABB check; we'll only handle landing on top of platforms (one-way)
    if(!(p.x + p.w > plat.x && p.x < plat.x + plat.w)) continue;

    // compute previous bottom to detect approach direction
    const prevY = p.y - p.vy * dt;
    const prevBottom = prevY + p.h;
    const currBottom = p.y + p.h;

    // Normal one-way landing: came from above and now overlapping the top
    if(prevBottom <= plat.y && currBottom >= plat.y && p.vy >= -50){
      p.y = plat.y - p.h;
      p.vy = 0;
      p.onGround = true;
      // restore jump allowance on landing
      p.jumpsLeft = MAX_JUMPS;
      continue;
    }

    // Safety correction for fast movement or small penetrations:
    // If the player is overlapping the platform area from above (slid into it due to large dt or high speed),
    // and the overlap depth is modest, snap them to the top to prevent noclipping.
    const penetration = currBottom - plat.y;
    if(penetration > 0 && penetration < Math.max(60, p.h * 1.5) && (p.y < plat.y + plat.h)){
      // Only correct if the player's center is above the platform's midline (so we're coming from above)
      const playerCenterY = p.y + p.h * 0.5;
      if(playerCenterY <= plat.y + plat.h * 0.5 && p.vy >= -400){
        p.y = plat.y - p.h;
        p.vy = 0;
        p.onGround = true;
        continue;
      }
    }

    // Otherwise ignore collision (allow passing through from below or from sides)
  }
}

// Find platform under a player (center-based)
function platformUnder(player){
  const cx = player.x + player.w/2;
  let best = null;
  for(const plat of platforms){
    if(cx >= plat.x - 4 && cx <= plat.x + plat.w + 4){
      if(plat.y >= player.y + player.h - 2){ // below
        if(!best || plat.y < best.y) best = plat;
      }
    }
  }
  return best;
}

// Find nearest platform to a given x,y (used for pathing decisions)
function nearestPlatformTo(x,y, maxDist=600){
  let best = null; let bestD = Infinity;
  for(const plat of platforms){
    const px = Math.max(plat.x, Math.min(x, plat.x + plat.w));
    const py = plat.y;
    const d = Math.hypot(px - x, py - y);
    if(d < bestD && d < maxDist){
      bestD = d; best = plat;
    }
  }
  return best;
}

 // NPC AI: improved to plan simple platform moves when chasing or fleeing.
function updateAI(p, dt){
  p.aiTimer -= dt;
  if(p.aiTimer <= 0){
    p.aiTimer = 0.4 + Math.random()*1.1;

    // NPC chatting: opportunistically pick a message when timer resets
    if(window.npcChatEnabled !== false){
      try{
        // determine category based on state
        let category = 'normal';
        if(p.hasBomb){
          if(typeof bombTimer === 'number' && bombTimer <= 3) category = 'bombUnder3Seconds';
          else category = 'haveBomb';
        } else if(bombHolder && bombHolder !== p){
          // if someone with bomb is close, say gettingChased sometimes
          const distToHolder = Math.hypot((bombHolder.x + bombHolder.w/2) - (p.x + p.w/2), (bombHolder.y + bombHolder.h/2) - (p.y + p.h/2));
          if(distToHolder < 160 && Math.random() < 0.9) category = 'gettingChased';
          else category = 'normal';
        } else {
          category = 'normal';
        }
        const pool = (npcMessages && npcMessages[category]) ? npcMessages[category] : (npcMessages && npcMessages.normal ? npcMessages.normal : null);
        if(pool && pool.length){
          // adjust speak chance slightly by npc skill: pros speak a bit less nervously, noobs speak slightly more
          let speakChance = 0.18;
          if(p.npcType === 'pro') speakChance = 0.12;
          if(p.npcType === 'noob') speakChance = 0.26;
          if(Math.random() < speakChance){ // chance to speak on ai tick
            p.chatText = pool[Math.floor(Math.random()*pool.length)];
            p.chatTimer = 2.5 + Math.random()*2.0;
            // push to chat log snapshotting current bomb state and visual color
            try{
              pushChatLog({ name: p.name, color: p.hatColor || p.color || '#111', text: p.chatText, hasBomb: !!p.hasBomb });
            }catch(e){}
          }
        }
      }catch(e){}
    }

    // small random jitter when idle
    if(!p.hasBomb && !bombHolder){
      const dir = Math.random()*2-1;
      p._aiTargetVx = dir * 120;
      if(Math.random() < 0.25) p._aiTargetVx = 0;
    }
    // occasional jump - scale by npc skill (noobs jump less, pros more)
    let jumpProb = 0.15;
    if(p.npcType === 'pro') jumpProb = 0.28;
    if(p.npcType === 'noob') jumpProb = 0.08;
    if(Math.random() < jumpProb && p.onGround) {
      // base small jump strength; will be scaled later where jumps are applied
      p.vy = -480;
      playSound(sndJump);
    }
  }

  // skill multipliers
  let speedMult = 1.0;
  let jumpMult = 1.0;
  let cautious = 1.0; // >1 means more cautious (favor fleeing), <1 more aggressive

  if(p.npcType === 'pro'){
    // Pro players are skilled (better jumps/decision making) but walk at the same base speed as average
    speedMult = 1.0;
    // keep slightly stronger vertical capability and smarter behavior
    jumpMult = 1.20;
    cautious = 0.9;
  } else if(p.npcType === 'noob'){
    speedMult = 0.72;
    jumpMult = 0.86;
    cautious = 1.25;
  } else {
    // average
    speedMult = 1.0;
    jumpMult = 1.0;
    cautious = 1.0;
  }
  // respect explicit fast flag (e.g. OrgeYT special)
  if(p.fast) speedMult *= 1.25;

  // If this NPC has the bomb: chase the closest other player (to pass) with simple platform-aware moves
  if(p.hasBomb){
    let target = null;
    let best = Infinity;
    for(const other of players){
      if(other === p || !other.alive) continue;
      if(other.recentPassed > 0) continue;
      const d = Math.abs((other.x + other.w/2) - (p.x + p.w/2));
      if(d < best){
        best = d;
        target = other;
      }
    }
    if(target){
      // try to use platforms: if target is on a higher platform, aim to reach a platform beneath them
      const targPlat = platformUnder(target) || nearestPlatformTo(target.x+target.w/2, target.y);
      const myPlat = platformUnder(p);
      if(targPlat && !p.onGround){
        // mid-air, steer toward target
        p._aiTargetVx = ( (target.x + target.w/2) > (p.x + p.w/2) ) ? 220 : -220;
      } else if(targPlat && myPlat && targPlat.y < myPlat.y - 8){
        // target higher: move toward edge and jump to reach chain toward target
        p._aiTargetVx = ( (targPlat.x + targPlat.w/2) > (p.x + p.w/2) ) ? 200 : -200;
        if(p.onGround && Math.abs((targPlat.x + targPlat.w/2) - (p.x + p.w/2)) < 220){
          if(typeof p.jumpsLeft !== 'number') p.jumpsLeft = MAX_JUMPS;
          if(p.jumpsLeft > 0){
            p.vy = -540 * jumpMult;
            p.onGround = false;
            p.jumpsLeft = Math.max(0, p.jumpsLeft - 1);
            playSound(sndJump, 0.45);
          }
        }
      } else {
        // simple ground chase (scale speed by skill)
        p._aiTargetVx = ((target.x > p.x) ? 240 : -240) * speedMult;
        if(best < 64 && p.onGround && Math.random() < (0.6 * (1/cautious))) {
          p.vy = -480 * jumpMult;
          playSound(sndJump);
        }
      }
    } else {
      p._aiTargetVx = (Math.random()*2-1) * 80 * speedMult;
    }
  } else {
    // Fleeing behavior: use platform network to create vertical separation where possible
    if(bombHolder && bombHolder.alive && bombHolder !== p){
      if(p.escapeCooldown > 0) p.escapeCooldown = Math.max(0, p.escapeCooldown - dt);
      if(p.escapeTimer > 0) p.escapeTimer = Math.max(0, p.escapeTimer - dt);

      if(p.escapeTarget && p.escapeTimer > 0){
        const plat = p.escapeTarget;
        p._aiTargetVx = ( (plat.x + plat.w/2) > (p.x + p.w/2) ) ? 200 * speedMult : -200 * speedMult;
        const dxToPlat = Math.abs((plat.x + plat.w/2) - (p.x + p.w/2));
        const heightDiff = (plat.y - p.h) - p.y;
        if(p.onGround && heightDiff < -6 && Math.abs(dxToPlat) < 140){
          p.vy = -540 * jumpMult;
        }
        if(p.x + p.w/2 > plat.x - 8 && p.x + p.w/2 < plat.x + plat.w + 8 && p.onGround){
          p.escapeTimer = 0;
          p.escapeTarget = null;
          p.escapeCooldown = 1.5;
        }
      } else {
        if(p.escapeCooldown <= 0){
          // evaluate platforms to increase vertical gap from bombHolder
          const ch = bombHolder;
          let bestScore = -Infinity;
          let bestPlat = null;
          for(const plat of platforms){
            if(plat.h > 40) continue;
            const platCenterX = plat.x + plat.w/2;
            const dxFromMe = platCenterX - (p.x + p.w/2);
            const dxFromChaser = platCenterX - (ch.x + ch.w/2);
            const verticalGain = (p.y - plat.y);
            const horizontalBenefit = Math.abs(dxFromChaser) - Math.abs(dxFromMe);
            const reachCost = Math.abs(dxFromMe) / 220 + Math.max(0, (p.y - plat.y) / 240);
            const score = (verticalGain * 0.95) + (horizontalBenefit * 0.7) - (reachCost * 2.3) + (Math.random()-0.5)*0.6;
            if(score > bestScore && Math.abs(dxFromMe) < 420 && verticalGain > -70){
              bestScore = score;
              bestPlat = plat;
            }
          }
          if(bestPlat){
            p.escapeTarget = bestPlat;
            // escape timer slightly longer for noobs (they commit longer to a chosen escape)
            p.escapeTimer = 2.2 + Math.random()*1.4 + (p.npcType === 'noob' ? 0.6 : 0);
            p.escapeCooldown = 3.0;
            const dir = Math.sign((p.x + p.w/2) - (bombHolder.x + bombHolder.w/2)) || -1;
            p._aiTargetVx = dir * 160 * speedMult;
            if(p.onGround && bestPlat.y < p.y - 10) {
              p.vy = -540 * jumpMult;
              playSound(sndJump);
            }
          } else {
            // fallback: run away on ground with occasional jump (noobs jump less often)
            const dx = (p.x + p.w/2) - (bombHolder.x + bombHolder.w/2);
            const dir = Math.sign(dx) || (Math.random() < 0.5 ? -1 : 1);
            p._aiTargetVx = dir * 200 * speedMult;
            let jumpChance = 0.35;
            if(p.npcType === 'pro') jumpChance = 0.55;
            if(p.npcType === 'noob') jumpChance = 0.18;
            if(Math.abs(dx) < 140 && p.onGround && Math.random() < jumpChance) {
              p.vy = -480 * jumpMult;
              playSound(sndJump);
            }
          }
        } else {
          const dx = (p.x + p.w/2) - (bombHolder.x + bombHolder.w/2);
          const dir = Math.sign(dx) || (Math.random() < 0.5 ? -1 : 1);
          p._aiTargetVx = dir * 180 * speedMult;
          if(Math.abs(dx) < 140 && p.onGround && Math.random() < 0.25) {
            p.vy = -440 * jumpMult;
            playSound(sndJump);
          }
        }
      }
    }
  }

  // apply target vx with smoothing; fast NPCs get amplified target speed
  let targetVx = (p._aiTargetVx||0);
  // final clamp/smoothing to keep behavior stable
  const t = 10 * dt;
  p.vx += ( targetVx - p.vx ) * t;
}

// Game loop
let dt = 0;
function loop(now){
  if(!running) return;
  dt = Math.min(1/30, (now - last)/1000);
  last = now;

  // update timers
  if(gameState!=='playing') return;

  if(!bombActive){
    nextGiveTimer -= dt;
    if(nextGiveTimer <= 0){
      // give bomb to a random alive player
      const alive = players.filter(p=>p.alive && !p.cannotGetBomb);
      // fallback: if everybody disallowed, allow any alive
      const pool = alive.length ? alive : players.filter(p=>p.alive);
      if(pool.length === 0){ endGame('All NPCs eliminated'); return; }
      const rnd = pool[Math.floor(Math.random()*pool.length)];
      giveBomb(rnd);
    }
  } else {
    // play a short tick SFX whenever the displayed bomb second decreases
    const prevDisplay = Math.ceil(bombTimer);
    bombTimer -= dt;
    const currDisplay = Math.ceil(Math.max(0, bombTimer));
    if(prevDisplay > 0 && currDisplay < prevDisplay){
      playSound('countdown');
    }
    if(bombTimer <= 0){
      // clear tracking so no further ticks play until new bomb given
      prevBombSecond = null;
      explodeBomb();
    }
  }

  // update players
  for(const p of players.filter(pp=>pp.alive)){
    // decrement recentPassed cooldown
    if(p.recentPassed > 0) p.recentPassed = Math.max(0, p.recentPassed - dt);
    // chat timer decrement per-player
    if(p.chatTimer && p.chatTimer > 0){
      p.chatTimer = Math.max(0, p.chatTimer - dt);
      if(p.chatTimer === 0) p.chatText = '';
    }

    if(p.isUser){
      // cheats: noclip/fly active -> allow free movement without gravity/collisions
      if(cheatsEnabled && noclipFlyActive){
        const flySpeed = 320;
        // horizontal motion derived from input
        if(input.left) p.vx = -flySpeed;
        else if(input.right) p.vx = flySpeed;
        else p.vx = 0;
        // vertical motion via up/down inputs
        if(input.up) p.vy = -flySpeed;
        else if(input.down) p.vy = flySpeed;
        else p.vy = 0;

        // integrate position directly (no gravity)
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      } else {
        // normal input
        const speed = 240;
        if(input.left) p.vx = -speed;
        else if(input.right) p.vx = speed;
        else p.vx = 0;

        // Double-jump handling: consume the jump input once so it doesn't retrigger across frames.
        if(input.jump){
          if(p.onGround){
            // ground jump: launch and reserve remaining air-jumps
            p.vy = -520;
            p.onGround = false;
            p.jumpsLeft = Math.max(0, MAX_JUMPS - 1);
          } else if(typeof p.jumpsLeft === 'number' && p.jumpsLeft > 0){
            // mid-air jump (double-jump)
            p.vy = -480;
            p.jumpsLeft = Math.max(0, p.jumpsLeft - 1);
          }
          // consume input immediately so one press causes at most one jump action
          input.jump = false;
        }

        // integrate with gravity
        p.vy += gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    } else {
      updateAI(p, dt);
      // integrate AI with gravity
      p.vy += gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    // simple world bounds (walls on sides) using the expanded worldW
    // update persistent facing from horizontal velocity so a stopped player retains last direction
    if(p.vx < -10) p.facingLeft = true;
    else if(p.vx > 10) p.facingLeft = false;

    // if user is noclipping/flying, allow them some padded movement but still prevent leaving extremes
    if(p.isUser && cheatsEnabled && noclipFlyActive){
      p.x = Math.max(-220, Math.min(worldW- p.w + 220, p.x));
      p.y = Math.max(-H, Math.min(H*1.5, p.y));
    } else {
      if(p.x < 4) { p.x = 4; p.vx = Math.max(0, p.vx); }
      if(p.x + p.w > worldW-4) { p.x = worldW-4-p.w; p.vx = Math.min(0, p.vx); }
      // top wall: prevent rising too far above
      if(p.y < -120){
        // teleport safety if they phase above map
        teleportToSafe(p);
      }

      if(p.y > H + 200){ // fell off
        // teleport back to map instead of permanent death (for robustness)
        teleportToSafe(p);
      }
    }

    // track landing to play land sound when hitting ground/platform
    const wasOnGround = !!p.onGround;
    // when noclip/fly is active for the user, skip platform resolution so user can pass through platforms
    if(!(p.isUser && cheatsEnabled && noclipFlyActive)){
      resolvePlatform(p, dt);
      if(!wasOnGround && p.onGround){
        // landed
        playSound(sndLand, 0.45);
      }
    } else {
      // ensure onGround flag is false while flying
      p.onGround = false;
    }
  }

  // collisions between players -> pass bomb if touching and one has bomb
  const live = players.filter(p=>p.alive);
  for(let i=0;i<live.length;i++){
    for(let j=i+1;j<live.length;j++){
      const a = live[i], b = live[j];
      if(collideRect(a.rect(), b.rect())){
        // transfer bomb (touch passes bomb)
        if(a.hasBomb && !b.hasBomb) transferBomb(a,b);
        else if(b.hasBomb && !a.hasBomb) transferBomb(b,a);

        // compute overlap and resolve by pushing them apart along the smallest axis
        const ax1 = a.x, ax2 = a.x + a.w, bx1 = b.x, bx2 = b.x + b.w;
        const ay1 = a.y, ay2 = a.y + a.h, by1 = b.y, by2 = b.y + b.h;
        const overlapX = Math.min(ax2, bx2) - Math.max(ax1, bx1);
        const overlapY = Math.min(ay2, by2) - Math.max(ay1, by1);

        if(overlapX > 0 && overlapY > 0){
          if(overlapX < overlapY){
            // separate horizontally
            const push = overlapX/2 + 0.5;
            if(a.x < b.x){
              a.x -= push; b.x += push;
            } else {
              a.x += push; b.x -= push;
            }
            // damp horizontal velocities
            const vxShare = (a.vx - b.vx) * 0.2;
            a.vx -= vxShare;
            b.vx += vxShare;
          } else {
            // separate vertically
            const push = overlapY/2 + 0.5;
            if(a.y < b.y){
              a.y -= push; b.y += push;
              // landing effect
              a.onGround = true;
              a.vy = Math.min(a.vy, 0);
            } else {
              a.y += push; b.y -= push;
              b.onGround = true;
              b.vy = Math.min(b.vy, 0);
            }
          }
        }
      }
    }
  }

  // Ultra-Sheld effect: shield entity pushes NPCs and can perform a flight-transfer sequence when user has the bomb.
  if(window.ultraShieldEnabled && user && user.isUser && user.alive){
    try{
      // initialize shield state container
      if(typeof window._shieldState === 'undefined'){
        window._shieldState = {
          flying: false,      // whether shield is in flight mode
          phase: 'idle',      // 'idle' | 'toNPC' | 'returning'
          pos: { x: user.x + user.w/2, y: user.y + user.h/2 },
          speed: 820,         // travel speed when flying
          targetId: null,     // index of targeted NPC
          carryingBomb: false,
          returnTolerance: 18,
          arrivalTolerance: 22
        };
      }
      const st = window._shieldState;

      const ux = user.x + user.w/2;
      const uy = user.y + user.h/2;
      const radius = (typeof shieldRadius === 'number' && shieldRadius > 0) ? shieldRadius : 82;

      // push nearby NPCs away (always active while shield enabled)
      for(const npc of players){
        if(!npc.alive || npc === user) continue;
        const cx = npc.x + npc.w/2;
        const cy = npc.y + npc.h/2;
        const dx = cx - ux;
        const dy = cy - uy;
        const dist = Math.hypot(dx, dy) || 0.001;
        if(dist < radius + Math.max(npc.w,npc.h)/2){
          const pushStrength = 420 + Math.max(0, (radius - dist)) * 2;
          npc.vx = (dx / dist) * pushStrength;
          npc.vy = -220;
          const overlapPush = Math.max(6, (radius - dist) * 0.6);
          npc.x += (dx / dist) * overlapPush;
          npc.y += (dy / dist) * overlapPush;
        }
      }

      // If user has the bomb and shield is idle, initiate flight-to-NPC sequence
      if(user.hasBomb && !st.flying){
        // find nearest eligible NPC to receive bomb
        let best = null, bestD = Infinity;
        for(const cand of players){
          if(!cand.alive || cand === user) continue;
          if(cand.recentPassed > 0) continue;
          if(cand.cannotGetBomb) continue;
          const dd = Math.hypot((cand.x + cand.w/2) - ux, (cand.y + cand.h/2) - uy);
          if(dd < bestD){ bestD = dd; best = cand; }
        }
        if(!best){
          const pool = players.filter(p=>p.alive && p !== user && !p.cannotGetBomb);
          if(pool.length) best = pool[Math.floor(Math.random()*pool.length)];
        }

        if(best){
          // begin flight: shield leaves user and carries bomb
          st.flying = true;
          st.phase = 'toNPC';
          st.pos.x = ux;
          st.pos.y = uy;
          st.speed = 820;
          st.targetId = players.indexOf(best);
          st.carryingBomb = true;
          // visually hide the stationary shield at the user's position while in-flight
          st.hideAtUser = true;
          // remove bomb from user immediately (shield takes it)
          user.hasBomb = false;
          bombHolder = null;
          bombActive = false;
          bombTimerEl.classList.add('hidden');
          // small cooldown to avoid re-triggering
          window._shieldBusyTransfer = true;
          setTimeout(()=>{ window._shieldBusyTransfer = false; }, 1200);
        }
      }

      // handle shield flight state machine
      if(st.flying){
        // compute target position depending on phase
        if(st.phase === 'toNPC'){
          const target = players[st.targetId];
          if(!target || !target.alive){
            // target invalid -> abort and return immediately
            st.phase = 'returning';
          } else {
            const tx = target.x + target.w/2;
            const ty = target.y + target.h/2 - 6;
            const dx = tx - st.pos.x;
            const dy = ty - st.pos.y;
            const dist = Math.hypot(dx, dy) || 0.001;
            const step = Math.min(st.speed * dt, dist);
            st.pos.x += (dx / dist) * step;
            st.pos.y += (dy / dist) * step;

            // arrival check
            if(dist <= st.arrivalTolerance){
              // deposit bomb into target if still eligible
              if(target.alive && !target.cannotGetBomb && target.recentPassed <= 0){
                target.hasBomb = true;
                bombHolder = target;
                bombActive = true;
                // reset bomb timer slightly so transfer is visible (use current bombDuration)
                bombTimer = Math.max(2.0, bombTimer || 6);
                bombTimerEl.classList.remove('hidden');
                // push a short chat log entry for feedback
                try{ pushChatLog({ name: target.name, color: target.hatColor || target.color || '#111', text: 'Received a mysterious bomb!', hasBomb: true }); }catch(e){}
              }
              // stop carrying the bomb and switch to returning phase
              st.carryingBomb = false;
              st.phase = 'returning';
            }
          }
        } else if(st.phase === 'returning'){
          // return to user current position (user may have moved)
          const tx = user.x + user.w/2;
          const ty = user.y + user.h/2;
          const dx = tx - st.pos.x;
          const dy = ty - st.pos.y;
          const dist = Math.hypot(dx, dy) || 0.001;
          const step = Math.min(st.speed * 1.1 * dt, dist);
          st.pos.x += (dx / dist) * step;
          st.pos.y += (dy / dist) * step;

          // arrival back to user
          if(dist <= st.returnTolerance){
            // complete cycle: mark idle and reset
            st.flying = false;
            st.phase = 'idle';
            st.targetId = null;
            st.carryingBomb = false;
            // restore visual state: show shield at the user's position again
            st.hideAtUser = false;
            // ensure shield is visually at user's center
            st.pos.x = user.x + user.w/2;
            st.pos.y = user.y + user.h/2;
          }
        }
      } else {
        // when idle keep shield position at user
        st.pos.x = ux;
        st.pos.y = uy;
      }

      // Render shield visual (rotating ring) as it flies or idles.
      // When the shield is performing a flight transfer we draw it at its flight position (st.pos)
      // and avoid drawing a separate stationary shield at the user's own center.
      try{
        const ctxUI = canvas.getContext('2d');
        ctxUI.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);

        // pick draw position: if shield is hidden at user while flying, draw only at flight position.
        // otherwise draw at user's center (st.pos tracks this when idle).
        const drawPos = (st && st.flying && st.hideAtUser) ? { x: st.pos.x, y: st.pos.y } : { x: st.pos.x, y: st.pos.y };

        const sx = drawPos.x - camX;
        const sy = drawPos.y - camY;

        ctxUI.save();
        ctxUI.translate(Math.round(sx), Math.round(sy));

        // make flying shield slightly tighter visually
        const drawR = radius * (st.flying ? 0.55 : 1.0);

        // outer ring
        ctxUI.lineWidth = 3;
        ctxUI.strokeStyle = 'rgba(6,182,212,0.95)';
        ctxUI.beginPath();
        ctxUI.arc(0, 0, drawR, 0, Math.PI * 2);
        ctxUI.stroke();

        // inner glow when carrying bomb (makes the flying shield visually obvious)
        if(st.carryingBomb){
          const grad = ctxUI.createRadialGradient(0,0,0,0,0, drawR + 18);
          grad.addColorStop(0, 'rgba(255,90,60,0.95)');
          grad.addColorStop(1, 'rgba(6,182,212,0)');
          ctxUI.fillStyle = grad;
          ctxUI.beginPath();
          ctxUI.arc(0,0, drawR + 18, 0, Math.PI*2);
          ctxUI.fill();
        }
        ctxUI.restore();
      }catch(e){}
    }catch(e){}
  }

  if(spectating){
    // spectating: either free-pan or focus-lock onto a selected player
    if(spectateFocus){
      // ensure list is fresh and valid
      updateSpectateFocusList();
      const target = getFocusedPlayer();
      if(target){
        // center camera on the focused player (account for zoom view size)
        const viewW = W / cameraZoom;
        const viewH = H / cameraZoom;
        const goalX = target.x - (viewW / 2) + (target.w/2);
        const goalY = target.y - (viewH / 2) + (target.h/2);
        camX += (goalX - camX) * Math.min(1, camLerp * dt * 1.2);
        camY += (goalY - camY) * Math.min(1, camLerp * dt * 1.2);
      } else {
        // fallback to free pan if no valid target
        let vx = 0, vy = 0;
        if(input.left) vx -= 1;
        if(input.right) vx += 1;
        if(input.up) vy -= 1;
        if(input.down) vy += 1;
        const mag = Math.hypot(vx, vy) || 1;
        camPanVX = (vx / mag) * camPanSpeed;
        camPanVY = (vy / mag) * camPanSpeed;
        camX += camPanVX * dt;
        camY += camPanVY * dt;
      }
    } else {
      // spectator control: use input to pan camera directly
      let vx = 0, vy = 0;
      if(input.left) vx -= 1;
      if(input.right) vx += 1;
      if(input.up) vy -= 1;
      if(input.down) vy += 1;
      const mag = Math.hypot(vx, vy) || 1;
      camPanVX = (vx / mag) * camPanSpeed;
      camPanVY = (vy / mag) * camPanSpeed;
      camX += camPanVX * dt;
      camY += camPanVY * dt;
    }
    // clamp camera to world bounds in spectate free-pan or when focus is disabled
    // allow spectator camera to go anywhere (no clamps)
    // leave camX/camY as updated from input / focus logic
  } else {
    // camera follow user with clamping to the expanded world width
    // goal is centered on the user, but clamped so the camera doesn't go beyond world edges
    // camera goals must account for zoom: view size = W / cameraZoom, H / cameraZoom
    const unclampedGoalX = user.x - (W / (2 * cameraZoom));
    const unclampedGoalY = user.y - (H / (2 * cameraZoom));
    // follow target without clamping — camera can go anywhere
    const goalX = unclampedGoalX;
    const goalY = unclampedGoalY;
    camX += (goalX - camX) * Math.min(1, camLerp * dt);
    camY += (goalY - camY) * Math.min(1, camLerp * dt);
  }

  // draw
  shieldRot += dt * 6;
  render();

  // update HUD
  playersLeftEl.textContent = `Players: ${players.filter(p=>p.alive).length}`;
  if(bombActive){
    bombTimerEl.classList.remove('hidden');
    bombTimerEl.textContent = Math.ceil(bombTimer);
  } else bombTimerEl.classList.add('hidden');

  // after updating and collision resolution: if spectating and only one NPC remains, show that NPC wins
  const aliveNPC = players.filter(p=>p.alive && !p.isUser);
  if(spectating && aliveNPC.length === 1){
    // play win chime for NPC win
    playSound(sndWin);
    recentOutcome = 'NPC won';
    endGame(`${aliveNPC[0].name} wins!`);
    // stop further frames until user chooses an option
    return;
  }

  requestAnimationFrame(loop);
}

// Bomb functions
function giveBomb(player){
  // prefer the provided player if valid and not recently passed, otherwise pick any alive non-recent player
  if(!player || !player.alive || player.recentPassed > 0){
    const alive = players.filter(p=>p.alive && p.recentPassed <= 0);
    if(alive.length === 0){
      // fallback to any alive (if everyone is recent, allow assignment)
      const any = players.filter(p=>p.alive);
      if(any.length === 0){
        nextGiveTimer = 1;
        return;
      }
      player = any[Math.floor(Math.random()*any.length)];
    } else {
      player = alive[Math.floor(Math.random()*alive.length)];
    }
  }
  player.hasBomb = true;
  bombHolder = player;
  bombActive = true;
  bombTimer = bombDuration;
  // initialize prevBombSecond so we can detect the first tick change
  prevBombSecond = Math.ceil(bombTimer);
  nextGiveTimer = 0;
  bombTimerEl.classList.remove('hidden');
}

function transferBomb(from, to){
  if(!from.hasBomb) return;
  // prevent transfer if recipient is in recentPassed state or immune to bomb
  if(to.recentPassed > 0) return;
  if(to.cannotGetBomb) return;

  // create a pass animation (from center of passer to center of receiver)
  const fx = from.x + from.w/2;
  const fy = from.y - 18; // slightly above head
  const tx = to.x + to.w/2;
  const ty = to.y - 18;
  const travel = {
    x0: fx, y0: fy,
    x1: tx, y1: ty,
    t: 0,
    life: 0.36, // quick pass
    // small wobble trail particles
    trail: Array.from({length:8}, ()=>({
      x: 0, y: 0, vx: (Math.random()*2-1)*30, vy: (Math.random()*2-1)*20, r: 3 + Math.random()*3, alpha: 1
    }))
  };
  passAnimations.push(travel);

  // do logical transfer but delay final ownership until the visual arrives so it feels like passing
  from.hasBomb = false;
  // mark the passer: they cannot receive bomb for 3s and set giving flag for sprite
  from.recentPassed = 3.0;
  from.isGiving = true;
  // mark recipient as in-getting state (so their sprite can show a receiving anim)
  to.isGetting = true;
  bombHolder = null;
  // temporarily suspend bombActive UI until arrival
  bombTimerEl.classList.add('hidden');

  // schedule the recipient to receive bomb when animation completes
  travel.toPlayer = to;
  travel.fromPlayer = from;
}

function explodeBomb(){
  // whoever holds bomb loses
  // stop countdown ticks as we're resolving the explosion
  prevBombSecond = null;
  if(bombHolder){
    const bx = bombHolder.x + bombHolder.w / 2;
    const by = bombHolder.y + bombHolder.h / 2;

    if(bombHolder.isUser){
      // play boom for user losing and end the game
      playSound(sndExplode);
      // spawn visual explosion
      spawnExplosion(bx, by);
      // record recent outcome and show on title
      recentOutcome = 'You exploded';
      endGame('You got BOOMED!');
    } else {
      // NPC dies: play explosion sound and spawn visual boom
      playSound(sndExplode);
      spawnExplosion(bx, by);

      bombHolder.alive = false;
      bombHolder.hasBomb = false;
      // clear bomb and plan next give
      bombActive = false;
      bombHolder = null;
      bombTimer = 0;
      nextGiveTimer = 2;
      bombTimerEl.classList.add('hidden');

      // if NPCs all dead -> user wins
      const aliveNPC = players.filter(p=>p.alive && !p.isUser);
      if(aliveNPC.length === 0){
        recentOutcome = 'You won';
        endGame('You Win! All NPCs eliminated.');
        return;
      }
    }
  }
}

 // teleport a player back to safe starting area (used when phasing outside map)
function teleportToSafe(p){
  // place back on main ground near center or nearest platform
  const ground = platforms.find(pl=>pl.h > 40) || platforms[0];
  if(!ground) return;
  p.x = Math.max(16, Math.min(W - p.w - 16, W/2 + (Math.random()-0.5)*220));
  p.y = ground.y - p.h - 2;
  p.vx = 0; p.vy = 0;
  p.alive = true;
  p.onGround = true;
  // if held bomb, drop it and schedule next give
  if(p.hasBomb){
    p.hasBomb = false;
    bombActive = false;
    bombHolder = null;
    bombTimer = 0;
    nextGiveTimer = 1.2;
    bombTimerEl.classList.add('hidden');
  }
}

// spawn a short-lived explosion effect at world coords x,y
function spawnExplosion(x,y){
  const e = {
    x, y,
    t: 0,
    life: 0.9 + Math.random()*0.3,
    // generate simple particle set
    particles: Array.from({length: 12 + Math.floor(Math.random()*8)}, ()=>{
      const angle = Math.random() * Math.PI*2;
      const speed = 120 + Math.random()*220;
      return {
        x: 0,
        y: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.7 - 60,
        r: 4 + Math.random()*5,
        color: Math.random() < 0.5 ? '#ffb86b' : '#ff6b6b'
      };
    })
  };
  explosions.push(e);
}

 // rendering with camera transform
/* small helper: rounded rectangle (fill and/or stroke) */
function roundRect(ctx, x, y, w, h, r, fill, stroke){
  if(typeof r === 'number') r = {tl:r,tr:r,br:r,bl:r};
  ctx.beginPath();
  ctx.moveTo(x + r.tl, y);
  ctx.lineTo(x + w - r.tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r.tr);
  ctx.lineTo(x + w, y + h - r.br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h);
  ctx.lineTo(x + r.bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r.bl);
  ctx.lineTo(x, y + r.tl);
  ctx.quadraticCurveTo(x, y, x + r.tl, y);
  ctx.closePath();
  if(fill) ctx.fill();
  if(stroke) ctx.stroke();
}

function render(){
  // clear full canvas
  // apply device pixel ratio and camera zoom via transform; then translate by camera world coords
  // Clear the full backing buffer first with identity transform to avoid leftover pixels,
  // then apply camera/device transforms for drawing.
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.setTransform(devicePixelRatio * cameraZoom, 0, 0, devicePixelRatio * cameraZoom, 0, 0);
  
  // canvas font helper consistent with render module: make usernames/chat scale up and non-bold when pixel font enabled
  function getCanvasFont(sizePx){
    try{
      const enabled = !!(window && window.pixelFontEnabled);
      if(enabled){
        const scaled = Math.round(sizePx * 1.28);
        return `${scaled}px Jersey15, system-ui, Arial`;
      }
    }catch(e){}
    return `${sizePx}px system-ui,Arial`;
  }

  // apply camera translation (camera coords are in world pixels)
  ctx.save();
  ctx.translate(-Math.round(camX), -Math.round(camY));

  // background: sky image if available, otherwise fallback fill
  if(skyImg && skyImg.complete){
    // draw sky stretched across the entire visible world height so the background covers the full map
    ctx.drawImage(skyImg, 0, 0, worldW, H);

    // apply a subtle darkening overlay so the sky isn't too bright
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(0, 0, worldW, H);

    // add a gentle vertical vignette so edges are slightly darker (keeps focus on play area)
    const vg = ctx.createLinearGradient(0, 0, 0, H);
    vg.addColorStop(0, 'rgba(0,0,0,0.06)');
    vg.addColorStop(0.6, 'rgba(0,0,0,0.12)');
    vg.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, worldW, H);

    // subtle tint near ground to blend with platform colors
    ctx.fillStyle = 'rgba(7,16,24,0.24)';
    ctx.fillRect(0, H * 0.65, worldW, H * 0.35);
  } else {
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0,0,W,H);
  }

  // platforms (ground is tall >40, draw green ground; other platforms are gray)
  for(const plat of platforms){
    const isGround = plat.h > 40;
    if(isGround){
      // green ground base
      ctx.fillStyle = '#2f8e2f';
      ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
      // darker top strip
      ctx.fillStyle = '#267426';
      ctx.fillRect(plat.x, plat.y + plat.h - 8, plat.w, 8);
    } else {
      // floating platform gray
      ctx.fillStyle = '#a3a7ab';
      ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
      ctx.fillStyle = '#8f9396';
      ctx.fillRect(plat.x, plat.y + plat.h - 6, plat.w, 6);
    }

    // decorative studs on top (non-colliding): small square studs spaced across the platform
    const studSize = Math.min(14, Math.floor(plat.h * 0.9) + 4); // visually thick but not tall
    const studGap = studSize + 8;
    const startX = plat.x + 8;
    const endX = plat.x + plat.w - 8 - studSize;
    let sx = startX;
    const studY = Math.max(plat.y - Math.floor(studSize * 0.8), plat.y - studSize); // sit just above top
    while(sx <= endX){
      // stud body
      if(isGround){
        ctx.fillStyle = '#3aa33a'; // slightly lighter green for studs on ground
      } else {
        ctx.fillStyle = '#c9cbcd'; // lighter gray stud
      }
      ctx.fillRect(sx, studY, studSize, studSize);
      // subtle border
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx + 0.5, studY + 0.5, studSize - 1, studSize - 1);
      sx += studGap;
    }
  }
  // players - draw sprites with green-screen tinting instead of simple rectangles
  for(const p of players){
    if(!p.alive) continue;

    // choose sprite variant using full sprite set and state flags (bomb, giving/getting, pressed down, jump/fall, exploded)
    let baseImg = spriteImgs.idle;

    // exploded state (if dead and we have exploded sprite)
    if(!p.alive && spriteImgs.exploded && spriteImgs.exploded.complete){
      baseImg = spriteImgs.exploded;
    } else {
      // if player is currently marked as giving or getting, prefer those animations
      if(p.isGiving && spriteImgs.give_bomb && spriteImgs.give_bomb.complete){
        baseImg = spriteImgs.give_bomb;
      } else if(p.isGetting && spriteImgs.getting_bomb && spriteImgs.getting_bomb.complete){
        baseImg = spriteImgs.getting_bomb;
      } else {
        // handle down-press visual (user pressing down or NPC flagged with a down state)
        const pressingDown = (p.isUser && input.down) || p.forceDown;
        if(p.hasBomb){
          if(pressingDown && spriteImgs.down_bomb && spriteImgs.down_bomb.complete){
            baseImg = spriteImgs.down_bomb;
          } else if(p.vy < -220 && spriteImgs.jump_bomb && spriteImgs.jump_bomb.complete){
            // jump with bomb: prefer jump_bomb if available, otherwise fall back to jump or idle_bomb
            baseImg = (spriteImgs.jump_bomb && spriteImgs.jump_bomb.complete) ? spriteImgs.jump_bomb : ((spriteImgs.jump && spriteImgs.jump.complete) ? spriteImgs.jump : spriteImgs.idle_bomb);
          } else if(p.vy > 220 && spriteImgs.fall_bomb && spriteImgs.fall_bomb.complete){
            baseImg = spriteImgs.fall_bomb;
          } else {
            baseImg = (spriteImgs.idle_bomb && spriteImgs.idle_bomb.complete) ? spriteImgs.idle_bomb : spriteImgs.idle;
          }
        } else {
          // not holding a bomb
          if(pressingDown && spriteImgs['down'] && spriteImgs['down'].complete){
            baseImg = spriteImgs['down'];
          } else if(p.vy < -220 && spriteImgs.jump && spriteImgs.jump.complete){
            baseImg = spriteImgs.jump;
          } else if(p.vy > 220 && spriteImgs.fall && spriteImgs.fall.complete){
            baseImg = spriteImgs.fall;
          } else {
            baseImg = spriteImgs.idle;
          }
        }
      }
    }

    // get tinted canvas for this player's color (green-screen replaced by p.color)
    let tinted = getTintedSprite(baseImg, p.color);
    // if not ready yet, fall back to simple rectangle placeholder
    if(!tinted){
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.w, p.h);
    } else {
      // Apply sprite-manager settings (offset, scale, flip) per-sprite key if present in mgrStore.
      // mgrStore entries are in pixel-space adjustments relative to the player hitbox in the manager.
      const k = Object.keys(spriteImgs).find(k2=>spriteImgs[k2] === baseImg) || null;
      // fallback to previously selected key logic: use the base image mapping by comparing src
      // but if that fails, use a best-effort key lookup by checking known keys
      let key = null;
      for(const kk of Object.keys(mgrStore)){
        if(spriteImgs[kk] && spriteImgs[kk].src === baseImg.src){ key = kk; break; }
      }
      if(!key && k) key = k;
      // default store entry when missing
      const store = (key && mgrStore[key]) ? mgrStore[key] : { offset:{x:0,y:0}, scale: 1, flip: false };

      // compute draw size using stored scale (applies to natural image dimensions)
      const drawW = Math.round(tinted.width * store.scale);
      const drawH = Math.round(tinted.height * store.scale);

      // base position: center sprite horizontally on player and align feet to player's bottom,
      // then apply stored offset (offset.x, offset.y) which was authored in the manager canvas pixels.
      // When sprite is flipped horizontally for facing left, mirror the horizontal offset so the visual stays consistent.
      // Determine final flip (either manager flip or persistent facing flag)
      const finalFlip = store.flip ? true : p.facingLeft;
      // mirror offset.x when flipped so offsets authored for right-facing sprites are mirrored for left-facing
      const offsetX = (store.offset && typeof store.offset.x === 'number') ? (finalFlip ? -store.offset.x : store.offset.x) : 0;
      const offsetY = (store.offset && typeof store.offset.y === 'number') ? store.offset.y : 0;

      const baseX = p.x + p.w/2 - drawW/2 + offsetX;
      const baseY = p.y + p.h - drawH + offsetY;

      ctx.save();
      // apply horizontal flip around sprite center if needed
      if(finalFlip){
        // flip around sprite center
        ctx.translate(baseX + drawW/2, baseY + drawH/2);
        ctx.scale(-1,1);
        ctx.translate(-baseX - drawW/2, -baseY - drawH/2);
      }
      ctx.drawImage(tinted, baseX, baseY, drawW, drawH);
      ctx.restore();
    }

    // bomb holder outline: draw a semi-transparent red border for whoever has the bomb
    if(p.hasBomb){
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,0,0,0.5)';
      ctx.strokeRect(p.x - 3, p.y - 3, p.w + 6, p.h + 6);
    }

    // draw hat above head if assigned (recolor red parts to the player's hatColor when provided)
    if(p.hat){
      try{
        // reuse a cached raw Image for this hat path so we don't recreate images every frame
        let hatImage = hatCache.get(p.hat);
        if(!hatImage){
          hatImage = new Image();
          hatImage.crossOrigin = 'anonymous';
          hatImage.src = p.hat;
          hatCache.set(p.hat, hatImage);
        }
        // prefer using player's hatColor, fallback to player color
        const recolorTarget = (p.hatColor && typeof p.hatColor === 'string') ? p.hatColor : p.color;
        // getTintedHat already caches recolored canvases by src|color, so this will be fast and stable
        const tintedHat = getTintedHat(hatImage, recolorTarget) || hatImage;
        const hatW = Math.min(56, p.w * 1.2, (tintedHat.width || 48) * 0.6);
        const hatH = (tintedHat.height / Math.max(1, tintedHat.width)) * hatW;
        const hx = p.x + p.w/2 - hatW/2;
        const hy = p.y - hatH - 6;
        ctx.drawImage(tintedHat, hx, hy, hatW, hatH);
      }catch(e){}
    } else {
      // legacy: draw the OrgeYT hat for that NPC if present (keeps previous behavior)
      if(p.name === 'OrgeYT' && !p.isUser && hatImg && hatImg.complete){
        const hatW = Math.min(48, p.w * 1.1);
        const hatH = (hatImg.height / hatImg.width) * hatW;
        const hx = p.x + p.w/2 - hatW/2;
        const hy = p.y - hatH - 6;
        ctx.drawImage(hatImg, hx, hy, hatW, hatH);
      }
    }

    // name label small
    // append a small tag for NPC type (PRO / NOOB / AVG) for non-user players
    let label = p.isUser ? (typeof myUsername === 'string' ? myUsername.toUpperCase() : 'YOU') : p.name;
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

    // render chat bubble if present
    if(p.chatText){
      try{
        const text = String(p.chatText).slice(0, 80);
        ctx.font = getCanvasFont(12);
        ctx.textAlign = 'center';
        const padding = 8;
        const measure = ctx.measureText(text);
        const bw = Math.min(220, Math.max(48, measure.width + padding*2));
        const bx = p.x + p.w/2 - bw/2;
        const by = p.y - 34 - 22; // above name label
        // bubble background
        ctx.fillStyle = 'rgba(255,255,255,0.94)';
        roundRect(ctx, bx, by, bw, 22, 8, true, false);
        // bubble border
        ctx.strokeStyle = 'rgba(0,0,0,0.12)';
        ctx.lineWidth = 1;
        roundRect(ctx, bx, by, bw, 22, 8, false, true);
        // text
        ctx.fillStyle = '#111';
        ctx.fillText(text, p.x + p.w/2, by + 14);
      }catch(e){}
    }

    // bomb indicator: small icon over head (since bomb sprite can also be integrated into sprite variants)
    // Do not show the over-head bomb while the player is airborne (jumping or falling).
    const isAirborne = (p.vy < -220 || p.vy > 220);
    if(p.hasBomb && (!tinted || (tinted && baseImg !== spriteImgs.idle_bomb)) && !isAirborne){
      const bx = p.x + p.w/2;
      const by = p.y - 18;
      ctx.beginPath();
      ctx.fillStyle = '#0d1113';
      ctx.arc(bx, by, 12, 0, Math.PI*2);
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '14px serif';
      ctx.fillText('💣', bx, by+1);
      ctx.fillStyle = '#ff4b4b';
      ctx.font = '11px system-ui,Arial';
      ctx.fillText(Math.ceil(bombTimer), bx, by-2);
    }
  }

  // draw active explosions (world-space; non-colliding visual only)
  if(explosions && explosions.length > 0){
    for(let i = explosions.length - 1; i >= 0; i--){
      const e = explosions[i];
      e.t += dt;
      const pT = Math.min(1, e.t / e.life);

      // expanding radial flash
      const maxR = 80;
      const r = maxR * (0.3 + pT*0.9);
      const alpha = Math.max(0, 1 - pT);
      const grad = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r);
      grad.addColorStop(0, `rgba(255,230,180,${0.95*alpha})`);
      grad.addColorStop(0.4, `rgba(255,120,80,${0.6*alpha})`);
      grad.addColorStop(1, `rgba(80,20,20,${0.08*alpha})`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r, 0, Math.PI*2);
      ctx.fill();

      // particles
      for(const part of e.particles){
        part.vy += 700 * dt; // gravity on particles
        part.x += part.vx * dt;
        part.y += part.vy * dt;
        const lifeFactor = Math.max(0, 1 - (e.t / e.life));
        ctx.globalAlpha = lifeFactor;
        ctx.fillStyle = part.color;
        ctx.beginPath();
        ctx.arc(e.x + part.x, e.y + part.y, Math.max(1, part.r * lifeFactor), 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      if(e.t >= e.life){
        explosions.splice(i,1);
      }
    }
  }

  // draw bomb pass animations (flying bomb between players)
  if(passAnimations && passAnimations.length > 0){
    for(let i = passAnimations.length - 1; i >= 0; i--){
      const trav = passAnimations[i];
      trav.t += dt;
      const tNorm = Math.min(1, trav.t / trav.life);
      // ease (small overshoot arc)
      const ease = (Math.sin((tNorm * Math.PI) - Math.PI/2) + 1) * 0.5; // smooth in-out
      // compute arc offset (higher in middle)
      const midArc = Math.max(34, Math.min(120, 160 * (1 - Math.abs(0.5 - tNorm))));
      const cx = trav.x0 + (trav.x1 - trav.x0) * tNorm;
      const baseY = trav.y0 + (trav.y1 - trav.y0) * tNorm;
      const cy = baseY - (midArc * Math.sin(Math.PI * tNorm));

      // draw trail particles
      for(const pt of trav.trail){
        pt.vy += 300 * dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        ctx.globalAlpha = pt.alpha * (1 - tNorm);
        ctx.fillStyle = '#ffb86b';
        ctx.beginPath();
        ctx.arc(cx + pt.x * 0.12, cy + pt.y * 0.12, pt.r * (0.6 + (1 - tNorm)*0.8), 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // draw the flying bomb circle with emoji
      ctx.save();
      ctx.translate(cx, cy);
      ctx.beginPath();
      ctx.fillStyle = '#0d1113';
      ctx.arc(0, 0, 18, 0, Math.PI*2);
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '22px serif';
      ctx.fillText('💣', 0, 1);
      // small glow
      ctx.globalAlpha = 0.9 * (1 - tNorm);
      ctx.fillStyle = 'rgba(255,90,60,0.12)';
      ctx.beginPath();
      ctx.arc(0, 0, 30 + 12 * (1 - tNorm), 0, Math.PI*2);
      ctx.fill();
      ctx.restore();

      // finalize when animation completes: assign bomb to target, restore bomb UI & holder
      if(trav.t >= trav.life){
        const recipient = trav.toPlayer;
        const passer = trav.fromPlayer;
        if(recipient && recipient.alive){
          recipient.hasBomb = true;
          recipient.isGetting = false;
          bombHolder = recipient;
          bombActive = true;
        }
        if(passer){
          passer.isGiving = false;
        }
        // remove this travel animation
        passAnimations.splice(i,1);
      }
    }
  }

  // Ultra-Sheld visual: rotating hollow circle with small decorative ticks around the user
  if(window.ultraShieldEnabled && user && user.isUser && user.alive){
    try{
      const ux = user.x + user.w/2;
      const uy = user.y + user.h/2;
      ctx.save();
      ctx.translate(ux, uy);
      ctx.rotate(shieldRot || 0);

      // main hollow ring
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(6,182,212,0.95)';
      ctx.beginPath();
      ctx.arc(0, 0, shieldRadius || 82, 0, Math.PI * 2);
      ctx.stroke();

      // inner subtle glow
      const glow = ctx.createRadialGradient(0,0,(shieldRadius||82)-8, 0,0, (shieldRadius||82)+12);
      glow.addColorStop(0, 'rgba(6,182,212,0.12)');
      glow.addColorStop(1, 'rgba(6,182,212,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0,0, (shieldRadius||82)+12, 0, Math.PI*2);
      ctx.fill();

      // decorative rotating ticks
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(12,163,213,0.9)';
      const ticks = 10;
      for(let k=0;k<ticks;k++){
        const a = (k / ticks) * Math.PI * 2;
        const ra = a + (shieldRot || 0) * 0.4;
        const inner = (shieldRadius || 82) - 10;
        const outer = (shieldRadius || 82) + 10;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ra) * inner, Math.sin(ra) * inner);
        ctx.lineTo(Math.cos(ra) * outer, Math.sin(ra) * outer);
        ctx.stroke();
      }

      ctx.restore();
    }catch(e){}
  }

  ctx.restore();

  // top-right info badge (UI not affected by camera)
  // restore 1:1 UI transform (ignore camera zoom) for HUD overlays
  ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
  ctx.fillStyle = 'rgba(255,255,255,0.02)';
  ctx.fillRect(W-160,10,150,44);
}

/* Sprite Manager
   - Allows cycling sprite states, moving and resizing a preview sprite over a player hitbox.
   - Exports per-sprite JSON containing offset and scale for use in rendering pipeline.
*/
const spriteMgrBtn = document.getElementById('spriteMgrBtn');
const body = document.body;

// build modal UI
const modal = document.createElement('div');
modal.id = 'spriteMgrModal';
modal.innerHTML = `
  <div id="spriteMgrHeader">
    <h3>Sprite Manager</h3>
    <div style="display:flex;gap:8px;align-items:center;">
      <button id="spriteMgrPrev" class="spriteMgrControls" title="Previous sprite">◀</button>
      <button id="spriteMgrNext" class="spriteMgrControls" title="Next sprite">▶</button>
      <div style="width:12px;"></div>
      <button id="spriteMgrClose" class="spriteMgrControls">Close</button>
      <button id="spriteMgrExport" class="spriteMgrControls">Export JSON</button>
    </div>
  </div>
  <div id="spriteMgrCanvasWrap">
    <canvas id="spriteMgrCanvas" width="640" height="480"></canvas>
    <div id="spriteMgrSidebar">
      <div class="spriteMgrRow">
        <label>Sprite:</label>
        <select id="spriteMgrSelect" style="flex:1;padding:6px;border-radius:6px;border:1px solid #ddd;">
          <option value="idle">idle</option>
          <option value="idle_bomb">idle_bomb</option>
          <option value="jump">jump</option>
          <option value="fall">fall</option>
          <option value="fall_bomb">fall_bomb</option>
          <option value="down">down</option>
          <option value="down_bomb">down_bomb</option>
          <option value="jump_bomb">jump_bomb</option>
          <option value="give_bomb">give_bomb</option>
          <option value="getting_bomb">getting_bomb</option>
          <option value="exploded">exploded</option>
        </select>
      </div>
      <div class="spriteMgrRow">
        <label>Mode:</label>
        <select id="spriteMgrMode" style="flex:1;padding:6px;border-radius:6px;border:1px solid #ddd;">
          <option value="move">Move</option>
          <option value="scale">Scale</option>
        </select>
      </div>
      <div class="spriteMgrRow">
        <label>Flip:</label>
        <button id="spriteMgrFlip" class="spriteMgrStateBtn">Flip H</button>
      </div>
      <div class="spriteMgrRow">
        <label>Reset:</label>
        <button id="spriteMgrReset" class="spriteMgrStateBtn">Reset</button>
      </div>
      <div style="flex:1;"></div>
      <div style="font-size:12px;color:#444;">Tip: drag on canvas to move or size the sprite. Use Export to copy JSON to clipboard.</div>
    </div>
  </div>
`;
// attach modal
body.appendChild(modal);

const smCanvas = document.getElementById('spriteMgrCanvas');
const smCtx = smCanvas.getContext('2d');
const smSelect = document.getElementById('spriteMgrSelect');
const smMode = document.getElementById('spriteMgrMode');
const smFlip = document.getElementById('spriteMgrFlip');
const smReset = document.getElementById('spriteMgrReset');
const smClose = document.getElementById('spriteMgrClose');
const smExport = document.getElementById('spriteMgrExport');
const smPrev = document.getElementById('spriteMgrPrev');
const smNext = document.getElementById('spriteMgrNext');

let mgrState = {
  key: smSelect.value,
  offset: {x: 0, y: 0},
  scale: 1,
  flip: false
};

// load or initialize stored manager settings per sprite key
const mgrStore = {}; // key -> {offset, scale, flip}

function loadMgrFor(key){
  mgrState.key = key;
  const s = mgrStore[key];
  if(s){
    mgrState.offset = {x: s.offset.x, y: s.offset.y};
    mgrState.scale = s.scale;
    mgrState.flip = !!s.flip;
  } else {
    mgrState.offset = {x: 0, y: 0};
    mgrState.scale = 1;
    mgrState.flip = false;
  }
}

// interactive dragging
let dragging = false;
let dragStart = null;
let initial = null;

function toCanvasCoords(ev){
  const r = smCanvas.getBoundingClientRect();
  const x = (ev.clientX - r.left) * (smCanvas.width / r.width);
  const y = (ev.clientY - r.top) * (smCanvas.height / r.height);
  return {x,y};
}

smCanvas.addEventListener('pointerdown',(ev)=>{
  smCanvas.setPointerCapture(ev.pointerId);
  dragging = true;
  dragStart = toCanvasCoords(ev);
  initial = { offset: {...mgrState.offset}, scale: mgrState.scale };
});
smCanvas.addEventListener('pointermove',(ev)=>{
  if(!dragging) return;
  const cur = toCanvasCoords(ev);
  const dx = cur.x - dragStart.x;
  const dy = cur.y - dragStart.y;
  if(smMode.value === 'move'){
    // movement scaled to canvas draw coords (we will normalize on save)
    mgrState.offset.x = initial.offset.x + dx;
    mgrState.offset.y = initial.offset.y + dy;
  } else {
    // scale change based on horizontal drag
    const change = 1 + dx / 200;
    mgrState.scale = Math.max(0.2, initial.scale * change);
  }
  renderMgr();
});
// allow mouse wheel to adjust scale quickly (and keep it clamped)
smCanvas.addEventListener('wheel', (ev)=>{
  ev.preventDefault();
  const delta = -ev.deltaY; // wheel up -> increase
  const factor = 1 + (delta / 1000);
  const old = mgrState.scale;
  mgrState.scale = Math.max(0.2, Math.min(4, mgrState.scale * factor));
  // gently adjust offset so zoom centers on pointer position
  const r = smCanvas.getBoundingClientRect();
  const px = (ev.clientX - r.left) * (smCanvas.width / r.width);
  const py = (ev.clientY - r.top) * (smCanvas.height / r.height);
  const scaleRatio = mgrState.scale / old;
  mgrState.offset.x = (mgrState.offset.x - px) * scaleRatio + px;
  mgrState.offset.y = (mgrState.offset.y - py) * scaleRatio + py;
  renderMgr();
},{passive:false});
document.addEventListener('pointerup',(ev)=>{
  if(!dragging) return;
  dragging = false;
  // persist to store using normalized values relative to an assumed player box
  const key = mgrState.key;
  mgrStore[key] = { offset: {x: mgrState.offset.x, y: mgrState.offset.y}, scale: mgrState.scale, flip: mgrState.flip };
});

smSelect.addEventListener('change',(e)=>{
  // when changing via dropdown, persist current edits before loading new
  mgrStore[mgrState.key] = { offset: {x: mgrState.offset.x, y: mgrState.offset.y}, scale: mgrState.scale, flip: mgrState.flip };
  loadMgrFor(smSelect.value);
  renderMgr();
});
smMode.addEventListener('change',()=>{ /* no-op, handled in pointer events */ });
smFlip.addEventListener('click',()=>{
  mgrState.flip = !mgrState.flip;
  const key = mgrState.key;
  mgrStore[key] = { offset: {x: mgrState.offset.x, y: mgrState.offset.y}, scale: mgrState.scale, flip: mgrState.flip };
  renderMgr();
});
smReset.addEventListener('click',()=>{
  mgrState.offset = {x:0,y:0}; mgrState.scale = 1; mgrState.flip = false;
  mgrStore[mgrState.key] = { offset: {x:0,y:0}, scale:1, flip:false };
  renderMgr();
});
smClose.addEventListener('click', ()=>{ modal.classList.remove('active'); });

// Prev/Next navigation: cycle the select while saving current sprite state
function cycleSprite(delta){
  // persist current
  mgrStore[mgrState.key] = { offset: {x: mgrState.offset.x, y: mgrState.offset.y}, scale: mgrState.scale, flip: mgrState.flip };
  const opts = Array.from(smSelect.options).map(o=>o.value);
  let idx = opts.indexOf(mgrState.key);
  if(idx < 0) idx = 0;
  idx = (idx + delta + opts.length) % opts.length;
  smSelect.value = opts[idx];
  loadMgrFor(smSelect.value);
  renderMgr();
}
smPrev.addEventListener('click', ()=> cycleSprite(-1));
smNext.addEventListener('click', ()=> cycleSprite(1));

spriteMgrBtn.addEventListener('click', ()=>{
  // initialize and open modal
  loadMgrFor(smSelect.value);
  modal.classList.add('active');
  renderMgr();
});

// export to JSON: offsets and scale relative to an assumed hitbox size.
// We'll export per-key {offset:{x,y}, scale, flip} in pixel coordinates as edited.
smExport.addEventListener('click', ()=>{
  const out = {};
  for(const k of Object.keys(spriteImgs)){
    const s = mgrStore[k] || { offset:{x:0,y:0}, scale:1, flip:false };
    out[k] = s;
  }
  const json = JSON.stringify(out, null, 2);
  // copy to clipboard
  navigator.clipboard && navigator.clipboard.writeText(json).then(()=>{
    smExport.textContent = 'Copied!';
    setTimeout(()=> smExport.textContent = 'Export JSON', 1200);
  }).catch(()=>{ 
    // fallback: open new window with JSON
    const w = window.open('', '_blank');
    if(w){
      w.document.body.textContent = json;
    }
  });
});

// manager rendering: show a player hitbox centered and draw selected sprite with offsets/scale
function renderMgr(){
  smCtx.clearRect(0,0,smCanvas.width, smCanvas.height);
  // draw checker background
  smCtx.fillStyle = '#e9eef2';
  smCtx.fillRect(0,0,smCanvas.width, smCanvas.height);
  // center reference hitbox (main player hitbox)
  const boxW = 44, boxH = 44;
  const cx = smCanvas.width/2, cy = smCanvas.height/2 + 40;
  const boxX = cx - boxW/2, boxY = cy - boxH/2;

  // hitbox background and stronger border to emphasize main player hitbox
  smCtx.fillStyle = '#fff';
  smCtx.fillRect(boxX-2, boxY-2, boxW+4, boxH+4);
  smCtx.fillStyle = '#f7f7f7';
  smCtx.fillRect(boxX, boxY, boxW, boxH);
  smCtx.lineWidth = 3;
  smCtx.strokeStyle = '#ffcc00';
  smCtx.strokeRect(boxX-1.5, boxY-1.5, boxW+3, boxH+3);
  smCtx.lineWidth = 1;
  smCtx.strokeStyle = '#0002';
  smCtx.strokeRect(boxX, boxY, boxW, boxH);

  // label the hitbox clearly
  smCtx.fillStyle = '#111';
  smCtx.font = '13px system-ui,Arial';
  smCtx.textAlign = 'center';
  smCtx.fillText('Player hitbox', cx, boxY - 10);

  // draw crosshair center
  smCtx.strokeStyle = '#0006';
  smCtx.beginPath(); smCtx.moveTo(cx-8, cy); smCtx.lineTo(cx+8, cy); smCtx.moveTo(cx, cy-8); smCtx.lineTo(cx, cy+8); smCtx.stroke();

  // draw sprite if available
  const key = mgrState.key;
  const img = spriteImgs[key];
  if(img && img.complete){
    // compute draw size: use img natural size scaled by mgrState.scale, align feet to bottom of box
    const s = mgrState.scale;
    const drawW = img.width * s;
    const drawH = img.height * s;
    // compute base draw position so sprite's feet align with box bottom, then add mgr offset
    const baseX = cx - drawW/2 + mgrState.offset.x;
    const baseY = boxY + boxH - drawH + mgrState.offset.y;
    smCtx.save();
    if(mgrState.flip){
      smCtx.translate(baseX + drawW/2, 0);
      smCtx.scale(-1,1);
      smCtx.translate(-baseX - drawW/2, 0);
    }
    smCtx.drawImage(img, baseX, baseY, drawW, drawH);
    smCtx.restore();

    // outline of sprite draw rect
    smCtx.strokeStyle = '#1112';
    smCtx.strokeRect(baseX, baseY, drawW, drawH);
    // show offset text
    smCtx.fillStyle = '#111';
    smCtx.font = '12px system-ui,Arial';
    smCtx.textAlign = 'left';
    smCtx.fillText(`key: ${key}    offset: ${Math.round(mgrState.offset.x)} , ${Math.round(mgrState.offset.y)}    scale: ${mgrState.scale.toFixed(2)}`, 12, 18);
  } else {
    smCtx.fillStyle = '#333';
    smCtx.font = '14px system-ui,Arial';
    smCtx.textAlign = 'left';
    smCtx.fillText('Sprite not loaded yet', 12, 22);
  }
}

// load default store entries so all keys exist (apply saved sprite-manager JSON if present)
const presetMgrStore = {
  "idle": {
    "offset": {
      "x": 0.24777231499029995,
      "y": 4.277936987157773
    },
    "scale": 0.4343539466154037,
    "flip": false
  },
  "idle_bomb": {
    "offset": {
      "x": -3.3722023049332392,
      "y": 3.7541378960545444
    },
    "scale": 0.41675854774259313,
    "flip": false
  },
  "jump": {
    "offset": {
      "x": 0.2990702045517253,
      "y": 5.1575341753947725
    },
    "scale": 0.4328594936976954,
    "flip": false
  },
  "fall": {
    "offset": {
      "x": 0.6998661928877254,
      "y": 7.568215707864994
    },
    "scale": 0.43609669129029255,
    "flip": false
  },
  "down": {
    "offset": {
      "x": 0.024336618795530285,
      "y": 1.6907859257037217
    },
    "scale": 0.3968754949172493,
    "flip": false
  },
  "down_bomb": {
    "offset": {
      "x": 0.6176954475581624,
      "y": 4.968219316479292
    },
    "scale": 0.38294777127911384,
    "flip": false
  },
  "jump_bomb": {
    "offset": {
      "x": -9.70212891045827,
      "y": 7.673139547486471
    },
    "scale": 0.409434029866726,
    "flip": false
  },
  "fall_bomb": {
    "offset": {
      "x": -12.221157897823986,
      "y": 5.939561764577462
    },
    "scale": 0.4218856739019693,
    "flip": false
  },
  "give_bomb": {
    "offset": {
      "x": 8.025723250681096,
      "y": 0.4687420937715956
    },
    "scale": 0.3977248108960914,
    "flip": false
  },
  "getting_bomb": {
    "offset": {
      "x": 7.050594431348713,
      "y": 1.5178356355753806
    },
    "scale": 0.4054846476884287,
    "flip": false
  },
  "exploded": {
    "offset": {
      "x": 3.8055232010764257,
      "y": 9.267103112204637
    },
    "scale": 0.39264761313406066,
    "flip": false
  }
};
// ensure every known sprite key has an entry, using preset values or sensible defaults
for(const k of Object.keys(spriteImgs)){
  if(mgrStore[k]) continue;
  if(presetMgrStore[k]){
    mgrStore[k] = {
      offset: { x: presetMgrStore[k].offset.x, y: presetMgrStore[k].offset.y },
      scale: presetMgrStore[k].scale,
      flip: !!presetMgrStore[k].flip
    };
  } else {
    mgrStore[k] = { offset:{x:0,y:0}, scale:1, flip:false };
  }
}

// initial binding: when modal opens, ensure canvas has size consistent with device pixel ratio
function syncSmCanvas(){
  const r = smCanvas.getBoundingClientRect();
  smCanvas.width = Math.round(r.width * devicePixelRatio);
  smCanvas.height = Math.round(r.height * devicePixelRatio);
  smCtx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
  renderMgr();
}
window.addEventListener('resize', ()=>{ if(modal.classList.contains('active')) syncSmCanvas(); });
modal.addEventListener('transitionend', ()=>{ syncSmCanvas(); });

// If Websim failed to initialize or is unavailable, disable/hide Watch-related UI to avoid runtime errors.
// This runs after startup and will gracefully disable the Watch button if websim features aren't present.
setTimeout(()=>{
  try{
    if(!window.websimAvailable){
      const wb = document.getElementById('watchBtn');
      if(wb){
        wb.disabled = true;
        wb.style.opacity = '0.5';
        wb.title = 'Watch unavailable';
        // ensure any click handlers are removed to avoid accidental references to websimRoom
        wb.replaceWith(wb.cloneNode(true));
      }
      const watchModal = document.getElementById('watchModal');
      if(watchModal){
        watchModal.remove();
      }
    }
  }catch(e){
    // fail silently to keep the page robust even if DOM is in an unexpected state
  }
}, 600);