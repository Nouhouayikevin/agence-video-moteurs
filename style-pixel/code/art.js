// art.js — S001 « La guerre des émeus » : sprites, props and backgrounds, all drawn in code into the indexed framebuffer
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

// ———————————————— Emu (side view, facing right) ————————————————
// head: 'up' | 'mid' | 'down' (pecking); run: long strides; hero: the rebel feather; wing: lifted wing (goodbye)
export function emu({ f = 0, head = 'up', hero = false, run = false, sit = false, wing = 0, back = false } = {}) {
  const fq = Math.floor(((f % 1) + 1) % 1 * 4);
  return cached(`emu${fq}${head}${hero}${run}${sit}${wing}${back}`, () => {
    const s = spr(46, 50), bx = 17, by = sit ? 34 : 25;
    if (!sit) for (const [lx, ph] of [[14, 0], [20, .5]]) {
      const a = Math.sin((fq / 4 + ph) * Math.PI * 2) * (run ? 6 : 2.5);
      const kx = lx + a * .4 + 2, ky = by + 13, fx = lx + a, fy = 46 - (run && a > 2 ? 2 : 0);
      s.line(lx, by + 5, kx, ky, C.steel); s.line(lx + 1, by + 5, kx + 1, ky, C.slate);
      s.line(kx, ky, fx, fy, C.steel); s.line(kx + 1, ky, fx + 1, fy, C.slate);
      s.hline(fx - 1, fx + 3, fy, C.slate);
    }
    for (let y = -8; y <= 9; y++) for (let x = -13; x <= 13; x++) {
      const e = (x * x) / 169 + (y * y) / 64, shag = y > 2 ? hash(x + 40, 7) * .45 : 0;
      if (e > 1 - shag) continue;
      let c = C.dbrown;
      if (y < -4 + hash(x, 3) * 2) c = C.brown;
      if ((x * 2 + y + 60) % 5 === 0) c = C.umber;
      if (y > 5 && hash(x, y) > .4) c = C.umber;
      s.px(bx + x, by + y, c);
    }
    if (wing) { for (let i = 0; i < 9; i++) s.rect(bx - 2 + i, by - 9 - i, 3, 2, i % 3 ? C.dbrown : C.umber); }
    const H = { up: [bx + 12, by - 19], mid: [bx + 16, by - 9], down: [bx + 19, by + 10] }[head];
    const [hx, hy] = H, nx = bx + 9, ny = by - 4;
    for (let i = 0; i <= 14; i++) { const t = i / 14, x = nx + (hx - nx) * t, y = ny + (hy - ny) * t;
      s.rect(x - 1, y - 1, 3, 3, C.slate); if (i % 3) s.px(x + 1, y, C.steel); }
    s.rect(hx - 2, hy - 2, 6, 4, C.slate); s.rect(hx - 1, hy - 3, 4, 1, C.dslate); s.px(hx - 2, hy - 2, C.dslate);
    if (back) { s.px(hx - 1, hy - 1, C.white); s.px(hx - 2, hy - 1, C.uk); s.hline(hx - 5, hx - 3, hy, C.tan); }   // looks back
    else { s.px(hx + 1, hy - 1, C.white); s.px(hx + 2, hy - 1, C.uk); s.hline(hx + 4, hx + 6, hy, C.tan); s.px(hx + 4, hy + 1, C.brown); }
    if (hero) { s.px(hx - 1, hy - 4, C.umber); s.px(hx - 2, hy - 5, C.umber); s.px(hx - 3, hy - 6, C.brown); s.px(hx - 1, hy - 5, C.brown); s.px(hx - 2, hy - 7, C.umber); }
    if (sit) { s.hline(bx - 6, bx + 8, by + 9, C.slate); }
    return outline(s);
  });
}
// tiny emu seen from above (aerial "maquette" view)
export function emuTop(fb, x, y, f, dir = 1) {
  ell(fb, x, y, 3, 2, (X, Y, dx, dy) => dy < 0 ? C.brown : C.dbrown);
  fb.px(x + 3 * dir, y - 1, C.slate); fb.px(x + 4 * dir, y - 2, C.slate); fb.px(x + 5 * dir, y - 2, C.tan);
  if (Math.floor(f * 8) % 2) { fb.px(x - 1, y + 3, C.slate); fb.px(x + 1, y + 2, C.slate); } else { fb.px(x - 1, y + 2, C.slate); fb.px(x + 1, y + 3, C.slate); }
}

