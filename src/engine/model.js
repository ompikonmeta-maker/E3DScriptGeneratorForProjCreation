/* Model: cells (row attr x column attr), separators, zones. SPEC §4 steps 1-7. */
(function (E) {
  'use strict';

  // Which template is rendered in which context (SPEC 3.2).
  E.TEMPLATE_KINDS = {
    dbName: 'cell', dbDesc: 'cell', dbNo: 'cell', mdbPos: 'cell', site: 'cell',
    sepDiscipline: 'row', sepGroup: 'group',
    discFolder: 'row', b1File: 'row', b2File: 'row', b3File: 'row',
    teamsFolder: 'project', teamsFile: 'project', refFolder: 'project', refFile: 'project',
    fixupFolder: 'project', fixupFile: 'project', registerFile: 'project',
  };
  E.EXPRESSION_TEMPLATES = ['dbNo', 'mdbPos'];
  E.OPTIONAL_TEMPLATES = ['sepDiscipline', 'sepGroup'];

  // Attribute names that play the row / column / group parts of the combination.
  E.roles = function (cfg) {
    const comb = cfg.d.combination || {};
    const rowAttr = cfg.attrs[comb.rowAttr] || null, colAttr = cfg.attrs[comb.colAttr] || null;
    const gcol = colAttr && comb.groupBy ? cfg.col(colAttr.id, comb.groupBy) : null;
    const groupAttr = gcol && gcol.type === 'ref' ? cfg.attrs[gcol.target] || null : null;
    return { rowAttr, colAttr, groupAttr, groupCol: groupAttr ? comb.groupBy : null };
  };

  E.contextHeads = function (cfg, kind, forEachId) {
    const { rowAttr, colAttr, groupAttr } = E.roles(cfg);
    const r = rowAttr ? [rowAttr.name] : [], c = colAttr ? [colAttr.name] : [], g = groupAttr ? [groupAttr.name] : [];
    switch (kind) {
      case 'cell': return [...r, ...c, ...g, 'INDEX', 'PROJECT'];
      case 'row': return [...r, 'PROJECT'];
      case 'group': return [...r, ...g, ...c, 'PROJECT'];
      case 'condition': return [...r, ...c, ...g];
      case 'zone': {
        const fe = forEachId && cfg.attrs[forEachId] ? [cfg.attrs[forEachId].name] : [];
        return [...r, ...c, ...g, 'INDEX', 'PROJECT', 'SITE', ...fe];
      }
      default: return ['PROJECT'];
    }
  };

  const num = v => (typeof v === 'number' ? v : parseFloat(v));

  E.buildModel = function (cfg) {
    const d = cfg.d, t = d.templates || {}, comb = d.combination || {};
    const { rowAttr, colAttr, groupAttr, groupCol } = E.roles(cfg);
    const model = { disciplines: [], cells: [], exprErrors: [], rowAttr, colAttr, groupAttr };
    if (!rowAttr || !colAttr) return model;
    const excluded = new Set((comb.excluded || []).map(p => p[0] + '\u0000' + p[1]));
    const mode = comb.mode || 'matrix';
    const hasUrutan = !!cfg.col(rowAttr.id, 'urutan');
    const discs = (rowAttr.rows || []).map((r, i) => [r, i])
      .sort((a, b) => hasUrutan ? (num(a[0].urutan) - num(b[0].urutan)) || (a[1] - b[1]) : a[1] - b[1])
      .map(x => x[0]);
    const mdbCol = cfg.col(rowAttr.id, 'mdb');
    const sepRole = groupAttr && groupAttr.role === 'separator' && t.sepGroup;

    for (const dr of discs) {
      const cells = [];
      let idx = 0;
      const rowMdb = mdbCol && mdbCol.type === 'text' && dr.mdb ? dr.mdb : comb.mdb;
      for (const ar of colAttr.rows || []) {
        const base = { [rowAttr.name]: dr, [colAttr.name]: ar };
        if (groupAttr) base[groupAttr.name] = cfg.rows[groupAttr.id].get(ar[groupCol]);
        if (mode === 'matrix' && excluded.has(dr.kode + '\u0000' + ar.kode)) continue;
        if (mode === 'condition' && !E.matches(cfg, comb.condition || [], base)) continue;
        idx += 1;
        const ctx = Object.assign({}, base, { INDEX: idx });
        const cell = { ctx, rowKode: dr.kode, colKode: ar.kode, group: groupCol ? ar[groupCol] : null, mdb: rowMdb };
        cell.db = E.render(cfg, t.dbName, ctx);
        cell.desc = E.render(cfg, t.dbDesc, ctx);
        for (const [key, tpl] of [['dbno', 'dbNo'], ['pos', 'mdbPos']]) {
          try { cell[key] = E.evaluate(E.render(cfg, t[tpl], ctx)); } catch (e) {
            if (!(e instanceof E.ExprError)) throw e;
            cell[key] = null;
            model.exprErrors.push({ template: tpl, cell, message: e.message });
          }
        }
        cell.site = E.render(cfg, t.site, ctx);
        cell.team = cell.db.includes('/') ? cell.db.split('/')[0] : null;
        ctx.SITE = cell.site;
        const zones = [], zoneRules = [];
        let targeted = false;
        for (const rule of d.zoneRules || []) {
          if (!E.matches(cfg, rule.when, ctx)) continue;
          if ((rule.when || []).some(w => String(w.token).split('.')[0] === rowAttr.name)) targeted = true;
          const fa = rule.forEach ? cfg.attrs[rule.forEach] : null;
          if (fa) {
            for (const fr of fa.rows || []) {
              const zctx = Object.assign({}, ctx, { [fa.name]: fr });
              for (const p of rule.patterns || []) { zones.push(E.render(cfg, p, zctx)); zoneRules.push(rule.id); }
            }
          } else if (!rule.forEach) {
            for (const p of rule.patterns || []) { zones.push(E.render(cfg, p, ctx)); zoneRules.push(rule.id); }
          }
        }
        cell.zones = zones;
        cell.zoneRules = zoneRules;
        cell.targeted = targeted;
        cells.push(cell);
      }
      if (!cells.length) continue;
      const dctx = { [rowAttr.name]: dr };
      const groupSeps = new Map();
      if (sepRole) {
        for (const c of cells) if (!groupSeps.has(c.group)) groupSeps.set(c.group, E.render(cfg, t.sepGroup, c.ctx));
      }
      model.disciplines.push({
        row: dr, ctx: dctx, cells, mdb: rowMdb,
        sepDiscipline: t.sepDiscipline ? E.render(cfg, t.sepDiscipline, dctx) : null,
        groupSeps,
      });
      model.cells.push(...cells);
    }
    return model;
  };

  // Site creation order of one row (drives B2): {kind, name, db, cell?, group?}. SPEC §4 steps 5-6.
  E.siteOrder = function (dd) {
    const out = [];
    if (dd.sepDiscipline) out.push({ kind: 'sepDiscipline', name: dd.sepDiscipline, db: dd.cells[0].db });
    let lastGroup = {};
    for (const c of dd.cells) {
      if (c.group !== lastGroup) {
        lastGroup = c.group;
        if (dd.groupSeps.has(c.group)) out.push({ kind: 'sepGroup', name: dd.groupSeps.get(c.group), db: c.db, group: c.group });
      }
      out.push({ kind: 'site', name: c.site, db: c.db, cell: c, group: c.group });
    }
    return out;
  };

  E.counts = function (cfg, model) {
    const teamAttr = cfg.role('team')[0];
    const teams = teamAttr ? teamAttr.rows || [] : [];
    const refs = cfg.d.referenceDbs || [];
    return {
      teamsNew: teams.filter(r => !r.existing).length,
      teamsExisting: teams.filter(r => r.existing).length,
      dbs: model.cells.length,
      sites: model.cells.length,
      separators: model.disciplines.reduce((n, dd) => n + (dd.sepDiscipline ? 1 : 0) + dd.groupSeps.size, 0),
      zones: model.cells.reduce((n, c) => n + c.zones.length, 0),
      refsActive: refs.filter(r => r.active).length,
      refsInactive: refs.filter(r => !r.active).length,
    };
  };
})(E3D);
