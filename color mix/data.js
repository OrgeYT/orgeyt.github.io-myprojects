/* data.js — color and recipe data (split out of game.js) */

export const colorData = {
    Red: { hex: '#ff3b30' },
    Orange: { hex: '#ff9500' },
    Yellow: { hex: '#ffcc00' },
    Green: { hex: '#34c759' },
    Cyan: { hex: '#32ade6' },
    Blue: { hex: '#007aff' },
    Pink: { hex: '#ff2d55' },
    Purple: { hex: '#af52de' },
    White: { hex: '#ffffff' },
    Black: { hex: '#222222' },
    Grey: { hex: '#8e8e93' },
    Brown: { hex: '#a16a38' },
    Lime: { hex: '#a3e635' },
    Peach: { hex: '#ffb07c' },
    Maroon: { hex: '#800000' },
    Navy: { hex: '#0a2540' },
    Olive: { hex: '#708238' },
    Mint: { hex: '#98ff98' },
    Lavender: { hex: '#b57edc' },
    Turquoise: { hex: '#40e0d0' },
    Plum: { hex: '#5c2e5c' }
};

export const basePaletteColors = ['Red', 'Orange', 'Yellow', 'Green', 'Cyan', 'Blue', 'Pink', 'Purple', 'White', 'Black'];

// Mutable paletteColors exported for runtime additions (freeplay custom colors)
export const paletteColors = [...basePaletteColors];

export const recipes = {
    'Orange': [['Red', 'Yellow']],
    'Green': [['Blue', 'Yellow']],
    'Purple': [['Red', 'Blue']],
    'Cyan': [['Green', 'Blue']],
    'Pink': [['Red', 'White']],
    'Grey': [['White', 'Black']],
    'Brown': [['Red', 'Green'], ['Orange', 'Black']],
    'Lime': [['Yellow', 'Green']],
    'Peach': [['Orange', 'White']],
    'Maroon': [['Red', 'Black']],
    'Navy': [['Blue', 'Black']],
    'Olive': [['Green', 'Black']],
    'Mint': [['Green', 'White']],
    'Lavender': [['Purple', 'White']],
    'Turquoise': [['Cyan', 'White']],
    'Plum': [['Purple', 'Black']]
};

export const targetColors = Object.keys(recipes);