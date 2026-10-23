/* Screen 5: Preview & validasi. Tiles, validation list (click to navigate), tree, MDB, register. */
(function (U) {
  'use strict';
  const E = E3D, A = U.App, esc = U.esc;
  const SEV = [['error', 'Error', 'error'], ['warning', 'Peringatan', 'warning'], ['info', 'Info', 'info']];
  const SCREEN = ['', 'Project', 'Attribute', 'Relasi', 'Template', 'Preview', 'Generate'];

  const parts = {
    tiles(A) {
      const c = A.r.counts, iss = A.r.issues;
      const n = s => iss.filter(i => i.severity === s).length;
      const t = [
        [n('error') ? 'bad' : 'good', 'Error', n('error'), n('error') ? 'Generate diblokir' : 'Generate aktif'],
        [n('warning') ? 'warn' : '', 'Peringatan', n('warning'), `+${n('info')} info`],
        ['', 'Team baru', c.teamsNew, `dari ${c.teamsNew + c.teamsExisting}`],
        ['', 'DB', c.dbs, `+${c.refsActive} referensi`],
        ['', 'Site', c.sites + c.separators, `${c.sites} + ${c.separators} separator`],
        ['', 'Zone', c.zones, `${(A.config.zoneRules || []).length} aturan`],
      ];
      return t.map(([cls, l, v, s]) => `<div class="tile ${cls}"><span class="l">${l}</span><span class="v">${U.num(v)}</span><span class="s">${s}</span></div>`).join('');
    },
    issues(A) {
      const f = A.ui.issueFilter || 'all';
      const list = A.r.issues.map((i, k) => [i, k]).filter(([i]) => f === 'all' || i.severity === f);
      if (!A.r.issues.length) return '<p class="hint">Tidak ada temuan.</p>';
      const seg = `<div class="seg" role="group" aria-label="Saring">${[['all', 'Semua'], ...SEV.map(s => [s[0], s[1]])].map(([v, l]) => {
        const n = v === 'all' ? A.r.issues.length : A.r.issues.filter(i => i.severity === v).length;
        return `<button type="button" data-act="issueFilter" data-v="${v}" aria-pressed="${f === v}">${l} ${n}</button>`;
      }).join('')}</div>`;
      const cap = 300, shown = list.slice(0, cap);
      return seg + `<div class="issues">${shown.map(([i, k]) => `<button type="button" class="issue ${i.severity}" data-act="issueGo" data-k="${k}">
          <span class="ic-wrap">${U.icon(SEV.find(s => s[0] === i.severity)[2])}</span>
          <span class="tx">${esc(i.message)}<br><span class="hint">${i.location && i.location.screen ? 'Buka ' + SCREEN[i.location.screen] : ''}</span></span>
          <span class="chip ref">${i.id}</span>${i.ref && i.ref !== '-' ? `<span class="chip ref">${esc(i.ref)}</span>` : ''}</button>`).join('')}</div>` +
        (list.length > cap ? `<p class="hint">… ${list.length - cap} temuan lagi (lengkap di sheet Validation pada register).</p>` : '');
    },
    tree(A) {
      const ds = A.r.model.disciplines;
      if (!ds.length) return '<p class="hint">Belum ada site.</p>';
      return `<div class="tree" data-keep-scroll="tree"><div>WORLD</div>${ds.map((dd, d) => {
        const nz = dd.cells.reduce((n, c) => n + c.zones.length, 0);
        return `<details data-d="${d}"><summary><b>${esc(dd.row.kode)}</b> ${esc(dd.row.desc)} <span class="cnt">${dd.cells.length} site · ${U.num(nz)} zone</span></summary><div data-lazy></div></details>`;
      }).join('')}</div>`;
    },
    mdb(A) {
      const by = new Map();
      for (const c of A.r.model.cells) { if (!by.has(c.mdb)) by.set(c.mdb, []); by.get(c.mdb).push([c.pos, c.db, 'DB']); }
      const m0 = A.config.combination.mdb;
      if (!by.has(m0)) by.set(m0, []);
      for (const r of A.config.referenceDbs || []) if (r.active) by.get(m0).push([r.pos, r.db, 'Referensi']);
      return [...by].map(([m, list]) => {
        list.sort((a, b) => (a[0] || 0) - (b[0] || 0));
        return `<div class="stack"><div class="inline"><b class="mono">${esc(m)}</b><span class="chip">${U.num(list.length)} member</span></div>
          <div class="tbl tall"><table><thead><tr><th class="num">Posisi</th><th>DB</th><th>Jenis</th></tr></thead><tbody>
          ${list.map(([p, db, k]) => `<tr><td class="num mono">${p === null ? '?' : p}</td><td class="mono">${esc(db)}</td><td class="hint">${k}</td></tr>`).join('')}</tbody></table></div></div>`;
      }).join('');
    },
    reg(A) {
      const ds = A.r.model.disciplines;
      if (!ds.length) return '<p class="hint">Belum ada DB.</p>';
      let dd = ds.find(d => d.row.kode === A.ui.regTab);
      if (!dd) { dd = ds[0]; A.ui.regTab = dd.row.kode; }
      return `<div class="inline"><div class="tabs" role="tablist">${ds.map(d => `<button type="button" role="tab" class="tab" data-act="regTab" data-k="${esc(d.row.kode)}" aria-selected="${d === dd}">${esc(d.row.kode)}</button>`).join('')}</div>
        <input class="input" style="width:220px;height:32px;margin-left:auto" data-input="regSearch" id="regSearch" placeholder="Cari DB, site, deskripsi" aria-label="Cari"></div>
        <div class="tbl tall"><table id="regTbl"><thead><tr><th>DB</th><th class="num">DBNO</th><th class="num">ADD n</th><th>Site</th><th>Deskripsi</th><th class="num">Zone</th></tr></thead><tbody>
        ${dd.cells.map(c => `<tr><td class="mono">${esc(c.db)}</td><td class="num mono">${c.dbno === null ? '?' : c.dbno}</td><td class="num mono">${c.pos === null ? '?' : c.pos}</td><td class="mono">${esc(c.site)}</td><td>${esc(c.desc)}</td><td class="num">${c.zones.length}</td></tr>`).join('')}
        </tbody></table></div>`;
    },
  };

  function fillTree(details) {
    const lazy = U.$(':scope > [data-lazy]', details);
    if (!lazy || lazy.dataset.done) return;
    lazy.dataset.done = '1';
    if (details.dataset.d !== undefined) {
      const dd = A.r.model.disciplines[+details.dataset.d];
      lazy.innerHTML = E.siteOrder(dd).map(s => s.kind !== 'site' ? `<div class="sepn">${esc(s.name)} <span class="cnt">separator</span></div>`
        : s.cell.zones.length ? `<details data-ci="${dd.cells.indexOf(s.cell)}" data-dd="${details.dataset.d}"><summary>${esc(s.name)} <span class="cnt">${s.cell.zones.length} zone · ${esc(s.db)}</span></summary><div data-lazy></div></details>`
          : `<div class="sepn" style="color:inherit">${esc(s.name)} <span class="cnt">${esc(s.db)}</span></div>`).join('');
    } else {
      const c = A.r.model.disciplines[+details.dataset.dd].cells[+details.dataset.ci];
      lazy.innerHTML = c.zones.slice(0, 1000).map(z => `<div class="leaf">${esc(z)}</div>`).join('') + (c.zones.length > 1000 ? `<div class="leaf">… ${c.zones.length - 1000} lagi</div>` : '');
    }
  }

  U.screens[5] = {
    title: 'Preview & validasi',
    sub: 'Hasil akhir sebelum file dibuat. Error memblokir Generate; peringatan tidak.',
    parts,
    headAction: A => `<button class="btn filled" type="button" data-act="go" data-screen="6" ${A.errors().length ? 'disabled title="Perbaiki error dulu"' : ''}>Lanjut ke Generate ${U.icon('next')}</button>`,
    render(A) {
      return `<div class="tiles" data-part="tiles">${parts.tiles(A)}</div>
        <section class="card"><h2>Validasi</h2><div class="stack" data-part="issues">${parts.issues(A)}</div><span class="hint">Klik temuan untuk membuka layar dan sel terkait. Nomor di chip = aturan (V..) dan fakta di RULES.md.</span></section>
        <div class="row">
          <section class="card"><h2>Tree (Model Explorer)</h2><div data-part="tree" id="treeBox">${parts.tree(A)}</div></section>
          <section class="card"><h2>MDB</h2><div class="stack" data-part="mdb">${parts.mdb(A)}</div></section>
        </div>
        <section class="card"><h2>Register DB</h2><div class="stack" data-part="reg">${parts.reg(A)}</div></section>`;
    },
    mount(root) {
      const box = U.$('#treeBox', root);
      if (box) box.addEventListener('toggle', ev => { if (ev.target.open) fillTree(ev.target); }, true);
    },
  };

  U.act.issueFilter = el => { A.ui.issueFilter = el.dataset.v; U.refresh(); };
  U.act.issueGo = el => { const i = A.r.issues[+el.dataset.k]; if (i && i.location && i.location.screen) U.go(i.location.screen, i.location); };
  U.act.regTab = el => { A.ui.regTab = el.dataset.k; U.refresh(); };
  U.act.regSearch = el => {
    const q = el.value.toLowerCase();
    for (const tr of U.$$('#regTbl tbody tr')) tr.hidden = !!q && !tr.textContent.toLowerCase().includes(q);
  };
})(UI);
