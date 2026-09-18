export const COLS = 6;
export const ROWS = 12;
export const COLORS = ["red", "blue", "green", "yellow", "purple"];
export const COLOR_HEX = {
  red: "#e74c3c", blue: "#3498db", green: "#2ecc71",
  yellow: "#f1c40f", purple: "#9b59b6", garbage: "#95a5a6",
};
export const COLOR_DARK = {
  red: "#c0392b", blue: "#2980b9", green: "#27ae60",
  yellow: "#d4ac0d", purple: "#8e44ad", garbage: "#7f8c8d",
};
export const COLOR_LIGHT = {
  red: "#ff6b5a", blue: "#5dade2", green: "#58d68d",
  yellow: "#f7dc6f", purple: "#bb8fce", garbage: "#b0b7b8",
};
export const CELL = 56;
export const SPAWN_COL = 2;
export const CHAIN_POWER = [
  0, 0, 8, 16, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 480, 512,
];
export function randColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}
export function makePair() {
  return [randColor(), randColor()];
}
export function emptyGrid() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}
export function cloneGrid(g) {
  return g.map((row) => row.slice());
}
export function lerp(a, b, t) {
  return a + (b - a) * t;
}
export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}
