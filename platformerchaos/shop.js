/*
  shop.js
  Rich shop manifest and helpers describing appearances for skins and particle presets.
  Each skin includes: key, price, desc, face, palette (array of colors), rotate flag and a short "coloring" summary.
  Each particle includes: name, price, desc and a short "visual" summary.
  Helpers:
   - getSkinDisplay(skinKey) -> object with presentable fields for UI
   - getParticleDisplay(name) -> object with presentable fields for UI
   - allSkins(), allParticles() -> arrays for listing
*/

const SKINS = [
  {
    key: 'Nebula Wave',
    price: 120,
    desc: 'Iridescent gradient with starry face',
    face: '╵o╵',
    palette: ['#0b1226','#2b2e6b','#4b19a6','#2aa6ff','#9bf0ff'],
    rotate: false,
    coloring: 'spacey indigo → cyan, subtle star highlights'
  },
  {
    key: 'Verdant Leaf',
    price: 80,
    desc: 'Green organic palette with calm face',
    face: '=D',
    palette: ['#e6f9ec','#b8f0b9','#7ad07a','#3a9a3a','#0b5e10'],
    rotate: true,
    coloring: 'fresh greens, soft midtones with leafy accents'
  },
  {
    key: 'Rust Circuit',
    price: 100,
    desc: 'Brownish tech look with glitch face',
    face: ':\\',
    palette: ['#6b3f1f','#8f4b2a','#c07a52','#4b3621','#2f1a0f'],
    rotate: true,
    coloring: 'rust & copper tones with dark circuit contrast'
  },
  {
    key: 'Frostbite',
    price: 90,
    desc: 'Cool blues with icey face accents',
    face: ';{',
    palette: ['#e6f7ff','#cfefff','#9bd4f0','#74c8ee','#dff7ff'],
    rotate: true,
    coloring: 'icy blues and pale cyan shards'
  },
  {
    key: 'Neon Pop',
    price: 140,
    desc: 'Vivid neon rainbow with bold face',
    face: 'ᴗ_ᴗ',
    palette: ['#ff007f','#ffdd00','#00ffe1','#7cff00','#ff4dff'],
    rotate: false,
    coloring: 'high-contrast neon brights, playful glow'
  },
  {
    key: 'Bluey sky',
    price: 70,
    desc: 'Soft sky blues with a cheerful face',
    face: '^_^',
    palette: ['#d0f0ff','#90d8ff','#4db8ff','#2b9cff','#0b75d6'],
    rotate: false,
    coloring: 'soft pastel blues, airy gradient'
  },
  {
    key: 'Earthy grounds',
    price: 75,
    desc: 'Warm, grounded tones with a calm face',
    face: ':)',
    palette: ['#f0e6d8','#d1b38a','#a37a4a','#6b4b2b','#3b2a18'],
    rotate: false,
    coloring: 'warm browns and muted ochres'
  },
  {
    key: 'Golden shine',
    price: 160,
    desc: 'Luxurious gold palette with bright face',
    face: 'o_o',
    palette: ['#fff3b0','#ffe066','#ffd400','#ffbf00','#e6ac00'],
    rotate: true,
    coloring: 'rich golds and warm metallic highlights'
  },

  // Newly added skins
  {
    key: 'Void Glitch',
    price: 150,
    desc: 'Dark purple void energy with glitchy stare',
    face: '◉_◉',
    palette: ['#050008','#1a0033','#3b0070','#6b00b3','#a64dff'],
    rotate: false,
    coloring: 'deep void purples with glitch highlights'
  },
  {
    key: 'Candy Burst',
    price: 95,
    desc: 'Sweet candy colors with playful grin',
    face: '>ᴗ<',
    palette: ['#ffb3d9','#ff80bf','#ff66a3','#ff3385','#ff1a75'],
    rotate: false,
    coloring: 'bright candy pinks with sugary glow'
  },
  {
    key: 'Storm Core',
    price: 130,
    desc: 'Electric storm palette with shocked face',
    face: 'O_O',
    palette: ['#1f2a44','#2d4a7a','#3f6fd1','#6aa0ff','#b3d4ff'],
    rotate: false,
    coloring: 'stormy blues with lightning accents'
  },
  {
    key: 'Lava Pulse',
    price: 110,
    desc: 'Molten lava glow with intense stare',
    face: '>_>',
    palette: ['#2b0000','#5c0a0a','#a11a1a','#ff3b1a','#ff9a33'],
    rotate: false,
    coloring: 'fiery reds and molten orange glow'
  },
  {
    key: 'Pixel Party',
    price: 85,
    desc: 'Retro pixel colors with goofy face',
    face: 'xD',
    palette: ['#ff595e','#ffca3a','#8ac926','#1982c4','#6a4c93'],
    rotate: false,
    coloring: 'retro arcade rainbow pixels'
  },
  {
    key: 'Mint Chill',
    price: 65,
    desc: 'Cool mint tones with relaxed face',
    face: '-_-',
    palette: ['#e6fff7','#c4f7e6','#8ee6c9','#55c9a8','#1c8a6c'],
    rotate: false,
    coloring: 'soft mint greens with chill vibe'
  },
  {
    key: 'Corrupted Data',
    price: 145,
    desc: 'Broken digital palette with error face',
    face: ':/',
    palette: ['#0f0f0f','#2a2a2a','#00ff9c','#ff003c','#ffffff'],
    rotate: false,
    coloring: 'glitchy black with corrupted RGB flashes'
  },
  {
    key: 'Sunset Drift',
    price: 100,
    desc: 'Warm sunset gradient with dreamy face',
    face: '◡◡',
    palette: ['#ffd6a5','#ffadad','#ff8fab','#ff7096','#ff4d6d'],
    rotate: false,
    coloring: 'sunset pinks fading into warm orange'
  },
  {
    key: 'Radioactive',
    price: 120,
    desc: 'Toxic green glow with mischievous face',
    face: ';]',
    palette: ['#0a1f00','#163d00','#2f7a00','#5cff00','#c6ff00'],
    rotate: false,
    coloring: 'neon toxic greens with glowing accents'
  },
  {
    key: 'Monochrome Mood',
    price: 60,
    desc: 'Classic grayscale with neutral face',
    face: ':|',
    palette: ['#ffffff','#d9d9d9','#a6a6a6','#595959','#1a1a1a'],
    rotate: false,
    coloring: 'clean grayscale gradient'
  }
];

