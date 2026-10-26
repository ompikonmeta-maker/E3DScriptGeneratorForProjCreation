#!/usr/bin/env node
// Browser smoke test of dist/e3d-setup-generator.html (needs Playwright + Chromium; optional).
//   NODE_PATH=$(npm root -g) node tests/ui-smoke.js [screenshotDir]
// Offline; asserts no network requests and no console errors. Walks the 4-step flow with the ZRF
// preset: open config, tour, matrix paint, paste import, blocked delete, block insert + format,
// Export Config match, ZIP download, autosave restore; then runs tests/run-tests.html.
const path = require('path'), fs = require('fs'), os = require('os');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { console.log('SKIP: playwright not installed'); process.exit(0); }
const root = path.join(__dirname, '..');
const shots = process.argv[2];
const load = require('./load');

(async () => {
  const E = load();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  await ctx.setOffline(true);
  const page = await ctx.newPage();
  const problems = [];
  page.on('console', m => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
  page.on('pageerror', e => problems.push('pageerror: ' + e.message));
  page.on('request', r => { if (!/^(file|data|blob):/.test(r.url())) problems.push('request: ' + r.url()); });
  const fail = msg => { throw new Error(msg); };
  const shot = async n => { if (shots) { fs.mkdirSync(shots, { recursive: true }); await page.screenshot({ path: path.join(shots, n + '.png') }); } };
  const state = () => page.evaluate(() => ({ dbs: UI.App.r.counts.dbs, zones: UI.App.r.counts.zones, errors: UI.App.errors().map(i => i.id), warnings: UI.App.warnings().length, screen: UI.App.ui.screen }));
  const undo = () => page.evaluate(() => { document.activeElement.blur(); UI.App.undo(); });
  const step = n => page.click(`#stepper [data-screen="${n}"]`);

  await page.goto('file://' + path.join(root, 'dist/e3d-setup-generator.html'));
  await page.waitForSelector('.start');
  await shot('0-start');

  // Open config from the start screen -> summary -> lands on Cek & Unduh, tour starts.
  const chooser = page.waitForEvent('filechooser');
  await page.click('.choice[data-act="openConfig"]');
  await (await chooser).setFiles(path.join(root, 'presets/zrf.config.json'));
  await page.click('dialog.dlg button.filled');
  await page.waitForSelector('#tour .bubble');
  await page.click('#tourSkip');
  let s = await state();
  if (s.screen !== 4 || s.dbs !== 250 || s.zones !== 2876 || s.errors.length || s.warnings !== 5) fail('preset state ' + JSON.stringify(s));
  await shot('4-finish');

  // Step 2: paint one matrix cell off (pointer drag), then undo.
  await step(2);
  const cell = page.locator('.mc[data-r="T"][data-c="HB"]');
  await cell.evaluate(el => el.scrollIntoView({ block: 'center' }));
  const box = await cell.boundingBox();
  await page.mouse.move(box.x + 5, box.y + 5); await page.mouse.down(); await page.mouse.up();
  await page.waitForFunction(() => UI.App.r.counts.dbs === 249);
  await undo();
  await shot('2-structure');

  // Step 1: paste-import into Fluid with column mapping dialog; blocked delete of a used list.
  await step(1);
  await page.click('[data-act="listSel"][data-id="fluid"]');
  await page.evaluate(() => { UI.importTable({ name: 'tempelan', text: 'Kode\tDeskripsi\nZ1\tTest one\nZ2\tTest two' }, 'fluid'); });
  await page.waitForSelector('dialog.dlg .map');
  await page.click('dialog.dlg button.filled');
  await page.waitForFunction(() => UI.App.attr('fluid').rows.length === 109);
  await undo();
  await page.click('[data-act="listSel"][data-id="disiplin"]');
  await page.click('[data-act="listMenu"]');
  await page.click('#popmenu button:has-text("Hapus daftar")');
  await page.waitForSelector('dialog.dlg');
  if (!/masih dipakai/.test(await page.textContent('dialog.dlg h2'))) fail('delete of a used list not blocked');
  await page.click('dialog.dlg button');
  await shot('1-lists');

  // Step 3: append a block from the palette, then format the first block lower-case (V14 warnings).
  await step(3);
  await page.click('.rung[data-k="site"]');
  await page.click('.palette .blk.pal[data-add="{Area.kode}"]');
  if (!(await page.evaluate(() => UI.App.config.templates.site)).endsWith('{Area.kode}')) fail('block insert');
  await undo();
  await page.click('.bar .blk.tok >> nth=0');
  await page.click('#popmenu button:has-text("huruf kecil")');
  await page.waitForFunction(() => UI.App.config.templates.site.includes('|lower'));
  if ((await state()).warnings <= 5) fail('V14 warnings expected');
  await undo();
  await shot('3-names');

  // Step 4: match with an Export Config -> V07/V08 -> clear.
  const xlsx = await E.xlsx.write([
    { name: 'Teams', rows: [['Team name'], ['Name'], ['ZRFPIP']] },
    { name: 'Databases', rows: [['comment row'], ['#Keyword', 'Owning Team', 'Name', 'Description', 'Type', 'Claim Mode', 'Number'], ['DB', 'ZRFPIP', 'DESI-L-M1D', 'x', 'DESI', 'IMPLICIT', 10201]] },
  ]);
  const xfile = path.join(os.tmpdir(), 'e3d-export-config.xlsx');
  fs.writeFileSync(xfile, xlsx);
  await step(4);
  const ch2 = page.waitForEvent('filechooser');
  await page.click('.dropzone[data-act="matchProject"]');
  await (await ch2).setFiles(xfile);
  await page.waitForFunction(() => UI.App.errors().some(i => i.id === 'V07') && UI.App.errors().some(i => i.id === 'V08'));
  if (!(await page.locator('#status.bad').count())) fail('status should be red');
  await page.click('[data-act="matchClear"]');
  await page.waitForFunction(() => UI.App.errors().length === 0);

  // Download the package.
  const dl = page.waitForEvent('download');
  await page.click('.hero [data-act="generateZip"]');
  const entries = await E.zip.read(fs.readFileSync(await (await dl).path()));
  const names = entries.map(e => e.path);
  if (names.length !== 36 || !names.includes('00-README.txt') || !names.includes('ZRF-E3D-Register.xlsx') || !names.includes('config.json')) fail('zip entries ' + names.length);
  const book = await E.xlsx.read(entries.find(e => e.path.endsWith('.xlsx')).data);
  if (book.find(x => x.name === 'DB Register').rows.length !== 251) fail('register rows');
  const cfg = new TextDecoder().decode(entries.find(e => e.path === 'config.json').data);
  if (cfg !== E.exportJson(JSON.parse(cfg))) fail('config.json not canonical');

  // Reload: autosave restores the work and the step.
  await page.reload();
  await page.waitForFunction(() => UI.App && UI.App.r && UI.App.r.counts.dbs === 250 && UI.App.ui.screen === 4);
  if (await page.locator('#tour').count()) fail('tour should show only once');

  const t = await ctx.newPage();
  await t.goto('file://' + path.join(root, 'tests/run-tests.html'));
  await t.waitForFunction(() => /PASS|FAIL/.test(document.title), null, { timeout: 30000 });
  const title = await t.title();
  if (!title.startsWith('PASS')) fail('run-tests.html: ' + (await t.textContent('#out')));

  if (problems.length) fail(problems.join('\n'));
  await browser.close();
  console.log(`UI smoke: PASS (zip ${names.length} entries, run-tests.html ${title})`);
})().catch(e => { console.log('UI smoke: FAIL\n' + e.message); process.exit(1); });
