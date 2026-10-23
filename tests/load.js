// Loads the engine (and io) files listed in src/manifest.json into one VM context, like the build does.
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');

module.exports = function load() {
  const m = JSON.parse(fs.readFileSync(path.join(root, 'src/manifest.json'), 'utf8'));
  const ctx = vm.createContext({
    console, TextEncoder, TextDecoder, Blob, Response, CompressionStream, DecompressionStream, Uint8Array, ArrayBuffer, DataView,
  });
  for (const f of [...m.engine, ...m.io]) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  return vm.runInContext('E3D', ctx);
};
