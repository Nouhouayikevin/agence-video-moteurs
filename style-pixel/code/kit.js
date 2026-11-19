// kit.js — rich pixel-art pieces for the pixel shots (loi du détail, Kev 2026-11-09 : un plan pixel qui raconte une scène est aussi riche qu'un plan HD-2D).
// Everything draws into an FB (320×180, indexed palette of px.js). Shading = 2–4 tones per material, Bayer dither between tones, a dark outline where shapes meet.
import { C, bayer, hash, clamp } from './px.js';
const H = (x, y = 0, z = 0) => hash(x | 0, y | 0, z | 0);
const lerp = (a, b, k) => a + (b - a) * k;

// sky: dithered gradient + soft pixel clouds that drift with t
export function skyP(fb, y0, y1, cols, t = 0, { clouds = 4, cloudCols = [C.white, C.silver], seed = 1 } = {}) {
  fb.gradV(0, y0, 320, y1 - y0, cols);
  for (let i = 0; i < clouds; i++) cloudP(fb, ((H(i, seed) * 360 + t * (3 + i)) % 380) - 30, y0 + 6 + H(i, seed, 2) * (y1 - y0) * .45, 22 + H(i, seed, 3) * 26, cloudCols);
}
export function cloudP(fb, x, y, w, [hi, lo] = [C.white, C.silver]) {
  const n = Math.max(3, Math.round(w / 9));
  for (let k = 0; k < n; k++) { const cx = x + (k + .5) * w / n, r = 4 + Math.sin(k / (n - 1) * Math.PI) * w * .16; fb.disc(cx, y - r * .4, r, hi); }
  for (let xx = Math.round(x); xx < x + w; xx++) { fb.px(xx, Math.round(y + 1), lo); if (bayer(xx, 0) < .5) fb.px(xx, Math.round(y), lo); }
}
// layered hills / mountains: a noisy silhouette filled with a dithered two-tone, optional tree dots
export function hillsP(fb, yb, amp, cols, seed = 1, { trees = 0, w = 320 } = {}) {
  for (let x = 0; x < w; x++) {
    const h = amp * (.55 + .3 * Math.sin(x * .021 + seed) + .15 * Math.sin(x * .067 + seed * 3) + .08 * (H(x >> 2, seed) - .5));
    const top = Math.round(yb - h);
    for (let y = top; y < yb; y++) fb.px(x, y, bayer(x, y) < (y - top) / Math.max(1, yb - top) ? cols[1] : cols[0]);
    if (trees && H(x, seed, 7) < trees) { fb.disc(x, top - 1, 2, cols[2] ?? cols[1]); fb.px(x, top - 3, cols[0]); }
  }
}
// grass band with blades and a few flowers
export function grassP(fb, y0, y1, t = 0, { cols = [C.green, C.lime, C.dgreen], flowers = .02 } = {}) {
  fb.gradV(0, y0, 320, y1 - y0, [cols[1], cols[0], cols[0], cols[2]]);
  for (let i = 0; i < 260; i++) { const x = H(i, 3) * 320, y = y0 + 2 + H(i, 4) * (y1 - y0 - 2), sw = Math.round(Math.sin(t * 2 + i) * .6); fb.px(x + sw, y - 1, cols[1]); fb.px(x, y, cols[2]); }
  for (let i = 0; i < 320 * flowers * (y1 - y0) / 10; i++) { const x = H(i, 9) * 320, y = y0 + 3 + H(i, 10) * (y1 - y0 - 4); fb.px(x, y, [C.yellow, C.white, C.pink, C.red][i % 4]); fb.px(x, y + 1, cols[2]); }
}
export function sandP(fb, y0, y1, cols = [C.sand, C.tan, C.skin]) {
  fb.gradV(0, y0, 320, y1 - y0, [cols[0], cols[0], cols[1]]);
  for (let i = 0; i < 300; i++) fb.px(H(i, 11) * 320, y0 + H(i, 12) * (y1 - y0), [cols[1], cols[2], C.white][i % 3]);
}
// sea: bands of blue with moving highlight dashes, foam at the shore line
export function seaP(fb, y0, y1, t = 0, shore = null) {
  fb.gradV(0, y0, 320, y1 - y0, [C.blue, C.navy, C.blue, C.cyan]);
  for (let i = 0; i < 90; i++) { const y = y0 + 1 + Math.floor(H(i, 5) * (y1 - y0 - 1)), x = ((H(i, 6) * 340 + t * (4 + (y - y0) * .5)) % 340) - 10, l = 2 + (y - y0) * .25; fb.hline(x, x + l, y, (y - y0) / (y1 - y0) > .5 ? C.cyan : C.sky); }
  if (shore !== null) for (let x = 0; x < 320; x++) { const yy = shore + Math.round(Math.sin(x * .09 + t * 2) * 1.2); fb.px(x, yy, C.white); if (bayer(x, yy) < .5) fb.px(x, yy - 1, C.cyan); }
}
// palm: curved, ringed, two-tone trunk; 7 fronds with leaflets drawn along arcs; coconuts. (x, yb) = foot of the trunk
export function palmP(fb, x, yb, h, lean = 1, t = 0, k = 1) {
  const pts = []; for (let i = 0; i <= h; i++) { const u = i / h; pts.push([x + lean * 14 * k * u * u, yb - i]); }
  pts.forEach(([px, py], i) => { const w = Math.max(2, Math.round((3.2 - i / h * 1.2) * k)); for (let d = -w; d <= w; d++) fb.px(px + d, py, i % 5 === 0 ? C.umber : d < 0 ? C.dbrown : d > w - 2 ? C.tan : C.brown); });
  const [tx, ty] = pts[h], sw = Math.sin(t * 1.6 + x) * 1.5;
  for (let f = 0; f < 7; f++) {
    const ang = -Math.PI + (f / 6) * Math.PI + (H(f, x) - .5) * .3, len = (18 + H(f, x, 2) * 8) * k, dir = Math.cos(ang);
    for (let s = 0; s <= len; s++) { const u = s / len, fx = tx + dir * s, fy = ty + Math.sin(ang) * s * .45 + u * u * (10 + Math.abs(dir) * 8) * k + sw * u;
      fb.px(fx, fy, C.dgreen); const lw = Math.round(Math.sin(Math.PI * Math.min(1, u * 1.2)) * 4 * k);
      if (s % 2 === 0) for (let j = 1; j <= lw; j++) { fb.px(fx - j * .3 * Math.sign(dir || 1), fy + j, j < lw ? C.green : C.lime); fb.px(fx + j * .2, fy - j * .6, C.green); } }
  }
  for (const [a, b] of [[-2, 2], [1, 3], [3, 1]]) { fb.disc(tx + a, ty + b, 1.6 * k, C.dbrown); fb.px(tx + a - 1, ty + b - 1, C.brown); }
}
// round tree: trunk + clustered leaf blobs in 3 greens, lit from the top left
export function treeP(fb, x, yb, r, t = 0, cols = [C.dgreen, C.green, C.lime]) {
  fb.rect(x - 2, yb - r * 1.1, 4, r * 1.1, C.dbrown); fb.vline(x - 2, yb - r * 1.1, yb, C.umber); fb.px(x - 3, yb - 1, C.dbrown); fb.px(x + 2, yb - 1, C.dbrown);
  const sw = Math.round(Math.sin(t * 1.3 + x) * .8), cy = yb - r * 1.6;
  for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28, rr = r * (.55 + H(i, x) * .2); fb.disc(x + Math.cos(a) * r * .55 + sw, cy + Math.sin(a) * r * .45, rr, cols[0]); }
  for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28 + 1, rr = r * (.4 + H(i, x, 2) * .15); fb.disc(x + Math.cos(a) * r * .4 - 1 + sw, cy - 1 + Math.sin(a) * r * .3, rr, cols[1]); }
  for (let i = 0; i < 5; i++) fb.disc(x - r * .35 + i * 2 + sw, cy - r * .45 + (i % 2), r * .2, cols[2]);
}
// building facade: material, windows with frames and sills (some lit), cornice, door; options: fire escape, water tank, awning, sign
export function facadeP(fb, x, yb, w, h, o = {}) {
  const { wall = [C.rust, C.crimson, C.dbrown], frame = C.sand, glass = [C.navy, C.blue], lit = .25, cols = Math.max(2, Math.floor(w / 14)), rows = Math.max(1, Math.floor((h - 10) / 16)), seed = 1, brick = true } = o;
  const y0 = yb - h;
  for (let y = y0; y < yb; y++) for (let xx = x; xx < x + w; xx++) { const row = (y - y0) >> 1, m = brick && ((y - y0) % 2 === 1 || ((xx + (row % 2 ? 2 : 0)) % 4 === 0)); fb.px(xx, y, m ? wall[2] : bayer(xx, y) < .3 ? wall[1] : wall[0]); }
  fb.rect(x - 1, y0 - 3, w + 2, 3, o.cornice ?? C.steel); fb.hline(x - 1, x + w, y0 - 3, C.silver); fb.hline(x - 1, x + w, y0, C.ink);
  const cw = (w - 4) / cols;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const wx = Math.round(x + 3 + c * cw), wy = y0 + 5 + r * 16, ww = Math.max(4, Math.round(cw - 5)), wh = 10, on = H(r, c, seed) < lit;
    fb.rect(wx - 1, wy - 1, ww + 2, wh + 2, frame); fb.gradV(wx, wy, ww, wh, on ? [C.yellow, C.amber] : glass); fb.vline(wx + (ww >> 1), wy, wy + wh - 1, frame); fb.hline(wx, wx + ww - 1, wy + 4, frame);
    if (!on) fb.px(wx + 1, wy + 1, C.cyan); fb.hline(wx - 2, wx + ww + 1, wy + wh + 1, C.silver); fb.hline(wx - 2, wx + ww + 1, wy + wh + 2, C.ink);
    if (o.escape && c === cols - 1 && r > 0) { fb.hline(wx - 4, wx + ww + 3, wy + wh + 3, C.ink); for (let k = wx - 4; k <= wx + ww + 3; k += 2) fb.px(k, wy + wh + 2, C.ink); fb.line(wx + ww + 2, wy + wh + 3, wx + ww - 3, wy + wh + 18, C.ink); }
  }
  if (o.door !== false) { const dx = Math.round(x + w / 2 - 5); fb.rect(dx - 1, yb - 15, 12, 15, frame); fb.rect(dx, yb - 14, 10, 14, o.doorCol ?? C.umber); fb.vline(dx + 5, yb - 14, yb - 1, C.ink); fb.px(dx + 3, yb - 7, C.yellow); fb.px(dx + 7, yb - 7, C.yellow);
    for (let s = 0; s < 3; s++) fb.rect(dx - 3 - s * 2, yb + s * 2 - 2, 16 + s * 4, 2, s % 2 ? C.steel : C.silver); }
  if (o.tank) { const tx = x + w * .7; fb.rect(tx - 7, y0 - 18, 14, 12, C.brown); for (let i = 0; i < 14; i += 3) fb.vline(tx - 7 + i, y0 - 18, y0 - 7, C.dbrown); poly3(fb, tx - 8, y0 - 18, tx + 8, y0 - 18, tx, y0 - 25, C.umber); fb.vline(tx - 5, y0 - 6, y0 - 3, C.ink); fb.vline(tx + 5, y0 - 6, y0 - 3, C.ink); }
  if (o.awning) for (let xx = x + 2; xx < x + w - 2; xx++) for (let k = 0; k < 6; k++) fb.px(xx, yb - 20 + k + (xx % 2 && k === 5 ? 1 : 0), Math.floor((xx - x) / 4) % 2 ? C.white : o.awning);
}
function poly3(fb, ax, ay, bx, by, cx, cy, c) { const minY = Math.round(Math.min(ay, by, cy)), maxY = Math.round(Math.max(ay, by, cy));
  for (let y = minY; y <= maxY; y++) { const xs = []; for (const [p, q] of [[[ax, ay], [bx, by]], [[bx, by], [cx, cy]], [[cx, cy], [ax, ay]]]) { if ((y >= p[1] && y < q[1]) || (y >= q[1] && y < p[1])) xs.push(p[0] + (y - p[1]) / (q[1] - p[1]) * (q[0] - p[0])); }
    if (xs.length >= 2) fb.hline(Math.min(...xs), Math.max(...xs), y, c); } }
