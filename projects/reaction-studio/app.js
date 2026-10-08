/* Reaction Studio – simple daily-use editor
   Speech bubbles always hover above the character
   and can force a character expression while active. */

const EXPRESSIONS = [
  "Normal","Happy","Sad","Mad","Ew","Oh...","Confused",
  "Scared","Nervous","Realization","Thinking","Shy","Yeah!!","Faceless"
];
const TTS_LANGS = [
  { id: "en", label: "English (US)" },
  { id: "en-gb", label: "English (UK)" },
  { id: "en-au", label: "English (AU)" },
  { id: "es", label: "Spanish" },
  { id: "fr", label: "French" },
  { id: "de", label: "German" },
  { id: "it", label: "Italian" },
  { id: "pt", label: "Portuguese" },
  { id: "pt-br", label: "Portuguese (BR)" },
  { id: "ja", label: "Japanese" },
  { id: "ko", label: "Korean" },
  { id: "zh-CN", label: "Chinese" },
  { id: "ru", label: "Russian" },
  { id: "nl", label: "Dutch" },
  { id: "pl", label: "Polish" },
  { id: "tr", label: "Turkish" },
  { id: "hi", label: "Hindi" },
  { id: "ar", label: "Arabic" }
];
/* Kokoro (tts.ai) — free CORS neural TTS: language, male/female, speed; pitch via detune */
const KOKORO_VOICES = [
  { id: "af_bella", name: "Bella", lang: "en", gender: "female", region: "US" },
  { id: "af_nicole", name: "Nicole", lang: "en", gender: "female", region: "US" },
  { id: "af_sarah", name: "Sarah", lang: "en", gender: "female", region: "US" },
  { id: "af_sky", name: "Sky", lang: "en", gender: "female", region: "US" },
  { id: "af_heart", name: "Heart", lang: "en", gender: "female", region: "US" },
  { id: "am_adam", name: "Adam", lang: "en", gender: "male", region: "US" },
  { id: "am_michael", name: "Michael", lang: "en", gender: "male", region: "US" },
  { id: "bf_emma", name: "Emma", lang: "en", gender: "female", region: "UK" },
  { id: "bf_isabella", name: "Isabella", lang: "en", gender: "female", region: "UK" },
  { id: "bm_george", name: "George", lang: "en", gender: "male", region: "UK" },
  { id: "bm_lewis", name: "Lewis", lang: "en", gender: "male", region: "UK" },
  { id: "jf_alpha", name: "Alpha", lang: "ja", gender: "female", region: "" },
  { id: "jf_gongitsune", name: "Gongitsune", lang: "ja", gender: "female", region: "" },
  { id: "zf_xiaobei", name: "Xiaobei", lang: "zh", gender: "female", region: "" },
  { id: "zf_xiaoni", name: "Xiaoni", lang: "zh", gender: "female", region: "" },
  { id: "zf_xiaoxiao", name: "Xiaoxiao", lang: "zh", gender: "female", region: "" },
  { id: "zm_yunjian", name: "Yunjian", lang: "zh", gender: "male", region: "" },
  { id: "ef_dora", name: "Dora", lang: "es", gender: "female", region: "" },
  { id: "em_alex", name: "Alex", lang: "es", gender: "male", region: "" },
  { id: "ff_siwis", name: "Siwis", lang: "fr", gender: "female", region: "" },
  { id: "hf_alpha", name: "Alpha", lang: "hi", gender: "female", region: "" },
  { id: "hm_omega", name: "Omega", lang: "hi", gender: "male", region: "" },
  { id: "if_sara", name: "Sara", lang: "it", gender: "female", region: "" },
  { id: "im_nicola", name: "Nicola", lang: "it", gender: "male", region: "" },
  { id: "pf_dora", name: "Dora", lang: "pt", gender: "female", region: "" },
  { id: "pm_alex", name: "Alex", lang: "pt", gender: "male", region: "" }
];
const KOKORO_LANGS = [
  { id: "en", label: "English" }, { id: "ja", label: "Japanese" },
  { id: "zh", label: "Chinese" }, { id: "es", label: "Spanish" },
  { id: "fr", label: "French" }, { id: "hi", label: "Hindi" },
  { id: "it", label: "Italian" }, { id: "pt", label: "Portuguese" }
];
function pickKokoroVoice(lang, gender, preferredId) {
  if (preferredId && KOKORO_VOICES.some(v => v.id === preferredId)) return preferredId;
  const g = (gender || "female").toLowerCase();
  const l = lang || "en";
  const m = KOKORO_VOICES.find(v => v.lang === l && v.gender === g);
  if (m) return m.id;
  const any = KOKORO_VOICES.find(v => v.gender === g) || KOKORO_VOICES[0];
  return any.id;
}

/* Natural pitch/speed step = 0.05 → 2 ticks = 0.10 */
const TTS_PRESETS = {
  orgeyt: {
    label: "OrgeYT's voice",
    ttsEngine: "neural",
    ttsLang: "en",
    ttsGender: "male",
    ttsVoice: "am_adam", // Adam (US male) — preferred
    ttsPitch: 0.9,
    ttsSpeed: 1.1,
    ttsAmplitude: 100
  },
  robot: {
    label: "Robot default",
    ttsEngine: "robot",
    ttsLang: "en",
    ttsGender: "default",
    ttsPitch: 50,
    ttsSpeed: 175,
    ttsAmplitude: 100
  },
  neural: {
    label: "Neural default (Kokoro)",
    ttsEngine: "neural",
    ttsLang: "en",
    ttsGender: "female",
    ttsVoice: "af_bella",
    ttsPitch: 1,
    ttsSpeed: 1,
    ttsAmplitude: 100
  },
  natural: {
    label: "Google TTS default",
    ttsEngine: "natural",
    ttsLang: "en",
    ttsGender: "default",
    ttsPitch: 1,
    ttsSpeed: 1,
    ttsAmplitude: 100
  }
};

function ttsSettingsKey(sp) {
  return [
    sp.ttsEngine || "robot",
    sp.text || "",
    sp.ttsLang || "en",
    sp.ttsGender || "default",
    sp.ttsVoice || "",
    sp.ttsPitch != null ? sp.ttsPitch : "",
    sp.ttsSpeed != null ? sp.ttsSpeed : "",
    sp.ttsAmplitude != null ? sp.ttsAmplitude : ""
  ].join("|");
}

/** Free Google TTS has no real gender API — approximate male/female with pitch. */
function applyGenderToPitch(pitch, gender) {
  const p = +pitch || 1;
  if (gender === "male") return clamp(p * 0.72, 0.25, 2);
  if (gender === "female") return clamp(p * 1.18, 0.25, 2);
  return clamp(p, 0.25, 2);
}
const SOUNDBOARD = [
  "a-few-moments-later","air-horn","among-us-kill","among-us-role-reveal","anderdingus",
  "anime-wow","apple-pay","asdasd","autotune-laugh","back-up","bad-to-the-bone",
  "ben-hohohoh","bing-chilling","bloxy-cola","bone-crack","bonk","bruh","camera-shutter",
  "car-crash","cat-iphone-ringtone","cat-laugh","censor-beep","cha-ching-money","clapping",
  "concrete-scrape","confetti-pop","ding","discord-leave","discord-notification","downer-noise",
  "dun-dun-dun","enrique","error","explosion-meme","faah","fart-with-reverb","fart",
  "fortnite-death","galaxy","gopgopgop","gta-ah-shit","gta-death","gunshot","heavenly-music",
  "huh","i-farted","i-like-ya-cut-g","kids-saying-yay","lack-of-a-father-figure","laugh",
  "long-brain-fart","mafioso-scream","man-snoring","metal-pipe","michael-dont-leave-me-here",
  "minecraft-explosion","nanannonono","no-no-wait-wait","nope","notification",
  "oh-hell-nah","oh-my-god","oh-no-no-no-no-laugh","oh-no-no-no-tiktok","oi-oi-oe","oi-oi",
  "orgeyt","pc-explosion","pluh","prowler","quack","raaar","rizz","roblox-bye",
  "roblox-eating","roblox-explosion","roblox-hi","roblox-its-free","roblox-oof",
  "roblox-screaming-kid","roblox-sword","sad-meow-song","scream","shut-your-mouth",
  "skibidi-toilet","smoke-detector","spider-man","spongebob-fail","studio-audience-awwww",
  "sus-meow","taco-bell","take-off","talking-ben-no","talking-ben-ugh","talking-ben-yes",
  "undertaker-bell","undertale-gameover","uwu","vine-boom","weeeee","well-be-right-back",
  "what-the-dog-doing","wilhelm-scream","wrong-answer","yeah-boi","yeahoo","yes-lara",
  "yippee","your-phone-ringing","youre-fine"
];
const STORAGE_KEY = "rve_project_v4";

const state = {
  videos: [],
  texts: [],
  sounds: [],
  speeches: [], // { id, text, start, end, expression }
  character: {
    visible: true,
    expression: "Normal",
    x: 82, y: 72, scale: 1,
    keyframes: [],
    customImages: {}, // { expressionName: dataURL }
    slide: null
  },
  totalDuration: 0,
  currentTime: 0,
  playing: false,
  pixelsPerSecond: 40,
  recording: false,
  exportAbort: false,
  masterVol: 1,
  /** When on, lower video volume while any TTS speech is active */
  ttsDuckOn: false,
  ttsDuckVol: 0.25, // video volume (0–1) during TTS
  dirty: false
};

let charImages = {};       // default built-in
let customCharImages = {}; // loaded Image objects for custom
let pendingExprUpload = null; // which expression slot is waiting for a file
let animFrameId = null;
let activeVideoEl = null;
let mediaRecorder = null;
let recordedChunks = [];
let sharedAudioCtx = null; // persistent — MediaElementSource can only connect once
let sharedMasterGain = null;

const drag = { active: false, startMX: 0, startMY: 0, startX: 0, startY: 0, charRect: null };

const canvas = document.getElementById("preview-canvas");
const ctx = canvas.getContext("2d", { alpha: false });
const uploadOverlay = document.getElementById("upload-overlay");
const seekBar = document.getElementById("seek-bar");
const timeDisplay = document.getElementById("time-display");
const btnPlay = document.getElementById("btn-play");
const btnPause = document.getElementById("btn-pause");
const btnStop = document.getElementById("btn-stop");
const btnExport = document.getElementById("btn-export");
const exportStatus = document.getElementById("export-status");
const timelineEl = document.getElementById("timeline");
const timelineTracks = document.getElementById("timeline-tracks");
const timelineRuler = document.getElementById("timeline-ruler");
const playhead = document.getElementById("playhead");
const saveIndicator = document.getElementById("save-indicator");
const canvasWrap = document.getElementById("canvas-wrap");

