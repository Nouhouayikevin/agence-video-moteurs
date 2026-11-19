# Nan, sérieux ?! Pixel — Style Prompt

Made from a blank page; techniques from 16-bit Pixel RPG (pixel-rpg) in Lemo-Opuscar.
Default size: 1080×1920 (shorts). Long videos: 1920×1080, same pixel size.

> House style of the French channel « Nan, sérieux ?! »: surprising true facts told as funny stories. An invisible narrator (the house voice) tells the story; the pixel world illustrates it. Channel rules live in `~/agence-video/nan_serieux/RENDU.md`; this file only holds the look.

## 1. Essence, and what it is not
- A **narrated true story** in a bright 16-bit pixel world: everything, text included, in an indexed framebuffer scaled ×6 nearest-neighbour (9:16 = 180×320 px; 16:9 = 320×180 px).
- **The world is colourful and in daylight**: blue sky, golden fields, red earth. Never gloomy.
- **Game UI is seasoning only**: stamps (RATÉ, VRAI), proof badges (« VRAI · 1932 »), counters, a scoreboard, an inventory. Never a level/boss structure.
- Characters are **mute and illustrate**; no mascot; the narrator is never shown.
Not a game parody, not a dark "mystery" channel look, not HD-2D, not CRT.

## 2. Materials & rendering
- Indexed framebuffer (`Uint8Array`) + lookup tables, integer-pixel camera, ordered (Bayer) dither for gradients (`demo/px.js`).
- Master palette ENDESGA-32 + world additions (khaki ramp, eucalyptus grey-greens, daytime sky blues) + **protected UI/accent indices** that no darkening touches.
- Sprites drawn in code (`demo/art.js`): shapes + global 1-px ink outline; one rig per kind of character. Close-ups of a hero are drawn natively larger; whole-frame camera zoom is by an even integer factor (`zoomFB`), never by mixing pixel sizes in one frame.

## 3. Colour logic
- Daylight palette everywhere. World whites use the darkenable white (19), never the UI white.
- **Protected colours**: magenta `#FF3D8B` **only for the mise en lumière and the brand « ?! » (logo, thumbnail)**; cerise `#F43F5E` and coral `#FF6B3D` for stamps, alerts and numbers; UI white and UI ink for boxes. **Never gold in the UI** (gold wheat in the world is fine).

## 4. Type & subtitles
- Original pixel font (from pixel-rpg) **with French accents** (é è ê à ç É « » … ≈); capitals carry their accents above the cap.
- **Burned-in subtitles** in a small white box with ink border at y≈214 of 320 (just under the centre, above the app UI). Words come from the validated script, times from the voice.
- **One keyword or number per sentence** in the top third (y 30–100), 2× or 3× scale, ink outline; numbers in coral; identical to what the voice says.
- Nothing important in the bottom ~20 % or on the right edge (platform UI).
- **Rich scenes** (Kev's law of detail, 2026-11-09): a pixel shot that tells a scene is built from `code/kit.js` (sky with clouds, layered hills, grass, sand, sea with highlights, real palms, round trees, building facades with framed windows, fire, shadows), as detailed as an HD-2D shot. Reference shots: the L003 `main.js` (Koh-Lanta beach, backyard pool, painter's studio, school and bus, Stanford quad, New York street).
- **Subtitles never hide an important pixel text** (Kev, 2026-11-09). The subtitles stay where they are: keywords, numbers and labels move **above the subtitle box**, with a margin, in 16:9 and 9:16. A text that holds attention (a number, a list of crimes, the word under a drawing) stays readable while a subtitle is on screen; plain scenery may pass behind, case by case. Seen in a long video: a blue word, an orange list of crimes and a big « 4 » all covered by subtitles. Check at step 5: grab a frame at every keyword's middle **with subtitles on** and look; any keyword box that overlaps the subtitle box is moved up.
- Every keyword stays readable: chars ÷ 15 + 1.5 s (`readcheck`). A short text may start up to 1 s earlier inside its shot; a keyword or a label may run on into the next shot, **never onto a chapter card**; a **stamp never leaves its shot** (it pops on an action). Code: reading-time pass at the end of the overlays in the reference `fr/episodes/L001-cheval-hans/05-rendu/film/main.js`. **Two keywords a second apart** (« VOL », « COUPS », « FEU ! ») can't both get their reading time in one slot (the newest wins and cuts the first): stack them, the second in slot `top2` (`K(…, { slot: 'top2', y: 36 })`, `y: 44` under a big ×3 word), the third in `top3`; in 9:16 they share one place again (`overlays()` in `fr/episodes/L003-ia-ville/05-rendu/film/main.js`). Don't repeat a word the chapter card just showed (L003: « GROK » right after « GROK, GTA EN VRAI », removed). Target: `readcheck` with **0 BAD** (L003 started at 67).

