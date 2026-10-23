/* App state, autosave, undo, shell (app bar + step navigation), binding and navigation. */
(function (U) {
  'use strict';
  const E = E3D;
  const KEY = 'e3d-setup-generator/v1';
  const STEPS = ['Project', 'Attribute', 'Relasi & kombinasi', 'Template', 'Preview & validasi', 'Generate'];

  const A = U.App = {
    config: null, r: null, idx: new Map(), hist: [], fut: [], savedAt: null, storageOk: true, dirty: false,
    ui: { screen: 1, attr: null, attrQuery: '', orderTab: null, file: null, regTab: null, regQuery: '', tplRaw: {}, issueFilter: 'all' },
  };
  U.screens = {};
  U.act = {};

  /* ---------- State ---------- */
  A.load = function () {
    const saved = U.store.get(KEY);
    A.storageOk = U.store.set(KEY + '/probe', 1);
    U.store.del(KEY + '/probe');
    if (saved && saved.config && !E.checkSchema(saved.config).length) {
      A.config = E.migrate(saved.config).config;
      Object.assign(A.ui, saved.ui || {});
      A.savedAt = saved.savedAt ? new Date(saved.savedAt) : null;
    } else A.config = E.emptyConfig();
  };
  A.recompute = function () {
    A.r = E.compute(A.config);
    A.idx = new Map();
    for (const i of A.r.issues) for (const k of U.locKeys(i.location)) {
      if (!A.idx.has(k)) A.idx.set(k, []);
      A.idx.get(k).push(i);
    }
  };
  A.errors = () => A.r.issues.filter(i => i.severity === 'error');
  A.save = U.debounce(() => {
    A.savedAt = new Date();
    A.storageOk = U.store.set(KEY, { config: A.config, ui: { screen: A.ui.screen, attr: A.ui.attr, orderTab: A.ui.orderTab }, savedAt: A.savedAt.toISOString() });
    U.renderNavFoot();
  }, 400);
  A.snapshot = function () {
    A.hist.push(JSON.stringify(A.config));
    if (A.hist.length > 100) A.hist.shift();
    A.fut = [];
  };
  // Structural change: snapshot, apply, recompute, full screen render.
  A.mutate = function (fn) {
    A.snapshot();
    fn(A.config);
    A.recompute(); A.save();
    U.renderScreen(); U.renderChrome();
  };
  // Typing: one snapshot per burst, recompute after a pause, refresh derived parts only.
  const settle = U.debounce(() => { A.dirty = false; A.recompute(); A.save(); U.refresh(); }, 300);
  A.touch = function () {
    if (!A.dirty) { A.snapshot(); A.dirty = true; }
    settle();
  };
  A.flush = function () { if (A.dirty) { A.dirty = false; A.recompute(); A.save(); } };
  A.replace = function (config, keepUi) {
    A.snapshot();
    A.config = config;
    if (!keepUi) Object.assign(A.ui, { attr: null, orderTab: null, file: null, regTab: null, tplRaw: {} });
    A.recompute(); A.save();
    U.renderScreen(); U.renderChrome();
  };
  A.undo = function () {
    A.flush();
    if (!A.hist.length) return U.toast('Tidak ada yang bisa dibatalkan');
    A.fut.push(JSON.stringify(A.config));
    A.config = JSON.parse(A.hist.pop());
    A.recompute(); A.save(); U.renderScreen(); U.renderChrome();
  };
  A.redo = function () {
    if (!A.fut.length) return;
    A.hist.push(JSON.stringify(A.config));
    A.config = JSON.parse(A.fut.pop());
    A.recompute(); A.save(); U.renderScreen(); U.renderChrome();
  };

  /* ---------- Issue locations ---------- */
  U.locKeys = function (loc) {
    const k = [];
    if (!loc) return k;
    if (loc.screen) k.push('s' + loc.screen);
    if (loc.attributeId) {
      k.push('a:' + loc.attributeId);
      if (loc.rowIndex !== undefined && loc.column) k.push(`c:${loc.attributeId}:${loc.rowIndex}:${loc.column}`);
    }
    if (loc.template) k.push('t:' + loc.template);
    let zi = loc.zoneRule;
    if (zi === undefined && loc.zoneRuleId) zi = (A.config.zoneRules || []).findIndex(r => r.id === loc.zoneRuleId);
    if (zi !== undefined && zi >= 0) k.push('z:' + zi);
    if (loc.refIndex !== undefined) k.push('r:' + loc.refIndex);
    if (loc.field) k.push('f:' + loc.field);
    if (loc.cell) k.push(`m:${loc.cell[0]}:${loc.cell[1]}`);
    if (loc.order) k.push('o:' + loc.order);
    if (loc.file) k.push('file:' + loc.file);
    return k;
  };
  U.issuesAt = (key, sev) => (A.idx.get(key) || []).filter(i => !sev || i.severity === sev);

  // Red outline + tooltip on every element whose data-loc has errors.
  U.markIssues = function (root) {
    for (const el of U.$$('[data-loc]', root || U.$('#main'))) {
      const errs = U.issuesAt(el.dataset.loc, 'error');
      el.classList.toggle('bad', errs.length > 0);
      if (errs.length) el.title = errs.slice(0, 5).map(i => `${i.id} (${i.ref}): ${i.message}`).join('\n');
      else if (el.title && el.dataset.loc) el.removeAttribute('title');
    }
  };

  /* ---------- Shell ---------- */
  U.buildShell = function () {
    document.body.innerHTML = `
      <header class="bar">
        <div class="brand">${U.LOGO}<span>E3D Setup Generator</span></div>
        <span class="ctx" id="ctx"></span>
        <span class="spacer"></span>
        <div class="actions">
          <button class="icon-btn" type="button" data-act="undo" aria-label="Batalkan (Ctrl+Z)" title="Batalkan (Ctrl+Z)">${U.icon('undo')}</button>
          <button class="icon-btn" type="button" data-act="redo" aria-label="Ulangi (Ctrl+Y)" title="Ulangi (Ctrl+Y)">${U.icon('redo')}</button>
          <button class="icon-btn" type="button" data-act="theme" id="themeBtn" aria-label="Tema">${U.icon('theme')}</button>
          <button class="btn outlined" type="button" data-act="importJson">${U.icon('upload')}Import JSON</button>
          <button class="btn outlined" type="button" data-act="exportJson">${U.icon('download')}Export JSON</button>
          <button class="btn filled" type="button" data-act="generateZip" id="genBtn">${U.icon('download')}Generate ZIP</button>
        </div>
      </header>
      <div class="layout">
        <nav class="nav" aria-label="Langkah" id="nav"></nav>
        <main id="main" tabindex="-1"></main>
      </div>`;
    const body = document.body;
    body.addEventListener('click', onClick);
    body.addEventListener('input', onInput);
    body.addEventListener('change', onChange);
    body.addEventListener('focusin', ev => { if (ev.target.matches('[data-bind]')) ev.target.dataset.old = ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value; });
    document.addEventListener('keydown', ev => {
      const typing = ev.target.matches('input, textarea, select');
      if ((ev.ctrlKey || ev.metaKey) && !typing && ev.key.toLowerCase() === 'z') { ev.preventDefault(); ev.shiftKey ? A.redo() : A.undo(); }
      if ((ev.ctrlKey || ev.metaKey) && !typing && ev.key.toLowerCase() === 'y') { ev.preventDefault(); A.redo(); }
    });
    // Drop a config.json or Export Config .xlsx anywhere on the page.
    body.addEventListener('dragover', ev => { if (ev.dataTransfer && [...ev.dataTransfer.types].includes('Files')) { ev.preventDefault(); body.classList.add('dropping'); } });
    body.addEventListener('dragleave', ev => { if (!ev.relatedTarget) body.classList.remove('dropping'); });
    body.addEventListener('drop', ev => {
      body.classList.remove('dropping');
      const f = ev.dataTransfer && ev.dataTransfer.files[0];
      if (!f) return;
      ev.preventDefault();
      if (/\.json$/i.test(f.name)) U.importConfigFile(f);
      else if (/\.xlsx$/i.test(f.name)) U.importExportConfigFile(f);
      else U.toast('Jatuhkan file config.json atau Export Config .xlsx', 'error');
    });
  };

  U.renderChrome = function () {
    const c = A.config, errs = A.errors().length;
    U.$('#ctx').textContent = `${c.project.code || '-'} · ${(c.combination || {}).mdb || '-'}`;
    const gen = U.$('#genBtn');
    gen.disabled = errs > 0;
    gen.title = errs ? `${errs} error harus diperbaiki dulu (lihat Preview & validasi)` : 'Buat dan unduh paket ZIP';
    U.$('[data-act="undo"]').disabled = !A.hist.length;
    U.$('[data-act="redo"]').disabled = !A.fut.length;
    const per = n => A.r.issues.filter(i => i.severity === 'error' && i.location && i.location.screen === n).length;
    U.$('#nav').innerHTML = STEPS.map((s, i) => {
      const n = i + 1, cur = n === A.ui.screen, e = n >= 5 ? errs : per(n);
      const cls = e ? 'bad' : 'done';
      const mark = cur ? n : e ? '!' : '✓';
      return `<button type="button" class="step ${cur ? '' : cls}" data-act="go" data-screen="${n}" ${cur ? 'aria-current="page"' : ''} title="${e ? e + ' error' : 'Tidak ada error'}"><span class="n">${mark}</span>${U.esc(s)}</button>`;
    }).join('') + '<div class="foot" id="navFoot"></div>';
    U.renderNavFoot();
  };
  U.renderNavFoot = function () {
    const f = U.$('#navFoot');
    if (!f) return;
    const t = A.savedAt ? A.savedAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : null;
    f.innerHTML = `<span>${A.storageOk ? (t ? `Tersimpan otomatis · ${t}` : 'Simpan otomatis aktif') : 'Penyimpanan lokal diblokir: pakai Export JSON'}</span>
      <span class="mono">v${E.VERSION} · skema ${E.SCHEMA_VERSION}</span>`;
  };

  // Full render of the current screen, keeping scroll position and focus.
  U.renderScreen = function () {
    const main = U.$('#main'), scr = U.screens[A.ui.screen];
    const act = document.activeElement;
    const focusKey = act && main.contains(act) ? (act.dataset.bind || act.id) : null;
    const sel = act && 'selectionStart' in act ? [act.selectionStart, act.selectionEnd] : null;
    const y = window.scrollY;
    const keepScroll = U.$$('[data-keep-scroll]', main).map(el => [el.dataset.keepScroll, el.scrollTop, el.scrollLeft]);
    main.innerHTML = `<div class="page-head"><div><h1>${U.esc(scr.title)}</h1><p>${scr.sub}</p></div>${scr.headAction ? scr.headAction(A) : ''}</div>` + scr.render(A);
    if (scr.mount) scr.mount(main, A);
    U.markIssues(main);
    window.scrollTo(0, y);
    for (const [k, t, l] of keepScroll) { const el = U.$(`[data-keep-scroll="${k}"]`, main); if (el) { el.scrollTop = t; el.scrollLeft = l; } }
    if (focusKey) {
      const el = U.$(`[data-bind="${CSS.escape(focusKey)}"]`, main) || document.getElementById(focusKey);
      if (el) { el.focus({ preventScroll: true }); if (sel && 'setSelectionRange' in el) try { el.setSelectionRange(sel[0], sel[1]); } catch (e) { /* not a text input */ } }
    }
  };
  // Refresh derived parts (counts, samples, checks) without touching inputs.
  U.refresh = function () {
    const main = U.$('#main'), scr = U.screens[A.ui.screen];
    for (const el of U.$$('[data-part]', main)) {
      const fn = scr.parts && scr.parts[el.dataset.part];
      if (fn) el.innerHTML = fn(A, el);
    }
    U.markIssues(main);
    U.renderChrome();
  };

  U.go = function (screen, loc) {
    A.flush();
    A.ui.screen = screen;
    const scr = U.screens[screen];
    if (loc && scr.select) scr.select(A, loc);
    U.renderScreen(); U.renderChrome(); A.save();
    if (!loc) { window.scrollTo(0, 0); U.$('#main').focus({ preventScroll: true }); return; }
    const keys = U.locKeys(loc).reverse();
    for (const k of keys) {
      const el = U.$(`[data-loc="${CSS.escape(k)}"]`, U.$('#main'));
      if (!el) continue;
      el.scrollIntoView({ block: 'center' });
      const row = el.closest('tr') || el;
      row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash');
      const inp = el.matches('input, select, textarea, button') ? el : U.$('input, select, textarea', el);
      if (inp) inp.focus({ preventScroll: true });
      return;
    }
    window.scrollTo(0, 0);
  };

  /* ---------- Events ---------- */
  function readValue(el) {
    const t = el.dataset.t;
    if (el.type === 'checkbox') return el.checked;
    let v = el.value;
    if (t === 'upper') { const p = el.selectionStart; v = v.toUpperCase(); if (el.value !== v) { el.value = v; try { el.setSelectionRange(p, p); } catch (e) { /* ignore */ } } }
    if (t === 'int') return /^\s*-?\d+\s*$/.test(v) ? parseInt(v, 10) : v.trim() === '' ? null : v;
    if (t === 'list') return v.split(/[,;\s]+/).filter(Boolean);
    return v;
  }
  function onInput(ev) {
    const el = ev.target;
    if (el.dataset.input && U.act[el.dataset.input]) return U.act[el.dataset.input](el, ev);
    if (!el.matches('[data-bind]') || el.type === 'checkbox' || el.tagName === 'SELECT') return;
    U.setPath(A.config, el.dataset.bind, readValue(el));
    A.touch();
  }
  function onChange(ev) {
    const el = ev.target;
    if (el.matches('[data-bind]') && (el.type === 'checkbox' || el.type === 'radio' || el.tagName === 'SELECT')) {
      const path = el.dataset.bind, v = readValue(el);
      if (el.dataset.on && U.act[el.dataset.on]) return U.act[el.dataset.on](el, ev, v);
      return A.mutate(c => U.setPath(c, path, v));
    }
    if (el.matches('[data-bind]') && el.dataset.on && U.act[el.dataset.on]) U.act[el.dataset.on](el, ev, readValue(el));
    else if (el.matches('[data-change]') && U.act[el.dataset.change]) U.act[el.dataset.change](el, ev);
  }
  function onClick(ev) {
    const el = ev.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const fn = U.act[el.dataset.act];
    if (fn) { ev.preventDefault(); fn(el, ev); }
  }

  /* ---------- Global actions ---------- */
  U.act.go = el => U.go(parseInt(el.dataset.screen, 10));
  U.act.undo = () => A.undo();
  U.act.redo = () => A.redo();
  U.act.exportJson = () => {
    A.flush();
    U.download(E.exportJson(A.config), 'config.json', 'application/json');
    U.toast('config.json diunduh');
  };
  U.act.importJson = async () => { const f = await U.pickFile('.json,application/json'); if (f) U.importConfigFile(f); };
  U.act.generateZip = () => {
    A.flush();
    if (A.errors().length) { U.toast(`${A.errors().length} error harus diperbaiki dulu`, 'error'); return U.go(5); }
    U.downloadZip();
  };

  U.importConfigFile = async function (file) {
    let data;
    try { data = JSON.parse(await U.readText(file)); } catch (e) { return U.toast(`${file.name}: bukan JSON yang valid (${e.message})`, 'error'); }
    const errs = E.checkSchema(data);
    if (errs.length) {
      return U.dialog({ title: 'Config tidak bisa dibuka', body: `<p>${U.esc(file.name)}</p><ul>${errs.map(e => `<li>${U.esc(e)}</li>`).join('')}</ul>` });
    }
    const { config, notes } = E.migrate(data);
    const r = E.compute(config), c = r.counts;
    const nErr = r.issues.filter(i => i.severity === 'error').length;
    const ok = await U.dialog({
      title: 'Import config.json',
      body: `<p><b>${U.esc(file.name)}</b> · project <span class="mono">${U.esc(config.project.code)}</span> ${U.esc(config.project.name)}</p>
        <div class="tiles">${[['Attribute', config.attributes.length], ['Aturan zone', config.zoneRules.length], ['DB', c.dbs], ['Site', c.sites + c.separators], ['Zone', c.zones], ['DB referensi', c.refsActive]]
          .map(([l, v]) => `<div class="tile"><span class="l">${l}</span><span class="v">${U.num(v)}</span></div>`).join('')}</div>
        ${notes.length ? `<p>Migrasi skema:</p><ul>${notes.map(n => `<li>${U.esc(n)}</li>`).join('')}</ul>` : ''}
        <p>${nErr ? `${nErr} error validasi perlu diperbaiki setelah import.` : 'Tanpa error validasi.'} Konfigurasi saat ini akan diganti (bisa dibatalkan dengan Ctrl+Z).</p>`,
      actions: [{ label: 'Batal', value: false }, { label: 'Lanjut', value: true, kind: 'filled' }],
    });
    if (!ok) return;
    A.replace(config);
    U.toast(`${file.name} dimuat`);
  };

  U.buildPackage = async function () {
    const r = A.r, o = A.config.output || {}, date = new Date();
    const entries = [];
    if (o.includeReadme) entries.push({ path: '00-README.txt', data: E.readme(r.cfg, r.model, r.issues, r.files, date) });
    for (const f of r.files) entries.push({ path: f.path, data: f.text });
    if (o.includeRegister) entries.push({ path: E.render(r.cfg, A.config.templates.registerFile, {}), data: await E.xlsx.write(E.registerSheets(r.cfg, r.model, r.issues, r.files)) });
    if (o.includeConfig) entries.push({ path: 'config.json', data: E.exportJson(A.config) });
    return entries;
  };
  U.downloadZip = async function () {
    try {
      const entries = await U.buildPackage();
      const zip = await E.zip.write(entries);
      const name = A.config.project.packageName || 'E3D-SETUP-PACKAGE.zip';
      U.download(new Blob([zip], { type: 'application/zip' }), name);
      U.toast(`${name} diunduh · ${entries.length} file${E.canDeflate() ? '' : ' (tanpa kompresi)'}`);
    } catch (e) {
      U.toast('Gagal membuat ZIP: ' + e.message, 'error');
    }
  };

  /* ---------- Theme (MD3 dynamic color) ---------- */
  const SEED = '#00658A';                        // primary from the approved mockups
  const EXT = { ok: '#2E7D32', warn: '#B58100' }; // extended roles: success, warning
  let ext = null;
  U.paintTheme = function () {
    if (typeof MD3 === 'undefined') return;
    const mode = MD3.getTheme();
    const root = document.documentElement.style;
    for (const [k, s] of Object.entries(ext || {})) {
      root.setProperty(`--app-${k}-container`, s[mode]['primary-container']);
      root.setProperty(`--app-on-${k}-container`, s[mode]['on-primary-container']);
    }
  };
  U.initTheme = function () {
    if (typeof MD3 === 'undefined') return;
    MD3.applySeed(SEED, { style: 'tonalSpot' });
    ext = Object.fromEntries(Object.entries(EXT).map(([k, v]) => [k, MD3.schemeFromSeed(v, 'tonalSpot')]));
    const mode = U.store.get(KEY + '/theme') || 'system';
    MD3.setTheme(mode);
    U.paintTheme();
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', U.paintTheme);
    U.updateThemeBtn(mode);
  };
  U.updateThemeBtn = mode => {
    const b = U.$('#themeBtn');
    if (b) b.title = `Tema: ${{ system: 'ikuti sistem', light: 'terang', dark: 'gelap' }[mode]} (klik untuk ganti)`;
    if (b) b.setAttribute('aria-label', b.title);
  };
  U.act.theme = () => {
    const order = ['system', 'light', 'dark'];
    const cur = U.store.get(KEY + '/theme') || 'system', next = order[(order.indexOf(cur) + 1) % 3];
    U.store.set(KEY + '/theme', next);
    MD3.setTheme(next);
    U.paintTheme();
    U.updateThemeBtn(next);
    U.toast(`Tema: ${{ system: 'ikuti sistem', light: 'terang', dark: 'gelap' }[next]}`);
  };

  /* ---------- Shared bits for screens ---------- */
  U.chipsFor = function (key, okText) {
    const iss = A.idx.get(key) || [];
    const errs = iss.filter(i => i.severity === 'error'), warns = iss.filter(i => i.severity === 'warning');
    const out = [];
    const seen = new Set();
    for (const i of [...errs, ...warns]) {
      const k = i.id + i.message;
      if (seen.has(k) || seen.size >= 6) continue;
      seen.add(k);
      out.push(`<span class="chip ${i.severity === 'error' ? 'err' : 'warn'}" title="${U.esc(i.message)}">${U.icon(i.severity === 'error' ? 'error' : 'warning')}${U.esc(i.message)}<span class="chip ref">${i.id}${i.ref && i.ref !== '-' ? ' · ' + i.ref : ''}</span></span>`);
    }
    if (errs.length + warns.length > seen.size) out.push(`<span class="chip">+${errs.length + warns.length - seen.size} lainnya</span>`);
    if (!out.length && okText) out.push(...[].concat(okText).map(t => `<span class="chip ok">${U.icon('check')}${t}</span>`));
    return out.join('');
  };
  U.attrOptions = (selected, filter) => (A.config.attributes || []).filter(a => !filter || filter(a))
    .map(a => `<option value="${U.esc(a.id)}" ${a.id === selected ? 'selected' : ''}>${U.esc(a.name)}</option>`).join('');
})(UI);