const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const lerp = (a,b,t) => a + (b - a) * t;
function fmtTime(s) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60), cs = Math.floor((s % 1) * 10);
  return `${m}:${sec.toString().padStart(2,"0")}.${cs}`;
}
function escapeHtml(str) {
  return String(str ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

/* ---- TTS (Robot = eSpeak/speak.js, Natural = Google TTS) ---- */
function wavToDataUrl(wav) {
  // wav: Uint8Array or ArrayBuffer from generateSpeech
  const u8 = wav instanceof Uint8Array ? wav : new Uint8Array(wav);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) {
    binary += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
  }
  return "data:audio/wav;base64," + btoa(binary);
}

function generateRobotTTS(text, opts = {}) {
  if (typeof generateSpeech !== "function") {
    throw new Error("Robot TTS engine not loaded (speakGenerator.js)");
  }
  const pitch = opts.pitch != null ? +opts.pitch : 50;
  const speed = opts.speed != null ? +opts.speed : 175;
  const amplitude = opts.amplitude != null ? +opts.amplitude : 100;
  const wav = generateSpeech(String(text || " "), {
    pitch, speed, amplitude, wordgap: opts.wordgap != null ? +opts.wordgap : 0
  });
  const dataUrl = wavToDataUrl(wav);
  return dataUrl;
}

/* Map UI language ids → tts-api.netlify.app codes (many Google codes 500 there) */
const PROXY_LANG_MAP = {
  "en": "en", "en-gb": "uk", "en-GB": "uk", "en-au": "en", "en-us": "en",
  "es": "es", "fr": "fr", "de": "de", "it": "it", "pt": "pt", "pt-br": "pt",
  "ja": "ja", "ko": "ko", "zh-CN": "zh", "zh": "zh", "ru": "ru",
  "nl": "nl", "pl": "pl", "tr": "tr", "hi": "hi", "ar": "ar"
};
function proxyLang(lang) {
  if (!lang) return "en";
  if (PROXY_LANG_MAP[lang]) return PROXY_LANG_MAP[lang];
  const base = String(lang).split(/[-_]/)[0].toLowerCase();
  return PROXY_LANG_MAP[base] || base || "en";
}

function chromiumGoogleTtsUrl(text, lang, speed, pitch) {
  // Same endpoint voicegenerator.io uses for "Download Google TTS Audio"
  const q = encodeURIComponent(String(text || " ").slice(0, 200));
  // Chromium API prefers BCP-47 like en-GB
  let tl = lang || "en";
  if (tl === "en-gb") tl = "en-GB";
  if (tl === "zh-CN") tl = "zh-CN";
  const sp = clamp(+speed || 1, 0.1, 1.0);
  const pi = clamp(+pitch || 0.5, 0, 1);
  return `https://www.google.com/speech-api/v2/synthesize?enc=mpeg&client=chromium&key=AIzaSyBOti4mM-6x9WDnZIjIeyEU21OpBXqWBgw&text=${q}&lang=${encodeURIComponent(tl)}&speed=${sp}&pitch=${pi}`;
}

function corsGoogleTtsUrl(text, lang, speed, pitch) {
  // CORS-friendly Google TTS proxy → MP3 blob usable in browser + export
  const q = encodeURIComponent(String(text || " ").slice(0, 200));
  const tl = encodeURIComponent(proxyLang(lang));
  const sp = clamp(+speed || 1, 0.25, 2);
  const pi = clamp(+pitch || 1, 0.25, 2);
  return `https://tts-api.netlify.app/?text=${q}&lang=${tl}&speed=${sp}&pitch=${pi}`;
}

function translateTtsUrl(text, lang) {
  let tl = lang || "en";
  if (tl === "en-gb") tl = "en-GB";
  const q = encodeURIComponent(String(text || " ").slice(0, 200));
  return `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&q=${q}&tl=${encodeURIComponent(tl)}`;
}

async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

async function fetchAudioDataUrl(url, attempts = 2) {
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { mode: "cors", credentials: "omit", cache: "no-store" });
      if (!res.ok) {
        lastErr = new Error("HTTP " + res.status);
        await new Promise(r => setTimeout(r, 200 * (i + 1)));
        continue;
      }
      const blob = await res.blob();
      if (blob.size < 200) {
        lastErr = new Error("tiny blob " + blob.size);
        continue;
      }
      // Reject HTML error pages mistaken as audio
      const type = (blob.type || "").toLowerCase();
      if (type.includes("text") || type.includes("json") || type.includes("html")) {
        lastErr = new Error("not audio: " + type);
        continue;
      }
      return await blobToDataUrl(blob);
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 250 * (i + 1)));
    }
  }
  if (lastErr) console.warn("fetchAudioDataUrl failed", url, lastErr);
  return null;
}

async function generateNaturalTTS(text, opts = {}) {
  const lang = opts.lang || "en";
  const uiSpeed = opts.speed != null ? +opts.speed : 1;   // 0.5–1.5
  const uiPitch = opts.pitch != null ? +opts.pitch : 1;   // 0.5–1.5
  const gender = opts.gender || "default";
  // Male/female approximated via pitch (Google free TTS has no gender param)
  const effectivePitch = applyGenderToPitch(uiPitch, gender);

  // 1) CORS proxy (tts-api) — preferred, supports pitch/speed
  const proxyUrl = corsGoogleTtsUrl(text, lang, uiSpeed, effectivePitch);
  let dataUrl = await fetchAudioDataUrl(proxyUrl, 3);
  if (dataUrl) return { dataUrl, url: proxyUrl };

  // 2) Same proxy with gender pitch only (speed=1) if full params failed
  const simpleProxy = corsGoogleTtsUrl(text, lang, 1, effectivePitch);
  if (simpleProxy !== proxyUrl) {
    dataUrl = await fetchAudioDataUrl(simpleProxy, 2);
    if (dataUrl) return { dataUrl, url: simpleProxy };
  }

  // 3) Chromium Google speech-api (may CORS-fail in browser)
  const gSpeed = clamp(uiSpeed * 0.5, 0.1, 1);
  const gPitch = clamp(effectivePitch * 0.5, 0, 1);
  const chromeUrl = chromiumGoogleTtsUrl(text, lang, gSpeed, gPitch);
  dataUrl = await fetchAudioDataUrl(chromeUrl, 1);
  if (dataUrl) return { dataUrl, url: chromeUrl };

  // 4) translate.googleapis.com (may CORS-fail)
  const trUrl = translateTtsUrl(text, lang);
  dataUrl = await fetchAudioDataUrl(trUrl, 1);
  if (dataUrl) return { dataUrl, url: trUrl };

  // 5) Stream URL only — HTML Audio can still play; export needs dataUrl
  console.warn("Natural TTS: no blob; playback-only URL", chromeUrl);
  return { dataUrl: null, url: chromeUrl || trUrl || proxyUrl };
}

/** Kokoro neural TTS via tts.ai (free, CORS, gender + language + speed) */
async function generateNeuralTTS(text, opts = {}) {
  const lang = opts.lang || "en";
  const gender = opts.gender || "female";
  const voice = pickKokoroVoice(lang, gender, opts.voice);
  const speed = clamp(+opts.speed || 1, 0.5, 2);
  const body = {
    text: String(text || " ").slice(0, 500),
    voice,
    model: "kokoro",
    speed,
    format: "mp3"
  };
  let data = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch("https://api.tts.ai/v1/tts/", {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
        continue;
      }
      data = await res.json();
      break;
    } catch (e) {
      console.warn("Kokoro TTS request failed", e);
      await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
    }
  }
  if (!data) return { dataUrl: null, url: null, voice };

  let audioUrl = data.result_url || null;
  if (!audioUrl && data.uuid) {
    audioUrl = `https://cdn.tts.ai/${data.uuid}/tts_output.mp3`;
  }
  if (!audioUrl) return { dataUrl: null, url: null, voice };

  // Poll CDN until audio is ready (queued jobs)
  for (let i = 0; i < 12; i++) {
    const dataUrl = await fetchAudioDataUrl(audioUrl, 1);
    if (dataUrl) return { dataUrl, url: audioUrl, voice };
    await new Promise(r => setTimeout(r, 400));
  }
  return { dataUrl: null, url: audioUrl, voice };
}

/** Pitch multiplier → AudioBufferSourceNode.detune (cents). 1.0 = 0 cents */
function pitchToDetune(pitch) {
  const p = +pitch;
  if (!isFinite(p) || p <= 0) return 0;
  // map 0.5..1.5 → roughly -1200..+700 cents
  return Math.round(1200 * Math.log2(p));
}

function loadAudioDuration(src) {
  return new Promise((resolve) => {
    const a = new Audio();
    a.preload = "metadata";
    const done = (d) => { resolve(isFinite(d) && d > 0 ? d : 1.5); };
    a.onloadedmetadata = () => done(a.duration);
    a.onerror = () => done(1.5);
    a.src = src;
  });
}

async function generateSpeechTTS(sp, opts = {}) {
  if (!sp || !sp.ttsOn) return false;
  const text = sp.text || "…";
  const engine = sp.ttsEngine || "robot";
  const silent = !!opts.silent;
  // Keep previous audio until new generation succeeds (so export never goes silent on a failed regen)
  const prevData = sp.ttsDataUrl;
  const prevStream = sp.ttsStreamUrl;
  const prevKey = sp._ttsKey;
  try {
    if (engine === "robot") {
      const dataUrl = generateRobotTTS(text, {
        pitch: sp.ttsPitch != null ? sp.ttsPitch : 50,
        speed: sp.ttsSpeed != null ? sp.ttsSpeed : 175,
        amplitude: sp.ttsAmplitude != null ? sp.ttsAmplitude : 100
      });
      sp.ttsDataUrl = dataUrl;
      sp.ttsStreamUrl = null;
      sp._ttsBuffer = null;
      const dur = await loadAudioDuration(dataUrl);
      sp.ttsDuration = dur;
      sp.end = sp.start + dur;
      if (sp._ttsAudio) { try { sp._ttsAudio.pause(); } catch (_) {} }
      sp._ttsAudio = new Audio(dataUrl);
      sp._ttsAudio.preload = "auto";
      sp._ttsAudio.volume = state.masterVol;
    } else if (engine === "neural") {
      const voiceId = pickKokoroVoice(sp.ttsLang || "en", sp.ttsGender || "female", sp.ttsVoice);
      sp.ttsVoice = voiceId;
      const { dataUrl, url, voice } = await generateNeuralTTS(text, {
        lang: sp.ttsLang || "en",
        gender: sp.ttsGender || "female",
        voice: voiceId,
        speed: sp.ttsSpeed != null ? sp.ttsSpeed : 1
      });
      if (voice) sp.ttsVoice = voice;
      if (!dataUrl) {
        if (prevData) {
          console.warn("Neural TTS failed; keeping previous audio");
          sp.ttsDataUrl = prevData;
          sp.ttsStreamUrl = prevStream;
          sp._ttsKey = prevKey;
          return !!prevData;
        }
        throw new Error("Neural (Kokoro) TTS returned no audio — check network");
      }
      sp.ttsDataUrl = dataUrl;
      sp.ttsStreamUrl = url;
      sp._ttsBuffer = null;
      const dur = await loadAudioDuration(dataUrl);
      sp.ttsDuration = dur;
      sp.end = sp.start + dur;
      if (sp._ttsAudio) { try { sp._ttsAudio.pause(); } catch (_) {} }
      sp._ttsAudio = new Audio(dataUrl);
      sp._ttsAudio.preload = "auto";
      sp._ttsAudio.volume = state.masterVol;
      // Store detune for export pitch (Kokoro API has no pitch param)
      sp._ttsDetune = pitchToDetune(sp.ttsPitch != null ? sp.ttsPitch : 1);
    } else {
      // Google TTS (natural)
      const { dataUrl, url } = await generateNaturalTTS(text, {
        lang: sp.ttsLang || "en",
        speed: sp.ttsSpeed != null ? sp.ttsSpeed : 1,
        pitch: sp.ttsPitch != null ? sp.ttsPitch : 1,
        gender: sp.ttsGender || "default"
      });
      if (!dataUrl) {
        if (prevData) {
          console.warn("Google TTS regen failed; keeping previous audio");
          sp.ttsDataUrl = prevData;
          sp.ttsStreamUrl = prevStream;
          sp._ttsKey = prevKey;
          return !!prevData;
        }
        if (url) {
          sp.ttsStreamUrl = url;
          sp.ttsDataUrl = null;
          const dur = await loadAudioDuration(url);
          sp.ttsDuration = dur;
          sp.end = sp.start + dur;
          if (sp._ttsAudio) { try { sp._ttsAudio.pause(); } catch (_) {} }
          sp._ttsAudio = new Audio(url);
          sp._ttsAudio.preload = "auto";
          sp._ttsAudio.volume = state.masterVol;
          sp._ttsKey = ttsSettingsKey(sp);
          if (!silent) alert("Google TTS loaded for preview only. Prefer Neural (Kokoro) for reliable export.");
          return false;
        }
        throw new Error("Google TTS returned no audio (network or language)");
      }
      sp.ttsDataUrl = dataUrl;
      sp.ttsStreamUrl = url;
      sp._ttsBuffer = null;
      sp._ttsDetune = 0;
      const dur = await loadAudioDuration(dataUrl);
      sp.ttsDuration = dur;
      sp.end = sp.start + dur;
      if (sp._ttsAudio) { try { sp._ttsAudio.pause(); } catch (_) {} }
      sp._ttsAudio = new Audio(dataUrl);
      sp._ttsAudio.preload = "auto";
      sp._ttsAudio.volume = state.masterVol;
    }
    sp._ttsKey = ttsSettingsKey(sp);
    return true;
  } catch (err) {
    console.warn("TTS generate failed", err);
    // Restore previous on hard failure
    if (prevData) {
      sp.ttsDataUrl = prevData;
      sp.ttsStreamUrl = prevStream;
      sp._ttsKey = prevKey;
    }
    if (!silent) alert("TTS failed: " + (err.message || err));
    return false;
  }
}

