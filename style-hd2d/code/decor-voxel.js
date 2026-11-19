// Décor HD-2D en voxel (choix de Kev, 2026-11-09 ; RENDU.md §3 bis) : tout le décor est fait de cubes de 10 cm.
// Mode d'emploi, dans le hd2d.js d'un épisode :
//   import { Grid, build, hex, jit, pick, PAL, house, tree, palm, lampPost, bench, barrel, crate, ground, hills, clouds, birds, voxCyl } from './decor-voxel.js';
//   const g = new Grid(), gl = new Grid();         // g : le décor éclairé ; gl : ce qui brille (fenêtres allumées, lanternes)
//   house(g, gl, { x: 10, z: -40, w: 50, d: 40, h: 40, kind: 'timber' });   // tout est en cubes (10 cm) ; x, y, z entiers
//   const t = tree(10, 20, 3); scene.add(build(t.trunk, { ox: .., oz: .. })) ; la couronne à part pour le vent
//   scene.add(build(g)); scene.add(build(gl, { unlit: true }));
// build() ne garde que les faces à l'air et assombrit chaque face selon les cubes qui l'entourent (creux et angles lisibles).
// Un objet qui doit noircir (brûler), changer de couleur (une voiture) ou s'allumer la nuit a SA grille et son matériau :
// ses cubes sont clairs (`blanc` = hex('#ffffff') nuancé) et material.color donne la teinte.
// Modèle complet : nan_serieux/style-hd2d/modele-place-voxel/main.js (l'essai de la place de village validé par Kev, 2026-11-09).
import * as THREE from 'three';
import { h2, fbm } from './hd/px.js';

export const S = 0.1;   // la taille d'un cube (m)
export const hex = c => parseInt(c.slice(1), 16);
export const jit = (c, a, s) => { const k = 1 + (s - .5) * a; const r = Math.min(255, ((c >> 16) & 255) * k), g = Math.min(255, ((c >> 8) & 255) * k), b = Math.min(255, (c & 255) * k); return (r << 16) | (g << 8) | b; };
export const pick = (cols, v) => hex(cols[Math.max(0, Math.min(cols.length - 1, Math.floor(v * cols.length)))]);
export class Grid {
  constructor() { this.m = new Map(); }
  static k(x, y, z) { return ((x + 1024) * 2048 + (y + 1024)) * 2048 + (z + 1024); }
  set(x, y, z, c) { this.m.set(Grid.k(x, y, z), [x, y, z, c]); }
  del(x, y, z) { this.m.delete(Grid.k(x, y, z)); }
  has(x, y, z) { return this.m.has(Grid.k(x, y, z)); }
  box(x0, y0, z0, w, h, d, f) { for (let x = x0; x < x0 + w; x++) for (let y = y0; y < y0 + h; y++) for (let z = z0; z < z0 + d; z++) { const c = f(x, y, z); if (c != null) this.set(x, y, z, c); } }
}
const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const QUAD = [[-.5, -.5], [.5, -.5], [.5, .5], [-.5, .5]];
// bottom: draw the underside of each cube. True by default since 2026-11-14: without it, a deck, a floor or a building seen from below is see-through (Kev). Use false only for a ground no camera sees from below.
export function build(g, { size = S, unlit = false, bottom = true, ox = 0, oy = 0, oz = 0, mat = null } = {}) {
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
  const m = new THREE.Mesh(geo, mat ?? (unlit ? new THREE.MeshBasicMaterial({ vertexColors: true, fog: true }) : new THREE.MeshLambertMaterial({ vertexColors: true })));
  m.castShadow = !unlit; m.receiveShadow = !unlit; return m;
}

