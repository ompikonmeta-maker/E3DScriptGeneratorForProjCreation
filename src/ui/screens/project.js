/* Screen 1: Project. Start, identity, MDBs, DB defaults, reference DBs (step 90), in-use list. */
(function (U) {
  'use strict';
  const E = E3D, A = U.App, esc = U.esc;

  const mdbMembers = (A, name) => A.r.model.cells.filter(c => c.mdb === name).length +
    (name === A.config.combination.mdb ? (A.config.referenceDbs || []).filter(r => r.active).length : 0);

  const parts = {
    inuse(A) {
      const u = A.config.inUse;
      if (!u || (!(u.teams || []).length && !(u.dbs || []).length))
        return `<div class="note info">Daftar terpakai belum dimuat. Import Export Config (.xlsx) dari project tujuan supaya bentrok nama team, nama DB dan DBNO ikut dicek (V07, V08, V21).</div>`;
      return `<div class="inner stack"><div class="inline"><b>Daftar terpakai</b><span class="chip ok">${U.icon('check')}${U.num((u.teams || []).length)} team · ${U.num((u.dbs || []).length)} DB</span></div>
        <span class="hint">${esc(u.source || '')}${u.importedAt ? ' · ' + esc(u.importedAt.slice(0, 16).replace('T', ' ')) : ''}</span>
        <div class="inline"><button class="btn sm outlined" type="button" data-act="importExportConfig">${U.icon('sync')}Ganti</button><button class="btn sm text danger" type="button" data-act="inUseClear">Hapus daftar</button></div></div>`;
    },
    mdbChecks(A) {
      return (A.config.mdbs || []).map(m => {
        const n = mdbMembers(A, m.name);
        const good = n <= 1000;
        return `<span class="chip ${good ? 'ok' : 'err'}">${U.icon(good ? 'check' : 'error')}<span class="mono">${esc(m.name)}</span> ${U.num(n)} member · ≤ 5000, ≤ 1000 current (1.7)</span>`;
      }).join('') + U.chipsFor('f:mdbs');
    },
    dbdef: () => U.chipsFor('f:dbDefaults', 'Multiwrite hanya untuk DESI, CATA, DRAFT, ISODRAFT (1.4)'),
    refSummary(A) {
      const refs = A.config.referenceDbs || [], act = refs.filter(r => r.active);
      const pos = act.map(r => r.pos).filter(Number.isInteger);
      const errs = A.r.issues.filter(i => i.severity === 'error' && i.location && i.location.refIndex !== undefined);
      return `<div class="chips"><span>${U.num(act.length)} aktif, ${U.num(refs.length - act.length)} dikomentari${pos.length ? ` · posisi ${Math.min(...pos)}–${Math.max(...pos)}` : ''}</span>` +
        errs.slice(0, 4).map(i => `<span class="chip err">${U.icon('error')}${esc(i.message)}<span class="chip ref">${i.id} · ${i.ref}</span></span>`).join('') +
        (errs.length > 4 ? `<span class="chip">+${errs.length - 4} lainnya</span>` : '') + '</div>';
    },
  };

  function field(label, bind, opts) {
    const o = opts || {}, v = U.getPath(A.config, bind);
    return `<div class="field" data-loc="f:${esc(o.loc || bind.split('.').pop())}"><label for="f-${esc(bind)}">${label}</label>
      <input id="f-${esc(bind)}" data-bind="${esc(bind)}" ${o.t ? `data-t="${o.t}"` : ''} class="${o.mono ? 'mono' : ''}" value="${esc(v)}" ${o.list ? `list="${o.list}"` : ''} autocomplete="off" spellcheck="false">
      ${o.sup ? `<span class="sup">${o.sup}</span>` : ''}</div>`;
  }

  U.screens[1] = {
    title: 'Project',
    sub: 'Titik awal, identitas project, MDB, atribut default DB, dan DB referensi untuk step 90.',
    parts,
    render(A) {
      const c = A.config, p = c.project, refs = c.referenceDbs || [];
      return `
      <section class="card" aria-label="Titik awal">
        <div class="card-head"><div><h2>Titik awal</h2><div class="sub">Mulai dari nol atau lanjutkan konfigurasi yang tersimpan. Pekerjaan tersimpan otomatis di browser ini.</div></div></div>
        <div class="grid-cards">
          <button type="button" class="choice" data-act="startEmpty"><b>${U.icon('newfile')}Kosong</b><span>Hanya struktur (Team, User, Disiplin, Area) dan default DB. Untuk konvensi baru.</span></button>
          <button type="button" class="choice" data-act="importJson"><b>${U.icon('upload')}Import config.json</b><span>Buka konfigurasi yang pernah diekspor dari tool ini (versi skema dicek). Juga bisa: seret file ke halaman.</span></button>
          <button type="button" class="choice" data-act="importExportConfig"><b>${U.icon('table')}Import Export Config (.xlsx)</b><span>Baca sheet Teams dan Databases project tujuan sebagai daftar terpakai (cek bentrok nama dan DBNO).</span></button>
        </div>
        <div data-part="inuse">${parts.inuse(A)}</div>
      </section>
      <div class="row">
        <section class="card" aria-label="Identitas">
          <h2>Identitas</h2>
          <div class="fields">
            ${field('Kode project · token PROJECT.code', 'project.code', { t: 'upper', mono: true, loc: 'code' })}
            ${field('Nama project · PROJECT.name', 'project.name', { loc: 'name' })}
            ${field('Prefix nama file · PROJECT.filePrefix', 'project.filePrefix', { mono: true, loc: 'filePrefix' })}
            ${field('Nama ZIP', 'project.packageName', { mono: true, loc: 'packageName' })}
          </div>
          ${field('Versi target · PROJECT.target', 'project.target', { list: 'targets', loc: 'target', sup: 'Ditulis di header komentar setiap file .mac dan README.' })}
          <datalist id="targets"><option value="E3D 3.1.8.1 / Administration 2.1.0.1"><option value="E3D 3.1 / Administration 2.1"></datalist>
          <div class="field"><label for="f-eol">Akhir baris file</label><select id="f-eol" data-bind="project.lineEnding">
            <option value="CRLF" ${p.lineEnding !== 'LF' ? 'selected' : ''}>CRLF (Windows, default)</option><option value="LF" ${p.lineEnding === 'LF' ? 'selected' : ''}>LF</option></select></div>
        </section>
        <section class="card" aria-label="MDB">
          <div class="card-head"><h2>MDB</h2><button class="btn sm tonal" type="button" data-act="mdbAdd">${U.icon('add')}MDB</button></div>
          <div class="stack">${(c.mdbs || []).map((m, i) => `
            <div class="inner inline" style="flex-wrap:nowrap">
              <input type="radio" name="mdbdef" id="mdbdef${i}" data-change="mdbDefault" data-i="${i}" ${m.default ? 'checked' : ''} aria-label="Default">
              <input class="input mono" data-bind="mdbs.${i}.name" data-t="upper" data-on="mdbRename" data-i="${i}" value="${esc(m.name)}" aria-label="Nama MDB ${i + 1}" spellcheck="false">
              ${m.default ? '<span class="chip info">Default</span>' : ''}
              <span class="hint" style="white-space:nowrap">${U.num(mdbMembers(A, m.name))} member</span>
              <button class="icon-btn sm danger" type="button" data-act="mdbDel" data-i="${i}" aria-label="Hapus MDB" ${(c.mdbs || []).length < 2 ? 'disabled' : ''}>${U.icon('delete')}</button>
            </div>`).join('')}</div>
          <div class="chips" data-part="mdbChecks">${parts.mdbChecks(A)}</div>
          <span class="hint">MDB default dipakai untuk ADD/CURRENT. Baris dengan kolom teks <code>mdb</code> di attribute baris (mis. Disiplin) diarahkan ke MDB itu.</span>
        </section>
        <section class="card" aria-label="Default DB">
          <h2>Default DB</h2>
          ${field('Type', 'dbDefaults.type', { t: 'upper', mono: true, list: 'dbtypes', loc: 'dbDefaults' })}
          <datalist id="dbtypes"><option value="DESI"><option value="CATA"><option value="DRAFT"><option value="ISODRAFT"></datalist>
          <div class="field"><label for="f-acc">Access</label><select id="f-acc" data-bind="dbDefaults.access">${['MULTIWRITE', 'UPDATE', 'CONTROLLED'].map(v => `<option ${c.dbDefaults.access === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
          <div class="field"><label for="f-clm">Claim</label><select id="f-clm" data-bind="dbDefaults.claim">${['IMPLICIT', 'EXPLICIT'].map(v => `<option ${c.dbDefaults.claim === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
          <div class="chips" data-part="dbdef">${parts.dbdef(A)}</div>
        </section>
      </div>
      <section class="card" aria-label="DB referensi">
        <div class="card-head"><div><h2>DB referensi · step 90</h2><div class="sub">DB yang sudah ada (catalogue, spec, foreign). Hanya di-ADD ke MDB default, tidak dibuat. Baris tidak aktif ditulis sebagai komentar.</div></div>
          <div class="inline"><button class="btn sm tonal" type="button" data-act="refAdd">${U.icon('add')}Baris</button>
          <button class="btn sm outlined" type="button" data-act="refPaste">${U.icon('paste')}Tempel daftar</button>
          <button class="btn sm outlined" type="button" data-act="refImport">${U.icon('table')}Import dari Export Config</button>
          <button class="btn sm text" type="button" data-act="refRenumber" title="Posisi berurutan setelah DB yang dibuat tool">Nomori posisi</button></div></div>
        <div class="hint" data-part="refSummary">${parts.refSummary(A)}</div>
        ${refs.length ? `<div class="tbl tall" data-keep-scroll="refs"><table class="grid"><thead><tr><th>#</th><th>DB (TEAM/NAMA)</th><th class="num">Posisi MDB</th><th>Aktif</th><th>Catatan</th><th></th></tr></thead><tbody>
          ${refs.map((r, i) => `<tr data-loc="r:${i}"><td class="idx">${i + 1}</td>
            <td class="k"><input data-bind="referenceDbs.${i}.db" value="${esc(r.db)}" spellcheck="false" aria-label="DB"></td>
            <td class="n"><input data-bind="referenceDbs.${i}.pos" data-t="int" value="${esc(r.pos === null || r.pos === undefined ? '' : r.pos)}" aria-label="Posisi" style="max-width:110px"></td>
            <td class="tight" style="text-align:center"><input type="checkbox" data-bind="referenceDbs.${i}.active" ${r.active ? 'checked' : ''} aria-label="Aktif"></td>
            <td><input data-bind="referenceDbs.${i}.note" value="${esc(r.note || '')}" aria-label="Catatan"></td>
            <td class="tight"><button class="icon-btn sm danger" type="button" data-act="refDel" data-i="${i}" aria-label="Hapus baris">${U.icon('delete')}</button></td></tr>`).join('')}
        </tbody></table></div>` : '<p class="hint">Belum ada DB referensi. Tambah baris, tempel dari Excel (DB, posisi, catatan) atau pilih dari Export Config.</p>'}
      </section>`;
    },
  };

  /* ---------- Actions ---------- */
  const hasData = c => (c.attributes || []).some(a => (a.rows || []).length) || (c.referenceDbs || []).length;
  U.act.startEmpty = async () => {
    if (hasData(A.config) && !(await U.confirm('Mulai dari kosong?', 'Konfigurasi saat ini diganti dengan struktur kosong. Ekspor dulu bila masih diperlukan. Bisa dibatalkan dengan Ctrl+Z.', 'Ganti', true))) return;
    A.replace(E.emptyConfig());
    U.toast('Konfigurasi kosong dibuat');
  };
  U.act.importExportConfig = async () => { const f = await U.pickFile('.xlsx'); if (f) U.importExportConfigFile(f); };
  U.act.inUseClear = () => A.mutate(c => { delete c.inUse; });

  async function readBook(file) {
    try { return await E.xlsx.read(await U.readBytes(file)); } catch (e) { U.toast(`${file.name}: ${e.message}`, 'error'); return null; }
  }
  U.importExportConfigFile = async function (file) {
    const book = await readBook(file);
    if (!book) return;
    const now = new Date().toISOString();
    let res = E.inUseFromWorkbook(book, file.name, now);
    if (res.needsColumn) {
      const cols = Array.from({ length: res.width }, (_, j) => j);
      const pick = await U.dialog({
        title: 'Pilih kolom nama team', wide: true,
        body: `<p>Header sheet Teams belum dikenal (OPEN-ITEMS OI-03). Pilih kolom yang berisi nama team.</p>
          <div class="tbl"><table><thead><tr>${cols.map(j => `<th><label class="inline"><input type="radio" name="tcol" value="${j}" ${j === 0 ? 'checked' : ''}>Kolom ${j + 1}</label></th>`).join('')}</tr></thead>
          <tbody>${res.preview.map(r => `<tr>${cols.map(j => `<td class="mono">${esc(r[j] === undefined ? '' : r[j])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`,
        actions: [{ label: 'Batal', value: null }, { label: 'Pakai kolom ini', value: 'ok', kind: 'filled' }],
        collect: d => parseInt((U.$('input[name=tcol]:checked', d) || {}).value, 10),
      });
      if (!pick) return;
      res = E.inUseFromWorkbook(book, file.name, now, pick.data);
    }
    const u = res.inUse;
    if (!u.teams.length && !u.dbs.length) return U.dialog({ title: 'Tidak ada data', body: `<p>${esc(file.name)}</p><ul>${res.msgs.map(m => `<li>${esc(m)}</li>`).join('')}</ul>` });
    const ok = await U.dialog({
      title: 'Import Export Config',
      body: `<p><b>${esc(file.name)}</b></p><div class="tiles"><div class="tile"><span class="l">Team terpakai</span><span class="v">${U.num(u.teams.length)}</span></div>
        <div class="tile"><span class="l">DB terpakai</span><span class="v">${U.num(u.dbs.length)}</span></div></div>
        ${res.msgs.length ? `<ul>${res.msgs.map(m => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}
        <p>Hanya daftar terpakai yang diganti; attribute tidak berubah.</p>`,
      actions: [{ label: 'Batal', value: false }, { label: 'Pakai', value: true, kind: 'filled' }],
    });
    if (!ok) return;
    A.mutate(c => { c.inUse = u; });
    U.toast(`Daftar terpakai: ${u.teams.length} team, ${u.dbs.length} DB`);
  };

  U.act.mdbAdd = () => A.mutate(c => {
    let n = c.mdbs.length + 1;
    while (c.mdbs.some(m => m.name === `/MDB-${n}`)) n++;
    c.mdbs.push({ name: `/MDB-${n}`, default: false });
  });
  U.act.mdbDel = el => A.mutate(c => {
    const [m] = c.mdbs.splice(+el.dataset.i, 1);
    if (m.default && c.mdbs.length) { c.mdbs[0].default = true; c.combination.mdb = c.mdbs[0].name; }
  });
  U.act.mdbDefault = el => A.mutate(c => {
    c.mdbs.forEach((m, i) => { m.default = i === +el.dataset.i; });
    c.combination.mdb = c.mdbs[+el.dataset.i].name;
  });
  U.act.mdbRename = (el, ev, v) => {
    const old = el.dataset.old;
    if (old === v) return;
    A.mutate(c => {
      if (c.combination.mdb === old) c.combination.mdb = v;
      const row = c.attributes.find(a => a.id === c.combination.rowAttr);
      if (row) for (const r of row.rows) if (r.mdb === old) r.mdb = v;
    });
  };

  const nextPos = c => {
    const used = [...A.r.model.cells.map(x => x.pos), ...(c.referenceDbs || []).map(r => r.pos)].filter(Number.isInteger);
    return used.length ? Math.max(...used) + 1 : 1;
  };
  U.act.refAdd = () => A.mutate(c => { c.referenceDbs.push({ db: '', pos: nextPos(c), active: true, note: '' }); });
  U.act.refDel = el => A.mutate(c => { c.referenceDbs.splice(+el.dataset.i, 1); });
  U.act.refRenumber = async () => {
    if (!(await U.confirm('Nomori posisi?', 'Semua DB referensi aktif diberi posisi berurutan setelah posisi tertinggi DB yang dibuat tool. Baris tidak aktif dikosongkan.', 'Nomori'))) return;
    A.mutate(c => {
      let p = Math.max(0, ...A.r.model.cells.map(x => x.pos).filter(Number.isInteger)) + 1;
      for (const r of c.referenceDbs) r.pos = r.active ? p++ : null;
    });
  };
  U.act.refPaste = async () => {
    const res = await U.dialog({
      title: 'Tempel daftar DB referensi',
      body: `<p>Satu DB per baris: <span class="mono">TEAM/NAMA</span>, posisi (opsional), catatan (opsional), dipisah Tab (salin dari Excel) atau koma. Baris tanpa posisi diberi nomor berikutnya.</p>
        <textarea class="input" id="pasteRefs" placeholder="MASTER/STLCATA&#9;251&#9;Catalogue"></textarea>`,
      actions: [{ label: 'Batal', value: null }, { label: 'Tambahkan', value: 'ok', kind: 'filled' }],
      collect: d => U.$('#pasteRefs', d).value,
      onOpen: d => U.$('#pasteRefs', d).focus(),
    });
    if (!res || !res.data.trim()) return;
    const rows = E.parseDelimited(res.data, E.detectDelimiter(res.data));
    A.mutate(c => {
      let p = nextPos(c);
      for (const r of rows) {
        const db = (r[0] || '').trim();
        if (!db || /^db$/i.test(db)) continue;
        const pos = /^\d+$/.test((r[1] || '').trim()) ? parseInt(r[1], 10) : p;
        p = Math.max(p, pos) + 1;
        c.referenceDbs.push({ db, pos, active: true, note: (r[2] || '').trim() });
      }
    });
    U.toast(`${rows.length} baris ditambahkan`);
  };
  U.act.refImport = async () => {
    const f = await U.pickFile('.xlsx');
    if (!f) return;
    const book = await readBook(f);
    if (!book) return;
    const sheet = book.find(s => /^databases$/i.test(s.name.trim()));
    let list = sheet ? E.readDatabasesSheet(sheet).dbs : null;
    if (!list) { const any = book.map(s => E.readDbListSheet(s)).find(Boolean); list = any || []; }
    const have = new Set([...(A.config.referenceDbs || []).map(r => r.db), ...A.r.model.cells.map(c => c.db)]);
    list = list.filter(x => !have.has(x.name));
    if (!list.length) return U.toast('Tidak ada DB baru di file itu', 'error');
    const res = await U.dialog({
      title: 'Pilih DB referensi', wide: true,
      body: `<div class="inline"><input class="input" id="refFilter" placeholder="Saring, mis. CATA atau MASTER/" style="max-width:320px">
          <button type="button" class="btn sm text" id="refAll">Pilih yang tampil</button><button type="button" class="btn sm text" id="refNone">Kosongkan</button></div>
        <div class="tbl tall"><table><thead><tr><th></th><th>DB</th><th class="num">DBNO</th></tr></thead><tbody>
        ${list.map((x, i) => `<tr data-name="${esc(x.name.toLowerCase())}"><td class="tight"><input type="checkbox" value="${i}" aria-label="${esc(x.name)}"></td><td class="mono">${esc(x.name)}</td><td class="num mono">${x.number === null ? '' : x.number}</td></tr>`).join('')}
        </tbody></table></div>`,
      actions: [{ label: 'Batal', value: null }, { label: 'Tambahkan', value: 'ok', kind: 'filled' }],
      collect: d => U.$$('tbody input:checked', d).map(i => list[+i.value]),
      onOpen: d => {
        const rows = () => U.$$('tbody tr', d).filter(tr => !tr.hidden);
        U.$('#refFilter', d).addEventListener('input', e => { const q = e.target.value.toLowerCase(); for (const tr of U.$$('tbody tr', d)) tr.hidden = !tr.dataset.name.includes(q); });
        U.$('#refAll', d).addEventListener('click', () => rows().forEach(tr => { U.$('input', tr).checked = true; }));
        U.$('#refNone', d).addEventListener('click', () => U.$$('tbody input', d).forEach(i => { i.checked = false; }));
      },
    });
    if (!res || !res.data.length) return;
    A.mutate(c => { let p = nextPos(c); for (const x of res.data) c.referenceDbs.push({ db: x.name, pos: p++, active: true, note: '' }); });
    U.toast(`${res.data.length} DB referensi ditambahkan`);
  };
})(UI);