function playSpeechTTS(sp) {
  if (!sp || !sp.ttsOn) return;
  if (!sp._ttsAudio && (sp.ttsDataUrl || sp.ttsStreamUrl)) {
    sp._ttsAudio = new Audio(sp.ttsDataUrl || sp.ttsStreamUrl);
    sp._ttsAudio.volume = state.masterVol;
  }
  if (sp._ttsAudio) {
    try {
      sp._ttsAudio.currentTime = 0;
      sp._ttsAudio.volume = state.masterVol;
      sp._ttsAudio.play().catch(() => {});
    } catch (_) {}
  }
}

/** True if any TTS-enabled speech is active at timeline time t */
function isTtsActiveAt(t) {
  return state.speeches.some(sp =>
    sp.ttsOn && t >= sp.start && t < (sp.end != null ? sp.end : sp.start + (sp.ttsDuration || 2))
  );
}

/** Set all video element volumes (preview) based on duck settings */
function applyVideoVolumeForTime(t, opts = {}) {
  const ducking = state.ttsDuckOn && isTtsActiveAt(t);
  const vol = ducking
    ? state.masterVol * clamp(state.ttsDuckVol, 0, 1)
    : state.masterVol;
  state.videos.forEach(v => {
    if (v.videoEl) v.videoEl.volume = vol;
    if (opts.useWaGain && v._waGain) {
      try { v._waGain.gain.value = ducking ? clamp(state.ttsDuckVol, 0, 1) : 1; } catch (_) {}
    }
  });
  return ducking;
}

function getCharImage(expr) {
  const key = expr || "Normal";
  if (customCharImages[key] && customCharImages[key].complete && customCharImages[key].naturalWidth) {
    return customCharImages[key];
  }
  // fallback: any custom image if this expression has none (e.g. single-image mode)
  if (Object.keys(customCharImages).length) {
    const first = Object.values(customCharImages).find(im => im && im.complete && im.naturalWidth);
    if (first) return first;
  }
  let img = charImages[key] || charImages["Normal"];
  if (!img || !img.complete || !img.naturalWidth) img = charImages["Normal"];
  return img;
}

async function loadCustomFromDataUrls(map) {
  customCharImages = {};
  if (!map) return;
  const entries = Object.entries(map);
  await Promise.all(entries.map(([exp, dataUrl]) => new Promise(resolve => {
    if (!dataUrl) { resolve(); return; }
    const img = new Image();
    img.onload = () => { customCharImages[exp] = img; resolve(); };
    img.onerror = () => resolve();
    img.src = dataUrl;
  })));
}

function renderExprGrid() {
  const grid = document.getElementById("expr-grid");
  if (!grid) return;
  grid.innerHTML = EXPRESSIONS.map(exp => {
    const hasCustom = !!(state.character.customImages && state.character.customImages[exp]);
    const src = hasCustom
      ? state.character.customImages[exp]
      : `assets/characters/Reaction character_${exp}.png`;
    return `<button type="button" class="expr-slot ${hasCustom ? "custom" : ""}" data-exp="${escapeHtml(exp)}" title="Click to replace ${escapeHtml(exp)}">
      <img src="${src}" alt="${escapeHtml(exp)}" />
      <span>${escapeHtml(exp)}</span>
    </button>`;
  }).join("");
  grid.querySelectorAll(".expr-slot").forEach(btn => {
    btn.addEventListener("click", () => {
      pendingExprUpload = btn.dataset.exp;
      document.getElementById("char-upload-expr").click();
    });
  });
}

async function setCustomImageFor(exp, file) {
  if (!file || !file.type.startsWith("image/")) return;
  const dataUrl = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  if (!state.character.customImages) state.character.customImages = {};
  state.character.customImages[exp] = dataUrl;
  const img = new Image();
  await new Promise(r => { img.onload = r; img.onerror = r; img.src = dataUrl; });
  customCharImages[exp] = img;
  markDirty();
  renderExprGrid();
  drawFrame();
}

async function setCustomImageForAll(file) {
  if (!file || !file.type.startsWith("image/")) return;
  const dataUrl = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  if (!state.character.customImages) state.character.customImages = {};
  const img = new Image();
  await new Promise(r => { img.onload = r; img.onerror = r; img.src = dataUrl; });
  for (const exp of EXPRESSIONS) {
    state.character.customImages[exp] = dataUrl;
    customCharImages[exp] = img;
  }
  markDirty();
  renderExprGrid();
  drawFrame();
}

function resetAppearance() {
  state.character.customImages = {};
  customCharImages = {};
  markDirty();
  renderExprGrid();
  drawFrame();
}

async function init() {
  for (const exp of EXPRESSIONS) {
    const img = new Image();
    img.src = `assets/characters/Reaction character_${exp}.png`;
    await new Promise(r => { img.onload = r; img.onerror = r; });
    charImages[exp] = img;
  }
  buildSoundboard();
  bindEvents();
  renderExprGrid();
  checkBackup();
  drawFrame();
}

function bindEvents() {
  document.getElementById("btn-upload-video").addEventListener("click", () => document.getElementById("video-input").click());
  document.getElementById("video-input").addEventListener("change", e => handleVideos(e.target.files));
  uploadOverlay.addEventListener("dragover", e => e.preventDefault());
  uploadOverlay.addEventListener("drop", e => { e.preventDefault(); handleVideos(e.dataTransfer.files); });

  btnPlay.addEventListener("click", play);
  btnPause.addEventListener("click", pause);
  btnStop.addEventListener("click", stop);
  seekBar.addEventListener("input", () => seek((+seekBar.value / 1000) * state.totalDuration));
  document.getElementById("master-vol").addEventListener("input", e => {
    state.masterVol = +e.target.value;
    applyVideoVolumeForTime(state.currentTime);
    state.sounds.forEach(s => { if (s.audio) s.audio.volume = state.masterVol; });
    if (sharedMasterGain) sharedMasterGain.gain.value = state.masterVol;
  });
  // TTS video duck controls (global — applies to all TTS speech events)
  const duckOn = document.getElementById("tts-duck-on");
  const duckWrap = document.getElementById("tts-duck-vol-wrap");
  const duckVol = document.getElementById("tts-duck-vol");
  const duckVal = document.getElementById("tts-duck-vol-val");
  if (duckOn) {
    duckOn.checked = !!state.ttsDuckOn;
    duckOn.addEventListener("change", () => {
      state.ttsDuckOn = duckOn.checked;
      if (duckWrap) duckWrap.classList.toggle("hidden", !state.ttsDuckOn);
      applyVideoVolumeForTime(state.currentTime);
      markDirty();
    });
  }
  if (duckVol) {
    duckVol.value = Math.round(state.ttsDuckVol * 100);
    if (duckVal) duckVal.textContent = Math.round(state.ttsDuckVol * 100) + "%";
    if (duckWrap) duckWrap.classList.toggle("hidden", !state.ttsDuckOn);
    duckVol.addEventListener("input", () => {
      state.ttsDuckVol = (+duckVol.value) / 100;
      if (duckVal) duckVal.textContent = Math.round(state.ttsDuckVol * 100) + "%";
      applyVideoVolumeForTime(state.currentTime);
      markDirty();
    });
  }
  document.getElementById("timeline-zoom").addEventListener("input", e => {
    state.pixelsPerSecond = +e.target.value * 8;
    renderTimeline();
  });

  document.getElementById("btn-add-text").addEventListener("click", addText);
  document.getElementById("btn-add-speech").addEventListener("click", addSpeech);
  document.getElementById("btn-char-keyframe").addEventListener("click", addCharKeyframe);
  document.getElementById("btn-char-visible").addEventListener("click", () => {
    // Toggle visibility and clear any stuck slide so character can always reappear
    state.character.slide = null;
    state.character.visible = !state.character.visible;
    // If turning visible on, also fix keyframes that locked visible:false at this time
    if (state.character.visible) {
      state.character.keyframes.forEach(k => {
        if (Math.abs(k.time - state.currentTime) < 0.15) k.visible = true;
      });
    }
    markDirty();
    drawFrame();
  });
  document.getElementById("btn-char-slide-in").addEventListener("click", () => {
    state.character.visible = true;
    state.character.slide = { type: "in", start: state.currentTime, duration: 0.4 };
    markDirty();
    drawFrame();
  });
  document.getElementById("btn-char-slide-out").addEventListener("click", () => {
    state.character.slide = { type: "out", start: state.currentTime, duration: 0.4 };
    markDirty();
    drawFrame();
  });
  document.getElementById("char-expression").addEventListener("change", e => {
    state.character.expression = e.target.value; markDirty(); drawFrame();
  });
  document.getElementById("char-scale").addEventListener("input", e => {
    state.character.scale = +e.target.value; markDirty(); drawFrame();
  });
  document.getElementById("btn-char-upload-one").addEventListener("click", () => document.getElementById("char-upload-one").click());
  document.getElementById("char-upload-one").addEventListener("change", e => {
    const f = e.target.files && e.target.files[0];
    if (f) setCustomImageForAll(f);
    e.target.value = "";
  });
  document.getElementById("char-upload-expr").addEventListener("change", e => {
    const f = e.target.files && e.target.files[0];
    if (f && pendingExprUpload) setCustomImageFor(pendingExprUpload, f);
    pendingExprUpload = null;
    e.target.value = "";
  });
  document.getElementById("btn-char-reset-appear").addEventListener("click", resetAppearance);

  // Pre-add TTS settings panel
  const langSel = document.getElementById("speech-tts-lang");
  if (langSel && !langSel.options.length) {
    TTS_LANGS.forEach(l => {
      const o = document.createElement("option");
      o.value = l.id; o.textContent = l.label;
      langSel.appendChild(o);
    });
  }
  const langNeu = document.getElementById("speech-tts-lang-neural");
  if (langNeu && !langNeu.options.length) {
    KOKORO_LANGS.forEach(l => {
      const o = document.createElement("option");
      o.value = l.id; o.textContent = l.label;
      langNeu.appendChild(o);
    });
  }
  function refreshKokoroVoiceSelect() {
    const sel = document.getElementById("speech-tts-voice");
    if (!sel) return;
    const lang = document.getElementById("speech-tts-lang-neural").value || "en";
    const gender = document.getElementById("speech-tts-gender").value || "female";
    const prev = sel.value;
    const list = KOKORO_VOICES.filter(v => v.lang === lang && v.gender === gender);
    const fallback = KOKORO_VOICES.filter(v => v.lang === lang);
    const voices = list.length ? list : (fallback.length ? fallback : KOKORO_VOICES);
    sel.innerHTML = voices.map(v =>
      `<option value="${v.id}">${v.name}${v.region ? " (" + v.region + ")" : ""}</option>`
    ).join("");
    if (voices.some(v => v.id === prev)) sel.value = prev;
  }
  function syncPreTtsPanel() {
    const on = document.getElementById("speech-tts-on").checked;
    const panel = document.getElementById("tts-pre-settings");
    panel.classList.toggle("hidden", !on);
    const eng = document.getElementById("speech-tts-engine").value;
    document.getElementById("tts-pre-robot").classList.toggle("hidden", eng !== "robot");
    document.getElementById("tts-pre-natural").classList.toggle("hidden", eng !== "natural");
    document.getElementById("tts-pre-neural").classList.toggle("hidden", eng !== "neural");
    if (eng === "neural") refreshKokoroVoiceSelect();
  }
  document.getElementById("speech-tts-on").addEventListener("change", syncPreTtsPanel);
  document.getElementById("speech-tts-engine").addEventListener("change", () => {
    document.getElementById("speech-tts-preset").value = "custom";
    syncPreTtsPanel();
  });
  document.getElementById("speech-tts-lang-neural").addEventListener("change", () => {
    document.getElementById("speech-tts-preset").value = "custom";
    refreshKokoroVoiceSelect();
  });
  document.getElementById("speech-tts-gender").addEventListener("change", () => {
    document.getElementById("speech-tts-preset").value = "custom";
    refreshKokoroVoiceSelect();
  });
  function applyTtsPreset(id) {
    const p = TTS_PRESETS[id];
    if (!p) return;
    document.getElementById("speech-tts-engine").value = p.ttsEngine;
    if (p.ttsEngine === "robot") {
      document.getElementById("speech-tts-pitch").value = p.ttsPitch;
      document.getElementById("speech-tts-speed-robot").value = p.ttsSpeed;
      document.getElementById("speech-tts-amp").value = p.ttsAmplitude;
      document.getElementById("pre-pitch-val").textContent = String(p.ttsPitch);
      document.getElementById("pre-speed-val").textContent = String(p.ttsSpeed);
      document.getElementById("pre-amp-val").textContent = String(p.ttsAmplitude);
    } else if (p.ttsEngine === "neural") {
      document.getElementById("speech-tts-lang-neural").value = p.ttsLang || "en";
      document.getElementById("speech-tts-gender").value = p.ttsGender || "female";
      refreshKokoroVoiceSelect();
      if (p.ttsVoice) document.getElementById("speech-tts-voice").value = p.ttsVoice;
      document.getElementById("speech-tts-pitch-neural").value = p.ttsPitch;
      document.getElementById("speech-tts-speed-neural").value = p.ttsSpeed;
      document.getElementById("pre-neupitch-val").textContent = (+p.ttsPitch).toFixed(2);
      document.getElementById("pre-neuspeed-val").textContent = (+p.ttsSpeed).toFixed(2);
    } else {
      document.getElementById("speech-tts-lang").value = p.ttsLang;
      document.getElementById("speech-tts-pitch-nat").value = p.ttsPitch;
      document.getElementById("speech-tts-speed-nat").value = p.ttsSpeed;
      document.getElementById("pre-npitch-val").textContent = (+p.ttsPitch).toFixed(2);
      document.getElementById("pre-nspeed-val").textContent = (+p.ttsSpeed).toFixed(2);
    }
    syncPreTtsPanel();
  }
  document.getElementById("speech-tts-preset").addEventListener("change", e => {
    const id = e.target.value;
    if (id !== "custom") applyTtsPreset(id);
  });
  // Mark preset custom when user tweaks sliders
  ["speech-tts-pitch", "speech-tts-speed-robot", "speech-tts-amp",
   "speech-tts-pitch-nat", "speech-tts-speed-nat", "speech-tts-lang",
   "speech-tts-pitch-neural", "speech-tts-speed-neural", "speech-tts-voice",
   "speech-tts-gender", "speech-tts-lang-neural"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", () => {
      document.getElementById("speech-tts-preset").value = "custom";
    });
    if (el) el.addEventListener("change", () => {
      document.getElementById("speech-tts-preset").value = "custom";
    });
  });
  const bindVal = (id, labelId) => {
    const el = document.getElementById(id);
    const lab = document.getElementById(labelId);
    if (!el || !lab) return;
    el.addEventListener("input", () => { lab.textContent = (+el.value).toFixed(el.step && +el.step < 1 ? 2 : 0); });
  };
  bindVal("speech-tts-pitch", "pre-pitch-val");
  bindVal("speech-tts-speed-robot", "pre-speed-val");
  bindVal("speech-tts-amp", "pre-amp-val");
  bindVal("speech-tts-pitch-nat", "pre-npitch-val");
  bindVal("speech-tts-speed-nat", "pre-nspeed-val");
  bindVal("speech-tts-pitch-neural", "pre-neupitch-val");
  bindVal("speech-tts-speed-neural", "pre-neuspeed-val");
  refreshKokoroVoiceSelect();
  document.getElementById("btn-tts-preview").addEventListener("click", async () => {
    const text = (document.getElementById("speech-input").value || "").trim() || "Hello";
    const tts = readPreTtsSettings();
    const tmp = {
      text, ttsOn: true, ttsEngine: tts.ttsEngine,
      ttsPitch: tts.ttsPitch, ttsSpeed: tts.ttsSpeed,
      ttsAmplitude: tts.ttsAmplitude, ttsLang: tts.ttsLang,
      ttsGender: tts.ttsGender, ttsVoice: tts.ttsVoice,
      start: 0, end: 2
    };
    const btn = document.getElementById("btn-tts-preview");
    btn.disabled = true; btn.textContent = "Generating…";
    try {
      await generateSpeechTTS(tmp);
      playSpeechTTS(tmp);
    } catch (e) {
      alert("TTS preview failed: " + (e.message || e));
    }
    btn.disabled = false; btn.textContent = "▶ Preview TTS";
  });
  syncPreTtsPanel();
  document.getElementById("btn-upload-sound").addEventListener("click", () => document.getElementById("sound-upload").click());
  document.getElementById("sound-upload").addEventListener("change", onSoundUpload);
  document.getElementById("sound-search").addEventListener("input", e => filterSoundboard(e.target.value));
  document.getElementById("btn-save").addEventListener("click", () => saveProject(true));
  document.getElementById("btn-save-json").addEventListener("click", saveProjectJson);
  document.getElementById("btn-load-json").addEventListener("click", () => {
    document.getElementById("project-json-input").click();
  });
  document.getElementById("project-json-input").addEventListener("change", e => {
    const f = e.target.files && e.target.files[0];
    if (f) loadProjectFromFile(f);
    e.target.value = "";
  });
  btnExport.addEventListener("click", () => {
    if (state.recording) {
      // Stop early and keep what was recorded
      state.exportAbort = true;
      exportStatus.textContent = "Stopping…";
      return;
    }
    exportWebM();
  });

  // Enter adds speech quickly
  document.getElementById("speech-input").addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); addSpeech(); }
  });

  window.addEventListener("keydown", e => {
    if (["INPUT","TEXTAREA","SELECT"].includes(e.target.tagName)) return;
    if (e.code === "Space") { e.preventDefault(); state.playing ? pause() : play(); }
  });

  canvas.addEventListener("mousedown", onCanvasDown);
  window.addEventListener("mousemove", onCanvasMove);
  window.addEventListener("mouseup", () => {
    if (drag.active) { drag.active = false; canvasWrap.classList.remove("dragging"); markDirty(); }
  });

  timelineEl.addEventListener("click", e => {
    if (!state.totalDuration || e.target.classList.contains("timeline-clip")) return;
    const rect = timelineEl.getBoundingClientRect();
    const x = e.clientX - rect.left + timelineEl.scrollLeft;
    seek(clamp(x / state.pixelsPerSecond, 0, state.totalDuration));
  });

  setInterval(() => { if (state.dirty && state.videos.length) saveProject(false); }, 4000);
  window.addEventListener("beforeunload", () => { if (state.dirty) saveProject(false); });
}