export const PAL = {
  GREEN: ['#24481f', '#2f5c27', '#3f7630', '#55913a', '#74ad46', '#9ccb5a'], BLOSSOM: ['#c25a7c', '#e07a9a', '#f29ab4', '#fbc4d4', '#fff0f4'],
  BARK: ['#3c2618', '#4e321f', '#634028', '#7a5232'], PALMBARK: ['#6e5236', '#8a6a46', '#a5845a', '#c0a070'],
  STONE: ['#76747c', '#8a8890', '#9e9ca2', '#b4b2b4', '#c8c4c0'], COBBLE: ['#8e8070', '#a29280', '#b4a48e', '#c6b8a0', '#988a7a'],
  GRASS: ['#3d6e2c', '#4a8034', '#57903a', '#66a042', '#78b04c'], TILE: ['#8e3424', '#a8432f', '#bc5538', '#cc6844'], SLATE: ['#3c4a66', '#4a5a78', '#5c6c8a', '#6e7e9a'],
  PLASTER: ['#e2d0b2', '#ecdcc0', '#f4e8d0'], TIMBER: ['#4a2e1e', '#583826'], BRICK: ['#8c3a2e', '#a4483a', '#b45a44', '#9a4232'], WOOD: ['#5a3a24', '#6e4a2e', '#86603a', '#9c7448'],
  FLOWERS: ['#e43b44', '#f77622', '#feae34', '#fee761', '#c45cd8', '#ffffff', '#f6757a'], ASPHALT: ['#3a3c44', '#44464e', '#4e5058'], IRON: '#2a2a34',
};
const P = PAL;
// light colours meant to be tinted by material.color (cars, painted walls that change per shot)
export const blanc = (s, a = .08) => jit(hex('#f4f4f4'), a, s);

// —— the ground: fn(x, z) → 'plaza' | 'road' | 'walk' | 'dirt' | 'sand' | 'grass' | null ; grass gets tufts and flowers ——
export function ground(g, x0, x1, z0, z1, kind, { tufts = .93, flowers = .005 } = {}) {
  for (let x = x0; x < x1; x++) for (let z = z0; z < z1; z++) {
    const k = kind(x, z), n = fbm(x * .05, z * .05, 3);
    if (!k) continue;
    if (k === 'plaza') { const row = Math.floor(z / 3), off = row % 2 ? 2 : 0, mortar = (x + off) % 5 === 0 || z % 3 === 0;
      g.set(x, -2, z, jit(hex('#5e564c'), .1, h2(x, z, 3))); if (!mortar) g.set(x, -1, z, jit(pick(P.COBBLE, h2(Math.floor((x + off) / 5), row, 7) * .7 + n * .3), .08, h2(x, z, 4))); }
    else if (k === 'road') g.set(x, -1, z, jit(pick(P.ASPHALT, h2(x, z, 1) * .6 + n * .4), .08, h2(x, z, 2)));
    else if (k === 'line') g.set(x, -1, z, jit(hex('#e8dca0'), .06, h2(x, z, 5)));
    else if (k === 'walk') { const slab = x % 8 === 0 || z % 8 === 0; g.set(x, -1, z, jit(hex(slab ? '#8a8a8a' : '#a8a8a4'), .06, h2(x >> 3, z >> 3, 6))); g.set(x, 0, z, jit(hex(slab ? '#8a8a8a' : '#b4b4ae'), .05, h2(x, z, 6))); }
    else if (k === 'curb') { g.set(x, -1, z, hex('#9a9a96')); g.set(x, 0, z, jit(hex('#c4c4bc'), .05, h2(x, z, 7))); }
    else if (k === 'dirt') g.set(x, -1, z, jit(pick(['#7a5c3e', '#8a6a48', '#9a7a54'], h2(x, z, 2)), .12, h2(x, z, 9)));
    else if (k === 'sand') g.set(x, -1, z, jit(pick(['#d8c090', '#e4d0a0', '#ccb080'], h2(x, z, 2) * .5 + n * .5), .06, h2(x, z, 9)));
    else if (k === 'lawn' || k === 'grass') {
      g.set(x, -1, z, jit(pick(P.GRASS, n * .8 + h2(x, z, 1) * .3), .1, h2(x, z, 5)));
      const hh = h2(x, z, 11);
      if (k === 'grass' && hh > tufts) g.set(x, 0, z, jit(pick(P.GRASS, .6 + h2(x, z, 12) * .4), .15, h2(x, z, 13)));
      if (k === 'grass' && hh > .988) g.set(x, 1, z, jit(pick(P.GRASS, .9), .1, h2(x, z, 14)));
      if (hh > .96 && hh < .96 + flowers) { g.set(x, 0, z, hex('#3f7630')); g.set(x, 1, z, hex(P.FLOWERS[Math.floor(h2(x, z, 15) * P.FLOWERS.length)])); }
    }
  }
}

