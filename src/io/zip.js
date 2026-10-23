/* Minimal ZIP writer/reader. Deflate via CompressionStream('deflate-raw') when the browser has it,
   otherwise entries are stored uncompressed (still a valid ZIP). No third-party code. */
(function (E) {
  'use strict';

  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  const crc32 = bytes => {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  };
  const enc = new TextEncoder();
  const toBytes = d => (typeof d === 'string' ? enc.encode(d) : d instanceof Uint8Array ? d : new Uint8Array(d));

  async function pipe(bytes, stream) {
    const s = new Blob([bytes]).stream().pipeThrough(stream);
    return new Uint8Array(await new Response(s).arrayBuffer());
  }
  E.canDeflate = () => typeof CompressionStream !== 'undefined';
  E.inflateRaw = bytes => pipe(bytes, new DecompressionStream('deflate-raw'));

  function dosTime(date) {
    return {
      time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
      date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    };
  }

  // entries: [{path, data: string|Uint8Array}] -> Uint8Array
  async function write(entries, opts) {
    const now = dosTime((opts && opts.date) || new Date());
    const parts = [], central = [];
    let offset = 0;
    for (const e of entries) {
      const name = enc.encode(e.path), raw = toBytes(e.data), crc = crc32(raw);
      let method = 0, body = raw;
      if (E.canDeflate() && !(opts && opts.store)) {
        try {
          const z = await pipe(raw, new CompressionStream('deflate-raw'));
          if (z.length < raw.length) { method = 8; body = z; }
        } catch (err) { /* fall back to store */ }
      }
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
      lh.setUint16(8, method, true); lh.setUint16(10, now.time, true); lh.setUint16(12, now.date, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, body.length, true); lh.setUint32(22, raw.length, true);
      lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, body);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
      ch.setUint16(10, method, true); ch.setUint16(12, now.time, true); ch.setUint16(14, now.date, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, body.length, true); ch.setUint32(24, raw.length, true);
      ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + body.length;
    }
    const cdSize = central.reduce((n, p) => n + p.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    const all = [...parts, ...central, new Uint8Array(end.buffer)];
    const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
    let o = 0;
    for (const p of all) { out.set(p, o); o += p.length; }
    return out;
  }

  // Uint8Array -> [{path, data: Uint8Array}]
  async function read(buf) {
    const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    let eocd = -1;
    for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('Bukan file ZIP/XLSX yang valid');
    const count = v.getUint16(eocd + 10, true);
    let p = v.getUint32(eocd + 16, true);
    const dec = new TextDecoder();
    const out = [];
    for (let i = 0; i < count; i++) {
      if (v.getUint32(p, true) !== 0x02014b50) throw new Error('Direktori ZIP rusak');
      const method = v.getUint16(p + 10, true), csize = v.getUint32(p + 20, true);
      const nlen = v.getUint16(p + 28, true), xlen = v.getUint16(p + 30, true), clen = v.getUint16(p + 32, true);
      const lo = v.getUint32(p + 42, true);
      const path = dec.decode(b.subarray(p + 46, p + 46 + nlen));
      const start = lo + 30 + v.getUint16(lo + 26, true) + v.getUint16(lo + 28, true);
      const body = b.subarray(start, start + csize);
      let data;
      if (method === 0) data = body.slice();
      else if (method === 8) data = await E.inflateRaw(body);
      else throw new Error(`Metode kompresi ${method} tidak didukung (${path})`);
      out.push({ path, data });
      p += 46 + nlen + xlen + clen;
    }
    return out;
  }

  E.zip = { write, read, crc32 };
})(E3D);
