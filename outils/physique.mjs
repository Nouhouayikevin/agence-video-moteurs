// Logique physique mesurée dans la 3D (Kev, 2026-11-17 : des gens qui rentrent dans les tables, la caisse, les caddies ; quelqu'un assis enfoncé dans un fauteuil).
// node ~/agence-video/outils/physique.mjs <dossier film> [--step 0.5] [--q "v=1&ext=LSO1"] [--size 1080x1920]
// Le film doit exposer window.__HD = { THREE, S, people } (hd2d.js, render()). Pour chaque personnage visible, toutes les <step> s :
//  - DEUX : deux personnes à moins de 0,35 m l'une de l'autre (corps l'un dans l'autre) ;
//  - DANS : quelque chose du décor à moins de 0,14 m du centre du corps (rayons horizontaux à 0,4 et 0,9 m) : il rentre dans un meuble, un caddie, la caisse, un mur ;
//  - SOUS : un objet du décor au-dessus de lui entre 0,25 et 1,1 m (rayon vers le haut) : il est dans une table, un comptoir, un fauteuil.
// Regroupé par plan ; chaque ligne est à vérifier sur les bandes à 0,2 s (un faux positif possible : quelqu'un assis sur une chaise).
if (process.argv.includes('--help')) { console.log((await import('fs')).readFileSync(new URL(import.meta.url), 'utf8').split('\n').filter((l, i, a) => a.slice(0, i + 1).every(x => x.startsWith('//'))).map(l => l.replace(/^\/\/ ?/, '')).join('\n')); process.exit(0); }   // quick help: the header, nothing run
const { openDemo, closeServer } = await import((await import('os')).homedir() + '/lemo-opuscar/core/render/page.mjs');   // ~ here or on the Google machine (2026-11-19: a /home/kev path broke it there)
const dir = process.argv[2], arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const STEP = +arg('--step', .5), [w, h] = arg('--size', '1920x1080').split('x').map(Number);
const { browser, page } = await openDemo(dir, { w, h, q: arg('--q', '') });
if (process.argv.includes('--sans-image')) await page.evaluate(() => { window.NODRAW = true; });   // films whose hd.render() honours window.NODRAW: scene placed, not drawn (L004 EN, 2026-11-19)
const out = await page.evaluate(STEP => {
  const res = {}, D = window.DEC || null;
  const plans = (window.PLANS || []);
  for (let t = 0; t <= window.DUR; t += STEP) {
    window.render(t); const H = window.__HD; if (!H || !H.S) continue;
    const { THREE, S, people } = H; const vis = people.filter(p => { if (!p.visible) return false; let o = p; while (o.parent) { if (!o.visible) return false; o = o.parent; } return o === S; });
    if (!vis.length) continue;
    const isP = o => { while (o) { if (vis.includes(o) || people.includes(o)) return true; o = o.parent; } return false; };
    const solids = []; S.traverse(o => { if (o.isMesh && o.visible && !isP(o)) { let v = true, q = o; while (q) { if (!q.visible) { v = false; break; } q = q.parent; } if (v) solids.push(o); } });
    const rc = new THREE.Raycaster(), pos = vis.map(p => p.getWorldPosition(new THREE.Vector3()));
    const key = String(window.PLAN_AT ? window.PLAN_AT(t) : '?'), add = (k, s) => { const r = res[key + '|' + k] ??= { plan: key, k, t0: t, t1: t, s, n: 0 }; r.t1 = t; r.n++; };
    for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) { const d = Math.hypot(pos[i].x - pos[j].x, pos[i].z - pos[j].z); if (d < .35 && Math.abs(pos[i].y - pos[j].y) < .5) add(`DEUX ${i}-${j}`, `${d.toFixed(2)} m`); }
    vis.forEach((p, i) => { const c = pos[i];
      for (const y of [.4, .9]) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { rc.set(new THREE.Vector3(c.x, c.y + y, c.z), new THREE.Vector3(dx, 0, dz)); rc.far = .14; const hit = rc.intersectObjects(solids, false)[0]; if (hit) { add(`DANS ${i}`, `${hit.object.name || hit.object.type} à ${hit.distance.toFixed(2)} m, ${y} m de haut`); break; } }
      rc.set(new THREE.Vector3(c.x, c.y + .25, c.z), new THREE.Vector3(0, 1, 0)); rc.far = .85; const up = rc.intersectObjects(solids, false)[0]; if (up) add(`SOUS ${i}`, `objet à ${(up.distance + .25).toFixed(2)} m au-dessus des pieds`); });
  }
  return Object.values(res);
}, STEP);
await browser.close(); closeServer();
const mm = t => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
for (const r of out.sort((a, b) => a.t0 - b.t0)) console.log(`plan ${r.plan}  ${mm(r.t0)}–${mm(r.t1)}  ${r.k}  (${r.n}×)  ${r.s}`);
console.log(out.length ? `${out.length} point(s) à vérifier` : 'aucune collision mesurée');
process.exit(0);
