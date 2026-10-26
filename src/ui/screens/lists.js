/* Step 1 · Daftar. Lists as sheet tabs; columns set from the header menu; rows dragged to reorder;
   files dropped or cells pasted go through the importer. Team and User are fixed lists. */
(function (U) {
  'use strict';
  const E = E3D, A = U.App, esc = U.esc;
  const LOCKED_COLS = ['kode', 'desc'];
  const FIXED = a => a.role === 'team' || a.role === 'user';
  const TYPE_LABEL = { text: 'Teks', number: 'Angka', boolean: 'Ya/tidak', ref: 'Pilih dari', refList: 'Beberapa dari' };

  const cur = A => {
    if (A.ui.list === 'refs') return 'refs';
    let a = A.attr(A.ui.list);
    if (!a) {
      const comb = A.config.combination || {};
      a = A.attr(comb.rowAttr) || A.config.attributes[0];
      A.ui.list = a ? a.id : 'refs';
    }
    return a || 'refs';
  };
  const slug = (s, lower) => {
    const w = String(s).normalize('NFKD').replace(/[^\w\s]/g, ' ').trim().split(/[\s_]+/).filter(Boolean);
    let id = w.map((x, i) => (i ? x[0].toUpperCase() + x.slice(1).toLowerCase() : x.toLowerCase())).join('') || 'kolom';
    if (!/^[a-zA-Z]/.test(id)) id = 'k' + id;
    return lower ? id.toLowerCase().replace(/[^a-z0-9_]/g, '') : id;
  };
  const uniq = (base, taken) => { let s = base, n = 2; while (taken.includes(s)) s = base + n++; return s; };

  function usages(c, a) {
    const out = [];
    for (const b of c.attributes) for (const col of b.columns || [])
      if ((col.type === 'ref' || col.type === 'refList') && col.target === a.id && b.id !== a.id) out.push(`Kolom ${col.name || col.id} di ${b.name}`);
    if (c.combination.rowAttr === a.id || c.combination.colAttr === a.id) out.push('Susunan');
    const re = new RegExp(`\\{${a.name}[.|}]`);
    for (const [k, v] of Object.entries(c.templates || {})) if (re.test(v)) out.push(`Nama: ${U.NAME_LABEL ? U.NAME_LABEL(k) : k}`);
    (c.zoneRules || []).forEach(r => {
      if (r.forEach === a.id || (r.patterns || []).some(p => re.test(p)) || (r.when || []).some(w => String(w.token).split('.')[0] === a.name)) out.push(`Aturan zone ${r.id}`);
    });
    return [...new Set(out)];
  }
  U.renameHead = function (c, from, to) {
    const re = new RegExp(`\\{${from}(?=[.|}])`, 'g');
    for (const k of Object.keys(c.templates || {})) c.templates[k] = String(c.templates[k]).replace(re, '{' + to);
    const tok = w => { const p = String(w.token).split('.'); if (p[0] === from) { p[0] = to; w.token = p.join('.'); } };
    for (const r of c.zoneRules || []) { r.patterns = (r.patterns || []).map(p => p.replace(re, '{' + to)); (r.when || []).forEach(tok); }
    (c.combination.condition || []).forEach(tok);
  };

  function cell(a, i, r, col, ri) {
    const bind = `attributes.${i}.rows.${ri}.${col.id}`, loc = `c:${a.id}:${ri}:${col.id}`, v = r[col.id];
    const lbl = `aria-label="${esc(col.name || col.id)} ${ri + 1}"`;
    if (col.type === 'boolean') return `<td class="c-bool"><input type="checkbox" data-bind="${bind}" data-loc="${loc}" ${v ? 'checked' : ''} ${lbl}></td>`;
    if (col.type === 'ref') {
      const t = A.attr(col.target);
      const has = t && t.rows.some(x => x.kode === v);
      return `<td><select class="refsel${v ? '' : ' empty'}" data-bind="${bind}" data-loc="${loc}" ${lbl}><option value="">—</option>${v && !has ? `<option selected value="${esc(v)}">${esc(v)} ?</option>` : ''}${(t ? t.rows : []).map(x => `<option value="${esc(x.kode)}" ${x.kode === v ? 'selected' : ''}>${esc(x.kode)}</option>`).join('')}</select></td>`;
    }
    if (col.type === 'refList') return `<td><input class="reflist" data-bind="${bind}" data-t="list" data-loc="${loc}" value="${esc((v || []).join(', '))}" placeholder="—" spellcheck="false" ${lbl} list="dl-${esc(col.target)}"></td>`;
    const cls = col.id === 'kode' ? 'c-kode' : col.type === 'number' ? 'c-num' : col.id === 'desc' ? 'c-desc' : '';
    return `<td class="${cls}"><input data-bind="${bind}" ${col.type === 'number' ? 'data-t="int" inputmode="numeric"' : ''} ${col.id === 'kode' ? 'data-on="kodeRename"' : ''}
      data-loc="${loc}" value="${esc(v === null || v === undefined ? '' : v)}" spellcheck="false" ${lbl}></td>`;
  }

  function grid(A, a) {
    const i = A.attrIndex(a.id), cols = a.columns || [], rows = a.rows || [];
    const used = A.config.inUse && (A.config.inUse.teams || []).length ? new Set(A.config.inUse.teams) : null;
    const q = (A.ui.listQuery || '').toLowerCase();
    const head = cols.map((c, j) => `<th class="${c.type === 'number' ? 'num' : ''}"><button type="button" class="colhead" data-act="colMenu" data-j="${j}" title="Atur kolom">${esc(c.name || c.id)}${c.type === 'ref' || c.type === 'refList' ? `<small>→ ${esc((A.attr(c.target) || {}).name || c.target)}</small>` : ''}${U.icon('chev', 'sm')}</button></th>`).join('');
    const body = rows.map((r, ri) => {
      const text = cols.map(c => cellTextOf(r[c.id])).join(' ').toLowerCase();
      const status = a.role === 'team' ? `<td class="c-status">${(used ? used.has(r.kode) : r.existing) ? '<span class="chip">Ada</span>' : '<span class="chip info">Baru</span>'}</td>` : '';
      return `<tr data-row="${ri}" ${q && !text.includes(q) ? 'hidden' : ''}><td class="c-drag" draggable="true" title="Seret untuk memindah (Alt+↑/↓)">${U.icon('drag', 'sm')}</td>
        ${cols.map(c => cell(a, i, r, c, ri)).join('')}${status}
        <td class="c-del"><button type="button" class="icon-btn sm danger" data-act="rowDel" data-r="${ri}" aria-label="Hapus baris ${ri + 1}">${U.icon('close')}</button></td></tr>`;
    }).join('');
    const lists = [...new Set(cols.filter(c => c.type === 'refList').map(c => c.target))]
      .map(t => `<datalist id="dl-${esc(t)}">${((A.attr(t) || {}).rows || []).map(x => `<option value="${esc(x.kode)}">`).join('')}</datalist>`).join('');
    return `<div class="grid-wrap" data-keep-scroll="grid-${esc(a.id)}" data-drop-list="${esc(a.id)}">
      <table class="grid" id="dataGrid"><thead><tr><th class="c-drag"></th>${head}${a.role === 'team' ? '<th>Status</th>' : ''}<th class="c-del"><button type="button" class="icon-btn sm" data-act="colAdd" title="Tambah kolom" aria-label="Tambah kolom">${U.icon('add')}</button></th></tr></thead>
      <tbody>${body}</tbody></table>${lists}
      ${rows.length ? '' : `<div class="empty">Belum ada baris. Tempel dari Excel (Ctrl+V), seret file, atau tambah baris.</div>`}</div>`;
  }
  const cellTextOf = v => (Array.isArray(v) ? v.join(' ') : v === undefined || v === null ? '' : String(v));

  function refsGrid(A) {
    const refs = A.config.referenceDbs || [];
    return `<div class="grid-wrap" data-keep-scroll="grid-refs" data-drop-list="refs"><table class="grid" id="dataGrid"><thead><tr><th class="c-drag"></th><th>DB (TEAM/NAMA)</th><th class="num">Posisi MDB</th><th>Aktif</th><th>Catatan</th><th class="c-del"></th></tr></thead><tbody>
      ${refs.map((r, i) => `<tr data-row="${i}" data-loc="r:${i}"><td class="c-drag" draggable="true">${U.icon('drag', 'sm')}</td>
        <td class="c-kode"><input data-bind="referenceDbs.${i}.db" value="${esc(r.db)}" spellcheck="false" aria-label="DB"></td>
        <td class="c-num"><input data-bind="referenceDbs.${i}.pos" data-t="int" value="${esc(r.pos === null || r.pos === undefined ? '' : r.pos)}" aria-label="Posisi"></td>
        <td class="c-bool"><input type="checkbox" data-bind="referenceDbs.${i}.active" ${r.active ? 'checked' : ''} aria-label="Aktif"></td>
        <td><input data-bind="referenceDbs.${i}.note" value="${esc(r.note || '')}" aria-label="Catatan"></td>
        <td class="c-del"><button type="button" class="icon-btn sm danger" data-act="refDel" data-i="${i}" aria-label="Hapus">${U.icon('close')}</button></td></tr>`).join('')}
      </tbody></table>${refs.length ? '' : '<div class="empty">DB yang sudah ada (catalogue, spec) untuk di-ADD ke MDB di step 90. Ambil dari Export Config project tujuan, tempel, atau tambah baris.</div>'}</div>`;
  }

  const parts = {
    probs(A) {
      const a = cur(A);
      if (a === 'refs') return U.problems((A.config.referenceDbs || []).map((r, i) => 'r:' + i));
      return U.problems('a:' + a.id);
    },
  };

  U.screens[1] = {
    parts,
    select(A, loc) { if (loc.attributeId) { A.ui.list = loc.attributeId; A.ui.listQuery = ''; } if (loc.refIndex !== undefined) A.ui.list = 'refs'; },
    render(A) {
      const a = cur(A);
      const tabs = (A.config.attributes || []).map(x => {
        const bad = U.issuesAt('a:' + x.id, 'error').length;
        return `<button type="button" role="tab" class="sheet-tab" data-act="listSel" data-id="${esc(x.id)}" aria-selected="${x.id === A.ui.list}">${FIXED(x) ? U.icon('lock', 'sm') : ''}${esc(x.name)}${bad ? '<span class="dot err"></span>' : ''}<small>${x.rows.length}</small></button>`;
      }).join('');
      const refBad = A.r.issues.some(i => i.severity === 'error' && i.location && i.location.refIndex !== undefined);
      const isRefs = a === 'refs';
      return `<div class="page">
        <div class="sheet-tabs" role="tablist" aria-label="Daftar">${tabs}
          <button type="button" role="tab" class="sheet-tab" data-act="listSel" data-id="refs" aria-selected="${isRefs}">DB referensi${refBad ? '<span class="dot err"></span>' : ''}<small>${(A.config.referenceDbs || []).length}</small></button>
          <button type="button" class="sheet-tab add" data-act="listAdd" title="Daftar baru" aria-label="Daftar baru">${U.icon('add')}</button></div>
        <section class="card flat">
          <div class="toolbar">
            ${isRefs ? '' : `<button type="button" class="btn sm text" data-act="listMenu">${esc(a.name)}${U.icon('chev', 'sm')}</button>`}
            <input class="input search" data-input="listSearch" id="listSearch" value="${esc(A.ui.listQuery || '')}" placeholder="Cari" aria-label="Cari baris">
            <span class="spacer"></span>
            ${isRefs ? `<button type="button" class="btn sm text" data-act="refRenumber">Nomori posisi</button><button type="button" class="btn sm text" data-act="refFromProject">Dari project tujuan…</button>`
              : (a.role === 'team' && A.config.inUse && (A.config.inUse.teams || []).length ? `<button type="button" class="btn sm text" data-act="teamSync">Isi "Sudah ada" dari project tujuan</button>` : '')}
            <button type="button" class="btn sm outlined" data-act="importPick">${U.icon('upload')}Impor file</button>
            <button type="button" class="btn sm tonal" data-act="${isRefs ? 'refAdd' : 'rowAdd'}">${U.icon('add')}Baris</button>
          </div>
          ${isRefs ? refsGrid(A) : grid(A, a)}
          <div class="chips" data-part="probs">${parts.probs(A)}</div>
        </section></div>`;
    },
    mount(root) {
      const g = U.$('#dataGrid', root);
      if (!g) return;
      let drag = null;
      g.addEventListener('dragstart', ev => { const td = ev.target.closest('.c-drag'); if (!td) return; drag = +td.closest('tr').dataset.row; ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', 'row'); td.closest('tr').classList.add('dragging'); });
      g.addEventListener('dragover', ev => { const tr = ev.target.closest('tbody tr'); if (drag === null || !tr) return; ev.preventDefault(); U.$$('.drop-before', g).forEach(x => x.classList.remove('drop-before')); tr.classList.add('drop-before'); });
      g.addEventListener('drop', ev => { const tr = ev.target.closest('tbody tr'); if (drag === null || !tr) return; ev.preventDefault(); ev.stopPropagation(); moveRow(drag, +tr.dataset.row); drag = null; });
      g.addEventListener('dragend', () => { drag = null; U.$$('.drop-before,.dragging', g).forEach(x => x.classList.remove('drop-before', 'dragging')); });
      g.addEventListener('keydown', ev => {
        if (!ev.altKey || (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown')) return;
        const tr = ev.target.closest('tr[data-row]');
        if (!tr) return;
        ev.preventDefault();
        const from = +tr.dataset.row, to = from + (ev.key === 'ArrowUp' ? -1 : 1);
        const bind = ev.target.dataset.bind;
        if (moveRow(from, to < from ? to : to + 1) && bind) {
          const el = U.$(`[data-bind="${bind.replace(`.${from}.`, `.${to}.`)}"]`);
          if (el) el.focus();
        }
      });
      const wrap = U.$('.grid-wrap', root);
      wrap.addEventListener('paste', ev => {
        const text = ev.clipboardData && ev.clipboardData.getData('text/plain');
        if (!text || !/[\t\n]/.test(text.trim())) return;   // single value: normal paste into the cell
        ev.preventDefault();
        U.importTable({ name: 'tempelan', text }, A.ui.list);
      });
    },
  };

  // Move row `from` so it sits before index `before` (before = length → end).
  function moveRow(from, before) {
    const isRefs = A.ui.list === 'refs';
    const rows = isRefs ? A.config.referenceDbs : A.attr(A.ui.list).rows;
    if (before < 0 || before > rows.length || before === from || before === from + 1) return false;
    A.mutate(c => {
      const rs = isRefs ? c.referenceDbs : c.attributes.find(x => x.id === A.ui.list).rows;
      const [x] = rs.splice(from, 1);
      rs.splice(before > from ? before - 1 : before, 0, x);
    });
    return true;
  }

  /* ---------- List actions ---------- */
  U.act.listSel = el => { A.flush(); A.ui.list = el.dataset.id; A.ui.listQuery = ''; U.renderAll(); A.save(); };
  U.act.listSearch = el => {
    A.ui.listQuery = el.value;
    const q = el.value.toLowerCase();
    for (const tr of U.$$('#dataGrid tbody tr')) {
      const text = U.$$('input, select', tr).map(x => (x.type === 'checkbox' ? '' : x.value)).join(' ').toLowerCase();
      tr.hidden = !!q && !text.includes(q);
    }
  };
  U.act.importPick = async () => { const f = await U.pickFile('.xlsx,.csv,.txt'); if (f) U.openFile(f, A.ui.list); };
  U.act.listAdd = async () => {
    const res = await U.dialog({
      title: 'Daftar baru',
      body: `<div class="field"><label for="nln">Nama (satu kata, mis. Modul)</label><input id="nln" class="mono" spellcheck="false"></div>`,
      actions: [{ label: 'Batal', value: null }, { label: 'Buat', value: 'ok', kind: 'filled' }],
      collect: d => U.$('#nln', d).value.trim(), onOpen: d => U.$('#nln', d).focus(),
    });
    if (!res || !res.data) return;
    const name = uniq(res.data.replace(/[^A-Za-z0-9_]/g, '') || 'Daftar', A.config.attributes.map(x => x.name));
    const id = uniq(slug(name, true) || 'daftar', A.config.attributes.map(x => x.id));
    A.mutate(c => c.attributes.push({ id, name, role: 'none', columns: [{ id: 'kode', name: 'Kode', type: 'text', required: true }, { id: 'desc', name: 'Deskripsi', type: 'text', required: true }], rows: [] }));
    A.ui.list = id; U.renderAll();
  };
  U.act.listMenu = el => {
    const a = A.attr(A.ui.list), i = A.attrIndex(a.id);
    const items = [];
    if (!FIXED(a)) items.push({ label: 'Ganti nama…', icon: 'edit', run: () => renameList(a) });
    items.push({ label: 'Duplikat', icon: 'dup', run: () => {
      const copy = E.clone(a);
      copy.id = uniq(a.id + '_2', A.config.attributes.map(x => x.id));
      copy.name = uniq(a.name + '2', A.config.attributes.map(x => x.name));
      if (FIXED(copy)) copy.role = 'none';
      A.mutate(c => c.attributes.splice(i + 1, 0, copy)); A.ui.list = copy.id; U.renderAll();
    } });
    if (i > 0) items.push({ label: 'Geser ke kiri', icon: 'up', run: () => A.mutate(c => { const [x] = c.attributes.splice(i, 1); c.attributes.splice(i - 1, 0, x); }) });
    if (i < A.config.attributes.length - 1) items.push({ label: 'Geser ke kanan', icon: 'down', run: () => A.mutate(c => { const [x] = c.attributes.splice(i, 1); c.attributes.splice(i + 1, 0, x); }) });
    if (!FIXED(a)) items.push({ divider: true }, { label: 'Hapus daftar', icon: 'delete', run: () => deleteList(a) });
    U.menu(el, items);
  };
  async function renameList(a) {
    const res = await U.dialog({
      title: 'Ganti nama daftar',
      body: `<div class="field"><label for="rln">Nama</label><input id="rln" class="mono" value="${esc(a.name)}" spellcheck="false"></div><span class="hint">Nama dan blok yang memakainya ikut diperbarui.</span>`,
      actions: [{ label: 'Batal', value: null }, { label: 'Simpan', value: 'ok', kind: 'filled' }],
      collect: d => U.$('#rln', d).value.trim(), onOpen: d => U.$('#rln', d).select(),
    });
    if (!res || !res.data || res.data === a.name) return;
    const to = res.data.replace(/[^A-Za-z0-9_]/g, '');
    if (!/^[A-Za-z]/.test(to) || A.config.attributes.some(x => x.name === to) || E.RESERVED_HEADS.includes(to)) return U.toast('Nama tidak bisa dipakai (harus unik, diawali huruf, tanpa spasi)', 'error');
    A.mutate(c => { const at = c.attributes.find(x => x.id === a.id); U.renameHead(c, at.name, to); at.name = to; });
  }
  async function deleteList(a) {
    const used = usages(A.config, a);
    if (used.length) return U.dialog({ title: `${a.name} masih dipakai`, body: `<ul>${used.map(u => `<li>${esc(u)}</li>`).join('')}</ul>` });
    if (!(await U.confirm(`Hapus ${a.name}?`, `${U.plural(a.rows.length, 'baris')} ikut terhapus. Ctrl+Z untuk kembali.`, 'Hapus', true))) return;
    A.mutate(c => c.attributes.splice(A.attrIndex(a.id), 1));
    A.ui.list = null; U.renderAll();
  }

  /* ---------- Column actions ---------- */
  U.act.colMenu = el => {
    const a = A.attr(A.ui.list), j = +el.dataset.j, col = a.columns[j], locked = LOCKED_COLS.includes(col.id);
    const setType = (type, target) => A.mutate(c => {
      const at = c.attributes.find(x => x.id === a.id), cl = at.columns[j];
      cl.type = type;
      if (type === 'ref' || type === 'refList') cl.target = target; else delete cl.target;
      for (const r of at.rows) { const v = r[cl.id]; if (v !== undefined) r[cl.id] = E.convertValue(cl, Array.isArray(v) ? v.join(',') : typeof v === 'boolean' ? (v ? 'ya' : '') : v); }
    });
    const items = [{ label: 'Ganti nama…', icon: 'edit', run: () => renameCol(a, j) }];
    if (!locked) {
      items.push({ divider: true },
        { label: 'Teks', checked: col.type === 'text', run: () => setType('text') },
        { label: 'Angka', checked: col.type === 'number', run: () => setType('number') },
        { label: 'Ya/tidak', checked: col.type === 'boolean', run: () => setType('boolean') },
        { label: `Pilih dari daftar…${col.type === 'ref' || col.type === 'refList' ? ` (${(A.attr(col.target) || {}).name || col.target})` : ''}`, checked: col.type === 'ref' || col.type === 'refList', run: () => pickTarget(a, col, setType) },
        { label: 'Wajib diisi', checked: !!col.required, run: () => A.mutate(c => { const cl = c.attributes.find(x => x.id === a.id).columns[j]; cl.required = !cl.required; }) },
        { divider: true });
      if (j > 2) items.push({ label: 'Geser ke kiri', icon: 'up', run: () => A.mutate(c => { const cs = c.attributes.find(x => x.id === a.id).columns; const [x] = cs.splice(j, 1); cs.splice(j - 1, 0, x); }) });
      if (j < a.columns.length - 1) items.push({ label: 'Geser ke kanan', icon: 'down', run: () => A.mutate(c => { const cs = c.attributes.find(x => x.id === a.id).columns; const [x] = cs.splice(j, 1); cs.splice(j + 1, 0, x); }) });
      items.push({ label: 'Hapus kolom', icon: 'delete', run: () => delCol(a, j) });
    }
    U.menu(el, items);
  };
  async function pickTarget(a, col, setType) {
    const res = await U.dialog({
      title: `${col.name || col.id}: pilih dari daftar`,
      body: `<div class="field"><label for="ptl">Daftar</label><select id="ptl" class="input">${U.attrOptions(col.target, x => x.id !== a.id)}</select></div>
        <div class="opts"><label><input type="radio" name="pm" value="ref" ${col.type !== 'refList' ? 'checked' : ''}><span>Satu nilai</span></label><label><input type="radio" name="pm" value="refList" ${col.type === 'refList' ? 'checked' : ''}><span>Beberapa nilai</span></label></div>`,
      actions: [{ label: 'Batal', value: null }, { label: 'Pakai', value: 'ok', kind: 'filled' }],
      collect: d => ({ target: U.$('#ptl', d).value, type: U.$('input[name=pm]:checked', d).value }),
    });
    if (res) setType(res.data.type, res.data.target);
  }
  async function renameCol(a, j) {
    const col = a.columns[j];
    const res = await U.dialog({
      title: 'Ganti nama kolom',
      body: `<div class="field"><label for="rcn">Nama</label><input id="rcn" value="${esc(col.name || col.id)}"></div><span class="hint">Blok tetap tersambung (id <span class="mono">${esc(col.id)}</span>).</span>`,
      actions: [{ label: 'Batal', value: null }, { label: 'Simpan', value: 'ok', kind: 'filled' }],
      collect: d => U.$('#rcn', d).value.trim(), onOpen: d => U.$('#rcn', d).select(),
    });
    if (res && res.data) A.mutate(c => { c.attributes.find(x => x.id === a.id).columns[j].name = res.data; });
  }
  async function delCol(a, j) {
    const col = a.columns[j];
    const re = new RegExp(`\\{${a.name}\\.${col.id}[.|}]`);
    const used = Object.entries(A.config.templates).filter(([, v]) => re.test(v)).length + (A.config.zoneRules || []).filter(r => (r.patterns || []).some(p => re.test(p)) || (r.when || []).some(w => String(w.token).startsWith(`${a.name}.${col.id}`))).length;
    if (!(await U.confirm(`Hapus kolom ${col.name || col.id}?`, used ? `Dipakai di ${used} aturan nama; blok itu akan bermasalah.` : 'Nilainya di semua baris ikut terhapus.', 'Hapus', true))) return;
    A.mutate(c => { const at = c.attributes.find(x => x.id === a.id); at.columns.splice(j, 1); for (const r of at.rows) delete r[col.id]; });
  }
  U.act.colAdd = async () => {
    const a = A.attr(A.ui.list);
    const res = await U.dialog({
      title: 'Kolom baru',
      body: `<div class="field"><label for="ncn">Nama</label><input id="ncn" placeholder="mis. Slot"></div>
        <div class="field"><label for="nct">Jenis</label><select id="nct" class="input"><option value="text">Teks</option><option value="number">Angka</option><option value="boolean">Ya/tidak</option>${A.config.attributes.filter(x => x.id !== a.id).map(x => `<option value="ref:${esc(x.id)}">Pilih dari ${esc(x.name)}</option>`).join('')}</select></div>`,
      actions: [{ label: 'Batal', value: null }, { label: 'Tambah', value: 'ok', kind: 'filled' }],
      collect: d => ({ name: U.$('#ncn', d).value.trim(), type: U.$('#nct', d).value }), onOpen: d => U.$('#ncn', d).focus(),
    });
    if (!res || !res.data.name) return;
    const id = uniq(slug(res.data.name), a.columns.map(c => c.id));
    const [type, target] = res.data.type.split(':');
    A.mutate(c => { const col = { id, name: res.data.name, type, required: false }; if (target) col.target = target; c.attributes.find(x => x.id === a.id).columns.push(col); });
  };

  /* ---------- Row actions ---------- */
  U.act.rowAdd = () => {
    const a = A.attr(A.ui.list), r = {};
    for (const c of a.columns) r[c.id] = c.type === 'boolean' ? false : c.type === 'refList' ? [] : c.type === 'number' ? null : '';
    if (a.columns.some(c => c.id === 'urutan')) r.urutan = Math.max(0, ...a.rows.map(x => x.urutan).filter(Number.isInteger)) + 1;
    A.mutate(c => c.attributes.find(x => x.id === a.id).rows.push(r));
    const el = U.$(`[data-bind="attributes.${A.attrIndex(a.id)}.rows.${a.rows.length - 1}.kode"]`);
    if (el) { el.focus(); el.scrollIntoView({ block: 'center' }); }
  };
  U.act.rowDel = el => A.mutate(c => c.attributes.find(x => x.id === A.ui.list).rows.splice(+el.dataset.r, 1));
  U.act.kodeRename = (el, ev, v) => {
    const old = el.dataset.old, a = A.attr(A.ui.list);
    if (!old || old === v || !a) return;
    let n = 0;
    A.mutate(c => {
      for (const b of c.attributes) for (const col of b.columns || []) {
        if (col.target !== a.id) continue;
        for (const r of b.rows) {
          if (col.type === 'ref' && r[col.id] === old) { r[col.id] = v; n++; }
          if (col.type === 'refList' && Array.isArray(r[col.id]) && r[col.id].includes(old)) { r[col.id] = r[col.id].map(x => (x === old ? v : x)); n++; }
        }
      }
      const comb = c.combination;
      for (const p of comb.excluded || []) {
        if (comb.rowAttr === a.id && p[0] === old) { p[0] = v; n++; }
        if (comb.colAttr === a.id && p[1] === old) { p[1] = v; n++; }
      }
    });
    if (n) U.toast(`${n} rujukan ${old} → ${v}`);
  };
  U.act.teamSync = () => {
    const used = new Set(A.config.inUse.teams || []);
    A.mutate(c => { for (const r of c.attributes.find(x => x.id === A.ui.list).rows) r.existing = used.has(r.kode); });
  };

  /* ---------- Reference DBs ---------- */
  const nextPos = c => {
    const used = [...A.r.model.cells.map(x => x.pos), ...(c.referenceDbs || []).map(r => r.pos)].filter(Number.isInteger);
    return used.length ? Math.max(...used) + 1 : 1;
  };
  U.act.refAdd = () => A.mutate(c => { c.referenceDbs.push({ db: '', pos: nextPos(c), active: true, note: '' }); });
  U.act.refDel = el => A.mutate(c => { c.referenceDbs.splice(+el.dataset.i, 1); });
  U.act.refRenumber = async () => {
    if (!(await U.confirm('Nomori posisi?', 'DB referensi aktif diberi posisi berurutan setelah DB yang dibuat tool. Yang tidak aktif dikosongkan.', 'Nomori'))) return;
    A.mutate(c => {
      let p = Math.max(0, ...A.r.model.cells.map(x => x.pos).filter(Number.isInteger)) + 1;
      for (const r of c.referenceDbs) r.pos = r.active ? p++ : null;
    });
  };
  U.act.refFromProject = async () => {
    const f = await U.pickFile('.xlsx');
    if (!f) return;
    let book;
    try { book = await E.xlsx.read(await U.readBytes(f)); } catch (e) { return U.toast(`${f.name}: ${e.message}`, 'error'); }
    const sheet = book.find(s => /^databases$/i.test(s.name.trim()));
    let list = sheet ? E.readDatabasesSheet(sheet).dbs : null;
    if (!list) list = book.map(s => E.readDbListSheet(s)).find(Boolean) || [];
    const have = new Set([...(A.config.referenceDbs || []).map(r => r.db), ...A.r.model.cells.map(c => c.db)]);
    list = list.filter(x => !have.has(x.name));
    if (!list.length) return U.toast('Tidak ada DB baru di file itu', 'error');
    const res = await U.dialog({
      title: 'Pilih DB referensi', wide: true,
      body: `<div class="inline"><input class="input" id="refFilter" placeholder="Saring, mis. CATA" style="max-width:280px"><button type="button" class="btn sm text" id="refAll">Pilih yang tampil</button></div>
        <div class="tbl tall"><table><thead><tr><th></th><th>DB</th><th class="num">DBNO</th></tr></thead><tbody>
        ${list.map((x, i) => `<tr data-name="${esc(x.name.toLowerCase())}"><td class="tight"><input type="checkbox" value="${i}" aria-label="${esc(x.name)}"></td><td class="mono">${esc(x.name)}</td><td class="num mono">${x.number === null ? '' : x.number}</td></tr>`).join('')}
        </tbody></table></div>`,
      actions: [{ label: 'Batal', value: null }, { label: 'Tambahkan', value: 'ok', kind: 'filled' }],
      collect: d => U.$$('tbody input:checked', d).map(i => list[+i.value]),
      onOpen: d => {
        U.$('#refFilter', d).addEventListener('input', e => { const q = e.target.value.toLowerCase(); for (const tr of U.$$('tbody tr', d)) tr.hidden = !tr.dataset.name.includes(q); });
        U.$('#refAll', d).addEventListener('click', () => U.$$('tbody tr', d).filter(tr => !tr.hidden).forEach(tr => { U.$('input', tr).checked = true; }));
      },
    });
    if (!res || !res.data.length) return;
    A.mutate(c => { let p = nextPos(c); for (const x of res.data) c.referenceDbs.push({ db: x.name, pos: p++, active: true, note: '' }); });
  };
})(UI);
