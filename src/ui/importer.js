/* Table import (Excel .xlsx, CSV, pasted cells) into a list, with drag-and-drop column mapping. */
(function (U) {
  'use strict';
  const E = E3D, A = U.App, esc = U.esc;

  // Pseudo-list for reference DBs (step 90) so the same importer handles them.
  U.REFS_LIST = {
    id: 'refs', name: 'DB referensi',
    columns: [{ id: 'db', name: 'DB', type: 'text' }, { id: 'pos', name: 'Posisi MDB', type: 'number' },
      { id: 'active', name: 'Aktif', type: 'boolean' }, { id: 'note', name: 'Catatan', type: 'text' }],
  };
  const listById = id => (id === 'refs' ? U.REFS_LIST : A.attr(id));
  const cellText = v => (v === undefined || v === null ? '' : String(v));

  async function pickSheet(book, name) {
    const sheets = book.filter(s => s.rows.some(r => r.some(c => cellText(c).trim())));
    if (!sheets.length) { U.toast(`${name}: tidak ada data`, 'error'); return null; }
    if (sheets.length === 1) return sheets[0];
    const res = await U.dialog({
      title: 'Sheet mana?',
      body: `<div class="opts">${sheets.map((s, i) => `<label><input type="radio" name="sh" value="${i}" ${i === 0 ? 'checked' : ''}><span>${esc(s.name)} <small>${s.rows.length} baris</small></span></label>`).join('')}</div>`,
      actions: [{ label: 'Batal', value: null }, { label: 'Pilih', value: 'ok', kind: 'filled' }],
      collect: d => +U.$('input[name=sh]:checked', d).value,
    });
    return res ? sheets[res.data] : null;
  }

  U.importTable = async function (src, listId) {
    let table;
    if (src.book) {
      const sh = await pickSheet(src.book, src.name);
      if (!sh) return;
      table = sh.rows.map(r => r.map(cellText));
    } else table = E.parseDelimited(src.text, E.detectDelimiter(src.text));
    table = table.filter(r => r.some(c => c.trim() !== ''));
    if (!table.length) return U.toast('Tidak ada baris yang terbaca', 'error');
    const width = Math.max(...table.map(r => r.length));
    const st = { list: listId || (A.ui.screen === 1 && A.ui.list) || (A.config.combination || {}).colAttr || (A.config.attributes[0] || {}).id };
    const initMap = () => { const l = listById(st.list); st.header = E.looksLikeHeader(l, table[0], table.slice(1)); st.map = E.guessMapping(l, st.header ? table[0] : Array.from({ length: width }, (_, j) => j), st.header); };
    initMap();
    const srcName = j => (st.header ? cellText(table[0][j]) || `Kolom ${j + 1}` : `Kolom ${j + 1}`);
    const body = () => (st.header ? table.slice(1) : table);

    function draw(d) {
      const l = listById(st.list), used = new Set(Object.values(st.map).filter(j => j >= 0));
      const rows = E.mapTable(l, body().slice(0, 5), st.map);
      U.$('.imp', d).innerHTML = `
        <div class="inline"><label for="impList">Ke daftar</label>
          <select id="impList" class="input" style="width:auto">${(A.config.attributes || []).map(a => `<option value="${esc(a.id)}" ${a.id === st.list ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}<option value="refs" ${st.list === 'refs' ? 'selected' : ''}>DB referensi</option></select>
          <label class="inline nowrap"><input type="checkbox" id="impHdr" ${st.header ? 'checked' : ''}>Baris pertama = judul</label></div>
        <div class="map">
          <div class="map-dst">${l.columns.map(c => {
            const j = st.map[c.id];
            return `<div class="map-row"><span>${esc(c.name || c.id)}</span><span class="arrow">←</span>
              <div class="slot${j >= 0 ? ' filled' : ''}" data-slot="${esc(c.id)}">${j >= 0 ? `<span class="srcchip" draggable="true" data-src="${j}">${esc(srcName(j))}</span>` : 'seret ke sini'}</div>
              <select class="input mini" data-pick="${esc(c.id)}" aria-label="Kolom file untuk ${esc(c.name || c.id)}"><option value="-1">—</option>${Array.from({ length: width }, (_, k) => `<option value="${k}" ${k === j ? 'selected' : ''}>${esc(srcName(k))}</option>`).join('')}</select></div>`;
          }).join('')}</div>
          <div class="map-src"><span class="hint">Kolom file</span><div class="chips">${Array.from({ length: width }, (_, k) => `<span class="srcchip${used.has(k) ? ' used' : ''}" draggable="true" data-src="${k}">${esc(srcName(k))}</span>`).join('')}</div></div>
        </div>
        <div class="tbl"><table><thead><tr>${l.columns.map(c => `<th>${esc(c.name || c.id)}</th>`).join('')}</tr></thead><tbody>
          ${rows.map(r => `<tr>${l.columns.map(c => `<td class="mono">${esc(Array.isArray(r[c.id]) ? r[c.id].join(', ') : typeof r[c.id] === 'boolean' ? (r[c.id] ? 'ya' : '') : r[c.id] === null ? '' : r[c.id])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
        <span class="hint">${body().length} baris${body().length > 5 ? ' · 5 pertama ditampilkan' : ''}</span>`;
      const count = U.$('button.filled', d);
      if (count) count.textContent = `Impor ${body().length} baris`;
    }

    const res = await U.dialog({
      title: `Impor ${src.name}`, wide: true,
      body: `<div class="imp stack"></div>
        <div class="opts row-opts"><label><input type="radio" name="im" value="append" checked><span>Tambah</span></label>
          <label><input type="radio" name="im" value="merge"><span>Gabung (kode sama diperbarui)</span></label>
          <label><input type="radio" name="im" value="replace"><span>Ganti semua</span></label></div>`,
      actions: [{ label: 'Batal', value: null }, { label: 'Impor', value: 'ok', kind: 'filled' }],
      collect: d => U.$('input[name=im]:checked', d).value,
      onOpen: d => {
        draw(d);
        const box = U.$('.imp', d);
        box.addEventListener('change', ev => {
          if (ev.target.id === 'impList') { st.list = ev.target.value; initMap(); }
          else if (ev.target.id === 'impHdr') { st.header = ev.target.checked; st.map = E.guessMapping(listById(st.list), st.header ? table[0] : Array.from({ length: width }, (_, j) => j), st.header); }
          else if (ev.target.dataset.pick) st.map[ev.target.dataset.pick] = +ev.target.value;
          draw(d);
        });
        let dragSrc = null;
        box.addEventListener('dragstart', ev => { const c = ev.target.closest('[data-src]'); if (c) { dragSrc = +c.dataset.src; ev.dataTransfer.setData('text/plain', 'col'); } });
        box.addEventListener('dragover', ev => { const s = ev.target.closest('[data-slot]'); if (s && dragSrc !== null) { ev.preventDefault(); s.classList.add('over'); } });
        box.addEventListener('dragleave', ev => { const s = ev.target.closest('[data-slot]'); if (s) s.classList.remove('over'); });
        box.addEventListener('drop', ev => {
          const s = ev.target.closest('[data-slot]');
          if (!s || dragSrc === null) return;
          ev.preventDefault(); ev.stopPropagation();
          for (const k of Object.keys(st.map)) if (st.map[k] === dragSrc) st.map[k] = -1;
          st.map[s.dataset.slot] = dragSrc;
          dragSrc = null;
          draw(d);
        });
        box.addEventListener('dragend', () => { dragSrc = null; });
      },
    });
    if (!res) return;
    const l = listById(st.list);
    let rows = E.mapTable(l, body(), st.map);
    if (st.list === 'refs') {
      rows = rows.filter(r => r.db).map(r => ({ db: r.db, pos: r.pos, active: st.map.active >= 0 ? r.active : true, note: r.note || '' }));
      A.mutate(c => {
        if (res.data === 'replace') c.referenceDbs = rows;
        else for (const r of rows) { const old = c.referenceDbs.find(x => x.db === r.db); if (old && res.data === 'merge') Object.assign(old, r); else c.referenceDbs.push(r); }
      });
    } else {
      A.mutate(c => {
        const at = c.attributes.find(a => a.id === st.list);
        if (res.data === 'replace') at.rows = rows;
        else for (const r of rows) { const old = res.data === 'merge' && at.rows.find(x => x.kode === r.kode); if (old) Object.assign(old, r); else at.rows.push(r); }
      });
    }
    A.ui.list = st.list;
    if (A.ui.screen !== 1) U.go(1); else U.renderAll();
    U.toast(`${rows.length} baris diimpor ke ${l.name}`);
  };
})(UI);