// —— a building, front facing +z (rotate its group for other sides). kind: 'timber' | 'brick' | 'plaster' | 'concrete' | 'paint' (light cubes, tinted by material.color)
// glassG: where the windows go (its own material can light up at night); roof: a palette or null (flat roof with a parapet) ——
export function house(g, glassG, o) {
  const { x: x0 = 0, z: z0 = 0, w, d, h, kind = 'timber', roof = P.TILE, shutter = '#3a7a6a', lit = [], shop = false, seed = 1, floors = 2, door = true, boxes = true, plaster = P.PLASTER, chimney = true, winW = 7 } = o;
  const front = z0 + d - 1, floorY = Math.floor(h / floors);
  const wall = (x, y, z) => {
    if (y < 4) return jit(pick(P.STONE, .2 + h2(x >> 1, y, z >> 1) * .6), .06, h2(x, y, z));
    if (kind === 'brick') { const row = y >> 1, off = row % 2 ? 2 : 0, m = y % 2 === 0 || ((x + z + off) % 4 === 0); return m ? jit(hex('#b8aa98'), .05, h2(x, y, z)) : jit(pick(P.BRICK, h2((x + z + off) >> 2, row, seed)), .08, h2(x, y, z)); }
    if (kind === 'paint') return blanc(h2(x >> 1, y >> 1, z), .05);
    if (kind === 'concrete') { const panel = (x + z) % 12 === 0 || y % 10 === 0; return jit(hex(panel ? '#8a8e96' : '#b4b8be'), .05, h2(x >> 2, y >> 2, z)); }
    if (kind === 'plaster') return jit(pick(plaster, h2(x >> 1, y >> 1, z) * .9), .05, h2(x, y, z));
    const lx = x - x0, lz = z - z0, edge = lx === 0 || lx === w - 1 || lz === 0 || lz === d - 1, corner = (lx === 0 || lx === w - 1) && (lz === 0 || lz === d - 1);
    const along = lz === 0 || lz === d - 1 ? lx : lz, beam = corner || y % floorY === 0 || y % floorY === 1 || y === h - 1 || y === 4 || along % 12 === 0 || (along % 12 === (y - 4) % 12 && y < floorY && along % 24 < 12);
    return beam && edge ? jit(pick(P.TIMBER, h2(x, y, z)), .08, h2(x, z, y)) : jit(pick(plaster, h2(x >> 1, y >> 1, z) * .9), .04, h2(x, y, z));
  };
  for (let y = 0; y < h; y++) for (let x = x0; x < x0 + w; x++) for (let z = z0; z < z0 + d; z++)
    if (x === x0 || x === x0 + w - 1 || z === z0 || z === z0 + d - 1) g.set(x, y, z, wall(x, y, z));
  // windows on the front and the sides
  const cols = Math.max(1, Math.floor((w - 6) / (winW + 5))), gap = (w - cols * winW) / (cols + 1), dx = Math.round(x0 + w / 2 - 3);
  const win = (fl, i, wx, wy, ww, wh, side) => {   // side: 0 front, 1 left (x0), 2 right (x0 + w - 1)
    const on = lit.includes(fl * 10 + i), at = (a, y, k) => side === 0 ? [a, y, front + k] : side === 1 ? [x0 - k, y, a] : [x0 + w - 1 + k, y, a];
    for (let a = wx; a < wx + ww; a++) for (let y = wy; y < wy + wh; y++) {
      g.del(...at(a, y, 0));
      const frame = a === wx || a === wx + ww - 1 || y === wy || y === wy + wh - 1 || (ww > 5 && a === wx + (ww >> 1)) || y === wy + Math.floor(wh / 2);
      if (frame) g.set(...at(a, y, -1), jit(hex('#f0ece0'), .04, h2(a, y, 1)));
      else (glassG ?? g).set(...at(a, y, -1), on ? jit(hex('#ffd27a'), .1, h2(a, y, 2)) : jit(pick(['#2c4a66', '#3c6488', '#5a86a8', '#8ab8d4'], (y - wy) / wh * .7 + h2(a, y, 3) * .3), .05, h2(a, y, 4)));
    }
    for (let a = wx - 1; a <= wx + ww; a++) { g.set(...at(a, wy - 1, 1), jit(hex('#d8d0c0'), .04, h2(a, 1, 1))); g.set(...at(a, wy + wh, 1), jit(pick(P.TIMBER, .5), .05, h2(a, 2, 2))); }
    if (shutter && side === 0) for (const sx of [wx - 3, wx + ww]) for (let a = sx; a < sx + 3; a++) for (let y = wy; y < wy + wh; y++) g.set(...at(a, y, 1), jit(hex(shutter), y % 2 ? .04 : .2, h2(a, y, 7)));
    if (boxes && side === 0 && (fl || !shop)) for (let a = wx; a < wx + ww; a++) { g.set(...at(a, wy - 2, 2), jit(pick(P.WOOD, .5), .06, h2(a, 5, 5))); g.set(...at(a, wy - 2, 1), jit(pick(P.WOOD, .3), .06, h2(a, 6, 5)));
      if (h2(a, wy, seed) > .3) { g.set(...at(a, wy - 1, 2), jit(hex('#3f7630'), .15, h2(a, 7, 7))); if (h2(a, wy, seed + 1) > .45) g.set(...at(a, wy, 2), hex(P.FLOWERS[Math.floor(h2(a, wy, seed + 2) * P.FLOWERS.length)])); } }
  };
  for (let fl = 0; fl < floors; fl++) {
    const wy = fl * floorY + (fl ? 4 : 7), wh = Math.min(10, floorY - 6); if (wh < 4) continue;
    for (let i = 0; i < cols; i++) { const wx = Math.round(x0 + gap + i * (winW + gap)); if (!fl && door && wx < dx + 7 && wx + winW > dx - 1) continue; win(fl, i, wx, wy, winW, wh, 0); }
    const sc = Math.max(0, Math.floor((d - 6) / 14)); for (let i = 0; i < sc; i++) { const wz = Math.round(z0 + 4 + i * 14); win(fl, 5 + i, wz, wy, 5, wh, 1); win(fl, 5 + i, wz, wy, 5, wh, 2); }
  }
  if (door) {   // the door, with panels, a stone step and a little lantern
    for (let x = dx; x < dx + 6; x++) for (let y = 0; y < 14; y++) { g.del(x, y, front); const pnl = (x === dx + 1 || x === dx + 4) && y > 1 && y < 12 && y !== 7; g.set(x, y, front - 1, jit(pick(P.WOOD, pnl ? .2 : .6), .06, h2(x, y, 8))); }
    for (let x = dx - 1; x <= dx + 6; x++) { g.set(x, 14, front + 1, jit(pick(P.TIMBER, .5), .05, 1)); for (let z = front + 1; z <= front + 2; z++) g.set(x, 0, z, jit(pick(P.STONE, .8), .05, h2(x, z, 10))); }
    g.set(dx + 7, 12, front + 1, hex(P.IRON)); (glassG ?? g).set(dx + 7, 11, front + 1, hex('#ffcf6a'));
  }
  if (shop) for (let x = x0 + 2; x < x0 + w - 2; x++) for (let k = 0; k < 6; k++) g.set(x, floorY - 1 - k, front + 1 + k, hex(Math.floor((x - x0) / 3) % 2 ? '#f4efe4' : shop === true ? '#c8323c' : shop));   // striped awning
  if (!roof) {   // flat roof with a parapet, vents
    for (let x = x0; x < x0 + w; x++) for (let z = z0; z < z0 + d; z++) { g.set(x, h, z, jit(hex('#6a6a70'), .08, h2(x, z, 1))); if (x === x0 || x === x0 + w - 1 || z === z0 || z === z0 + d - 1) g.set(x, h + 1, z, wall(x, h + 1, z)); }
    g.box(x0 + 3, h + 1, z0 + 3, 4, 3, 4, (x, y, z) => jit(hex('#9a9ea4'), .06, h2(x, y, z))); return { top: h + 2 };
  }
  const R = Math.ceil(d / 2) + 1;   // gable roof, ridge along x, 2-cube overhang, rows of tiles, darker ridge, end walls
  for (let i = 0; i <= R; i++) for (let x = x0 - 2; x < x0 + w + 2; x++) {
    const y = h + i, za = z0 - 2 + i, zb = z0 + d + 1 - i, c = (z, s) => jit(pick(roof, i === R ? 0 : (i % 2 ? .45 : .75) + h2(x, z, s) * .25), .1, h2(x, y, z));
    if (za > zb) continue;
    g.set(x, y, za, c(za, 1)); g.set(x, y, zb, c(zb, 2)); if (i === R) for (let z = za; z <= zb; z++) g.set(x, y + 1, z, jit(pick(roof, 0), .06, h2(x, z, 3)));
    if (x === x0 - 2 || x === x0 + w + 1) { g.set(x, y - 1, za, jit(pick(roof, 0), .05, 1)); g.set(x, y - 1, zb, jit(pick(roof, 0), .05, 1)); }
    if (x === x0 || x === x0 + w - 1) for (let z = za + 1; z < zb; z++) g.set(x, y, z, wall(x, y, z));
  }
  let smoke = null;
  if (chimney) { const cx = x0 + Math.round(w * .72), cz = z0 + Math.round(d * .3), top = h + R + 5;
    for (let y = h; y < top; y++) for (let x = cx; x < cx + 3; x++) for (let z = cz; z < cz + 3; z++) g.set(x, y, z, y > top - 2 ? hex('#3a3236') : jit(pick(P.BRICK, h2(x + z, y >> 1, 4)), .08, h2(x, y, z)));
    smoke = [(cx + 1.5) * S, top * S, (cz + 1.5) * S]; }
  return { top: h + R + 1, smoke };
}

