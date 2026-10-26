/* Step 2 · Susunan. Which lists make the DBs, their order (drag), groups (drag between lanes),
   and which combinations exist (paint the matrix). */
(function (U) {
  'use strict';
  const E = E3D, A = U.App, esc = U.esc;

  const roles = () => E.roles(A.r.cfg);
  const sorted = a => {
    const has = (a.columns || []).some(c => c.id === 'urutan');
    return (a.rows || []).map((r, i) => [r, i]).sort((x, y) => (has ? (x[0].urutan - y[0].urutan) || x[1] - y[1] : x[1] - y[1])).map(x => x[0]);
  };
  // Lanes: groups in order of first appearance in the column list, then unused groups.
  function lanes(col, groupCol, groupAttr) {
    const out = new Map();
    for (const r of col.rows) { const g = r[groupCol]; if (!out.has(g)) out.set(g, []); out.get(g).push(r.kode); }
    if (groupAttr) for (const g of groupAttr.rows) if (!out.has(g.kode)) out.set(g.kode, []);
    return out;
  }

  const parts = {
    count(A) {
      const n = A.r.counts.dbs, mdb = A.config.combination.mdb;
      const cur = A.r.model.cells.filter(c => c.mdb === mdb).length + A.r.counts.refsActive;
      return `<b>${U.num(n)}</b> DB${cur > 1000 ? ` <span class="chip err">${U.num(cur)} current di ${esc(mdb)} &gt; 1000 (1.7)</span>` : ''}`;
    },
    probs: A => U.problems(['s3'].concat(A.r.model.disciplines.map(d => 'o:' + d.row.kode))),
  };

  function sentence(A) {
    const c = A.config.combination, { colAttr, groupAttr } = roles();
    const groupCols = colAttr ? (colAttr.columns || []).filter(x => x.type === 'ref') : [];
    return `<section class="card sentence-card">
      <div class="sentence">Buat <b>1 DB + 1 site</b> untuk tiap
        <select class="input auto pick" data-change="combSet" data-k="rowAttr" aria-label="Baris"><option value="">pilih…</option>${U.attrOptions(c.rowAttr, a => a.role !== 'team' && a.role !== 'user')}</select>
        ×
        <select class="input auto pick" data-change="combSet" data-k="colAttr" aria-label="Kolom"><option value="">pilih…</option>${U.attrOptions(c.colAttr, a => a.role !== 'team' && a.role !== 'user')}</select>
        ${colAttr ? `, kelompokkan per
        <select class="input auto pick" data-change="combSet" data-k="groupBy" aria-label="Grup"><option value="">tanpa grup</option>${groupCols.map(x => `<option value="${esc(x.id)}" ${c.groupBy === x.id ? 'selected' : ''}>${esc(x.name || x.id)}</option>`).join('')}</select>` : ''}
        ${groupAttr ? `<label class="switch"><input type="checkbox" data-change="sepRole" ${groupAttr.role === 'separator' ? 'checked' : ''}><span>dengan separator</span></label>` : ''}
      </div>
      <div class="seg small" role="group" aria-label="Sel yang dibuat">${[['matrix', 'Pilih sel'], ['all', 'Semua sel'], ['condition', 'Dengan syarat']].map(([v, l]) => `<button type="button" data-act="combMode" data-v="${v}" aria-pressed="${c.mode === v}">${l}</button>`).join('')}</div>
    </section>`;
  }

  function orderList(A, row) {
    const hasMdb = (row.columns || []).some(c => c.id === 'mdbMulai');
    return `<section class="card">
      <div class="card-head"><h2>Urutan ${esc(row.name)}</h2></div>
      <div class="order" id="order">${sorted(row).map(r => `<div class="order-item" draggable="true" tabindex="0" data-k="${esc(r.kode)}" title="Seret, atau Alt+↑/↓">
        ${U.icon('drag', 'sm')}<b class="mono">${esc(r.kode)}</b><span>${esc(r.desc)}</span>${hasMdb ? `<small class="mono" title="MDB mulai">${r.mdbMulai === null || r.mdbMulai === undefined ? '' : r.mdbMulai}</small>` : ''}</div>`).join('')}</div>
      ${hasMdb ? `<button type="button" class="btn sm text" data-act="mdbRestart" title="Isi kolom MDB mulai berurutan sesuai jumlah DB tiap baris">Hitung ulang MDB mulai</button>` : ''}
    </section>`;
  }

  function laneBoard(A, col, groupCol, groupAttr) {
    const L = groupCol ? lanes(col, groupCol, groupAttr) : new Map([[null, col.rows.map(r => r.kode)]]);
    const desc = Object.fromEntries(col.rows.map(r => [r.kode, r.desc]));
    return `<section class="card">
      <div class="card-head"><h2>${esc(col.name)}${groupCol ? ' per grup' : ''}</h2><span class="hint">Seret untuk mengurutkan${groupCol ? ' atau pindah grup' : ''}</span></div>
      <div class="lanes" id="lanes">${[...L].map(([g, ks]) => `<div class="lane" data-g="${esc(g === null ? '' : g)}">
        ${groupCol ? `<span class="lane-name">${esc(g === undefined || g === '' ? '(tanpa grup)' : g)}</span>` : ''}
        ${ks.map(k => `<span class="lchip" draggable="true" tabindex="0" data-k="${esc(k)}" title="${esc(desc[k] || '')}">${esc(k)}</span>`).join('')}</div>`).join('')}</div>
      ${A.r.issues.some(i => i.id === 'V16') ? `<button type="button" class="btn sm tonal" data-act="tidyGroups">Rapikan urutan per grup</button>` : ''}
    </section>`;
  }

  function matrix(A, row, col, groupCol) {
    const c = A.config.combination, ex = new Set((c.excluded || []).map(p => p[0] + '\u0000' + p[1]));
    const firstOfGroup = new Set();
    col.rows.forEach((r, j) => { if (groupCol && (j === 0 || col.rows[j - 1][groupCol] !== r[groupCol])) firstOfGroup.add(j); });
    return `<section class="card">
      <div class="card-head"><h2>Sel</h2><span class="hint">Klik-tarik untuk menyalakan / mematikan banyak sel</span><span class="spacer"></span><span data-part="count">${parts.count(A)}</span></div>
      <div class="mx-wrap" data-keep-scroll="mx"><table class="mx" id="mx"><thead><tr><th></th>${col.rows.map((r, j) => `<th class="${firstOfGroup.has(j) ? 'g' : ''}"><button type="button" data-act="colToggle" data-c="${esc(r.kode)}" title="${esc(r.desc)}">${esc(r.kode)}</button></th>`).join('')}</tr></thead>
      <tbody>${sorted(row).map(r => `<tr><th><button type="button" data-act="rowToggle" data-r="${esc(r.kode)}" title="${esc(r.desc)}">${esc(r.kode)}</button></th>${col.rows.map((cr, j) =>
        `<td class="${firstOfGroup.has(j) ? 'g' : ''}"><span class="mc${ex.has(r.kode + '\u0000' + cr.kode) ? '' : ' on'}" data-r="${esc(r.kode)}" data-c="${esc(cr.kode)}" data-loc="m:${esc(r.kode)}:${esc(cr.kode)}"></span></td>`).join('')}</tr>`).join('')}</tbody></table></div>
    </section>`;
  }

  U.screens[2] = {
    parts,
    render(A) {
      const { rowAttr: row, colAttr: col, groupAttr, groupCol } = roles();
      const c = A.config.combination;
      if (!row || !col) return `<div class="page">${sentence(A)}<div class="empty">Pilih dua daftar: baris (mis. Disiplin) dan kolom (mis. Area).</div></div>`;
      const body = c.mode === 'matrix' ? matrix(A, row, col, groupCol)
        : c.mode === 'condition' ? `<section class="card"><h2>Syarat</h2>${U.clauseEditor('combination.condition', c.condition || [], U.tokenPaths(E.contextHeads(A.r.cfg, 'condition')), 'cv')}<div data-part="count">${parts.count(A)}</div></section>`
          : `<section class="card"><div data-part="count">${parts.count(A)}</div></section>`;
      return `<div class="page">${sentence(A)}
        <div class="chips" data-part="probs">${parts.probs(A)}</div>
        <div class="two">${orderList(A, row)}${laneBoard(A, col, groupCol, groupAttr)}</div>
        ${body}</div>`;
    },
    mount(root) {
      const { rowAttr, colAttr, groupCol } = roles();
      if (!rowAttr || !colAttr) return;
      /* order list */
      const order = U.$('#order', root);
      let dk = null;
      order.addEventListener('dragstart', ev => { const it = ev.target.closest('.order-item'); if (it) { dk = it.dataset.k; ev.dataTransfer.setData('text/plain', 'ord'); it.classList.add('dragging'); } });
      order.addEventListener('dragover', ev => { const it = ev.target.closest('.order-item'); if (!dk || !it) return; ev.preventDefault(); U.$$('.before', order).forEach(x => x.classList.remove('before')); it.classList.add('before'); });
      order.addEventListener('drop', ev => { const it = ev.target.closest('.order-item'); if (!dk || !it) return; ev.preventDefault(); ev.stopPropagation(); reorderRows(dk, it.dataset.k); dk = null; });
      order.addEventListener('dragend', () => { dk = null; U.$$('.before,.dragging', order).forEach(x => x.classList.remove('before', 'dragging')); });
      order.addEventListener('keydown', ev => {
        const it = ev.target.closest('.order-item');
        if (!it || !ev.altKey || (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown')) return;
        ev.preventDefault();
        const ks = sorted(rowAttr).map(r => r.kode), i = ks.indexOf(it.dataset.k), j = i + (ev.key === 'ArrowUp' ? -1 : 2);
        if (j < 0 || j > ks.length) return;
        reorderRows(it.dataset.k, j === ks.length ? null : ks[j]);
        const again = U.$(`#order [data-k="${CSS.escape(it.dataset.k)}"]`); if (again) again.focus();
      });
      /* lanes */
      const ln = U.$('#lanes', root);
      let dc = null;
      ln.addEventListener('dragstart', ev => { const ch = ev.target.closest('.lchip'); if (ch) { dc = ch.dataset.k; ev.dataTransfer.setData('text/plain', 'lane'); ch.classList.add('dragging'); } });
      ln.addEventListener('dragover', ev => { const l = ev.target.closest('.lane'); if (!dc || !l) return; ev.preventDefault(); U.$$('.over,.before', ln).forEach(x => x.classList.remove('over', 'before')); l.classList.add('over'); const ch = ev.target.closest('.lchip'); if (ch) ch.classList.add('before'); });
      ln.addEventListener('drop', ev => {
        const l = ev.target.closest('.lane');
        if (!dc || !l) return;
        ev.preventDefault(); ev.stopPropagation();
        const ch = ev.target.closest('.lchip');
        moveCol(dc, l.dataset.g, ch && ch.dataset.k !== dc ? ch.dataset.k : null);
        dc = null;
      });
      ln.addEventListener('dragend', () => { dc = null; U.$$('.over,.before,.dragging', ln).forEach(x => x.classList.remove('over', 'before', 'dragging')); });
      ln.addEventListener('keydown', ev => {
        const ch = ev.target.closest('.lchip');
        if (!ch || !ev.altKey || !ev.key.startsWith('Arrow')) return;
        ev.preventDefault();
        const k = ch.dataset.k, lane = ch.closest('.lane'), chips = U.$$('.lchip', lane), i = chips.indexOf(ch);
        if (ev.key === 'ArrowLeft' && i > 0) moveCol(k, lane.dataset.g, chips[i - 1].dataset.k);
        else if (ev.key === 'ArrowRight' && i < chips.length - 1) moveCol(k, lane.dataset.g, chips[i + 2] ? chips[i + 2].dataset.k : null);
        else if ((ev.key === 'ArrowUp' || ev.key === 'ArrowDown') && groupCol) {
          const ls = U.$$('.lane', ln), li = ls.indexOf(lane) + (ev.key === 'ArrowUp' ? -1 : 1);
          if (ls[li]) moveCol(k, ls[li].dataset.g, null);
        } else return;
        const again = U.$(`#lanes [data-k="${CSS.escape(k)}"]`); if (again) again.focus();
      });
      /* matrix painting */
      const mx = U.$('#mx', root);
      if (!mx) return;
      let paint = null;
      const apply = el => {
        if (!el || !paint) return;
        el.classList.toggle('on', paint.on);
        paint.cells.set(el.dataset.r + '\u0000' + el.dataset.c, [el.dataset.r, el.dataset.c]);
      };
      mx.addEventListener('pointerdown', ev => {
        const el = ev.target.closest('.mc');
        if (!el) return;
        ev.preventDefault();
        paint = { on: !el.classList.contains('on'), cells: new Map() };
        apply(el);
      });
      mx.addEventListener('pointerover', ev => apply(ev.target.closest('.mc')));
      const end = () => {
        if (!paint) return;
        const p = paint; paint = null;
        A.mutate(c => {
          const comb = c.combination, keys = new Set(p.cells.keys());
          comb.excluded = (comb.excluded || []).filter(x => !keys.has(x[0] + '\u0000' + x[1]));
          if (!p.on) comb.excluded.push(...p.cells.values());
        });
      };
      document.addEventListener('pointerup', end, { once: true });
      mx.addEventListener('pointerdown', () => document.addEventListener('pointerup', end, { once: true }));
    },
  };

  // Put row `k` before row `beforeK` (null = last) and renumber `urutan` 1..n.
  function reorderRows(k, beforeK) {
    if (k === beforeK) return;
    A.mutate(c => {
      const row = c.attributes.find(a => a.id === c.combination.rowAttr);
      const ks = sorted(row).map(r => r.kode).filter(x => x !== k);
      ks.splice(beforeK === null ? ks.length : ks.indexOf(beforeK), 0, k);
      if ((row.columns || []).some(x => x.id === 'urutan')) ks.forEach((x, i) => { row.rows.find(r => r.kode === x).urutan = i + 1; });
      row.rows.sort((a, b) => ks.indexOf(a.kode) - ks.indexOf(b.kode));
    });
  }
  // Move column row `k` into group `g` before `beforeK` (null = end of lane); rows stay grouped by lane order.
  function moveCol(k, g, beforeK) {
    A.mutate(c => {
      const comb = c.combination, col = c.attributes.find(a => a.id === comb.colAttr), gc = comb.groupBy;
      const gAttr = gc ? c.attributes.find(a => a.id === (col.columns.find(x => x.id === gc) || {}).target) : null;
      const L = gc ? lanes(col, gc, gAttr) : new Map([[null, col.rows.map(r => r.kode)]]);
      const key = gc ? ([...L.keys()].find(x => String(x === undefined ? '' : x) === g)) : null;
      for (const ks of L.values()) { const i = ks.indexOf(k); if (i >= 0) ks.splice(i, 1); }
      const lane = L.get(key);
      lane.splice(beforeK === null ? lane.length : lane.indexOf(beforeK), 0, k);
      const order = [].concat(...L.values());
      const row = col.rows.find(r => r.kode === k);
      if (gc && key !== undefined) row[gc] = key;
      col.rows.sort((a, b) => order.indexOf(a.kode) - order.indexOf(b.kode));
    });
  }

  U.act.combMode = el => A.mutate(c => { c.combination.mode = el.dataset.v; });
  U.act.combSet = el => A.mutate(c => {
    const k = el.dataset.k;
    if (el.value) c.combination[k] = el.value; else delete c.combination[k];
    if (k === 'colAttr') delete c.combination.groupBy;
    if (k !== 'groupBy') c.combination.excluded = [];
  });
  U.act.sepRole = el => A.mutate(c => {
    const r = E.roles(E.index(c));
    c.attributes.find(a => a.id === r.groupAttr.id).role = el.checked ? 'separator' : 'none';
    if (el.checked && !c.templates.sepGroup) c.templates.sepGroup = `/{${r.rowAttr.name}.kode}----{${r.groupAttr.name}.kode}----`;
  });
  U.act.tidyGroups = () => A.mutate(c => {
    const comb = c.combination, col = c.attributes.find(a => a.id === comb.colAttr);
    const order = [].concat(...lanes(col, comb.groupBy, null).values());
    col.rows.sort((a, b) => order.indexOf(a.kode) - order.indexOf(b.kode));
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
  U.act.rowToggle = el => toggleMany(roles().colAttr.rows.map(r => [el.dataset.r, r.kode]));
  U.act.colToggle = el => toggleMany(roles().rowAttr.rows.map(r => [r.kode, el.dataset.c]));
  U.act.mdbRestart = async () => {
    if (!(await U.confirm('Hitung ulang MDB mulai?', 'Kolom MDB mulai diisi berurutan: baris pertama 1, berikutnya setelah DB baris sebelumnya.', 'Hitung ulang'))) return;
    A.mutate(c => {
      const row = c.attributes.find(a => a.id === c.combination.rowAttr);
      let p = 1;
      for (const r of sorted(row)) { r.mdbMulai = p; p += A.r.model.cells.filter(x => x.rowKode === r.kode).length; }
    });
  };
})(UI);
