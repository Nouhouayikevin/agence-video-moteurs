// art.js — L002 « Projet Pigeon » : sprites, props and backgrounds, all drawn in code into the indexed framebuffer
import { FB, T, C, W, H, bayer, hash } from './px.js';

export const K = C.ink;
const memo = new Map();
const cached = (key, fn) => { if (!memo.has(key)) memo.set(key, fn()); return memo.get(key); };
export function spr(w, h) { const s = new FB(w, h); s.clear(T); return s; }
// 1-px ink outline around every opaque shape of a sprite
export function outline(s, c = K) {
  const o = s.d.slice();
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
    if (s.d[y * s.w + x] !== T) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => s.get(x + dx, y + dy) !== T)) o[y * s.w + x] = c;
  }
  s.d.set(o); return s;
}
// blit at an integer scale k (whole sprite scaled evenly)
export function blitS(fb, s, x, y, k = 1, flip = false, map = null) {
  x = Math.round(x); y = Math.round(y);
  for (let sy = 0; sy < s.h; sy++) for (let sx = 0; sx < s.w; sx++) {
    let c = s.d[sy * s.w + (flip ? s.w - 1 - sx : sx)]; if (c === T) continue;
    if (map) c = map(c);
    if (k === 1) fb.px(x + sx, y + sy, c); else fb.rect(x + sx * k, y + sy * k, k, k, c);
  }
}
export function ell(fb, cx, cy, rx, ry, c) {
  for (let y = Math.floor(-ry); y <= ry; y++) for (let x = Math.floor(-rx); x <= rx; x++)
    if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) fb.px(cx + x, cy + y, typeof c === 'function' ? c(cx + x, cy + y, x, y) : c);
}
export function poly(fb, pts, c) {   // scanline polygon fill
  const ys = pts.map(p => p[1]), y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
  for (let y = y0; y <= y1; y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) { const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
      if ((ay <= y + .5 && by > y + .5) || (by <= y + .5 && ay > y + .5)) xs.push(ax + (y + .5 - ay) / (by - ay) * (bx - ax)); }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.round(xs[i]); x < Math.round(xs[i + 1]); x++) fb.px(x, y, typeof c === 'function' ? c(x, y) : c);
  }
}
// whole-frame camera zoom by an integer factor around (cx, cy): every pixel doubles evenly
export function zoomFB(fb, cx, cy, z) {
  if (z <= 1) return; const src = fb.d.slice();
  const x0 = Math.round(cx - W / 2 / z), y0 = Math.round(cy - H / 2 / z);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const sx = Math.min(W - 1, Math.max(0, x0 + Math.floor(x / z))), sy = Math.min(H - 1, Math.max(0, y0 + Math.floor(y / z)));
    fb.d[y * W + x] = src[sy * W + sx];
  }
}

