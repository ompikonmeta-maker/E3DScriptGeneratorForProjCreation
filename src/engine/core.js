/* E3D Setup Generator engine: namespace, config index, tokens, expressions.
   Pure functions, no DOM. Mirrors tools/reference_generator.py. */
var E3D = typeof E3D !== 'undefined' ? E3D : {};
(function (E) {
  'use strict';

  E.VERSION = '1.0.0';
  E.SCHEMA_VERSION = 1;

  // Facts from docs/RULES.md that change generator behaviour. Flip a flag once omPik has tested it.
  E.FACTS = {
    newZoneTested: false,       // §9 / OI-04: "/site" then "NEW ZONE /x"
    interDbOrderProven: false,  // §9 / OI-05: inter-DB site order follows MDB order
  };
  E.MULTIWRITE_TYPES = ['DESI', 'CATA', 'DRAFT', 'ISODRAFT'];   // fact 1.4
  E.NAME_OK_RE = /^\/[A-Z0-9-]+$/;                              // other chars: warning (§9)
  E.RESERVED_HEADS = ['PROJECT', 'SITE', 'INDEX'];
  E.FILTERS = ['upper', 'lower', 'pad'];

  const TOKEN_SRC = '\\{([A-Za-z_][A-Za-z0-9_.]*)((?:\\|[a-z]+(?::[0-9]+)?)*)\\}';
  E.tokenRe = () => new RegExp(TOKEN_SRC, 'g');

  class TplError extends Error {}   // structural: unknown head/column, wrong context (V03)
  class DataError extends Error {}  // row data missing; reported by V01, not here
  class ExprError extends Error {}  // V04
  E.TplError = TplError; E.DataError = DataError; E.ExprError = ExprError;

  /* ---------- Config index ---------- */
  E.index = function (d) {
    const cfg = { d, attrs: {}, byName: {}, rows: {} };
    for (const a of d.attributes || []) {
      cfg.attrs[a.id] = a;
      cfg.byName[a.name] = a;
      const m = new Map();
      for (const r of a.rows || []) if (!m.has(r.kode)) m.set(r.kode, r);
      cfg.rows[a.id] = m;
    }
    cfg.col = (attrId, colId) => {
      const a = cfg.attrs[attrId];
      return a ? (a.columns || []).find(c => c.id === colId) || null : null;
    };
    cfg.role = role => (d.attributes || []).filter(a => a.role === role);
    return cfg;
  };

  /* ---------- Tokens ---------- */
  E.parseTokens = function (tpl) {
    const out = [], re = E.tokenRe();
    let m;
    while ((m = re.exec(tpl || ''))) out.push({ raw: m[0], path: m[1], filters: m[2], index: m.index });
    return out;
  };

  // Split a pattern into literal and token segments (used by the pattern editor).
  E.segments = function (tpl) {
    const segs = [];
    let last = 0;
    for (const t of E.parseTokens(tpl)) {
      if (t.index > last) segs.push({ type: 'lit', text: tpl.slice(last, t.index) });
      segs.push({ type: 'tok', path: t.path, filters: t.filters, text: t.raw });
      last = t.index + t.raw.length;
    }
    if (last < (tpl || '').length) segs.push({ type: 'lit', text: tpl.slice(last) });
    return segs;
  };

  E.resolve = function (cfg, path, ctx) {
    const parts = path.split('.'), head = parts[0];
    if (head === 'PROJECT') {
      if (parts.length !== 2 || !Object.prototype.hasOwnProperty.call(cfg.d.project || {}, parts[1]))
        throw new TplError(`token '${path}': kolom PROJECT tidak dikenal`);
      return cfg.d.project[parts[1]];
    }
    if (head === 'SITE' || head === 'INDEX') {
      if (parts.length !== 1) throw new TplError(`token '${path}': ${head} tidak punya kolom`);
      if (!(head in ctx)) throw new TplError(`token '${path}' tidak tersedia di template ini`);
      return ctx[head];
    }
    const attr = cfg.byName[head];
    if (!attr) throw new TplError(`kepala token '${head}' tidak dikenal`);
    if (!(head in ctx)) throw new TplError(`token '${path}' tidak tersedia di template ini`);
    if (parts.length === 1) throw new TplError(`token '${path}' perlu nama kolom`);
    let row = ctx[head], attrId = attr.id;
    for (let i = 1; i < parts.length; i++) {
      const seg = parts[i], c = cfg.col(attrId, seg);
      if (!c) throw new TplError(`kolom '${seg}' tidak ada di ${cfg.attrs[attrId].name} (token '${path}')`);
      const last = i === parts.length - 1;
      if (!last && c.type !== 'ref') throw new TplError(`'${seg}' di '${path}' bukan kolom referensi`);
      if (!row) throw new DataError(`baris untuk '${path}' tidak ada`);
      const val = row[seg];
      if (!last) {
        const next = cfg.rows[c.target] && cfg.rows[c.target].get(val);
        if (!next) throw new DataError(`${val} tidak ada di ${(cfg.attrs[c.target] || {}).name || c.target}`);
        row = next; attrId = c.target;
        continue;
      }
      return val === undefined || val === null ? '' : val;
    }
    return '';
  };

  E.applyFilters = function (val, filters) {
    for (const f of (filters || '').split('|').filter(Boolean)) {
      const [name, arg] = f.split(':');
      if (name === 'upper') val = String(val).toUpperCase();
      else if (name === 'lower') val = String(val).toLowerCase();
      else if (name === 'pad') val = String(val).padStart(parseInt(arg || '0', 10), '0');
      else throw new TplError(`filter '${name}' tidak dikenal`);
    }
    return val;
  };

  // Render a template. onErr(err) receives TplError/DataError; the token becomes '?'.
  E.render = function (cfg, tpl, ctx, onErr) {
    return String(tpl || '').replace(E.tokenRe(), (raw, path, filters) => {
      try {
        return String(E.applyFilters(E.resolve(cfg, path, ctx), filters));
      } catch (e) {
        if (!(e instanceof TplError || e instanceof DataError)) throw e;
        if (onErr) onErr(e);
        return '?';
      }
    });
  };

  // Static check of a template against the heads available in its context (V03).
  // heads: list of attribute names / PROJECT / SITE / INDEX. Returns error messages.
  E.checkTemplate = function (cfg, tpl, heads) {
    const errs = [];
    for (const t of E.parseTokens(tpl)) {
      const parts = t.path.split('.'), head = parts[0];
      try {
        for (const f of t.filters.split('|').filter(Boolean))
          if (!E.FILTERS.includes(f.split(':')[0])) throw new TplError(`filter '${f}' tidak dikenal`);
        if (!heads.includes(head)) {
          if (head !== 'PROJECT' && head !== 'SITE' && head !== 'INDEX' && !cfg.byName[head])
            throw new TplError(`kepala token '${head}' tidak dikenal`);
          throw new TplError(`token '${t.path}' tidak tersedia di template ini`);
        }
        if (head === 'PROJECT') {
          if (parts.length !== 2 || !Object.prototype.hasOwnProperty.call(cfg.d.project || {}, parts[1]))
            throw new TplError(`token '${t.path}': kolom PROJECT tidak dikenal`);
        } else if (head === 'SITE' || head === 'INDEX') {
          if (parts.length !== 1) throw new TplError(`token '${t.path}': ${head} tidak punya kolom`);
        } else {
          if (parts.length === 1) throw new TplError(`token '${t.path}' perlu nama kolom`);
          let attrId = cfg.byName[head].id;
          for (let i = 1; i < parts.length; i++) {
            const c = cfg.col(attrId, parts[i]);
            if (!c) throw new TplError(`kolom '${parts[i]}' tidak ada di ${cfg.attrs[attrId].name}`);
            if (i < parts.length - 1) {
              if (c.type !== 'ref') throw new TplError(`'${parts[i]}' di '${t.path}' bukan kolom referensi`);
              attrId = c.target;
              if (!cfg.attrs[attrId]) throw new TplError(`target '${c.target}' tidak ada`);
            }
          }
        }
      } catch (e) {
        if (!(e instanceof TplError)) throw e;
        errs.push(e.message);
      }
    }
    const stray = String(tpl || '').replace(E.tokenRe(), '');
    if (/[{}]/.test(stray)) errs.push('kurung kurawal { } tidak berpasangan atau token tidak valid');
    return errs;
  };

  /* ---------- Integer expressions (no eval) ---------- */
  E.evaluate = function (expr) {
    const toks = String(expr).match(/\d+|[-+*/()]/g) || [];
    if (toks.join('') !== String(expr).replace(/\s+/g, '') || !toks.length)
      throw new ExprError(`ekspresi tidak valid '${expr}'`);
    let pos = 0;
    const peek = () => toks[pos], take = () => toks[pos++];
    function factor() {
      const t = take();
      if (t === '(') {
        const v = sum();
        if (take() !== ')') throw new ExprError(`kurung tidak berpasangan '${expr}'`);
        return v;
      }
      if (t === '-') return -factor();
      if (t === undefined || !/^\d+$/.test(t)) throw new ExprError(`ekspresi tidak valid '${expr}'`);
      return parseInt(t, 10);
    }
    function term() {
      let v = factor();
      while (peek() === '*' || peek() === '/') {
        const op = take(), r = factor();
        if (op === '*') v *= r;
        else {
          if (r === 0) throw new ExprError(`pembagian dengan nol '${expr}'`);
          if (v % r) throw new ExprError(`hasil bukan bilangan bulat '${expr}'`);
          v = v / r;
        }
      }
      return v;
    }
    function sum() {
      let v = term();
      while (peek() === '+' || peek() === '-') v = take() === '+' ? v + term() : v - term();
      return v;
    }
    const v = sum();
    if (pos !== toks.length) throw new ExprError(`ekspresi tidak valid '${expr}'`);
    return v;
  };

  /* ---------- Clauses (zone rules, combination condition) ---------- */
  E.matches = function (cfg, when, ctx, onErr) {
    for (const w of when || []) {
      let v;
      try { v = E.resolve(cfg, w.token, ctx); } catch (e) {
        if (!(e instanceof TplError || e instanceof DataError)) throw e;
        if (onErr) onErr(e);
        return false;
      }
      v = String(v);
      const list = Array.isArray(w.value) ? w.value.map(String) : [String(w.value)];
      if (w.op === 'eq' && v !== String(w.value)) return false;
      if (w.op === 'ne' && v === String(w.value)) return false;
      if (w.op === 'in' && !list.includes(v)) return false;
    }
    return true;
  };

  E.isAscii = s => !/[^\x00-\x7F]/.test(s);
  E.clone = o => JSON.parse(JSON.stringify(o));
})(E3D);
