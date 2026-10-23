/* Minimal XLSX writer (inline strings, bold frozen header) and reader (values only). */
(function (E) {
  'use strict';

  const esc = s => String(s).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const colName = i => { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  const colIndex = ref => { let n = 0; for (const ch of ref.replace(/\d+$/, '')) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
  const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';
  const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const RNS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const PNS = 'http://schemas.openxmlformats.org/package/2006/relationships';

  function sheetXml(sheet) {
    const rows = sheet.rows.map((r, ri) => {
      const cells = r.map((v, ci) => {
        const ref = colName(ci) + (ri + 1), s = ri === 0 ? ' s="1"' : '';
        if (v === null || v === undefined || v === '') return ri === 0 ? `<c r="${ref}"${s}/>` : '';
        if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}"${s}><v>${v}</v></c>`;
        return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
      }).join('');
      return `<row r="${ri + 1}">${cells}</row>`;
    }).join('');
    const cols = (sheet.widths || []).length
      ? `<cols>${sheet.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
    const pane = sheet.rows.length > 1
      ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/></sheetView></sheetViews>'
      : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
    return `${XML}<worksheet xmlns="${NS}" xmlns:r="${RNS}">${pane}<sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${rows}</sheetData></worksheet>`;
  }

  // sheets: [{name, rows: [[...]], widths?}] -> Uint8Array (.xlsx)
  async function write(sheets) {
    const files = [];
    const n = sheets.length;
    files.push({ path: '[Content_Types].xml', data: `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
      '</Types>' });
    files.push({ path: '_rels/.rels', data: `${XML}<Relationships xmlns="${PNS}">` +
      `<Relationship Id="rId1" Type="${RNS}/officeDocument" Target="xl/workbook.xml"/>` +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
      `<Relationship Id="rId3" Type="${RNS}/extended-properties" Target="docProps/app.xml"/></Relationships>` });
    files.push({ path: 'docProps/core.xml', data: `${XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>E3D Setup Generator</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</dcterms:created></cp:coreProperties>` });
    files.push({ path: 'docProps/app.xml', data: `${XML}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>E3D Setup Generator</Application></Properties>` });
    files.push({ path: 'xl/workbook.xml', data: `${XML}<workbook xmlns="${NS}" xmlns:r="${RNS}"><bookViews><workbookView/></bookViews><sheets>` +
      sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets></workbook>' });
    files.push({ path: 'xl/_rels/workbook.xml.rels', data: `${XML}<Relationships xmlns="${PNS}">` +
      sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="${RNS}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
      `<Relationship Id="rId${n + 1}" Type="${RNS}/styles" Target="styles.xml"/></Relationships>` });
    files.push({ path: 'xl/styles.xml', data: `${XML}<styleSheet xmlns="${NS}">` +
      '<fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts>' +
      '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>' });
    sheets.forEach((s, i) => files.push({ path: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s) }));
    return E.zip.write(files);
  }

  /* ---------- Reader ---------- */
  const unesc = s => s.replace(/&(#x[0-9a-f]+|#\d+|lt|gt|amp|quot|apos);/gi, (m, e) =>
    e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
      : { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }[e.toLowerCase()]);
  const attr = (tag, name) => { const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`)); return m ? unesc(m[1]) : null; };
  const texts = xml => { let s = ''; xml.replace(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g, (m, t) => { s += unesc(t); return m; }); return s; };

  // Uint8Array -> [{name, rows: [[value...]]}] in workbook order
  async function read(buf) {
    const entries = await E.zip.read(buf);
    const dec = new TextDecoder();
    const files = Object.fromEntries(entries.map(e => [e.path.replace(/^\//, ''), dec.decode(e.data)]));
    const wb = files['xl/workbook.xml'];
    if (!wb) throw new Error('Bukan workbook Excel (.xlsx)');
    const rels = {};
    (files['xl/_rels/workbook.xml.rels'] || '').replace(/<Relationship\b[^>]*>/g, t => { rels[attr(t, 'Id')] = attr(t, 'Target'); return t; });
    const shared = [];
    (files['xl/sharedStrings.xml'] || '').replace(/<si>([\s\S]*?)<\/si>/g, (m, si) => { shared.push(texts(si)); return m; });
    const out = [];
    wb.replace(/<sheet\b[^>]*>/g, tag => {
      const name = attr(tag, 'name'), rid = attr(tag, 'r:id');
      let target = rels[rid] || '';
      target = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
      const xml = files[target] || '';
      const rows = [];
      xml.replace(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g, (m, rattrs, body) => {
        const rn = parseInt(attr(' ' + rattrs, 'r'), 10);
        while (rn && rows.length < rn - 1) rows.push([]);
        const r = [];
        (body || '').replace(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, (cm, attrs, inner) => {
          const ref = attr(' ' + attrs, 'r'), t = attr(' ' + attrs, 't');
          const idx = ref ? colIndex(ref) : r.length;
          let v = '';
          if (inner !== undefined) {
            const vm = inner.match(/<v>([\s\S]*?)<\/v>/);
            if (t === 's') v = vm ? shared[parseInt(vm[1], 10)] || '' : '';
            else if (t === 'inlineStr') v = texts(inner);
            else if (t === 'str' || t === 'e') v = vm ? unesc(vm[1]) : '';
            else if (t === 'b') v = vm ? vm[1] === '1' : '';
            else if (vm) { const num = Number(vm[1]); v = isNaN(num) ? unesc(vm[1]) : num; }
          }
          while (r.length < idx) r.push('');
          r[idx] = v;
          return cm;
        });
        rows.push(r);
        return m;
      });
      out.push({ name, rows });
      return tag;
    });
    return out;
  }

  E.xlsx = { write, read };
})(E3D);
