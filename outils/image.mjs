// One picture of a film (thumbnail, check still) that also works on a Google machine WITHOUT graphics card (2026-11-19):
// still.mjs gives up after 30 s of screenshot, which a 3D frame in software exceeds; here the screenshot may take up to 20 min.
// node ~/agence-video/outils/image.mjs <film> <t> <out.jpg> [--q 'v=1&ext=LSO1&nosub=1'] [--size 1080x1920]   (from ~/lemo-opuscar or anywhere)
if (process.argv.includes('--help')) { console.log((await import('fs')).readFileSync(new URL(import.meta.url), 'utf8').split('\n').filter((l, i, a) => a.slice(0, i + 1).every(x => x.startsWith('//'))).map(l => l.replace(/^\/\/ ?/, '')).join('\n')); process.exit(0); }   // quick help: the header, nothing run
const { openDemo, closeServer } = await import((await import('os')).homedir() + '/lemo-opuscar/core/render/page.mjs');
const [dir, t, out] = process.argv.slice(2), arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const [w, h] = arg('--size', '1920x1080').split('x').map(Number), t0 = Date.now();
const { browser, page } = await openDemo(dir, { w, h, q: arg('--q', '') });
await page.evaluate(t => window.render(t), parseFloat(t));
await page.screenshot({ path: out, type: 'jpeg', quality: 92, timeout: 1200000 });
console.log(out, Math.round((Date.now() - t0) / 1000) + ' s'); await browser.close(); closeServer();
