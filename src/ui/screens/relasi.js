/* Screen 3: Relasi & kombinasi. References, which cells exist (matrix / condition), counts, site order. */
(function (U) {
  'use strict';
  const E = E3D, A = U.App, esc = U.esc;
  const OPS = [['eq', '='], ['ne', '≠'], ['in', 'salah satu']];

  // Clause editor shared with zone rules: clauses at config path `base`.
  U.clauseEditor = function (base, clauses, tokens, listId) {
    return `<div class="stack">${(clauses || []).map((w, k) => `<div class="clause">
        <input class="input mono" data-bind="${base}.${k}.token" value="${esc(w.token)}" list="${listId}" placeholder="Attribute.kolom" aria-label="Token" spellcheck="false">
        <select class="input" data-change="clauseOp" data-path="${base}.${k}" aria-label="Operator">${OPS.map(([v, l]) => `<option value="${v}" ${w.op === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <input class="input mono" data-bind="${base}.${k}.value" ${w.op === 'in' ? 'data-t="list"' : ''} value="${esc(Array.isArray(w.value) ? w.value.join(', ') : w.value)}" placeholder="${w.op === 'in' ? 'A, B, C' : 'nilai'}" aria-label="Nilai" spellcheck="false">
        <button class="icon-btn sm danger" type="button" data-act="clauseDel" data-path="${base}" data-k="${k}" aria-label="Hapus syarat">${U.icon('close')}</button></div>`).join('')}
      <button class="btn sm text" type="button" data-act="clauseAdd" data-path="${base}" style="align-self:flex-start">${U.icon('add')}Syarat</button>
      <datalist id="${listId}">${tokens.map(t => `<option value="${esc(t)}">`).join('')}</datalist></div>`;
  };
  // All token paths available for the given heads (one level through ref columns).
  U.tokenPaths = function (heads) {
    const out = [];
    for (const h of heads) {
      if (h === 'PROJECT') { out.push('PROJECT.code', 'PROJECT.name', 'PROJECT.filePrefix', 'PROJECT.target'); continue; }
      if (h === 'SITE' || h === 'INDEX') { out.push(h); continue; }
      const a = A.config.attributes.find(x => x.name === h);
      if (!a) continue;
      for (const c of a.columns || []) {
        out.push(`${h}.${c.id}`);
        if (c.type === 'ref') { const t = A.config.attributes.find(x => x.id === c.target); if (t) for (const tc of t.columns || []) out.push(`${h}.${c.id}.${tc.id}`); }
      }
    }
    return out;
  };
  U.act.clauseOp = el => A.mutate(c => {
    const w = U.getPath(c, el.dataset.path);
    w.op = el.value;
    if (w.op === 'in' && !Array.isArray(w.value)) w.value = String(w.value || '').split(/[,;\s]+/).filter(Boolean);
    if (w.op !== 'in' && Array.isArray(w.value)) w.value = w.value.join(',');
  });
  U.act.clauseAdd = el => A.mutate(c => {
    const list = U.getPath(c, el.dataset.path);
    if (Array.isArray(list)) list.push({ token: '', op: 'eq', value: '' }); else U.setPath(c, el.dataset.path, [{ token: '', op: 'eq', value: '' }]);
  });
  U.act.clauseDel = el => A.mutate(c => U.getPath(c, el.dataset.path).splice(+el.dataset.k, 1));

  const sortedRows = a => {
    const has = (a.columns || []).some(c => c.id === 'urutan');
    return (a.rows || []).map((r, i) => [r, i]).sort((x, y) => (has ? (x[0].urutan - y[0].urutan) || x[1] - y[1] : x[1] - y[1])).map(x => x[0]);
  };

  const parts = {
    rel(A) {
      const cards = [];
      for (const a of A.config.attributes) for (const c of a.columns || []) {
        if (c.type !== 'ref' && c.type !== 'refList') continue;
        const t = A.config.attributes.find(x => x.id === c.target);
        const keys = t ? new Set(t.rows.map(r => r.kode)) : new Set();
        const vals = (a.rows || []).flatMap(r => (c.type === 'ref' ? [r[c.id]] : r[c.id] || [])).filter(v => v !== '' && v !== null && v !== undefined);
        const bad = vals.filter(v => !keys.has(v)).length;
        cards.push(`<div class="tile"><span class="mono" style="font-weight:700">${esc(a.name)}.${esc(c.id)} → ${esc(t ? t.name : c.target)}</span>
          <span class="s">${U.plural(a.rows.length, 'baris')} · ${new Set(vals).size} ${esc(t ? t.name : '')} dipakai</span>
          <span class="chip ${bad ? 'err' : 'ok'}" style="align-self:flex-start">${U.icon(bad ? 'error' : 'check')}${bad ? `${bad} tidak valid (V01)` : 'semua valid'}</span></div>`);
      }
      return cards.length ? `<div class="grid-cards">${cards.join('')}</div>` : '<p class="hint">Belum ada kolom bertipe Referensi. Tambahkan di layar Attribute.</p>';
    },
    total(A) {
      const n = A.r.counts.dbs, mdb = A.config.combination.mdb;
      const cur = A.r.model.cells.filter(c => c.mdb === mdb).length + A.r.counts.refsActive;
      return `<span class="chip ${cur <= 1000 ? 'ok' : 'err'}">${U.icon(cur <= 1000 ? 'check' : 'error')}${U.num(n)} DB · ${U.num(cur)} current di ${esc(mdb)} ≤ 1000 (1.7)</span>
        <span class="hint">Buka centang = DB dan site tidak dibuat; DBNO sel lain tetap.</span>` + U.chipsFor('s3');
    },
    objs(A) {
      const c = A.r.counts;
      const t = [['Team', c.teamsNew + c.teamsExisting, `${c.teamsNew} baru · ${c.teamsExisting} ada`], ['DB', c.dbs, `current di MDB`], ['Site', c.sites, '1 site per DB'],
        ['Separator', c.separators, 'disiplin + grup'], ['Zone', c.zones, `dari ${(A.config.zoneRules || []).length} aturan`], ['DB referensi', c.refsActive + c.refsInactive, `${c.refsActive} aktif · ${c.refsInactive} dikomentari`]];
      return `<div class="tiles">${t.map(([l, v, s]) => `<div class="tile"><span class="l">${l}</span><span class="v">${U.num(v)}</span><span class="s">${s}</span></div>`).join('')}</div>`;
    },
    order(A) {
      const ds = A.r.model.disciplines;
      if (!ds.length) return '<p class="hint">Belum ada sel. Isi attribute baris dan kolom, lalu centang kombinasi.</p>';
      let dd = ds.find(d => d.row.kode === A.ui.orderTab);
      if (!dd) { dd = ds[0]; A.ui.orderTab = dd.row.kode; }
      let lastDb = null, n = 0;
      const rows = E.siteOrder(dd).map(s => {
        n++;
        const show = s.db !== lastDb; lastDb = s.db;
        const site = s.kind === 'site';
        const kind = { sepDiscipline: 'Separator disiplin', sepGroup: 'Separator grup', site: 'Site' }[s.kind];
        return `<tr class="${site ? '' : 'sep'}" ${site ? `draggable="true" tabindex="0" data-col="${esc(s.cell.colKode)}" aria-label="${esc(s.name)}: Alt+panah untuk memindah"` : ''} data-loc="m:${esc(dd.row.kode)}:${esc(site ? s.cell.colKode : '')}">
          <td class="tight">${site ? `<span class="handle" aria-hidden="true">${U.icon('drag', 'sm')}</span>` : ''}</td><td class="num">${n}</td><td>${kind}</td>
          <td class="mono">NEW SITE ${esc(s.name)}</td><td class="mono">${show ? esc(s.db) : '<span class="hint">↳ DB sama</span>'}</td><td class="num mono">${site ? esc(s.cell.pos) : ''}</td></tr>`;
      }).join('');
      return `<div class="tabs" role="tablist">${ds.map(d => `<button type="button" role="tab" class="tab" data-act="orderTab" data-k="${esc(d.row.kode)}" aria-selected="${d === dd}"><b class="mono">${esc(d.row.kode)}</b>${esc(d.row.desc)}</button>`).join('')}</div>
        <div class="tbl tall" data-keep-scroll="order"><table id="orderTbl"><thead><tr><th></th><th class="num">#</th><th>Jenis</th><th>NEW SITE</th><th>DB</th><th class="num">ADD n</th></tr></thead><tbody>${rows}</tbody></table></div>
        <div class="chips"><span class="chip ok">${U.icon('check')}Urutan MDB = urutan NEW SITE</span><span class="chip ok">${U.icon('check')}DB ditulis sekali per DB; baris tanpa DB ikut DB sebelumnya (3.2, 3.3)</span>
        ${E.FACTS.interDbOrderProven ? '' : '<span class="chip info">Urutan site antar-DB mengikuti MDB: belum terbukti (§9)</span>'}${U.chipsFor('o:' + dd.row.kode)}</div>`;
    },
  };

  function matrix(A) {
    const c = A.config.combination, row = A.config.attributes.find(a => a.id === c.rowAttr), col = A.config.attributes.find(a => a.id === c.colAttr);
    if (!row || !col) return '<p class="hint">Pilih attribute baris dan kolom.</p>';
    const ex = new Set((c.excluded || []).map(p => p[0] + '\u0000' + p[1]));
    const g = c.groupBy, groups = [];
    for (const r of col.rows) { const k = g ? r[g] : ''; const last = groups[groups.length - 1]; if (last && last.k === k) last.n++; else groups.push({ k, n: 1 }); }
    const first = new Set(); let i = 0; for (const gr of groups) { first.add(i); i += gr.n; }
    const head1 = g ? `<tr><th class="first" rowspan="2">${esc(row.name)} \\ ${esc(col.name)}</th>${groups.map(gr => `<th class="g" colspan="${gr.n}">${esc(gr.k)}</th>`).join('')}<th rowspan="2" class="num">DB</th></tr>` : '';
    const head2 = `<tr>${g ? '' : `<th class="first">${esc(row.name)} \\ ${esc(col.name)}</th>`}${col.rows.map((r, j) => `<th class="${first.has(j) && g ? 'g' : ''}"><button type="button" class="mono" data-act="colToggle" data-c="${esc(r.kode)}" title="${esc(r.desc)} · klik: centang/buka semua">${esc(r.kode)}</button></th>`).join('')}${g ? '' : '<th class="num">DB</th>'}</tr>`;
    let total = 0;
    const body = sortedRows(row).map(r => {
      let n = 0;
      const tds = col.rows.map((cr, j) => {
        const on = !ex.has(r.kode + '\u0000' + cr.kode); if (on) n++;
        return `<td class="${first.has(j) && g ? 'g' : ''}"><input type="checkbox" data-change="cellToggle" data-r="${esc(r.kode)}" data-c="${esc(cr.kode)}" ${on ? 'checked' : ''} aria-label="${esc(r.desc)} × ${esc(cr.kode)}"></td>`;
      }).join('');
      total += n;
      return `<tr><td class="first"><button type="button" data-act="rowToggle" data-r="${esc(r.kode)}" title="Klik: centang/buka semua"><b class="mono">${esc(r.kode)}</b> ${esc(r.desc)}</button></td>${tds}<td class="num mono"><b>${n}</b></td></tr>`;
    }).join('');
    return `<div class="matrix" data-keep-scroll="matrix"><table><thead>${head1}${head2}</thead><tbody>${body}
      <tr><td class="first"><b>Total</b></td><td colspan="${col.rows.length}" class="hint" style="text-align:left">${row.rows.length} × ${col.rows.length}${ex.size ? ` − ${ex.size} dikecualikan` : ''}</td><td class="num mono"><b>${total}</b></td></tr></tbody></table></div>`;
  }

  U.screens[3] = {
    title: 'Relasi & kombinasi',
    sub: 'Tentukan objek apa yang dibuat dan urutannya. Urutan di sini dipakai untuk posisi MDB, urutan NEW SITE, dan DB tempat separator dibuat.',
    parts,
    select(A, loc) { if (loc.order) A.ui.orderTab = loc.order; else if (loc.cell) A.ui.orderTab = loc.cell[0]; },
    render(A) {
      const c = A.config.combination;
      const col = A.config.attributes.find(a => a.id === c.colAttr);
      const groupOpts = col ? (col.columns || []).filter(x => x.type === 'ref').map(x => `<option value="${esc(x.id)}" ${c.groupBy === x.id ? 'selected' : ''}>${esc(col.name)}.${esc(x.id)}</option>`).join('') : '';
      const condTokens = U.tokenPaths(E.contextHeads(A.r.cfg, 'condition'));
      return `
      <section class="card"><h2>1. Relasi</h2><span class="hint">Dari kolom bertipe Referensi di layar Attribute.</span><div data-part="rel">${parts.rel(A)}</div></section>
      <section class="card">
        <div class="card-head"><div><h2>2. Kombinasi</h2><div class="sub">Setiap sel = 1 DB + 1 site.</div></div>
          <div class="seg" role="group" aria-label="Mode">${[['all', 'Semua'], ['matrix', 'Matriks'], ['condition', 'Kondisi']].map(([v, l]) => `<button type="button" data-act="combMode" data-v="${v}" aria-pressed="${c.mode === v}">${c.mode === v ? U.icon('check', 'sm') : ''}${l}</button>`).join('')}</div></div>
        <div class="fields">
          <div class="field"><label for="crow">Baris (urut menurut kolom urutan)</label><select id="crow" data-change="combSet" data-k="rowAttr"><option value=""></option>${U.attrOptions(c.rowAttr)}</select></div>
          <div class="field"><label for="ccol">Kolom (urutan baris = urutan tampil)</label><select id="ccol" data-change="combSet" data-k="colAttr"><option value=""></option>${U.attrOptions(c.colAttr)}</select></div>
          <div class="field"><label for="cgrp">Grup kolom (opsional)</label><select id="cgrp" data-change="combSet" data-k="groupBy"><option value="">tanpa grup</option>${groupOpts}</select></div>
          <div class="field"><label>MDB</label><div class="input mono" style="display:flex;align-items:center">${esc(c.mdb)}</div></div>
        </div>
        ${c.mode === 'matrix' ? matrix(A) : c.mode === 'condition'
          ? `<div class="inner stack"><b>Sel dibuat bila semua syarat terpenuhi</b>${U.clauseEditor('combination.condition', c.condition || [], condTokens, 'condTokens')}</div>`
          : '<div class="note info">Semua kombinasi baris × kolom dibuat.</div>'}
        <div class="chips" data-part="total">${parts.total(A)}</div>
      </section>
      <section class="card"><h2>3. Daftar objek</h2><div data-part="objs">${parts.objs(A)}</div></section>
      <section class="card" id="orderCard"><h2>4. Urutan</h2>
        <span class="hint">Kunci: <span class="mono">urutan</span> baris → grup → urutan baris kolom. Seret baris site (atau Alt+↑/↓) untuk mengubah urutan ${esc(col ? col.name : 'kolom')}; berlaku untuk semua baris.</span>
        <div data-part="order" class="stack">${parts.order(A)}</div></section>`;
    },
    mount(root) {
      const card = U.$('#orderCard', root);
      if (!card) return;
      let drag = null;
      card.addEventListener('dragstart', ev => { const tr = ev.target.closest('tr[data-col]'); if (!tr) return; drag = tr.dataset.col; ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/x-e3d-col', drag); });
      card.addEventListener('dragover', ev => { const tr = ev.target.closest('tr[data-col]'); if (!drag || !tr) return; ev.preventDefault(); U.$$('.drag-over', card).forEach(x => x.classList.remove('drag-over')); tr.classList.add('drag-over'); });
      card.addEventListener('dragend', () => { drag = null; U.$$('.drag-over', card).forEach(x => x.classList.remove('drag-over')); });
      card.addEventListener('drop', ev => {
        const tr = ev.target.closest('tr[data-col]');
        if (!drag || !tr) return;
        ev.preventDefault();
        moveCol(drag, tr.dataset.col);
        drag = null;
      });
      card.addEventListener('keydown', ev => {
        const tr = ev.target.closest('tr[data-col]');
        if (!tr || !ev.altKey || (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown')) return;
        ev.preventDefault();
        const col = colAttr(); const k = tr.dataset.col;
        const i = col.rows.findIndex(r => r.kode === k), j = i + (ev.key === 'ArrowUp' ? -1 : 1);
        if (j < 0 || j >= col.rows.length) return;
        A.mutate(c => { const rows = c.attributes.find(a => a.id === c.combination.colAttr).rows; const [x] = rows.splice(i, 1); rows.splice(j, 0, x); });
        const again = U.$(`#orderCard tr[data-col="${CSS.escape(k)}"]`); if (again) again.focus();
      });
    },
  };

  const colAttr = () => A.config.attributes.find(a => a.id === A.config.combination.colAttr);
  function moveCol(from, before) {
    if (from === before) return;
    A.mutate(c => {
      const rows = c.attributes.find(a => a.id === c.combination.colAttr).rows;
      const i = rows.findIndex(r => r.kode === from);
      const [x] = rows.splice(i, 1);
      rows.splice(rows.findIndex(r => r.kode === before), 0, x);
    });
  }

  U.act.orderTab = el => { A.ui.orderTab = el.dataset.k; U.refresh(); };
  U.act.combMode = el => A.mutate(c => { c.combination.mode = el.dataset.v; });
  U.act.combSet = el => A.mutate(c => {
    const k = el.dataset.k;
    if (el.value) c.combination[k] = el.value; else delete c.combination[k];
    if (k === 'colAttr') delete c.combination.groupBy;
    if (k !== 'groupBy') c.combination.excluded = [];
  });
  U.act.cellToggle = el => A.mutate(c => {
    const comb = c.combination, r = el.dataset.r, k = el.dataset.c;
    comb.excluded = (comb.excluded || []).filter(p => !(p[0] === r && p[1] === k));
    if (!el.checked) comb.excluded.push([r, k]);
  });
  function toggleMany(pairs) {
    A.mutate(c => {
      const comb = c.combination, ex = comb.excluded || [];
      const key = p => p[0] + '\u0000' + p[1], set = new Set(ex.map(key));
      const allOn = pairs.every(p => !set.has(key(p)));
      if (allOn) comb.excluded = ex.concat(pairs);
      else { const drop = new Set(pairs.map(key)); comb.excluded = ex.filter(p => !drop.has(key(p))); }
    });
  }
  U.act.rowToggle = el => { const col = colAttr(); toggleMany(col.rows.map(r => [el.dataset.r, r.kode])); };
  U.act.colToggle = el => { const row = A.config.attributes.find(a => a.id === A.config.combination.rowAttr); toggleMany(row.rows.map(r => [r.kode, el.dataset.c])); };
})(UI);
