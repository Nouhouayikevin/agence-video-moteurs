// Essai « décor en voxel » (Kev, 2026-11-09) : 10 s, une place de village au soleil de fin d'après-midi.
// Tout le décor est en petits cubes de 10 cm (arbres, palmiers, maisons, toits, fontaine, pavés, bancs, lampadaires, étal) ;
// les robots sont nos personnages voxel habituels (voxel.js). Moteurs repris de L003 (hd/, px.js, art.js, voxel.js).
import * as THREE from 'three';
import { makePost } from './hd/post_ts.js';
import { PX, texOf, billboard, glow, h2, fbm } from './hd/px.js';
import { sky, particles } from './hd/fx.js';
import { RGB, T as TR } from './px.js';
import { robot } from './art.js';
import { voxelFacer } from './voxel.js';

const W = 1920, H = 1080, DUR = 10, S = 0.1, PPM = 22;   // S = taille d'un cube du décor (m)
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('stage').appendChild(renderer.domElement);
const camera = new THREE.PerspectiveCamera(38, W / H, .1, 3000);
const scene = new THREE.Scene();

// ———————— le moteur voxel du décor ————————
const hex = c => parseInt(c.slice(1), 16);
const jit = (c, a, s) => { const k = 1 + (s - .5) * a; let r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255; r = Math.min(255, r * k); g = Math.min(255, g * k); b = Math.min(255, b * k); return (r << 16) | (g << 8) | b; };
const pick = (cols, v) => hex(cols[Math.max(0, Math.min(cols.length - 1, Math.floor(v * cols.length)))]);
class Grid {
  constructor() { this.m = new Map(); }
  static k(x, y, z) { return ((x + 1024) * 2048 + (y + 1024)) * 2048 + (z + 1024); }
  set(x, y, z, c) { this.m.set(Grid.k(x, y, z), [x, y, z, c]); }
  del(x, y, z) { this.m.delete(Grid.k(x, y, z)); }
  has(x, y, z) { return this.m.has(Grid.k(x, y, z)); }
}
const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const QUAD = [[-.5, -.5], [.5, -.5], [.5, .5], [-.5, .5]];
// one mesh per grid: only the faces that touch air; each face darkens with the cubes around it (corners and crevices read as volume)
function build(g, { size = S, unlit = false, bottom = false, ox = 0, oy = 0, oz = 0 } = {}) {
  const pos = [], nor = [], col = [], c3 = new THREE.Color();
  for (const [x, y, z, c] of g.m.values()) for (const d of DIRS) {
    if (!bottom && d[1] < 0) continue;
    if (g.has(x + d[0], y + d[1], z + d[2])) continue;
    const a = d[0] ? 0 : d[1] ? 1 : 2, s = d[a], u = (a + 1) % 3, v = (a + 2) % 3;
    let occ = 0; for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const p = [x + d[0], y + d[1], z + d[2]]; p[u] += du; p[v] += dv; if (g.has(...p)) occ++; }
    const sh = (1 - .11 * occ) * (a === 1 ? 1 : a === 0 ? .93 : .97);
    c3.setRGB(((c >> 16) & 255) / 255 * sh, ((c >> 8) & 255) / 255 * sh, (c & 255) / 255 * sh, THREE.SRGBColorSpace);
    const q = s > 0 ? QUAD : [...QUAD].reverse(), P = q.map(([cu, cv]) => { const p = [x + .5, y + .5, z + .5]; p[a] += .5 * s; p[u] += cu; p[v] += cv; return p; });
    for (const i of [0, 1, 2, 0, 2, 3]) { pos.push(P[i][0] * size + ox, P[i][1] * size + oy, P[i][2] * size + oz); nor.push(...d); col.push(c3.r, c3.g, c3.b); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const m = new THREE.Mesh(geo, unlit ? new THREE.MeshBasicMaterial({ vertexColors: true, fog: true }) : new THREE.MeshLambertMaterial({ vertexColors: true }));
  m.castShadow = !unlit; m.receiveShadow = !unlit; return m;
}

// ———————— palettes ————————
const GREEN = ['#24481f', '#2f5c27', '#3f7630', '#55913a', '#74ad46', '#9ccb5a'];
const BLOSSOM = ['#c25a7c', '#e07a9a', '#f29ab4', '#fbc4d4', '#fff0f4'];
const BARK = ['#3c2618', '#4e321f', '#634028', '#7a5232'];
const PALMBARK = ['#6e5236', '#8a6a46', '#a5845a', '#c0a070'];
const STONE = ['#76747c', '#8a8890', '#9e9ca2', '#b4b2b4', '#c8c4c0'];
const COBBLE = ['#8e8070', '#a29280', '#b4a48e', '#c6b8a0', '#988a7a'];
const GRASS = ['#3d6e2c', '#4a8034', '#57903a', '#66a042', '#78b04c'];
const TILE = ['#8e3424', '#a8432f', '#bc5538', '#cc6844'], SLATE = ['#3c4a66', '#4a5a78', '#5c6c8a', '#6e7e9a'];
const PLASTER = ['#e2d0b2', '#ecdcc0', '#f4e8d0'], TIMBER = ['#4a2e1e', '#583826'], BRICK = ['#8c3a2e', '#a4483a', '#b45a44', '#9a4232'];
const WOOD = ['#5a3a24', '#6e4a2e', '#86603a', '#9c7448'];
const FLOWERS = ['#e43b44', '#f77622', '#feae34', '#fee761', '#c45cd8', '#ffffff', '#f6757a'];

const statics = new Grid(), glowG = new Grid();   // glowG: lit windows and lanterns (no lighting: they shine)
const sway = [];   // tree crowns that move in the wind
// —— the ground: plaza of cobbles (stones raised, mortar sunk), grass with tufts and flowers, a dirt path ——
const PLAZA_R = 64;
for (let x = -230; x < 230; x++) for (let z = -200; z < 130; z++) {
  const r = Math.hypot(x, z + 8), n = fbm(x * .05, z * .05, 3);
  const path = Math.abs(x - 6 - Math.sin(z * .04) * 8) < 9 && z > 40;
  if (r < PLAZA_R || path) {
    const row = Math.floor(z / 3), off = row % 2 ? 2 : 0, mortar = (x + off) % 5 === 0 || z % 3 === 0;
    const sid = h2(Math.floor((x + off) / 5), row, 7);
    if (path && r >= PLAZA_R) statics.set(x, -1, z, jit(pick(['#7a5c3e', '#8a6a48', '#9a7a54'], h2(x, z, 2)), .12, h2(x, z, 9)));
    else if (mortar) statics.set(x, -2, z, jit(hex('#5e564c'), .1, h2(x, z, 3)));
    else statics.set(x, -1, z, jit(pick(COBBLE, sid * .7 + n * .3), .08, h2(x, z, 4)));
    if (mortar && r < PLAZA_R) statics.set(x, -2, z, jit(hex('#5e564c'), .1, h2(x, z, 3)));
  } else {
    statics.set(x, -1, z, jit(pick(GRASS, n * .8 + h2(x, z, 1) * .3), .1, h2(x, z, 5)));
    const hh = h2(x, z, 11);
    if (hh > .93) statics.set(x, 0, z, jit(pick(GRASS, .6 + h2(x, z, 12) * .4), .15, h2(x, z, 13)));                  // tufts
    if (hh > .988) statics.set(x, 1, z, jit(pick(GRASS, .9), .1, h2(x, z, 14)));
    if (hh > .962 && hh < .967 && r > PLAZA_R + 6) { statics.set(x, 0, z, hex('#3f7630')); statics.set(x, 1, z, hex(FLOWERS[Math.floor(h2(x, z, 15) * FLOWERS.length)])); }   // flowers on stems
  }
}
// —— the fountain: stone basin with a cap, a pillar, an upper bowl ——
const FZ = -8;
for (let x = -26; x <= 26; x++) for (let z = -26; z <= 26; z++) {
  const r = Math.hypot(x, z);
  if (r <= 25 && r > 21) for (let y = 0; y < 6; y++) statics.set(x, y, z + FZ, jit(pick(STONE, .2 + (y / 6) * .5 + h2(x, y, z) * .2), .06, h2(x, z, y)));
  if (r <= 26 && r > 20.5) statics.set(x, 6, z + FZ, jit(pick(STONE, .8), .05, h2(x, z, 6)));     // cap stone, overhanging
  if (r <= 21) statics.set(x, 0, z + FZ, jit(hex('#4a5a6a'), .1, h2(x, z, 1)));                     // basin floor
  if (r <= 3.2) for (let y = 1; y < 19; y++) statics.set(x, y, z + FZ, jit(pick(STONE, .3 + (y % 4 === 0 ? .4 : 0)), .05, h2(x, y, z)));
  if (r <= 10 && r > 7.5) for (let y = 19; y < 21; y++) statics.set(x, y, z + FZ, jit(pick(STONE, .55), .05, h2(x, y, z)));
  if (r <= 10.5 && r > 2) statics.set(x, 18, z + FZ, jit(pick(STONE, .4), .05, h2(x, z, 18)));
  if (r <= 2.2) for (let y = 21; y < 25; y++) if (Math.hypot(x, y - 23) < 2.4) statics.set(x, y, z + FZ, jit(pick(STONE, .9), .04, h2(x, y, z)));
}
// —— houses: half-timbered or brick, stone base, recessed windows with frames, shutters, flower boxes, door with step, gable roofs, chimneys ——
const smokeAt = [];
function house(x0, z0, w, d, h, { kind = 'timber', roof = TILE, shutter = '#3a7a6a', lit = [], shop = false, seed = 1 } = {}) {
  const front = z0 + d - 1, floorY = Math.floor(h / 2);
  const wall = (x, y, z) => {
    if (y < 4) return jit(pick(STONE, .2 + h2(x >> 1, y, z >> 1) * .6), .06, h2(x, y, z));
    if (kind === 'brick') { const row = y >> 1, off = row % 2 ? 2 : 0, m = y % 2 === 0 || ((x + z + off) % 4 === 0); return m ? jit(hex('#b8aa98'), .05, h2(x, y, z)) : jit(pick(BRICK, h2((x + z + off) >> 2, row, seed)), .08, h2(x, y, z)); }
    const lx = x - x0, lz = z - z0, edge = lx === 0 || lx === w - 1 || lz === 0 || lz === d - 1, corner = (lx === 0 || lx === w - 1) && (lz === 0 || lz === d - 1);
    const along = lz === 0 || lz === d - 1 ? lx : lz, beam = corner || y === floorY || y === floorY + 1 || y === h - 1 || y === 4 || along % 12 === 0 || (along % 12 === (y - 4) % 12 && y < floorY && along % 24 < 12);
    return beam && edge ? jit(pick(TIMBER, h2(x, y, z)), .08, h2(x, z, y)) : jit(pick(PLASTER, h2(x >> 1, y >> 1, z) * .9), .04, h2(x, y, z));
  };
  for (let y = 0; y < h; y++) for (let x = x0; x < x0 + w; x++) for (let z = z0; z < z0 + d; z++)
    if (x === x0 || x === x0 + w - 1 || z === z0 || z === z0 + d - 1) statics.set(x, y, z, wall(x, y, z));
  // windows on the front: 2 floors
  const cols = Math.max(2, Math.floor((w - 8) / 12)), gap = (w - cols * 7) / (cols + 1);
  for (let fl = 0; fl < 2; fl++) for (let i = 0; i < cols; i++) {
    const wx = Math.round(x0 + gap + i * (7 + gap)), wy = fl ? floorY + 4 : 7, ww = 7, wh = fl ? 9 : 10;
    if (!fl && shop && i === Math.floor(cols / 2)) continue;   // the door goes there
    const on = lit.includes(fl * 10 + i);
    for (let x = wx; x < wx + ww; x++) for (let y = wy; y < wy + wh; y++) {
      statics.del(x, y, front);
      const frame = x === wx || x === wx + ww - 1 || y === wy || y === wy + wh - 1 || x === wx + 3 || y === wy + Math.floor(wh / 2);
      if (frame) statics.set(x, y, front - 1, jit(hex('#f0ece0'), .04, h2(x, y, 1)));
      else if (on) glowG.set(x, y, front - 1, jit(hex('#ffd27a'), .1, h2(x, y, 2)));
      else statics.set(x, y, front - 1, jit(pick(['#2c4a66', '#3c6488', '#5a86a8', '#8ab8d4'], (y - wy) / wh * .7 + h2(x, y, 3) * .3), .05, h2(x, y, 4)));
    }
    for (let x = wx - 1; x <= wx + ww; x++) { statics.set(x, wy - 1, front + 1, jit(hex('#d8d0c0'), .04, h2(x, 1, 1))); statics.set(x, wy + wh, front + 1, jit(pick(TIMBER, .5), .05, h2(x, 2, 2))); }   // sill and lintel
    for (const sx of [wx - 3, wx + ww]) for (let x = sx; x < sx + 3; x++) for (let y = wy; y < wy + wh; y++) statics.set(x, y, front + 1, jit(hex(shutter), y % 2 ? .04 : .2, h2(x, y, 7)));   // shutters, slatted
    if (fl || !shop) for (let x = wx; x < wx + ww; x++) { statics.set(x, wy - 2, front + 2, jit(pick(WOOD, .5), .06, h2(x, 5, 5))); statics.set(x, wy - 2, front + 1, jit(pick(WOOD, .3), .06, h2(x, 6, 5)));
      if (h2(x, wy, seed) > .3) { statics.set(x, wy - 1, front + 2, jit(hex('#3f7630'), .15, h2(x, 7, 7))); if (h2(x, wy, seed + 1) > .45) statics.set(x, wy, front + 2, hex(FLOWERS[Math.floor(h2(x, wy, seed + 2) * FLOWERS.length)])); } }   // flower box
  }
  // the door, with panels, a stone step and a little lantern
  const dx = Math.round(x0 + w / 2 - 3);
  for (let x = dx; x < dx + 6; x++) for (let y = 0; y < 14; y++) { statics.del(x, y, front); const pnl = (x === dx + 1 || x === dx + 4) && y > 1 && y < 12 && y !== 7; statics.set(x, y, front - 1, jit(pick(WOOD, pnl ? .2 : .6), .06, h2(x, y, 8))); }
  for (let x = dx - 1; x <= dx + 6; x++) { statics.set(x, 14, front + 1, jit(pick(TIMBER, .5), .05, 1)); for (let z = front + 1; z <= front + 2; z++) statics.set(x, -1, z, jit(pick(STONE, .7), .05, h2(x, z, 9))), statics.set(x, 0, z, jit(pick(STONE, .8), .05, h2(x, z, 10))); }
  statics.set(dx + 7, 12, front + 1, hex('#22202a')); glowG.set(dx + 7, 11, front + 1, hex('#ffcf6a')); glowG.set(dx + 7, 10, front + 1, hex('#ffb84a'));
  if (shop) {   // striped awning over the shop window and a hanging sign with a loaf of bread
    for (let x = x0 + 2; x < x0 + w - 2; x++) for (let k = 0; k < 6; k++) statics.set(x, 17 - k, front + 1 + k, hex(Math.floor((x - x0) / 3) % 2 ? '#f4efe4' : '#c8323c'));
    for (let y = 22; y < 28; y++) for (let x = x0 + w - 9; x < x0 + w - 2; x++) statics.set(x, y, front + 2, (x === x0 + w - 9 || x === x0 + w - 3 || y === 22 || y === 27) ? hex('#4a2e1e') : (Math.abs(x - (x0 + w - 6)) < 2 && y > 23 && y < 26) ? hex('#d08a3a') : hex('#efe2c4'));
  }
  // gable roof, ridge along x, 2-cube overhang, tiles in rows, a darker ridge, end walls
  const R = Math.ceil(d / 2) + 1;
  for (let i = 0; i <= R; i++) for (let x = x0 - 2; x < x0 + w + 2; x++) {
    const y = h + i, za = z0 - 2 + i, zb = z0 + d + 1 - i, c = (z, s) => jit(pick(roof, i === R ? 0 : (i % 2 ? .45 : .75) + h2(x, z, s) * .25), .1, h2(x, y, z));
    if (za > zb) continue;
    statics.set(x, y, za, c(za, 1)); statics.set(x, y, zb, c(zb, 2)); if (i === R) for (let z = za; z <= zb; z++) statics.set(x, y + 1, z, jit(pick(roof, 0), .06, h2(x, z, 3)));
    if (x === x0 - 2 || x === x0 + w + 1) { statics.set(x, y - 1, za, jit(pick(roof, 0), .05, 1)); statics.set(x, y - 1, zb, jit(pick(roof, 0), .05, 1)); }   // bargeboards
    if (x === x0 || x === x0 + w - 1) for (let z = za + 1; z < zb; z++) statics.set(x, y, z, wall(x, y, z));
  }
  const cx = x0 + Math.round(w * .72), cz = z0 + Math.round(d * .3), top = h + R + 6;
  for (let y = h; y < top; y++) for (let x = cx; x < cx + 4; x++) for (let z = cz; z < cz + 4; z++) statics.set(x, y, z, y > top - 2 ? hex('#3a3236') : jit(pick(BRICK, h2(x + z, y >> 1, 4)), .08, h2(x, y, z)));
  smokeAt.push([(cx + 2) * S, top * S, (cz + 2) * S]);
}
house(-150, -150, 58, 44, 44, { kind: 'timber', lit: [1, 10], seed: 1 });
house(-86, -150, 52, 42, 40, { kind: 'brick', roof: SLATE, shutter: '#a8483a', shop: true, seed: 2, lit: [11] });
house(-28, -152, 60, 44, 48, { kind: 'timber', shutter: '#3a5a9a', seed: 3, lit: [0, 12] });
house(38, -150, 50, 42, 38, { kind: 'brick', shutter: '#2f6a4a', seed: 4 });
house(96, -148, 60, 44, 44, { kind: 'timber', roof: SLATE, shutter: '#8a3a5a', shop: true, seed: 5, lit: [10, 12] });

// —— trees: oak and blossom tree (trunk with roots and branches, a crown of noisy blobs), palm (ringed curved trunk, drooping fronds, coconuts) ——
function tree(x0, z0, seed, cols = GREEN, sc = 1) {
  const trunk = new Grid(), crown = new Grid(), Ht = Math.round((30 + h2(seed, 1) * 10) * sc);
  for (let y = -1; y < Ht; y++) { const lean = Math.round(Math.sin(y * .08 + seed) * 1.5), r = y < 3 ? 3 - y * .3 : y < Ht * .6 ? 1.9 : 1.4;
    for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) if (Math.hypot(x, z) <= r) trunk.set(x + lean, y, z, jit(pick(BARK, ((x + z + y * 2) % 5 + 5) % 5 / 5 * .7 + h2(x, y, z) * .3), .1, h2(x, y, z + seed))); }
  for (let k = 0; k < 4; k++) { const a = k * 1.7 + seed, y0 = Math.round(Ht * (.55 + k * .08)); for (let s = 0; s < 9 * sc; s++) trunk.set(Math.round(Math.cos(a) * s), y0 + Math.round(s * .7), Math.round(Math.sin(a) * s), jit(pick(BARK, .5), .1, h2(k, s, seed))); }
  const blobs = [[0, Ht + 6 * sc, 0, 12 * sc]]; for (let i = 0; i < 5; i++) blobs.push([Math.cos(i * 1.26 + seed) * 9 * sc, Ht + (2 + h2(i, seed) * 6) * sc, Math.sin(i * 1.26 + seed) * 8 * sc, (7.5 + h2(seed, i) * 3) * sc]);
  const R = 24 * sc;
  for (let x = -R; x <= R; x++) for (let y = Ht - 8 * sc; y <= Ht + 20 * sc; y++) for (let z = -R; z <= R; z++) {
    let f = -1; for (const [bx, by, bz, br] of blobs) f = Math.max(f, 1 - Math.hypot(x - bx, (y - by) * 1.1, z - bz) / br);
    f += (fbm(x * .18 + seed, y * .18, 2) - .5) * .5 + (fbm(z * .18, y * .18 + seed, 2) - .5) * .3;
    if (f > 0) { const v = (y - (Ht - 4 * sc)) / (24 * sc) * .7 + f * .4 + h2(x, y, z) * .15; crown.set(Math.round(x), Math.round(y), Math.round(z), jit(pick(cols, v), .1, h2(x, z, y)));
      if (cols === GREEN && h2(x, y, z + 7) > .995 && f < .15) crown.set(Math.round(x), Math.round(y), Math.round(z), hex('#d8302e')); }   // a few apples on the outside
  }
  const t = build(trunk, { ox: x0 * S, oz: z0 * S }); scene.add(t);
  const g = new THREE.Group(); g.position.set(x0 * S, Ht * S, z0 * S); const c = build(crown, { oy: -Ht * S }); g.add(c); scene.add(g); sway.push([g, seed]);
  if (cols === BLOSSOM) for (let i = 0; i < 40; i++) statics.set(x0 + Math.round((h2(i, seed) - .5) * 40), -0 , z0 + Math.round((h2(seed, i) - .5) * 30), hex(BLOSSOM[2 + (i % 3)]));   // petals on the grass
}
function palm(x0, z0, seed, bend = 1) {
  const g = new Grid(), L = 52 + Math.round(h2(seed, 2) * 10); let tx = 0, tz = 0;
  for (let y = -1; y < L; y++) { const k = y / L; tx = Math.round(bend * 9 * k * k); tz = Math.round(bend * -3 * k * k); const r = y < 3 ? 2.6 : 1.8 - k * .4;
    for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) if (Math.hypot(x, z) <= r) g.set(x + tx, y, z + tz, jit(pick(PALMBARK, y % 4 === 0 ? 0 : .35 + (x + 2) / 8 + h2(x, y, z) * .2), .08, h2(x, y, z + seed))); }
  const top = [tx, L, tz];
  for (const [a, b] of [[1, 0], [-1, 1], [0, -1]]) for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) for (let z = 0; z < 2; z++) g.set(top[0] + a + x, top[1] - 3 + y, top[2] + b + z, jit(hex('#5a3a1e'), .15, h2(a, b, x + y + z)));   // coconuts
  const crown = new Grid(), N = 9;
  for (let f = 0; f < N; f++) { const ang = f / N * Math.PI * 2 + seed, len = 24 + h2(f, seed) * 8, dx = Math.cos(ang), dz = Math.sin(ang), px = -dz, pz = dx, lift = 5 + h2(seed, f) * 4;
    for (let s = 0; s <= len; s++) { const t = s / len, y = lift * t * 2 - (lift + 12) * t * t, wv = Math.round(5 * Math.sin(Math.PI * Math.min(1, t * 1.15)));
      for (let j = -wv; j <= wv; j++) { if (j && (s + Math.abs(j)) % 3 === 0 && Math.abs(j) > 1) continue;   // gaps between leaflets
        const X = Math.round(dx * s + px * j * .8), Z = Math.round(dz * s + pz * j * .8), Y = Math.round(y - Math.abs(j) * .45);
        crown.set(X, Y, Z, jit(pick(GREEN, j === 0 ? .15 : .45 + (1 - t) * .35 - Math.abs(j) * .04), .1, h2(X, Y, Z))); } } }
  scene.add(build(g, { ox: x0 * S, oz: z0 * S }));
  const G = new THREE.Group(); G.position.set((x0 + top[0]) * S, top[1] * S, (z0 + top[2]) * S); G.add(build(crown)); scene.add(G); sway.push([G, seed + 10]);
}
tree(-125, -60, 1); tree(-150, 20, 2, BLOSSOM, .9); tree(128, -50, 3); tree(150, 40, 4, GREEN, 1.15); tree(-95, 60, 5, GREEN, .8);
palm(95, 30, 6, 1); palm(112, 58, 7, -.8); palm(-118, 50, 8, .7);
// hedges along the houses
for (let x = -160; x < 160; x++) for (let z = -103; z < -98; z++) for (let y = 0; y < 5; y++) { const v = fbm(x * .3, y * .3 + z * .3, 2); if (y < 4 || v > .55) if (Math.abs(x - (-60)) > 8 && Math.abs(x - 12) > 8 && Math.abs(x - 122) > 8 && Math.abs(x + 124) > 8) statics.set(x, y, z, jit(pick(GREEN, .2 + v * .5 + y * .08), .1, h2(x, y, z))); }
// —— street furniture: lamp posts, benches, barrels, crates, a fruit stall, a notice board, a picket fence ——
const lamps = [];
function lamp(x, z) {
  for (let y = 0; y < 2; y++) for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) statics.set(x + a, y, z + b, hex('#2a2a34'));
  for (let y = 2; y < 30; y++) statics.set(x, y, z, hex(y % 7 === 0 ? '#44445a' : '#2a2a34'));
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { statics.set(x + a, 30, z + b, hex('#2a2a34')); statics.set(x + a, 35, z + b, hex('#2a2a34')); for (let y = 31; y < 35; y++) (a && b) ? statics.set(x + a, y, z + b, hex('#2a2a34')) : glowG.set(x + a, y, z + b, hex(a || b ? '#ffd890' : '#fff4c8')); }
  statics.set(x, 36, z, hex('#2a2a34')); lamps.push([x * S, 33 * S, z * S]);
}
lamp(-40, 30); lamp(52, 30); lamp(-70, -60); lamp(70, -64);
function bench(x0, z0, rot = 0) {
  const put = (a, y, b, c) => rot ? statics.set(x0 + b, y, z0 + a, c) : statics.set(x0 + a, y, z0 + b, c);
  for (let a = 0; a < 16; a++) { for (let b = 0; b < 4; b++) if (b !== 2) put(a, 4, b, jit(pick(WOOD, .6), .08, h2(a, b, 1))); for (const y of [6, 8]) put(a, y, 4, jit(pick(WOOD, .55), .08, h2(a, y, 2))); }
  for (const a of [1, 14]) { for (let y = 0; y < 4; y++) { put(a, y, 0, hex('#2a2a34')); put(a, y, 3, hex('#2a2a34')); } for (let y = 4; y < 9; y++) put(a, y, 5, hex('#2a2a34')); put(a, 3, 1, hex('#2a2a34')); put(a, 3, 2, hex('#2a2a34')); }
}
bench(-22, 26); bench(14, 30); bench(-56, -30, 1);
function barrel(x0, z0) { for (let y = 0; y < 9; y++) for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) { const r = Math.hypot(x, z), rr = 3 - Math.abs(y - 4) * .12; if (r <= rr && r > rr - 1.2 || (y === 8 && r <= rr)) statics.set(x0 + x, y, z0 + z, (y === 1 || y === 7) ? hex('#3c3c44') : y === 8 ? jit(pick(WOOD, .3), .1, h2(x, z, 3)) : jit(pick(WOOD, ((Math.round(Math.atan2(z, x) * 4) % 2) ? .45 : .7)), .06, h2(x, y, z))); } }
function crate(x0, y0, z0, n = 6) { for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) for (let z = 0; z < n; z++) { const e = [x === 0 || x === n - 1, y === 0 || y === n - 1, z === 0 || z === n - 1].filter(Boolean).length; if (e) statics.set(x0 + x, y0 + y, z0 + z, jit(pick(WOOD, e >= 2 ? .1 : (y % 2 ? .6 : .8)), .08, h2(x, y, z))); } }
barrel(-96, -86); barrel(-89, -88); crate(-104, 0, -92); crate(-104, 6, -92, 5); crate(-82, 0, -94);
// fruit stall: table, crates of fruit, striped roof on posts
{ const x0 = 62, z0 = -84; for (let x = 0; x < 22; x++) for (let z = 0; z < 9; z++) { statics.set(x0 + x, 8, z0 + z, jit(pick(WOOD, .7), .06, h2(x, z, 1))); if (z > 0 && z < 8 && x % 7 && x > 0 && x < 21) statics.set(x0 + x, 9, z0 + z, hex(['#e43b44', '#feae34', '#63c74d', '#f77622', '#fee761', '#9b3fb8'][Math.floor(x / 7) * 2 + (z > 4 ? 1 : 0)])); if (h2(x, z, 3) > .5 && z > 1 && z < 7 && x % 7 && x > 0 && x < 21) statics.set(x0 + x, 10, z0 + z, hex(['#c82a34', '#e8962a', '#4aa83a'][Math.floor(x / 7)])); }
  for (const [a, b] of [[0, 0], [21, 0], [0, 8], [21, 8]]) for (let y = 0; y < 22; y++) statics.set(x0 + a, y, z0 + b, hex('#4a2e1e'));
  for (let x = -1; x < 23; x++) for (let z = -2; z < 11; z++) statics.set(x0 + x, 22 + Math.round((z + 2) * .25), z0 + z, hex(Math.floor((x + 1) / 3) % 2 ? '#f4efe4' : '#2a6ac8')); }
