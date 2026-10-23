#!/usr/bin/env node
// Headless test runner: node tests/run.js [filter]
// Runs tests/suite.js and, when Python is available, compares every generated file byte-for-byte
// with tools/reference_generator.py (acceptance A4).
const fs = require('fs'), path = require('path'), os = require('os'), { spawnSync } = require('child_process');
const load = require('./load'), makeSuite = require('./suite');
const root = path.join(__dirname, '..');
const E = load();
const presetPath = path.join(root, 'presets/zrf.config.json');
const preset = JSON.parse(fs.readFileSync(presetPath, 'utf8'));
const fixtures = {};
(function walk(dir, rel) {
  for (const n of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, n), r = rel ? rel + '/' + n : n;
    if (fs.statSync(p).isDirectory()) walk(p, r); else fixtures[r] = fs.readFileSync(p, 'utf8');
  }
})(path.join(root, 'fixtures/zrf'), '');

const tests = makeSuite(E, preset, fixtures);
tests.push({ id: 'A4b', title: 'All files byte-identical to the Python reference', run() {
  const py = ['python3', 'python'].find(c => spawnSync(c, ['--version']).status === 0);
  if (!py) { console.log('  (skipped: no Python)'); return; }
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'e3d-ref-'));
  const res = spawnSync(py, [path.join(root, 'tools/reference_generator.py'), presetPath, '--out', out], { encoding: 'utf8' });
  if (res.status !== 0) throw new Error('reference generator failed: ' + res.stderr);
  const ref = {};
  (function walk(dir, rel) {
    for (const n of fs.readdirSync(dir)) {
      const p = path.join(dir, n), r = rel ? rel + '/' + n : n;
      if (fs.statSync(p).isDirectory()) walk(p, r); else ref[r] = fs.readFileSync(p, 'latin1');
    }
  })(out, '');
  const got = Object.fromEntries(E.compute(JSON.parse(JSON.stringify(preset))).files.map(f => [f.path, f.text]));
  const a = Object.keys(ref).sort(), b = Object.keys(got).sort();
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`file lists differ: ref ${a.length}, js ${b.length}`);
  for (const k of a) if (ref[k] !== got[k]) {
    const x = ref[k].split('\r\n'), y = got[k].split('\r\n'), i = x.findIndex((l, j) => l !== y[j]);
    throw new Error(`${k} differs at line ${i + 1}:\n  ref: ${x[i]}\n  js:  ${y[i]}`);
  }
  fs.rmSync(out, { recursive: true, force: true });
} });

(async () => {
  const filter = process.argv[2];
  let pass = 0, failN = 0;
  for (const t of tests) {
    if (filter && !t.id.startsWith(filter)) continue;
    try { await t.run(); pass++; console.log(`PASS ${t.id}  ${t.title}`); }
    catch (e) { failN++; console.log(`FAIL ${t.id}  ${t.title}\n  ${e.message}`); }
  }
  console.log(`\n${pass} passed, ${failN} failed`);
  process.exit(failN ? 1 : 0);
})();