/* ---- Canvas drag (character only) ---- */
function canvasPoint(cx, cy) {
  const r = canvas.getBoundingClientRect();
  return { x: (cx - r.left) * (canvas.width / r.width), y: (cy - r.top) * (canvas.height / r.height) };
}
function onCanvasDown(e) {
  if (!state.videos.length) return;
  const p = canvasPoint(e.clientX, e.clientY);
  const r = drag.charRect;
  if (r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
    drag.active = true;
    drag.startMX = e.clientX; drag.startMY = e.clientY;
    drag.startX = state.character.x; drag.startY = state.character.y;
    canvasWrap.classList.add("dragging");
  }
}
function onCanvasMove(e) {
  if (!drag.active) return;
  const rect = canvas.getBoundingClientRect();
  const dx = ((e.clientX - drag.startMX) / rect.width) * 100;
  const dy = ((e.clientY - drag.startMY) / rect.height) * 100;
  state.character.x = clamp(drag.startX + dx, 5, 95);
  state.character.y = clamp(drag.startY + dy, 10, 95);
  if (!state.playing) drawFrame();
}

/* ---- Videos ---- */
async function handleVideos(fileList) {
  const files = Array.from(fileList || []).filter(f => f.type.startsWith("video/"));
  if (!files.length) return;
  for (const file of files) {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.src = url; video.preload = "auto"; video.playsInline = true; video.muted = false;
    await new Promise((res, rej) => { video.onloadedmetadata = res; video.onerror = rej; });
    state.videos.push({ id: "v" + Date.now(), file, url, name: file.name, duration: video.duration, videoEl: video });
  }
  state.totalDuration = state.videos.reduce((s, v) => s + v.duration, 0);
  uploadOverlay.classList.add("hidden");
  btnPlay.disabled = btnPause.disabled = btnStop.disabled = seekBar.disabled = btnExport.disabled = false;
  renderVideoList(); renderTimeline(); markDirty(); seek(0); drawFrame();
}

function getVideoAtTime(t) {
  let acc = 0;
  for (let i = 0; i < state.videos.length; i++) {
    const v = state.videos[i];
    if (t < acc + v.duration) return { video: v, localTime: t - acc, index: i };
    acc += v.duration;
  }
  if (state.videos.length) {
    const last = state.videos[state.videos.length - 1];
    return { video: last, localTime: last.duration, index: state.videos.length - 1 };
  }
  return null;
}

function renderVideoList() {
  document.getElementById("video-list").innerHTML = state.videos.map((v, i) => `
    <div class="item">
      <div class="row"><span>${i + 1}. ${escapeHtml(v.name)}</span>
        <span>
          <button class="btn-x" onclick="moveVideo(${i},-1)" title="Up">↑</button>
          <button class="btn-x" onclick="moveVideo(${i},1)" title="Down">↓</button>
          <button class="btn-x" onclick="removeVideo(${i})">✕</button>
        </span>
      </div>
      <div class="meta">${fmtTime(v.duration)}</div>
    </div>`).join("");
}
window.moveVideo = function(i, dir) {
  const j = i + dir; if (j < 0 || j >= state.videos.length) return;
  [state.videos[i], state.videos[j]] = [state.videos[j], state.videos[i]];
  renderVideoList(); renderTimeline(); markDirty();
};
window.removeVideo = function(i) {
  try { URL.revokeObjectURL(state.videos[i].url); } catch (_) {}
  state.videos.splice(i, 1);
  state.totalDuration = state.videos.reduce((s, v) => s + v.duration, 0);
  if (!state.videos.length) {
    uploadOverlay.classList.remove("hidden");
    btnExport.disabled = true;
  }
  renderVideoList(); renderTimeline(); markDirty(); drawFrame();
};

/* ---- Playback ---- */
function play() {
  if (!state.videos.length || state.playing) return;
  state.playing = true;
  syncVideo(true);
  const wall0 = performance.now(), t0 = state.currentTime;
  function loop(now) {
    if (!state.playing) return;
    const info = getVideoAtTime(state.currentTime);
    if (info && activeVideoEl === info.video.videoEl && !activeVideoEl.paused) {
      const acc = state.videos.slice(0, info.index).reduce((s, v) => s + v.duration, 0);
      state.currentTime = acc + activeVideoEl.currentTime;
    } else {
      state.currentTime = Math.min(t0 + (now - wall0) / 1000, state.totalDuration);
      syncVideo(true);
    }
    if (state.currentTime >= state.totalDuration - 0.04) {
      state.currentTime = state.totalDuration; pause(); updateUI(); drawFrame(); return;
    }
    updateUI(); drawFrame(); playSoundsAt(state.currentTime);
    animFrameId = requestAnimationFrame(loop);
  }
  animFrameId = requestAnimationFrame(loop);
}

function syncVideo(shouldPlay) {
  const info = getVideoAtTime(state.currentTime);
  if (!info) return;
  const v = info.video.videoEl;
  state.videos.forEach((vid, i) => { if (i !== info.index && !vid.videoEl.paused) vid.videoEl.pause(); });
  if (activeVideoEl !== v) {
    if (activeVideoEl && !activeVideoEl.paused) activeVideoEl.pause();
    activeVideoEl = v;
  }
  if (Math.abs(v.currentTime - info.localTime) > 0.12) v.currentTime = info.localTime;
  v.volume = state.masterVol; v.muted = false;
  if (shouldPlay && v.paused) v.play().catch(() => {});
}

function pause() {
  state.playing = false;
  if (animFrameId) cancelAnimationFrame(animFrameId);
  state.videos.forEach(v => { if (!v.videoEl.paused) v.videoEl.pause(); });
  state.sounds.forEach(s => { if (s.audio && !s.audio.paused) s.audio.pause(); });
  state.speeches.forEach(sp => { if (sp._ttsAudio && !sp._ttsAudio.paused) try { sp._ttsAudio.pause(); } catch (_) {} });
}
function stop() { pause(); seek(0); }