// —— trees: trunk with roots and branches, a crown of noisy blobs (separate grid, for the wind) ——
export function tree(seed, sc = 1, cols = P.GREEN, apples = true) {
  const trunk = new Grid(), crown = new Grid(), Ht = Math.round((30 + h2(seed, 1) * 10) * sc);
  for (let y = -1; y < Ht; y++) { const lean = Math.round(Math.sin(y * .08 + seed) * 1.5), r = (y < 3 ? 3 - y * .3 : y < Ht * .6 ? 1.9 : 1.4) * Math.max(.8, sc);
    for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) if (Math.hypot(x, z) <= r) trunk.set(x + lean, y, z, jit(pick(P.BARK, ((x + z + y * 2) % 5 + 5) % 5 / 5 * .7 + h2(x, y, z) * .3), .1, h2(x, y, z + seed))); }
  for (let k = 0; k < 4; k++) { const a = k * 1.7 + seed, y0 = Math.round(Ht * (.55 + k * .08)); for (let s = 0; s < 9 * sc; s++) trunk.set(Math.round(Math.cos(a) * s), y0 + Math.round(s * .7), Math.round(Math.sin(a) * s), jit(pick(P.BARK, .5), .1, h2(k, s, seed))); }
  const blobs = [[0, Ht + 6 * sc, 0, 12 * sc]]; for (let i = 0; i < 5; i++) blobs.push([Math.cos(i * 1.26 + seed) * 9 * sc, Ht + (2 + h2(i, seed) * 6) * sc, Math.sin(i * 1.26 + seed) * 8 * sc, (7.5 + h2(seed, i) * 3) * sc]);
  const R = Math.ceil(24 * sc);
  for (let x = -R; x <= R; x++) for (let y = Math.floor(Ht - 8 * sc); y <= Ht + 20 * sc; y++) for (let z = -R; z <= R; z++) {
    let f = -1; for (const [bx, by, bz, br] of blobs) f = Math.max(f, 1 - Math.hypot(x - bx, (y - by) * 1.1, z - bz) / br);
    f += (fbm(x * .18 + seed, y * .18, 2) - .5) * .5 + (fbm(z * .18, y * .18 + seed, 2) - .5) * .3;
    if (f > 0) { crown.set(x, y, z, jit(pick(cols, (y - (Ht - 4 * sc)) / (24 * sc) * .7 + f * .4 + h2(x, y, z) * .15), .1, h2(x, z, y)));
      if (apples && cols === P.GREEN && h2(x, y, z + 7) > .995 && f < .15) crown.set(x, y, z, hex('#d8302e')); }
  }
  return { trunk, crown, top: Ht };
}
// —— palm: ringed curved trunk, drooping fronds with leaflets, coconuts ——
export function palm(seed, bend = 1, L0 = 52) {
  const trunk = new Grid(), crown = new Grid(), L = L0 + Math.round(h2(seed, 2) * 10); let tx = 0, tz = 0;
  for (let y = -1; y < L; y++) { const k = y / L; tx = Math.round(bend * 9 * k * k); tz = Math.round(bend * -3 * k * k); const r = y < 3 ? 2.6 : 1.8 - k * .4;
    for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) if (Math.hypot(x, z) <= r) trunk.set(x + tx, y, z + tz, jit(pick(P.PALMBARK, y % 4 === 0 ? 0 : .35 + (x + 2) / 8 + h2(x, y, z) * .2), .08, h2(x, y, z + seed))); }
  for (const [a, b] of [[1, 0], [-1, 1], [0, -1]]) trunk.box(tx + a, L - 3, tz + b, 2, 2, 2, (x, y, z) => jit(hex('#5a3a1e'), .15, h2(x, y, z)));   // coconuts
  const N = 9;
  for (let f = 0; f < N; f++) { const ang = f / N * Math.PI * 2 + seed, len = 24 + h2(f, seed) * 8, dx = Math.cos(ang), dz = Math.sin(ang), px = -dz, pz = dx, lift = 5 + h2(seed, f) * 4;
    for (let s = 0; s <= len; s++) { const t = s / len, y = lift * t * 2 - (lift + 12) * t * t, wv = Math.round(5 * Math.sin(Math.PI * Math.min(1, t * 1.15)));
      for (let j = -wv; j <= wv; j++) { if (j && (s + Math.abs(j)) % 3 === 0 && Math.abs(j) > 1) continue;
        const X = Math.round(dx * s + px * j * .8), Z = Math.round(dz * s + pz * j * .8), Y = Math.round(y - Math.abs(j) * .45);
        crown.set(X, Y, Z, jit(pick(P.GREEN, j === 0 ? .15 : .45 + (1 - t) * .35 - Math.abs(j) * .04), .1, h2(X, Y, Z))); } } }
  return { trunk, crown, top: [tx, L, tz] };
}
// —— street furniture (glowG: the lit glass of the lantern) ——
export function lampPost(g, glowG, x, z, H = 30) {
  g.box(x - 1, 0, z - 1, 3, 2, 3, () => hex(P.IRON));
  for (let y = 2; y < H; y++) g.set(x, y, z, hex(y % 7 === 0 ? '#44445a' : P.IRON));
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { g.set(x + a, H, z + b, hex(P.IRON)); g.set(x + a, H + 5, z + b, hex(P.IRON)); for (let y = H + 1; y < H + 5; y++) (a && b) ? g.set(x + a, y, z + b, hex(P.IRON)) : glowG.set(x + a, y, z + b, hex(a || b ? '#ffd890' : '#fff4c8')); }
  g.set(x, H + 6, z, hex(P.IRON)); return [x * S, (H + 3) * S, z * S];
}
export function bench(g, x0, z0, rot = 0) {
  const put = (a, y, b, c) => rot ? g.set(x0 + b, y, z0 + a, c) : g.set(x0 + a, y, z0 + b, c);
  for (let a = 0; a < 16; a++) { for (let b = 0; b < 4; b++) if (b !== 2) put(a, 4, b, jit(pick(P.WOOD, .6), .08, h2(a, b, 1))); for (const y of [6, 8]) put(a, y, 4, jit(pick(P.WOOD, .55), .08, h2(a, y, 2))); }
  for (const a of [1, 14]) { for (let y = 0; y < 4; y++) { put(a, y, 0, hex(P.IRON)); put(a, y, 3, hex(P.IRON)); } for (let y = 4; y < 9; y++) put(a, y, 5, hex(P.IRON)); put(a, 3, 1, hex(P.IRON)); put(a, 3, 2, hex(P.IRON)); }
}
export function barrel(g, x0, z0) { for (let y = 0; y < 9; y++) for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) { const r = Math.hypot(x, z), rr = 3 - Math.abs(y - 4) * .12; if (r <= rr && r > rr - 1.2 || (y === 8 && r <= rr)) g.set(x0 + x, y, z0 + z, (y === 1 || y === 7) ? hex('#3c3c44') : y === 8 ? jit(pick(P.WOOD, .3), .1, h2(x, z, 3)) : jit(pick(P.WOOD, ((Math.round(Math.atan2(z, x) * 4) % 2) ? .45 : .7)), .06, h2(x, y, z))); } }
export function crate(g, x0, y0, z0, n = 6) { g.box(x0, y0, z0, n, n, n, (x, y, z) => { const e = [x === x0 || x === x0 + n - 1, y === y0 || y === y0 + n - 1, z === z0 || z === z0 + n - 1].filter(Boolean).length; return e ? jit(pick(P.WOOD, e >= 2 ? .1 : (y % 2 ? .6 : .8)), .08, h2(x, y, z)) : null; }); }
// cylinder of cubes along y (columns, trash cans, posts)
export function voxCyl(g, cx, y0, cz, r, h, col) { for (let y = y0; y < y0 + h; y++) for (let x = -Math.ceil(r); x <= Math.ceil(r); x++) for (let z = -Math.ceil(r); z <= Math.ceil(r); z++) if (Math.hypot(x, z) <= r) g.set(cx + x, y, cz + z, typeof col === 'function' ? col(x, y, z) : col); }

