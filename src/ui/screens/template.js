/* Screen 4: Template. Token palette, pattern editors (chips or raw text), live samples, zone rules. */
(function (U) {
  'use strict';
  const E = E3D, A = U.App, esc = U.esc;

  const GROUPS = [
    ['Nama & nomor per sel', ['dbName', 'dbDesc', 'dbNo', 'mdbPos', 'site']],
    ['Separator', ['sepDiscipline', 'sepGroup']],
    ['File & folder', ['teamsFolder', 'teamsFile', 'discFolder', 'b1File', 'b2File', 'b3File', 'refFolder', 'refFile', 'fixupFolder', 'fixupFile', 'registerFile']],
  ];
  const LABEL = {
    dbName: 'nama DB (TEAM/NAMA)', dbDesc: "DESC '…'", dbNo: 'ekspresi · DBNO', mdbPos: 'ekspresi · posisi MDB', site: 'NEW SITE',
    sepDiscipline: 'per baris · opsional', sepGroup: 'per grup · opsional', teamsFolder: 'folder', teamsFile: 'file 00-TEAMS', discFolder: 'folder per baris',
    b1File: 'file B1 per baris', b2File: 'file B2 per baris', b3File: 'file B3 per baris', refFolder: 'folder', refFile: 'file 90', fixupFolder: 'folder', fixupFile: 'file 99', registerFile: 'register .xlsx',
  };
  const OK = {
    dbName: ['team ada (1.1, 1.12)', 'unik'], dbNo: ['1–7000 / 10000–250000 (1.3)', 'unik'], mdbPos: ['1–5000, unik (§2)'],
    site: ['diawali / (3.5)', 'huruf besar'], dbDesc: ['tanpa tanda kutip', 'ASCII'], sepDiscipline: ['diawali / (3.5)'], sepGroup: ['diawali / (3.5)'],
  };
  const CELL_KEY = { dbName: 'db', dbDesc: 'desc', dbNo: 'dbno', mdbPos: 'pos', site: 'site' };

  /* ---------- Pattern editor ---------- */
  U.patternEditor = function (path, value, loc) {
    const v = String(value === undefined || value === null ? '' : value);
    if (A.ui.tplRaw[path]) {
      return `<div class="inline" style="flex-wrap:nowrap"><input class="input raw" data-bind="${esc(path)}" data-raw="${esc(path)}" value="${esc(v)}" ${loc ? `data-loc="${loc}"` : ''} spellcheck="false" aria-label="Pola ${esc(path)}">
        <button class="icon-btn sm" type="button" data-act="patMode" data-path="${esc(path)}" title="Tampilan chip" aria-label="Tampilan chip">${U.icon('table', 'sm')}</button></div>`;
    }
    const segs = E.segments(v), html = [];
    const lit = text => `<input class="lit" data-lit value="${esc(text)}" size="${Math.max(1, text.length)}" placeholder="·" spellcheck="false" aria-label="Teks">`;
    let prevTok = true;
    segs.forEach((s, i) => {
      if (s.type === 'lit') { html.push(lit(s.text)); prevTok = false; return; }
      if (prevTok) html.push(lit(''));
      const head = s.path.split('.')[0];
      const sys = ['PROJECT', 'SITE', 'INDEX'].includes(head);
      html.push(`<button type="button" class="tchip${sys ? ' sys' : ''}" data-tok="${i}" data-raw="${esc(s.text)}" title="Klik: filter atau hapus">${esc(s.path)}${s.filters ? `<i>${esc(s.filters)}</i>` : ''}</button>`);
      prevTok = true;
    });
    if (prevTok) html.push(lit(''));
    return `<div class="inline" style="flex-wrap:nowrap;align-items:flex-start"><div class="pattern" data-pattern="${esc(path)}" ${loc ? `data-loc="${loc}"` : ''} style="flex:1">${html.join('')}<span class="dropzone" title="Seret token ke sini"></span></div>
      <button class="icon-btn sm" type="button" data-act="patMode" data-path="${esc(path)}" title="Teks mentah" aria-label="Teks mentah">${U.icon('file', 'sm')}</button></div>`;
  };
  // Rebuild the pattern string from the chip editor DOM.
  function patternFromDom(box) {
    return Array.from(box.children).map(el => (el.matches('input.lit') ? el.value : el.matches('.tchip') ? el.dataset.raw : '')).join('');
  }
  function offsetIn(box, input) {
    let off = 0;
    for (const el of box.children) {
      if (el === input) return off + (input.selectionStart === null ? input.value.length : input.selectionStart);
      off += el.matches('input.lit') ? el.value.length : el.matches('.tchip') ? el.dataset.raw.length : 0;
    }
    return off;
  }
  let last = null; // {path, offset}
  function remember(el) {
    const box = el.closest('[data-pattern]');
    if (box && el.matches('input.lit')) last = { path: box.dataset.pattern, offset: offsetIn(box, el) };
    else if (el.matches('input[data-raw]')) last = { path: el.dataset.raw, offset: el.selectionStart };
  }
  function insertToken(tok, target) {
    const t = target || last;
    if (!t) return U.toast('Klik dulu di salah satu pola, lalu klik token');
    const cur = String(U.getPath(A.config, t.path) || '');
    const off = Math.min(t.offset === undefined || t.offset === null ? cur.length : t.offset, cur.length);
    const next = cur.slice(0, off) + tok + cur.slice(off);
    A.mutate(c => U.setPath(c, t.path, next));
    last = { path: t.path, offset: off + tok.length };
    focusAt(last);
  }
  function focusAt(t) {
    const raw = U.$(`input[data-raw="${CSS.escape(t.path)}"]`);
    if (raw) { raw.focus(); raw.setSelectionRange(t.offset, t.offset); return; }
    const box = U.$(`[data-pattern="${CSS.escape(t.path)}"]`);
    if (!box) return;
    let off = 0;
    for (const el of box.children) {
      const len = el.matches('input.lit') ? el.value.length : el.matches('.tchip') ? el.dataset.raw.length : 0;
      if (el.matches('input.lit') && t.offset <= off + len) { el.focus(); const p = t.offset - off; el.setSelectionRange(p, p); return; }
      off += len;
    }
  }

  /* ---------- Samples ---------- */
  function sample(A, key) {
    const r = A.r, kind = E.TEMPLATE_KINDS[key], tpl = A.config.templates[key];
    if (!tpl) return { text: '(kosong)', meta: '' };
    if (kind === 'cell') {
      const cells = r.model.cells;
      if (!cells.length) return { text: '—', meta: 'belum ada sel' };
      const vals = cells.map(c => c[CELL_KEY[key]]);
      if (E.EXPRESSION_TEMPLATES.includes(key)) {
        const nums = vals.filter(Number.isInteger);
        return { text: vals[0] === null ? '?' : vals[0], meta: nums.length ? `rentang ${Math.min(...nums)}–${Math.max(...nums)}` : 'tidak ada hasil' };
      }
      return { text: vals[0], meta: `${U.num(cells.length)} hasil · ${U.num(new Set(vals).size)} unik` };
    }
    if (kind === 'row' || kind === 'group') {
      const ds = r.model.disciplines;
      if (!ds.length) return { text: '—', meta: 'belum ada baris' };
      if (kind === 'group') {
        const all = ds.flatMap(d => [...d.groupSeps.values()]);
        return all.length ? { text: all[0], meta: `${all.length} hasil` } : { text: '—', meta: 'grup tanpa peran Separator' };
      }
      return { text: E.render(r.cfg, tpl, ds[0].ctx), meta: `${ds.length} hasil` };
    }
    return { text: E.render(r.cfg, tpl, {}), meta: '1 hasil' };
  }

  const parts = {};
  for (const [, keys] of GROUPS) for (const k of keys) {
    parts['s-' + k] = A => { const s = sample(A, k); return `<span>Contoh</span><span class="v">${esc(s.text)}</span><span>${esc(s.meta)}</span>`; };
    parts['c-' + k] = A => U.chipsFor('t:' + k, OK[k] || ['token valid']);
  }
  parts.zoneHead = A => {
    const iss = A.r.issues.filter(i => i.id === 'V19' || i.id === 'V20');
    return iss.map(i => `<span class="chip warn">${U.icon('warning')}${esc(i.message)}<span class="chip ref">${i.id}${i.ref !== '-' ? ' · ' + i.ref : ''}</span></span>`).join('');
  };
  parts.zoneSamples = (A, el) => '';
  function ruleSample(A, i) {
    const rule = A.config.zoneRules[i];
    let n = 0, cells = 0;
    const ex = [];
    for (const c of A.r.model.cells) {
      let hit = false;
      c.zoneRules.forEach((id, k) => { if (id === rule.id) { n++; hit = true; if (ex.length < 3) ex.push(c.zones[k]); } });
      if (hit) cells++;
    }
    return `<span>Contoh</span>${ex.map(z => `<span class="v">${esc(z)}</span>`).join('') || '<span class="v">—</span>'}<span>${U.num(n)} zone di ${U.num(cells)} site</span>` + U.chipsFor('z:' + i);
  }

  function palette(A) {
    const heads = A.config.attributes.map(a => a.name);
    const groups = A.config.attributes.map(a => {
      const toks = U.tokenPaths([a.name]);
      const role = a.role !== 'none';
      return `<div class="grp" data-grp><b>${esc(a.name)}</b><div class="toks">${toks.map(t => `<button type="button" class="tok${role ? ' role' : ''}" draggable="true" data-act="tokIns" data-tok="${esc(t)}">${esc(t)}</button>`).join('')}</div></div>`;
    });
    groups.push(`<div class="grp" data-grp><b>PROJECT</b><div class="toks">${['PROJECT.code', 'PROJECT.name', 'PROJECT.filePrefix', 'PROJECT.target'].map(t => `<button type="button" class="tok sys" draggable="true" data-act="tokIns" data-tok="${t}">${t}</button>`).join('')}</div></div>`);
    groups.push(`<div class="grp" data-grp><b>Khusus</b><div class="toks"><button type="button" class="tok sys" draggable="true" data-act="tokIns" data-tok="INDEX" title="Nomor sel di dalam barisnya (1, 2, …)">INDEX</button><button type="button" class="tok sys" draggable="true" data-act="tokIns" data-tok="SITE" title="Nama site sel (hanya pola zone)">SITE</button></div></div>`);
    return `<div class="field"><label for="tokSearch">Cari token</label><input id="tokSearch" class="input" data-input="tokSearch" placeholder="mis. kode" autocomplete="off"></div>
      <span class="hint">Klik untuk menyisipkan di posisi kursor pola terakhir, atau seret ke pola. Filter (|upper, |lower, |pad:N) lewat klik chip token di pola.</span>
      <div class="palette">${groups.join('')}</div><span class="hint">${heads.length ? '' : 'Belum ada attribute.'}</span>`;
  }

  function tcard(A, k) {
    const kind = E.TEMPLATE_KINDS[k];
    const disabled = k === 'sepGroup' && !(E.roles(A.r.cfg).groupAttr && E.roles(A.r.cfg).groupAttr.role === 'separator');
    return `<div class="tcard" data-loc="t:${k}" id="tpl-${k}">
      <div class="hd"><b>${k}</b><span class="hint">${esc(LABEL[k] || kind)}</span></div>
      ${U.patternEditor('templates.' + k, A.config.templates[k], null)}
      <div class="sample" data-part="s-${k}">${parts['s-' + k](A)}</div>
      <div class="chips" data-part="c-${k}">${parts['c-' + k](A)}</div>
      ${disabled ? '<span class="hint">Grup kolom belum diatur atau attribute grup tidak berperan Separator: tidak dipakai.</span>' : ''}
    </div>`;
  }

  function rules(A) {
    const zr = A.config.zoneRules || [];
    const cellTokens = U.tokenPaths(E.contextHeads(A.r.cfg, 'cell'));
    return zr.map((r, i) => {
      const zoneTokens = U.tokenPaths(E.contextHeads(A.r.cfg, 'zone', r.forEach));
      return `<div class="rule" data-loc="z:${i}" id="rule-${i}">
        <div class="hd"><span class="chip">${i + 1}</span>
          <input class="input mono" style="max-width:200px;height:32px" data-bind="zoneRules.${i}.id" value="${esc(r.id)}" aria-label="Id aturan" spellcheck="false">
          <input class="input grow" style="height:32px" data-bind="zoneRules.${i}.source" value="${esc(r.source || '')}" placeholder="Sumber penamaan (mis. dokumen proyek 3.9)" aria-label="Sumber">
          <button class="icon-btn sm" type="button" data-act="ruleMove" data-i="${i}" data-d="-1" aria-label="Naik">${U.icon('up')}</button>
          <button class="icon-btn sm" type="button" data-act="ruleMove" data-i="${i}" data-d="1" aria-label="Turun">${U.icon('down')}</button>
          <button class="icon-btn sm danger" type="button" data-act="ruleDel" data-i="${i}" aria-label="Hapus aturan">${U.icon('delete')}</button></div>
        <div class="stack"><span class="hint">Jika (semua syarat):</span>${U.clauseEditor(`zoneRules.${i}.when`, r.when || [], cellTokens.concat('SITE'), 'ctok' + i)}</div>
        <div class="fields"><div class="field"><label for="fe${i}">Untuk tiap baris</label><select id="fe${i}" data-change="ruleForEach" data-i="${i}"><option value="">— (satu kali per site)</option>${U.attrOptions(r.forEach)}</select></div></div>
        <div class="stack"><span class="hint">Pola nama zone (diurutkan: tiap baris "untuk tiap", lalu tiap pola):</span>
          ${(r.patterns || []).map((p, k) => `<div class="inline" style="flex-wrap:nowrap"><div style="flex:1">${U.patternEditor(`zoneRules.${i}.patterns.${k}`, p, null)}</div>
            <button class="icon-btn sm danger" type="button" data-act="patDel" data-i="${i}" data-k="${k}" aria-label="Hapus pola">${U.icon('close')}</button></div>`).join('')}
          <button class="btn sm text" type="button" data-act="patAdd" data-i="${i}" style="align-self:flex-start">${U.icon('add')}Pola</button>
          <datalist id="ztok${i}">${zoneTokens.map(t => `<option value="${esc(t)}">`).join('')}</datalist></div>
        <div class="sample" data-part="z-${i}">${ruleSample(A, i)}</div>
      </div>`;
    }).join('') || '<p class="hint">Belum ada aturan zone. Tanpa aturan, file B3 tidak dibuat.</p>';
  }

  U.screens[4] = {
    title: 'Template konvensi',
    sub: 'Susun pola dari token attribute dan teks bebas. Contoh hasil dan validasi aturan E3D diperbarui langsung.',
    get parts() {
      const p = Object.assign({}, parts);
      (A.config.zoneRules || []).forEach((r, i) => { p['z-' + i] = A => ruleSample(A, i); });
      return p;
    },
    select(A, loc) { A.ui.tplFocus = loc.template ? 'tpl-' + loc.template : loc.zoneRule !== undefined ? 'rule-' + loc.zoneRule : null; },
    render(A) {
      return `<div class="split">
        <aside class="side card" aria-label="Token">${palette(A)}</aside>
        <div class="grow">
          ${GROUPS.map(([title, keys]) => `<section class="card"><h2>${title}</h2><div class="tcards">${keys.map(k => tcard(A, k)).join('')}</div></section>`).join('')}
          <section class="card" aria-label="Aturan zone" data-loc="f:zoneRules">
            <div class="card-head"><div><h2>Aturan zone · ${(A.config.zoneRules || []).length}</h2><div class="sub">Dicek per sel, berurutan. Zone dibuat dengan "/site" lalu NEW ZONE.</div></div>
              <button class="btn sm tonal" type="button" data-act="ruleAdd">${U.icon('add')}Aturan</button></div>
            <div class="chips" data-part="zoneHead">${parts.zoneHead(A)}</div>
            <div class="stack">${rules(A)}</div>
          </section>
        </div></div>`;
    },
    mount(root) {
      if (A.ui.tplFocus) { const el = U.$('#' + A.ui.tplFocus, root); A.ui.tplFocus = null; if (el) setTimeout(() => el.scrollIntoView({ block: 'center' }), 0); }
      if (root.dataset.tplBound) return;   // #main persists across renders: bind once
      root.dataset.tplBound = '1';
      root.addEventListener('focusin', ev => remember(ev.target));
      root.addEventListener('keyup', ev => remember(ev.target));
      root.addEventListener('click', ev => {
        if (ev.target.matches('input.lit, input[data-raw]')) remember(ev.target);
        const box = ev.target.closest('.pattern');
        if (box && ev.target === box) { const lits = U.$$('input.lit', box); const l = lits[lits.length - 1]; if (l) { l.focus(); l.setSelectionRange(l.value.length, l.value.length); } }
      });
      root.addEventListener('input', ev => {
        const el = ev.target;
        if (!el.matches('input.lit')) return;
        el.size = Math.max(1, el.value.length);
        const box = el.closest('[data-pattern]');
        U.setPath(A.config, box.dataset.pattern, patternFromDom(box));
        remember(el);
        A.touch();
      });
      root.addEventListener('dragstart', ev => { const t = ev.target.closest('.tok'); if (t) { ev.dataTransfer.setData('text/plain', `{${t.dataset.tok}}`); ev.dataTransfer.effectAllowed = 'copy'; } });
      root.addEventListener('dragover', ev => { const box = ev.target.closest('.pattern'); if (box && !ev.target.matches('input')) { ev.preventDefault(); box.classList.add('drop'); } });
      root.addEventListener('dragleave', ev => { const box = ev.target.closest('.pattern'); if (box) box.classList.remove('drop'); });
      root.addEventListener('drop', ev => {
        const box = ev.target.closest('.pattern');
        if (!box || ev.target.matches('input')) return;
        ev.preventDefault(); ev.stopPropagation();
        box.classList.remove('drop');
        const tok = ev.dataTransfer.getData('text/plain');
        if (tok) insertToken(tok, { path: box.dataset.pattern, offset: null });
      });
    },
  };

  /* ---------- Actions ---------- */
  U.act.tokIns = el => insertToken(`{${el.dataset.tok}}`);
  U.act.tokSearch = el => {
    const q = el.value.toLowerCase();
    for (const g of U.$$('[data-grp]')) {
      let any = false;
      for (const t of U.$$('.tok', g)) { const hit = !q || t.dataset.tok.toLowerCase().includes(q); t.hidden = !hit; any = any || hit; }
      g.hidden = !any;
    }
  };
  U.act.patMode = el => { A.flush(); A.ui.tplRaw[el.dataset.path] = !A.ui.tplRaw[el.dataset.path]; U.renderScreen(); };
  // Token chip menu: filters and delete.
  document.addEventListener('click', ev => {
    const chip = ev.target.closest('.pattern .tchip');
    if (!chip) return;
    const box = chip.closest('[data-pattern]'), path = box.dataset.pattern;
    const segs = E.segments(String(U.getPath(A.config, path) || '')), i = +chip.dataset.tok, seg = segs[i];
    const fl = seg.filters.split('|').filter(Boolean);
    const set = list => {
      seg.text = `{${seg.path}${list.map(f => '|' + f).join('')}}`;
      A.mutate(c => U.setPath(c, path, segs.map(s => s.text).join('')));
    };
    const toggle = f => set(fl.includes(f) ? fl.filter(x => x !== f) : fl.filter(x => !(f === 'upper' && x === 'lower') && !(f === 'lower' && x === 'upper')).concat(f));
    const pad = fl.find(f => f.startsWith('pad:'));
    U.menu(chip, [
      { label: 'Huruf besar (|upper)', checked: fl.includes('upper'), run: () => toggle('upper') },
      { label: 'Huruf kecil (|lower)', checked: fl.includes('lower'), run: () => toggle('lower') },
      ...[2, 3, 4].map(n => ({ label: `Isi nol, ${n} digit (|pad:${n})`, checked: pad === 'pad:' + n, run: () => set(fl.filter(f => !f.startsWith('pad:')).concat(pad === 'pad:' + n ? [] : ['pad:' + n])) })),
      { divider: true },
      { label: 'Hapus token', icon: 'delete', run: () => { segs.splice(i, 1); A.mutate(c => U.setPath(c, path, segs.map(s => s.text).join(''))); } },
    ]);
  });
  U.act.ruleAdd = () => A.mutate(c => {
    const ids = (c.zoneRules || []).map(r => r.id);
    let n = ids.length + 1; while (ids.includes('aturan-' + n)) n++;
    const row = E.roles(E.index(c)).rowAttr;
    (c.zoneRules = c.zoneRules || []).push({ id: 'aturan-' + n, when: row ? [{ token: `${row.name}.kode`, op: 'eq', value: '' }] : [], patterns: ['{SITE}-'], source: '' });
  });
  U.act.ruleDel = async el => {
    const r = A.config.zoneRules[+el.dataset.i];
    if (!(await U.confirm(`Hapus aturan ${r.id}?`, 'Zone dari aturan ini tidak dibuat lagi. Bisa dibatalkan dengan Ctrl+Z.', 'Hapus', true))) return;
    A.mutate(c => c.zoneRules.splice(+el.dataset.i, 1));
  };
  U.act.ruleMove = el => {
    const i = +el.dataset.i, j = i + +el.dataset.d;
    if (j < 0 || j >= A.config.zoneRules.length) return;
    A.mutate(c => { const [x] = c.zoneRules.splice(i, 1); c.zoneRules.splice(j, 0, x); });
  };
  U.act.ruleForEach = el => A.mutate(c => { const r = c.zoneRules[+el.dataset.i]; if (el.value) r.forEach = el.value; else delete r.forEach; });
  U.act.patAdd = el => A.mutate(c => c.zoneRules[+el.dataset.i].patterns.push('{SITE}-'));
  U.act.patDel = el => A.mutate(c => c.zoneRules[+el.dataset.i].patterns.splice(+el.dataset.k, 1));
})(UI);