export const tri = poly3;
// small fire with flicker, and smoke puffs rising
export function fireP(fb, x, yb, s = 1, t = 0) {
  for (let i = 0; i < 4; i++) fb.rect(x - 8 * s + i * 4 * s, yb - 2, 6 * s, 2, i % 2 ? C.umber : C.dbrown);
  for (let i = 0; i < 14; i++) { const ph = (H(i, 1) + t * 1.8) % 1, fx = x + (H(i, 2) - .5) * 10 * s * (1 - ph), fy = yb - 3 - ph * 16 * s; fb.disc(fx, fy, (1 - ph) * 3.4 * s, ph < .3 ? C.yellow : ph < .6 ? C.amber : C.orange); }
  for (let i = 0; i < 6; i++) { const ph = (H(i, 3) + t * .35) % 1; fb.disc(x + ph * 10 * s + Math.sin(t + i) * 2, yb - 20 * s - ph * 30 * s, 2 + ph * 4 * s, bayer(i, Math.floor(t * 4)) < .5 ? C.silver : C.steel); }
}
// subtle shadow under something
export function shadowP(fb, cx, cy, rx, ry, col = C.ink) { for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) if ((x / rx) ** 2 + (y / ry) ** 2 <= 1 && bayer(cx + x, cy + y) < .5) fb.px(cx + x, cy + y, col); }
export { lerp, clamp };