// notice board with pinned papers
{ const x0 = -20, z0 = -92; for (let y = 0; y < 24; y++) for (const a of [0, 15]) statics.set(x0 + a, y, z0, hex('#4a2e1e'));
  for (let x = 1; x < 15; x++) for (let y = 10; y < 22; y++) statics.set(x0 + x, y, z0, (y === 10 || y === 21) ? hex('#4a2e1e') : jit(hex('#9a6a3c'), .1, h2(x, y, 4)));
  for (const [px, py, c] of [[2, 15, '#f4efe4'], [7, 13, '#fee761'], [10, 16, '#f4efe4'], [4, 11, '#9ad8ff']]) for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) statics.set(x0 + px + x, py + y, z0 + 1, hex(y === 2 && x > 0 ? '#5a5a6a' : c));
  for (let x = -1; x < 17; x++) for (const z of [-1, 0, 1]) statics.set(x0 + x, 22, z0 + z, hex('#a8432f')); }
// picket fence around the right lawn
for (let x = 80; x < 168; x++) for (let y = 0; y < 7; y++) if (x % 3 === 0 || y === 2 || y === 5) statics.set(x, y + (x % 3 === 0 && y === 6 ? 1 : 0), 74, hex(y === 6 && x % 3 === 0 ? '#ffffff' : '#ecebe4'));