function seek(t) {
  const was = state.playing;
  if (was) pause();
  state.currentTime = clamp(t, 0, state.totalDuration || 0);
  state.sounds.forEach(s => { s.played = state.currentTime > s.start + 0.05; });
  state.speeches.forEach(sp => { sp.ttsPlayed = state.currentTime > sp.start + 0.05; });
  syncVideo(false); updateUI(); drawFrame();
  if (was) play();
}

function updateUI() {
  seekBar.value = state.totalDuration ? (state.currentTime / state.totalDuration) * 1000 : 0;
  timeDisplay.textContent = `${fmtTime(state.currentTime)} / ${fmtTime(state.totalDuration)}`;
  playhead.style.left = (state.currentTime * state.pixelsPerSecond) + "px";
}

/* ---- Character state (speech expression wins) ---- */
function getCharStateAt(time) {
  const ch = state.character;
  let visible = ch.visible !== false;
  let x = ch.x, y = ch.y, scale = ch.scale, expr = ch.expression || "Normal";

  // Keyframes: interpolate position; before first keyframe keep base visibility (do NOT hide)
  if (ch.keyframes && ch.keyframes.length) {
    const kfs = [...ch.keyframes].sort((a, b) => a.time - b.time);
    let prev = null, next = null;
    for (const k of kfs) {
      if (k.time <= time) prev = k;
      else if (!next) next = k;
    }
    if (prev && next) {
      const t = (time - prev.time) / Math.max(next.time - prev.time, 0.0001);
      x = lerp(prev.x, next.x, t);
      y = lerp(prev.y, next.y, t);
      scale = lerp(prev.scale, next.scale, t);
      expr = prev.expression || expr;
      // only override visibility if keyframe explicitly set it
      if (typeof prev.visible === "boolean") visible = prev.visible;
    } else if (prev) {
      x = prev.x; y = prev.y; scale = prev.scale;
      expr = prev.expression || expr;
      if (typeof prev.visible === "boolean") visible = prev.visible;
    }
    // if only next exists (playhead before first keyframe): keep base x/y/scale/visible
  }

  // Active speech bubble forces its expression
  for (const sp of state.speeches) {
    if (time >= sp.start && time <= sp.end && sp.expression) {
      expr = sp.expression;
      break;
    }
  }

  let slideOffsetX = 0;
  if (ch.slide) {
    const sl = ch.slide;
    const prog = clamp((time - sl.start) / Math.max(sl.duration, 0.01), 0, 1);
    if (sl.type === "in") {
      slideOffsetX = (1 - prog) * -28;
      if (prog >= 1) {
        // finished slide-in: clear slide, ensure visible
        ch.slide = null;
        ch.visible = true;
        visible = true;
      } else {
        visible = true;
      }
    } else {
      // slide out
      slideOffsetX = prog * 28;
      if (prog >= 1) {
        ch.slide = null;
        ch.visible = false;
        visible = false;
      }
    }
  }

  // Master visibility flag always wins when explicitly false (after slide-out / hide)
  if (ch.visible === false && !(ch.slide && ch.slide.type === "in")) {
    visible = false;
  }

  return { visible, x, y, scale, expr, slideOffsetX };
}

/* ---- Draw ---- */
function drawFrame() {
  const w = canvas.width, h = canvas.height;
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h);

  const info = getVideoAtTime(state.currentTime);
  if (info) {
    const v = info.video.videoEl;
    if (!state.playing && Math.abs(v.currentTime - info.localTime) > 0.08) v.currentTime = info.localTime;
    const vr = (v.videoWidth || 16) / (v.videoHeight || 9), cr = w / h;
    let dw, dh, dx, dy;
    if (vr > cr) { dw = w; dh = w / vr; dx = 0; dy = (h - dh) / 2; }
    else { dh = h; dw = h * vr; dx = (w - dw) / 2; dy = 0; }
    try { ctx.drawImage(v, dx, dy, dw, dh); } catch (_) {}
  }

  // Text bars
  for (const t of state.texts) {
    if (state.currentTime >= t.start && state.currentTime <= t.end) {
      const barH = 36, y = (t.y / 100) * h;
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.fillRect(0, y - barH / 2, w, barH);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 22px system-ui, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(t.text || "", w / 2, y);
    }
  }

  // Character + speech (speech always above character)
  const st = getCharStateAt(state.currentTime);
  drag.charRect = null;
  if (st.visible) {
    const img = getCharImage(st.expr);
    if (img && img.complete && img.naturalWidth) {
      const baseH = h * 0.35 * (st.scale || 1);
      const baseW = (img.width / Math.max(img.height, 1)) * baseH;
      const cx = ((st.x + (st.slideOffsetX || 0)) / 100) * w;
      const cy = (st.y / 100) * h;

      drag.charRect = { x: cx - baseW / 2, y: cy - baseH / 2, w: baseW, h: baseH };

      ctx.save();
      ctx.translate(cx, cy);
      ctx.drawImage(img, -baseW / 2, -baseH / 2, baseW, baseH);
      ctx.restore();

      // Active speech bubbles stacked above character head (optional per-event)
      const active = state.speeches.filter(sp =>
        state.currentTime >= sp.start && state.currentTime <= sp.end && sp.showBubble !== false
      );
      active.forEach((sp, i) => {
        const stack = active.length - 1 - i;
        const bx = cx;
        const by = cy - baseH / 2 - 18 - stack * 36;
        drawBubble(bx, by, sp.text);
      });
    }
  }
  // Duck video volume while any TTS speech is active
  applyVideoVolumeForTime(state.currentTime);
}

function drawBubble(x, y, text) {
  ctx.font = "14px system-ui, sans-serif";
  const m = ctx.measureText(text || "");
  const pad = 10, bw = Math.max(m.width + pad * 2, 40), bh = 28;
  ctx.fillStyle = "#fff"; ctx.strokeStyle = "#222"; ctx.lineWidth = 2;
  roundRect(ctx, x - bw / 2, y - bh, bw, bh, 8);
  ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 7, y); ctx.lineTo(x, y + 9); ctx.lineTo(x + 7, y);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#111";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text || "", x, y - bh / 2);
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/* ---- Character keyframes ---- */
function addCharKeyframe() {
  const ch = state.character;
  // Saving a position always means the character should be visible at that time
  ch.visible = true;
  ch.slide = null;
  const existing = ch.keyframes.findIndex(k => Math.abs(k.time - state.currentTime) < 0.05);
  const kf = { time: state.currentTime, x: ch.x, y: ch.y, scale: ch.scale, expression: ch.expression, visible: true };
  if (existing >= 0) ch.keyframes[existing] = kf; else ch.keyframes.push(kf);
  ch.keyframes.sort((a, b) => a.time - b.time);
  renderTimeline(); markDirty(); drawFrame();
}

/* ---- Speech ---- */
function readPreTtsSettings() {
  const ttsOn = document.getElementById("speech-tts-on").checked;
  const ttsEngine = document.getElementById("speech-tts-engine").value || "neural";
  if (ttsEngine === "robot") {
    return {
      ttsOn, ttsEngine,
      ttsPitch: +document.getElementById("speech-tts-pitch").value || 50,
      ttsSpeed: +document.getElementById("speech-tts-speed-robot").value || 175,
      ttsAmplitude: +document.getElementById("speech-tts-amp").value || 100,
      ttsLang: "en", ttsGender: "default", ttsVoice: null
    };
  }
  if (ttsEngine === "neural") {
    const lang = document.getElementById("speech-tts-lang-neural").value || "en";
    const gender = document.getElementById("speech-tts-gender").value || "female";
    const voice = document.getElementById("speech-tts-voice").value || pickKokoroVoice(lang, gender);
    return {
      ttsOn, ttsEngine,
      ttsPitch: +document.getElementById("speech-tts-pitch-neural").value || 1,
      ttsSpeed: +document.getElementById("speech-tts-speed-neural").value || 1,
      ttsAmplitude: 100,
      ttsLang: lang, ttsGender: gender, ttsVoice: voice
    };
  }
  return {
    ttsOn, ttsEngine,
    ttsPitch: +document.getElementById("speech-tts-pitch-nat").value || 1,
    ttsSpeed: +document.getElementById("speech-tts-speed-nat").value || 1,
    ttsAmplitude: 100,
    ttsLang: document.getElementById("speech-tts-lang").value || "en",
    ttsGender: "default", ttsVoice: null
  };
}

async function addSpeech() {
  const text = (document.getElementById("speech-input").value || "").trim() || "…";
  const expression = document.getElementById("speech-expression").value || "Happy";
  const showBubble = document.getElementById("speech-show-bubble").checked;
  const tts = readPreTtsSettings();
  const sp = {
    id: "sp" + Date.now(),
    text,
    expression,
    start: state.currentTime,
    end: state.currentTime + 2.5,
    showBubble: showBubble !== false,
    ttsOn: !!tts.ttsOn,
    ttsEngine: tts.ttsEngine,
    ttsPitch: tts.ttsPitch,
    ttsSpeed: tts.ttsSpeed,
    ttsAmplitude: tts.ttsAmplitude,
    ttsLang: tts.ttsLang,
    ttsGender: tts.ttsGender || "default",
    ttsVoice: tts.ttsVoice || null,
    ttsDataUrl: null,
    ttsStreamUrl: null,
    ttsDuration: null,
    ttsPlayed: false
  };
  state.speeches.push(sp);
  document.getElementById("speech-input").value = "";
  if (sp.ttsOn) {
    await generateSpeechTTS(sp);
  }
  renderSpeechList(); renderTimeline(); markDirty(); drawFrame();
}

