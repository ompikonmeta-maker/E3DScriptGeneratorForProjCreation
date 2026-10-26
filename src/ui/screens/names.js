/* Step 3 · Nama. One naming rule at a time, in E3D order, built from blocks; zone rules as sentences. */
(function (U) {
  'use strict';
  const E = E3D, A = U.App, esc = U.esc;
  const LADDER = [
    ['dbName', 'Nama DB', 'TEAM/NAMA. Bagian sebelum / = team pemilik.'],
    ['dbDesc', 'Deskripsi DB', "Teks di DESC '…'."],
    ['dbNo', 'Nomor DB', 'DBNO: 1–7000 atau 10000–250000, unik.'],
    ['mdbPos', 'Posisi MDB', 'Angka n di ADD db n, 1–5000. Menentukan urutan di MDB.'],
    ['sepDiscipline', 'Separator baris', 'Site kosong pembuka tiap baris (mis. disiplin).'],
    ['sepGroup', 'Separator grup', 'Site kosong pembuka tiap grup.'],
    ['site', 'Site', 'NEW SITE, satu per DB.'],
    ['zone', 'Zone', 'NEW ZONE di tiap site, menurut aturan.'],
  ];
  U.NAME_LABEL = k => (LADDER.find(l => l[0] === k) || [k, { teamsFile: 'File 00-TEAMS', discFolder: 'Folder per baris', b1File: 'File B1', b2File: 'File B2', b3File: 'File B3', refFile: 'File 90', fixupFile: 'File 99', registerFile: 'Register' }[k] || k])[1];
  const OPS = [['eq', '='], ['ne', '≠'], ['in', 'salah satu']];

  function ctxFor(A, key, rule) {
    const m = A.r.model, kind = key === 'zone' ? 'zone' : E.TEMPLATE_KINDS[key];
    const cell = m.cells[0];
    if (!cell) return null;
    if (kind === 'row') return m.disciplines[0].ctx;
    if (kind === 'zone') {
      const c = Object.assign({}, cell.ctx);
      const fa = rule && rule.forEach ? A.attr(rule.forEach) : null;
      if (fa && fa.rows.length) c[fa.name] = fa.rows[0];
      return c;
    }
    return cell.ctx;
  }
  function value(A, key, ctx) {
    const tpl = A.config.templates[key];
    if (!tpl || !ctx) return '';
    const s = E.render(A.r.cfg, tpl, ctx);
    if (!E.EXPRESSION_TEMPLATES.includes(key)) return s;
    try { return String(E.evaluate(s)); } catch (e) { return '?'; }
  }
  const firstZone = A => { const c = A.r.model.cells.find(x => x.zones.length); return c ? c.zones[0] : ''; };
  function sample(A, key) {
    if (key === 'zone') return firstZone(A) || '—';
    if (key === 'sepGroup') { const d = A.r.model.disciplines.find(x => x.groupSeps.size); return d ? [...d.groupSeps.values()][0] : '—'; }
    if (key === 'sepDiscipline') { const d = A.r.model.disciplines[0]; return d && d.sepDiscipline ? d.sepDiscipline : '—'; }
    return value(A, key, ctxFor(A, key)) || '—';
  }

  /* ---------- Range line (DBNO, MDB position) ---------- */
  function rangeLine(A, key) {
    const nums = A.r.model.cells.map(c => (key === 'dbNo' ? c.dbno : c.pos)).filter(Number.isInteger);
    if (!nums.length) return '';
    const lo = Math.min(...nums), hi = Math.max(...nums);
    let pos, bands, labels;
    if (key === 'dbNo') {
      pos = v => (v <= 7000 ? Math.max(0, v) / 7000 * 15 : v < 10000 ? 15 + (v - 7000) / 3000 * 5 : 20 + Math.min(v - 10000, 240000) / 240000 * 80);
      bands = [[0, 15], [20, 100]];
      labels = [[7.5, '1–7000'], [60, '10000–250000']];
    } else {
      pos = v => Math.max(0, Math.min(v, 5000)) / 5000 * 100;
      bands = [[0, 100]];
      labels = [[50, '1–5000']];
    }
    const a = pos(lo), b = Math.max(pos(hi), a + 0.8);
    return `<div class="rangeline" aria-label="Rentang ${lo}–${hi}">
      ${bands.map(([x, y]) => `<span class="band" style="left:${x}%;width:${y - x}%"></span>`).join('')}
      <span class="used" style="left:${a}%;width:${Math.min(100, b) - a}%"></span>
      ${labels.map(([x, t]) => `<span class="lab" style="left:${x}%">${t}</span>`).join('')}
      <span class="lab used-lab" style="left:${Math.min(85, a)}%">${lo === hi ? lo : `${lo}–${hi}`}</span></div>`;
  }

  /* ---------- Template editor ---------- */
  function examples(A, key) {
    const cells = A.r.model.cells;
    if (!cells.length) return '';
    const kind = E.TEMPLATE_KINDS[key];
    let ctxs;
    if (kind === 'row') ctxs = A.r.model.disciplines.slice(1, 4).map(d => d.ctx);
    else if (kind === 'group') return A.r.model.disciplines.flatMap(d => [...d.groupSeps.values()]).slice(1, 4).map(v => `<span>${esc(v)}</span>`).join('');
    else { const n = cells.length; ctxs = [...new Set([Math.floor(n / 3), Math.floor(2 * n / 3), n - 1])].filter(i => i > 0).map(i => cells[i].ctx); }
    return ctxs.map(c => `<span>${esc(value(A, key, c))}</span>`).join('');
  }
  function stats(A, key) {
    const cells = A.r.model.cells, kind = E.TEMPLATE_KINDS[key];
    if (!cells.length) return 'Belum ada sel di Susunan.';
    if (kind === 'cell' && !E.EXPRESSION_TEMPLATES.includes(key)) {
      const prop = { dbName: 'db', dbDesc: 'desc', site: 'site' }[key];
      const u = new Set(cells.map(c => c[prop])).size;
      return `${U.num(cells.length)} nama${u === cells.length ? '' : ` · ${U.num(cells.length - u)} kembar`}`;
    }
    if (kind === 'row') return `${A.r.model.disciplines.length} separator`;
    if (kind === 'group') return `${A.r.model.disciplines.reduce((n, d) => n + d.groupSeps.size, 0)} separator`;
    return '';
  }
  const parts = {
    ladder(A) {
      return LADDER.map(([k, label]) => {
        const keys = k === 'zone' ? (A.config.zoneRules || []).map((r, i) => 'z:' + i).concat('f:zoneRules') : ['t:' + k];
        const bad = keys.some(x => U.issuesAt(x, 'error').length);
        return `<button type="button" class="rung" role="tab" data-act="nameSel" data-k="${k}" aria-selected="${A.ui.name === k}">
          <span>${label}${bad ? '<span class="dot err"></span>' : ''}</span><code>${esc(sample(A, k))}</code></button>`;
      }).join('');
    },
    out: A => `<span class="big-out">${esc(sample(A, A.ui.name))}</span>`,
    ex: A => `${examples(A, A.ui.name)}<span class="muted">${esc(stats(A, A.ui.name))}</span>`,
    range: A => (E.EXPRESSION_TEMPLATES.includes(A.ui.name) ? rangeLine(A, A.ui.name) : ''),
    probs: A => U.problems('t:' + A.ui.name),
    zprobs(A) {
      const keys = ['f:zoneRules'].concat((A.config.zoneRules || []).map((r, i) => 'z:' + i));
      const v19 = A.r.issues.some(i => i.id === 'V19');
      const errs = keys.flatMap(k => U.issuesAt(k, 'error'));
      return (v19 ? `<span class="chip warn">${U.icon('warning')}NEW ZONE setelah pindah ke site belum dites; B3 tetap dibuat dengan peringatan<span class="ref">§9</span></span>` : '') +
        [...new Map(errs.map(i => [i.message, i])).values()].slice(0, 4).map(i => `<span class="chip err">${U.icon('error')}${esc(i.message)}</span>`).join('');
    },
    cover(A) {
      const ds = A.r.model.disciplines;
      return ds.map(d => { const on = d.cells.some(c => c.targeted); return `<span class="cov${on ? ' on' : ''}" title="${esc(d.row.desc)}${on ? '' : ': belum ada aturan zone'}">${esc(d.row.kode)}</span>`; }).join('');
    },
  };
  (A => { for (let i = 0; i < 50; i++) parts['zs' + i] = A => ruleSample(A, i); })();

  function templateEditor(A, key) {
    const meta = LADDER.find(l => l[0] === key);
    const kind = E.EXPRESSION_TEMPLATES.includes(key) ? 'expr' : 'name';
    const ctx = ctxFor(A, key);
    const optional = E.OPTIONAL_TEMPLATES.includes(key);
    const on = !!A.config.templates[key];
    const roles = E.roles(A.r.cfg);
    const groupOff = key === 'sepGroup' && !(roles.groupAttr && roles.groupAttr.role === 'separator');
    return `<section class="card" data-loc="t:${key}">
      <div class="card-head"><div><h2>${meta[1]}</h2><span class="hint">${meta[2]}</span></div>
        ${optional ? `<label class="switch"><input type="checkbox" data-change="sepToggle" data-k="${key}" ${on ? 'checked' : ''}><span>Pakai</span></label>` : ''}</div>
      ${groupOff ? `<div class="note">Grup belum diberi separator. Aktifkan "dengan separator" di <button type="button" class="link" data-act="go" data-screen="2">Susunan</button>.</div>` : ''}
      ${optional && !on ? '' : `
        <div data-part="out">${parts.out(A)}</div>
        ${U.blockBar('templates.' + key, kind, ctx)}
        <div data-part="range">${parts.range(A)}</div>
        <div class="examples" data-part="ex">${parts.ex(A)}</div>
        <div class="chips" data-part="probs">${parts.probs(A)}</div>
        <div class="pal-head">Blok</div>${U.blockPalette('templates.' + key, kind, E.contextHeads(A.r.cfg, E.TEMPLATE_KINDS[key]), ctx, key === 'dbDesc' || key === 'sepDiscipline' ? 'desc' : null)}`}
    </section>`;
  }

  /* ---------- Zone rules ---------- */
  function valueList(A, token) {
    const head = String(token).split('.');
    const a = A.config.attributes.find(x => x.name === head[0]);
    if (!a) return [];
    let at = a;
    for (let i = 1; i < head.length - 1; i++) { const c = at.columns.find(x => x.id === head[i]); if (!c || c.type !== 'ref') return []; at = A.attr(c.target); if (!at) return []; }
    const col = head[head.length - 1];
    return [...new Set(at.rows.map(r => r[col]).filter(v => v !== undefined && v !== null && v !== ''))].slice(0, 200);
  }
  U.clauseEditor = function (base, clauses, tokens, idp) {
    return `<div class="clauses">${(clauses || []).map((w, k) => {
      const vals = valueList(A, w.token);
      const opts = tokens.includes(w.token) || !w.token ? tokens : [w.token].concat(tokens);
      return `<div class="clause">
        <select class="input" data-bind="${base}.${k}.token" aria-label="Kolom">${!w.token ? '<option value="">pilih…</option>' : ''}${opts.map(t => { const [h, c] = U.tokenLabel(t); return `<option value="${esc(t)}" ${t === w.token ? 'selected' : ''}>${esc(h)}${c ? ' · ' + esc(c) : ''}</option>`; }).join('')}</select>
        <select class="input op" data-change="clauseOp" data-path="${base}.${k}" aria-label="Operator">${OPS.map(([v, l]) => `<option value="${v}" ${w.op === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <input class="input mono" data-bind="${base}.${k}.value" ${w.op === 'in' ? 'data-t="list"' : ''} value="${esc(Array.isArray(w.value) ? w.value.join(', ') : w.value)}" list="${idp}-${k}" placeholder="${w.op === 'in' ? 'A, B' : 'nilai'}" aria-label="Nilai" spellcheck="false">
        <datalist id="${idp}-${k}">${vals.map(v => `<option value="${esc(v)}">`).join('')}</datalist>
        <button class="icon-btn sm danger" type="button" data-act="clauseDel" data-path="${base}" data-k="${k}" aria-label="Hapus syarat">${U.icon('close')}</button></div>`;
    }).join('')}
    <button class="btn sm text" type="button" data-act="clauseAdd" data-path="${base}">${U.icon('add')}Syarat</button></div>`;
  };
  U.act.clauseOp = el => A.mutate(c => {
    const w = U.getPath(c, el.dataset.path);
    w.op = el.value;
    if (w.op === 'in' && !Array.isArray(w.value)) w.value = String(w.value || '').split(/[,;\s]+/).filter(Boolean);
    if (w.op !== 'in' && Array.isArray(w.value)) w.value = w.value.join(',');
  });
  U.act.clauseAdd = el => A.mutate(c => {
    const list = U.getPath(c, el.dataset.path);
    if (Array.isArray(list)) list.push({ token: '', op: 'eq', value: '' }); else U.setPath(c, el.dataset.path, [{ token: '', op: 'eq', value: '' }]);
  });
  U.act.clauseDel = el => A.mutate(c => U.getPath(c, el.dataset.path).splice(+el.dataset.k, 1));

  function ruleSample(A, i) {
    const rule = (A.config.zoneRules || [])[i];
    if (!rule) return '';
    let n = 0, sites = 0;
    const ex = [];
    for (const c of A.r.model.cells) {
      let hit = false;
      c.zoneRules.forEach((id, k) => { if (id === rule.id) { n++; hit = true; if (ex.length < 3) ex.push(c.zones[k]); } });
      if (hit) sites++;
    }
    return `${ex.map(z => `<span>${esc(z)}</span>`).join('')}<span class="muted">${n ? `${U.num(n)} zone di ${U.num(sites)} site` : 'belum menghasilkan zone'}</span>`;
  }
  function zoneEditor(A) {
    const zr = A.config.zoneRules || [];
    const condTokens = U.tokenPaths(E.contextHeads(A.r.cfg, 'cell').filter(h => h !== 'INDEX' && h !== 'PROJECT'));
    const pal = (() => {
      const lb = U.lastBlock && /^zoneRules\.(\d+)\./.exec(U.lastBlock.path);
      const i = lb ? +lb[1] : 0, rule = zr[i];
      return rule ? U.blockPalette('zoneRules.*', 'name', E.contextHeads(A.r.cfg, 'zone', rule.forEach), ctxFor(A, 'zone', rule)) : '';
    })();
    return `<section class="card" data-loc="f:zoneRules">
      <div class="card-head"><div><h2>Zone</h2><span class="hint">Aturan dicek per site, berurutan.</span></div>
        <div class="cover" data-part="cover" title="Baris yang sudah punya aturan zone">${parts.cover(A)}</div></div>
      <div class="chips" data-part="zprobs">${parts.zprobs(A)}</div>
      <div class="rules" id="rules">${zr.map((r, i) => `
        <div class="rule" data-loc="z:${i}" data-rule="${i}">
          <div class="rule-head"><span class="grip" draggable="true" title="Seret untuk mengurutkan (Alt+↑/↓)" tabindex="0" data-grip="${i}">${U.icon('drag', 'sm')}</span>
            <input class="input mono rid" data-bind="zoneRules.${i}.id" value="${esc(r.id)}" aria-label="Nama aturan" spellcheck="false">
            <span class="spacer"></span>
            <button type="button" class="icon-btn sm danger" data-act="ruleDel" data-i="${i}" aria-label="Hapus aturan">${U.icon('delete')}</button></div>
          <div class="rule-body">
            <div class="lbl">Jika</div>${U.clauseEditor(`zoneRules.${i}.when`, r.when || [], condTokens, 'zv' + i)}
            <div class="lbl">Untuk tiap</div><div><select class="input auto" data-change="ruleForEach" data-i="${i}" aria-label="Untuk tiap"><option value="">— satu kali per site</option>${U.attrOptions(r.forEach)}</select></div>
            <div class="lbl">Nama</div><div class="stack">${(r.patterns || []).map((p, k) => `<div class="inline nowrap"><div class="grow">${U.blockBar(`zoneRules.${i}.patterns.${k}`, 'name', ctxFor(A, 'zone', r))}</div>
                <button class="icon-btn sm danger" type="button" data-act="patDel" data-i="${i}" data-k="${k}" aria-label="Hapus pola">${U.icon('close')}</button></div>`).join('')}
              <button class="btn sm text" type="button" data-act="patAdd" data-i="${i}">${U.icon('add')}Nama zone</button></div>
            <div class="lbl"></div><div class="examples" data-part="zs${i}">${ruleSample(A, i)}</div>
          </div></div>`).join('') || '<div class="empty">Belum ada aturan. Tanpa aturan, file B3 (zone) tidak dibuat.</div>'}</div>
      <button class="btn sm tonal" type="button" data-act="ruleAdd" style="align-self:flex-start">${U.icon('add')}Aturan zone</button>
      ${zr.length ? `<div class="pal-head">Blok</div>${pal}` : ''}
    </section>`;
  }

  U.screens[3] = {
    parts,
    select(A, loc) {
      if (loc.template && LADDER.some(l => l[0] === loc.template)) A.ui.name = loc.template;
      else if (loc.zoneRule !== undefined || loc.zoneRuleId || loc.field === 'zoneRules') A.ui.name = 'zone';
    },
    render(A) {
      if (!LADDER.some(l => l[0] === A.ui.name)) A.ui.name = 'site';
      return `<div class="page names">
        <nav class="card ladder" role="tablist" aria-label="Nama di E3D"><h2>Nama di E3D</h2><div data-part="ladder">${parts.ladder(A)}</div>
          <span class="hint">File &amp; folder paket: ⚙ di Cek &amp; Unduh</span></nav>
        <div class="editor">${A.ui.name === 'zone' ? zoneEditor(A) : templateEditor(A, A.ui.name)}</div></div>`;
    },
    mount(root) {
      const rules = U.$('#rules', root);
      if (!rules) return;
      let drag = null;
      rules.addEventListener('dragstart', ev => { const g = ev.target.closest('[data-grip]'); if (g) { drag = +g.dataset.grip; ev.dataTransfer.setData('text/plain', 'rule'); } });
      rules.addEventListener('dragover', ev => { if (drag === null) return; const r = ev.target.closest('.rule'); if (r) { ev.preventDefault(); U.$$('.rule.before', rules).forEach(x => x.classList.remove('before')); r.classList.add('before'); } });
      rules.addEventListener('drop', ev => {
        if (drag === null) return;
        const r = ev.target.closest('.rule');
        ev.preventDefault(); ev.stopPropagation();
        const from = drag; drag = null;
        if (!r) return;
        const to = +r.dataset.rule;
        if (to !== from) A.mutate(c => { const [x] = c.zoneRules.splice(from, 1); c.zoneRules.splice(to > from ? to - 1 : to, 0, x); });
      });
      rules.addEventListener('dragend', () => { drag = null; U.$$('.rule.before', rules).forEach(x => x.classList.remove('before')); });
      rules.addEventListener('keydown', ev => {
        const g = ev.target.closest('[data-grip]');
        if (!g || !ev.altKey || (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown')) return;
        ev.preventDefault();
        const i = +g.dataset.grip, j = i + (ev.key === 'ArrowUp' ? -1 : 1);
        if (j < 0 || j >= A.config.zoneRules.length) return;
        A.mutate(c => { const [x] = c.zoneRules.splice(i, 1); c.zoneRules.splice(j, 0, x); });
        const again = U.$(`[data-grip="${j}"]`); if (again) again.focus();
      });
    },
  };

  U.act.nameSel = el => { A.flush(); A.ui.name = el.dataset.k; A.save(); U.renderAll(); };
  U.act.sepToggle = el => {
    const k = el.dataset.k;
    A.mutate(c => {
      if (!el.checked) { c.templates[k] = ''; return; }
      const r = E.roles(E.index(c));
      c.templates[k] = k === 'sepDiscipline' ? (r.rowAttr ? `/----{${r.rowAttr.name}.desc|upper}----` : '/--------')
        : (r.rowAttr && r.groupAttr ? `/{${r.rowAttr.name}.kode}----{${r.groupAttr.name}.kode}----` : '/--------');
    });
  };
  U.act.ruleAdd = () => A.mutate(c => {
    const ids = (c.zoneRules || []).map(r => r.id);
    let n = ids.length + 1; while (ids.includes('zone-' + n)) n++;
    const row = E.roles(E.index(c)).rowAttr;
    (c.zoneRules = c.zoneRules || []).push({ id: 'zone-' + n, when: row ? [{ token: `${row.name}.kode`, op: 'eq', value: '' }] : [], patterns: ['{SITE}-'], source: '' });
  });
  U.act.ruleDel = async el => {
    const r = A.config.zoneRules[+el.dataset.i];
    if (!(await U.confirm(`Hapus aturan ${r.id}?`, 'Zone dari aturan ini tidak dibuat lagi. Ctrl+Z untuk kembali.', 'Hapus', true))) return;
    A.mutate(c => c.zoneRules.splice(+el.dataset.i, 1));
  };
  U.act.ruleForEach = el => A.mutate(c => { const r = c.zoneRules[+el.dataset.i]; if (el.value) r.forEach = el.value; else delete r.forEach; });
  U.act.patAdd = el => A.mutate(c => c.zoneRules[+el.dataset.i].patterns.push('{SITE}-'));
  U.act.patDel = el => A.mutate(c => c.zoneRules[+el.dataset.i].patterns.splice(+el.dataset.k, 1));
})(UI);