// —— the countryside around: hills of grass and fields in big cubes, woods, a bell tower behind the roofs ——
{ const hills = new Grid(), HS = .6;
  for (let X = -170; X <= 170; X++) for (let Z = -230; Z <= 120; Z++) { const x = X * HS, z = Z * HS, inner = Math.abs(x) < 21 && z > -19 && z < 12; if (inner) continue;
    const d = Math.max(Math.abs(x) - 21, -19 - z, z - 12, 0), hgt = Math.floor(Math.min(1, d / 30) * (6 + fbm(X * .03, Z * .03, 4) * 26) + fbm(X * .1, Z * .1, 2) * 2);
    const field = fbm(X * .02 + 5, Z * .02, 2), stripe = Math.floor(fbm(X * .015, Z * .015, 7) * 8);
    const top = field > .6 ? pick(['#c8a848', '#d8b858', '#b89838'], h2(X, Z, 1)) : field > .55 ? pick(['#8a6a3a', '#9a7a48'], (X + stripe) % 2 ? .2 : .8) : pick(GRASS, .3 + fbm(X * .2, Z * .2, 3) * .6);
    for (let y = Math.max(-2, hgt - 3); y <= hgt; y++) hills.set(X, y, Z, y === hgt ? jit(top, .1, h2(X, Z, y)) : jit(hex('#6a5a3e'), .1, h2(X, y, Z)));
    if (d > 6 && h2(X, Z, 21) > .985) for (let a = -2; a <= 2; a++) for (let b = -3; b <= 3; b++) for (let c = -2; c <= 2; c++) if (Math.hypot(a, b * .8, c) < 2.4 + h2(a, b, c) * .5) hills.set(X + a, hgt + 4 + b, Z + c, jit(pick(GREEN, .15 + (b + 3) / 8), .12, h2(X + a, b, Z + c)));   // woods
  }
  scene.add(build(hills, { size: HS, oy: -.3 })); }
{ const x0 = 10, z0 = -235;   // bell tower: stone shaft with a clock, open belfry, slate spire
  for (let y = 0; y < 120; y++) for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) { const sh = x === 0 || x === 15 || z === 0 || z === 15; if (!sh) continue;
    const belfry = y > 88 && y < 104 && ((x > 4 && x < 11) || (z > 4 && z < 11)); if (belfry) continue;
    statics.set(x0 + x, y, z0 + z, (x === 0 || x === 15) && (z === 0 || z === 15) ? jit(pick(STONE, .9), .05, h2(x, y, z)) : jit(pick(STONE, .35 + h2(x >> 2, y >> 1, z >> 2) * .4), .06, h2(x, y, z))); }
  for (let x = 4; x < 12; x++) for (let y = 70; y < 78; y++) if (Math.hypot(x - 7.5, y - 73.5) < 4.2) statics.set(x0 + x, y, z0 + 16, (x === 7 && y > 73) || (y === 74 && x > 7) ? hex('#1a1a24') : hex('#f4efe4'));   // clock
  for (let x = 6; x < 10; x++) for (let y = 92; y < 98; y++) for (let z = 6; z < 10; z++) if (Math.hypot(x - 7.5, z - 7.5) < 2 + (98 - y) * .25) statics.set(x0 + x, y, z0 + z, hex('#c89a3a'));   // the bell
  for (let i = 0; i < 26; i++) for (let x = -1 + i * .35; x < 17 - i * .35; x++) for (let z = -1 + i * .35; z < 17 - i * .35; z++) { const e = x < -1 + i * .35 + 1 || x >= 16 - i * .35 || z < -1 + i * .35 + 1 || z >= 16 - i * .35; if (e || i === 25) statics.set(x0 + Math.round(x), 120 + i, z0 + Math.round(z), jit(pick(SLATE, (i % 2 ? .3 : .6)), .08, h2(x, i, z))); }
  for (let y = 146; y < 152; y++) statics.set(x0 + 8, y, z0 + 8, hex('#c89a3a')); for (let x = 6; x < 11; x++) statics.set(x0 + x, 149, z0 + 8, hex('#c89a3a')); }

