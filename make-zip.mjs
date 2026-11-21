// Creates prompt-vault.zip of the source (excludes node_modules/dist/.git). No dependencies.
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { deflateRawSync } from 'node:zlib';

const SKIP = new Set(['node_modules', 'dist', '.git', 'prompt-vault.zip']);
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = buf => { let c = 0xFFFFFFFF; for (const b of buf) c = crcTable[(c ^ b) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
const walk = dir => readdirSync(dir).flatMap(name => { if (SKIP.has(name)) return []; const p = join(dir, name); return statSync(p).isDirectory() ? walk(p) : [p]; });

const entries = walk('.').map(path => {
  const name = 'prompt-vault/' + relative('.', path).split('\\').join('/');
  const data = readFileSync(path);
  return { name: Buffer.from(name), data, crc: crc32(data), comp: deflateRawSync(data) };
});
const chunks = [], central = [];
let offset = 0;
for (const e of entries) {
  const lh = Buffer.alloc(30);
  lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(8, 8);
  lh.writeUInt32LE(e.crc, 14); lh.writeUInt32LE(e.comp.length, 18); lh.writeUInt32LE(e.data.length, 22); lh.writeUInt16LE(e.name.length, 26);
  chunks.push(lh, e.name, e.comp);
  const ch = Buffer.alloc(46);
  ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(8, 10);
  ch.writeUInt32LE(e.crc, 16); ch.writeUInt32LE(e.comp.length, 20); ch.writeUInt32LE(e.data.length, 24); ch.writeUInt16LE(e.name.length, 28);
  ch.writeUInt32LE(offset, 42);
  central.push(ch, e.name);
  offset += 30 + e.name.length + e.comp.length;
}
const cd = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
writeFileSync('prompt-vault.zip', Buffer.concat([...chunks, cd, end]));
console.log('Created prompt-vault.zip (' + entries.length + ' files)');