// —— the countryside around a set: hills and fields in big cubes (HS m), woods; skip(x, z) in metres = the fine set ——
export function hills(scene, { HS = .6, X = [-170, 170], Z = [-230, 120], skip, dist, seed = 0 }) {
  const g = new Grid();
  for (let X0 = X[0]; X0 <= X[1]; X0++) for (let Z0 = Z[0]; Z0 <= Z[1]; Z0++) { const x = X0 * HS, z = Z0 * HS; if (skip(x, z)) continue;
    const d = dist(x, z), hgt = Math.floor(Math.min(1, d / 30) * (6 + fbm(X0 * .03 + seed, Z0 * .03, 4) * 26) + fbm(X0 * .1, Z0 * .1, 2) * 2);
    const field = fbm(X0 * .02 + 5 + seed, Z0 * .02, 2), stripe = Math.floor(fbm(X0 * .015, Z0 * .015, 7) * 8);
    const top = field > .6 ? pick(['#c8a848', '#d8b858', '#b89838'], h2(X0, Z0, 1)) : field > .55 ? pick(['#8a6a3a', '#9a7a48'], (X0 + stripe) % 2 ? .2 : .8) : pick(P.GRASS, .3 + fbm(X0 * .2, Z0 * .2, 3) * .6);
    for (let y = Math.max(-2, hgt - 3); y <= hgt; y++) g.set(X0, y, Z0, y === hgt ? jit(top, .1, h2(X0, Z0, y)) : jit(hex('#6a5a3e'), .1, h2(X0, y, Z0)));
    if (d > 6 && h2(X0, Z0, 21) > .985) for (let a = -2; a <= 2; a++) for (let b = -3; b <= 3; b++) for (let c = -2; c <= 2; c++) if (Math.hypot(a, b * .8, c) < 2.4 + h2(a, b, c) * .5) g.set(X0 + a, hgt + 4 + b, Z0 + c, jit(pick(P.GREEN, .15 + (b + 3) / 8), .12, h2(X0 + a, b, Z0 + c)));
  }
  const m = build(g, { size: HS, oy: -.3 }); scene.add(m); return m;
}
// —— clouds: big soft cubes, unlit ——
export function clouds(scene, n = 7, { y = [20, 34], z = [-150, -210], x0 = -150, step = 50, size = 1.3 } = {}) {
  const out = [];
  for (let c = 0; c < n; c++) { const g = new Grid(), parts = [[0, 0, 0, 1]]; for (let i = 0; i < 4; i++) parts.push([(h2(c, i) - .5) * 16, h2(i, c) * 3, (h2(c + 9, i) - .5) * 4, .55 + h2(i, c + 3) * .4]);
    for (let x = -16; x <= 16; x++) for (let yy = -2; yy <= 9; yy++) for (let zz = -6; zz <= 6; zz++) { let f = -1; for (const [px, py, pz, k] of parts) f = Math.max(f, 1 - Math.hypot((x - px) / (9 * k), (yy - py) / (5 * k), (zz - pz) / (5 * k)));
      f += (fbm(x * .25 + c * 3, yy * .25, 2) - .5) * .35; if (f > 0 && yy >= -1) g.set(x, yy, zz, hex(yy > 4 ? '#ffffff' : yy > 1 ? '#f6f4f8' : yy > -1 ? '#e6e4ee' : '#d4d4e2')); }
    const m = build(g, { size, unlit: true, bottom: true }); m.castShadow = false; m.position.set(x0 + c * step + h2(c, 5) * 20, y[0] + h2(c, 1) * (y[1] - y[0]), z[0] + h2(c, 2) * (z[1] - z[0])); m.userData.x = m.position.x; scene.add(m); out.push(m); }
  return out;
}
// —— birds: little voxel birds; update(t) flies them in circles around (cx, cy, cz) ——
export function birds(scene, n = 4, { cx = -6, cy = 9, cz = -12, r = 9 } = {}) {
  const list = [];
  for (let b = 0; b < n; b++) { const body = new Grid(), wing = new Grid(); for (let x = -2; x <= 2; x++) body.set(x, 0, 0, hex('#2a2a34')); body.set(3, 0, 0, hex('#feae34'));
    for (let z = 1; z <= 4; z++) for (let x = -1; x <= 1; x++) wing.set(x, 0, z, hex('#3a3a48'));
    const G = new THREE.Group(), L = build(wing, { size: .08 }), R = build(wing, { size: .08 }); R.scale.z = -1; G.add(build(body, { size: .08 }), L, R); scene.add(G); list.push([G, L, R, b]); }
  return t => { for (const [G, L, R, b] of list) { const a = t * .25 + b * .4; G.position.set(cx + Math.cos(a) * r + b, cy + b * .6 + Math.sin(t * 2 + b) * .3, cz + Math.sin(a) * r * .45); G.rotation.y = -a - Math.PI / 2; const fl = Math.sin(t * 14 + b * 2) * .7; L.rotation.x = fl; R.rotation.x = -fl; } };
}