scene.add(build(statics)); scene.add(build(glowG, { unlit: true }));

// —— water of the fountain: a slowly rippling surface, falling water, sparkles ——
const waterTex = (() => { const p = new PX(64, 64); for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const v = fbm(x * .12, y * .12, 3); p.set(x, y, v > .62 ? [200, 236, 255] : v > .5 ? [96, 170, 220] : [60, 128, 190]); } return texOf(p.done(), { repeat: [3, 3] }); })();
const water = new THREE.Mesh(new THREE.CircleGeometry(2.1, 48), new THREE.MeshLambertMaterial({ map: waterTex, transparent: true, opacity: .9 })); water.rotation.x = -Math.PI / 2; water.position.set(0, .45, FZ * S); scene.add(water);
const upper = new THREE.Mesh(new THREE.CircleGeometry(.8, 32), water.material); upper.rotation.x = -Math.PI / 2; upper.position.set(0, 2.06, FZ * S); scene.add(upper);
const jets = particles(420, (i, t, o) => { const ring = i % 3, ph = (t * (.9 + h2(i, 1) * .3) + h2(i, 2)) % 1, a = h2(i, 3) * Math.PI * 2;
  if (ring === 0) { o.x = Math.cos(a) * .05 * ph; o.z = FZ * S + Math.sin(a) * .05 * ph; o.y = 2.5 + ph * .5 - ph * ph * .9; }                       // the jet on top
  else { const r = .95 + ph * .25; o.x = Math.cos(a) * r; o.z = FZ * S + Math.sin(a) * r; o.y = 2.0 - ph * ph * 1.55; }                            // the curtain from the bowl
  o.s = .08; o.a = .8; o.r = .9; o.g = .97; o.b = 1; }, { soft: 1, blend: THREE.NormalBlending }); scene.add(jets);
