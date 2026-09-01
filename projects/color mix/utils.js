/* utils.js — small helpers */

export function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
}

export function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map(x => Math.round(x).toString(16).padStart(2, '0')).join('');
}

export function estimateMixNameFromHex(hex1, hex2) {
    // convenience for when mixing arbitrary hexes (not used everywhere)
    const a = hexToRgb(hex1), b = hexToRgb(hex2);
    return rgbToHex((a.r + b.r) / 2, (a.g + b.g) / 2, (a.b + b.b) / 2);
}

export function estimateMix(colorNameA, colorNameB) {
    // uses global colorData if present, otherwise throws
    if (!window.COLOR_APP || !window.COLOR_APP.colorData) {
        throw new Error('colorData not available for estimateMix');
    }
    const data = window.COLOR_APP.colorData;
    const rgb1 = hexToRgb(data[colorNameA].hex);
    const rgb2 = hexToRgb(data[colorNameB].hex);
    return rgbToHex((rgb1.r + rgb2.r) / 2, (rgb1.g + rgb2.g) / 2, (rgb1.b + rgb2.b) / 2);
}