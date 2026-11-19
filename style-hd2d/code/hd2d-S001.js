// hd2d.js — the HD-2D shots of S001 (RENDU.md §3 bis, v0.6: HD-2D is the main style, pixel for still shots and information).
// A lit 3D diorama with the channel's pixel characters as cut-outs. Sets: W = outdoor world (wheat, red track, wood), M = the waterhole,
// L = mise en lumière, O = minister's office, P = relief map on a table. One camera, placed per shot in render().
// Engine pieces from Lemo-Opuscar hd-2d (hd/px.js, hd/post_ts.js, hd/fx.js, MIT). Render with LEMO_ANGLE=vulkan (GPU).
import * as THREE from 'three';
import { makePost } from './hd/post_ts.js';
import { PX, texOf, ramp, billboard, glow, blob, woodPlanks, plaster, h2 } from './hd/px.js';
import { sky, particles } from './hd/fx.js';
import { RGB, T as TR } from './px.js';
import { emu, person, tank, gun, truck, spr, CAMPION } from './art.js';

const W = 1080, H = 1920, PPM = 22;   // sprite pixels per metre
const lerp = (a, b, k) => a + (b - a) * k, seg = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a))), eio = k => k < .5 ? 2 * k * k : 1 - 2 * (1 - k) ** 2;
export const HD_PLANS = new Set([2, 3, 4, 5, 6, 8, 10, 12, 13, 14, 16, 18, 19, 20, 21, 24, 25, 28, 29]);

