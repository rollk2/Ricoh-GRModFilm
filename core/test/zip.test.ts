// SPDX-License-Identifier: GPL-2.0-only
// The web site opens Ricoh's firmware .zip itself (ui/src/zip.ts): the .bin is taken out, stored or deflated.
import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { firmwareFromZip, isZip } from '../../ui/src/zip';

/** A zip as a zip tool writes it: local headers, then the central directory and its end record. */
function makeZip(entries: { path: string; data: Uint8Array; deflate: boolean }[]): Uint8Array {
  const parts: number[] = [], central: number[] = [];
  const le = (n: number, bytes: number): number[] => Array.from({ length: bytes }, (_, i) => (n >>> (8 * i)) & 0xff);
  for (const e of entries) {
    const name = [...new TextEncoder().encode(e.path)];
    const body = e.deflate ? new Uint8Array(deflateRawSync(e.data)) : e.data;
    const offset = parts.length;
    const common = [...le(20, 2), ...le(0, 2), ...le(e.deflate ? 8 : 0, 2), ...le(0, 4), ...le(0, 4), ...le(body.length, 4), ...le(e.data.length, 4), ...le(name.length, 2), ...le(0, 2)];
    for (const b of [...le(0x04034b50, 4), ...common, ...name, ...body]) parts.push(b);
    central.push(...le(0x02014b50, 4), ...le(20, 2), ...common, ...le(0, 2), ...le(0, 2), ...le(0, 2), ...le(0, 4), ...le(offset, 4), ...name);
  }
  const start = parts.length;
  return new Uint8Array([...parts, ...central, ...le(0x06054b50, 4), ...le(0, 4), ...le(entries.length, 2), ...le(entries.length, 2), ...le(central.length, 4), ...le(start, 4), ...le(0, 2)]);
}

const firmware = new Uint8Array(200_000).map((_, i) => (i * 7 + (i >> 9)) & 0xff);

describe('Ricoh firmware zip on the web site', () => {
  it('takes the deflated .bin out of its folder', async () => {
    const zip = makeZip([{ path: 'gr3_v210/readme.txt', data: new Uint8Array([1, 2, 3]), deflate: true }, { path: 'gr3_v210/fwdc239b.bin', data: firmware, deflate: true }]);
    expect(isZip(zip)).toBe(true);
    const got = await firmwareFromZip(zip);
    expect(got?.name).toBe('fwdc239b.bin');
    expect(got?.data).toEqual(firmware);
  });
  it('reads a stored entry, skips macOS metadata, and says when there is no .bin', async () => {
    const got = await firmwareFromZip(makeZip([{ path: '__MACOSX/gr3x/._fwdc243b.bin', data: new Uint8Array(10), deflate: false }, { path: 'fwdc243b.bin', data: firmware, deflate: false }]));
    expect(got?.name).toBe('fwdc243b.bin');
    expect(got?.data).toEqual(firmware);
    expect(await firmwareFromZip(makeZip([{ path: 'a.txt', data: new Uint8Array(4), deflate: false }]))).toBeNull();
    expect(isZip(firmware)).toBe(false);
  });
});