// big hero emu head, three-quarter view, looking at the camera (shots 1, 30)
export function bigEmu(fb, cx, cy, { blink = false, proud = false } = {}) {
  const s = cached(`big${blink}${proud}`, () => {
    const s = spr(110, 150), hx = 55, hy = 46;
    // neck: bluish skin with sparse dark feathers
    for (let y = hy + 12; y < 150; y++) { const w = 8 + (y - hy) * .1; for (let x = -w; x <= w; x++) {
      let c = x < -w * .4 ? C.dslate : x > w * .4 ? C.steel : C.slate;
      if (hash(x | 0, y) > (y > 100 ? .5 : .8)) c = y > 100 ? C.dbrown : C.umber; s.px(hx + x - (y - hy) * .12, y, c); } }
    // body shoulders at the bottom
    for (let y = 122; y < 150; y++) for (let x = -55; x <= 55; x++) { const e = (x * x) / 3025 + ((y - 150) ** 2) / 900;
      if (e > 1) continue; let c = (x * 2 + y) % 6 === 0 ? C.umber : y < 130 + hash(x, 1) * 4 ? C.brown : C.dbrown; s.px(hx + x, y, c); }
    // head: shaggy dark feathers
    for (let y = -24; y <= 22; y++) for (let x = -24; x <= 24; x++) {
      const e = (x * x) / 576 + (y * y) / 529, edge = hash(x + 99, y + 7) * .2;
      if (e > 1 - edge) continue;
      let c = C.umber; if ((x + y * 3 + 90) % 7 === 0) c = C.ink; if (y < -10 && hash(x, y) > .55) c = C.dbrown; if (x > 8 && y > -6) c = C.dslate;
      s.px(hx + x, hy + y, c);
    }
    // bluish face skin around the eye
    ell(s, hx - 2, hy - 1, 12, 9, C.slate); ell(s, hx - 4, hy - 3, 6, 4, C.steel);
    // the eye: big, amber-brown iris (emu eyes), pupil, highlight
    ell(s, hx - 3, hy - 2, 8, 8, C.uk);
    if (blink) { s.hline(hx - 10, hx + 4, hy - 2, C.dslate); s.hline(hx - 9, hx + 3, hy - 1, C.ink); }
    else { ell(s, hx - 3, hy - 2, 7, 7, C.clay); ell(s, hx - 3, hy - 2, 4, 4, C.ink); s.rect(hx - 6, hy - 6, 3, 3, C.white); s.px(hx, hy + 1, C.white);
      if (proud) s.hline(hx - 10, hx + 4, hy - 9, C.ink); }   // half-lid: unimpressed
    // beak: wide, flat, toward camera-right
    poly(s, [[hx + 6, hy + 6], [hx + 36, hy + 9], [hx + 38, hy + 13], [hx + 8, hy + 16]], C.tan);
    s.hline(hx + 8, hx + 36, hy + 12, C.brown); s.hline(hx + 9, hx + 30, hy + 7, C.sand); s.px(hx + 28, hy + 9, C.dbrown);
    // the rebel feather
    for (const [dx, h, c] of [[-6, 16, C.umber], [-2, 22, C.dbrown], [3, 14, C.umber]])
      for (let i = 0; i < h; i++) s.rect(hx + dx - i * .45 + Math.sin(i * .5) * 1.5, hy - 22 - i, 2, 1, i % 4 ? c : C.brown);
    return outline(s);
  });
  blitS(fb, s, cx - 55, cy - 46);
}