const smoke = particles(160, (i, t, o) => { const [x, y, z] = smokeAt[i % smokeAt.length], ph = (t * .18 + h2(i, 4)) % 1;
  o.x = x + ph * 1.4 + Math.sin(ph * 6 + i) * .15; o.y = y + ph * 3; o.z = z + Math.cos(ph * 5 + i) * .15; o.s = .25 + ph * .8; o.a = .35 * (1 - ph); o.r = o.g = o.b = .92; }, { soft: 1, blend: THREE.NormalBlending }); scene.add(smoke);
const butterflies = particles(14, (i, t, o) => { o.x = -1 + Math.sin(t * .6 + i) * 6 + h2(i, 1) * 4; o.y = .4 + Math.abs(Math.sin(t * 9 + i)) * .15 + h2(i, 2) * .8; o.z = 4 + Math.cos(t * .5 + i * 2) * 3; o.s = .07; o.a = .9; o.r = 1; o.g = .7 + h2(i, 3) * .3; o.b = h2(i, 4) * .5; }, { blend: THREE.NormalBlending }); scene.add(butterflies);
for (const [x, y, z] of lamps) { const gl = glow('#ffd890', 1.1, .6); gl.position.set(x, y, z); scene.add(gl); }

// —— clouds: big soft cubes far away, drifting ——
const clouds = [];
for (let c = 0; c < 7; c++) { const g = new Grid(), parts = [[0, 0, 0, 1]]; for (let i = 0; i < 4; i++) parts.push([(h2(c, i) - .5) * 16, h2(i, c) * 3, (h2(c + 9, i) - .5) * 4, .55 + h2(i, c + 3) * .4]);
  for (let x = -16; x <= 16; x++) for (let y = -2; y <= 9; y++) for (let z = -6; z <= 6; z++) { let f = -1; for (const [px, py, pz, k] of parts) f = Math.max(f, 1 - Math.hypot((x - px) / (9 * k), (y - py) / (5 * k), (z - pz) / (5 * k)));
    f += (fbm(x * .25 + c * 3, y * .25, 2) - .5) * .35; if (f > 0 && y >= -1) g.set(x, y, z, hex(y > 4 ? '#ffffff' : y > 1 ? '#f6f4f8' : y > -1 ? '#e6e4ee' : '#d4d4e2')); }
  const m = build(g, { size: 1.3, unlit: true, bottom: true }); m.castShadow = false; m.position.set(-150 + c * 50 + h2(c, 5) * 20, 20 + h2(c, 1) * 14, -150 - h2(c, 2) * 60); scene.add(m); clouds.push(m); }
