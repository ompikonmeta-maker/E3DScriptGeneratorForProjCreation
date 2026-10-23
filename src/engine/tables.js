/* Pasted TSV / CSV tables and the Export Config workbook (SPEC §8.2, §8.3). Pure. */
(function (E) {
  'use strict';

  // RFC 4180-style parser; delim ',' ';' or '\t'.
  E.parseDelimited = function (text, delim) {
    const rows = [];
    let row = [], cell = '', q = false;
    const s = String(text).replace(/^﻿/, '');
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (q) {
        if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"' && cell === '') q = true;
      else if (ch === delim) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && s[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(r => r.some(c => c.trim() !== ''));
  };

  E.detectDelimiter = function (text) {
    const first = String(text).split(/\r?\n/)[0] || '';
    const count = ch => first.split(ch).length - 1;
    if (count('\t')) return '\t';
    return count(';') > count(',') ? ';' : ',';
  };

  E.convertValue = function (col, raw) {
    const v = String(raw === undefined || raw === null ? '' : raw).trim();
    if (col.type === 'number') return v === '' ? null : /^-?\d+$/.test(v) ? parseInt(v, 10) : v;
    if (col.type === 'boolean') return /^(1|y|ya|yes|true|x|v|ada|benar)$/i.test(v);
    if (col.type === 'refList') return v ? v.split(/[,;\s]+/).filter(Boolean) : [];
    return v;
  };

  // Map a parsed table onto an attribute's columns. A first row whose cells name columns
  // (by name or id) is used as the header; otherwise columns are taken in order.
  E.tableToRows = function (attr, table) {
    const cols = attr.columns || [];
    const norm = s => String(s).trim().toLowerCase();
    let map = cols.map((c, i) => i), body = table;
    if (table.length) {
      const hdr = table[0].map(norm);
      const hits = cols.map(c => hdr.findIndex(h => h === norm(c.name || '') || h === norm(c.id)));
      if (hits.filter(i => i >= 0).length >= Math.min(2, cols.length)) { map = hits; body = table.slice(1); }
    }
    return body.map(r => {
      const row = {};
      cols.forEach((c, i) => { const j = map[i]; row[c.id] = E.convertValue(c, j >= 0 ? r[j] : ''); });
      return row;
    });
  };

  /* ---------- Export Config workbook -> inUse ---------- */
  const findSheet = (book, name) => book.find(s => s.name.trim().toLowerCase() === name.toLowerCase());
  const txt = v => (v === undefined || v === null ? '' : String(v).trim());

  // Databases sheet (fact 6.3: first row is a comment row; fact 6.4: header names).
  E.readDatabasesSheet = function (sheet) {
    const rows = sheet.rows;
    const h = rows.findIndex(r => r.some(c => txt(c) === 'Owning Team') && r.some(c => txt(c) === 'Name'));
    if (h < 0) return { error: 'Header "Owning Team" / "Name" tidak ditemukan di sheet Databases (fakta 6.4)' };
    const idx = name => rows[h].findIndex(c => txt(c).replace(/^#/, '') === name);
    const iTeam = idx('Owning Team'), iName = idx('Name'), iNo = idx('Number'), iDesc = idx('Description'), iType = idx('Type');
    const dbs = [];
    for (const r of rows.slice(h + 1)) {
      const team = txt(r[iTeam]), name = txt(r[iName]);
      if (!team || !name) continue;
      const n = txt(r[iNo]);
      dbs.push({ name: `${team}/${name}`, number: /^\d+$/.test(n) ? parseInt(n, 10) : null,
        description: iDesc >= 0 ? txt(r[iDesc]) : '', type: iType >= 0 ? txt(r[iType]) : '' });
    }
    return { dbs };
  };

  // Teams sheet: header unknown (OPEN-ITEMS OI-03). Use the column whose header contains "Name",
  // or the column index the user picked.
  E.readTeamsSheet = function (sheet, pickedCol) {
    const rows = sheet.rows;
    let h = -1, col = pickedCol;
    if (col === undefined || col === null) {
      // Prefer an exact "Name" header over a comment-row description that mentions a name.
      for (const re of [/^#?\s*name$/i, /name/i])
        for (let i = 0; i < Math.min(rows.length, 10) && h < 0; i++) {
          const j = rows[i].findIndex(c => re.test(txt(c)));
          if (j >= 0) { h = i; col = j; }
        }
      if (h < 0) {
        const width = Math.max(0, ...rows.slice(0, 10).map(r => r.length));
        return { needsColumn: true, preview: rows.slice(0, 6), width };
      }
    }
    const teams = [];
    for (const r of rows.slice(h + 1)) {
      const v = txt(r[col]);
      if (v && !v.startsWith('#') && !teams.includes(v)) teams.push(v);
    }
    return { teams };
  };

  E.readDbListSheet = function (sheet) {
    const rows = sheet.rows;
    for (let h = 0; h < Math.min(rows.length, 10); h++) {
      const iDb = rows[h].findIndex(c => /^(db|db name|database)$/i.test(txt(c)));
      const iNo = rows[h].findIndex(c => /^(db ?no\.?|db number|number)$/i.test(txt(c)));
      if (iDb < 0 || iNo < 0) continue;
      const dbs = [];
      for (const r of rows.slice(h + 1)) {
        const name = txt(r[iDb]), n = txt(r[iNo]);
        if (/^[^/\s]+\/[^/\s]+$/.test(name)) dbs.push({ name, number: /^\d+$/.test(n) ? parseInt(n, 10) : null });
      }
      return dbs.length ? dbs : null;
    }
    return null;
  };

  E.inUseFromWorkbook = function (book, source, now, teamCol) {
    const out = { teams: [], dbs: [], source, importedAt: now };
    const msgs = [];
    const dbSheet = findSheet(book, 'Databases'), teamSheet = findSheet(book, 'Teams');
    if (dbSheet) {
      const r = E.readDatabasesSheet(dbSheet);
      if (r.error) msgs.push(r.error); else out.dbs = r.dbs.map(x => ({ name: x.name, number: x.number }));
    } else {
      // Fallback: any sheet with a plain DB list (header "DB" = TEAM/NAME and "DB No." / "Number").
      const hit = book.map(sh => ({ sh, list: E.readDbListSheet(sh) })).find(x => x.list);
      if (hit) { out.dbs = hit.list; msgs.push(`Sheet Databases tidak ada; daftar DB dibaca dari sheet ${hit.sh.name}`); }
      else msgs.push('Sheet Databases tidak ada');
    }
    if (teamSheet) {
      const r = E.readTeamsSheet(teamSheet, teamCol);
      if (r.needsColumn) return { needsColumn: true, preview: r.preview, width: r.width, partial: out, msgs };
      out.teams = r.teams;
    } else if (out.dbs.length) {
      out.teams = [...new Set(out.dbs.map(x => x.name.split('/')[0]))];
      msgs.push('Sheet Teams tidak ada; team diambil dari pemilik DB');
    } else msgs.push('Sheet Teams tidak ada');
    return { inUse: out, msgs };
  };
})(E3D);