function renderSpeechList() {
  document.getElementById("speech-list").innerHTML = state.speeches.map((s, i) => {
    const eng = s.ttsEngine || "neural";
    const isRobot = eng === "robot";
    const isNeural = eng === "neural";
    const hasTts = !!(s.ttsDataUrl || s.ttsStreamUrl);
    const gender = s.ttsGender || "female";
    const lang = s.ttsLang || "en";
    const voiceOpts = KOKORO_VOICES.filter(v => v.lang === (isNeural ? lang : "en") && v.gender === gender);
    const voiceList = voiceOpts.length ? voiceOpts : KOKORO_VOICES.filter(v => v.lang === "en");
    return `
    <div class="item speech-item">
      <div class="row">
        <strong>${escapeHtml(s.text)}</strong>
        <button class="btn-x" onclick="removeSpeech(${i})">✕</button>
      </div>
      <div class="meta">${s.start.toFixed(1)}s – ${s.end.toFixed(1)}s${s.ttsDuration ? ` · TTS ${s.ttsDuration.toFixed(2)}s` : ""}</div>
      <label class="meta">Expression
        <select onchange="updateSpeech(${i},'expression',this.value)">
          ${EXPRESSIONS.map(e => `<option value="${e}" ${s.expression === e ? "selected" : ""}>${e}</option>`).join("")}
        </select>
      </label>
      <div class="chk-row">
        <label class="chk"><input type="checkbox" ${s.showBubble !== false ? "checked" : ""} onchange="updateSpeech(${i},'showBubble',this.checked)" /> Bubble</label>
        <label class="chk"><input type="checkbox" ${s.ttsOn ? "checked" : ""} onchange="updateSpeech(${i},'ttsOn',this.checked)" /> TTS</label>
      </div>
      ${s.ttsOn ? `
      <label class="meta">Engine
        <select onchange="updateSpeech(${i},'ttsEngine',this.value)">
          <option value="neural" ${isNeural ? "selected" : ""}>Neural (Kokoro)</option>
          <option value="robot" ${isRobot ? "selected" : ""}>Robot (eSpeak)</option>
          <option value="natural" ${eng === "natural" ? "selected" : ""}>Google TTS</option>
        </select>
      </label>
      ${isRobot ? `
      <label class="meta">Pitch <input type="range" min="0" max="100" value="${s.ttsPitch != null ? s.ttsPitch : 50}"
        onchange="updateSpeech(${i},'ttsPitch',+this.value)" /></label>
      <label class="meta">Speed (wpm) <input type="range" min="80" max="300" value="${s.ttsSpeed != null ? s.ttsSpeed : 175}"
        onchange="updateSpeech(${i},'ttsSpeed',+this.value)" /></label>
      <label class="meta">Volume <input type="range" min="0" max="200" value="${s.ttsAmplitude != null ? s.ttsAmplitude : 100}"
        onchange="updateSpeech(${i},'ttsAmplitude',+this.value)" /></label>
      ` : isNeural ? `
      <label class="meta">Language
        <select onchange="updateSpeech(${i},'ttsLang',this.value)">
          ${KOKORO_LANGS.map(l => `<option value="${l.id}" ${lang === l.id ? "selected" : ""}>${l.label}</option>`).join("")}
        </select>
      </label>
      <label class="meta">Gender
        <select onchange="updateSpeech(${i},'ttsGender',this.value)">
          <option value="female" ${gender === "female" ? "selected" : ""}>Female</option>
          <option value="male" ${gender === "male" ? "selected" : ""}>Male</option>
        </select>
      </label>
      <label class="meta">Voice
        <select onchange="updateSpeech(${i},'ttsVoice',this.value)">
          ${voiceList.map(v => `<option value="${v.id}" ${(s.ttsVoice || "") === v.id ? "selected" : ""}>${v.name}${v.region ? " (" + v.region + ")" : ""}</option>`).join("")}
        </select>
      </label>
      <label class="meta">Pitch <input type="range" min="0.5" max="1.5" step="0.05" value="${s.ttsPitch != null ? s.ttsPitch : 1}"
        onchange="updateSpeech(${i},'ttsPitch',+this.value)" /></label>
      <label class="meta">Speed <input type="range" min="0.5" max="1.5" step="0.05" value="${s.ttsSpeed != null ? s.ttsSpeed : 1}"
        onchange="updateSpeech(${i},'ttsSpeed',+this.value)" /></label>
      ` : `
      <label class="meta">Language
        <select onchange="updateSpeech(${i},'ttsLang',this.value)">
          ${TTS_LANGS.map(l => `<option value="${l.id}" ${lang === l.id ? "selected" : ""}>${l.label}</option>`).join("")}
        </select>
      </label>
      <label class="meta">Pitch <input type="range" min="0.5" max="1.5" step="0.05" value="${s.ttsPitch != null ? s.ttsPitch : 1}"
        onchange="updateSpeech(${i},'ttsPitch',+this.value)" /></label>
      <label class="meta">Speed <input type="range" min="0.5" max="1.5" step="0.05" value="${s.ttsSpeed != null ? s.ttsSpeed : 1}"
        onchange="updateSpeech(${i},'ttsSpeed',+this.value)" /></label>
      `}
      <div class="btn-row" style="margin-top:4px">
        <button class="btn btn-sm" onclick="regenSpeechTTS(${i})">${hasTts ? "Regen TTS" : "Generate TTS"}</button>
        <button class="btn btn-sm" onclick="previewSpeechTTS(${i})" ${hasTts ? "" : "disabled"}>▶ Play</button>
      </div>
      ` : ""}
      <div class="row" style="gap:4px;margin-top:3px">
        <input type="number" step="0.1" value="${s.start.toFixed(1)}" title="Start"
          onchange="updateSpeech(${i},'start',+this.value)" style="width:48%" />
        <input type="number" step="0.1" value="${s.end.toFixed(1)}" title="End"
          onchange="updateSpeech(${i},'end',+this.value)" style="width:48%" ${s.ttsOn && hasTts ? "disabled title=\"Locked to TTS length\"" : ""} />
      </div>
    </div>`;
  }).join("");
}
window.updateSpeech = function(i, key, val) {
  const s = state.speeches[i];
  if (!s) return;
  s[key] = val;
  const ttsKeys = ["ttsEngine", "ttsPitch", "ttsSpeed", "ttsAmplitude", "ttsLang", "ttsGender", "ttsVoice", "text", "ttsOn"];
  if (key === "ttsEngine") {
    s.ttsSpeed = val === "robot" ? 175 : 1;
    s.ttsPitch = val === "robot" ? 50 : 1;
    if (val === "neural") {
      s.ttsGender = s.ttsGender === "male" ? "male" : "female";
      s.ttsVoice = pickKokoroVoice(s.ttsLang || "en", s.ttsGender, s.ttsVoice);
    }
    s.ttsDataUrl = null; s.ttsStreamUrl = null; s.ttsDuration = null;
    s._ttsBuffer = null; s._ttsKey = null;
    renderSpeechList();
  }
  if (key === "ttsLang" || key === "ttsGender") {
    if ((s.ttsEngine || "") === "neural") {
      s.ttsVoice = pickKokoroVoice(s.ttsLang || "en", s.ttsGender || "female", null);
    }
  }
  if (ttsKeys.includes(key)) {
    s._ttsBuffer = null;
    s._ttsKey = null;
    if (s.ttsOn && key !== "ttsOn") {
      // Settings changed while TTS is on — regenerate so export matches UI
      generateSpeechTTS(s).then(() => { renderSpeechList(); renderTimeline(); markDirty(); drawFrame(); });
      return;
    }
    if (key === "ttsOn" && val) {
      generateSpeechTTS(s).then(() => { renderSpeechList(); renderTimeline(); markDirty(); drawFrame(); });
      return;
    }
  }
  if (key === "start" && s.ttsOn && s.ttsDuration) {
    s.end = s.start + s.ttsDuration;
  }
  renderTimeline(); markDirty(); drawFrame();
};
window.removeSpeech = function(i) {
  const s = state.speeches[i];
  if (s && s._ttsAudio) try { s._ttsAudio.pause(); } catch (_) {}
  state.speeches.splice(i, 1);
  renderSpeechList(); renderTimeline(); markDirty(); drawFrame();
};
window.regenSpeechTTS = async function(i) {
  const s = state.speeches[i];
  if (!s) return;
  s.ttsOn = true;
  await generateSpeechTTS(s);
  renderSpeechList(); renderTimeline(); markDirty(); drawFrame();
};
window.previewSpeechTTS = function(i) {
  playSpeechTTS(state.speeches[i]);
};

/* ---- Text ---- */
function addText() {
  state.texts.push({
    id: "t" + Date.now(),
    text: "Caption",
    y: 88,
    start: state.currentTime,
    end: Math.min(state.currentTime + 4, state.totalDuration || state.currentTime + 4)
  });
  renderTextList(); renderTimeline(); markDirty(); drawFrame();
}
function renderTextList() {
  document.getElementById("text-list").innerHTML = state.texts.map((t, i) => `
    <div class="item">
      <div class="row">
        <input type="text" value="${escapeHtml(t.text)}" onchange="updateText(${i},'text',this.value)" />
        <button class="btn-x" onclick="removeText(${i})">✕</button>
      </div>
      <div class="row" style="gap:4px">
        <input type="number" step="0.1" value="${t.start.toFixed(1)}" title="Start"
          onchange="updateText(${i},'start',+this.value)" style="width:33%" />
        <input type="number" step="0.1" value="${t.end.toFixed(1)}" title="End"
          onchange="updateText(${i},'end',+this.value)" style="width:33%" />
        <input type="number" value="${t.y}" title="Y%" min="5" max="95"
          onchange="updateText(${i},'y',+this.value)" style="width:33%" />
      </div>
    </div>`).join("");
}
window.updateText = function(i, key, val) {
  state.texts[i][key] = val; renderTimeline(); markDirty(); drawFrame();
};
window.removeText = function(i) {
  state.texts.splice(i, 1); renderTextList(); renderTimeline(); markDirty(); drawFrame();
};

/* ---- Sounds ---- */
function buildSoundboard() {
  document.getElementById("soundboard").innerHTML = SOUNDBOARD.map(n =>
    `<button class="sound-btn" data-name="${n}" onclick="addSound('${n}')">${n}</button>`
  ).join("");
}
function filterSoundboard(q) {
  const l = q.toLowerCase();
  document.querySelectorAll(".sound-btn").forEach(b => {
    b.style.display = b.dataset.name.includes(l) ? "" : "none";
  });
}
window.addSound = function(name) {
  const url = `assets/sounds/${name}.mp3`;
  const audio = new Audio(url); audio.preload = "auto"; audio.volume = state.masterVol;
  const id = "s" + Date.now();
  audio.addEventListener("loadedmetadata", () => {
    const s = state.sounds.find(x => x.id === id);
    if (s) { s.duration = audio.duration; renderTimeline(); }
  });
  state.sounds.push({ id, name, url, board: true, start: state.currentTime, duration: 2, audio, played: false });
  renderSoundList(); renderTimeline(); markDirty();
};
function onSoundUpload(e) {
  Array.from(e.target.files).forEach(file => {
    const reader = new FileReader();
    reader.onload = () => {
      const audio = new Audio(reader.result); audio.volume = state.masterVol;
      const id = "s" + Date.now();
      audio.addEventListener("loadedmetadata", () => {
        const s = state.sounds.find(x => x.id === id);
        if (s) { s.duration = audio.duration; renderTimeline(); }
      });
      state.sounds.push({ id, name: file.name, board: false, dataUrl: reader.result, start: state.currentTime, duration: 2, audio, played: false });
      renderSoundList(); renderTimeline(); markDirty();
    };
    reader.readAsDataURL(file);
  });
}
function renderSoundList() {
  document.getElementById("sound-list").innerHTML = state.sounds.map((s, i) => `
    <div class="item">
      <div class="row"><span>${escapeHtml(s.name)}</span>
        <button class="btn-x" onclick="removeSound(${i})">✕</button></div>
      <input type="number" step="0.1" value="${s.start.toFixed(1)}"
        onchange="updateSound(${i},'start',+this.value)" />
    </div>`).join("");
}
window.updateSound = function(i, key, val) {
  state.sounds[i][key] = val; state.sounds[i].played = false; renderTimeline(); markDirty();
};
window.removeSound = function(i) {
  state.sounds.splice(i, 1); renderSoundList(); renderTimeline(); markDirty();
};
function playSoundsAt(t) {
  for (const s of state.sounds) {
    if (!s.played && t >= s.start && t < s.start + 0.12) {
      s.audio.currentTime = 0; s.audio.volume = state.masterVol;
      s.audio.play().catch(() => {}); s.played = true;
    }
    if (t < s.start) s.played = false;
  }
  // Speech TTS
  for (const sp of state.speeches) {
    if (!sp.ttsOn) continue;
    if (!sp.ttsPlayed && t >= sp.start && t < sp.start + 0.15) {
      sp.ttsPlayed = true;
      playSpeechTTS(sp);
    }
    if (t < sp.start) sp.ttsPlayed = false;
  }
}

/* ---- Timeline ---- */
function renderTimeline() {
  const pps = state.pixelsPerSecond;
  const totalW = Math.max(state.totalDuration * pps, timelineEl.clientWidth || 400);
  timelineRuler.style.width = totalW + "px";
  timelineRuler.innerHTML = "";
  const step = pps > 60 ? 1 : pps > 30 ? 2 : 5;
  for (let t = 0; t <= state.totalDuration + 0.01; t += step) {
    const m = document.createElement("div");
    m.style.cssText = `position:absolute;left:${t * pps}px;top:0;height:100%;border-left:1px solid #333;padding-left:2px;font-size:9px;`;
    m.textContent = fmtTime(t).replace(/\.\d$/, "");
    timelineRuler.appendChild(m);
  }
  timelineTracks.innerHTML = "";
  timelineTracks.style.width = totalW + "px";

  function track(clips) {
    const tr = document.createElement("div");
    tr.className = "timeline-track";
    clips.forEach(c => {
      const el = document.createElement("div");
      el.className = "timeline-clip " + c.cls;
      el.style.left = c.start * pps + "px";
      el.style.width = Math.max(c.dur * pps, 12) + "px";
      el.textContent = c.text;
      if (c.obj) makeDrag(el, c.obj, c.hasEnd);
      tr.appendChild(el);
    });
    timelineTracks.appendChild(tr);
  }

  let acc = 0;
  track(state.videos.map(v => { const c = { start: acc, dur: v.duration, text: v.name, cls: "video" }; acc += v.duration; return c; }));
  track(state.speeches.map(s => ({ start: s.start, dur: s.end - s.start, text: "💬 " + s.text, cls: "speech", obj: s, hasEnd: true })));
  track(state.texts.map(t => ({ start: t.start, dur: t.end - t.start, text: t.text, cls: "text", obj: t, hasEnd: true })));
  track(state.sounds.map(s => ({ start: s.start, dur: s.duration || 1, text: s.name, cls: "sound", obj: s, hasEnd: false })));
  track(state.character.keyframes.map(k => ({ start: k.time, dur: 0.12, text: "◆", cls: "char" })));
  updateUI();
}

