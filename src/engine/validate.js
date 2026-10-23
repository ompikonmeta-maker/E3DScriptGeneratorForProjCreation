/* Validation V01-V24 (docs/RULES.md §3). Each issue: {id, severity, ref, message, location}.
   location.screen: 1 Project, 2 Attribute, 3 Relasi & kombinasi, 4 Template, 5 Preview, 6 Generate. */
(function (E) {
  'use strict';

  const ID_RE = /^[a-z][a-z0-9_]*$/, NAME_RE = /^[A-Za-z][A-Za-z0-9_]*$/, COL_RE = /^[a-zA-Z][a-zA-Z0-9_]*$/;
  const empty = v => v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length);

  E.validate = function (cfg, model, files) {
    const issues = [], d = cfg.d;
    const add = (id, severity, ref, message, location) => issues.push({ id, severity, ref, message, location: location || {} });
    const cellLoc = (c, extra) => Object.assign({ screen: 3, cell: [c.rowKode, c.colKode] }, extra);

    /* V02: attribute structure */
    const names = new Map(), ids = new Map();
    const roleCount = { team: 0, user: 0 };
    for (const a of d.attributes || []) {
      const loc = { screen: 2, attributeId: a.id };
      if (!ID_RE.test(a.id || '')) add('V02', 'error', '-', `Id attribute (${a.id}) harus [a-z][a-z0-9_]*`, loc);
      if (ids.has(a.id)) add('V02', 'error', '-', `Id attribute (${a.id}) duplikat`, loc);
      ids.set(a.id, a);
      if (!NAME_RE.test(a.name || '')) add('V02', 'error', '-', `Nama attribute (${a.name}) harus [A-Za-z][A-Za-z0-9_]* (tanpa spasi)`, loc);
      if (E.RESERVED_HEADS.includes(a.name)) add('V02', 'error', '-', `Nama attribute (${a.name}) dipakai oleh token sistem`, loc);
      if (names.has(a.name)) add('V02', 'error', '-', `Nama attribute (${a.name}) duplikat`, loc);
      names.set(a.name, a);
      if (a.role in roleCount && ++roleCount[a.role] === 2) add('V02', 'error', '-', `Lebih dari satu attribute berperan ${a.role}`, loc);
      const colIds = new Set();
      for (const c of a.columns || []) {
        const cl = Object.assign({ column: c.id }, loc);
        if (!COL_RE.test(c.id || '')) add('V02', 'error', '-', `Id kolom (${a.name}.${c.id}) tidak valid`, cl);
        if (colIds.has(c.id)) add('V02', 'error', '-', `Id kolom (${a.name}.${c.id}) duplikat`, cl);
        colIds.add(c.id);
        if ((c.type === 'ref' || c.type === 'refList') && !cfg.attrs[c.target])
          add('V02', 'error', '-', `Kolom ${a.name}.${c.id} menunjuk attribute (${c.target}) yang tidak ada`, cl);
      }
      for (const k of ['kode', 'desc']) if (!colIds.has(k)) add('V02', 'error', '-', `Attribute ${a.name} wajib punya kolom ${k}`, loc);
    }
    const { rowAttr, colAttr } = E.roles(cfg);
    const comb = d.combination || {};
    if (!rowAttr) add('V02', 'error', '-', `Attribute baris (${comb.rowAttr || '-'}) belum dipilih atau tidak ada`, { screen: 3 });
    if (!colAttr) add('V02', 'error', '-', `Attribute kolom (${comb.colAttr || '-'}) belum dipilih atau tidak ada`, { screen: 3 });
    if (colAttr && comb.groupBy) {
      const gc = cfg.col(colAttr.id, comb.groupBy);
      if (!gc || gc.type !== 'ref') add('V02', 'error', '-', `Grup kolom (${comb.groupBy}) harus kolom referensi di ${colAttr.name}`, { screen: 3 });
    }
    if (rowAttr && !cfg.col(rowAttr.id, 'urutan')) add('V02', 'error', '-', `Attribute baris ${rowAttr.name} perlu kolom angka 'urutan'`, { screen: 2, attributeId: rowAttr.id });

    /* V01: attribute data */
    for (const a of d.attributes || []) {
      const seen = new Set();
      (a.rows || []).forEach((r, i) => {
        const key = r.kode, rl = col => ({ screen: 2, attributeId: a.id, rowKode: key, rowIndex: i, column: col });
        if (!empty(r.kode) && seen.has(r.kode)) add('V01', 'error', '-', `Kode ${r.kode} (${a.name}) duplikat`, rl('kode'));
        seen.add(r.kode);
        for (const c of a.columns || []) {
          const v = r[c.id], what = `${c.name || c.id} (${a.name}, ${key || '#' + (i + 1)})`;
          if (empty(v)) {
            if (c.required || c.id === 'kode' || c.id === 'desc') add('V01', 'error', '-', `${what} wajib diisi`, rl(c.id));
            continue;
          }
          if (c.type === 'number' && !Number.isInteger(v)) add('V01', 'error', '-', `${what} harus bilangan bulat (${v})`, rl(c.id));
          if (c.type === 'boolean' && typeof v !== 'boolean') add('V01', 'error', '-', `${what} harus ya/tidak`, rl(c.id));
          if (c.type === 'text' && typeof v !== 'string') add('V01', 'error', '-', `${what} harus teks`, rl(c.id));
          if ((c.type === 'ref' || c.type === 'refList') && cfg.rows[c.target]) {
            const tname = cfg.attrs[c.target].name;
            for (const x of c.type === 'ref' ? [v] : (Array.isArray(v) ? v : [v]))
              if (!cfg.rows[c.target].has(x)) add('V01', 'error', '-', `${what}: ${x} tidak ada di ${tname}`, rl(c.id));
          }
        }
        if (a.role === 'team' && String(r.desc || '').includes("'"))
          add('V01', 'error', '-', `Deskripsi team ${key} mengandung tanda kutip '`, rl('desc'));
      });
    }

    /* V03: template tokens resolve in their context */
    const t = d.templates || {};
    for (const [key, kind] of Object.entries(E.TEMPLATE_KINDS)) {
      if (empty(t[key])) {
        if (!E.OPTIONAL_TEMPLATES.includes(key)) add('V03', 'error', '-', `Template ${key} kosong`, { screen: 4, template: key });
        continue;
      }
      for (const m of E.checkTemplate(cfg, t[key], E.contextHeads(cfg, kind)))
        add('V03', 'error', '-', `Template ${key}: ${m}`, { screen: 4, template: key });
    }
    for (const [i, rule] of (d.zoneRules || []).entries()) {
      const loc = { screen: 4, zoneRule: i };
      if (rule.forEach && !cfg.attrs[rule.forEach]) add('V03', 'error', '-', `Aturan zone ${rule.id}: attribute forEach (${rule.forEach}) tidak ada`, loc);
      const heads = E.contextHeads(cfg, 'zone', rule.forEach);
      for (const p of rule.patterns || []) for (const m of E.checkTemplate(cfg, p, heads)) add('V03', 'error', '-', `Aturan zone ${rule.id}: ${m}`, loc);
      for (const w of rule.when || []) for (const m of E.checkTemplate(cfg, `{${w.token}}`, E.contextHeads(cfg, 'cell').concat('SITE')))
        add('V03', 'error', '-', `Aturan zone ${rule.id}, syarat: ${m}`, loc);
    }
    if (comb.mode === 'condition')
      for (const w of comb.condition || []) for (const m of E.checkTemplate(cfg, `{${w.token}}`, E.contextHeads(cfg, 'condition')))
        add('V03', 'error', '-', `Kondisi kombinasi: ${m}`, { screen: 3 });

    /* V04: expressions */
    const exprSeen = new Set();
    for (const x of model.exprErrors) {
      const k = x.template + x.message;
      if (exprSeen.has(k)) continue;
      exprSeen.add(k);
      add('V04', 'error', '-', `${x.template} (${x.cell.rowKode} x ${x.cell.colKode}): ${x.message}`, { screen: 4, template: x.template, cell: [x.cell.rowKode, x.cell.colKode] });
    }

    /* V11 */
    const def = d.dbDefaults || {};
    if (def.access === 'MULTIWRITE' && !E.MULTIWRITE_TYPES.includes(def.type))
      add('V11', 'error', '1.4', `Type ${def.type} tidak bisa MULTIWRITE (hanya DESI, CATA, DRAFT, ISODRAFT)`, { screen: 1, field: 'dbDefaults' });

    /* V05-V08: DBs */
    const teamAttr = cfg.role('team')[0];
    const teams = teamAttr ? cfg.rows[teamAttr.id] : new Map();
    const inUse = d.inUse || null;
    const usedNo = new Map(), usedName = new Set();
    for (const x of (inUse && inUse.dbs) || []) {
      if (x.number !== null && x.number !== undefined) usedNo.set(x.number, `${x.name} (project)`);
      usedName.add(x.name);
    }
    const seenNo = new Map(), seenDb = new Set();
    for (const c of model.cells) {
      const loc = cellLoc(c);
      if (c.team === null) add('V05', 'error', '1.1, 1.12', `Nama DB (${c.db}) harus TEAM/NAMA`, { screen: 4, template: 'dbName' });
      else if (!teams.has(c.team)) add('V05', 'error', '1.1, 1.12', `Team pemilik ${c.team} (${c.db}) tidak ada di tabel Team`, { screen: 4, template: 'dbName', cell: loc.cell });
      const n = c.dbno;
      if (n !== null) {
        if (!((n >= 1 && n <= 7000) || (n >= 10000 && n <= 250000)))
          add('V06', 'error', '1.3', `DBNO ${n} (${c.db}) di luar 1-7000 / 10000-250000`, Object.assign(loc, { screen: 4, template: 'dbNo' }));
        const prev = seenNo.get(n) || usedNo.get(n);
        if (prev) add('V07', 'error', '1.3', `DBNO ${n} (${c.db}) sudah dipakai oleh ${prev}`, cellLoc(c, { screen: 4, template: 'dbNo' }));
        seenNo.set(n, c.db);
      }
      if (seenDb.has(c.db)) add('V08', 'error', '1.1', `Nama DB ${c.db} duplikat`, cellLoc(c, { screen: 4, template: 'dbName' }));
      else if (usedName.has(c.db)) add('V08', 'error', '1.1', `Nama DB ${c.db} sudah ada di project (Export Config)`, cellLoc(c, { screen: 4, template: 'dbName' }));
      seenDb.add(c.db);
      if (String(c.desc).includes("'")) add('V01', 'error', '-', `DESC (${c.db}) mengandung tanda kutip '`, { screen: 4, template: 'dbDesc' });
    }

    /* V09, V10, V23: MDB positions per MDB */
    const mdbNames = new Set((d.mdbs || []).map(m => m.name));
    const refs = d.referenceDbs || [];
    const perMdb = new Map();
    const push = (m, pos, db, loc) => { if (!perMdb.has(m)) perMdb.set(m, []); perMdb.get(m).push({ pos, db, loc }); };
    for (const c of model.cells) push(c.mdb, c.pos, c.db, cellLoc(c, { screen: 4, template: 'mdbPos' }));
    const refSeen = new Set();
    refs.forEach((r, i) => {
      const loc = { screen: 1, refIndex: i };
      if (refSeen.has(r.db)) add('V23', 'error', '§2', `DB referensi ${r.db} duplikat`, loc);
      refSeen.add(r.db);
      if (!r.active) return;
      if (r.pos === null || r.pos === undefined || r.pos === '') add('V23', 'error', '§2', `DB referensi ${r.db} aktif tapi tanpa posisi`, loc);
      else push(comb.mdb, r.pos, r.db, loc);
    });
    for (const [m, list] of perMdb) {
      if (!mdbNames.has(m)) add('V09', 'error', '§2', `MDB ${m} tidak ada di daftar MDB`, { screen: 1, field: 'mdbs' });
      const seen = new Map();
      for (const x of list) {
        if (x.pos === null) continue;
        if (!(Number.isInteger(x.pos) && x.pos >= 1 && x.pos <= 5000)) add('V09', 'error', '§2', `Posisi MDB ${x.pos} (${x.db}) di luar 1-5000`, x.loc);
        if (seen.has(x.pos)) add('V09', 'error', '§2', `Posisi MDB ${x.pos} (${x.db}) sudah dipakai oleh ${seen.get(x.pos)} di ${m}`, x.loc);
        seen.set(x.pos, x.db);
      }
      if (list.length > 1000) add('V10', 'error', '1.7', `${list.length} DB current di ${m} (maks 1000)`, { screen: 3 });
    }

    /* V12-V16, V24: names and site order */
    const elNames = new Set();
    for (const dd of model.disciplines) {
      const groups = [];
      let last = {};
      for (const c of dd.cells) {
        if (c.group !== last) {
          if (groups.includes(c.group)) add('V16', 'error', '3.4', `Grup ${c.group} tidak berurutan di baris ${dd.row.kode}`, { screen: 3, order: dd.row.kode });
          groups.push(c.group);
          last = c.group;
        }
      }
      const order = E.siteOrder(dd);
      if (order.length && order[0].kind !== 'site' && order[0].db !== dd.cells[0].db)
        add('V24', 'error', '3.2, 3.3', `Separator ${order[0].name} dibuat sebelum site DB-nya`, { screen: 3, order: dd.row.kode });
      const elems = order.map(s => ({ name: s.name, loc: s.kind === 'site' ? { screen: 4, template: 'site' } : { screen: 4, template: s.kind } }));
      for (const c of dd.cells) c.zones.forEach((z, i) => elems.push({ name: z, loc: { screen: 4, zoneRuleId: c.zoneRules[i] } }));
      for (const e of elems) {
        const n = e.name;
        if (!n.startsWith('/')) add('V12', 'error', '3.5', `Nama ${n} tidak diawali /`, e.loc);
        else if (n !== n.toUpperCase()) add('V14', 'warning', '3.5', `Nama ${n} bukan huruf besar (E3D case-sensitive)`, e.loc);
        else if (!E.NAME_OK_RE.test(n)) add('V15', 'warning', '§9', `Nama ${n} memakai karakter selain A-Z, 0-9, - (belum dites)`, e.loc);
        if (elNames.has(n)) add('V13', 'error', '-', `Nama elemen ${n} duplikat`, e.loc);
        elNames.add(n);
      }
    }

    /* V18: non-ASCII in generated lines */
    const nonAscii = new Set();
    for (const f of files || []) {
      if (!E.isAscii(f.path)) add('V18', 'error', 'tool', `Nama file ${f.path} berisi karakter non-ASCII`, { screen: 6, file: f.path });
      f.text.split(/\r?\n/).forEach((line, i) => {
        if (E.isAscii(line)) return;
        const bad = line.match(/[^\x00-\x7F]+/)[0];
        if (nonAscii.has(bad)) return;
        nonAscii.add(bad);
        add('V18', 'error', 'tool', `Baris ${i + 1} di ${f.name} berisi karakter non-ASCII (${bad})`, E.locateText(cfg, bad) || { screen: 6, file: f.path });
      });
    }

    /* V19, V20 */
    if (model.cells.some(c => c.zones.length) && !E.FACTS.newZoneTested)
      add('V19', 'warning', '§9', 'NEW ZONE setelah navigasi ke site belum dites (B3 tetap dibuat dengan peringatan)', { screen: 4, zoneRule: 0 });
    for (const dd of model.disciplines)
      if (!dd.cells.some(c => c.targeted))
        add('V20', 'warning', '-', `Tidak ada aturan zone yang menargetkan baris ${dd.row.kode} (${dd.row.desc})`, { screen: 4, zoneRule: 0 });

    /* V21, V22: in-use list */
    if (!inUse || (!(inUse.teams || []).length && !(inUse.dbs || []).length)) {
      add('V22', 'info', '-', 'Daftar terpakai (Export Config) belum dimuat: bentrok dengan data project tidak dicek', { screen: 1, field: 'inUse' });
    } else if (teamAttr) {
      const used = new Set(inUse.teams || []);
      for (const r of teamAttr.rows || [])
        if (!r.existing && used.has(r.kode))
          add('V21', 'warning', '-', `Team ${r.kode} sudah ada di project tapi ditandai baru (CREATE TEAM akan gagal: "Team name already defined")`,
            { screen: 2, attributeId: teamAttr.id, rowKode: r.kode, column: 'existing' });
    }
    return issues;
  };

  // Find an attribute cell whose text contains s (for V18 navigation).
  E.locateText = function (cfg, s) {
    for (const a of cfg.d.attributes || [])
      for (const [i, r] of (a.rows || []).entries())
        for (const c of a.columns || [])
          if (typeof r[c.id] === 'string' && r[c.id].includes(s)) return { screen: 2, attributeId: a.id, rowKode: r.kode, rowIndex: i, column: c.id };
    for (const [k, v] of Object.entries(cfg.d.project || {})) if (typeof v === 'string' && v.includes(s)) return { screen: 1, field: k };
    return null;
  };

  // Full pipeline used by UI and tests.
  E.compute = function (config) {
    const cfg = E.index(config);
    const model = E.buildModel(cfg);
    const files = E.generate(cfg, model);
    const issues = E.validate(cfg, model, files);
    return { cfg, model, files, issues, counts: E.counts(cfg, model) };
  };
})(E3D);