// ———————————————— Pigeon (side view, facing right) ————————————————
// peck: head down to the screen; hero: the little white feather; gold: gold-tipped beak (ORCON, 1948); wing: wings up; old: greyer, a bit rounder
export function pigeon({ f = 0, peck = false, hero = false, gold = false, wing = false, blink = false, old = false, turn = false, sad = false, vest = false } = {}) {
  const fq = Math.floor(((f % 1) + 1) % 1 * 2);
  return cached(`pg${fq}${peck}${hero}${gold}${wing}${blink}${old}${turn}${sad}${vest}`, () => {
    const s = spr(28, 24), body = old ? C.silver : C.steel, back = old ? C.steel : C.slate;
    // tail
    poly(s, [[1, 12], [7, 11], [8, 15], [2, 16]], back); s.hline(1, 3, 15, C.ink); s.hline(1, 3, 12, C.dslate);
    // body
    ell(s, 13, 14, 8.5, 5.5, (x, y, dx, dy) => dy > 2 ? C.silver : body);
    // folded wing with its two black bars
    if (!wing) { ell(s, 11, 13, 6, 3.5, back); s.line(8, 12, 14, 13, C.ink); s.line(7, 14, 13, 15, C.ink); s.hline(4, 9, 15, C.dslate); }
    else { poly(s, [[8, 11], [3, 1], [9, 3], [16, 10]], back); s.line(5, 4, 11, 9, C.ink); s.line(7, 3, 13, 8, C.silver); }
    // neck: iridescent green-purple
    const hx = peck ? 23 : 21, hy = peck ? 12 : 6;
    for (let i = 0; i <= 6; i++) { const k = i / 6, x = 17 + (hx - 17) * k, y = 11 + (hy - 11) * k;
      s.rect(x - 2, y - 1, 4, 3, i < 2 ? C.plum : i < 4 ? C.green : C.teal); }
    // head
    ell(s, hx, hy, 3.5, 3.2, (x, y, dx, dy) => dy < -1 ? C.silver : body);
    const ex = hx + (turn ? 0 : 1), ey = hy - 1;
    if (blink) s.hline(ex - 1, ex + 1, ey, C.dslate); else { s.px(ex, ey, C.orange); s.px(ex + (turn ? 0 : 1), ey, C.ink); }
    if (sad) s.px(ex - 1, ey - 1, C.dslate);
    // beak (white cere at the base); gold tip for ORCON
    const bx = hx + 3, by = hy + (peck ? 1 : 0);
    if (!turn) { s.px(bx, by - 1, C.white); s.hline(bx, bx + 2, by, gold ? C.amber : C.dslate); s.px(bx + 2, by, gold ? C.yellow : C.dslate); }
    else s.px(hx, hy + 2, C.dslate);
    if (hero) { s.px(hx - 1, hy - 4, C.white); s.px(hx - 2, hy - 5, C.white); s.px(hx - 1, hy - 5, C.uw); }
    if (vest) { ell(s, 13, 14, 7, 4.5, (x, y, dx, dy) => Math.abs(dx) < 4.5 ? C.crimson : T); s.vline(13, 10, 18, C.rust); }   // the little vest (1940)
    // feet
    const st = fq ? 1 : 0; s.vline(11, 19, 21, C.pink); s.vline(15 + st, 19, 21, C.pink); s.hline(11, 13, 21, C.pink); s.hline(15 + st, 17 + st, 21, C.pink);
    return outline(s);
  });
}
// big hero pigeon head, three-quarter view, for the still close-ups (shots 1, 59)
export function bigPigeon(fb, cx, cy, { blink = false, look = 0 } = {}) {
  const s = cached(`bigp${blink}${look}`, () => {
    const s = spr(120, 110), hx = 54, hy = 46;
    // shoulders + neck sheen
    for (let y = 70; y < 110; y++) for (let x = -50; x <= 50; x++) { const e = (x * x) / 2500 + ((y - 112) ** 2) / 1600; if (e > 1) continue;
      s.px(hx + x, y, (x * 3 + y * 2) % 11 === 0 ? C.dslate : y < 84 ? C.steel : C.slate); }
    for (let y = hy + 10; y < 96; y++) { const w = 18 + (y - hy) * .35; for (let x = -w; x <= w; x++) { const g = (x + y * .6) / 9;
      s.px(hx + x, y, Math.sin(g) > .35 ? C.green : Math.sin(g) < -.45 ? C.plum : x > w * .5 ? C.teal : C.dgreen); } }
    // head
    for (let y = -30; y <= 26; y++) for (let x = -30; x <= 32; x++) { const e = (x * x) / 900 + (y * y) / 784; if (e > 1) continue;
      s.px(hx + x, hy + y, y < -14 ? C.silver : x > 14 && y > 0 ? C.slate : (x - y * 2) % 13 === 0 ? C.silver : C.steel); }
    // the eye: orange ring, black pupil, highlight
    const ex = hx + 6 + look * 2, ey = hy - 4;
    ell(s, ex, ey, 9, 9, C.uk);
    if (blink) { s.hline(ex - 9, ex + 9, ey, C.dslate); s.hline(ex - 8, ex + 8, ey + 1, C.ink); ell(s, ex, ey - 3, 9, 4, C.steel); }
    else { ell(s, ex, ey, 7.5, 7.5, C.orange); ell(s, ex, ey, 6, 6, C.amber); ell(s, ex + look, ey, 3.5, 3.5, C.ink); s.rect(ex - 4, ey - 5, 3, 3, C.white); s.px(ex + 3, ey + 3, C.white); }
    // beak toward camera-right, white cere
    ell(s, hx + 30, hy + 2, 6, 4, C.white); ell(s, hx + 30, hy + 3, 5, 3, C.silver);
    poly(s, [[hx + 30, hy + 4], [hx + 52, hy + 9], [hx + 51, hy + 12], [hx + 31, hy + 11]], C.dslate);
    s.hline(hx + 32, hx + 48, hy + 8, C.slate); s.px(hx + 50, hy + 10, C.ink);
    // the little white feather
    poly(s, [[hx - 4, hy - 28], [hx + 2, hy - 42], [hx + 6, hy - 40], [hx + 2, hy - 27]], C.uw); s.line(hx - 1, hy - 29, hx + 3, hy - 39, C.silver);
    return outline(s);
  });
  blitS(fb, s, cx - 54, cy - 46);
}

