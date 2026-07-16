export function pos_equal(a, b) {
    return a.x == b.x && a.y == b.y;
}

export function randTile(w, h) {
    return {
        x: Math.floor(Math.random() * w),
        y: Math.floor(Math.random() * h)
    };
}