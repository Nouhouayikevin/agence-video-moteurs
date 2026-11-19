// Textes pixel cachés par les sous-titres (Kev, 2026-11-09 ; nan_serieux/RENDU.md §4) : node ~/agence-video/outils/soustitres.mjs <dossier film> [--step 0.25] [--croise] [--q 'v=1&ext=E1']
// Le film doit exposer window.SUBTX(t) → { tx: [{s, x0, y0, x1, y1}], sub: {x0, y0, x1, y1, s} | null } en pixels du dessin (320×180) : voir main.js de L003.
// Liste chaque texte dont la boîte touche celle du sous-titre (marge de 2 pixels), regroupé par texte, avec ses temps.
if (process.argv.includes('--help')) { console.log((await import('fs')).readFileSync(new URL(import.meta.url), 'utf8').split('\n').filter((l, i, a) => a.slice(0, i + 1).every(x => x.startsWith('//'))).map(l => l.replace(/^\/\/ ?/, '')).join('\n')); process.exit(0); }   // quick help: the header, nothing run
const { openDemo, closeServer } = await import((await import('os')).homedir() + '/lemo-opuscar/core/render/page.mjs');   // ~ here or on the Google machine (2026-11-19: a /home/kev path broke it there)
const dir = process.argv[2], i = process.argv.indexOf('--step'), STEP = i > 0 ? +process.argv[i + 1] : .25;
const qi = process.argv.indexOf('--q'), Q = qi > 0 ? process.argv[qi + 1] : '';   // --q 'v=1&ext=E1' : a 9:16 extract or LSO
const { browser, page } = await openDemo(dir, Q.includes('v=') ? { w: 1080, h: 1920, q: Q } : { w: 1920, h: 1080, q: '' });
if (process.argv.includes('--sans3d')) await page.evaluate(() => { window.NO3D = true; });   // films whose hd.render() honours window.NO3D: texts only, fast without a GPU (L004 EN, 2026-11-19)
const hits = await page.evaluate(STEP => { const out = {};
  for (let t = 0; t <= window.DUR; t += STEP) { const { tx, sub } = window.SUBTX(t); if (!sub) continue;
    for (const b of tx) if (b.x1 > sub.x0 - 2 && b.x0 < sub.x1 + 2 && b.y1 > sub.y0 - 2 && b.y0 < sub.y1 + 2) { const o = out[b.s] ??= { s: b.s, t0: t, t1: t, y0: b.y0, y1: b.y1, sub: sub.y0 }; o.t1 = t; } }
  return Object.values(out); }, STEP);
// --croise : aussi deux textes qui se touchent (un titre posé sur l'en-tête d'un papier, Kev 2026-11-16)
const cross = process.argv.includes('--croise') ? await page.evaluate(STEP => { const out = {};
  for (let t = 0; t <= window.DUR; t += STEP) { const { tx } = window.SUBTX(t);
    for (let i = 0; i < tx.length; i++) for (let j = i + 1; j < tx.length; j++) { const a = tx[i], b = tx[j];
      if (a.s !== b.s && a.x1 > b.x0 && a.x0 < b.x1 && a.y1 > b.y0 && a.y0 < b.y1) { const k = a.s + ' / ' + b.s; (out[k] ??= { k, t0: t, t1: t }).t1 = t; } } }
  return Object.values(out); }, STEP) : [];
await browser.close(); closeServer();
const mm = t => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
for (const h of hits) console.log(`${mm(h.t0)}–${mm(h.t1)}  y ${h.y0}–${h.y1} (sous-titre dès y ${h.sub})  « ${h.s} »`);
console.log(hits.length ? `${hits.length} texte(s) touché(s) par les sous-titres` : 'aucun texte sous les sous-titres');
for (const c of cross) console.log(`${mm(c.t0)}–${mm(c.t1)}  textes l'un sur l'autre : « ${c.k} »`);
if (process.argv.includes('--croise')) console.log(cross.length ? `${cross.length} paire(s) de textes l'un sur l'autre` : 'aucun texte sur un autre');
process.exit(hits.length || cross.length ? 1 : 0);
