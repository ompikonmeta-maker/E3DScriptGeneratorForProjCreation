/* Step 4 · Cek & Unduh. Status, download, run order in E3D, summary with "Ubah", project match,
   package contents (folded) and package options (⚙). */
(function (U) {
  'use strict';
  const E = E3D, A = U.App, esc = U.esc;
  const FILE_TPL = [['teamsFolder', 'Folder 00-TEAMS'], ['teamsFile', 'File 00-TEAMS'], ['discFolder', 'Folder per baris'], ['b1File', 'File B1'], ['b2File', 'File B2'],
    ['b3File', 'File B3'], ['refFolder', 'Folder 90'], ['refFile', 'File 90'], ['fixupFolder', 'Folder 99'], ['fixupFile', 'File 99'], ['registerFile', 'Register']];
  const OPTS = [['includeReadme', 'README'], ['includeRegister', 'Register .xlsx'], ['includeConfig', 'config.json'], ['includeReference', '90 · DB referensi'],
    ['includeFixup', '99 · perbaiki urutan MDB'], ['includeExistingTeamsBlock', 'Team lama (sebagai komentar)']];
  const KW = /^(NEW SITE|NEW ZONE|CREATE TEAM|CREATE DB|SET MDB|SET TEAM|TADD|ADD|CURRENT|SAVEWORK)\b(.*)$/;
  const highlight = t => t.split(/\r?\n/).map(l => { if (l.startsWith('$*')) return `<span class="c">${esc(l)}</span>`; const m = l.match(KW); return m ? `<span class="k">${esc(m[1])}</span>${esc(m[2])}` : esc(l); }).join('\n');

  function textOf(path) {
    const f = A.r.files.find(x => x.path === path);
    if (f) return f.text;
    if (path === '00-README.txt') return E.readme(A.r.cfg, A.r.model, A.r.issues, A.r.files, new Date());
    if (path === 'config.json') return E.exportJson(A.config);
    return null;
  }
  const parts = {
    hero(A) {
      const errs = A.errors().length, warns = A.warnings().length, o = A.config.output || {};
      if (errs) return `<div class="hero bad"><span class="hero-ic">${U.icon('error')}</span><div class="grow"><h2>${errs} masalah perlu diperbaiki</h2><span>Unduh aktif lagi setelah semua beres.</span></div>
        <button type="button" class="btn filled" data-act="problems">Lihat masalah</button></div>`;
      if (!A.r.model.cells.length) return `<div class="hero"><span class="hero-ic">${U.icon('info')}</span><div class="grow"><h2>Belum ada DB</h2><span>Isi Daftar dan Susunan dulu.</span></div>
        <button type="button" class="btn filled" data-act="go" data-screen="1">Ke Daftar</button></div>`;
      const extra = [o.includeReadme && 'README', o.includeRegister && 'register', o.includeConfig && 'config.json'].filter(Boolean);
      return `<div class="hero ok"><span class="hero-ic">${U.icon('check')}</span><div class="grow"><h2>Siap diunduh</h2>
        <span>${A.r.files.length} macro${extra.length ? ' · ' + extra.join(' · ') : ''}${warns ? ` · <button type="button" class="link" data-act="problems">${warns} catatan</button>` : ''}</span></div>
        <button type="button" class="btn filled big" data-act="generateZip">${U.icon('download')}Unduh ${esc(A.config.project.packageName || 'ZIP')}</button></div>`;
    },
    summary(A) {
      const c = A.config, { rowAttr, colAttr } = E.roles(A.r.cfg);
      const rows = c.attributes.reduce((n, a) => n + a.rows.length, 0);
      const items = [
        [1, 'Daftar', `${c.attributes.length} daftar · ${U.num(rows)} baris · ${c.referenceDbs.length} DB referensi`],
        [2, 'Susunan', rowAttr && colAttr ? `${esc(rowAttr.name)} × ${esc(colAttr.name)} · ${U.num(A.r.counts.dbs)} DB` : 'belum diatur'],
        [3, 'Nama', `${(c.zoneRules || []).length} aturan zone · ${U.num(A.r.counts.zones)} zone`],
      ];
      return items.map(([n, t, s]) => {
        const e = U.stepErrors(n);
        return `<div class="sumcard"><b>${t}${e ? ` <span class="chip err">${e}</span>` : ''}</b><span>${s}</span><button type="button" class="btn sm text" data-act="go" data-screen="${n}">${U.icon('edit', 'sm')}Ubah</button></div>`;
      }).join('');
    },
    match(A) {
      const u = A.config.inUse;
      if (!u || (!(u.teams || []).length && !(u.dbs || []).length))
        return `<button type="button" class="dropzone" data-act="matchProject">Seret Export Config (.xlsx) project tujuan ke sini · cek nama team, DB dan DBNO yang sudah dipakai</button>`;
      const clash = A.errors().filter(i => ['V07', 'V08', 'V21'].includes(i.id)).length + A.warnings().filter(i => i.id === 'V21').length;
      return `<div class="inline"><span class="chip ${clash ? 'err' : 'ok'}">${U.icon(clash ? 'error' : 'check')}${clash ? `${clash} bentrok` : 'Tidak ada bentrok'}</span>
        <span class="hint">${esc(u.source || '')} · ${U.num((u.teams || []).length)} team · ${U.num((u.dbs || []).length)} DB</span><span class="spacer"></span>
        <button type="button" class="btn sm text" data-act="matchProject">Ganti</button><button type="button" class="btn sm text danger" data-act="matchClear">Hapus</button></div>`;
    },
    files(A) {
      if (!A.ui.showFiles) return '';
      const names = E.packageNames(A.r.cfg, A.r.files);
      if (!names.includes(A.ui.file)) A.ui.file = names.find(n => /B2/.test(n)) || names[0];
      const by = Object.fromEntries(A.r.files.map(f => [f.path, f]));
      const groups = new Map();
      for (const p of names) { const i = p.lastIndexOf('/'), f = i < 0 ? '' : p.slice(0, i); if (!groups.has(f)) groups.set(f, []); groups.get(f).push(p); }
      const tree = [...groups].map(([f, ps]) => (f ? `<div class="fold">${U.icon('folder', 'sm')}${esc(f)}</div>` : '') + ps.map(p => {
        const n = p.slice(p.lastIndexOf('/') + 1), fl = by[p];
        return `<button type="button" class="file${f ? '' : ' top'}" data-act="fileSel" data-path="${esc(p)}" aria-selected="${p === A.ui.file}"><span>${esc(n)}</span><small>${fl ? fl.module : ''}</small></button>`;
      }).join('')).join('');
      const p = A.ui.file, n = p.slice(p.lastIndexOf('/') + 1);
      let view;
      if (n.endsWith('.xlsx')) {
        const sheets = E.registerSheets(A.r.cfg, A.r.model, A.r.issues, A.r.files);
        view = `<div class="tbl"><table><thead><tr><th>Sheet</th><th class="num">Baris</th></tr></thead><tbody>${sheets.map(s => `<tr><td>${esc(s.name)}</td><td class="num">${U.num(s.rows.length - 1)}</td></tr>`).join('')}</tbody></table></div>`;
      } else {
        const lines = (textOf(p) || '').split(/\r?\n/), cap = 3000;
        view = `<pre class="code" id="codeView">${highlight(lines.slice(0, cap).join('\n'))}${lines.length > cap ? `\n<span class="c">… ${lines.length - cap} baris lagi</span>` : ''}</pre>`;
      }
      return `<div class="files-view"><div class="files" data-keep-scroll="files">${tree}</div>
        <div class="stack grow"><div class="inline"><b class="mono">${esc(p)}</b><span class="spacer"></span>
          ${n.endsWith('.xlsx') ? '' : `<button type="button" class="btn sm text" data-act="fileCopy">${U.icon('copy', 'sm')}Salin</button>`}
          <button type="button" class="btn sm text" data-act="fileDownload">${U.icon('download', 'sm')}Unduh file</button></div>${view}</div></div>`;
    },
  };

  U.screens[4] = {
    parts,
    select(A, loc) { if (loc.file) { A.ui.showFiles = true; A.ui.file = loc.file; } },
    render(A) {
      const steps = [['0', 'Team', 'Admin'], ['B1', 'DB + MDB', 'Admin'], ['B2', 'Site', 'Design'], ['B3', 'Zone', 'Design'], ['90', 'DB referensi', 'Admin'], ['99', 'Perbaiki MDB', 'opsional']];
      return `<div class="page">
        <div data-part="hero">${parts.hero(A)}</div>
        <section class="card"><h2>Jalankan di E3D</h2>
          <ol class="timeline">${steps.map(s => `<li><b class="mono">${s[0]}</b><span>${s[1]}</span><small class="${s[2] === 'Admin' ? 'adm' : s[2] === 'Design' ? 'des' : ''}">${s[2]}</small></li>`).join('')}</ol>
          <span class="hint">B1 → masuk ulang DESIGN → B2 → B3, diulang per baris. Lengkap di 00-README.txt.</span>
          <div class="note">Error acak <span class="mono">(43,41) Unable to open DB … MCD:6</span> saat CREATE DB: catat DB-nya, hapus di Admin bila rusak, buat ulang, lanjutkan (§7).</div></section>
        <div class="sums" data-part="summary">${parts.summary(A)}</div>
        <section class="card" data-loc="f:inUse"><div class="card-head"><h2>Cocokkan dengan project tujuan</h2><span class="hint">opsional</span></div><div data-part="match">${parts.match(A)}</div></section>
        <section class="card"><div class="card-head"><h2>Isi paket</h2><span class="spacer"></span>
          <button type="button" class="btn sm text" data-act="optsOpen">${U.icon('gear', 'sm')}Opsi paket</button>
          <button type="button" class="btn sm text" data-act="filesToggle" aria-expanded="${!!A.ui.showFiles}">${A.ui.showFiles ? 'Tutup' : 'Lihat file'}${U.icon('chev', 'sm')}</button></div>
          <div data-part="files">${parts.files(A)}</div></section>
      </div>`;
    },
  };

  U.act.filesToggle = () => { A.ui.showFiles = !A.ui.showFiles; U.renderScreen(); };
  U.act.fileSel = el => { A.ui.file = el.dataset.path; U.refresh(); };
  U.act.fileCopy = () => {
    const t = textOf(A.ui.file) || '';
    const fallback = () => { const r = document.createRange(); r.selectNodeContents(U.$('#codeView')); getSelection().removeAllRanges(); getSelection().addRange(r); U.toast('Teks dipilih: tekan Ctrl+C'); };
    try { navigator.clipboard.writeText(t).then(() => U.toast('Disalin'), fallback); } catch (e) { fallback(); }
  };
  U.act.fileDownload = async () => {
    const p = A.ui.file, n = p.slice(p.lastIndexOf('/') + 1);
    if (n.endsWith('.xlsx')) return U.download(new Blob([await E.xlsx.write(E.registerSheets(A.r.cfg, A.r.model, A.r.issues, A.r.files))], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), n);
    U.download(textOf(p), n, 'text/plain');
  };

  /* ⚙ Opsi paket */
  const optParts = {
    probs: () => U.problems(FILE_TPL.map(([k]) => 't:' + k)),
  };
  U.act.optsOpen = () => U.openSheet('Opsi paket', () => {
    const o = A.config.output || {};
    return `<div class="field"><label for="o-pkg">Nama ZIP</label><input id="o-pkg" class="mono" data-bind="project.packageName" value="${esc(A.config.project.packageName)}" spellcheck="false"></div>
      <h3>Isi</h3><div class="opts">${OPTS.map(([k, l]) => `<label><input type="checkbox" data-bind="output.${k}" ${o[k] ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
      <h3>Pembagian file</h3><div class="opts">
        <label><input type="radio" name="split" data-change="splitSet" value="perDiscipline" ${o.split !== 'perStep' ? 'checked' : ''}><span>Per baris (folder tiap disiplin)</span></label>
        <label><input type="radio" name="split" data-change="splitSet" value="perStep" ${o.split === 'perStep' ? 'checked' : ''}><span>Satu file per langkah (B1, B2, B3)</span></label></div>
      <h3>Nama file &amp; folder</h3>
      <div class="ftpl">${FILE_TPL.map(([k, l]) => `<label for="ft-${k}">${l}</label><input id="ft-${k}" class="input mono" data-bind="templates.${k}" data-loc="t:${k}" value="${esc(A.config.templates[k] || '')}" spellcheck="false">`).join('')}</div>
      <div class="chips" data-spart="probs">${optParts.probs()}</div>`;
  }, optParts);
  U.act.splitSet = el => A.mutate(c => { c.output.split = el.value; });
})(UI);
