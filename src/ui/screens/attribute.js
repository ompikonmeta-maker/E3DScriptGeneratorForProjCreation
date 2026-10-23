/* Screen 2: Attribute. Free tables (columns + rows) that drive tokens; roles team/user/separator. */
(function (U) {
  'use strict';
  const E = E3D, A = U.App, esc = U.esc;
  const ROLES = [['none', 'Lainnya (hanya token)'], ['team', 'Team (CREATE TEAM)'], ['user', 'User (TADD)'], ['separator', 'Separator (NEW SITE)']];
  const TYPES = [['text', 'Teks'], ['number', 'Angka'], ['boolean', 'Ya/tidak'], ['ref', 'Referensi'], ['refList', 'Daftar referensi']];
  const LOCKED = ['kode', 'desc'];

  const cur = A => {
    const list = A.config.attributes || [];
    let a = list.find(x => x.id === A.ui.attr);
    if (!a && list.length) { a = list[0]; A.ui.attr = a.id; }
    return a;
  };
  const ai = (A, id) => A.config.attributes.findIndex(x => x.id === id);
  const roleChip = r => (r === 'none' ? '<span class="chip">Token</span>' : `<span class="chip role">${{ team: 'Team', user: 'User', separator: 'Separator' }[r]}</span>`);
  const slug = (s, re) => {
    const words = String(s).normalize('NFKD').replace(/[^\w\s]/g, ' ').trim().split(/[\s_]+/).filter(Boolean);
    let id = words.map((w, i) => (i ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())).join('') || 'kolom';
    if (!/^[a-zA-Z]/.test(id)) id = 'k' + id;
    return re === 'lower' ? id.toLowerCase().replace(/[^a-z0-9_]/g, '') : id;
  };
  const uniq = (base, taken) => { let s = base, n = 2; while (taken.includes(s)) s = base + n++; return s; };

  // Every place that references attribute a (blocks delete).
  function usages(c, a) {
    const out = [];
    for (const b of c.attributes) for (const col of b.columns || [])
      if ((col.type === 'ref' || col.type === 'refList') && col.target === a.id && b.id !== a.id) out.push(`Kolom ${b.name}.${col.id}`);
    if (c.combination.rowAttr === a.id) out.push('Attribute baris di Relasi & kombinasi');
    if (c.combination.colAttr === a.id) out.push('Attribute kolom di Relasi & kombinasi');
    (c.zoneRules || []).forEach(r => { if (r.forEach === a.id) out.push(`Aturan zone ${r.id} (untuk tiap)`); });
    const re = new RegExp(`\\{${a.name}[.|}]`);
    for (const [k, v] of Object.entries(c.templates || {})) if (re.test(v)) out.push(`Template ${k}`);
    (c.zoneRules || []).forEach(r => {
      if ((r.patterns || []).some(p => re.test(p)) || (r.when || []).some(w => String(w.token).split('.')[0] === a.name)) out.push(`Aturan zone ${r.id}`);
    });
    return [...new Set(out)];
  }
  // Rename a token head everywhere (attribute rename keeps tokens working).
  function renameHead(c, from, to) {
    const re = new RegExp(`\\{${from}(?=[.|}])`, 'g');
    for (const k of Object.keys(c.templates || {})) c.templates[k] = String(c.templates[k]).replace(re, '{' + to);
    const tok = w => { const p = String(w.token).split('.'); if (p[0] === from) { p[0] = to; w.token = p.join('.'); } };
    for (const r of c.zoneRules || []) { r.patterns = (r.patterns || []).map(p => p.replace(re, '{' + to)); (r.when || []).forEach(tok); }
    (c.combination.condition || []).forEach(tok);
  }

  function cellInput(a, i, r, col, ri) {
    const bind = `attributes.${i}.rows.${ri}.${col.id}`, loc = `c:${a.id}:${ri}:${col.id}`, v = r[col.id];
    const lbl = `aria-label="${esc(col.name || col.id)} baris ${ri + 1}"`;
    if (col.type === 'boolean') return `<td class="tight" style="text-align:center"><input type="checkbox" data-bind="${bind}" data-loc="${loc}" ${v ? 'checked' : ''} ${lbl}></td>`;
    if (col.type === 'ref') {
      const t = A.config.attributes.find(x => x.id === col.target);
      const opts = (t ? t.rows : []).map(x => `<option value="${esc(x.kode)}" ${x.kode === v ? 'selected' : ''}>${esc(x.kode)}</option>`).join('');
      const missing = v && !(t && t.rows.some(x => x.kode === v)) ? `<option selected value="${esc(v)}">${esc(v)} (tidak ada)</option>` : '';
      return `<td><select data-bind="${bind}" data-loc="${loc}" ${lbl}><option value=""></option>${missing}${opts}</select></td>`;
    }
    if (col.type === 'refList') return `<td><input data-bind="${bind}" data-t="list" data-loc="${loc}" value="${esc((v || []).join(', '))}" placeholder="-" spellcheck="false" ${lbl}></td>`;
    const cls = col.id === 'kode' ? 'k' : col.type === 'number' ? 'n' : col.id === 'desc' ? 'd' : '';
    return `<td class="${cls}"><input data-bind="${bind}" ${col.type === 'number' ? 'data-t="int" inputmode="numeric"' : ''} ${col.id === 'kode' ? 'data-on="kodeRename"' : ''}
      data-loc="${loc}" value="${esc(v === null || v === undefined ? '' : v)}" spellcheck="false" ${lbl}></td>`;
  }

  const parts = {
    list(A) {
      return (A.config.attributes || []).map(x => {
        const bad = U.issuesAt('a:' + x.id, 'error').length;
        return `<button type="button" class="item" role="option" data-act="attrSel" data-id="${esc(x.id)}" aria-selected="${x.id === A.ui.attr}">
          <span class="t"><span>${esc(x.name)}</span>${bad ? `<span class="chip err">${bad}</span>` : roleChip(x.role)}</span>
          <span class="m">${U.plural((x.rows || []).length, 'baris')} · ${(x.columns || []).length} kolom</span></button>`;
      }).join('');
    },
    checks(A) {
      const a = cur(A);
      if (!a) return '';
      let extra = '';
      if (a.role === 'team') {
        const n = (a.rows || []).filter(r => !r.existing).length;
        extra = `<span class="chip info">${n} team baru dibuat di step 00</span>`;
      }
      return U.chipsFor('a:' + a.id, ['Kode unik', 'Kolom wajib terisi', 'Angka valid', 'Referensi valid']) + extra;
    },
  };

  U.screens[2] = {
    title: 'Attribute',
    sub: 'Tabel parameter bebas. Kolom Kode dan Deskripsi wajib; kolom angka dan referensi bisa ditambah. Peran E3D menentukan attribute mana yang menghasilkan command.',
    parts,
    select(A, loc) { if (loc.attributeId) { A.ui.attr = loc.attributeId; A.ui.attrQuery = ''; } },
    render(A) {
      const a = cur(A);
      const list = `<aside class="side card" aria-label="Daftar attribute">
        <div class="card-head"><h2>${(A.config.attributes || []).length} attribute</h2></div>
        <div class="list" role="listbox" aria-label="Attribute" data-part="list">${parts.list(A)}</div>
        <div class="inline"><button class="btn sm tonal" type="button" data-act="attrAdd">${U.icon('add')}Baru</button>
          ${a ? `<button class="icon-btn sm" type="button" data-act="attrDup" aria-label="Duplikat" title="Duplikat">${U.icon('dup')}</button>
          <button class="icon-btn sm" type="button" data-act="attrMove" data-d="-1" aria-label="Naik" title="Naik">${U.icon('up')}</button>
          <button class="icon-btn sm" type="button" data-act="attrMove" data-d="1" aria-label="Turun" title="Turun">${U.icon('down')}</button>
          <button class="icon-btn sm danger" type="button" data-act="attrDel" aria-label="Hapus" title="Hapus">${U.icon('delete')}</button>` : ''}</div>
      </aside>`;
      if (!a) return `<div class="split">${list}<div class="grow"><section class="card"><p class="hint">Belum ada attribute. Klik Baru.</p></section></div></div>`;
      const i = ai(A, a.id), cols = a.columns || [], rows = a.rows || [];
      const inUseTeams = A.config.inUse && (A.config.inUse.teams || []).length ? new Set(A.config.inUse.teams) : null;
      const q = (A.ui.attrQuery || '').toLowerCase();
      const head = cols.map(c => `<th${c.type === 'number' ? ' class="num"' : ''} title="Token {${esc(a.name)}.${esc(c.id)}}">${esc(c.name || c.id)}${c.type === 'ref' || c.type === 'refList' ? ` → ${esc((A.config.attributes.find(x => x.id === c.target) || {}).name || c.target)}` : ''}</th>`).join('');
      const body = rows.map((r, ri) => {
        const text = cols.map(c => String(Array.isArray(r[c.id]) ? r[c.id].join(' ') : r[c.id] === undefined ? '' : r[c.id])).join(' ').toLowerCase();
        const status = a.role === 'team' ? `<td class="tight">${inUseTeams ? (inUseTeams.has(r.kode) ? '<span class="chip">ada</span>' : '<span class="chip info">baru</span>') : (r.existing ? '<span class="chip">ada</span>' : '<span class="chip info">baru</span>')}</td>` : '';
        return `<tr data-row="${ri}" ${q && !text.includes(q) ? 'hidden' : ''}><td class="idx">${ri + 1}</td>${cols.map(c => cellInput(a, i, r, c, ri)).join('')}${status}
          <td class="tight"><button class="icon-btn sm" type="button" data-act="rowMove" data-r="${ri}" data-d="-1" aria-label="Naik">${U.icon('up')}</button><button class="icon-btn sm" type="button" data-act="rowMove" data-r="${ri}" data-d="1" aria-label="Turun">${U.icon('down')}</button><button class="icon-btn sm danger" type="button" data-act="rowDel" data-r="${ri}" aria-label="Hapus baris">${U.icon('delete')}</button></td></tr>`;
      }).join('');
      return `<div class="split">${list}<div class="grow">
        <section class="card" aria-label="Attribute">
          <div class="fields">
            <div class="field" data-loc="a:${esc(a.id)}"><label for="an">Nama attribute (kepala token)</label><input id="an" class="mono" data-bind="attributes.${i}.name" data-on="attrRename" value="${esc(a.name)}" spellcheck="false">
              <span class="sup">Id <span class="mono">${esc(a.id)}</span> · ganti nama ikut memperbarui token</span></div>
            <div class="field"><label for="ar">Peran E3D</label><select id="ar" data-bind="attributes.${i}.role">${ROLES.map(([v, l]) => `<option value="${v}" ${a.role === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
              <span class="sup">${{ team: 'Baris menjadi CREATE TEAM (kolom existing, anggota).', user: 'Kode baris dipakai di TADD.', separator: 'Baris menjadi site separator per grup.', none: 'Hanya dipakai sebagai token.' }[a.role] || ''}</span></div>
          </div>
        </section>
        <section class="card" aria-label="Kolom">
          <div class="card-head"><h2>Kolom</h2><button class="btn sm tonal" type="button" data-act="colAdd">${U.icon('add')}Kolom</button></div>
          <div class="tbl"><table class="grid"><thead><tr><th>Kolom</th><th>Id</th><th>Tipe</th><th>Wajib</th><th>Target</th><th>Token</th><th></th></tr></thead><tbody>
          ${cols.map((c, j) => `<tr data-loc="c:${esc(a.id)}:col:${esc(c.id)}"><td><input data-bind="attributes.${i}.columns.${j}.name" value="${esc(c.name || '')}" aria-label="Nama kolom"></td>
            <td class="mono">${esc(c.id)}</td>
            <td><select data-change="colType" data-j="${j}" ${LOCKED.includes(c.id) ? 'disabled' : ''} aria-label="Tipe">${TYPES.map(([v, l]) => `<option value="${v}" ${c.type === v ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
            <td class="tight" style="text-align:center"><input type="checkbox" data-bind="attributes.${i}.columns.${j}.required" ${c.required || LOCKED.includes(c.id) ? 'checked' : ''} ${LOCKED.includes(c.id) ? 'disabled' : ''} aria-label="Wajib"></td>
            <td>${c.type === 'ref' || c.type === 'refList' ? `<select data-change="colTarget" data-j="${j}" aria-label="Target">${U.attrOptions(c.target)}</select>` : ''}</td>
            <td><span class="tok" style="cursor:default">{${esc(a.name)}.${esc(c.id)}${c.type === 'ref' ? '.kode' : ''}}</span></td>
            <td class="tight">${LOCKED.includes(c.id) ? '' : `<button class="icon-btn sm" type="button" data-act="colMove" data-j="${j}" data-d="-1" aria-label="Naik">${U.icon('up')}</button><button class="icon-btn sm" type="button" data-act="colMove" data-j="${j}" data-d="1" aria-label="Turun">${U.icon('down')}</button><button class="icon-btn sm danger" type="button" data-act="colDel" data-j="${j}" aria-label="Hapus kolom">${U.icon('delete')}</button>`}</td></tr>`).join('')}
          </tbody></table></div>
        </section>
        <section class="card" aria-label="Data">
          <div class="card-head"><h2>Data · ${U.plural(rows.length, 'baris')}</h2>
            <div class="inline"><input class="input" style="width:200px;height:32px" data-input="attrSearch" id="attrSearch" value="${esc(A.ui.attrQuery || '')}" placeholder="Cari…" aria-label="Cari baris">
            <button class="btn sm tonal" type="button" data-act="rowAdd">${U.icon('add')}Baris</button>
            <button class="btn sm outlined" type="button" data-act="rowPaste">${U.icon('paste')}Tempel dari Excel</button>
            <button class="btn sm outlined" type="button" data-act="rowCsv">${U.icon('upload')}Import CSV</button>
            ${a.role === 'team' && inUseTeams ? `<button class="btn sm text" type="button" data-act="teamSync" title="Isi kolom existing dari daftar terpakai">${U.icon('sync')}Sinkron 'existing'</button>` : ''}</div></div>
          ${rows.length ? `<div class="tbl tall" data-keep-scroll="grid-${esc(a.id)}"><table class="grid" id="dataGrid"><thead><tr><th>#</th>${head}${a.role === 'team' ? '<th>Status</th>' : ''}<th></th></tr></thead><tbody>${body}</tbody></table></div>`
            : '<p class="hint">Belum ada baris. Tambah baris, tempel dari Excel, atau import CSV.</p>'}
          <div class="chips" data-part="checks">${parts.checks(A)}</div>
          <span class="hint">Alt+↑/↓ memindah baris. Urutan baris attribute kolom (mis. Area) = urutan site dan posisi MDB.</span>
        </section>
      </div></div>`;
    },
    mount(root) {
      const grid = U.$('#dataGrid', root);
      if (grid) grid.addEventListener('keydown', ev => {
        if (!ev.altKey || (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown')) return;
        const tr = ev.target.closest('tr[data-row]');
        if (!tr) return;
        ev.preventDefault();
        const col = ev.target.dataset.bind ? ev.target.dataset.bind.split('.').pop() : null;
        const r = moveRow(+tr.dataset.row, ev.key === 'ArrowUp' ? -1 : 1);
        if (r !== null && col) { const el = U.$(`[data-bind="attributes.${ai(A, A.ui.attr)}.rows.${r}.${col}"]`); if (el) el.focus(); }
      });
    },
  };

  /* ---------- Attribute actions ---------- */
  U.act.attrSel = el => { A.flush(); A.ui.attr = el.dataset.id; A.ui.attrQuery = ''; U.renderScreen(); };
  U.act.attrSearch = el => {
    A.ui.attrQuery = el.value;
    const q = el.value.toLowerCase();
    for (const tr of U.$$('#dataGrid tbody tr')) {
      const text = U.$$('input, select', tr).map(x => (x.type === 'checkbox' ? '' : x.value)).join(' ').toLowerCase();
      tr.hidden = !!q && !text.includes(q);
    }
  };
  U.act.attrAdd = async () => {
    const res = await U.dialog({
      title: 'Attribute baru',
      body: `<div class="field"><label for="nan">Nama (kepala token, tanpa spasi)</label><input id="nan" class="mono" placeholder="mis. Modul" spellcheck="false"></div>
        <div class="field"><label for="nar">Peran E3D</label><select id="nar">${ROLES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>`,
      actions: [{ label: 'Batal', value: null }, { label: 'Buat', value: 'ok', kind: 'filled' }],
      collect: d => ({ name: U.$('#nan', d).value.trim(), role: U.$('#nar', d).value }),
      onOpen: d => U.$('#nan', d).focus(),
    });
    if (!res || !res.data.name) return;
    const c = A.config, name = res.data.name.replace(/[^A-Za-z0-9_]/g, '');
    const id = uniq(slug(name, 'lower') || 'attr', c.attributes.map(x => x.id));
    A.mutate(c => c.attributes.push({ id, name: uniq(name || 'Attr', c.attributes.map(x => x.name)), role: res.data.role,
      columns: [{ id: 'kode', name: 'Kode', type: 'text', required: true }, { id: 'desc', name: 'Deskripsi', type: 'text', required: true }], rows: [] }));
    A.ui.attr = id; U.renderScreen();
  };
  U.act.attrDup = () => {
    const a = cur(A), copy = E.clone(a);
    copy.id = uniq(a.id + '_2', A.config.attributes.map(x => x.id));
    copy.name = uniq(a.name + '2', A.config.attributes.map(x => x.name));
    if (copy.role === 'team' || copy.role === 'user') copy.role = 'none';
    A.mutate(c => c.attributes.splice(ai(A, a.id) + 1, 0, copy));
    A.ui.attr = copy.id; U.renderScreen();
  };
  U.act.attrMove = el => {
    const i = ai(A, A.ui.attr), j = i + +el.dataset.d;
    if (j < 0 || j >= A.config.attributes.length) return;
    A.mutate(c => { const [x] = c.attributes.splice(i, 1); c.attributes.splice(j, 0, x); });
  };
  U.act.attrDel = async () => {
    const a = cur(A), used = usages(A.config, a);
    if (used.length) return U.dialog({ title: `${a.name} masih dipakai`, body: `<p>Hapus atau ubah dulu tempat-tempat berikut:</p><ul>${used.map(u => `<li>${esc(u)}</li>`).join('')}</ul>` });
    if (!(await U.confirm(`Hapus ${a.name}?`, `${U.plural((a.rows || []).length, 'baris')} ikut terhapus. Bisa dibatalkan dengan Ctrl+Z.`, 'Hapus', true))) return;
    A.mutate(c => c.attributes.splice(ai(A, a.id), 1));
    A.ui.attr = null; U.renderScreen();
  };
  U.act.attrRename = (el, ev, v) => {
    const old = el.dataset.old;
    if (!old || old === v || !/^[A-Za-z][A-Za-z0-9_]*$/.test(v)) return;
    A.mutate(c => renameHead(c, old, v));
    U.toast(`Token {${old}.…} diganti menjadi {${v}.…}`);
  };

  /* ---------- Column actions ---------- */
  U.act.colAdd = async () => {
    const a = cur(A);
    const res = await U.dialog({
      title: `Kolom baru di ${a.name}`,
      body: `<div class="field"><label for="ncn">Nama kolom</label><input id="ncn" placeholder="mis. Slot"></div>
        <div class="field"><label for="nct">Tipe</label><select id="nct">${TYPES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>
        <div class="field"><label for="ncg">Target (untuk referensi)</label><select id="ncg">${U.attrOptions(null, x => x.id !== a.id)}</select></div>
        <span class="hint">Id kolom dibuat dari nama dan dipakai di token, mis. {${esc(a.name)}.slot}.</span>`,
      actions: [{ label: 'Batal', value: null }, { label: 'Tambah', value: 'ok', kind: 'filled' }],
      collect: d => ({ name: U.$('#ncn', d).value.trim(), type: U.$('#nct', d).value, target: U.$('#ncg', d).value }),
      onOpen: d => U.$('#ncn', d).focus(),
    });
    if (!res || !res.data.name) return;
    const { name, type, target } = res.data;
    const id = uniq(slug(name), a.columns.map(c => c.id));
    A.mutate(c => {
      const at = c.attributes[ai(A, a.id)];
      const col = { id, name, type, required: false };
      if (type === 'ref' || type === 'refList') col.target = target;
      at.columns.push(col);
    });
  };
  U.act.colType = el => {
    const a = cur(A), j = +el.dataset.j, type = el.value;
    A.mutate(c => {
      const at = c.attributes[ai(A, a.id)], col = at.columns[j];
      col.type = type;
      if ((type === 'ref' || type === 'refList') && !col.target) col.target = (c.attributes.find(x => x.id !== at.id) || at).id;
      if (type !== 'ref' && type !== 'refList') delete col.target;
      for (const r of at.rows) {
        const v = r[col.id];
        if (v === undefined) continue;
        r[col.id] = E.convertValue(col, Array.isArray(v) ? v.join(',') : typeof v === 'boolean' ? (v ? 'ya' : '') : v);
      }
    });
  };
  U.act.colTarget = el => A.mutate(c => { c.attributes[ai(A, A.ui.attr)].columns[+el.dataset.j].target = el.value; });
  U.act.colMove = el => {
    const j = +el.dataset.j, k = j + +el.dataset.d, cols = cur(A).columns;
    if (k < 0 || k >= cols.length) return;
    A.mutate(c => { const cs = c.attributes[ai(A, A.ui.attr)].columns; const [x] = cs.splice(j, 1); cs.splice(k, 0, x); });
  };
  U.act.colDel = async el => {
    const a = cur(A), col = a.columns[+el.dataset.j];
    const re = new RegExp(`\\{${a.name}\\.${col.id}[.|}]`);
    const used = Object.entries(A.config.templates).filter(([, v]) => re.test(v)).map(([k]) => k)
      .concat((A.config.zoneRules || []).filter(r => (r.patterns || []).some(p => re.test(p)) || (r.when || []).some(w => w.token.startsWith(`${a.name}.${col.id}`))).map(r => 'zone ' + r.id));
    const msg = used.length ? `Kolom dipakai di: ${used.join(', ')}. Token itu akan error (V03).` : 'Nilai kolom di semua baris ikut terhapus.';
    if (!(await U.confirm(`Hapus kolom ${col.name || col.id}?`, esc(msg), 'Hapus', true))) return;
    A.mutate(c => { const at = c.attributes[ai(A, a.id)]; at.columns.splice(+el.dataset.j, 1); for (const r of at.rows) delete r[col.id]; });
  };

  /* ---------- Row actions ---------- */
  function blankRow(a) {
    const r = {};
    for (const c of a.columns) r[c.id] = c.type === 'boolean' ? false : c.type === 'refList' ? [] : c.type === 'number' ? null : '';
    const urutan = a.columns.find(c => c.id === 'urutan');
    if (urutan) r.urutan = Math.max(0, ...a.rows.map(x => x.urutan).filter(Number.isInteger)) + 1;
    return r;
  }
  U.act.rowAdd = () => {
    const a = cur(A);
    A.mutate(c => c.attributes[ai(A, a.id)].rows.push(blankRow(a)));
    const el = U.$(`[data-bind="attributes.${ai(A, a.id)}.rows.${a.rows.length - 1}.kode"]`);
    if (el) { el.focus(); el.scrollIntoView({ block: 'center' }); }
  };
  U.act.rowDel = el => A.mutate(c => c.attributes[ai(A, A.ui.attr)].rows.splice(+el.dataset.r, 1));
  function moveRow(r, d) {
    const rows = cur(A).rows, k = r + d;
    if (k < 0 || k >= rows.length) return null;
    A.mutate(c => { const rs = c.attributes[ai(A, A.ui.attr)].rows; const [x] = rs.splice(r, 1); rs.splice(k, 0, x); });
    return k;
  }
  U.act.rowMove = el => moveRow(+el.dataset.r, +el.dataset.d);
  U.act.kodeRename = (el, ev, v) => {
    const old = el.dataset.old, a = cur(A);
    if (!old || old === v) return;
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
    if (n) U.toast(`${n} referensi ke ${old} diganti menjadi ${v}`);
  };
  U.act.teamSync = () => {
    const used = new Set(A.config.inUse.teams || []);
    A.mutate(c => { for (const r of c.attributes[ai(A, A.ui.attr)].rows) r.existing = used.has(r.kode); });
    U.toast("Kolom 'existing' disesuaikan dengan daftar terpakai");
  };

  async function addTable(a, table, source) {
    const rows = E.tableToRows(a, table);
    if (!rows.length) return U.toast('Tidak ada baris yang terbaca', 'error');
    const res = await U.dialog({
      title: `${rows.length} baris dari ${source}`,
      body: `<div class="tbl" style="max-height:260px"><table><thead><tr>${a.columns.map(c => `<th>${esc(c.name || c.id)}</th>`).join('')}</tr></thead><tbody>
        ${rows.slice(0, 8).map(r => `<tr>${a.columns.map(c => `<td class="mono">${esc(Array.isArray(r[c.id]) ? r[c.id].join(', ') : r[c.id] === null ? '' : r[c.id])}</td>`).join('')}</tr>`).join('')}
        </tbody></table></div>${rows.length > 8 ? `<span class="hint">… ${rows.length - 8} baris lagi</span>` : ''}
        <div class="opts"><label><input type="radio" name="pm" value="append" checked><span>Tambahkan di akhir</span></label>
        <label><input type="radio" name="pm" value="replace"><span>Ganti semua ${a.rows.length} baris</span></label>
        <label><input type="radio" name="pm" value="merge"><span>Gabung: perbarui baris dengan Kode sama, tambah sisanya</span></label></div>`,
      actions: [{ label: 'Batal', value: null }, { label: 'Pakai', value: 'ok', kind: 'filled' }],
      collect: d => U.$('input[name=pm]:checked', d).value,
    });
    if (!res) return;
    A.mutate(c => {
      const at = c.attributes[ai(A, a.id)];
      if (res.data === 'replace') at.rows = rows;
      else if (res.data === 'merge') {
        for (const r of rows) { const old = at.rows.find(x => x.kode === r.kode); if (old) Object.assign(old, r); else at.rows.push(r); }
      } else at.rows.push(...rows);
    });
    U.toast(`${rows.length} baris diproses`);
  }
  U.act.rowPaste = async () => {
    const a = cur(A);
    const res = await U.dialog({
      title: `Tempel ke ${a.name}`,
      body: `<p>Salin sel dari Excel lalu tempel di sini. Baris judul opsional (dicocokkan dengan nama atau id kolom: ${a.columns.map(c => `<span class="mono">${esc(c.name || c.id)}</span>`).join(', ')}). Tanpa judul, kolom diambil berurutan.</p>
        <textarea class="input" id="pasteRows"></textarea>`,
      actions: [{ label: 'Batal', value: null }, { label: 'Lanjut', value: 'ok', kind: 'filled' }],
      collect: d => U.$('#pasteRows', d).value,
      onOpen: d => U.$('#pasteRows', d).focus(),
    });
    if (!res || !res.data.trim()) return;
    addTable(a, E.parseDelimited(res.data, E.detectDelimiter(res.data)), 'tempelan');
  };
  U.act.rowCsv = async () => {
    const f = await U.pickFile('.csv,.txt,text/csv');
    if (!f) return;
    const text = await U.readText(f);
    addTable(cur(A), E.parseDelimited(text, E.detectDelimiter(text)), f.name);
  };
})(UI);