## 5. Motion quality
- 24 fps, sprites step at 4–8 fps, camera and parallax on integer pixels.
- A new visual beat every ~2 s (cut, stepped zoom, new text, movement).
- Stamps pop with a 2-px shake; counters roll; palette changes by steps, never alpha.

## 6. Camera grammar
Side views of the world (field, track, road), aerial "maquette" views, close-ups, a pixel map with a pin, a view through an object (binoculars), stepped integer zooms. Subject centred, above the subtitle line.

## 7. Sound palette
(Decided at the sound step of each episode, per RENDU.md §6.) Bright, curious chiptune-flavoured score that ducks under the house voice; synthesised foley punctuating actions; a crystalline « tic » on every mise en lumière (the channel's signature sound).

## 8. Native moves
- **Mise en lumière (signature)**: the world steps down to dark in 3 palette steps, a Bayer-edged spotlight keeps full colour on the key element, protected colours (magenta contour, UI) stay bright; then colour floods back through a dither wave. 1–3 per short.
- **Merged silhouette**: two shapes become one ink silhouette with a magenta outline (the emu that is a tank).
- **Scoreboard** that evolves through the story; **proof badge**; **stamps**; **game inventory**.

## 9. Pitfalls
- **A character missing from `font.js` is drawn as « ? »** (2026-11-15): `glyphW`/`text` fall back to `G['?']`, so `'ÉTAT A  |  ÉTAT B'` showed « ÉTAT A ? ÉTAT B » on screen, and an English `"DEAL"` would too (`|` and `"` have no glyph). Before rendering, list every character of the on-screen strings that has no `def(...)` in `font.js`; use `·` instead of `|`, apostrophes or « » instead of `"`, or add the glyph.
- **A `//` comment in the middle of a one-line shot hides the rest of the line** (2026-11-16): the shots are written one per line, so a `// why` added after a statement silently comments out every drawing call after it (a magnifier vanished, no error). Inside a line, use `/* … */`; `//` only at the very end of a line.
- **Moving something to the side of a pixel shot breaks its 9:16 crop** (2026-11-17): the extracts show a pixel shot cropped to its centre unless it is in `PZ` (main.js, shown whole). A calendar moved to the left to free room for a stamp came out cut in half in the extract. After any layout change in a pixel shot, check that shot in the extract too, and add it to `PZ` if its content reaches the sides.
- UI white used for clouds stays white in the dark → world whites use index 19.
- Text near the end of a shot fails reading time → carry it into the next shot (overlay list), or move the subject.
- Subjects drawn below y≈205 hide behind the subtitle box.
- Real flags and logos: use generic pennants and invented mastheads.
- No gore: bullets miss, animals run.
- Font: before rendering, check that **every character of the script** exists in `font.js` (œ Œ Ï ✔ < © were once missing: missing glyphs vanish silently).
- Subtitles come from `02-script/voix-off.md` (numbers in digits), **never** from `03-voix/texte-envoye.txt` (numbers in words, for the voice only).
- Line breaks: French « ? ! : ; » must never start a line alone (seen: a lone « ? » pushed onto line 2). `wrap()` in `font.js` now ties them to the word before with a no-break space, and `\n` forces a break where the sense wants it (« IL SAIT…\nOU IL LIT TES GESTES ? »). Long keywords: choose the break yourself.
- An initial is not the end of a sentence: « B. F. Skinner » must never be cut after « B. » or « F. » (seen: a lone « F. » shown 0.1 s). `INIT` in the long-video reference `fr/episodes/L002-projet-pigeon/05-rendu/subs.py`.
- Subtitles shorter than 0.6 s on screen are unreadable (e.g. a one-word line shown 0 s, « Un. Deux. » shown 0.3 s): `05-rendu/subs.py` merges them with a neighbour (the start of their sentence, else the next sentence), even across two sentences.
- A subtitle line never ends on a small word (« soldats de la » / « Grande Guerre », « ministre de la » / « Défense »): wait up to 64 characters for the next comma or full stop, and start a new line on a new clause (ce, qui, que, mais, puis, comme). Code: `soon()` and `SMALL` in a short's `05-rendu/subs.py` (the 9:16 reference: `fr/episodes/S001-guerre-emeus/05-rendu/subs.py`).
- Merging short subtitles leaves fewer changes on screen: a pixel document can then hold still over 2.5 s (seen: chapter cards, a targeting screen, a letter, 2.6 to 3 s). Re-run the frozen-picture check (`freezedetect`) after any subtitle change; a still pixel shot gets `breathe()` (the whole picture drifts 1 px, slowly; 2 px when the shot is shown small in 9:16, or the drift is too small to count), reference `fr/episodes/L002-projet-pigeon/05-rendu/film/main.js`.
- Chapter cards: hold them long enough to read their **title** (readcheck on the title; 2.6 s for « LA DÉMONSTRATION »), set in the pauses of `04-decoupage/caler.py`.
- Subtitles show numbers in digits: the display script (`02-script/voix-off.md`) writes « 20 000 », « 3 hommes »; only the text sent to the voice spells them out.
- Contact sheet in `build.sh`: sort the stills on the **file name** (`awk -F/ '{print $NF"\t"$0}' | sort -t_ -k2 -g | cut -f2`), never on the full path: the « _ » of `nan_serieux` made `sort -t_` shuffle the whole sheet.
- 9:16 extracts (`main.js` `?v`): `thumb()`, `cardV()` (hook and end card), `PZ` (pixel shots shown whole) and `kwY` are **per episode**; copied from the previous episode, they bring back its hook card and its shot numbers. In 9:16 a keyword shrinks until it fits above the picture **including its height** (L003: a 2-line keyword over a tall pixel shot started above the top edge and lost its first line; `kw()` now lowers the size until the block starts at y ≥ 8), and is sized on what `wrap()` never breaks (a word with its « ? », a `\n` line); bind « 15 × 15 CM », « À L'AVEUGLE » with `\u00a0`. Overlays like the MYSTÈRE gauge get their own small 9:16 spot (pasted ×2 they cover the texts).
- Counters: clamp the value and hide the counter while n < 1 (otherwise it shows « -4 » or « 0 »).
- **Again on 2026-11-09**: a comment added by a text replacement at the end of a fragment swallowed the shot's closing `};` (« Unexpected end of input », a render lost). When a replacement adds a comment, put it after the last `}` of the line, then render one still before the full render.
- JS: never put a `//` comment in the middle of a one-line statement: it swallows the rest of the line and the whole film fails (« Unexpected end of input »). `build.sh` runs `node --check` on the film files first, but also run `node --check` **after every edit**, before any test render (at a step 7 review the same mistake came back when a comment was added by a text replacement in the middle of a line). **`node --check` does not catch it when the swallowed part is a whole statement** (the line stays valid, the code just never runs: a hero missing from a thumbnail, a phone missing from an office, a light that never dims). `build.sh` also runs `code/commentaires.py`, which lists such lines (whole-line comments are skipped: example code in a file header, like `voxel.js`, is not swallowed code).
- Shot ids are strings everywhere (`String(p.plan)`): a number id is not found in `HD_PLANS`.

- **Check glyphs for every language**: the font had no straight double quote `"`, so an English keyword came out as `?horse.?`. Now in `code/font.js`; older episode copies of `font.js` do not have it.
- **Portrait keywords** (`kw` in vertical mode) wrap at double size: a longer English line can leave one word alone on the next line, over the picture. Lower `sc` in vertical mode.

- **Missing glyphs (L004, 2026-11-13)**: a character the font does not have is drawn as « ? » (« 180 ?C », « AO?T », « ?700 »). Before rendering, check every on-screen string against `font.js` (render it once and look) and add the glyph (`def()`), never rely on the fallback. Added so far: ° Ä Å Û ~.
- **A « // » comment added at the end of a line of `font.js` or any film file swallows everything after it on that line** (L004: the accents Ô Ù Û Î vanished). Run `python3 -I style-pixel/code/commentaires.py <film>/*.js` after **every** edit of a film file, not only in `build.sh`.

## 10. Engine
`code/` (copied to `demo/` for Lemo): `px.js` (indexed framebuffer, palette, protected darken), `font.js` (pixel font + French), `art.js` (sprites, props, backgrounds, map, zoom). The episode's `main.js` (reference: `fr/episodes/S001-guerre-emeus/05-rendu/film/`) directs the shots and mixes pixel and HD-2D (`../style-hd2d/`).

## 11. Variation space
Story, structure, settings, characters, shots and pacing come from each episode's script and découpage. Keep the colour logic, the subtitle/keyword placement and the mise en lumière.