function makeDrag(clip, obj, hasEnd) {
  let dragging = false, sx = 0, st = 0, se = 0;
  clip.addEventListener("mousedown", e => {
    e.stopPropagation();
    dragging = true; sx = e.clientX; st = obj.start; se = obj.end;
    clip.style.opacity = "0.6";
  });
  window.addEventListener("mousemove", e => {
    if (!dragging) return;
    const dt = (e.clientX - sx) / state.pixelsPerSecond;
    obj.start = clamp(st + dt, 0, state.totalDuration);
    if (hasEnd) obj.end = obj.start + (se - st);
    clip.style.left = obj.start * state.pixelsPerSecond + "px";
  });
  window.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false; clip.style.opacity = "";
    renderSpeechList(); renderTextList(); renderSoundList(); markDirty();
  });
}

/* ---- Save ---- */
function markDirty() {
  state.dirty = true;
  saveIndicator.textContent = "Unsaved";
  saveIndicator.className = "save-indicator";
}
function buildProjectData() {
  return {
    version: 6,
    type: "reaction-studio-project",
    savedAt: Date.now(),
    totalDuration: state.totalDuration,
    ttsDuckOn: !!state.ttsDuckOn,
    ttsDuckVol: state.ttsDuckVol != null ? state.ttsDuckVol : 0.25,
    texts: state.texts,
    speeches: state.speeches.map(s => ({
      id: s.id, text: s.text, expression: s.expression,
      start: s.start, end: s.end,
      showBubble: s.showBubble !== false,
      ttsOn: !!s.ttsOn,
      ttsEngine: s.ttsEngine || "robot",
      ttsPitch: s.ttsPitch, ttsSpeed: s.ttsSpeed, ttsAmplitude: s.ttsAmplitude,
      ttsLang: s.ttsLang || "en",
      ttsGender: s.ttsGender || "default",
      ttsVoice: s.ttsVoice || null,
      ttsDuration: s.ttsDuration,
      ttsDataUrl: s.ttsDataUrl || null,
      ttsStreamUrl: s.ttsStreamUrl || null
    })),
    sounds: state.sounds.map(s => ({
      id: s.id, name: s.name, board: !!s.board, url: s.board ? s.url : null,
      dataUrl: s.dataUrl || null, start: s.start, duration: s.duration
    })),
    character: {
      visible: state.character.visible, expression: state.character.expression,
      x: state.character.x, y: state.character.y, scale: state.character.scale,
      keyframes: state.character.keyframes,
      customImages: state.character.customImages || {}
    },
    videosMeta: state.videos.map(v => ({ name: v.name, duration: v.duration }))
  };
}

function saveProject(manual) {
  try {
    const data = buildProjectData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    state.dirty = false;
    saveIndicator.textContent = manual ? "Saved ✓" : "Auto-saved";
    saveIndicator.className = "save-indicator saved";
    setTimeout(() => { if (!state.dirty) { saveIndicator.textContent = ""; } }, 2000);
  } catch (e) { saveIndicator.textContent = "Save failed"; }
}