// ———————————————— People (side view, facing right) ————————————————
// kind: 'major' | 'soldier' | 'farmer' | 'minister' | 'historian'
export function person(kind, { f = 0, walk = false, crouch = false, bino = false, tap = false, point = false } = {}) {
  const fq = walk ? Math.floor(((f % 1) + 1) % 1 * 4) : 0;
  return cached(`p${kind}${fq}${walk}${crouch}${bino}${tap}${point}`, () => {
    const s = spr(22, 34);
    const P = { major: [C.kh, C.khD, C.khK], soldier: [C.kh, C.khD, C.khK], farmer: [C.sand, C.tan, C.brown],
      minister: [C.dslate, C.night, C.ink], historian: [C.steel, C.slate, C.dslate] }[kind];
    const pants = kind === 'farmer' ? [C.navy, C.navy] : kind === 'historian' ? [C.dslate, C.night] : [P[1], P[2]];
    const top = crouch ? 13 : 7, legY = top + 13;
    // legs
    const sw = walk ? [0, 2, 0, -2][fq] : 0;
    if (!crouch) { s.rect(8 + sw, legY, 3, 11, pants[0]); s.rect(11 - sw, legY, 3, 11, pants[1]);
      if (kind === 'major' || kind === 'soldier') { s.rect(8 + sw, legY + 7, 3, 4, C.khK); s.rect(11 - sw, legY + 7, 3, 4, C.khK); }   // puttees
      s.rect(7 + sw, legY + 11, 5, 2, C.ink); s.rect(11 - sw, legY + 11, 5, 2, C.ink); }
    else { s.rect(7, legY, 9, 4, pants[0]); s.rect(13, legY + 4, 4, 4, pants[1]); s.rect(6, legY + 4, 5, 3, pants[1]); s.rect(5, legY + 7, 6, 2, C.ink); }
    // torso
    s.rect(7, top + 5, 9, 9, P[0]); s.rect(7, top + 5, 2, 9, P[1]); s.hline(7, 15, top + 12, kind === 'farmer' ? C.brown : P[2]);
    if (kind === 'major' || kind === 'soldier') { s.px(12, top + 7, P[2]); s.px(12, top + 10, P[2]); }
    if (kind === 'farmer') { ell(s, 13, top + 8, 1, 1, C.steel); s.px(13, top + 6, C.blue); s.px(13, top + 7, C.blue); }   // war medal (generic)
    if (kind === 'minister') { s.vline(11, top + 5, top + 9, C.white); s.px(11, top + 6, C.crimson); }
    // arm
    if (bino) { s.rect(14, top + 6, 4, 2, P[1]); s.rect(16, top + 1, 4, 4, C.ink); s.px(19, top + 2, C.steel); }
    else if (tap) { s.rect(14, top + 6, 7, 2, P[1]); s.rect(20, top + 7, 2, 2, C.skin); }
    else if (point) { s.rect(14, top + 6, 6, 2, P[1]); s.px(20, top + 6, C.skin); }
    else { s.rect(10, top + 6, 3, 7, P[1]); s.rect(10, top + 13, 3, 2, C.skin); }
    // head
    s.rect(9, top, 6, 6, C.skin); s.rect(9, top + 4, 2, 2, C.skinS); s.px(13, top + 2, C.ink);
    if (kind === 'major') { s.hline(12, 15, top + 4, C.dbrown); }   // moustache
    if (kind === 'historian') { s.hline(11, 15, top + 2, C.ink); s.px(12, top + 2, C.skyL); s.px(14, top + 2, C.skyL); s.vline(9, top, top + 2, C.silver); s.hline(10, 11, top - 1, C.silver); }
    // hats
    if (kind === 'major') { s.rect(8, top - 2, 7, 3, P[0]); s.hline(12, 17, top + 1, C.khK); s.hline(8, 14, top, C.crimson); }
    if (kind === 'soldier') { s.rect(8, top - 2, 7, 3, P[0]); s.hline(13, 17, top + 1, P[2]); }
    if (kind === 'farmer') { s.rect(9, top - 3, 6, 3, C.brown); s.hline(5, 19, top, C.dbrown); }
    if (kind === 'minister') { s.rect(9, top - 1, 6, 2, C.ink); }
    return outline(s);
  });
}