export function initHD(stage) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(W, H);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  stage.appendChild(renderer.domElement); renderer.domElement.style.width = W + 'px'; renderer.domElement.style.height = H + 'px';
  const camera = new THREE.PerspectiveCamera(34, W / H, .3, 2000);
  const cam = (p, l, fov = 34) => { camera.position.set(...p); camera.lookAt(...l); camera.fov = fov; camera.updateProjectionMatrix(); };

  // —— pixel sprites → textures ——
  const canvasOf = (s, map) => { const p = new PX(s.w, s.h); for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) { const c = s.d[y * s.w + x]; if (c !== TR) p.set(x, y, map ? map(c) : RGB[c]); } return p.done(); };
  const texCache = new Map();
  const tex = (key, mk) => { if (!texCache.has(key)) texCache.set(key, texOf(canvasOf(mk()))); return texCache.get(key); };
  const eT = (o = {}) => { const s = emu(o); return tex(s, () => s); };   // keyed on art.js's cached drawing: a raw o.f (time) in the key leaks a texture per frame until the GPU runs out (L003)
  const pT = (k, o = {}) => { const s = person(k, o); return tex(s, () => s); };
  const tT = (o = {}) => tex('truck' + JSON.stringify(o), () => { const s = spr(70, 36); truck(s, 0, 0, o); return s; });
  const gT = () => tex('gun', () => { const s = spr(34, 12); gun(s, 0, 0); return s; });
  const bb = (tx, w, h, k = 1) => billboard(tx, w / PPM * k, h / PPM * k, { ay: .04 });
  const setTex = (b, tx) => { b.material.map = tx; b.customDepthMaterial.map = tx; b.customDistanceMaterial.map = tx; };
  const put = (b, x, y, z, k = 1, flip = false, tx = null) => { b.visible = true; b.position.set(x, y, z); b.scale.set(flip ? -k : k, k, 1); if (tx) setTex(b, tx); return b; };
  const face = list => { for (const b of list) b.quaternion.copy(camera.quaternion); };
  const gumTx = (() => { const t = new PX(48, 80); t.rect(22, 30, 4, 50, '#c0cbdc'); t.rect(22, 30, 1, 50, '#8b9bb4');
    for (let i = 0; i < 26; i++) t.ellipse(8 + h2(i, 1) * 32, 6 + h2(i, 2) * 34, 7, 5, h2(i, 3) > .5 ? '#86a17f' : '#5b745c'); t.outline(); return texOf(t.done()); })();
  const gum = (sc, x, z, h) => { const b = billboard(gumTx, 48 / 12 * h / 6, h, {}); b.position.set(x, 0, z); sc.add(b); return b; };
  const pxTex = (cols, w, h, f, rep) => { const c = new PX(w, h), r = ramp(cols); c.fill((x, y) => r(f(x, y), x, y)); return texOf(c.done(), rep ? { repeat: rep } : {}); };
  const wheatTex = rep => pxTex(['#b86f50', '#e4a672', '#feae34', '#fee761'], 256, 256, (x, y) => .35 + .5 * h2(x >> 1, y, 3) * (y % 3 ? 1 : .6), [rep, rep]);
  const earthTex = rep => pxTex(['#733e39', '#be4a2f', '#d77643', '#e4a672'], 128, 128, (x, y) => .3 + .45 * h2(x, y, 9), [rep, rep]);
  const plane = (sc, w, h, mat, x, y, z, rx = -Math.PI / 2) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.rotation.x = rx; m.position.set(x, y, z); m.receiveShadow = true; sc.add(m); return m; };
  const lam = o => new THREE.MeshLambertMaterial(o);
  const DAY = { top: '#1f78c8', mid: '#4fb3ec', hor: '#9ad8ff' }, DUSK = { top: '#3a2350', mid: '#c25a7a', hor: '#feae34' };
  const setSky = (sk, c, k = 1) => { sk.u.top.value.set(c.top); sk.u.mid.value.set(c.mid); sk.u.hor.value.set(c.hor); sk.u.k.value = k; };
  const mkSun = (sc, i = 1.7) => { const s = new THREE.DirectionalLight('#fff1d6', i); s.position.set(-8, 14, 9); s.castShadow = true; s.shadow.mapSize.set(1024, 1024);
    Object.assign(s.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25 }); const hemi = new THREE.HemisphereLight('#bfe3ff', '#8a5a2a', .9); sc.add(s, s.target, hemi); return { s, hemi }; };

  // ———————— W: outdoor world (wheat field, red track at z≈6, fence, a eucalyptus wood at x≈-32) ————————
  const Wd = { scene: new THREE.Scene(), pool: [], men: [], guns: [], src: [] }; Wd.scene.fog = new THREE.FogExp2('#9ad8ff', .008);
  { const S = Wd.scene; Wd.sky = sky({ ...DAY, moonI: 0 }); S.add(Wd.sky.mesh); Wd.sun = mkSun(S);
    plane(S, 160, 160, lam({ map: wheatTex(16) }), 0, 0, 0);
    plane(S, 160, 2.6, lam({ map: earthTex(60) }), 0, .012, 6);
    for (let i = 0; i < 46; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(.12, .9, .12), lam({ color: '#733e39' })); p.position.set(-80 + i * 3.5, .45, 4.4); p.castShadow = true; S.add(p); }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(160, .06, .06), lam({ color: '#b86f50' })); rail.position.set(0, .7, 4.4); S.add(rail);
    for (let i = 0; i < 26; i++) gum(S, -60 + i * 4.8 + h2(i, 2) * 3, -16 - h2(i, 3) * 10, 5 + h2(i, 4) * 2.5);
    for (let i = 0; i < 24; i++) gum(S, -40 + h2(i, 11) * 16, -9 - h2(i, 12) * 6, 5 + h2(i, 13) * 2);      // the wood (plan 14)
    for (let i = 0; i < 64; i++) { const b = bb(eT(), 46, 50); b.visible = false; S.add(b); Wd.pool.push(b); }
    Wd.hero = bb(eT({ hero: true }), 46, 50); S.add(Wd.hero);
    for (let i = 0; i < 3; i++) { const b = bb(pT('soldier'), 22, 34); S.add(b); Wd.men.push(b); }
    for (let i = 0; i < 2; i++) { const b = bb(gT(), 34, 12); S.add(b); Wd.guns.push(b); }
    Wd.truck = bb(tT(), 70, 36); S.add(Wd.truck);
    Wd.warm = new THREE.PointLight('#ffb070', 0, 10, 2); S.add(Wd.warm);   // sunset fill so the lorry is not lost in the shade
    Wd.dust = particles(260, (i, t, o) => { const s = Wd.src[i % Math.max(1, Wd.src.length)]; if (!s) { o.a = 0; return; } const age = (t * 1.4 + h2(i, 6)) % 1;
      o.x = s.x - s.dir * age * 2.2; o.y = .15 + age * .9; o.z = s.z + (h2(i, 7) - .5); o.a = .45 * (1 - age); o.s = .2 + age * .35; o.r = .93; o.g = .72; o.b = .5; }, { soft: 1 });
    S.add(Wd.dust); }
  const all = () => [...Wd.pool, Wd.hero, ...Wd.men, ...Wd.guns, Wd.truck];
  const hideAll = () => { for (const b of all()) b.visible = false; Wd.src = []; };
  const runT = (f, o = {}) => eT({ run: true, head: 'mid', f: (Math.floor(f * 4) % 4) / 4, ...o });
  const walkT = (f, o = {}) => eT({ f: (Math.floor(f * 4) % 4) / 4, ...o });
  const day = (k = 1) => { setSky(Wd.sky, DAY); Wd.sun.s.color.set('#fff1d6'); Wd.sun.s.intensity = 1.7 * k; Wd.sun.s.position.set(-8, 14, 9); Wd.sun.hemi.intensity = .9; Wd.scene.fog.color.set('#9ad8ff'); };
  const dusk = () => { setSky(Wd.sky, DUSK); Wd.sun.s.color.set('#ffa860'); Wd.sun.s.intensity = 1.5; Wd.sun.s.position.set(30, 4, -6); Wd.sun.hemi.intensity = .55; Wd.scene.fog.color.set('#e8a070'); };

  // ———————— M: the waterhole (plans 13, 16) ————————
  const M = { scene: new THREE.Scene(), men: [], pool: [] }; M.scene.fog = new THREE.FogExp2('#9ad8ff', .012);
  { const S = M.scene, sk = sky({ ...DAY, moonI: 0 }); S.add(sk.mesh); mkSun(S, 1.6);
    plane(S, 80, 80, lam({ map: earthTex(26) }), 0, 0, 0);
    M.wpx = new PX(96, 64);
    M.water = plane(S, 2, 2, lam({ map: texOf(M.wpx.c), emissive: '#1a6fa0', emissiveIntensity: .35 }), 0, .02, -4); M.water.geometry = new THREE.CircleGeometry(1, 48); M.water.scale.set(4, 2.6, 1);
    const rimM = new THREE.Mesh(new THREE.RingGeometry(1, 1.12, 48), lam({ color: '#e4a672' })); rimM.scale.set(4, 2.6, 1); rimM.rotation.x = -Math.PI / 2; rimM.position.set(0, .015, -4); S.add(rimM);
    const bank = new THREE.Mesh(new THREE.BoxGeometry(12, .9, 1.4), lam({ map: earthTex(4) })); bank.position.set(0, .45, 1.4); bank.castShadow = bank.receiveShadow = true; S.add(bank);
    for (let i = 0; i < 12; i++) { const a = Math.PI * (1.05 + i / 11 * .9); gum(S, Math.cos(a) * 6.5, -5.5 + Math.sin(a) * 4.5, 4.5 + h2(i, 5) * 2.5); }
    for (let i = 0; i < 7; i++) gum(S, -14 + i * 4.6, -16 - h2(i, 8) * 3, 6);
    [['major', { bino: true }], ['soldier', { crouch: true }], ['soldier', { crouch: true }]].forEach(([k, o], i) => { const b = bb(pT(k, o), 22, 34); b.position.set(-1.5 + i * 1.2, 0, 2.4); S.add(b); M.men.push(b); });
    M.gun = bb(gT(), 34, 12); M.gun.position.set(.9, .9, 1.9); S.add(M.gun); M.men.push(M.gun);
    for (let i = 0; i < 14; i++) { const b = bb(eT(), 46, 50); b.visible = false; S.add(b); M.pool.push(b); }
    M.dust = particles(90, (i, t, o) => { o.x = ((h2(i, 1) * 30 + t * 1.6 * (1 + h2(i, 2))) % 30) - 15; o.y = .3 + h2(i, 3) * 2.5; o.z = -12 + h2(i, 4) * 15; o.a = .35; o.s = .06; o.r = .95; o.g = .85; o.b = .7; }, { soft: 1 });
    M.feathers = particles(160, (i, t, o) => { const a = h2(i, 1) * 6.28, r = t * (2 + h2(i, 2) * 5); o.x = Math.cos(a) * r; o.y = .6 + h2(i, 3) * 1.4 + t * 1.2 - t * t * 1.4; o.z = -6.5 + Math.sin(a) * r * .6; o.a = t > 0 && t < 1.4 ? .8 : 0; o.s = .09; const br = h2(i, 4) > .5; o.r = br ? .45 : .9; o.g = br ? .24 : .65; o.b = br ? .22 : .45; }, { soft: 0 });
    S.add(M.dust, M.feathers); }

  // ———————— L: mise en lumière (plans 20–21) ————————
  const L = { scene: new THREE.Scene() }; L.scene.fog = new THREE.FogExp2('#141020', .03);
  { const S = L.scene, sk = sky({ top: '#0c1430', mid: '#141f3c', hor: '#22283c', moonI: 0 }); S.add(sk.mesh);
    plane(S, 40, 40, lam({ map: wheatTex(10) }), 0, 0, 0);
    const barn = new THREE.Mesh(new THREE.BoxGeometry(9, 4.2, .4), lam({ map: texOf(woodPlanks(96, 64, { cols: ['#3e2731', '#733e39', '#b86f50', '#d77643'] }), { repeat: [3, 2] }) }));
    barn.position.set(0, 2.1, -3.2); barn.receiveShadow = true; S.add(barn);
    for (const [x, z, h] of [[-7, -6, 5], [6.5, -7, 6], [-4, -12, 6.5], [9, -11, 5.5]]) gum(S, x, z, h);
    S.add(new THREE.HemisphereLight('#3a4c7a', '#0a0a12', .25));
    L.hero = bb(eT({ hero: true }), 46, 50, 1.15); S.add(L.hero); const hb = blob(.9, .45); hb.position.set(.1, .01, 0); S.add(hb);
    L.major = bb(pT('major'), 22, 34, 1.4); L.major.position.set(-2.3, 0, 3.2); S.add(L.major);
    const black = () => [0, 0, 0], tk = spr(80, 34); tank(tk, 2, 1, 1);
    L.cEmu = billboard(texOf(canvasOf(emu({ hero: true }), black)), 46 / PPM * 1.15, 50 / PPM * 1.15, { ay: .04 });
    L.cTank = billboard(texOf(canvasOf(tk, black)), 80 / PPM * 1.5, 34 / PPM * 1.5, { ay: .04 });
    for (const c of [L.cEmu, L.cTank]) { c.material.colorWrite = false; c.material.depthWrite = false; c.position.set(0, 0, -.05); S.add(c); }
    { // magenta contour of the tank shadow, on the barn wall: the caster projected from the spotlight (x .4, y 2.6, z 7.5) onto the wall (z -3)
      const o = new PX(84, 38); for (let y = 0; y < 34; y++) for (let x = 0; x < 80; x++) if (tk.d[y * 80 + x] !== TR && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => tk.get(x + a, y + b) === TR)) { o.set(x + 2, y + 2, '#ff3d8b'); o.set(x + 3, y + 2, '#ff3d8b'); }
      const k = (7.5 + 3) / (7.5 + .05), w = 84 / PPM * 1.5 * k, h = 38 / PPM * 1.5 * k;
      L.outline = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: texOf(o.done()), transparent: true, depthWrite: false, opacity: .85 }));
      L.outline.position.set(.4 + (0 - .4) * k, 2.6 + (h / 2 - 2.6) * 1 + (0 - 2.6) * (k - 1) * .0, -2.98); L.outline.visible = false; S.add(L.outline); }
    L.spot = new THREE.SpotLight('#fff4dc', 0, 30, .3, .3, 1.2); L.spot.position.set(.4, 2.6, 7.5); L.spot.target = L.hero; L.spot.castShadow = true; L.spot.shadow.mapSize.set(1024, 1024); L.spot.shadow.bias = -.002; S.add(L.spot);
    L.halo = glow('#fff0c8', 1.4, 0); L.halo.position.set(.4, 2.6, 7.3); S.add(L.halo);
    L.fill = new THREE.PointLight('#ffe2c0', 0, 5, 2); L.fill.position.set(0, 1.4, 2.2); S.add(L.fill);
    L.rim = new THREE.PointLight('#ff3d8b', 0, 2.4, 2); L.rim.position.set(0, 1.3, -.6); S.add(L.rim);
    L.tracers = [0, 1, 2, 3, 4, 5].map(() => { const m = new THREE.Mesh(new THREE.BoxGeometry(.9, .04, .04), new THREE.MeshBasicMaterial({ color: '#fff3b0' })); m.visible = false; S.add(m); return m; });
    L.dust = particles(160, (i, t, o) => { o.x = (h2(i, 1) - .5) * 2.4; o.y = (h2(i, 2) * 6 + t * .15 * (1 + h2(i, 3))) % 6; o.z = (h2(i, 4) - .5) * 2 + o.y * .55; o.a = .55; o.s = .045; o.r = 1; o.g = .95; o.b = .8; }, { soft: 1 });
    S.add(L.dust); }

  // ———————— O: the minister's office (plan 8) ————————
  const O = { scene: new THREE.Scene() };
  { const S = O.scene; S.background = new THREE.Color('#2a1c20');
    plane(S, 14, 14, lam({ map: texOf(woodPlanks(96, 96, { cols: ['#3e2731', '#5a3330', '#733e39', '#8a5040'] }), { repeat: [3, 3] }) }), 0, 0, 0);
    const wall = plane(S, 14, 6, lam({ map: texOf(plaster(96, 48, { wall: ['#c9a87a', '#d8bb8c', '#e4c99a', '#efd8ae'] }), { repeat: [3, 1] }) }), 0, 3, -3, 0);
    const side = plane(S, 10, 6, lam({ color: '#c09a6c' }), -4.5, 3, 1, 0); side.rotation.y = Math.PI / 2;
    const win = plane(S, 2.2, 1.8, new THREE.MeshBasicMaterial({ color: '#bfe3ff' }), 2.4, 2.6, -2.98, 0);
    const frameM = lam({ color: '#5a3330' }); for (const [w, h, x, y] of [[2.4, .12, 2.4, 3.55], [2.4, .12, 2.4, 1.65], [.12, 2, 1.25, 2.6], [.12, 2, 3.55, 2.6], [.08, 2, 2.4, 2.6]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, .1), frameM); b.position.set(x, y, -2.95); S.add(b); }
    const pic = new THREE.Mesh(new THREE.BoxGeometry(1, 1.3, .06), lam({ color: '#feae34' })); pic.position.set(-1.8, 2.7, -2.95); S.add(pic);
    const desk = new THREE.Mesh(new THREE.BoxGeometry(3.4, .9, 1.3), lam({ map: texOf(woodPlanks(64, 32, { cols: ['#3e2731', '#733e39', '#8a5040', '#b86f50'] })) })); desk.position.set(.9, .45, -.7); desk.castShadow = desk.receiveShadow = true; S.add(desk);
    O.minister = bb(pT('minister'), 22, 34, 1.5); O.minister.position.set(1.3, 0, -1.6); O.minister.scale.x = -1; S.add(O.minister);
    const ph = new PX(10, 26); ph.rect(4, 4, 2, 18, '#181425'); ph.ellipse(5, 3, 3, 2, '#181425'); ph.rect(1, 22, 8, 3, '#181425'); ph.rect(0, 8, 2, 6, '#181425'); ph.rect(5, 2, 1, 1, '#c0cbdc');
    O.phone = billboard(texOf(ph.done()), 10 / PPM * 1.3, 26 / PPM * 1.3, { ay: .04 }); O.phone.position.set(2.1, .9, -.4); S.add(O.phone);
    O.farmer = bb(pT('farmer'), 22, 34, 1.5); S.add(O.farmer);
    S.add(new THREE.HemisphereLight('#ffe8c8', '#3a2418', 1.0));
    const sunIn = new THREE.DirectionalLight('#fff4dc', 1.6); sunIn.position.set(4, 6, -8); sunIn.target.position.set(0, 0, 1); sunIn.castShadow = true; sunIn.shadow.mapSize.set(1024, 1024); S.add(sunIn, sunIn.target);
    const lamp = new THREE.PointLight('#ffc070', 6, 6, 2); lamp.position.set(-.2, 1.6, -.4); S.add(lamp); const lh = glow('#ffc070', .5, 1); lh.position.copy(lamp.position); S.add(lh);
    const fill = new THREE.PointLight('#ffe2c0', 2, 7, 2); fill.position.set(0, 2, 4); S.add(fill); }

  // ———————— P: Australia in relief on a table (plan 4) ————————
  const P = { scene: new THREE.Scene() };
  const geo = ([lo, la]) => [(lo - 133) * .3, (la + 26) * .3];
  { const S = P.scene; S.background = new THREE.Color('#1e1418');
    plane(S, 40, 40, lam({ map: texOf(woodPlanks(96, 96, { cols: ['#3e2731', '#5a3330', '#733e39', '#8a5040'] }), { repeat: [5, 5] }) }), 0, 0, 0);
    plane(S, 17, 13, lam({ map: pxTex(['#124e89', '#0099db', '#2ce8f5'], 128, 96, (x, y) => .35 + .3 * h2(x >> 2, y >> 1, 4)) }), 0, .02, 0);
    const AUS = [[114, -22], [113.5, -26], [115, -34], [117.5, -35], [124, -33.5], [129, -31.5], [131.5, -31.5], [135.5, -34.8], [137.5, -33], [138.5, -35.5], [140.5, -38], [144, -38.5],
      [146.5, -39], [150, -37.5], [153, -31], [153.5, -28], [153, -25], [149, -21], [146, -18.5], [145.3, -15], [142.5, -10.7], [141.5, -13.5], [141.5, -17], [140, -17.5], [137, -16],
      [136.5, -12.5], [132.5, -11.5], [130, -13], [129.5, -15], [126, -14], [122, -17.5], [121, -19.5], [117, -20.7]];
    const TAS = [[144.6, -40.7], [148.3, -40.9], [148, -43.2], [146, -43.6]], BELT = [[116, -29], [119.5, -30], [119.5, -33.5], [117, -34], [116, -32]];
    const ext = (pts, d, mat, y = 0) => { const sh = new THREE.Shape(pts.map(p => new THREE.Vector2(...geo(p)))); const g = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false });
      const m = new THREE.Mesh(g, mat); m.rotation.x = -Math.PI / 2; m.position.y = y; m.castShadow = m.receiveShadow = true; S.add(m); return m; };
    const land = lam({ map: pxTex(['#733e39', '#be4a2f', '#d77643'], 64, 64, (x, y) => .3 + .5 * h2(x >> 1, y >> 1, 2), [2, 2]) });
    ext(AUS, .32, land, .02); ext(TAS, .32, land, .02); ext(BELT, .05, lam({ color: '#feae34' }), .34);
    P.pin = new THREE.Group(); const stick = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .9), lam({ color: '#181425' })); stick.position.y = .45;
    const head = new THREE.Mesh(new THREE.SphereGeometry(.14, 12, 8), new THREE.MeshLambertMaterial({ color: '#f43f5e', emissive: '#f43f5e', emissiveIntensity: .25 })); head.position.y = .95;
    P.pin.add(stick, head); P.pin.traverse(o => o.castShadow = true); S.add(P.pin);
    const [cx, cy] = geo(CAMPION); P.c = new THREE.Vector3(cx, .34, -cy);
    S.add(new THREE.HemisphereLight('#ffe8c8', '#2a1810', .9));
    const key = new THREE.DirectionalLight('#fff1d6', 1.8); key.position.set(-6, 10, 6); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10 }); S.add(key);
    const lamp = new THREE.PointLight('#ffc070', 4, 14, 2); lamp.position.set(3, 4, 3); S.add(lamp); }

  const post = makePost(renderer, Wd.scene, camera, W, H, { ssaa: 1 });
  post.bloom.strength = .5; post.bloom.radius = .7; post.bloom.threshold = .85;
  const V = post.vig.uniforms; V.amt.value = .55; V.warm.value = .08; V.contrast.value = .22; V.sat.value = 1.12;
  const look = (focus, aper = 220, coc = 14, tc = .5, ta = 12) => { post.dof.focus = focus; post.dof.aper = aper; post.dof.maxCoc = coc; post.dof.tiltAmt = ta; post.dof.tiltC = tc; post.dof.tiltW = .09; post.dof.tiltF = .3; };
  const dist = (x, y, z) => camera.position.distanceTo(new THREE.Vector3(x, y, z));
  const water = t => { const r = ramp(['#124e89', '#0099db', '#2ce8f5', '#9ad8ff']); M.wpx.fill((x, y) => r(.45 + .35 * Math.sin(x * .35 + y * .2 + t * 3) * Math.sin(y * .5 - t * 2), x, y)); M.water.material.map.image = M.wpx.done(); M.water.material.map.needsUpdate = true; };
  let PL21 = 0;

  // ———————— the shots ————————
  // t = film time, lt = time in the shot, sh = the shot from decoupage.json, E(n, k) = time of the k-th event of shot n
  function render(t, n, lt, sh, E) {
    let S = Wd.scene; renderer.toneMappingExposure = 1.05; const d = sh.fin - sh.debut;
    if (n === 4) {                                                                     // the relief map, pin drops on Campion, camera pushes in
      S = P.scene; const k = eio(seg(t, E(4, 1), sh.fin));
      cam([lerp(.5, P.c.x + .6, k), lerp(32, 6.5, k), lerp(22, P.c.z + 6.5, k)], [lerp(0, P.c.x, k), 0, lerp(-.5, P.c.z, k)], 34);
      const drop = seg(t, E(4, 1), E(4, 1) + .2); P.pin.position.set(P.c.x, P.c.y + (1 - drop) * 3, P.c.z); P.pin.visible = t >= E(4, 1);
      look(dist(P.c.x, .3, P.c.z), 200, 12, .5, 10);
    } else if (n === 8) {                                                              // the minister's office
      S = O.scene; const tap = t >= E(8, 1), shake = tap && t - E(8, 1) < .2 ? (Math.floor(t * 40) % 2 ? .05 : -.05) : 0;
      cam([-.3 + shake, 2.6, 7], [.1, 1.2, -1], 34);
      const ring = t < E(8, 0) + .6 ? (Math.floor(t * 20) % 2 ? .04 : -.04) : 0; O.phone.position.x = 2.1 + ring;
      const fx = Math.min(-.6, -4.2 + lt * 2.2); O.farmer.position.set(fx, 0, .3);
      setTex(O.farmer, pT('farmer', tap ? { tap: true } : { walk: fx < -.6, f: (Math.floor(t * 8) % 4) / 4 }));
      face([O.minister, O.phone, O.farmer]); look(dist(.5, 1, -.5), 200, 12, .45, 8);
    } else if (n === 13 || n === 16) {                                                 // the waterhole
      S = M.scene; water(t); M.dust.userData.update(lt); M.pool.forEach(b => b.visible = false);
      if (n === 13) { const k = seg(lt, 0, d); cam([lerp(-1.6, -.8, k), lerp(8.5, 7.6, k), lerp(11.5, 10.2, k)], [0, .2, 1.6], 36); M.feathers.visible = false; look(dist(0, .5, 1.5), 200, 14, .42, 12); }
      else {                                                                             // the ambush: emus come to drink, then burst away
        const burst = Math.max(0, t - E(16, 1));
        cam([-.6, 3.4, 8.6], [0, .8, -4.5], 34);
        M.pool.forEach((b, i) => { const a = h2(i, 5) * 6.28; let x = -3 + (i % 7) * 1, z = -10.5 + Math.min(lt, 2.7) * 1.3 + Math.floor(i / 7) * .9;
          if (burst > 0) { x += Math.cos(a) * burst * 9; z += Math.sin(a) * burst * 5; }
          put(b, x, 0, z, 1, burst > 0 ? Math.cos(a) < 0 : false, burst > 0 ? runT(t * 3 + i * .3) : walkT(t * 1.2 + i * .3)); });
        M.feathers.visible = burst > 0; M.feathers.userData.update(burst);
        look(dist(0, .5, -5), 200, 14, .5, 10); }
      face([...M.men, ...M.pool]);
    } else if (n === 20 || n === 21) {                                                 // mise en lumière
      S = L.scene; const lt2 = t - (PL[20].debut + .5), on = lt2 > .12;
      L.spot.intensity = on ? 70 : 0; L.halo.material.color.set(new THREE.Color('#fff0c8').multiplyScalar(on ? 1.4 : 0)); L.fill.intensity = on ? 2.2 : 0;
      L.major.visible = t >= E(20, 1);
      L.tracers.forEach((m, i) => { const a = E(20, 2), k = ((t - a) * 2.4 + i * .17) % 1; m.visible = t >= a && t < E(20, 3); m.position.set(-6 + k * 12, .6 + (i % 3) * .55, i % 2 ? -1.2 : 1.1); });
      const grow = 1 + Math.floor(seg(t, E(20, 3), PL21) * 3) * .2, m = Math.floor(seg(t, PL21, E(21, 0)) * 4) / 4;
      L.cEmu.visible = m < .5; L.cTank.visible = m >= .5; L.cEmu.scale.setScalar(grow); L.cTank.scale.setScalar(lerp(.7, 1, m));
      L.hero.castShadow = m < .5; L.outline.visible = m >= 1; L.outline.material.opacity = t >= E(21, 1) && t < E(21, 1) + .25 ? 1 : .85;
      L.rim.intensity = t >= E(21, 0) ? (t >= E(21, 1) && t < E(21, 1) + .25 ? 7 : 2.5) : 0;
      L.dust.visible = on; L.dust.userData.update(lt2);
      const k = Math.min(1, lt2 / 12.5); cam([lerp(5, 3.4, k), lerp(6.5, 4.8, k), lerp(17, 13, k)], [0, .3, -1.5], 34);
      face([L.hero, L.major, L.cEmu, L.cTank]); look(dist(0, 1, 0), 300, 18, .5, 14); renderer.toneMappingExposure = .95;
    } else {                                                                           // the outdoor world
      hideAll(); Wd.warm.intensity = 0; n === 28 || n === 29 ? dusk() : day();
      const P5 = Wd.pool, men = Wd.men, tr = Wd.truck;
      if (n === 2) {                                                                     // zoom out: the hero towers over a tiny army
        const k = eio(seg(lt, 0, d - .05)); put(Wd.hero, 0, 0, 0, 1.6);
        men.forEach((b, i) => put(b, 1.4 + i * .5, 0, .8, .7, false, pT(i ? 'soldier' : 'major')));
        cam([lerp(.3, 1.6, k), lerp(2.6, 4.2, k), lerp(4.2, 12, k)], [lerp(0, .9, k), lerp(2.6, 1.2, k), 0], 34); look(dist(.5, 1.2, 0), 160, 10, .5, 8);
      } else if (n === 3) {                                                              // the army, proudly posed in the wheat
        const k = seg(lt, 0, d);
        men.forEach((b, i) => put(b, -1.3 + i * 1.3, 0, 0, 1.2, false, pT(i ? 'soldier' : 'major')));
        Wd.guns.forEach((b, i) => put(b, -.35 + i * 1.3, .05, .6, 1));
        cam([lerp(2.2, -1.2, k), 2.6, 9.5], [0, 1.3, 0], 34); look(dist(0, 1, 0), 200, 12, .55, 10);
      } else if (n === 5) {                                                              // aerial: the herd tramples the wheat
        const k = seg(lt, 0, 2);
        P5.forEach((b, i) => { if (i >= 46) return; const x = -7 - h2(i, 1) * 9 + lt * (5 + h2(i, 3) * 1.8), z = -7 + h2(i, 2) * 12; put(b, x, 0, z, 1, false, runT(t * 2.5 + h2(i, 4))); Wd.src.push({ x, z, dir: 1 }); });
        cam([lerp(-1, 1, k), 17, 13], [lerp(-.5, 1, k), 0, -2.5], 40); look(dist(0, 0, -1), 160, 12, .5, 10);
      } else if (n === 6) {                                                              // the herd keeps growing (≈ 20 000)
        const cnt = Math.min(64, Math.floor(8 + seg(t, sh.debut, E(6, 0) + .35) * 56));
        P5.forEach((b, i) => { if (i >= cnt) return; put(b, -7 + h2(i, 21) * 14, 0, -14 + h2(i, 22) * 16, 1, h2(i, 23) > .5, eT({ head: Math.floor(t * 1.5 + i) % 3 ? 'up' : 'down', f: h2(i, 24) })); });
        cam([0, 6.5, 16], [0, .8, -4], 34); look(dist(0, 0, -4), 160, 12, .55, 10);
      } else if (n === 10) {                                                             // three men climb out of the lorry
        put(tr, 2.4, 0, 6, 1.4, false, tT());
        men.forEach((b, i) => { if (lt < i * .3) return; const x = Math.max(-2.6 + i * 1.5, 1.6 - (lt - i * .3) * 3); put(b, x, 0, 6.8, 1.1, true, pT(i ? 'soldier' : 'major', { walk: x > -2.6 + i * 1.5 + .05, f: (Math.floor(t * 8) % 4) / 4 })); });
        cam([0, 2.8, 15.5], [0, 1.4, 6], 34); look(dist(0, 1, 6.5), 200, 12, .5, 10);
      } else if (n === 12) {                                                             // they creep up; the emus bolt
        const flee = Math.max(0, t - (E(12, 0) - .4));
        men.forEach((b, i) => put(b, -4 + lt * .7 + i * 1.1, 0, 2, 1.1, false, pT(i ? 'soldier' : 'major', { crouch: !flee, walk: true, f: (Math.floor(t * 6 + i) % 4) / 4 })));
        P5.forEach((b, i) => { if (i >= 8) return; const x = 1 + (i % 4) * .9 + flee * (7 + i * .8), z = -.5 - Math.floor(i / 4) * 1.2; put(b, x, 0, z, 1, false, flee ? runT(t * 3 + i * .25) : eT({ head: i % 2 ? 'down' : 'up' })); if (flee) Wd.src.push({ x, z, dir: 1 }); });
        cam([0, 3.4, 12], [0, 1, 0], 34); look(dist(0, 1, 1), 200, 12, .5, 10);
      } else if (n === 14) {                                                             // the edge of the wood: more and more emus come out
        const cnt = Math.min(26, 6 + Math.floor(lt * 8)), peck = t >= E(14, 1);
        P5.forEach((b, i) => { if (i >= cnt) return; const age = lt - (i - 6) / 8 + (i < 6 ? 1 : 0), z = -9 + Math.min(age, 2) * 2.2 + (i % 3) * .5, x = -38 + (i * 1.37 % 1) * 12;
          put(b, x, 0, z, 1, i % 2 === 1, peck && Math.floor(t * 3 + i) % 2 ? eT({ head: 'down' }) : walkT(t * 1.5 + i * .3, { hero: i === 3 })); });
        cam([-32, 4.2, 12], [-32, 1, -2], 34); look(dist(-32, 1, -3), 200, 12, .5, 10);
      } else if (n === 18 || n === 19) {                                                 // the chase: lorry with its gun on the red track
        const tx = -3 + lt * 6 + (n === 19 ? (PL[19].debut - PL[18].debut) * 6 : 0), bump = Math.abs(Math.sin(t * 9)) * .12;
        put(tr, tx, bump, 6, 1.4, false, tT({ mg: true, f: (Math.floor(t * 12) % 2) / 2 })); Wd.src.push({ x: tx - 1.2, z: 6.2, dir: 1 });
        put(men[0], tx - .2, .9 + bump, 5.9, .9, false, pT('soldier'));
        if (n === 19) P5.forEach((b, i) => { if (i >= 5) return; const x = tx - 8 + lt * (3.5 + i * .5) - i * 1.4, look = i === 1 && t >= E(19, 0) && t < E(19, 0) + 1.2;
          put(b, x, 0, 6.9 + (i % 2) * .4, 1, false, runT(t * 3 + i * .3, look ? { back: true } : {})); Wd.src.push({ x, z: 7, dir: 1 }); });
        cam([tx + 1, 2.6, 15], [tx + 1, 1.1, 6], 34); look(dist(tx, 1, 6), 200, 12, .5, 10);
      } else if (n === 24 || n === 25) {                                                 // the way home: emus line the road; the lorry turns back
        P5.forEach((b, i) => { if (i >= 9) return; const wave = i === 4 && t >= E(24, 1) && n === 24; put(b, -5 + i * 1.25, 0, 3.6, 1, true, eT({ head: 'up', hero: i === 4, wing: wave && Math.floor(t * 6) % 2 ? 1 : 0, f: i * .3 })); });
        const turn = n === 25 && lt > .6, x = n === 24 ? 6 - lt * 2.6 : turn ? -3.8 + (lt - .6) * 3 : -3.8 - lt * .6;
        put(tr, x, 0, 6, 1.4, !turn, tT({ f: (Math.floor(t * 12) % 2) / 2 })); Wd.src.push({ x: x + (turn ? -1.2 : 1.2), z: 6.2, dir: turn ? 1 : -1 });
        cam([0, 3, 15.5], [0, 1.2, 5], 34); look(dist(0, 1, 5), 200, 12, .5, 10);
      } else if (n === 28) {                                                             // into the sunset
        put(tr, -1.5 + lt * 3, 0, 6, 1.4, false, tT({ f: (Math.floor(t * 12) % 2) / 2 })); Wd.src.push({ x: -2.7 + lt * 3, z: 6.2, dir: 1 });
        Wd.warm.intensity = 7; Wd.warm.position.set(-1.5 + lt * 3 - 2, 3, 9);
        cam([-11.5, 2.4, 9.8], [10, 1.5, 5.4], 34); look(dist(-2, 1, 6), 200, 12, .5, 10);
      } else if (n === 29) {                                                             // the hero settles back into the wheat
        put(Wd.hero, 0, 0, 0, 1.3, false, eT({ hero: true, sit: lt > .5 }));
        cam([1.4, 2.4, 7.5], [0, 1.1, 0], 34); look(dist(0, 1, 0), 220, 14, .55, 10);
      }
      Wd.dust.userData.update(t); face(all());
    }
    post.dof.scene = S; if (post.dof.ao) post.dof.ao.scene = S;
    post.composer.render();
  }
  let PL = {};
  return { canvas: renderer.domElement, render, setPlans: p => { PL = p; PL21 = p[21].debut; } };
}