// —— birds: little voxel birds flapping over the roofs ——
const birds = [];
for (let b = 0; b < 4; b++) { const body = new Grid(), wing = new Grid(); for (let x = -2; x <= 2; x++) body.set(x, 0, 0, hex('#2a2a34')); body.set(3, 0, 0, hex('#feae34'));
  for (let z = 1; z <= 4; z++) for (let x = -1; x <= 1; x++) wing.set(x, 0, z, hex('#3a3a48'));
  const G = new THREE.Group(), L = build(wing, { size: .08 }), R = build(wing, { size: .08 }); R.scale.z = -1; G.add(build(body, { size: .08 }), L, R); scene.add(G); birds.push([G, L, R, b]); }

// —— sky, sun, fog ——
const SUN = new THREE.Vector3(-14, 9, 6);
const SK = sky({ top: '#2f6fc0', mid: '#7ab4e8', hor: '#f8dcb0', moonDir: SUN.clone().normalize(), moonCol: '#fff2c8', moonI: .9 }); scene.add(SK.mesh);
scene.fog = new THREE.FogExp2("#e8dcc8", .007);
scene.add(new THREE.HemisphereLight('#d8e8ff', '#5a6a3a', 1.0));
const sun = new THREE.DirectionalLight('#ffe0b0', 2.6); sun.position.copy(SUN); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: .5, far: 80 }); sun.shadow.bias = -.0008; sun.shadow.normalBias = .02; scene.add(sun, sun.target);