// ———————————————— People (side view, facing right) ————————————————
// kind → [jacket, jacket shade, trousers, hair, extra]; arms: 'down' | 'point' | 'cross' | 'up' | 'hold' | 'write' | 'mouth'
const LOOK = {
  skinner: { coat: [C.uw, C.silver], pants: C.dslate, hair: C.dbrown, glasses: true, tie: C.crimson },
  breland: { coat: [C.crimson, C.rust], pants: C.tan, hair: C.amber },
  victor: { coat: [C.tan, C.brown], pants: C.dbrown, hair: C.dbrown, hat: C.dbrown },
  officer: { coat: [C.navy, C.night], pants: C.navy, hair: C.dbrown, cap: true },
  taylor: { coat: [C.navy, C.night], pants: C.navy, hair: C.amber, cap: true, glasses: true },
  expert: { coat: [C.dslate, C.night], pants: C.night, hair: C.silver, tie: C.navy },
  hyde: { coat: [C.sand, C.tan], pants: C.tan, hair: C.ink, tie: C.crimson, mous: true },
  mit: { coat: [C.brown, C.dbrown], pants: C.dslate, hair: C.dbrown, bow: true, glasses: true },
  engineer: { coat: [C.blue, C.navy], pants: C.navy, hair: C.dbrown, cap2: C.navy },
  operator: { coat: [C.navy, C.night], pants: C.navy, hair: C.ink, phones: true },
  daughter: { coat: [C.rose, C.plum], pants: C.plum, hair: C.silver, bun: true, dress: true },
  student: { coat: [C.amber, C.orange], pants: C.navy, hair: C.dbrown },
  clerk: { coat: [C.uw, C.silver], pants: C.dslate, hair: C.ink, tie: C.navy },
  zimbardo: { coat: [C.dbrown, C.umber], pants: C.night, hair: C.ink, mous: true },          // L003: Philip Zimbardo, 1969 (dark jacket, moustache)
  passant: { coat: [C.teal, C.dgreen], pants: C.tan, hair: C.dbrown, tie: C.amber },          // L003: well-dressed passers-by, Palo Alto 1969
  passante: { coat: [C.amber, C.orange], pants: C.amber, hair: C.amber, bun: true, dress: true },
};
const HAIRV = [C.silver, C.ink, C.dbrown, C.steel];
export function person(kind, { f = 0, walk = false, arms = 'down', v = 0, laugh = false, sit = false } = {}) {
  const fq = walk ? Math.floor(((f % 1) + 1) % 1 * 4) : 0, af = Math.floor(((f % 1) + 1) % 1 * 2);
  return cached(`p${kind}${fq}${walk}${arms}${v}${laugh}${sit}${arms === 'write' || arms === 'up' ? af : 0}`, () => {
    const s = spr(22, 34), L = LOOK[kind], top = sit ? 11 : 7, legY = top + 13;
    const hair = kind === 'expert' ? HAIRV[v % 4] : L.hair;
    // legs
    const sw = walk ? [0, 2, 0, -2][fq] : 0;
    if (L.dress) { poly(s, [[7, legY - 1], [15, legY - 1], [17, legY + 7], [5, legY + 7]], L.coat[0]); s.rect(8, legY + 7, 2, 4, C.skin); s.rect(12, legY + 7, 2, 4, C.skin); s.rect(7, legY + 11, 4, 2, C.ink); s.rect(12, legY + 11, 4, 2, C.ink); }
    else if (!sit) { s.rect(8 + sw, legY, 3, 11, L.pants); s.rect(11 - sw, legY, 3, 11, L.pants); s.vline(11 - sw, legY, legY + 10, C.ink === L.pants ? C.night : L.pants);
      s.rect(7 + sw, legY + 11, 5, 2, C.ink); s.rect(11 - sw, legY + 11, 5, 2, C.ink); }
    else { s.rect(8, legY, 9, 3, L.pants); s.rect(14, legY + 3, 3, 8, L.pants); s.rect(14, legY + 11, 5, 2, C.ink); }
    // torso (lab coat / jacket goes a bit lower)
    const long = kind === 'skinner' || kind === 'victor';
    s.rect(7, top + 5, 9, long ? 13 : 9, L.coat[0]); s.rect(7, top + 5, 2, long ? 13 : 9, L.coat[1]);
    if (L.tie) { s.vline(12, top + 5, top + 9, L.tie); s.px(11, top + 5, C.uw); s.px(13, top + 5, C.uw); }
    if (L.bow) { s.px(11, top + 5, C.crimson); s.px(13, top + 5, C.crimson); s.px(12, top + 5, C.cer); }
    if (kind === 'skinner') { s.vline(12, top + 10, top + 17, C.silver); s.px(14, top + 9, C.blue); }   // coat edge, pen in the pocket
    if (kind === 'officer' || kind === 'taylor') { s.px(13, top + 7, C.yellow); s.px(13, top + 10, C.yellow); }   // plain buttons, no insignia
    // arms
    const A = L.coat[1];
    if (arms === 'point') { s.rect(14, top + 6, 6, 2, A); s.px(20, top + 6, C.skin); }
    else if (arms === 'cross') { s.rect(9, top + 8, 7, 2, A); s.rect(14, top + 9, 2, 1, C.skin); }
    else if (arms === 'up') { s.rect(14, top + 1 - af, 2, 6, A); s.rect(14, top - 1 - af, 2, 2, C.skin); s.rect(6, top + 1 + af, 2, 6, A); s.rect(6, top - 1 + af, 2, 2, C.skin); }
    else if (arms === 'hold') { s.rect(13, top + 7, 6, 2, A); s.rect(18, top + 6, 2, 3, C.skin); }
    else if (arms === 'write') { s.rect(13, top + 8, 5, 2, A); s.px(18, top + 9 + af, C.skin); }
    else if (arms === 'mouth') { s.rect(13, top + 6, 2, 4, A); s.rect(13, top + 3, 2, 3, C.skin); }
    else { s.rect(10, top + 6, 3, 7, A); s.rect(10, top + 13, 3, 2, C.skin); }
    // head
    s.rect(9, top, 6, 6, C.skin); s.rect(9, top + 4, 2, 2, C.skinS);
    if (laugh) { s.hline(12, 13, top + 2, C.ink); s.rect(12, top + 4, 3, 1, C.crimson); s.px(14, top + 3, C.skinS); } else s.px(13, top + 2, C.ink);   // laugh: squinting eye, open mouth
    if (L.glasses) { s.px(12, top + 2, C.ink); s.px(14, top + 2, C.ink); s.px(13, top + 1, C.ink); s.px(13, top + 3, C.ink); s.px(13, top + 2, C.skyL); }
    if (L.mous) s.hline(12, 15, top + 4, C.ink);
    // hair / hats
    if (L.hat) { s.rect(8, top - 3, 8, 3, L.hat); s.hline(6, 17, top, L.hat); s.hline(8, 15, top - 1, C.ink); }
    else if (L.cap) { s.rect(8, top - 2, 8, 2, C.uw); s.hline(12, 16, top, C.ink); }
    else if (L.cap2) { s.rect(8, top - 2, 7, 2, L.cap2); s.hline(13, 16, top, L.cap2); }
    else { s.rect(9, top - 1, 6, 2, hair); s.vline(9, top, top + 3, hair); if (L.bun) { s.rect(7, top - 1, 2, 3, hair); } if (kind === 'expert' && v % 4 === 3) s.rect(9, top - 1, 6, 1, C.skin); }
    if (L.phones) { s.hline(9, 14, top - 2, C.ink); s.rect(9, top + 1, 2, 3, C.ink); }
    return outline(s);
  });
}
export function dog({ f = 0, walk = false } = {}) {
  const fq = walk ? Math.floor(((f % 1) + 1) % 1 * 2) : 0;
  return cached(`dog${fq}`, () => {
    const s = spr(16, 12);
    s.rect(3, 4, 9, 4, C.sand); s.rect(3, 7, 9, 1, C.tan); s.rect(11, 1, 4, 4, C.sand); s.px(13, 2, C.ink); s.px(15, 3, C.ink); s.rect(11, 0, 2, 2, C.brown);
    s.line(3, 4, 1, 1, C.sand); const o = fq ? 1 : 0; for (const x of [4 + o, 6 - o, 9 + o, 11 - o]) s.vline(x, 8, 10, C.tan);
    return outline(s);
  });
}
export function pelican({ f = 0 } = {}) {
  const fq = Math.floor(((f % 1) + 1) % 1 * 2);
  return cached(`pel${fq}`, () => {
    const s = spr(44, 22);
    ell(s, 18, 12, 10, 5, C.uw); poly(s, [[8, 11], [1, 9], [2, 13]], C.silver);
    if (fq) poly(s, [[12, 10], [20, 0], [26, 1], [22, 10]], C.silver); else poly(s, [[12, 13], [20, 21], [26, 20], [22, 13]], C.silver);
    s.rect(26, 7, 4, 4, C.uw); ell(s, 30, 6, 3, 3, C.uw); s.px(31, 5, C.ink);
    poly(s, [[32, 6], [43, 8], [42, 9], [32, 8]], C.amber); poly(s, [[32, 8], [41, 9], [36, 14], [32, 11]], C.orange);   // the famous pouch
    return outline(s);
  });
}