// ———————————————— Props ————————————————
// Lewis-type machine gun, side view (generic): barrel shroud, flat drum on top, stock, bipod
export function gun(fb, x, y, k = 1, { flash = 0 } = {}) {
  const s = cached('gun', () => {
    const s = spr(34, 12);
    s.rect(0, 5, 9, 3, C.dbrown); s.rect(0, 7, 4, 2, C.dbrown);            // stock
    s.rect(9, 4, 8, 4, C.dslate); s.rect(11, 8, 2, 3, C.ink);              // receiver + grip
    s.rect(17, 4, 12, 4, C.slate); for (let i = 18; i < 29; i += 2) s.px(i, 4, C.steel);   // finned shroud
    s.rect(29, 5, 5, 2, C.dslate);                                         // barrel
    s.rect(10, 1, 9, 3, C.dslate); s.hline(11, 17, 1, C.steel);            // flat drum magazine
    s.line(26, 8, 23, 11, C.ink); s.line(27, 8, 30, 11, C.ink);            // bipod
    return outline(s);
  });
  blitS(fb, s, x, y, k);
  if (flash) { const fx = x + 35 * k, fy = y + 6 * k;
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + flash; fb.rect(fx + Math.cos(a) * 3 * k, fy + Math.sin(a) * 2 * k, k, k, C.yellow); }
    fb.rect(fx - k, fy - k, 3 * k, 2 * k, C.amber); fb.rect(fx, fy - k, 2 * k, k, C.white); }
}
// 1930s army lorry, side view facing right; f = wheel frame; mg = machine gun on the bed
export function truck(fb, x, y, { f = 0, mg = false, flip = false, bounce = 0 } = {}) {
  const fq = Math.floor(((f % 1) + 1) % 1 * 2);
  const s = cached(`truck${fq}${mg}`, () => {
    const s = spr(70, 36);
    s.rect(2, 12, 40, 12, C.kh); s.rect(2, 12, 40, 2, C.khD); for (let i = 4; i < 42; i += 6) s.vline(i, 14, 23, C.khD);   // bed
    s.rect(2, 8, 2, 4, C.khD); s.rect(40, 8, 2, 4, C.khD); s.hline(2, 41, 8, C.khD);   // rails
    s.rect(42, 6, 13, 18, C.kh); s.rect(44, 8, 8, 6, C.skyL); s.px(45, 9, C.white); s.rect(42, 6, 13, 2, C.khD);   // cab + window
    s.rect(55, 13, 12, 11, C.kh); s.rect(55, 13, 12, 2, C.khD); for (let i = 57; i < 66; i += 2) s.vline(i, 16, 21, C.khK);   // bonnet + grille slats
    s.rect(66, 15, 2, 7, C.steel); s.rect(64, 13, 3, 3, C.yellow);   // radiator, lamp
    s.rect(0, 23, 69, 3, C.khK);                                     // chassis
    for (const wx of [12, 57]) { ell(s, wx, 27, 6, 6, C.ink); ell(s, wx, 27, 3, 3, C.steel);
      if (fq) { s.px(wx - 2, 27, C.ink); s.px(wx + 2, 27, C.ink); } else { s.px(wx, 25, C.ink); s.px(wx, 29, C.ink); } }
    if (mg) { const g = spr(34, 12); gun(g, 0, 0); for (let yy = 0; yy < 12; yy++) for (let xx = 0; xx < 34; xx++) { const c = g.d[yy * 34 + xx]; if (c !== T) s.px(10 + xx, yy - 2, c); } s.rect(24, 9, 2, 4, C.ink); }
    return outline(s);
  });
  blitS(fb, s, x, y + bounce, 1, flip);
}
export function crate(fb, x, y) {
  fb.rect(x, y, 26, 16, C.brown); fb.rect(x, y, 26, 2, C.tan); fb.rect(x + 1, y + 15, 25, 1, C.dbrown);
  for (const yy of [y + 5, y + 10]) fb.hline(x, x + 25, yy, C.dbrown);
  fb.rect(x + 8, y + 4, 10, 7, C.sand);
  for (let i = 0; i < 4; i++) { fb.rect(x + 9 + i * 2, y + 6, 1, 4, C.amber); fb.px(x + 9 + i * 2, y + 5, C.clay); }   // stencilled rounds
  for (let i = 0; i < 26; i++) { fb.px(x + i, y - 1, C.ink); fb.px(x + i, y + 16, C.ink); } fb.vline(x - 1, y, y + 15, C.ink); fb.vline(x + 26, y, y + 15, C.ink);
}

