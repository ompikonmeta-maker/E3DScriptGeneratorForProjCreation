/* config.json: empty config, structural check, migration, canonical export (SPEC §3, §8.1). */
(function (E) {
  'use strict';

  // Key order of schema/config.schema.json. Unknown keys are kept and appended in their own order.
  const ORDER = {
    root: ['schema', 'project', 'mdbs', 'dbDefaults', 'attributes', 'combination', 'templates', 'zoneRules', 'referenceDbs', 'inUse', 'output'],
    project: ['code', 'name', 'target', 'filePrefix', 'packageName', 'lineEnding'],
    mdb: ['name', 'default'],
    dbDefaults: ['type', 'access', 'claim'],
    attribute: ['id', 'name', 'role', 'columns', 'rows'],
    column: ['id', 'name', 'type', 'required', 'target'],
    combination: ['rowAttr', 'colAttr', 'groupBy', 'mode', 'excluded', 'condition', 'mdb'],
    templates: ['dbName', 'dbDesc', 'dbNo', 'mdbPos', 'site', 'sepDiscipline', 'sepGroup', 'teamsFolder', 'teamsFile',
      'discFolder', 'b1File', 'b2File', 'b3File', 'refFolder', 'refFile', 'fixupFolder', 'fixupFile', 'registerFile'],
    clause: ['token', 'op', 'value'],
    zoneRule: ['id', 'when', 'forEach', 'patterns', 'source'],
    ref: ['db', 'pos', 'active', 'note'],
    inUse: ['teams', 'dbs', 'source', 'importedAt'],
    inUseDb: ['name', 'number'],
    output: ['includeReadme', 'includeRegister', 'includeConfig', 'includeReference', 'includeFixup', 'includeExistingTeamsBlock', 'split'],
  };

  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  function ordered(obj, keys, map) {
    if (!isObj(obj)) return obj;
    const out = {};
    for (const k of keys) if (k in obj) out[k] = map && map[k] ? map[k](obj[k]) : obj[k];
    for (const k of Object.keys(obj)) if (!(k in out)) out[k] = obj[k];
    return out;
  }
  const each = (fn) => v => (Array.isArray(v) ? v.map(fn) : v);

  E.normalize = function (c) {
    const clauses = each(w => ordered(w, ORDER.clause));
    return ordered(c, ORDER.root, {
      project: v => ordered(v, ORDER.project),
      mdbs: each(m => ordered(m, ORDER.mdb)),
      dbDefaults: v => ordered(v, ORDER.dbDefaults),
      attributes: each(a => {
        const cols = (a && a.columns || []).map(x => x.id);
        return ordered(a, ORDER.attribute, {
          columns: each(x => ordered(x, ORDER.column)),
          rows: each(r => ordered(r, cols)),
        });
      }),
      combination: v => ordered(v, ORDER.combination, { condition: clauses }),
      templates: v => ordered(v, ORDER.templates),
      zoneRules: each(r => ordered(r, ORDER.zoneRule, { when: clauses })),
      referenceDbs: each(r => ordered(r, ORDER.ref)),
      inUse: v => ordered(v, ORDER.inUse, { dbs: each(x => ordered(x, ORDER.inUseDb)) }),
      output: v => ordered(v, ORDER.output),
    });
  };

  E.exportJson = c => JSON.stringify(E.normalize(c), null, 2) + '\n';

  // Structural check before import. Returns a list of messages (empty = OK).
  E.checkSchema = function (c) {
    const errs = [];
    const need = (cond, msg) => { if (!cond) errs.push(msg); };
    if (!isObj(c)) return ['Isi file bukan objek JSON'];
    if (typeof c.schema !== 'number') return ['Kunci "schema" (versi) tidak ada; bukan config E3D Setup Generator'];
    if (c.schema > E.SCHEMA_VERSION) return [`Config dibuat oleh versi lebih baru (skema ${c.schema}); tool ini skema ${E.SCHEMA_VERSION}`];
    for (const k of ['project', 'dbDefaults', 'combination', 'templates', 'output']) need(isObj(c[k]), `Kunci "${k}" harus objek`);
    for (const k of ['mdbs', 'attributes', 'zoneRules', 'referenceDbs']) need(Array.isArray(c[k]), `Kunci "${k}" harus daftar`);
    if (errs.length) return errs;
    for (const k of ORDER.project) need(k in c.project, `project.${k} tidak ada`);
    need(['CRLF', 'LF'].includes(c.project.lineEnding), 'project.lineEnding harus CRLF atau LF');
    need(c.mdbs.length >= 1 && c.mdbs.every(m => isObj(m) && typeof m.name === 'string'), 'mdbs: minimal satu MDB dengan nama');
    c.attributes.forEach((a, i) => {
      need(isObj(a) && typeof a.id === 'string' && typeof a.name === 'string', `attributes[${i}]: id dan name wajib`);
      need(isObj(a) && ['team', 'user', 'separator', 'none'].includes(a.role), `attributes[${i}]: role tidak valid`);
      need(isObj(a) && Array.isArray(a.columns) && Array.isArray(a.rows), `attributes[${i}]: columns dan rows harus daftar`);
      if (isObj(a) && Array.isArray(a.columns)) a.columns.forEach((col, j) => {
        need(isObj(col) && ['text', 'number', 'boolean', 'ref', 'refList'].includes(col.type), `attributes[${i}].columns[${j}]: type tidak valid`);
        if (isObj(col) && (col.type === 'ref' || col.type === 'refList')) need(typeof col.target === 'string', `attributes[${i}].columns[${j}]: target wajib`);
      });
      if (isObj(a) && Array.isArray(a.rows)) need(a.rows.every(isObj), `attributes[${i}].rows: setiap baris harus objek`);
    });
    need(['all', 'matrix', 'condition'].includes(c.combination.mode), 'combination.mode harus all, matrix, atau condition');
    for (const k of ['dbName', 'dbDesc', 'dbNo', 'mdbPos', 'site']) need(typeof c.templates[k] === 'string', `templates.${k} wajib`);
    c.zoneRules.forEach((r, i) => need(isObj(r) && Array.isArray(r.when) && Array.isArray(r.patterns), `zoneRules[${i}]: when dan patterns wajib`));
    c.referenceDbs.forEach((r, i) => need(isObj(r) && typeof r.db === 'string' && typeof r.active === 'boolean', `referenceDbs[${i}]: db dan active wajib`));
    if ('inUse' in c) need(isObj(c.inUse), 'inUse harus objek');
    return errs;
  };

  // Migrations: MIGRATIONS[n] turns schema n into n+1 and returns notes for the user.
  const MIGRATIONS = {};
  E.migrate = function (c) {
    const notes = [];
    let cfg = E.clone(c);
    while (cfg.schema < E.SCHEMA_VERSION) {
      const step = MIGRATIONS[cfg.schema];
      if (!step) throw new Error(`Tidak ada migrasi dari skema ${cfg.schema}`);
      notes.push(...step(cfg));
      cfg.schema += 1;
    }
    return { config: cfg, notes };
  };

  // "Kosong": structure only, no project data. Generic names, nothing project-specific.
  E.emptyConfig = function () {
    const txt = (id, name, required) => ({ id, name, type: 'text', required: !!required });
    return {
      schema: E.SCHEMA_VERSION,
      project: { code: 'PRJ', name: '', target: 'E3D 3.1 / Administration 2.1', filePrefix: 'PRJ-', packageName: 'PRJ-SETUP-PACKAGE.zip', lineEnding: 'CRLF' },
      mdbs: [{ name: '/MDB-PRJ', default: true }],
      dbDefaults: { type: 'DESI', access: 'MULTIWRITE', claim: 'IMPLICIT' },
      attributes: [
        { id: 'team', name: 'Team', role: 'team', columns: [txt('kode', 'Kode', true), txt('desc', 'Deskripsi', true),
          { id: 'existing', name: 'Sudah ada', type: 'boolean', required: false },
          { id: 'anggota', name: 'Anggota', type: 'refList', required: false, target: 'user' }], rows: [] },
        { id: 'user', name: 'User', role: 'user', columns: [txt('kode', 'Kode', true), txt('desc', 'Deskripsi', true),
          { id: 'free', name: 'Free user', type: 'boolean', required: false }], rows: [] },
        { id: 'disiplin', name: 'Disiplin', role: 'none', columns: [txt('kode', 'Kode', true), txt('desc', 'Deskripsi', true),
          { id: 'urutan', name: 'Urutan', type: 'number', required: true },
          { id: 'team', name: 'Team', type: 'ref', required: true, target: 'team' },
          { id: 'mdbMulai', name: 'MDB mulai', type: 'number', required: true }], rows: [] },
        { id: 'area', name: 'Area', role: 'none', columns: [txt('kode', 'Kode', true), txt('desc', 'Deskripsi', true),
          { id: 'slot', name: 'Slot', type: 'number', required: true }], rows: [] },
      ],
      combination: { rowAttr: 'disiplin', colAttr: 'area', mode: 'matrix', excluded: [], condition: [], mdb: '/MDB-PRJ' },
      templates: {
        dbName: '{Disiplin.team.kode}/DESI-{Disiplin.kode}-{Area.kode}',
        dbDesc: 'DB for {Disiplin.desc} - {Area.desc}',
        dbNo: '10000 + {Disiplin.urutan} * 100 + {Area.slot}',
        mdbPos: '{Disiplin.mdbMulai} + {INDEX} - 1',
        site: '/{Disiplin.kode}-{Area.kode}',
        sepDiscipline: '/----{Disiplin.desc|upper}----',
        sepGroup: '',
        teamsFolder: '00-TEAMS',
        teamsFile: '{PROJECT.filePrefix}00-TEAMS-ADMIN.mac',
        discFolder: '{Disiplin.urutan|pad:2}-{Disiplin.kode}-{Disiplin.team.kode}',
        b1File: '{PROJECT.filePrefix}{Disiplin.urutan|pad:2}-{Disiplin.kode}-B1-CREATE-DB-MDB-ADMIN.mac',
        b2File: '{PROJECT.filePrefix}{Disiplin.urutan|pad:2}-{Disiplin.kode}-B2-SITES-DESIGN.mac',
        b3File: '{PROJECT.filePrefix}{Disiplin.urutan|pad:2}-{Disiplin.kode}-B3-ZONES-DESIGN.mac',
        refFolder: '90-REFERENCE',
        refFile: '{PROJECT.filePrefix}90-REF-MDB-ADMIN.mac',
        fixupFolder: '99-FIXUP',
        fixupFile: '{PROJECT.filePrefix}99-MDB-REORDER-ADMIN.mac',
        registerFile: '{PROJECT.code}-E3D-Register.xlsx',
      },
      zoneRules: [],
      referenceDbs: [],
      output: { includeReadme: true, includeRegister: true, includeConfig: true, includeReference: true, includeFixup: true, includeExistingTeamsBlock: true, split: 'perDiscipline' },
    };
  };
})(E3D);