// ———————————————— Backgrounds and props (pixel shots) ————————————————
export function sky(fb, y0, y1, ox = 0) {
  fb.gradV(0, y0, W, y1 - y0, [C.sky, C.sky, C.skyL, C.skyL, C.white]);
  for (const [cx, cy, r] of [[40, 24, 9], [170, 40, 12], [270, 18, 8]]) {
    const X = ((cx - ox * .2) % (W + 40) + W + 40) % (W + 40) - 20;
    ell(fb, X, y0 + cy, r * 1.6, r * .7, C.white); ell(fb, X + r, y0 + cy - 3, r, r * .6, C.white); fb.hline(X - r * 1.5, X + r * 1.8, y0 + cy + r * .5, C.silver);
  }
}
// warm wooden backdrop (desk, office wall)
export function woodBg(fb, y0 = 0, y1 = H) {
  fb.gradV(0, y0, W, y1 - y0, [C.dbrown, C.umber]);
  for (let y = y0; y < y1; y += 9) fb.hline(0, W, y, C.ink);
  for (let i = 0; i < 70; i++) fb.hline(hash(i, 1) * W, hash(i, 1) * W + 6 + hash(i, 2) * 20, y0 + hash(i, 3) * (y1 - y0), C.brown);
}
// a sheet of paper, slight shadow; lines = number of fake text lines
export function paper(fb, x, y, w, h, { lines = 8, col = C.sand, ink = C.steel, from = 26 } = {}) {
  fb.rect(x + 3, y + 3, w, h, C.ink); fb.rect(x, y, w, h, col); fb.hline(x, x + w - 1, y, C.uw);
  for (let i = 0; i < lines; i++) { const yy = y + from + i * 8; if (yy > y + h - 8) break; fb.hline(x + 10, x + w - 12 - hash(i, x) * 30, yy, ink); }
}
// round pigeon's-eye screen: frame + glass; draws inside with fn(cx, cy, r)
export function scope(fb, cx, cy, r, fn) {
  ell(fb, cx, cy, r + 6, r + 6, C.dslate); ell(fb, cx, cy, r + 3, r + 3, C.slate);
  const keep = fb.clip; fb.clip = [cx - r, cy - r, cx + r + 1, cy + r + 1];
  const m = spr(W, H); fn(m, cx, cy, r);
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) { const c = m.get(cx + x, cy + y); fb.px(cx + x, cy + y, c === T ? C.night : c); }
  fb.clip = keep;
  for (let a = 0; a < 40; a++) fb.px(cx + Math.cos(a / 40 * 6.28) * (r * .55) - r * .3, cy + Math.sin(a / 40 * 6.28) * (r * .55) - r * .3, a < 8 ? C.uw : T);   // glint
}
// crosshair + target rings at (x, y)
export function target(fb, x, y, r, c = C.cer) {
  for (let k = r; k > 0; k -= Math.max(2, r / 3)) { for (let a = 0; a < 6.28; a += 1 / k) fb.px(x + Math.cos(a) * k, y + Math.sin(a) * k, c); }
  fb.rect(x - 1, y - 1, 3, 3, c);
}
// a ship seen from above / side (target on the pigeon's screen)
export function ship(fb, x, y, k = 1, c = C.slate) {
  poly(fb, [[x - 14 * k, y], [x + 12 * k, y], [x + 16 * k, y - 3 * k], [x - 16 * k, y - 3 * k]], c);
  fb.rect(x - 6 * k, y - 7 * k, 10 * k, 4 * k, c); fb.rect(x - 2 * k, y - 11 * k, 3 * k, 4 * k, c);
}
// aerial city photo, crossroads at (cx, cy); s = block size
export function cityMap(fb, x0, y0, w, h, cx, cy, s = 14) {
  fb.rect(x0, y0, w, h, C.tan);
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const gx = ((x - cx) % s + s) % s, gy = ((y - cy) % s + s) % s, road = gx < 3 || gy < 3;
    fb.px(x, y, road ? (Math.abs(x - cx) < 3 || Math.abs(y - cy) < 3 ? C.sand : C.silver) : hash(Math.floor((x - cx) / s), Math.floor((y - cy) / s)) > .7 ? C.green : bayer(x, y) < .3 ? C.clay : C.brown);
  }
}