// —— the four AIs, our usual voxel characters, walking around the fountain ——
const canvasOf = s => { const p = new PX(s.w, s.h); for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) { const c = s.d[y * s.w + x]; if (c !== TR) p.set(x, y, RGB[c]); } return p.done(); };
const texCache = new Map(), rT = (m, o) => { const s = robot(m, o); if (!texCache.has(s)) texCache.set(s, texOf(canvasOf(s))); return texCache.get(s); };
const vox = voxelFacer(camera), bots = [];
for (const [i, m] of ['claude', 'gemini', 'grok', 'gpt'].entries()) { const b = billboard(rT(m, {}), 20 / PPM, 28 / PPM, { ay: .04 }); b.scale.set(1.25, 1.25, 1); scene.add(b); bots.push([b, m, i]); }
const setTex = (b, tx) => { b.material.map = tx; b.customDepthMaterial.map = tx; b.customDistanceMaterial.map = tx; };

// —— post: no blur (Kev's rule), a little bloom on lamps and windows ——
const post = makePost(renderer, scene, camera, W, H, { ssaa: 1 });
post.bloom.strength = .4; post.bloom.radius = .6; post.bloom.threshold = .88; post.dof.sansFlou = true;
const VG = post.vig.uniforms; VG.amt.value = .4; VG.warm.value = .06; VG.contrast.value = .15; VG.sat.value = 1.1;