// ———————————————— Backgrounds ————————————————
export function sky(fb, y0, y1, ox = 0, warm = false) {
  fb.gradV(0, y0, W, y1 - y0, warm ? [C.plum, C.rose, C.pink, C.orange, C.amber] : [C.sky, C.sky, C.skyL, C.skyL, C.white]);
  if (!warm) for (const [cx, cy, r] of [[30, 30, 9], [130, 55, 12], [80, 20, 7]]) {   // a few pixel clouds
    const X = ((cx - ox * .2) % (W + 40) + W + 40) % (W + 40) - 20;
    ell(fb, X, y0 + cy, r * 1.6, r * .7, C.white); ell(fb, X + r, y0 + cy - 3, r, r * .6, C.white); fb.hline(X - r * 1.5, X + r * 1.8, y0 + cy + r * .5, C.silver);
  }
}
export function sun(fb, x, y, r, c = C.yellow) { ell(fb, x, y, r, r, c); ell(fb, x - r * .3, y - r * .3, r * .5, r * .5, C.white); }
// golden wheat from y0 to y1; t sways the ears; ox scrolls
export function wheat(fb, y0, y1, t = 0, ox = 0) {
  fb.gradV(0, y0, W, y1 - y0, [C.amber, C.tan, C.amber, C.clay]);
  for (let y = y0; y < y1; y += 3) { const depth = (y - y0) / (y1 - y0), step = 2 + Math.floor(depth * 3);
    for (let x = -4; x < W + 4; x += step) { const X = Math.round(x - ox * (.5 + depth) % step + Math.sin(t * 2 + x * .1 + y * .05) * (1 + depth));
      fb.px(X, y, C.yellow); if (depth > .3) { fb.px(X, y + 1, C.amber); fb.px(X + 1, y - 1, C.yellow); } if (depth > .6) fb.px(X, y + 2, C.clay); } }
}
export function earth(fb, y0, y1, ox = 0) {
  fb.gradV(0, y0, W, y1 - y0, [C.clay, C.rust, C.rust, C.dbrown]);
  for (let i = 0; i < 90; i++) { const x = ((hash(i, 1) * W * 2 - ox) % W + W) % W, y = y0 + hash(i, 2) * (y1 - y0); fb.px(x, y, hash(i, 3) > .5 ? C.tan : C.dbrown); }
}
// eucalyptus: pale trunk, grey-green clumps
export function gum(fb, x, y, h, f = 0) {
  fb.rect(x - 1, y - h, 3, h, C.silver); fb.vline(x - 1, y - h, y, C.steel); fb.line(x, y - h * .6, x + 6, y - h * .85, C.silver);
  for (const [dx, dy, r] of [[-6, -h, 7], [5, -h - 3, 8], [8, -h * .85, 6], [-2, -h - 8, 6]]) {
    ell(fb, x + dx + Math.sin(f + dx) * .6, y + dy, r, r * .7, (X, Y, ddx, ddy) => ddy < -r * .2 ? C.euc : bayer(X, Y) > .5 ? C.eucD : C.euc);
  }
}
export function farmhouse(fb, x, y) {
  fb.rect(x, y - 18, 36, 18, C.silver); for (let i = 0; i < 36; i += 3) fb.vline(x + i, y - 18, y - 1, C.steel);   // corrugated iron
  poly(fb, [[x - 4, y - 18], [x + 18, y - 30], [x + 40, y - 18]], C.steel); fb.hline(x - 4, x + 40, y - 18, C.slate);
  fb.rect(x + 6, y - 12, 7, 12, C.dbrown); fb.rect(x + 22, y - 13, 8, 6, C.navy); fb.px(x + 23, y - 12, C.skyL);
  fb.rect(x + 30, y - 34, 3, 6, C.rust);
}
export function fence(fb, y, ox = 0) {
  for (let x = -((ox % 14) + 14) % 14; x < W; x += 14) { fb.rect(x, y - 10, 2, 11, C.dbrown); }
  fb.hline(0, W, y - 8, C.brown); fb.hline(0, W, y - 4, C.brown);
}
// Australia (simplified outline) in lon/lat → fb via a projection {cx, cy, s}: s pixels per degree
const AUS = [[114, -22], [113.5, -26], [115, -34], [117.5, -35], [124, -33.5], [129, -31.5], [131.5, -31.5], [135.5, -34.8], [137.5, -33], [138.5, -35.5], [140.5, -38], [144, -38.5],
  [146.5, -39], [150, -37.5], [153, -31], [153.5, -28], [153, -25], [149, -21], [146, -18.5], [145.3, -15], [142.5, -10.7], [141.5, -13.5], [141.5, -17], [140, -17.5], [137, -16],
  [136.5, -12.5], [132.5, -11.5], [130, -13], [129.5, -15], [126, -14], [122, -17.5], [121, -19.5], [117, -20.7]];
const TAS = [[144.6, -40.7], [148.3, -40.9], [148, -43.2], [146, -43.6]];
export const CAMPION = [118.3, -31.1];
export function ausMap(fb, P) {
  const pr = ([lo, la]) => [P.cx + (lo - P.lo) * P.s, P.cy - (la - P.la) * P.s];
  for (const shape of [AUS, TAS]) {
    poly(fb, shape.map(p => { const [x, y] = pr(p); return [x + 2, y + 3]; }), C.navy);    // drop shadow on the sea
    poly(fb, shape.map(pr), (x, y) => bayer(x, y) < .15 ? C.clay : C.rust);
    for (let i = 0; i < shape.length; i++) { const [a, b] = [pr(shape[i]), pr(shape[(i + 1) % shape.length])]; fb.line(a[0], a[1], b[0], b[1], C.dbrown); }
  }
  // the wheatbelt in the south-west, golden
  poly(fb, [[116, -29], [119.5, -30], [119.5, -33.5], [117, -34], [116, -32]].map(pr), (x, y) => bayer(x, y) < .5 ? C.amber : C.yellow);
  return pr;
}
export function tank(fb, x, y, c) {   // generic tank silhouette, one colour
  poly(fb, [[x, y + 20], [x + 8, y + 30], [x + 62, y + 30], [x + 70, y + 20]], c);
  fb.rect(x + 10, y + 8, 46, 12, c); fb.rect(x + 22, y, 22, 9, c); fb.rect(x + 44, y + 3, 32, 3, c);
}