// —— flames in cubes (clear, readable even small, e.g. on a thumbnail): a few tongues, yellow core, orange, red tips, dark smoke cubes on top; build with { unlit: true } ——
export function flames(seed, w = 14, h = 26, ph = 0) {   // ph (0..1): the phase of the flicker, flameBook() draws several phases
  const g = new Grid(), smoke = new Grid(), P = ph * 6.283;
  for (let k = 0; k < 5; k++) { const cx = Math.round((h2(k, seed) - .5) * w), th = h * (.55 + h2(seed, k) * .45) * (1 + .22 * Math.sin(P + k * 1.9)), r0 = 3 + h2(k, seed, 2) * 3;
    for (let y = 0; y < th; y++) { const u = y / th, r = r0 * (1 - u) ** .8, sx = Math.round(Math.sin(u * 5 + k + seed + P) * 2 * u + Math.sin(P * 2 + k) * u * 1.5);
      for (let x = -Math.ceil(r); x <= Math.ceil(r); x++) for (let z = -Math.ceil(r); z <= Math.ceil(r); z++) { const d = Math.hypot(x, z) / Math.max(r, .5); if (d > 1 + (h2(x, y, z + k) - .5) * .3) continue;
        const v = u * .8 + d * .35 + (h2(x, y, z) - .5) * .15; g.set(cx + sx + x, y, z, hex(v < .3 ? '#fff6b0' : v < .55 ? '#ffc040' : v < .8 ? '#ff7a20' : '#e43b44')); } } }
  for (let i = 0; i < 40; i++) { const x = Math.round((h2(i, seed, 5) - .5) * w * 1.2), y = Math.round(h * (1 + ((h2(seed, i, 6) + ph) % 1) * .8)), z = Math.round((h2(i, 7, seed) - .5) * 6); smoke.box(x, y, z, 2, 2, 2, () => hex(h2(i, 8) > .5 ? '#3a3236' : '#4e4650')); }
  return { g, smoke };
}
// a living fire: n phases of flames() built once, one shown per frame (a flip-book at ~12 images/s, never a static flame that turns or stretches,
// Kev 2026-11-13). const f = flameBook(7, 10, 30, { size: .06 }); scene.add(f); every frame: f.userData.tick(t)
export function flameBook(seed, w = 14, h = 26, { n = 8, size = S, fps = 12, smoke = false } = {}) {
  const G = new THREE.Group();
  for (let i = 0; i < n; i++) { const f = flames(seed, w, h, i / n), m = build(f.g, { unlit: true, size }); if (smoke) m.add(build(f.smoke, { size })); m.visible = false; G.add(m); }
  G.userData.tick = t => { const k = Math.floor(t * fps + seed * 3) % n; G.children.forEach((m, i) => m.visible = i === k); };
  return G;
}