const ease = k => k < .5 ? 2 * k * k : 1 - 2 * (1 - k) ** 2, mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
let started = false;
window.DUR = DUR; window.EV = [];
window.render = t => {
  const k = ease(Math.min(1, t / DUR));
  const p = mix([10.5, 5.6, 14.5], [-2.5, 3.6, 11.5], k), l = mix([-1.5, 1.8, -4], [1.2, 1.6, -5], k);
  camera.position.set(p[0] + Math.sin(t * .45) * .03, p[1] + Math.sin(t * .31) * .02, p[2]); camera.lookAt(...l);
  // AIs: two walk around the plaza, one sits by the fountain and waves, one goes to the stall
  const path = [[t => [Math.cos(3.6 + t * .16) * 3.5, FZ * S + Math.sin(3.6 + t * .16) * 3.0], true], [t => [5.4 + t * .1, .6 - t * .55], true], [t => [-3.3, 1.3], false], [t => [-6.7, -5 + t * .6], true]];
  for (const [b, m, i] of bots) { const [f, walk] = path[i], [x, z] = f(t), [x2] = f(t + .1);
    b.position.set(x, 0, z); b.scale.x = (x2 < x ? -1 : 1) * 1.25; setTex(b, rT(m, { walk, f: t * 1.6 + i * .3, arms: i === 2 ? (t % 2 < 1 ? 'up' : 'down') : 'down', blink: (t + i) % 3 > 2.85 })); }
  if (!started) { vox.startShot(); started = true; }
  vox.face(bots.map(b => b[0]));
  for (const [g, s] of sway) { g.rotation.z = Math.sin(t * 1.1 + s) * .018; g.rotation.x = Math.sin(t * .9 + s * 2) * .012; }
  waterTex.offset.set(t * .03, t * .02); water.rotation.z = t * .05;
  jets.userData.update(t); smoke.userData.update(t); butterflies.userData.update(t);
  clouds.forEach((c, i) => c.position.x = -150 + i * 50 + h2(i, 5) * 20 + t * .8);
  for (const [G, L, R, b] of birds) { const a = t * .25 + b * .4; G.position.set(-6 + Math.cos(a) * 9 + b, 9 + b * .6 + Math.sin(t * 2 + b) * .3, -12 + Math.sin(a) * 4); G.rotation.y = -a - Math.PI / 2; const fl = Math.sin(t * 14 + b * 2) * .7; L.rotation.x = fl; R.rotation.x = -fl; }
  post.composer.render();
};
window.READY = true;
