/* Screen 6: Generate. Package options, file tree with preview, ZIP and single-file download, run order. */
(function (U) {
  'use strict';
  const E = E3D, A = U.App, esc = U.esc;
  const OPTS = [
    ['includeReadme', 'README', '00-README.txt: urutan jalan, peringatan, jumlah'],
    ['includeRegister', 'Register .xlsx', 'DB register, site order, zone, validasi, attribute'],
    ['includeConfig', 'config.json', 'untuk dibuka lagi di tool ini'],
    ['includeReference', '90-REFERENCE', 'ADD DB referensi ke MDB'],
    ['includeFixup', '99-FIXUP', 'CURRENT semua DB (hanya bila urutan MDB salah)'],
    ['includeExistingTeamsBlock', 'Blok team yang sudah ada', 'dikomentari di 00-TEAMS'],
  ];

  function entries(A) {
    const names = E.packageNames(A.r.cfg, A.r.files);
    const byPath = Object.fromEntries(A.r.files.map(f => [f.path, f]));
    return names.map(p => ({ path: p, file: byPath[p] || null }));
  }
  function textOf(A, path) {
    const f = A.r.files.find(x => x.path === path);
    if (f) return f.text;
    if (path === '00-README.txt') return E.readme(A.r.cfg, A.r.model, A.r.issues, A.r.files, new Date());
    if (path === 'config.json') return E.exportJson(A.config);
    return null;
  }
  const KW = /^(NEW SITE|NEW ZONE|CREATE TEAM|CREATE DB|SET MDB|SET TEAM|TADD|ADD|CURRENT|SAVEWORK)\b(.*)$/;
  const highlight = text => text.split(/\r?\n/).map(l => {
    if (l.startsWith('$*')) return `<span class="c">${esc(l)}</span>`;
    const m = l.match(KW);
    return m ? `<span class="k">${esc(m[1])}</span>${esc(m[2])}` : esc(l);
  }).join('\n');

  const parts = {
    files(A) {
      const list = entries(A);
      if (!list.some(e => e.path === A.ui.file)) A.ui.file = (list.find(e => e.file && /B2/.test(e.file.step)) || list[0] || {}).path;
      const out = [], folders = new Map();
      for (const e of list) {
        const i = e.path.lastIndexOf('/');
        const folder = i < 0 ? '' : e.path.slice(0, i);
        if (!folders.has(folder)) folders.set(folder, []);
        folders.get(folder).push(e);
      }
      for (const [folder, es] of folders) {
        if (folder) out.push(`<div class="fold">${U.icon('folder', 'sm')}${esc(folder)}/</div>`);
        for (const e of es) {
          const name = e.path.slice(e.path.lastIndexOf('/') + 1);
          const meta = e.file ? `${e.file.module} · ${U.num(e.file.text.split('\n').length - 1)} baris` : name.endsWith('.xlsx') ? 'Excel' : name.endsWith('.json') ? 'JSON' : 'teks';
          out.push(`<button type="button" class="file${folder ? '' : ' top'}" data-act="fileSel" data-path="${esc(e.path)}" aria-selected="${e.path === A.ui.file}"><span>${esc(name)}</span><span>${meta}</span></button>`);
        }
      }
      return out.join('');
    },
    preview(A) {
      const p = A.ui.file;
      if (!p) return '<p class="hint">Tidak ada file.</p>';
      const name = p.slice(p.lastIndexOf('/') + 1);
      let body;
      if (name.endsWith('.xlsx')) {
        const sheets = E.registerSheets(A.r.cfg, A.r.model, A.r.issues, A.r.files);
        body = `<div class="tbl"><table><thead><tr><th>Sheet</th><th class="num">Baris data</th><th>Kolom</th></tr></thead><tbody>${sheets.map(s => `<tr><td>${esc(s.name)}</td><td class="num">${U.num(s.rows.length - 1)}</td><td class="hint">${esc(s.rows[0].join(', '))}</td></tr>`).join('')}</tbody></table></div>`;
      } else {
        const t = textOf(A, p) || '';
        const lines = t.split(/\r?\n/);
        const cap = 4000;
        body = `<pre class="code" id="codeView" data-keep-scroll="code">${highlight(lines.slice(0, cap).join('\n'))}${lines.length > cap ? `\n<span class="c">… ${lines.length - cap} baris lagi (unduh file untuk melihat semua)</span>` : ''}</pre>`;
      }
      return `<div class="card-head"><b class="mono" style="font-size:13px;overflow-wrap:anywhere">${esc(p)}</b><div class="inline">
          ${name.endsWith('.xlsx') ? '' : `<button class="btn sm outlined" type="button" data-act="fileCopy">${U.icon('copy')}Salin</button>`}
          <button class="btn sm outlined" type="button" data-act="fileDownload">${U.icon('download')}Unduh file ini</button></div></div>${body}`;
    },
    summary(A) {
      const n = A.r.files.length, errs = A.errors().length, o = A.config.output;
      const extra = [o.includeReadme && 'README', o.includeRegister && 'register', o.includeConfig && 'config.json'].filter(Boolean);
      return `<button class="btn filled" type="button" data-act="generateZip" ${errs ? 'disabled' : ''}>${U.icon('download')}Unduh ZIP</button>
        <span class="hint">${n} file .mac${extra.length ? ' · ' + extra.join(' · ') : ''}</span>
        ${errs ? `<span class="chip err">${U.icon('error')}${errs} error · perbaiki di Preview & validasi</span>` : ''}
        ${E.canDeflate() ? '' : '<span class="chip warn">Browser tanpa CompressionStream: ZIP tanpa kompresi</span>'}`;
    },
  };

  U.screens[6] = {
    title: 'Generate',
    sub: 'Pilih isi paket, periksa isi file, unduh ZIP, lalu jalankan di E3D sesuai urutan.',
    parts,
    select(A, loc) { if (loc.file) A.ui.file = loc.file; },
    render(A) {
      const o = A.config.output || {};
      return `<div class="split">
        <aside class="side card" aria-label="Opsi paket">
          <h2>Opsi paket</h2>
          <div class="field"><label for="pkgName">Nama ZIP</label><input id="pkgName" class="mono" data-bind="project.packageName" value="${esc(A.config.project.packageName)}" spellcheck="false"></div>
          <div class="opts"><span class="hint">Sertakan</span>${OPTS.map(([k, l, s]) => `<label for="o-${k}"><input type="checkbox" id="o-${k}" data-bind="output.${k}" ${o[k] ? 'checked' : ''}><span>${l}<small>${s}</small></span></label>`).join('')}</div>
          <div class="opts"><span class="hint">Pembagian file</span>
            <label for="sp1"><input type="radio" name="split" id="sp1" data-change="splitSet" value="perDiscipline" ${o.split !== 'perStep' ? 'checked' : ''}><span>Per baris (disiplin)<small>B1, B2, B3 di folder tiap baris</small></span></label>
            <label for="sp2"><input type="radio" name="split" id="sp2" data-change="splitSet" value="perStep" ${o.split === 'perStep' ? 'checked' : ''}><span>Satu file per langkah<small>B1, B2, B3 untuk semua baris, berurutan</small></span></label></div>
          <div class="stack" data-part="summary">${parts.summary(A)}</div>
        </aside>
        <div class="grow">
          <div class="row" style="align-items:flex-start">
            <section class="card" style="flex:1 1 260px"><h2>Isi ZIP</h2><div class="files" data-part="files">${parts.files(A)}</div></section>
            <section class="card" style="flex:2 1 420px" data-part="preview">${parts.preview(A)}</section>
          </div>
          <section class="card"><h2>Urutan jalan di E3D</h2><span class="hint">Ikut tertulis di 00-README.txt dan sheet Setup Steps.</span>
            <div class="tbl"><table><thead><tr><th>Step</th><th>Isi</th><th>File</th><th>Modul</th><th>Cek</th></tr></thead><tbody>
            ${E.RUN_ORDER.map(r => `<tr><td class="mono"><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td class="mono">${esc(r[2])}</td><td>${esc(r[3])}</td><td>${esc(r[4])}</td></tr>`).join('')}</tbody></table></div>
            <div class="note"><b>Known issue (§7):</b> <span class="mono">(43,41) Unable to open DB … MCD:6 The handle is invalid</span> muncul acak saat CREATE DB. Catat DB-nya, hapus di Admin bila rusak, buat ulang, lanjutkan.</div>
          </section>
        </div></div>`;
    },
  };

  U.act.fileSel = el => { A.ui.file = el.dataset.path; U.refresh(); };
  U.act.splitSet = el => A.mutate(c => { c.output.split = el.value; });
  U.act.fileCopy = el => {
    const t = textOf(A, A.ui.file) || '';
    const fallback = () => { const r = document.createRange(); r.selectNodeContents(U.$('#codeView')); getSelection().removeAllRanges(); getSelection().addRange(r); U.toast('Teks dipilih: tekan Ctrl+C'); };
    try { navigator.clipboard.writeText(t).then(() => U.toast('Disalin ke clipboard'), fallback); } catch (e) { fallback(); }
  };
  U.act.fileDownload = async () => {
    const p = A.ui.file, name = p.slice(p.lastIndexOf('/') + 1);
    if (name.endsWith('.xlsx')) {
      const x = await E.xlsx.write(E.registerSheets(A.r.cfg, A.r.model, A.r.issues, A.r.files));
      return U.download(new Blob([x], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), name);
    }
    U.download(textOf(A, p), name, 'text/plain');
  };
})(UI);
