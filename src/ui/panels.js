/* Start screen, side panel "Hasil di E3D", sheets (Project, Masalah), tour, glossary, Export Config match. */
(function (U) {
  'use strict';
  const E = E3D, A = U.App, esc = U.esc;

  /* ---------- 0 · Mulai ---------- */
  U.screens[0] = {
    render() {
      return `<div class="start">
        <div class="start-brand">${U.LOGO}<h1>E3D Setup Generator</h1></div>
        <div class="start-choices">
          <button type="button" class="choice" data-act="newProject"><b>${U.icon('add')}Project baru</b><span>Mulai dengan daftar kosong</span></button>
          <button type="button" class="choice" data-act="openConfig"><b>${U.icon('upload')}Buka config.json</b><span>Ubah lalu unduh ulang</span></button>
        </div>
        <div class="dropzone big">atau seret config.json ke sini</div>
      </div>`;
    },
  };
  const hasData = c => (c.attributes || []).some(a => (a.rows || []).length) || (c.referenceDbs || []).length;
  U.act.newProject = async () => {
    if (hasData(A.config) && !(await U.confirm('Project baru?', 'Pekerjaan sekarang diganti. Simpan config.json dulu bila masih perlu. Ctrl+Z untuk kembali.', 'Mulai baru', true))) return;
    A.hadSaved = true;
    A.replace(E.emptyConfig(), 1);
    U.openProject();
  };

  /* ---------- Side panel: Hasil di E3D ---------- */
  U.renderSide = function () {
    const s = U.$('#side');
    if (!A.ui.screen) { s.innerHTML = ''; return; }
    if (!A.ui.side) { s.innerHTML = `<button type="button" class="side-rail" data-act="sideToggle" title="Tampilkan hasil di E3D">${U.icon('panel')}<span>Hasil</span></button>`; return; }
    const r = A.r, c = r.counts, ds = r.model.disciplines;
    const dd = ds.find(d => d.row.kode === A.ui.tree) || ds[0];
    const on = (...keys) => (A.ui.screen === 3 && keys.includes(A.ui.name) ? ' hl' : '');
    let tree = '<p class="hint">Belum ada site.</p>';
    if (dd) {
      const order = E.siteOrder(dd), shown = order.slice(0, 16);
      let zoneShown = false;
      tree = `<div class="tree"><div class="muted">WORLD</div>${shown.map(o => {
        if (o.kind !== 'site') return `<div class="t-sep"><span class="${on(o.kind)}">${esc(o.name)}</span></div>`;
        let z = '';
        if (!zoneShown && o.cell.zones.length) {
          zoneShown = true;
          z = o.cell.zones.slice(0, 3).map(n => `<div class="t-zone"><span class="${on('zone')}">${esc(n)}</span></div>`).join('') + (o.cell.zones.length > 3 ? `<div class="t-zone muted">… ${U.num(o.cell.zones.length - 3)} zone</div>` : '');
        }
        return `<div class="t-site"><span class="${on('site')}">${esc(o.name)}</span>${o.cell.zones.length ? `<small>${U.num(o.cell.zones.length)}</small>` : ''}</div>${z}`;
      }).join('')}${order.length > shown.length ? `<div class="t-site muted">… ${order.length - shown.length} lagi</div>` : ''}</div>`;
    }
    const cell = dd && dd.cells[0];
    s.innerHTML = `<div class="side-head"><h2>Hasil di E3D</h2><button type="button" class="icon-btn sm" data-act="sideToggle" aria-label="Sembunyikan" title="Sembunyikan">${U.icon('close')}</button></div>
      <div class="counts"><div><b>${U.num(c.dbs)}</b><span>DB</span></div><div><b>${U.num(c.sites + c.separators)}</b><span>site</span></div><div><b>${U.num(c.zones)}</b><span>zone</span></div></div>
      ${ds.length > 1 ? `<div class="mini-tabs">${ds.map(d => `<button type="button" data-act="sideTree" data-k="${esc(d.row.kode)}" aria-pressed="${d === dd}" title="${esc(d.row.desc)}">${esc(d.row.kode)}</button>`).join('')}</div>` : ''}
      ${tree}
      ${cell ? `<div class="sample-db"><div class="mono"><span class="${on('dbName')}">${esc(cell.db)}</span></div>
        <div class="muted"><span class="${on('dbDesc')}">${esc(cell.desc)}</span></div>
        <div class="muted">DBNO <span class="mono${on('dbNo')}">${cell.dbno === null ? '?' : cell.dbno}</span> · posisi MDB <span class="mono${on('mdbPos')}">${cell.pos === null ? '?' : cell.pos}</span></div></div>` : ''}`;
  };
  U.act.sideTree = el => { A.ui.tree = el.dataset.k; A.save(); U.renderSide(); };

  /* ---------- Sheets ---------- */
  let sheet = null;
  U.openSheet = function (title, render, parts) {
    U.closeSheet();
    const el = document.createElement('section');
    el.className = 'sheet';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', title);
    el.innerHTML = `<div class="sheet-head"><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-act="closeSheet" aria-label="Tutup">${U.icon('close')}</button></div><div class="sheet-body"></div>`;
    document.body.appendChild(el);
    sheet = { el, render, parts };
    U.sheetRefresh(true);
    const f = U.$('input, select, button:not([data-act="closeSheet"])', U.$('.sheet-body', el));
    if (f) f.focus();
  };
  U.closeSheet = () => { if (sheet) { sheet.el.remove(); sheet = null; } };
  U.act.closeSheet = () => U.closeSheet();
  U.sheetRefresh = function (full) {
    if (!sheet) return;
    const body = U.$('.sheet-body', sheet.el);
    if (full || !sheet.parts) body.innerHTML = sheet.render();
    else for (const el of U.$$('[data-spart]', body)) el.innerHTML = sheet.parts[el.dataset.spart]();
    U.markIssues(sheet.el);
  };

  /* Project panel */
  const members = name => A.r.model.cells.filter(c => c.mdb === name).length +
    (name === A.config.combination.mdb ? (A.config.referenceDbs || []).filter(r => r.active).length : 0);
  function field(label, bind, o) {
    o = o || {};
    const v = U.getPath(A.config, bind);
    return `<div class="field" data-loc="f:${esc(o.loc || bind.split('.').pop())}"><label for="p-${esc(bind)}">${label}</label>
      <input id="p-${esc(bind)}" data-bind="${esc(bind)}" ${o.t ? `data-t="${o.t}"` : ''} class="${o.mono ? 'mono' : ''}" value="${esc(v === undefined || v === null ? '' : v)}" ${o.list ? `list="${o.list}"` : ''} autocomplete="off" spellcheck="false"></div>`;
  }
  const projParts = {
    probs: () => U.problems(['f:dbDefaults', 'f:mdbs', 'f:code', 'f:name', 'f:target', 'f:filePrefix']),
  };
  U.openProject = () => U.openSheet('Project', () => {
    const c = A.config;
    return `<div class="fields">
        ${field('Kode', 'project.code', { t: 'upper', mono: true, loc: 'code' })}
        ${field('Nama', 'project.name', { loc: 'name' })}
        ${field('Prefix file', 'project.filePrefix', { mono: true, loc: 'filePrefix' })}
        ${field('Versi E3D', 'project.target', { list: 'targets', loc: 'target' })}</div>
      <datalist id="targets"><option value="E3D 3.1.8.1 / Administration 2.1.0.1"><option value="E3D 3.1 / Administration 2.1"></datalist>
      <h3>MDB</h3>
      <div class="stack" data-loc="f:mdbs">${(c.mdbs || []).map((m, i) => `<div class="inline nowrap">
          <input type="radio" name="mdbdef" data-change="mdbDefault" data-i="${i}" ${m.default ? 'checked' : ''} aria-label="Default" title="MDB default">
          <input class="input mono" data-bind="mdbs.${i}.name" data-t="upper" data-on="mdbRename" value="${esc(m.name)}" aria-label="Nama MDB" spellcheck="false">
          <span class="hint nowrap">${U.num(members(m.name))} DB</span>
          <button class="icon-btn sm danger" type="button" data-act="mdbDel" data-i="${i}" aria-label="Hapus MDB" ${(c.mdbs || []).length < 2 ? 'disabled' : ''}>${U.icon('delete')}</button></div>`).join('')}
        <button class="btn sm text" type="button" data-act="mdbAdd">${U.icon('add')}MDB</button></div>
      <h3>Default DB</h3>
      <div class="fields three">
        ${field('Type', 'dbDefaults.type', { t: 'upper', mono: true, list: 'dbtypes', loc: 'dbDefaults' })}
        <div class="field"><label for="p-acc">Access</label><select id="p-acc" data-bind="dbDefaults.access">${['MULTIWRITE', 'UPDATE', 'CONTROLLED'].map(v => `<option ${c.dbDefaults.access === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div class="field"><label for="p-clm">Claim</label><select id="p-clm" data-bind="dbDefaults.claim">${['IMPLICIT', 'EXPLICIT'].map(v => `<option ${c.dbDefaults.claim === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div></div>
      <datalist id="dbtypes"><option value="DESI"><option value="CATA"><option value="DRAFT"><option value="ISODRAFT"></datalist>
      <div class="chips" data-spart="probs">${projParts.probs()}</div>`;
  }, projParts);
  U.act.projPanel = () => U.openProject();
  U.act.mdbAdd = () => A.mutate(c => { let n = c.mdbs.length + 1; while (c.mdbs.some(m => m.name === `/MDB-${n}`)) n++; c.mdbs.push({ name: `/MDB-${n}`, default: false }); });
  U.act.mdbDel = el => A.mutate(c => { const [m] = c.mdbs.splice(+el.dataset.i, 1); if (m.default && c.mdbs.length) { c.mdbs[0].default = true; c.combination.mdb = c.mdbs[0].name; } });
  U.act.mdbDefault = el => A.mutate(c => { c.mdbs.forEach((m, i) => { m.default = i === +el.dataset.i; }); c.combination.mdb = c.mdbs[+el.dataset.i].name; });
  U.act.mdbRename = (el, ev, v) => {
    const old = el.dataset.old;
    if (old === v) return;
    A.mutate(c => {
      if (c.combination.mdb === old) c.combination.mdb = v;
      const row = c.attributes.find(a => a.id === c.combination.rowAttr);
      if (row) for (const r of row.rows) if (r.mdb === old) r.mdb = v;
    });
  };

  /* Problems sheet */
  U.openProblems = () => U.openSheet('Masalah', () => {
    const errs = A.errors(), warns = A.warnings(), infos = A.r.issues.filter(i => i.severity === 'info');
    const item = (i, k) => `<div class="prob ${i.severity}"><span class="dot"></span><div class="tx"><b>${esc(i.message)}</b>${i.ref && i.ref !== '-' ? `<span class="ref">${esc(i.ref)}</span>` : ''}</div>
      ${i.location && i.location.screen ? `<button type="button" class="btn sm text" data-act="fixIssue" data-k="${k}">Perbaiki</button>` : ''}</div>`;
    const list = (arr, cap) => arr.slice(0, cap).map(i => item(i, A.r.issues.indexOf(i))).join('') + (arr.length > cap ? `<p class="hint">… ${arr.length - cap} lagi (lengkap di register, sheet Validation)</p>` : '');
    return (errs.length ? list(errs, 150) : '<p class="ok-line">Tidak ada error.</p>') +
      (warns.length ? `<h3>Catatan</h3>${list(warns, 50)}` : '') + (infos.length ? `<h3>Info</h3>${list(infos, 10)}` : '');
  });
  U.act.problems = () => U.openProblems();
  U.act.fixIssue = el => { const i = A.r.issues[+el.dataset.k]; if (i) U.goIssue(i); };

  /* ---------- Export Config (project tujuan) ---------- */
  U.act.matchProject = async () => { const f = await U.pickFile('.xlsx'); if (f) U.openFile(f); };
  U.act.matchClear = () => A.mutate(c => { delete c.inUse; });
  U.importExportConfigBook = async function (book, name) {
    const now = new Date().toISOString();
    let res = E.inUseFromWorkbook(book, name, now);
    if (res.needsColumn) {
      const cols = Array.from({ length: res.width }, (_, j) => j);
      const pick = await U.dialog({
        title: 'Kolom nama team?', wide: true,
        body: `<div class="tbl"><table><thead><tr>${cols.map(j => `<th><label class="inline nowrap"><input type="radio" name="tcol" value="${j}" ${j === 0 ? 'checked' : ''}>Kolom ${j + 1}</label></th>`).join('')}</tr></thead>
          <tbody>${res.preview.map(r => `<tr>${cols.map(j => `<td class="mono">${esc(r[j] === undefined ? '' : r[j])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`,
        actions: [{ label: 'Batal', value: null }, { label: 'Pakai', value: 'ok', kind: 'filled' }],
        collect: d => parseInt((U.$('input[name=tcol]:checked', d) || {}).value, 10),
      });
      if (!pick) return;
      res = E.inUseFromWorkbook(book, name, now, pick.data);
    }
    const u = res.inUse;
    if (!u.teams.length && !u.dbs.length) return U.dialog({ title: 'Tidak ada data project', body: `<ul>${res.msgs.map(m => `<li>${esc(m)}</li>`).join('')}</ul>` });
    A.mutate(c => { c.inUse = u; });
    const clash = A.errors().filter(i => ['V07', 'V08'].includes(i.id)).length;
    U.toast(`${name}: ${u.teams.length} team, ${u.dbs.length} DB${clash ? ` · ${clash} bentrok` : ' · tidak ada bentrok'}`, clash ? 'error' : undefined);
  };

  /* ---------- Tour (first visit, or the ? button) ---------- */
  const TOUR = [
    ['#stepper', 'Langkah', 'Ikuti dari kiri ke kanan. Langkah bisa dibuka kapan saja.'],
    ['#status', 'Status', 'Merah berarti ada yang perlu diperbaiki. Klik untuk lompat ke tempatnya.'],
    ['#side', 'Hasil di E3D', 'Setiap perubahan langsung terlihat seperti di Model Explorer.'],
    ['#foot .next', 'Lanjut', 'Tombol utama selalu di sini.'],
    ['#projChip', 'Project', 'Kode, nama, MDB dan default DB.'],
  ];
  let tourI = -1;
  U.maybeTour = () => { if (A.ui.screen && !U.store.get(U.KEY + '/tour')) U.startTour(); };
  U.startTour = () => { tourI = 0; drawTour(); };
  U.act.tour = () => { if (!A.ui.screen) A.ui.screen = 1; U.renderAll(); U.startTour(); };
  function endTour() { tourI = -1; const t = U.$('#tour'); if (t) t.remove(); U.store.set(U.KEY + '/tour', 1); }
  function drawTour() {
    let t = U.$('#tour');
    if (tourI < 0 || tourI >= TOUR.length) return endTour();
    const [sel, title, text] = TOUR[tourI];
    const target = U.$(sel);
    if (!target) { tourI++; return drawTour(); }
    if (!t) { t = document.createElement('div'); t.id = 'tour'; document.body.appendChild(t); }
    const r = target.getBoundingClientRect();
    const bw = 280, left = Math.max(12, Math.min(r.left, window.innerWidth - bw - 12));
    const below = r.bottom + 160 < window.innerHeight;
    t.innerHTML = `<div class="spot" style="left:${r.left - 6}px;top:${r.top - 6}px;width:${r.width + 12}px;height:${r.height + 12}px"></div>
      <div class="bubble" role="dialog" aria-label="${esc(title)}" style="left:${left}px;${below ? `top:${r.bottom + 14}px` : `bottom:${window.innerHeight - r.top + 14}px`}">
        <b>${esc(title)}</b><p>${esc(text)}</p>
        <div class="inline"><span class="hint">${tourI + 1}/${TOUR.length}</span><span class="spacer"></span>
          <button type="button" class="btn sm text" id="tourSkip">Lewati</button><button type="button" class="btn sm filled" id="tourNext">${tourI === TOUR.length - 1 ? 'Selesai' : 'Lanjut'}</button></div></div>`;
    U.$('#tourSkip', t).onclick = endTour;
    U.$('#tourNext', t).onclick = () => { tourI++; drawTour(); };
    U.$('#tourNext', t).focus();
  }
  window.addEventListener('resize', () => { if (tourI >= 0) drawTour(); });

  /* ---------- Glossary ---------- */
  U.glossary = () => U.dialog({
    title: 'Istilah', wide: true,
    body: `<dl class="gloss">
      <dt>Daftar</dt><dd>Tabel data: Disiplin, Area, Team, User, Fluid, DB referensi, dan daftar lain buatanmu.</dd>
      <dt>Susunan</dt><dd>Pasangan daftar yang menghasilkan DB: 1 DB + 1 site untuk tiap baris × kolom (mis. Disiplin × Area), urutannya, dan grupnya.</dd>
      <dt>Blok</dt><dd>Potongan nama dari sebuah kolom daftar, mis. Disiplin · Kode = L. Nama disusun dari blok dan teks.</dd>
      <dt>Separator</dt><dd>Site kosong pembatas di Model Explorer, per disiplin dan per grup (praktik project, bukan fitur E3D).</dd>
      <dt>DBNO</dt><dd>Nomor DB. Boleh 1–7000 dan 10000–250000, unik (fakta 1.3).</dd>
      <dt>Posisi MDB</dt><dd>Angka n pada ADD db n. Menentukan urutan di MDB (fakta 1.9), 1–5000.</dd>
      <dt>Zone</dt><dd>Dibuat di tiap site menurut aturan zone. NEW ZONE setelah pindah ke site belum dites (§9).</dd>
      <dt>Project tujuan</dt><dd>Export Config (.xlsx) dari project E3D tempat paket dijalankan, untuk cek nama team, DB dan DBNO yang sudah dipakai.</dd>
      <dt>config.json</dt><dd>Simpanan lengkap pekerjaan. Buka lagi kapan saja untuk mengubah dan mengunduh ulang.</dd></dl>`,
  });
})(UI);
