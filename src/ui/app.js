/* App state, autosave, undo, shell (bar, stepper, status, side panel, footer), binding and navigation.
   Flow: 0 Mulai -> 1 Daftar -> 2 Susunan -> 3 Nama -> 4 Cek & Unduh (docs: redesign plan). */
(function (U) {
  'use strict';
  const E = E3D;
  const KEY = 'e3d-setup-generator/v1';
  U.KEY = KEY;
  U.STEPS = ['Daftar', 'Susunan', 'Nama', 'Cek & Unduh'];
  const HINT = ['', 'Isi daftar. Seret file Excel/CSV ke tabel.', 'Seret untuk mengatur urutan dan grup.', 'Seret blok untuk menyusun nama.', 'Periksa, lalu unduh.'];

  const A = U.App = {
    config: null, r: null, idx: new Map(), hist: [], fut: [], savedAt: null, storageOk: true, dirty: false, hadSaved: false,
    ui: { screen: 0, list: null, listQuery: '', name: 'site', tree: null, side: null, file: null, showFiles: false, raw: {} },
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
      const ui = saved.ui || {};
      A.ui.screen = ui.screen >= 1 && ui.screen <= 4 ? ui.screen : 0;
      for (const k of ['list', 'name', 'tree', 'side']) if (ui[k] !== undefined) A.ui[k] = ui[k];
      A.savedAt = saved.savedAt ? new Date(saved.savedAt) : null;
      A.hadSaved = true;
    } else A.config = E.emptyConfig();
    if (A.ui.side === null || A.ui.side === undefined) A.ui.side = window.innerWidth >= 1440;
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
  A.warnings = () => A.r.issues.filter(i => i.severity === 'warning');
  A.saveNow = function () {
    A.savedAt = new Date();
    const ui = { screen: A.ui.screen, list: A.ui.list, name: A.ui.name, tree: A.ui.tree, side: A.ui.side };
    A.storageOk = U.store.set(KEY, { config: A.config, ui, savedAt: A.savedAt.toISOString() });
  };
  A.save = U.debounce(A.saveNow, 400);
  // Closing or reloading the page must not lose the last edit (debounce still pending).
  window.addEventListener('pagehide', () => { if (A.config) { A.flush(); A.saveNow(); } });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && A.config) { A.flush(); A.saveNow(); } });
  A.snapshot = function () {
    A.hist.push(JSON.stringify(A.config));
    if (A.hist.length > 100) A.hist.shift();
    A.fut = [];
  };
  A.mutate = function (fn) {
    A.flush();
    A.snapshot();
    fn(A.config);
    A.recompute(); A.save();
    U.renderAll();
  };
  const settle = U.debounce(() => { A.dirty = false; A.recompute(); A.save(); U.refresh(); }, 300);
  A.touch = function () {
    if (!A.dirty) { A.snapshot(); A.dirty = true; }
    settle();
  };
  A.flush = function () { if (A.dirty) { A.dirty = false; A.recompute(); A.save(); } };
  A.replace = function (config, screen) {
    A.snapshot();
    A.config = config;
    Object.assign(A.ui, { list: null, tree: null, file: null, raw: {}, screen: screen === undefined ? A.ui.screen : screen });
    A.recompute(); A.save();
    U.renderAll();
  };
  A.undo = function () {
    A.flush();
    if (!A.hist.length) return U.toast('Tidak ada yang bisa dibatalkan');
    A.fut.push(JSON.stringify(A.config));
    A.config = JSON.parse(A.hist.pop());
    A.recompute(); A.save(); U.renderAll();
  };
  A.redo = function () {
    if (!A.fut.length) return;
    A.hist.push(JSON.stringify(A.config));
    A.config = JSON.parse(A.fut.pop());
    A.recompute(); A.save(); U.renderAll();
  };
  A.attr = id => (A.config.attributes || []).find(a => a.id === id);
  A.attrIndex = id => (A.config.attributes || []).findIndex(a => a.id === id);

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
  // Engine locations use the original screen numbers; map them to the new steps or the project panel.
  const PROJECT_FIELDS = ['code', 'name', 'target', 'filePrefix', 'packageName', 'lineEnding', 'mdbs', 'dbDefaults'];
  U.target = function (loc) {
    const l = loc || {};
    if (l.screen === 1) {
      if (l.refIndex !== undefined) return { screen: 1, list: 'refs' };
      if (l.field === 'inUse') return { screen: 4 };
      return { panel: 'project' };
    }
    if (l.screen === 2) return { screen: 1, list: l.attributeId };
    if (l.screen === 3) return { screen: 2 };
    if (l.screen === 4) return { screen: 3 };
    return { screen: 4 };
  };
  U.stepErrors = n => A.errors().filter(i => U.target(i.location).screen === n).length;
  U.projectErrors = () => A.errors().filter(i => U.target(i.location).panel === 'project').length;

  U.markIssues = function (root) {
    for (const el of U.$$('[data-loc]', root || document)) {
      const errs = U.issuesAt(el.dataset.loc, 'error');
      el.classList.toggle('bad', errs.length > 0);
      if (errs.length) el.title = errs.slice(0, 5).map(i => `${i.message} (${i.ref})`).join('\n');
      else if (el.dataset.loc && el.title) el.removeAttribute('title');
    }
  };

  /* ---------- Shell ---------- */
  U.buildShell = function () {
    document.body.innerHTML = `
      <header class="bar">
        <div class="brand">${U.LOGO}<span>E3D Setup</span></div>
        <button class="proj" type="button" data-act="projPanel" id="projChip" title="Project: kode, nama, MDB, default DB"></button>
        <nav class="stepper" id="stepper" aria-label="Langkah"></nav>
        <span class="spacer"></span>
        <button class="status" type="button" data-act="problems" id="status"></button>
        <button class="icon-btn" type="button" data-act="undo" id="undoBtn" aria-label="Batalkan (Ctrl+Z)" title="Batalkan (Ctrl+Z)">${U.icon('undo')}</button>
        <button class="icon-btn" type="button" data-act="tour" aria-label="Tur singkat" title="Tur singkat">${U.icon('help')}</button>
        <button class="icon-btn" type="button" data-act="menu" id="menuBtn" aria-label="Menu" title="Menu">${U.icon('more')}</button>
      </header>
      <div class="shell"><main id="main" tabindex="-1"></main><aside id="side" aria-label="Hasil di E3D"></aside></div>
      <footer class="foot" id="foot"></footer>`;
    const body = document.body;
    body.addEventListener('click', onClick);
    body.addEventListener('input', onInput);
    body.addEventListener('change', onChange);
    body.addEventListener('focusin', ev => { if (ev.target.matches('[data-bind]')) ev.target.dataset.old = ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value; });
    document.addEventListener('keydown', ev => {
      const typing = ev.target.matches('input, textarea, select, [contenteditable="true"]');
      const k = ev.key.toLowerCase();
      if ((ev.ctrlKey || ev.metaKey) && !typing && k === 'z') { ev.preventDefault(); ev.shiftKey ? A.redo() : A.undo(); }
      if ((ev.ctrlKey || ev.metaKey) && !typing && k === 'y') { ev.preventDefault(); A.redo(); }
      if ((ev.ctrlKey || ev.metaKey) && k === 'o') { ev.preventDefault(); U.act.openConfig(); }
      if ((ev.ctrlKey || ev.metaKey) && k === 's') { ev.preventDefault(); U.act.exportJson(); }
      if (ev.key === 'Escape' && U.$('.sheet')) U.closeSheet();
    });
    body.addEventListener('dragover', ev => {
      if (ev.dataTransfer && [...ev.dataTransfer.types].includes('Files')) { ev.preventDefault(); body.classList.add('dropping'); }
    });
    body.addEventListener('dragleave', ev => { if (!ev.relatedTarget) body.classList.remove('dropping'); });
    body.addEventListener('drop', ev => {
      body.classList.remove('dropping');
      const f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
      if (!f) return;
      ev.preventDefault();
      U.openFile(f, ev.target.closest('[data-drop-list]') ? ev.target.closest('[data-drop-list]').dataset.dropList : null);
    });
  };

  U.stepDone = function (n) {
    const c = A.config, rr = A.r;
    if (n === 1) { const { rowAttr, colAttr } = E.roles(rr.cfg); return !!(rowAttr && colAttr && rowAttr.rows.length && colAttr.rows.length); }
    if (n === 2) return rr.model.cells.length > 0;
    if (n === 3) return rr.model.cells.length > 0 && !rr.issues.some(i => i.id === 'V03' || i.id === 'V04');
    return false && c;
  };
  U.renderChrome = function () {
    const c = A.config, errs = A.errors().length, warns = A.warnings().length, start = A.ui.screen === 0;
    document.body.classList.toggle('at-start', start);
    document.body.classList.toggle('side-open', !!A.ui.side && !start);
    const pe = U.projectErrors();
    U.$('#projChip').innerHTML = `<b>${U.esc(c.project.code || 'Project')}</b><small>${U.esc(c.project.name || '')}${c.project.name ? ' · ' : ''}${U.esc((c.combination || {}).mdb || '')}</small>${pe ? `<span class="dot err" title="${pe} masalah"></span>` : ''}`;
    U.$('#stepper').innerHTML = U.STEPS.map((s, i) => {
      const n = i + 1, cur = n === A.ui.screen, e = U.stepErrors(n), done = U.stepDone(n);
      const mark = e ? '!' : done && !cur ? '✓' : n;
      return `<button type="button" class="step${done ? ' done' : ''}${e ? ' bad' : ''}" data-act="go" data-screen="${n}" ${cur ? 'aria-current="step"' : ''} title="${e ? e + ' masalah' : ''}"><span class="n">${mark}</span>${U.esc(s)}</button>`;
    }).join('');
    const st = U.$('#status');
    st.className = 'status ' + (errs ? 'bad' : 'ok');
    st.innerHTML = errs ? `<span class="dot"></span>${errs} masalah` : `<span class="dot"></span>Siap${warns ? ` · ${warns} catatan` : ''}`;
    st.title = errs ? 'Klik untuk melihat dan memperbaiki' : 'Tidak ada error';
    U.$('#undoBtn').disabled = !A.hist.length;
    U.renderSide();
    U.renderFoot();
  };
  U.renderFoot = function () {
    const n = A.ui.screen, foot = U.$('#foot');
    if (!n) { foot.innerHTML = ''; return; }
    const back = n > 1 ? `<button class="btn text" type="button" data-act="go" data-screen="${n - 1}">${U.icon('back')}${U.STEPS[n - 2]}</button>` : '';
    const next = n < 4 ? `<button class="btn filled next" type="button" data-act="go" data-screen="${n + 1}">Lanjut: ${U.STEPS[n]}${U.icon('next')}</button>`
      : `<button class="btn filled next" type="button" data-act="generateZip" ${A.errors().length || !A.r.model.cells.length ? 'disabled' : ''}>${U.icon('download')}Unduh ZIP</button>`;
    foot.innerHTML = `${back}<span class="spacer"></span><span class="hint">${HINT[n]}</span>${next}`;
  };

  U.renderScreen = function () {
    const main = U.$('#main'), scr = U.screens[A.ui.screen];
    const act = document.activeElement;
    const focusKey = act && main.contains(act) ? (act.dataset.bind || act.id) : null;
    const sel = act && 'selectionStart' in act ? [act.selectionStart, act.selectionEnd] : null;
    const y = window.scrollY;
    const keep = U.$$('[data-keep-scroll]', main).map(el => [el.dataset.keepScroll, el.scrollTop, el.scrollLeft]);
    main.innerHTML = scr.render(A);
    if (scr.mount) scr.mount(main, A);
    U.markIssues(main);
    window.scrollTo(0, y);
    for (const [k, t, l] of keep) { const el = U.$(`[data-keep-scroll="${k}"]`, main); if (el) { el.scrollTop = t; el.scrollLeft = l; } }
    if (focusKey) {
      const el = U.$(`[data-bind="${CSS.escape(focusKey)}"]`, main) || document.getElementById(focusKey);
      if (el) { el.focus({ preventScroll: true }); if (sel && 'setSelectionRange' in el) try { el.setSelectionRange(sel[0], sel[1]); } catch (e) { /* not text */ } }
    }
  };
  U.refresh = function () {
    const main = U.$('#main'), scr = U.screens[A.ui.screen];
    for (const el of U.$$('[data-part]', main)) {
      const fn = scr.parts && scr.parts[el.dataset.part];
      if (fn) el.innerHTML = fn(A, el);
    }
    if (U.sheetRefresh) U.sheetRefresh(false);
    U.markIssues(document);
    U.renderChrome();
  };
  U.renderAll = function () {
    U.renderScreen();
    if (U.sheetRefresh) U.sheetRefresh(true);
    U.markIssues(document);
    U.renderChrome();
  };

  U.go = function (screen, loc) {
    A.flush();
    U.closeMenu();
    if (screen !== A.ui.screen) A.ui.screen = screen;
    const scr = U.screens[screen];
    if (loc && scr.select) scr.select(A, loc);
    U.renderAll(); A.save();
    if (!loc) { window.scrollTo(0, 0); U.$('#main').focus({ preventScroll: true }); U.maybeTour(); return; }
    U.focusLoc(loc, U.$('#main'));
  };
  U.focusLoc = function (loc, root) {
    for (const k of U.locKeys(loc).reverse()) {
      const el = U.$(`[data-loc="${CSS.escape(k)}"]`, root);
      if (!el) continue;
      el.scrollIntoView({ block: 'center' });
      const row = el.closest('tr') || el;
      row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash');
      const inp = el.matches('input, select, textarea, button') ? el : U.$('input, select, textarea', el);
      if (inp) inp.focus({ preventScroll: true });
      return true;
    }
    return false;
  };
  // Navigate to where an issue lives (stepper screen or project panel).
  U.goIssue = function (issue) {
    const loc = issue.location || {}, t = U.target(loc);
    U.closeSheet();
    if (t.panel === 'project') { U.openProject(); setTimeout(() => U.focusLoc(loc, U.$('.sheet')), 50); return; }
    if (t.list) A.ui.list = t.list;
    U.go(t.screen, loc);
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
  U.readValue = readValue;
  function onInput(ev) {
    const el = ev.target;
    if (el.dataset.input && U.act[el.dataset.input]) return U.act[el.dataset.input](el, ev);
    if (!el.matches('[data-bind]') || el.type === 'checkbox' || el.type === 'radio' || el.tagName === 'SELECT') return;
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
    U.toast('config.json disimpan');
  };
  U.act.openConfig = async () => { const f = await U.pickFile('.json,application/json'); if (f) U.importConfigFile(f); };
  U.act.generateZip = () => {
    A.flush();
    if (A.errors().length) { U.toast(`${A.errors().length} masalah harus diperbaiki dulu`, 'error'); return U.openProblems(); }
    U.downloadZip();
  };
  U.act.sideToggle = () => { A.ui.side = !A.ui.side; A.save(); U.renderChrome(); };
  U.act.menu = el => U.menu(el, [
    { label: 'Project baru', icon: 'newfile', run: () => U.act.newProject() },
    { label: 'Buka config.json…', icon: 'upload', run: () => U.act.openConfig() },
    { label: 'Simpan config.json', icon: 'download', run: () => U.act.exportJson() },
    { divider: true },
    { label: 'Ulangi (Ctrl+Y)', icon: 'redo', run: () => A.redo() },
    { label: `Tema: ${{ system: 'ikuti sistem', light: 'terang', dark: 'gelap' }[U.store.get(KEY + '/theme') || 'system']}`, icon: 'theme', run: () => U.act.theme() },
    { label: 'Istilah', icon: 'info', run: () => U.glossary() },
  ]);

  // One entry point for dropped or picked files.
  U.openFile = async function (file, listId) {
    if (/\.json$/i.test(file.name)) return U.importConfigFile(file);
    if (/\.(csv|txt|tsv)$/i.test(file.name)) return U.importTable({ name: file.name, text: await U.readText(file) }, listId);
    if (/\.xlsx$/i.test(file.name)) {
      let book;
      try { book = await E.xlsx.read(await U.readBytes(file)); } catch (e) { return U.toast(`${file.name}: ${e.message}`, 'error'); }
      const isExportConfig = book.some(s => /^(databases|teams)$/i.test(s.name.trim()));
      if (isExportConfig && !listId) return U.importExportConfigBook(book, file.name);
      return U.importTable({ name: file.name, book }, listId);
    }
    U.toast('Gunakan config.json, Excel (.xlsx) atau CSV', 'error');
  };

  U.importConfigFile = async function (file) {
    let data;
    try { data = JSON.parse(await U.readText(file)); } catch (e) { return U.toast(`${file.name}: bukan JSON yang valid`, 'error'); }
    const errs = E.checkSchema(data);
    if (errs.length) return U.dialog({ title: 'Config tidak bisa dibuka', body: `<ul>${errs.map(e => `<li>${U.esc(e)}</li>`).join('')}</ul>` });
    const { config, notes } = E.migrate(data);
    const r = E.compute(config), c = r.counts;
    const nErr = r.issues.filter(i => i.severity === 'error').length;
    const ok = await U.dialog({
      title: `Buka ${file.name}`,
      body: `<p><b class="mono">${U.esc(config.project.code)}</b> ${U.esc(config.project.name)}</p>
        <div class="tiles">${[['DB', c.dbs], ['Site', c.sites + c.separators], ['Zone', c.zones]].map(([l, v]) => `<div class="tile"><span class="l">${l}</span><span class="v">${U.num(v)}</span></div>`).join('')}</div>
        ${notes.length ? `<ul>${notes.map(n => `<li>${U.esc(n)}</li>`).join('')}</ul>` : ''}
        ${nErr ? `<p>${nErr} masalah perlu diperbaiki.</p>` : ''}${A.hadSaved || A.hist.length ? '<p class="hint">Pekerjaan sekarang diganti. Ctrl+Z untuk kembali.</p>' : ''}`,
      actions: [{ label: 'Batal', value: false }, { label: 'Buka', value: true, kind: 'filled' }],
    });
    if (!ok) return;
    A.hadSaved = true;
    A.replace(config, 4);
    U.toast(`${file.name} dibuka`);
    U.maybeTour();
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
      U.toast(`${name} diunduh · ${entries.length} file`);
    } catch (e) {
      U.toast('Gagal membuat ZIP: ' + e.message, 'error');
    }
  };

  /* ---------- Theme (MD3 dynamic color) ---------- */
  const SEED = '#00658A';
  const EXT = { ok: '#2E7D32', warn: '#B58100' };
  let ext = null;
  U.paintTheme = function () {
    if (typeof MD3 === 'undefined') return;
    const mode = MD3.getTheme(), root = document.documentElement.style;
    for (const [k, s] of Object.entries(ext || {})) {
      root.setProperty(`--app-${k}-container`, s[mode]['primary-container']);
      root.setProperty(`--app-on-${k}-container`, s[mode]['on-primary-container']);
      root.setProperty(`--app-${k}`, s[mode].primary);
    }
  };
  U.initTheme = function () {
    if (typeof MD3 === 'undefined') return;
    MD3.applySeed(SEED, { style: 'tonalSpot' });
    ext = Object.fromEntries(Object.entries(EXT).map(([k, v]) => [k, MD3.schemeFromSeed(v, 'tonalSpot')]));
    MD3.setTheme(U.store.get(KEY + '/theme') || 'system');
    U.paintTheme();
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', U.paintTheme);
  };
  U.act.theme = () => {
    const order = ['system', 'light', 'dark'];
    const next = order[(order.indexOf(U.store.get(KEY + '/theme') || 'system') + 1) % 3];
    U.store.set(KEY + '/theme', next);
    MD3.setTheme(next);
    U.paintTheme();
    U.toast(`Tema: ${{ system: 'ikuti sistem', light: 'terang', dark: 'gelap' }[next]}`);
  };

  /* ---------- Shared bits ---------- */
  // Problems only: silence means OK (design principle P3).
  U.problems = function (keys) {
    const seen = new Set(), out = [];
    for (const k of [].concat(keys)) for (const i of U.issuesAt(k)) {
      if (i.severity === 'info' || seen.has(i.id + i.message)) continue;
      seen.add(i.id + i.message);
      out.push(i);
    }
    if (!out.length) return '';
    const shown = out.slice(0, 4).map(i => `<span class="chip ${i.severity === 'error' ? 'err' : 'warn'}">${U.icon(i.severity === 'error' ? 'error' : 'warning')}${U.esc(i.message)}${i.ref && i.ref !== '-' ? `<span class="ref">${U.esc(i.ref)}</span>` : ''}</span>`);
    if (out.length > 4) shown.push(`<button type="button" class="chip" data-act="problems">+${out.length - 4} lainnya</button>`);
    return shown.join('');
  };
  U.attrOptions = (selected, filter) => (A.config.attributes || []).filter(a => !filter || filter(a))
    .map(a => `<option value="${U.esc(a.id)}" ${a.id === selected ? 'selected' : ''}>${U.esc(a.name)}</option>`).join('');
})(UI);
