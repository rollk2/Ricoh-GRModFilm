// The firmware .zip Ricoh's site offers (gr3_v210.zip, gr3x_v160.zip, ...): on the web site there is no shell to unzip
// it, so the browser reads the archive and takes the firmware .bin out of it (stored or deflate, the two methods a zip uses).

const u16 = (d: Uint8Array, o: number): number => d[o] | (d[o + 1] << 8);
const u32 = (d: Uint8Array, o: number): number => (u16(d, o) | (u16(d, o + 2) << 16)) >>> 0;

/** True when the bytes start like a zip archive. */
export const isZip = (d: Uint8Array): boolean => d.length > 22 && d[0] === 0x50 && d[1] === 0x4b && d[2] === 3 && d[3] === 4;

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as unknown as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** The first .bin of the archive (its name without folders, and its bytes); null when it has none. */
export async function firmwareFromZip(zip: Uint8Array): Promise<{ name: string; data: Uint8Array } | null> {
  // End of central directory: the last 'PK\5\6' (a comment of up to 64 KB may follow it).
  let end = -1;
  for (let o = zip.length - 22; o >= Math.max(0, zip.length - 22 - 0xffff); o--) {
    if (u32(zip, o) === 0x06054b50) { end = o; break; }
  }
  if (end < 0) throw new Error('zip: no central directory');
  const count = u16(zip, end + 10);
  let p = u32(zip, end + 16);
  for (let i = 0; i < count; i++) {
    if (u32(zip, p) !== 0x02014b50) throw new Error('zip: bad central directory');
    const method = u16(zip, p + 10), csize = u32(zip, p + 20), size = u32(zip, p + 24);
    const nlen = u16(zip, p + 28), xlen = u16(zip, p + 30), clen = u16(zip, p + 32), local = u32(zip, p + 42);
    const path = new TextDecoder().decode(zip.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + xlen + clen;
    const name = path.split('/').pop() ?? '';
    if (!/\.bin$/i.test(name) || name.startsWith('.')) continue;
    if (u32(zip, local) !== 0x04034b50) throw new Error('zip: bad local header');
    const start = local + 30 + u16(zip, local + 26) + u16(zip, local + 28);
    const raw = zip.subarray(start, start + csize);
    const data = method === 0 ? raw.slice() : method === 8 ? await inflate(raw) : null;
    if (!data) throw new Error(`zip: method ${method}`);
    if (data.length !== size) throw new Error('zip: size');
    return { name, data };
  }
  return null;
}
