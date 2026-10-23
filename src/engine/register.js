/* Register workbook content (SPEC §9) as plain arrays; src/io/xlsx.js writes it. */
(function (E) {
  'use strict';

  const SITE_TYPE = { sepDiscipline: 'Separator - discipline', sepGroup: 'Separator - group', site: 'Site' };
  const FIXED = ['Setup Steps', 'Package Files', 'Teams & Users', 'DB Register', 'Site Order', 'Zones', 'Reference DBs', 'Validation'];

  // Excel sheet names: max 31 chars, none of []:*?/\ and unique (case-insensitive).
  E.sheetName = function (name, taken) {
    let base = String(name).replace(/[[\]:*?/\\]/g, '-').slice(0, 31) || 'Sheet';
    let n = base, i = 2;
    while (taken.has(n.toLowerCase())) { const suf = ` (${i++})`; n = base.slice(0, 31 - suf.length) + suf; }
    taken.add(n.toLowerCase());
    return n;
  };

  E.registerSheets = function (cfg, model, issues, files) {
    const d = cfg.d, def = d.dbDefaults || {};
    const { rowAttr, colAttr } = model;
    const rowName = rowAttr ? rowAttr.name : 'Row';
    const sheets = [];
    const sheet = (name, header, rows, widths) => sheets.push({ name, rows: [header, ...rows], widths });

    sheet('Setup Steps', ['Step', 'What', 'File', 'Module', 'Check'], E.RUN_ORDER, [6, 44, 16, 9, 30]);

    const pkg = E.packageNames(cfg, files);
    const byPath = Object.fromEntries(files.map(f => [f.path, f]));
    sheet('Package Files', ['No', 'Folder', 'File', 'Module', 'Step', 'Content'], pkg.map((p, i) => {
      const f = byPath[p], slash = p.lastIndexOf('/');
      const folder = slash < 0 ? '' : p.slice(0, slash), name = p.slice(slash + 1);
      if (f) return [i + 1, folder, name, f.module, f.step, f.content];
      const what = name === '00-README.txt' ? 'Run order, warnings, counts' : name === 'config.json' ? 'Configuration (load again in the tool)' : 'This register';
      return [i + 1, folder, name, '-', '-', what];
    }), [5, 16, 48, 9, 6, 34]);

    const teamAttr = cfg.role('team')[0];
    const dbCount = {};
    for (const c of model.cells) dbCount[c.team] = (dbCount[c.team] || 0) + 1;
    sheet('Teams & Users', ['Team', 'Description', 'Status', 'Members', 'DB count'],
      (teamAttr ? teamAttr.rows : []).map(r => [r.kode, r.desc, r.existing ? 'Ada' : 'Baru', (r.anggota || []).join(', '), dbCount[r.kode] || 0]),
      [12, 40, 8, 40, 9]);

    let no = 0;
    sheet('DB Register', ['No', 'Row', 'Row code', 'Team', 'Column code', 'Description', 'DB Name', 'DB No', 'MDB', 'Position', 'Type', 'Access', 'Claim', 'Site'],
      model.cells.map(c => [++no, rowName, c.rowKode, c.team, c.colKode, c.desc, c.db, c.dbno, c.mdb, c.pos, def.type, def.access, def.claim, c.site]),
      [5, 10, 9, 10, 11, 44, 26, 8, 12, 9, 7, 12, 9, 16]);

    const order = [];
    for (const dd of model.disciplines) for (const s of E.siteOrder(dd)) {
      const dbno = (dd.cells.find(c => c.db === s.db) || {}).dbno;
      order.push([order.length + 1, dd.row.kode, SITE_TYPE[s.kind], s.name, s.db, dbno, s.group === null || s.group === undefined ? '' : s.group]);
    }
    sheet('Site Order', ['Order', 'Row', 'Type', 'Site Name', 'Created in DB', 'DB No', 'Group'], order, [7, 6, 22, 24, 26, 8, 14]);

    const rules = Object.fromEntries((d.zoneRules || []).map(r => [r.id, r]));
    const zones = [];
    for (const c of model.cells) c.zones.forEach((z, i) => zones.push([c.site, z, c.zoneRules[i], (rules[c.zoneRules[i]] || {}).source || '']));
    sheet('Zones', ['Site', 'Zone', 'Rule id', 'Source'], zones, [16, 26, 16, 40]);

    sheet('Reference DBs', ['DB', 'Position', 'Active', 'Note'],
      (d.referenceDbs || []).map(r => [r.db, r.pos === null || r.pos === undefined ? '' : r.pos, r.active ? 'Yes' : 'No', r.note || '']), [28, 9, 7, 40]);

    sheet('Validation', ['Severity', 'Id', 'Ref', 'Message'], issues.map(i => [i.severity, i.id, i.ref, i.message]), [9, 6, 9, 90]);

    const taken = new Set(FIXED.map(s => s.toLowerCase()));
    for (const a of d.attributes || []) {
      const cols = a.columns || [];
      const fmt = (v, c) => (Array.isArray(v) ? v.join(', ') : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : v === undefined || v === null ? '' : v);
      sheet(E.sheetName(a.name, taken), cols.map(c => c.name || c.id), (a.rows || []).map(r => cols.map(c => fmt(r[c.id], c))),
        cols.map(c => (c.id === 'desc' ? 40 : 14)));
    }
    return sheets;
  };
})(E3D);