/** Download current reaction as a .json file */
function saveProjectJson() {
  try {
    const data = buildProjectData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.href = url;
    a.download = `reaction-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    // Also mirror to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    state.dirty = false;
    saveIndicator.textContent = "JSON saved ✓";
    saveIndicator.className = "save-indicator saved";
    setTimeout(() => { if (!state.dirty) saveIndicator.textContent = ""; }, 2500);
  } catch (e) {
    alert("Failed to save JSON: " + (e.message || e));
  }
}

/** Load a reaction from a user-picked .json file */
function loadProjectFromFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || typeof data !== "object") throw new Error("Invalid JSON");
      if (data.type && data.type !== "reaction-studio-project" && !data.version) {
        throw new Error("Not a Reaction Studio project file");
      }
      if (!data.version && !data.speeches && !data.texts && !data.character) {
        throw new Error("Unrecognized project format");
      }
      loadProject(data);
      // Remember in localStorage too
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(buildProjectData())); } catch (_) {}
      saveIndicator.textContent = "Loaded JSON ✓";
      saveIndicator.className = "save-indicator saved";
      setTimeout(() => { if (!state.dirty) saveIndicator.textContent = ""; }, 2500);
      if (data.videosMeta?.length && !state.videos.length) {
        alert("Project loaded. Re-upload the video(s):\n" + data.videosMeta.map(v => "• " + v.name).join("\n"));
      }
    } catch (e) {
      alert("Could not load JSON: " + (e.message || e));
    }
  };
  reader.onerror = () => alert("Failed to read file");
  reader.readAsText(file);
}

function checkBackup() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (!data?.version) return;
    document.getElementById("recovery-info").textContent =
      `Saved ${data.savedAt ? new Date(data.savedAt).toLocaleString() : ""} · ${data.speeches?.length || 0} speech · ${data.texts?.length || 0} text`;
    document.getElementById("recovery-modal").classList.remove("hidden");
    document.getElementById("btn-load-backup").onclick = () => {
      loadProject(data);
      document.getElementById("recovery-modal").classList.add("hidden");
    };
    document.getElementById("btn-discard-backup").onclick = () => {
      localStorage.removeItem(STORAGE_KEY);
      document.getElementById("recovery-modal").classList.add("hidden");
    };
  } catch (_) {}
}

function loadProject(data) {
  state.ttsDuckOn = !!data.ttsDuckOn;
  state.ttsDuckVol = data.ttsDuckVol != null ? +data.ttsDuckVol : 0.25;
  const duckOnEl = document.getElementById("tts-duck-on");
  const duckVolEl = document.getElementById("tts-duck-vol");
  const duckValEl = document.getElementById("tts-duck-vol-val");
  const duckWrap = document.getElementById("tts-duck-vol-wrap");
  if (duckOnEl) duckOnEl.checked = state.ttsDuckOn;
  if (duckVolEl) duckVolEl.value = Math.round(state.ttsDuckVol * 100);
  if (duckValEl) duckValEl.textContent = Math.round(state.ttsDuckVol * 100) + "%";
  if (duckWrap) duckWrap.classList.toggle("hidden", !state.ttsDuckOn);

  state.texts = data.texts || [];
  state.speeches = (data.speeches || []).map(s => ({
    id: s.id, text: s.text, expression: s.expression || "Happy",
    start: s.start, end: s.end,
    showBubble: s.showBubble !== false,
    ttsOn: !!s.ttsOn,
    ttsEngine: s.ttsEngine || "robot",
    ttsPitch: s.ttsPitch != null ? s.ttsPitch : (s.ttsEngine === "robot" ? 50 : 1),
    ttsSpeed: s.ttsSpeed != null ? s.ttsSpeed : (s.ttsEngine === "robot" ? 175 : 1),
    ttsAmplitude: s.ttsAmplitude != null ? s.ttsAmplitude : 100,
    ttsLang: s.ttsLang || "en",
    ttsGender: s.ttsGender || "default",
    ttsVoice: s.ttsVoice || null,
    ttsDuration: s.ttsDuration || null,
    ttsDataUrl: s.ttsDataUrl || null,
    ttsStreamUrl: s.ttsStreamUrl || null,
    ttsPlayed: false, _ttsAudio: null, _ttsBuffer: null, _ttsKey: null,
    _ttsDetune: s.ttsEngine === "neural" ? pitchToDetune(s.ttsPitch != null ? s.ttsPitch : 1) : 0
  }));
  // migrate old single speech
  if (data.character?.speech && !state.speeches.length) {
    state.speeches.push({
      id: "m", text: data.character.speech.text,
      expression: "Happy",
      start: data.character.speech.start, end: data.character.speech.end,
      showBubble: true, ttsOn: false, ttsEngine: "robot",
      ttsPitch: 50, ttsSpeed: 175, ttsAmplitude: 100, ttsLang: "en",
      ttsPlayed: false
    });
  }
  // restore TTS audio elements
  state.speeches.forEach(sp => {
    if (sp.ttsOn && (sp.ttsDataUrl || sp.ttsStreamUrl)) {
      sp._ttsAudio = new Audio(sp.ttsDataUrl || sp.ttsStreamUrl);
      sp._ttsAudio.preload = "auto";
      sp._ttsAudio.volume = state.masterVol;
    }
  });
  state.character.visible = data.character?.visible !== false;
  state.character.expression = data.character?.expression || "Normal";
  state.character.x = data.character?.x ?? 82;
  state.character.y = data.character?.y ?? 72;
  state.character.scale = data.character?.scale ?? 1;
  state.character.keyframes = data.character?.keyframes || [];
  state.character.customImages = data.character?.customImages || {};
  state.character.slide = null; // never restore a mid-slide that can leave character stuck hidden
  document.getElementById("char-expression").value = state.character.expression;
  document.getElementById("char-scale").value = state.character.scale;

  state.sounds = [];
  for (const s of (data.sounds || [])) {
    let audio;
    if (s.board && s.url) audio = new Audio(s.url);
    else if (s.dataUrl) audio = new Audio(s.dataUrl);
    else continue;
    audio.preload = "auto"; audio.volume = state.masterVol;
    state.sounds.push({ id: s.id, name: s.name, board: s.board, url: s.url, dataUrl: s.dataUrl, start: s.start, duration: s.duration || 2, audio, played: false });
  }
  if (data.videosMeta?.length && !state.videos.length) {
    document.getElementById("video-list").innerHTML =
      `<div class="item"><div class="meta">Re-upload: ${data.videosMeta.map(v => escapeHtml(v.name)).join(", ")}</div></div>`;
  }
  state.totalDuration = data.totalDuration || 0;
  loadCustomFromDataUrls(state.character.customImages).then(() => {
    renderExprGrid();
    drawFrame();
  });
  renderTextList(); renderSpeechList(); renderSoundList(); renderTimeline();
  state.dirty = false; saveIndicator.textContent = "Loaded"; saveIndicator.className = "save-indicator saved";
  drawFrame();
}

/* ---- Export ---- */
async function exportWebM() {
  if (!state.videos.length || state.recording) return;
  state.recording = true;
  state.exportAbort = false;
  btnExport.disabled = false;
  btnExport.textContent = "Stop & download";
  btnExport.classList.add("btn-accent");
  exportStatus.textContent = "Preparing…";

  const first = state.videos[0].videoEl;
  const outW = first.videoWidth || 1280;
  const outH = first.videoHeight || 720;
  const off = document.createElement("canvas");
  off.width = outW;
  off.height = outH;
  const octx = off.getContext("2d", { alpha: false });
  // Capture at up to 60fps; browser will match display refresh when possible
  const fps = 30;
  const canvasStream = off.captureStream(fps);

  // Persistent audio graph
  if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
    sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    sharedMasterGain = sharedAudioCtx.createGain();
    sharedMasterGain.gain.value = 1;
    sharedMasterGain.connect(sharedAudioCtx.destination);
  }
  const audioCtx = sharedAudioCtx;
  try { await audioCtx.resume(); } catch (_) {}
  sharedMasterGain.gain.value = state.masterVol;

  const dest = audioCtx.createMediaStreamDestination();
  try { sharedMasterGain.connect(dest); } catch (_) {}

  for (const v of state.videos) {
    if (!v._waConnected) {
      try {
        const src = audioCtx.createMediaElementSource(v.videoEl);
        const g = audioCtx.createGain();
        g.gain.value = 1;
        src.connect(g);
        g.connect(sharedMasterGain);
        v._waConnected = true;
        v._waGain = g;
      } catch (err) {
        console.warn("video audio connect", err);
      }
    } else if (v._waGain) {
      v._waGain.gain.value = 1;
    }
    v.videoEl.muted = false;
    v.videoEl.volume = 1;
    v.videoEl.playbackRate = 1;
  }

  // Decode SFX once
  async function getSoundBuffer(s) {
    if (s._buffer) return s._buffer;
    try {
      const srcUrl = s.dataUrl || s.url;
      if (!srcUrl) return null;
      const res = await fetch(srcUrl);
      const arr = await res.arrayBuffer();
      s._buffer = await audioCtx.decodeAudioData(arr.slice(0));
      return s._buffer;
    } catch (err) {
      console.warn("decode", s.name, err);
      return null;
    }
  }
  async function decodeDataUrl(dataUrl) {
    const res = await fetch(dataUrl);
    const arr = await res.arrayBuffer();
    return await audioCtx.decodeAudioData(arr.slice(0));
  }

  async function getTtsBuffer(sp) {
    if (!sp.ttsOn) return null;
    try {
      const key = ttsSettingsKey(sp);
      // Prefer existing good dataUrl matching settings
      if (sp.ttsDataUrl && sp._ttsKey === key && sp._ttsBuffer) {
        return sp._ttsBuffer;
      }
      // Settings match but buffer missing → just decode
      if (sp.ttsDataUrl && sp._ttsKey === key) {
        sp._ttsBuffer = await decodeDataUrl(sp.ttsDataUrl);
        return sp._ttsBuffer;
      }
      // Stale or missing → regenerate (keep old on failure)
      exportStatus.textContent = `TTS: “${(sp.text || "").slice(0, 24)}…”`;
      const ok = await generateSpeechTTS(sp, { silent: true });
      if (!sp.ttsDataUrl) {
        // Last try: force natural fetch again
        if ((sp.ttsEngine || "robot") === "natural") {
          const { dataUrl } = await generateNaturalTTS(sp.text || " ", {
            lang: sp.ttsLang || "en",
            speed: sp.ttsSpeed != null ? sp.ttsSpeed : 1,
            pitch: sp.ttsPitch != null ? sp.ttsPitch : 1
          });
          if (dataUrl) {
            sp.ttsDataUrl = dataUrl;
            sp._ttsKey = key;
          }
        } else if (!ok) {
          await generateSpeechTTS(sp, { silent: true });
        }
      }
      if (!sp.ttsDataUrl) {
        console.warn("TTS export: no audio for", sp.text);
        return null;
      }
      sp._ttsBuffer = await decodeDataUrl(sp.ttsDataUrl);
      return sp._ttsBuffer;
    } catch (err) {
      console.warn("tts decode", err);
      return null;
    }
  }

  exportStatus.textContent = "Loading sounds…";
  await Promise.all(state.sounds.map(s => getSoundBuffer(s)));
  // Generate/decode TTS sequentially (proxy rate limits)
  const ttsList = state.speeches.filter(sp => sp.ttsOn);
  for (let i = 0; i < ttsList.length; i++) {
    exportStatus.textContent = `Preparing TTS ${i + 1}/${ttsList.length}…`;
    await getTtsBuffer(ttsList[i]);
    // small gap between Google requests
    if (i < ttsList.length - 1) await new Promise(r => setTimeout(r, 120));
  }
  const missing = ttsList.filter(sp => !sp._ttsBuffer);
  if (missing.length) {
    console.warn("TTS missing on export:", missing.map(s => s.text));
    exportStatus.textContent = `Warning: ${missing.length} TTS clip(s) missing audio`;
    await new Promise(r => setTimeout(r, 600));
  }

  const combined = new MediaStream();
  canvasStream.getVideoTracks().forEach(t => combined.addTrack(t));
  dest.stream.getAudioTracks().forEach(t => combined.addTrack(t));

  const mimeCandidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm"
  ];
  const mime = mimeCandidates.find(m => MediaRecorder.isTypeSupported(m)) || "video/webm";

  recordedChunks = [];
  let downloadTriggered = false;

  function finishDownload() {
    if (downloadTriggered) return;
    downloadTriggered = true;
    if (!recordedChunks.length) {
      exportStatus.textContent = "Nothing recorded";
      resetExportUI();
      return;
    }
    const blob = new Blob(recordedChunks, { type: "video/webm" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "reaction_" + Date.now() + ".webm";
    a.click();
    exportStatus.textContent = "Downloaded!";
    resetExportUI();
    setTimeout(() => {
      if (exportStatus.textContent === "Downloaded!") exportStatus.textContent = "";
    }, 2500);
  }

  function resetExportUI() {
    state.recording = false;
    state.exportAbort = false;
    btnExport.disabled = !state.videos.length;
    btnExport.textContent = "Export WebM";
    btnExport.classList.remove("btn-accent");
    try { sharedMasterGain.disconnect(dest); } catch (_) {}
  }

  try {
    mediaRecorder = new MediaRecorder(combined, {
      mimeType: mime,
      videoBitsPerSecond: 10_000_000,
      audioBitsPerSecond: 192_000
    });
  } catch (_) {
    mediaRecorder = new MediaRecorder(combined, { mimeType: mime });
  }

  mediaRecorder.ondataavailable = e => {
    if (e.data && e.data.size > 0) recordedChunks.push(e.data);
  };
  mediaRecorder.onstop = () => finishDownload();
  mediaRecorder.onerror = e => {
    console.error(e);
    exportStatus.textContent = "Export error";
    resetExportUI();
  };

  // Reset playback to start — continuous play (no per-frame seeking)
  pause();
  state.sounds.forEach(s => { s.played = false; });
  state.speeches.forEach(sp => { sp.ttsPlayed = false; });
  state.currentTime = 0;

  // Seek all videos to 0 once
  for (const v of state.videos) {
    v.videoEl.pause();
    v.videoEl.currentTime = 0;
  }
  await new Promise(r => setTimeout(r, 100));

  mediaRecorder.start(250);
  exportStatus.textContent = "Recording… (Stop & download anytime)";

  // Precompute video segment starts
  const segments = [];
  let acc = 0;
  for (const v of state.videos) {
    segments.push({ video: v, start: acc, end: acc + v.duration, duration: v.duration });
    acc += v.duration;
  }
  const totalDur = state.totalDuration;

  let segIdx = 0;
  let exportRaf = null;
  let lastUiUpdate = 0;
  let finished = false;

  function drawExportFrame(t) {
    octx.fillStyle = "#000";
    octx.fillRect(0, 0, outW, outH);
    const seg = segments[segIdx];
    if (seg) {
      const v = seg.video.videoEl;
      const vr = (v.videoWidth || 16) / (v.videoHeight || 9);
      const cr = outW / outH;
      let dw, dh, dx, dy;
      if (vr > cr) { dw = outW; dh = outW / vr; dx = 0; dy = (outH - dh) / 2; }
      else { dh = outH; dw = outH * vr; dx = (outW - dw) / 2; dy = 0; }
      try { octx.drawImage(v, dx, dy, dw, dh); } catch (_) {}
    }
    drawOverlays(octx, outW, outH, t);
  }

  function playSegment(i) {
    // Pause others
    segments.forEach((s, j) => {
      if (j !== i) {
        try { s.video.videoEl.pause(); } catch (_) {}
      }
    });
    const seg = segments[i];
    if (!seg) return;
    const v = seg.video.videoEl;
    v.muted = false;
    v.volume = 1;
    // Only seek if not already near start of this segment's local time
    const targetLocal = Math.max(0, state.currentTime - seg.start);
    if (Math.abs(v.currentTime - targetLocal) > 0.25) {
      v.currentTime = targetLocal;
    }
    v.play().catch(() => {});
  }

  playSegment(0);

  function tick() {
    if (finished) return;

    if (state.exportAbort) {
      finished = true;
      endExport();
      return;
    }

    const seg = segments[segIdx];
    if (!seg) {
      finished = true;
      endExport();
      return;
    }

    const v = seg.video.videoEl;
    // Timeline time = segment start + video's currentTime
    let t = seg.start + (v.currentTime || 0);

    // Advance to next segment when this one ends
    if (v.ended || v.currentTime >= seg.duration - 0.05) {
      segIdx++;
      if (segIdx >= segments.length) {
        state.currentTime = totalDur;
        drawExportFrame(totalDur);
        finished = true;
        endExport();
        return;
      }
      playSegment(segIdx);
      t = segments[segIdx].start;
    }

    state.currentTime = Math.min(t, totalDur);
    drawExportFrame(state.currentTime);

    // SFX
    for (const s of state.sounds) {
      if (!s.played && state.currentTime >= s.start && state.currentTime < s.start + 0.12) {
        s.played = true;
        if (s._buffer) {
          try {
            const src = audioCtx.createBufferSource();
            src.buffer = s._buffer;
            const g = audioCtx.createGain();
            g.gain.value = state.masterVol;
            src.connect(g);
            g.connect(sharedMasterGain);
            src.start();
          } catch (_) {}
        }
      }
    }
    // Speech TTS in export — fire once when playhead reaches start (no tight window; frames can skip)
    for (const sp of state.speeches) {
      if (!sp.ttsOn || sp.ttsPlayed) continue;
      if (state.currentTime >= sp.start) {
        sp.ttsPlayed = true;
        if (sp._ttsBuffer) {
          try {
            const src = audioCtx.createBufferSource();
            src.buffer = sp._ttsBuffer;
            // Neural pitch via detune (Kokoro has no server pitch)
            if (sp.ttsEngine === "neural") {
              src.detune.value = sp._ttsDetune != null
                ? sp._ttsDetune
                : pitchToDetune(sp.ttsPitch != null ? sp.ttsPitch : 1);
            }
            const g = audioCtx.createGain();
            g.gain.value = state.masterVol;
            src.connect(g);
            g.connect(sharedMasterGain);
            src.start(0);
          } catch (err) {
            console.warn("TTS export play failed", err);
          }
        } else {
          console.warn("TTS export: buffer missing at play time", sp.text);
        }
      }
    }
    // Duck source video volume while TTS is active (export audio graph)
    applyVideoVolumeForTime(state.currentTime, { useWaGain: true });

    // Throttle UI updates (preview + status) to ~4/sec to avoid lag
    const now = performance.now();
    if (now - lastUiUpdate > 250) {
      lastUiUpdate = now;
      drawFrame();
      updateUI();
      const pct = Math.min(100, Math.round((state.currentTime / Math.max(totalDur, 0.01)) * 100));
      exportStatus.textContent = `Recording ${pct}% — Stop & download to cut`;
    }

    if (state.currentTime >= totalDur - 0.03) {
      finished = true;
      endExport();
      return;
    }

    exportRaf = requestAnimationFrame(tick);
  }

  function endExport() {
    if (exportRaf) cancelAnimationFrame(exportRaf);
    exportRaf = null;
    state.videos.forEach(v => { try { v.videoEl.pause(); } catch (_) {} });
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      try { mediaRecorder.requestData(); } catch (_) {}
      try { mediaRecorder.stop(); } catch (_) { finishDownload(); }
    } else {
      finishDownload();
    }
    state.currentTime = 0;
    updateUI();
    drawFrame();
  }

  exportRaf = requestAnimationFrame(tick);
}

function drawOverlays(c, w, h, time) {
  for (const t of state.texts) {
    if (time >= t.start && time <= t.end) {
      const barH = Math.max(36, h * 0.05), y = (t.y / 100) * h;
      c.fillStyle = "rgba(0,0,0,0.22)"; c.fillRect(0, y - barH / 2, w, barH);
      c.fillStyle = "#fff"; c.font = `bold ${Math.round(h * 0.035)}px system-ui, sans-serif`;
      c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(t.text || "", w / 2, y);
    }
  }
  const st = getCharStateAt(time);
  if (st.visible) {
    const img = getCharImage(st.expr);
    if (img && img.complete && img.naturalWidth) {
      const baseH = h * 0.35 * st.scale, baseW = (img.width / Math.max(img.height, 1)) * baseH;
      const cx = ((st.x + (st.slideOffsetX || 0)) / 100) * w, cy = (st.y / 100) * h;
      c.save(); c.translate(cx, cy);
      c.drawImage(img, -baseW / 2, -baseH / 2, baseW, baseH);
      c.restore();
      const active = state.speeches.filter(sp =>
        time >= sp.start && time <= sp.end && sp.showBubble !== false
      );
      active.forEach((sp, i) => {
        const stack = active.length - 1 - i;
        const bx = cx, by = cy - baseH / 2 - 18 - stack * Math.round(h * 0.055);
        c.font = `${Math.round(h * 0.022)}px system-ui, sans-serif`;
        const m = c.measureText(sp.text || "");
        const pad = 10, bw = Math.max(m.width + pad * 2, 40), bh = Math.round(h * 0.04);
        c.fillStyle = "#fff"; c.strokeStyle = "#222"; c.lineWidth = 2;
        roundRect(c, bx - bw / 2, by - bh, bw, bh, 8); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(bx - 7, by); c.lineTo(bx, by + 9); c.lineTo(bx + 7, by); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = "#111"; c.textAlign = "center"; c.textBaseline = "middle";
        c.fillText(sp.text || "", bx, by - bh / 2);
      });
    }
  }
}

init();
