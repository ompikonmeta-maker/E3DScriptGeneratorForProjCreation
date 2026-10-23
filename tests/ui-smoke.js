#!/usr/bin/env node
// Browser smoke test of dist/e3d-setup-generator.html (needs Playwright + Chromium; optional).
//   node tests/ui-smoke.js [screenshotDir]
// Offline (network disabled), asserts no requests and no console errors, imports the ZRF preset,
// visits all six screens, downloads the ZIP and checks its contents; also runs tests/run-tests.html.
const path = require('path'), fs = require('fs');
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
  const shot = async n => { if (shots) { fs.mkdirSync(shots, { recursive: true }); await page.screenshot({ path: path.join(shots, n + '.png'), fullPage: true }); } };

  await page.goto('file://' + path.join(root, 'dist/e3d-setup-generator.html'));
  await page.waitForSelector('#nav .step');
  await shot('0-empty');

  // Import the preset through the real file picker and summary dialog.
  const chooser = page.waitForEvent('filechooser');
  await page.click('[data-act="importJson"]');
  await (await chooser).setFiles(path.join(root, 'presets/zrf.config.json'));
  await page.waitForSelector('dialog.dlg');
  await page.click('dialog.dlg button.filled');
  await page.waitForFunction(() => UI.App.r.counts.dbs === 250);
  const counts = await page.evaluate(() => ({ c: UI.App.r.counts, e: UI.App.errors().length, w: UI.App.r.issues.filter(i => i.severity === 'warning').length }));
  if (counts.e !== 0 || counts.w !== 5 || counts.c.zones !== 2876) fail('preset counts ' + JSON.stringify(counts));
  await shot('1-project');

  for (const n of [2, 3, 4, 5, 6]) {
    await page.click(`#nav [data-screen="${n}"]`);
    await page.waitForFunction(k => UI.App.ui.screen === k, n);
    await shot(`${n}-screen`);
  }

  // Edit: rename a kode in screen 2 and see the error/fix cycle via undo.
  await page.click('#nav [data-screen="2"]');
  await page.click('[data-act="attrSel"][data-id="disiplin"]');
  const team = page.locator('[data-bind="attributes.2.rows.1.team"]');
  await team.selectOption('');
  await page.waitForFunction(() => UI.App.errors().length > 0);
  if (!(await page.locator('#genBtn').isDisabled())) fail('Generate ZIP should be disabled with errors');
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('Control+z');
  await page.waitForFunction(() => UI.App.errors().length === 0);

  const state = () => page.evaluate(() => ({ dbs: UI.App.r.counts.dbs, errors: UI.App.errors().map(i => i.id), warnings: UI.App.r.issues.filter(i => i.severity === 'warning').length }));
  const undo = async () => { await page.evaluate(() => { document.activeElement.blur(); UI.App.undo(); }); };

  // Screen 3: matrix checkbox updates counts immediately (U5).
  await page.click('#nav [data-screen="3"]');
  await page.uncheck('input[data-r="T"][data-c="HB"]');
  if ((await state()).dbs !== 249) fail('matrix uncheck');
  await undo();

  // Screen 2: paste rows (U3), blocked delete (U4).
  await page.click('#nav [data-screen="2"]');
  await page.click('[data-act="attrSel"][data-id="fluid"]');
  await page.click('[data-act="rowPaste"]');
  await page.fill('#pasteRows', 'Kode\tDeskripsi\nZ1\tTest one\nZ2\tTest two');
  await page.click('dialog.dlg button.filled');
  await page.waitForSelector('dialog.dlg input[name=pm]');
  await page.click('dialog.dlg button.filled');
  await page.waitForFunction(() => UI.App.config.attributes.find(a => a.id === 'fluid').rows.length === 109);
  await undo();
  await page.click('[data-act="attrSel"][data-id="disiplin"]');
  await page.click('[data-act="attrDel"]');
  await page.waitForSelector('dialog.dlg');
  if (!/masih dipakai/.test(await page.textContent('dialog.dlg h2'))) fail('delete of a referenced attribute not blocked');
  await page.click('dialog.dlg button');

  // Screen 4: insert token at cursor (U7) and apply a filter from the chip menu.
  await page.click('#nav [data-screen="4"]');
  const lits = page.locator('#tpl-dbDesc input.lit');
  await lits.last().click();
  await page.click('.tok[data-tok="Area.kode"]');
  if (!(await page.evaluate(() => UI.App.config.templates.dbDesc)).endsWith('{Area.kode}')) fail('token insert');
  await undo();
  await page.click('#tpl-site .tchip >> nth=0');
  await page.click('#popmenu button:has-text("|lower")');
  await page.waitForFunction(() => UI.App.config.templates.site.includes('|lower'));
  if (!(await state()).warnings) fail('V14 warnings expected');
  await undo();

  // Screen 1: Export Config import -> in-use list -> V07/V08 (N16 through the UI).
  const xlsx = await E.xlsx.write([
    { name: 'Teams', rows: [['Team name'], ['Name'], ['ZRFPIP']] },
    { name: 'Databases', rows: [['comment row'], ['#Keyword', 'Owning Team', 'Name', 'Description', 'Type', 'Claim Mode', 'Number'], ['DB', 'ZRFPIP', 'DESI-L-M1D', 'x', 'DESI', 'IMPLICIT', 10201]] },
  ]);
  const xfile = path.join(require('os').tmpdir(), 'e3d-export-config.xlsx');
  fs.writeFileSync(xfile, xlsx);
  await page.click('#nav [data-screen="1"]');
  const ch2 = page.waitForEvent('filechooser');
  await page.click('.choice[data-act="importExportConfig"]');
  await (await ch2).setFiles(xfile);
  await page.click('dialog.dlg button.filled');
  await page.waitForFunction(() => UI.App.errors().some(i => i.id === 'V07') && UI.App.errors().some(i => i.id === 'V08'));
  await page.click('[data-act="inUseClear"]');
  await page.waitForFunction(() => UI.App.errors().length === 0);
  await page.click('#themeBtn');

  // Download the package.
  await page.click('#nav [data-screen="6"]');
  const dl = page.waitForEvent('download');
  await page.click('main [data-act="generateZip"]');
  const file = await (await dl).path();
  const entries = await E.zip.read(fs.readFileSync(file));
  const names = entries.map(e => e.path);
  if (names.length !== 36 || !names.includes('00-README.txt') || !names.includes('ZRF-E3D-Register.xlsx') || !names.includes('config.json')) fail('zip entries ' + names.length);
  const book = await E.xlsx.read(entries.find(e => e.path.endsWith('.xlsx')).data);
  if (book.find(s => s.name === 'DB Register').rows.length !== 251) fail('register rows');
  const cfg = new TextDecoder().decode(entries.find(e => e.path === 'config.json').data);
  if (cfg !== E.exportJson(JSON.parse(cfg))) fail('config.json not canonical');

  // Reload: autosave restores the work.
  await page.reload();
  await page.waitForFunction(() => UI.App && UI.App.r && UI.App.r.counts.dbs === 250);

  // Browser test page.
  const t = await ctx.newPage();
  await t.goto('file://' + path.join(root, 'tests/run-tests.html'));
  await t.waitForFunction(() => /PASS|FAIL/.test(document.title), null, { timeout: 30000 });
  const title = await t.title();
  if (!title.startsWith('PASS')) fail('run-tests.html: ' + (await t.textContent('#out')));

  if (problems.length) fail(problems.join('\n'));
  await browser.close();
  console.log(`UI smoke: PASS (zip ${names.length} entries, run-tests.html ${title})`);
})().catch(e => { console.log('UI smoke: FAIL\n' + e.message); process.exit(1); });
