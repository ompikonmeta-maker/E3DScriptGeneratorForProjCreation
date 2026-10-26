/* Acceptance suite A1-A5, N1-N16 (tests/ACCEPTANCE.md) plus IO checks.
   Shared by tests/run.js (Node) and tests/run-tests.html (browser).
   makeSuite(E, preset, fixtures) -> [{id, title, run: async () => void}] ; a test fails by throwing. */
var makeSuite = function (E, preset, fixtures) {
  'use strict';
  const clone = o => JSON.parse(JSON.stringify(o));
  const fail = msg => { throw new Error(msg); };
  const eq = (a, b, what) => { if (JSON.stringify(a) !== JSON.stringify(b)) fail(`${what}: got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`); };
  const ok = (cond, what) => { if (!cond) fail(what); };
  const run = cfg => E.compute(cfg);
  const ids = (issues, sev) => issues.filter(i => !sev || i.severity === sev).map(i => i.id);
  const has = (r, id, sev) => ok(r.issues.some(i => i.id === id && (!sev || i.severity === sev)),
    `expected ${id}${sev ? ' ' + sev : ''}; got ${JSON.stringify(r.issues.slice(0, 8).map(i => i.id + ': ' + i.message))}`);
  const attr = (c, id) => c.attributes.find(a => a.id === id);
  const row = (c, id, kode) => attr(c, id).rows.find(r => r.kode === kode);
  const commands = text => text.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('$*'));
  const fileMap = r => Object.fromEntries(r.files.map(f => [f.path, f.text]));
  const mutate = fn => { const c = clone(preset); fn(c); return run(c); };

  const T = [];
  const test = (id, title, fn) => T.push({ id, title, run: fn });

  test('A1', 'Load preset: counts', () => {
    const r = run(clone(preset)), c = r.counts;
    eq([c.teamsNew + c.teamsExisting, c.teamsNew, c.teamsExisting], [11, 5, 6], 'teams total/new/existing');
    eq([c.dbs, c.sites, c.separators, c.zones], [250, 250, 90, 2876], 'dbs/sites/separators/zones');
    eq([c.refsActive, c.refsInactive], [122, 3], 'reference DBs active/inactive');
    const members = r.model.cells.filter(x => x.mdb === '/MDB-ZRF').length + c.refsActive;
    eq(members, 372, '/MDB-ZRF members');
  });

  test('A2', 'Validate preset: 0 errors, V19x1, V20x4, V22 info x1', () => {
    const r = run(clone(preset));
    eq(ids(r.issues, 'error'), [], 'errors');
    eq(ids(r.issues, 'warning').sort(), ['V19', 'V20', 'V20', 'V20', 'V20'], 'warnings');
    eq(r.issues.filter(i => i.id === 'V20').map(i => i.message.match(/baris (\w+)/)[1]), ['E', 'I', 'T', 'N'], 'V20 rows');
    eq(ids(r.issues, 'info'), ['V22'], 'info');
  });

  test('A3', 'Generate: 33 .mac files + README + register + config.json', () => {
    const r = run(clone(preset));
    const macs = r.files.filter(f => f.path.endsWith('.mac'));
    eq(macs.length, 33, '.mac count');
    const pkg = E.packageNames(r.cfg, r.files);
    for (const n of ['00-README.txt', 'ZRF-E3D-Register.xlsx', 'config.json']) ok(pkg.includes(n), `package has ${n}`);
    for (const p of ['00-TEAMS/ZRF-00-TEAMS-ADMIN.mac', '02-L-ZRFPIP/ZRF-02-L-B1-CREATE-DB-MDB-ADMIN.mac',
      '10-N-ZRFSTR/ZRF-10-N-B3-ZONES-DESIGN.mac', '90-REFERENCE/ZRF-90-REF-MDB-ADMIN.mac', '99-FIXUP/ZRF-99-MDB-REORDER-ADMIN.mac'])
      ok(pkg.includes(p), `package has ${p}`);
    for (const f of r.files) ok(/\r\n$/.test(f.text) && !/[^\r]\n/.test(f.text), `${f.path} uses CRLF with final line ending`);
  });

  test('A4', 'Command lines equal fixtures/zrf (.prefix.mac = prefix)', () => {
    const files = fileMap(run(clone(preset)));
    const names = Object.keys(fixtures);
    ok(names.length >= 6, 'fixtures loaded');
    for (const name of names) {
      const target = name.replace('.prefix.mac', '.mac');
      ok(target in files, `${target} generated`);
      const exp = commands(fixtures[name]), got = commands(files[target]);
      const cmp = name.includes('.prefix.') ? got.slice(0, exp.length) : got;
      if (cmp.length !== exp.length) fail(`${target}: ${cmp.length} command lines, expected ${exp.length}`);
      cmp.forEach((l, i) => { if (l !== exp[i]) fail(`${target} line ${i + 1}: got "${l}", expected "${exp[i]}"`); });
    }
  });

  test('A5', 'config.json round trip is identical', () => {
    const s1 = E.exportJson(clone(preset));
    const parsed = JSON.parse(s1);
    eq(E.checkSchema(parsed), [], 'schema check');
    const s2 = E.exportJson(E.migrate(parsed).config);
    ok(s1 === s2, 'export -> import -> export differs');
    const withExtra = clone(preset); withExtra.futureKey = { a: 1 }; withExtra.project.extra = 'x';
    const s3 = E.exportJson(withExtra);
    ok(s3 === E.exportJson(JSON.parse(s3)) && s3.includes('"futureKey"') && s3.includes('"extra"'), 'unknown keys kept');
  });

  test('N1', 'Area M2 slot = 1 -> V07 for every row', () => {
    const r = mutate(c => { row(c, 'area', 'M2').slot = 1; });
    eq(r.issues.filter(i => i.id === 'V07').length, 10, 'V07 count');
    ok(r.issues.find(i => i.id === 'V07').ref === '1.3', 'ref 1.3');
  });
  test('N2', 'dbNo = {Area.slot} + 7000 -> V06', () => {
    has(mutate(c => { c.templates.dbNo = '{Area.slot} + 7000'; }), 'V06', 'error');
  });
  test('N3', 'Disiplin L mdbMulai = 1 -> V09', () => {
    has(mutate(c => { row(c, 'disiplin', 'L').mdbMulai = 1; }), 'V09', 'error');
  });
  test('N4', 'mdbPos = {INDEX} + 4990 -> V09 outside 1-5000', () => {
    const r = mutate(c => { c.templates.mdbPos = '{INDEX} + 4990'; });
    ok(r.issues.some(i => i.id === 'V09' && /di luar 1-5000/.test(i.message)), 'V09 range');
  });
  test('N5', '63 extra Area rows -> V10 (and V09)', () => {
    const r = mutate(c => {
      const area = attr(c, 'area'), used = new Set(area.rows.map(a => a.slot)), codes = new Set(area.rows.map(a => a.kode));
      const at = area.rows.map(a => a.grup).lastIndexOf('OTHERS') + 1, extra = [];
      const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      let slot = 1;
      for (let i = 0; extra.length < 63; i++) {
        const kode = 'Z' + L[Math.floor(i / 26) % 26] + (i >= 26 ? L[i % 26] : '');
        if (codes.has(kode)) continue;
        while (used.has(slot)) slot++;
        used.add(slot);
        extra.push({ kode, desc: 'Extra ' + kode, slot, grup: 'OTHERS', fungsi: 'D' });
      }
      area.rows.splice(at, 0, ...extra);
    });
    ok(r.issues.some(i => i.id === 'V10' && /1002/.test(i.message)), 'V10 with 1002 current');
    has(r, 'V09', 'error');
  });
  test('N6', 'type DICT + MULTIWRITE -> V11', () => {
    has(mutate(c => { c.dbDefaults.type = 'DICT'; c.dbDefaults.access = 'MULTIWRITE'; }), 'V11', 'error');
  });
  test('N7', 'site without / -> V12', () => {
    has(mutate(c => { c.templates.site = '{Disiplin.kode}-{Area.kode}'; }), 'V12', 'error');
  });
  test('N8', 'lower-case site -> V14 warning', () => {
    has(mutate(c => { c.templates.site = '/{Disiplin.kode|lower}-{Area.kode}'; }), 'V14', 'warning');
  });
  test('N9', 'sepGroup with = -> V15 warning', () => {
    has(mutate(c => { c.templates.sepGroup = '/{Disiplin.kode}=={Grup.kode}=='; }), 'V15', 'warning');
  });
  test('N10', 'Q1 moved after HC -> V16', () => {
    const r = mutate(c => {
      const rows = attr(c, 'area').rows, q1 = rows.findIndex(a => a.kode === 'Q1');
      const [q] = rows.splice(q1, 1);
      rows.splice(rows.findIndex(a => a.kode === 'HC') + 1, 0, q);
    });
    ok(r.issues.some(i => i.id === 'V16' && /PIPE-RACK/.test(i.message)), 'V16 PIPE-RACK');
  });
  test('N11', 'Disiplin L team XXX -> V01; adding team XXX fixes it', () => {
    const c = clone(preset);
    row(c, 'disiplin', 'L').team = 'XXX';
    has(run(c), 'V01', 'error');
    attr(c, 'team').rows.push({ kode: 'XXX', desc: 'TEAM XXX', existing: false, anggota: [] });
    const r = run(c);
    eq(ids(r.issues, 'error'), [], 'errors after adding team');
    ok(commands(fileMap(r)['00-TEAMS/ZRF-00-TEAMS-ADMIN.mac']).some(l => l.startsWith('CREATE TEAM XXX ')), '00-TEAMS has CREATE TEAM XXX');
  });
  test('N12', 'dbName with {Area.nope} -> V03 on dbName', () => {
    const r = mutate(c => { c.templates.dbName = '{Disiplin.team.kode}/DESI-{Area.nope}'; });
    ok(r.issues.some(i => i.id === 'V03' && i.location.template === 'dbName'), 'V03 at dbName');
  });
  test('N13', 'dbNo = {Area.slot} / 2 -> V04', () => {
    has(mutate(c => { c.templates.dbNo = '{Area.slot} / 2'; }), 'V04', 'error');
  });
  test('N14', 'Area desc with non-ASCII -> V18', () => {
    const r = mutate(c => { row(c, 'area', 'M1').desc = 'M1 Liquéfaction'; });
    has(r, 'V18', 'error');
    ok(r.issues.find(i => i.id === 'V18').location.attributeId === 'area', 'V18 points to the Area cell');
  });
  test('N15', 'excluded [T,HB]', () => {
    const r = mutate(c => { c.combination.excluded = [['T', 'HB']]; });
    eq(r.counts.dbs, 249, 'DBs');
    const t = r.model.cells.filter(x => x.rowKode === 'T');
    eq([t[0].pos, t[t.length - 1].pos], [201, 224], 'T positions');
    eq(t.find(x => x.colKode === 'HK').dbno, 10941, 'T DBNO for HK');
    const b2 = fileMap(r)['09-T-ZRFTEL/ZRF-09-T-B2-SITES-DESIGN.mac'];
    ok(!b2.includes('/T----HULL-BODY----') && !b2.includes('/T-HBD'), 'B2 Telecom without HB');
  });
  test('N16', 'inUse DB ZRFPIP/DESI-L-M1D 10201 -> V07 and V08', () => {
    const r = mutate(c => { c.inUse = { teams: [], dbs: [{ name: 'ZRFPIP/DESI-L-M1D', number: 10201 }], source: 'test.xlsx', importedAt: '2026-10-23' }; });
    has(r, 'V07', 'error'); has(r, 'V08', 'error');
  });

  test('X1', 'Empty config computes without crash', () => {
    const r = run(E.emptyConfig());
    eq(r.counts.dbs, 0, 'no DBs');
  });
  test('X2', 'perStep split and multiple MDBs', () => {
    const r = mutate(c => {
      c.output.split = 'perStep';
      attr(c, 'disiplin').columns.push({ id: 'mdb', name: 'MDB', type: 'text', required: false });
      row(c, 'disiplin', 'N').mdb = '/MDB-STR';
      c.mdbs.push({ name: '/MDB-STR', default: false });
    });
    eq(ids(r.issues, 'error'), [], 'errors');
    const paths = r.files.map(f => f.path);
    ok(paths.includes('B1/ZRF-B1-CREATE-DB-MDB-ADMIN.mac') && paths.includes('B3/ZRF-B3-ZONES-DESIGN.mac'), 'perStep files');
    const b1 = commands(fileMap(r)['B1/ZRF-B1-CREATE-DB-MDB-ADMIN.mac']);
    eq(b1.filter(l => l.startsWith('CREATE DB')).length, 250, 'B1 CREATE count');
    ok(b1.includes('SET MDB /MDB-STR'), 'second MDB block');
    const fix = commands(fileMap(r)['99-FIXUP/ZRF-99-MDB-REORDER-ADMIN.mac']);
    eq(fix.filter(l => l.startsWith('SET MDB')).length, 2, '99 SET MDB per MDB');
  });
  test('X3', 'Expression parser', () => {
    eq(E.evaluate('10000 + 2 * 100 + 1'), 10201, 'precedence');
    eq(E.evaluate('(3 + 4) * 2 - -1'), 15, 'parentheses and unary minus');
    for (const bad of ['1 +', '2 / 0', '3 / 2', 'alert(1)', '']) {
      let threw = false;
      try { E.evaluate(bad); } catch (e) { threw = true; }
      ok(threw, `rejects '${bad}'`);
    }
  });
  test('X5', 'Import mapping: header guess, mapping, conversion', () => {
    const area = clone(preset).attributes.find(a => a.id === 'area');
    const table = [['SLOT', 'Kode', 'Deskripsi', 'grup'], ['31', 'ZZ', 'New', 'OTHERS'], ['', '', '', '']];
    ok(E.looksLikeHeader(area, table[0]), 'header detected');
    const map = E.guessMapping(area, table[0], true);
    eq([map.kode, map.desc, map.slot, map.grup, map.fungsi], [1, 2, 0, 3, -1], 'mapping');
    eq(E.mapTable(area, table.slice(1), map), [{ kode: 'ZZ', desc: 'New', slot: 31, grup: 'OTHERS', fungsi: '' }], 'rows');
    eq(E.guessMapping(area, ['a', 'b'], false).desc, 1, 'positional mapping');
    const other = [['AREA', 'DESCRIPTION', 'SLOT'], ['Q6', 'PR-M6', '18'], ['Q7', 'PR-M7', '19']];
    ok(E.looksLikeHeader(area, other[0], other.slice(1)), 'header with unfamiliar names detected');
    eq(E.guessMapping(area, other[0], true).slot, 2, 'unfamiliar header falls back to column order');
    ok(!E.looksLikeHeader(area, other[1], other.slice(2)), 'data row is not a header');
  });
  if (E.zip) {
    test('X4', 'ZIP and XLSX write -> read round trip', async () => {
      const r = run(clone(preset));
      const sheets = E.registerSheets(r.cfg, r.model, r.issues, r.files);
      const xlsx = await E.xlsx.write(sheets);
      const book = await E.xlsx.read(xlsx);
      const reg = book.find(s => s.name === 'DB Register');
      ok(reg && reg.rows.length === 251, 'DB Register rows');
      eq(reg.rows[0].slice(0, 3), ['No', 'Row', 'Row code'], 'header');
      eq(String(reg.rows[26][6]), 'ZRFPIP/DESI-L-M1D', 'first Piping DB');
      const zip = await E.zip.write([{ path: 'a/b.txt', data: 'hello\r\n' }, { path: 'c.bin', data: new Uint8Array([1, 2, 3]) }]);
      const entries = await E.zip.read(zip);
      eq(entries.map(e => e.path), ['a/b.txt', 'c.bin'], 'zip entries');
      eq(new TextDecoder().decode(entries[0].data), 'hello\r\n', 'zip text');
    });
  }
  return T;
};
if (typeof module !== 'undefined') module.exports = makeSuite;
