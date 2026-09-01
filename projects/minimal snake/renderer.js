import { area_w, area_h, tile_sz, area_tile_w, area_tile_h, padding, food_padding } from './constants.js';
import { pos_equal } from './utils.js';

let canvas = document.getElementById("g");
let ctx = canvas.getContext("2d");

export function draw_internal(pos, food) {
    // clear full buffer
    ctx.clearRect(0, 0, area_w, area_h);

    // draw grid
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    // vertical lines
    for (let gx = 0; gx <= area_tile_w; gx++) {
        let x = gx * tile_sz + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, area_h);
        ctx.stroke();
    }
    // horizontal lines
    for (let gy = 0; gy <= area_tile_h; gy++) {
        let y = gy * tile_sz + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(area_w, y);
        ctx.stroke();
    }
    ctx.restore();

    // draw snake
    ctx.fillStyle = "white";
    if (pos.length > 1) {
        for (let e = 1; e < pos.length; e++) {
            const a = pos[e], t = pos[e - 1];
            const i = Math.min(a.x, t.x), _ = Math.max(a.x, t.x);
            const o = Math.min(a.y, t.y), l = Math.max(a.y, t.y);
            const r = i * tile_sz + padding;
            const n = o * tile_sz + padding;
            const s = (1 + _ - i) * tile_sz - 2 * padding;
            const d = (1 + l - o) * tile_sz - 2 * padding;
            if (0 == i && _ == area_tile_w - 1) {
                ctx.fillRect(0, n, tile_sz - padding, d);
                ctx.fillRect(area_w - tile_sz + padding, n, tile_sz - padding, d);
            } else if (0 == o && l == area_tile_h - 1) {
                ctx.fillRect(r, 0, s, tile_sz - padding);
                ctx.fillRect(r, area_h - tile_sz + padding, s, tile_sz - padding);
            } else {
                ctx.fillRect(r, n, s, d);
            }
        }
    } else {
        const c = pos[0];
        ctx.fillRect(c.x * tile_sz + padding, c.y * tile_sz + padding, tile_sz - 2 * padding, tile_sz - 2 * padding);
    }

    // draw food
    if (food) {
        ctx.fillStyle = "white";
        ctx.fillRect(food.x * tile_sz + food_padding, food.y * tile_sz + food_padding, tile_sz - 2 * food_padding, tile_sz - 2 * food_padding);
    }
}

export function startRenderLoop(getState) {
    function draw_loop() {
        const { pos, food } = getState();
        draw_internal(pos, food);
        window.requestAnimationFrame(draw_loop);
    }
    window.requestAnimationFrame(draw_loop);
}