// ———————————————— L003: the AI agents (small robots, one colour per model, facing right) ————————————————
// model: claude | gemini | grok | gpt ; o.tag: 'mira' (rose scarf) | 'flora' (green leaf) ; arms: 'down' | 'up' | 'punch' | 'hold' | 'match' | 'point'
const ROBO = { claude: [C.clay, C.rust, C.amber], gemini: [C.blue, C.navy, C.cyan], grok: [C.dslate, C.night, C.hot], gpt: [C.green, C.dgreen, C.lime] };
export function robot(model, { f = 0, walk = false, arms = 'down', off = false, tag = '', blink = false } = {}) {
  const fq = walk ? Math.floor(((f % 1) + 1) % 1 * 4) : 0, af = Math.floor(((f % 1) + 1) % 1 * 2);
  return cached(`r${model}${fq}${walk}${arms}${off}${tag}${blink}${arms === 'up' || arms === 'match' ? af : 0}`, () => {
    const s = spr(20, 28), [b, sh, eye] = ROBO[model], top = off ? 8 : 4, sw = walk ? [0, 2, 0, -2][fq] : 0;
    // antenna with its light
    s.vline(10, top - 3, top - 1, C.dslate); s.px(10, top - 4, off ? C.slate : eye);
    // head: rounded box, dark visor, two eyes
    s.rect(5, top, 11, 8, b); s.rect(5, top + 6, 11, 2, sh); s.d[top * 20 + 5] = T; s.d[top * 20 + 15] = T;   // rounded corners
    s.rect(7, top + 2, 8, 3, C.ink); if (!off) { if (blink) s.hline(9, 13, top + 3, eye); else { s.px(10, top + 3, eye); s.px(13, top + 3, eye); } } else s.hline(9, 13, top + 4, C.slate);
    // body
    const by = top + 9; s.rect(6, by, 9, off ? 6 : 8, b); s.rect(6, by, 2, off ? 6 : 8, sh); s.rect(9, by + 2, 3, 2, off ? C.slate : eye);   // chest light
    if (tag === 'mira') { s.rect(6, by, 9, 2, C.rose); s.px(15, by + 1, C.rose); s.px(16, by + 2, C.rose); }
    if (tag === 'flora') { s.px(14, top - 1, C.lime); s.px(15, top - 2, C.lime); s.px(14, top - 2, C.green); }
    // arms
    const ay = by + 1;
    if (arms === 'up') { s.rect(15, ay - 5 - af, 2, 6, sh); s.rect(4, ay - 5 + af, 2, 6, sh); }
    else if (arms === 'punch') { s.rect(14, ay + 1, 5, 2, sh); s.rect(18, ay, 2, 4, b); }
    else if (arms === 'hold') { s.rect(14, ay + 2, 4, 2, sh); }
    else if (arms === 'match') { s.rect(14, ay + 1, 3, 2, sh); s.vline(17, ay - 4, ay + 1, C.tan); s.px(17, ay - 5 - af, C.amber); s.px(17, ay - 6, C.yellow); }
    else if (arms === 'point') { s.rect(14, ay + 1, 6, 2, sh); }
    else if (!off) { s.rect(15, ay, 2, 6, sh); }
    if (!off) s.rect(4, ay, 2, 6, sh);
    // legs (sitting slumped when off)
    if (off) { s.rect(6, by + 6, 9, 2, sh); s.rect(13, by + 8, 5, 2, C.ink); s.rect(4, by + 8, 5, 2, C.ink); }
    else { s.rect(7 + sw, by + 8, 3, 5, sh); s.rect(11 - sw, by + 8, 3, 5, sh); s.rect(6 + sw, by + 13, 4, 2, C.ink); s.rect(11 - sw, by + 13, 4, 2, C.ink); }
    return outline(s);
  });
}
