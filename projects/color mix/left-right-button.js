/* left-right-button.js — control left/right nav button horizontal offset & gap */

/**
 * Position the palette prev/next buttons slightly away from the color grid and
 * normalize the gap between them and the palette so they don't collide or overlap.
 */
export function setNavX() {
    const prev = document.getElementById('palette-prev');
    const next = document.getElementById('palette-next');

    // Row wrapper that contains prev, palette grid, and next
    const row = prev && prev.parentElement;

    // Horizontal offset (in px) to nudge prev/next outward from the grid
    const offset = 175; // tweak this value to move buttons further left/right

    if (prev) {
        prev.style.transform = `translateX(-${offset}px)`;
    }
    if (next) {
        next.style.transform = `translateX(${offset}px)`;
    }

    // Adjust the flex row gap so there's a consistent space between buttons and palette
    if (row && row.style) {
        // Override Tailwind gap utility with an explicit gap value
        row.style.columnGap = '7rem';
        row.style.gap = '0.02rem';
    }
}