const PARTICLES = [
  {
    name: 'Aurora Trail',
    price: 130,
    desc: 'Soft shifting bands of color',
    visual: 'long flowing pastel streaks with slow drift'
  },
  {
    name: 'Ember Sparks',
    price: 90,
    desc: 'Warm orange sparks that fade quickly',
    visual: 'short-lived orange sparks with upward arc'
  },
  {
    name: 'Glacial Shards',
    price: 100,
    desc: 'Cool fragmented shards with a slow fall',
    visual: 'small icy shards drifting then settling'
  },
  {
    name: 'Binary Stream',
    price: 80,
    desc: 'Green code-like vertical particles',
    visual: 'narrow vertical green bits streaming downward'
  },
  {
    name: 'Candy Burst',
    price: 140,
    desc: 'Bright confetti pops with varied colors',
    visual: 'fast colorful confetti that disperses broadly'
  }
];

/**
 * Get a display-ready skin object by key.
 * Returns null if skin not found.
 * Returned fields: key, price, desc, face, palette, rotate, coloring
 */
export function getSkinDisplay(key) {
  if (!key) return null;
  const s = SKINS.find(x => x.key === key);
  if (!s) return null;
  // return a shallow copy to avoid external mutation
  return Object.assign({}, s);
}

/**
 * Get a display-ready particle object by name.
 * Returned fields: name, price, desc, visual
 */
export function getParticleDisplay(name) {
  if (!name) return null;
  const p = PARTICLES.find(x => x.name === name);
  if (!p) return null;
  return Object.assign({}, p);
}

/** Return arrays for listing in the shop UI */
export function allSkins() { return SKINS.map(s => Object.assign({}, s)); }
export function allParticles() { return PARTICLES.map(p => Object.assign({}, p)); }

/** Convenience default exports for legacy code that imported raw arrays */
export const shopSkins = SKINS;
export const shopParticles = PARTICLES;