// Capture d'une page web publique en image (un article, une page de notes), pour les vrais documents d'un film (MEMOIRE règles 41-42).
// node ~/agence-video/outils/capture.mjs <lien https> <sortie.png> [--size 1600x1000] [--sel 'css de l'élément à garder'] [--attente 4000]
// Sur la machine Google (Chrome de Lemo). Sans compte connecté ; une page qui exige une connexion ou un robot-test échoue : prendre une autre source.
if (process.argv.includes('--help')) { console.log((await import('fs')).readFileSync(new URL(import.meta.url), 'utf8').split('\n').filter((l, i, a) => a.slice(0, i + 1).every(x => x.startsWith('//'))).map(l => l.slice(3)).join('\n')); process.exit(0); }
const home = (await import('os')).homedir();
const { chromium } = await import(home + '/lemo-opuscar/node_modules/playwright-core/index.mjs');
const { EXE, ARGS } = await import(home + '/lemo-opuscar/core/render/browser.mjs');
const [url, out] = process.argv.slice(2), arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
if (!/^https:\/\//.test(url || '')) { console.error('lien https attendu'); process.exit(2); }
const [w, h] = arg('--size', '1600x1000').split('x').map(Number);
const browser = await chromium.launch({ executablePath: EXE, args: ARGS });
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, locale: 'en-US' });
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(Number(arg('--attente', '4000')));
for (const t of ['Reject all', 'Reject', 'Tout refuser', 'Refuser', 'Decline', 'Only necessary']) { const b = page.getByRole('button', { name: t }); if (await b.count()) { await b.first().click().catch(() => {}); break; } }   // cookies : the most private choice
const sel = arg('--sel', null);
if (sel) await page.locator(sel).first().screenshot({ path: out }); else await page.screenshot({ path: out });
console.log(out); await browser.close();
