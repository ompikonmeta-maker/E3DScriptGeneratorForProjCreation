/* Block builder: a template string shown as draggable blocks (list value, text, number, operator).
   Names concatenate blocks; expressions (DBNO, MDB position) join them with spaces. */
(function (U) {
  'use strict';
  const E = E3D, A = U.App, esc = U.esc;
  const OPS = { '+': '+', '-': '−', '*': '×', '/': '÷', '(': '(', ')': ')' };

  // Token paths available for the given heads (one level through reference columns).
  U.tokenPaths = function (heads) {
    const out = [];
    for (const h of heads) {
      if (h === 'PROJECT') { out.push('PROJECT.code', 'PROJECT.filePrefix', 'PROJECT.name'); continue; }
      if (h === 'SITE' || h === 'INDEX') { out.push(h); continue; }
      const a = A.config.attributes.find(x => x.name === h);
      if (!a) continue;
      for (const c of a.columns || []) {
        if (c.type === 'boolean' || c.type === 'refList') continue;
        if (c.type === 'ref') {
          const t = A.attr(c.target);
          if (t) for (const tc of t.columns || []) if (tc.type !== 'boolean' && tc.type !== 'refList' && tc.type !== 'ref') out.push(`${h}.${c.id}.${tc.id}`);
        } else out.push(`${h}.${c.id}`);
      }
    }
    return out;
  };
  U.tokenLabel = function (path) {
    const p = path.split('.');
    if (p[0] === 'SITE') return ['Site', ''];
    if (p[0] === 'INDEX') return ['Nomor urut', 'dalam baris'];
    if (p[0] === 'PROJECT') return ['Project', { code: 'Kode', filePrefix: 'Prefix', name: 'Nama', target: 'Versi' }[p[1]] || p[1]];
    let a = A.config.attributes.find(x => x.name === p[0]);
    if (!a) return [p[0], p.slice(1).join(' · ')];
    const parts = [];
    for (let i = 1; i < p.length; i++) {
      const c = (a.columns || []).find(x => x.id === p[i]);
      if (!c) { parts.push(p[i]); break; }
      parts.push(c.name || c.id);
      if (c.type === 'ref') a = A.attr(c.target) || a;
    }
    return [p[0], parts.join(' · ')];
  };
  U.tokenSample = function (path, filters, ctx) {
    if (!ctx) return '';
    try { return String(E.applyFilters(E.resolve(A.r.cfg, path, ctx), filters || '')); } catch (e) { return '?'; }
  };

  /* ---------- Bar ---------- */
  function exprBlocks(tpl) {
    const out = [];
    for (const s of E.segments(tpl)) {
      if (s.type === 'tok') out.push({ type: 'tok', raw: s.text, path: s.path, filters: s.filters });
      else for (const m of s.text.match(/\d+|[-+*/()]|[^\s\d+\-*/()]+/g) || []) out.push(/^\d+$/.test(m) ? { type: 'num', raw: m } : OPS[m] ? { type: 'op', raw: m } : { type: 'txt', raw: m });
    }
    return out;
  }
  function nameBlocks(tpl) {
    return E.segments(tpl).map(s => (s.type === 'tok' ? { type: 'tok', raw: s.text, path: s.path, filters: s.filters } : { type: 'txt', raw: s.text }));
  }
  const FILTER_LABEL = f => (f === 'upper' ? 'BESAR' : f === 'lower' ? 'kecil' : f.startsWith('pad:') ? `${f.slice(4)} digit` : f);
  function blockHtml(b, i, ctx) {
    const x = `<button type="button" class="bx" data-act="blkDel" data-i="${i}" aria-label="Hapus blok" tabindex="-1">×</button>`;
    if (b.type === 'tok') {
      const [head, col] = U.tokenLabel(b.path);
      const fl = b.filters.split('|').filter(Boolean);
      const sys = ['PROJECT', 'SITE', 'INDEX'].includes(b.path.split('.')[0]);
      const v = U.tokenSample(b.path, b.filters, ctx);
      return `<span class="blk tok${sys ? ' sys' : ''}" draggable="true" data-i="${i}" data-raw="${esc(b.raw)}" tabindex="0" role="button" title="${esc(b.raw)} · klik untuk format">
        <small>${esc(head)}${col ? ' · ' + esc(col) : ''}${fl.length ? ' · ' + fl.map(FILTER_LABEL).join(', ') : ''}</small><b>${esc(v === '' ? '…' : v)}</b>${x}</span>`;
    }
    if (b.type === 'num' || b.type === 'op') return `<span class="blk ${b.type}" draggable="true" data-i="${i}" data-raw="${esc(b.raw)}" tabindex="0"><b ${b.type === 'num' ? 'contenteditable="true" spellcheck="false" inputmode="numeric"' : ''}>${esc(b.type === 'op' ? OPS[b.raw] : b.raw)}</b>${x}</span>`;
    return `<span class="blk txt" draggable="true" data-i="${i}"><small>teks</small><b contenteditable="true" spellcheck="false">${esc(b.raw)}</b>${x}</span>`;
  }

  // path: config path of the template; kind: 'name' | 'expr'; ctx: sample context for values.
  U.blockBar = function (path, kind, ctx, loc) {
    const tpl = String(U.getPath(A.config, path) || '');
    if (A.ui.raw[path]) {
      return `<div class="barline"><input class="input raw" data-bind="${esc(path)}" value="${esc(tpl)}" ${loc ? `data-loc="${loc}"` : ''} spellcheck="false" aria-label="Pola">
        <button type="button" class="icon-btn sm" data-act="rawToggle" data-path="${esc(path)}" title="Tampilan blok" aria-label="Tampilan blok">${U.icon('table', 'sm')}</button></div>`;
    }
    const blocks = kind === 'expr' ? exprBlocks(tpl) : nameBlocks(tpl);
    return `<div class="barline"><div class="bar" data-bar="${esc(path)}" data-kind="${kind}" ${loc ? `data-loc="${loc}"` : ''}>${blocks.map((b, i) => blockHtml(b, i, ctx)).join('')}
      ${blocks.length ? '' : '<span class="bar-empty">Seret blok ke sini</span>'}</div>
      <button type="button" class="icon-btn sm" data-act="rawToggle" data-path="${esc(path)}" title="Ketik sebagai teks" aria-label="Ketik sebagai teks">${U.icon('text', 'sm')}</button></div>`;
  };
  function colOf(path) {
    const p = path.split('.');
    let a = A.config.attributes.find(x => x.name === p[0]);
    if (!a) return null;
    let c = null;
    for (let i = 1; i < p.length; i++) { c = (a.columns || []).find(x => x.id === p[i]); if (!c) return null; if (c.type === 'ref') a = A.attr(c.target) || a; }
    return c;
  }
  // prefer: 'num' (expressions), 'desc' (descriptions), 'kode' (names). Other blocks fold behind a button.
  const primary = (p, prefer) => {
    if (p === 'SITE') return prefer !== 'num';
    if (p === 'INDEX') return prefer === 'num';
    if (p.startsWith('PROJECT.')) return false;
    const c = colOf(p);
    if (!c) return false;
    if (prefer === 'num') return c.type === 'number';
    if (prefer === 'desc') return c.id === 'desc' || c.id === 'kode';
    return c.id === 'kode';
  };
  U.blockPalette = function (path, kind, heads, ctx, prefer) {
    const all = U.tokenPaths(heads), pref = prefer || (kind === 'expr' ? 'num' : 'kode');
    A.ui.palAll = A.ui.palAll || {};
    const showAll = A.ui.palAll[path];
    const main = all.filter(p => primary(p, pref)), rest = all.filter(p => !primary(p, pref));
    const toks = (showAll ? main.concat(rest) : main).map(p => {
      const [head, col] = U.tokenLabel(p);
      const sys = ['PROJECT', 'SITE', 'INDEX'].includes(p.split('.')[0]);
      return `<span class="blk tok pal${sys ? ' sys' : ''}" draggable="true" data-add="{${esc(p)}}" tabindex="0" role="button" title="{${esc(p)}}"><small>${esc(head)}${col ? ' · ' + esc(col) : ''}</small><b>${esc(U.tokenSample(p, '', ctx) || '…')}</b></span>`;
    });
    const extra = kind === 'expr'
      ? ['<span class="blk num pal" draggable="true" data-add="#num" tabindex="0" role="button"><b>123</b></span>', ...['+', '-', '*', '/', '(', ')'].map(o => `<span class="blk op pal" draggable="true" data-add="${o}" tabindex="0" role="button"><b>${OPS[o]}</b></span>`)]
      : ['<span class="blk txt pal" draggable="true" data-add="#txt" tabindex="0" role="button"><small>teks</small><b>-</b></span>'];
    const more = rest.length ? `<button type="button" class="btn sm text" data-act="palMore" data-path="${esc(path)}">${showAll ? 'Lebih sedikit' : `+ ${rest.length} blok lain`}</button>` : '';
    return `<div class="palette" data-pal="${esc(path)}">${extra.join('')}${toks.join('')}${more}</div>`;
  };
  U.act.palMore = el => { A.ui.palAll = A.ui.palAll || {}; A.ui.palAll[el.dataset.path] = !A.ui.palAll[el.dataset.path]; U.renderScreen(); };

  /* ---------- Editing ---------- */
  function serialize(bar) {
    const kind = bar.dataset.kind;
    const parts = U.$$(':scope > .blk', bar).map(el => {
      if (el.classList.contains('tok') || el.classList.contains('op')) return el.dataset.raw;
      const t = U.$('b', el).textContent.replace(/ /g, ' ');
      return el.classList.contains('num') ? t.replace(/\D/g, '') || '0' : t;
    });
    return kind === 'expr' ? parts.join(' ') : parts.join('');
  }
  const blockFor = add => (add === '#txt' ? '-' : add === '#num' ? '1' : add);
  // Insert raw text at block index (null = end) and save.
  function insertAt(bar, index, raw) {
    const kind = bar.dataset.kind, path = bar.dataset.bar;
    const blocks = U.$$(':scope > .blk', bar);
    const vals = blocks.map(el => (el.classList.contains('tok') || el.classList.contains('op') ? el.dataset.raw : U.$('b', el).textContent.replace(/ /g, ' ')));
    const at = index === null || index === undefined ? vals.length : index;
    vals.splice(at, 0, raw);
    const next = kind === 'expr' ? vals.join(' ') : vals.join('');
    A.mutate(c => U.setPath(c, path, next));
    U.lastBlock = { path, index: at };
    setTimeout(() => {
      const b = U.$(`[data-bar="${CSS.escape(path)}"]`);
      const el = b && U.$$(':scope > .blk', b)[at];
      if (!el) return;
      const ed = U.$('b[contenteditable]', el);
      if (ed && (raw === '-' || /^\d+$/.test(raw))) { ed.focus(); getSelection().selectAllChildren(ed); } else el.focus();
    }, 0);
  }
  function save(bar) { U.setPath(A.config, bar.dataset.bar, serialize(bar)); A.touch(); }

  let drag = null; // {from:'pal', add} | {from:'bar', path, i}
  document.addEventListener('dragstart', ev => {
    const pal = ev.target.closest && ev.target.closest('.blk.pal');
    const blk = ev.target.closest && ev.target.closest('.bar > .blk');
    if (pal) { drag = { from: 'pal', add: pal.dataset.add }; ev.dataTransfer.setData('text/plain', blockFor(pal.dataset.add)); ev.dataTransfer.effectAllowed = 'copy'; }
    else if (blk) { drag = { from: 'bar', path: blk.parentElement.dataset.bar, i: +blk.dataset.i }; ev.dataTransfer.setData('text/plain', 'blk'); ev.dataTransfer.effectAllowed = 'move'; blk.classList.add('dragging'); }
  });
  document.addEventListener('dragover', ev => {
    if (!drag) return;
    const bar = ev.target.closest && ev.target.closest('.bar');
    U.$$('.bar.over, .blk.before').forEach(x => x.classList.remove('over', 'before'));
    if (bar) {
      ev.preventDefault();
      bar.classList.add('over');
      const b = ev.target.closest('.bar > .blk');
      if (b) b.classList.add('before');
    } else if (drag.from === 'bar') ev.preventDefault();   // dropping outside removes the block
  });
  document.addEventListener('drop', ev => {
    if (!drag) return;
    const d = drag; drag = null;
    U.$$('.bar.over, .blk.before, .blk.dragging').forEach(x => x.classList.remove('over', 'before', 'dragging'));
    const bar = ev.target.closest && ev.target.closest('.bar');
    ev.preventDefault(); ev.stopPropagation();
    if (!bar) {
      if (d.from === 'bar') { const src = U.$(`[data-bar="${CSS.escape(d.path)}"]`); if (src) { U.$$(':scope > .blk', src)[d.i].remove(); A.mutate(c => U.setPath(c, d.path, serialize(src))); } }
      return;
    }
    const target = ev.target.closest('.bar > .blk');
    let at = target ? +target.dataset.i : null;
    if (d.from === 'pal') return insertAt(bar, at, blockFor(d.add));
    if (d.path !== bar.dataset.bar) return;
    const blocks = U.$$(':scope > .blk', bar), moving = blocks[d.i];
    if (at === null) bar.insertBefore(moving, U.$('.bar-empty', bar) || null);
    else bar.insertBefore(moving, blocks[at]);
    A.mutate(c => U.setPath(c, bar.dataset.bar, serialize(bar)));
  }, true);
  document.addEventListener('dragend', () => { drag = null; U.$$('.bar.over, .blk.before, .blk.dragging').forEach(x => x.classList.remove('over', 'before', 'dragging')); });

  // Click on palette = insert after the last focused block of the nearest bar (or at the end).
  document.addEventListener('click', ev => {
    const pal = ev.target.closest && ev.target.closest('.blk.pal');
    if (pal) {
      let path = pal.closest('[data-pal]').dataset.pal;
      if (path.endsWith('*')) {   // shared palette (zone rules): last focused bar, else the first one
        const pre = path.slice(0, -1), first = U.$$('[data-bar]').find(x => x.dataset.bar.startsWith(pre));
        path = U.lastBlock && U.lastBlock.path.startsWith(pre) && U.$(`[data-bar="${CSS.escape(U.lastBlock.path)}"]`) ? U.lastBlock.path : first ? first.dataset.bar : path;
      }
      const bar = U.$(`[data-bar="${CSS.escape(path)}"]`);
      if (!bar) return U.toast('Kembali ke tampilan blok untuk menyisipkan');
      const at = U.lastBlock && U.lastBlock.path === path ? U.lastBlock.index + 1 : null;
      return insertAt(bar, at, blockFor(pal.dataset.add));
    }
    const tok = ev.target.closest && ev.target.closest('.bar > .blk.tok');
    if (tok && !ev.target.closest('.bx')) tokenMenu(tok);
  });
  document.addEventListener('keydown', ev => {
    const pal = ev.target.closest && ev.target.closest('.blk.pal');
    if (pal && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); pal.click(); return; }
    const blk = ev.target.closest && ev.target.closest('.bar > .blk');
    if (!blk) return;
    const bar = blk.parentElement, ed = ev.target.matches('[contenteditable]');
    if (!ed && (ev.key === 'Delete' || ev.key === 'Backspace')) { ev.preventDefault(); blk.remove(); A.mutate(c => U.setPath(c, bar.dataset.bar, serialize(bar))); return; }
    if (!ed && (ev.key === 'Enter' || ev.key === ' ') && blk.classList.contains('tok')) { ev.preventDefault(); tokenMenu(blk); return; }
    if (ev.altKey && (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight')) {
      ev.preventDefault();
      const sib = ev.key === 'ArrowLeft' ? blk.previousElementSibling : blk.nextElementSibling;
      if (!sib || !sib.classList.contains('blk')) return;
      if (ev.key === 'ArrowLeft') bar.insertBefore(blk, sib); else bar.insertBefore(sib, blk);
      const i = U.$$(':scope > .blk', bar).indexOf(blk), path = bar.dataset.bar;
      A.mutate(c => U.setPath(c, path, serialize(bar)));
      const again = U.$$(':scope > .blk', U.$(`[data-bar="${CSS.escape(path)}"]`))[i];
      if (again) again.focus();
      return;
    }
    if (ed && ev.key === 'Enter') { ev.preventDefault(); ev.target.blur(); }
  });
  document.addEventListener('focusin', ev => {
    const blk = ev.target.closest && ev.target.closest('.bar > .blk');
    if (blk) U.lastBlock = { path: blk.parentElement.dataset.bar, index: +blk.dataset.i };
    if (ev.target.matches && ev.target.matches('.bar [contenteditable]')) blk.draggable = false;
  });
  document.addEventListener('focusout', ev => {
    if (!(ev.target.matches && ev.target.matches('.bar [contenteditable]'))) return;
    const blk = ev.target.closest('.blk');
    if (!blk || !blk.isConnected) return;
    blk.draggable = true;
    A.flush();
    if (!ev.target.textContent.length) { const bar = blk.parentElement; blk.remove(); A.mutate(c => U.setPath(c, bar.dataset.bar, serialize(bar))); }
  });
  document.addEventListener('input', ev => {
    if (!(ev.target.matches && ev.target.matches('.bar [contenteditable]'))) return;
    save(ev.target.closest('.bar'));
  });

  U.act.blkDel = el => {
    const blk = el.closest('.blk'), bar = blk.parentElement;
    blk.remove();
    A.mutate(c => U.setPath(c, bar.dataset.bar, serialize(bar)));
  };
  U.act.rawToggle = el => { A.flush(); A.ui.raw[el.dataset.path] = !A.ui.raw[el.dataset.path]; U.renderScreen(); };

  function tokenMenu(blk) {
    const bar = blk.parentElement, path = bar.dataset.bar;
    const seg = E.segments(blk.dataset.raw)[0];
    const fl = seg.filters.split('|').filter(Boolean);
    const set = list => {
      blk.dataset.raw = `{${seg.path}${list.map(f => '|' + f).join('')}}`;
      A.mutate(c => U.setPath(c, path, serialize(bar)));
    };
    const toggle = f => set(fl.includes(f) ? fl.filter(x => x !== f) : fl.filter(x => !(f === 'upper' && x === 'lower') && !(f === 'lower' && x === 'upper')).concat(f));
    const pad = fl.find(f => f.startsWith('pad:'));
    U.menu(blk, [
      { label: 'HURUF BESAR', checked: fl.includes('upper'), run: () => toggle('upper') },
      { label: 'huruf kecil', checked: fl.includes('lower'), run: () => toggle('lower') },
      ...[2, 3, 4].map(n => ({ label: `Isi nol, ${n} digit (0${'1'.padStart(n - 1, '0')})`, checked: pad === 'pad:' + n, run: () => set(fl.filter(f => !f.startsWith('pad:')).concat(pad === 'pad:' + n ? [] : ['pad:' + n])) })),
      { divider: true },
      { label: 'Hapus blok', icon: 'delete', run: () => { blk.remove(); A.mutate(c => U.setPath(c, path, serialize(bar))); } },
    ]);
  }
})(UI);
