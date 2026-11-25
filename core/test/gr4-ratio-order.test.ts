// SPDX-License-Identifier: GPL-2.0-only
/**
 * GR Mod Film 1.3.5: the Aspect Ratio menu's order on the GR IV 1.21 (GR IV Monochrome 1.11), factory ratios included
 * (docs/gr4-mono-recettes-etude.md, section 15). Needs GRMOD_GR4_121_FIRMWARE (and GRMOD_GR4_120_FIRMWARE for the refusal);
 * skipped without them. The menu lists and the Fn cycle are run in the emulator: tools/gr4v121/aspect/boot_checks.py.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { Engine } from '../src/app/engine';
import { ORDER_SITES } from '../src/fw/gr4v121/aspect/build';

const f121 = process.env.GRMOD_GR4_121_FIRMWARE;
const f120 = process.env.GRMOD_GR4_120_FIRMWARE;
const BASE = 0x53000000;

/** The order table a built RTOS image points its seven readers at, and its first `n` bytes. */
function orderOf(rtos: Uint8Array, n: number): number[] {
  const v = new DataView(rtos.buffer, rtos.byteOffset, rtos.byteLength);
  const half = (w: number) => ((w >>> 4) & 0xf000) | (w & 0xfff);
  const tables = new Set(ORDER_SITES.map((site) => {
    const high = site + (site === 0x531bfe5c || site === 0x531d2b54 ? 8 : 4);
    return (half(v.getUint32(site - BASE, true)) | (half(v.getUint32(high - BASE, true)) << 16)) >>> 0;
  }));
  expect(tables.size).toBe(1);
  const t = [...tables][0];
  return [...rtos.subarray(t - BASE, t - BASE + n)];
}

describe('GR IV 1.21: Aspect Ratio menu order', () => {
  it.skipIf(!f121 || !existsSync(f121))('the factory ratios alone: the official table reordered in place, nothing else', async () => {
    const raw = new Uint8Array(readFileSync(f121!));
    const eng = await Engine.open(raw);
    expect(eng.info.features.ratioOrder).toBe(true);
    const g4 = (eng as any).g4, dec: Uint8Array = (eng as any).decoded;
    const rtos = () => dec.slice(g4.RTOS_OFFSET, g4.RTOS_OFFSET + g4.aspect.OFFICIAL_RTOS_LENGTH);
    const icons = () => dec.slice(g4.ICONBIN_OFFSET, g4.ICONBIN_OFFSET + g4.aspect.OFFICIAL_ICONBIN_LENGTH);
    const plain = g4.aspect.installExtensions(rtos(), icons(), [], { guard: true });
    const sorted = g4.aspect.installExtensions(rtos(), icons(), [], { guard: true, ratioOrder: [3, 0, 2, 1] });
    expect(orderOf(plain.rtos, 4)).toEqual([0, 1, 3, 2]);
    expect(orderOf(sorted.rtos, 4)).toEqual([3, 0, 2, 1]);
    // Only the table's word changes inside the official image (the record at the end differs too).
    const n = g4.aspect.OFFICIAL_RTOS_LENGTH;
    const diff: number[] = [];
    for (let i = 0; i < n; i += 4) if (plain.rtos[i] !== sorted.rtos[i] || plain.rtos[i + 1] !== sorted.rtos[i + 1] || plain.rtos[i + 2] !== sorted.rtos[i + 2] || plain.rtos[i + 3] !== sorted.rtos[i + 3]) diff.push(BASE + i);
    expect(diff).toEqual([0x53de6f30]);

    const built = await eng.buildFirmware([], [], [], { noMovie: true, ratioOrder: [3, 0, 2, 1] });
    expect(Object.values(built.checks).every((v) => v === true)).toBe(true);
    const back = await (await Engine.open(raw)).inspect(built.file);
    expect(back.kind).toBe('modified');
    expect(back.verified).toBe(true);
    expect(back.ratioOrder).toEqual([3, 0, 2, 1]);
    expect(back.noMovie).toBe(true);
  }, 600_000);

  it.skipIf(!f121 || !existsSync(f121))('with added ratios: factory and added mixed; the usual order builds as before; the RAW list unchanged', async () => {
    const raw = new Uint8Array(readFileSync(f121!));
    const eng = await Engine.open(raw);
    const ratios = [{ ratio: '65:24', name: 'XPan' }, { ratio: '2:1', name: 'Wide' }];
    const order = [0, 7, 3, 1, 8, 2];
    const g4 = (eng as any).g4, dec: Uint8Array = (eng as any).decoded;
    const rtos = () => dec.slice(g4.RTOS_OFFSET, g4.RTOS_OFFSET + g4.aspect.OFFICIAL_RTOS_LENGTH);
    const icons = () => dec.slice(g4.ICONBIN_OFFSET, g4.ICONBIN_OFFSET + g4.aspect.OFFICIAL_ICONBIN_LENGTH);
    const plan = g4.planRatios(ratios);
    const a = g4.aspect.installExtensions(rtos(), icons(), plan, { guard: true });
    const b = g4.aspect.installExtensions(rtos(), icons(), plan, { guard: true, ratioOrder: order });
    expect(orderOf(a.rtos, 6)).toEqual([0, 1, 3, 2, 7, 8]);
    expect(orderOf(b.rtos, 6)).toEqual(order);
    // Same length, same hooks: the two images differ only in the menu table's bytes and the record (the RAW list is not reordered).
    expect(b.rtos.length - a.rtos.length).toBeLessThanOrEqual(8);
    expect(b.words.map((w: { address: number }) => w.address)).toEqual(a.words.map((w: { address: number }) => w.address));

    const built = await eng.buildFirmware([], ratios, [], { noMovie: true, ratioOrder: order });
    expect(Object.values(built.checks).every((v) => v === true)).toBe(true);
    const back = await (await Engine.open(raw)).inspect(built.file);
    expect(back.verified).toBe(true);
    expect(back.ratioOrder).toEqual(order);
    expect(back.ratios.map((r) => r.name)).toEqual(['XPan', 'Wide']);
    // The usual order is no option: the same file as without it, and nothing recorded.
    const usual = await eng.buildFirmware([], ratios, [], { noMovie: true, ratioOrder: [0, 1, 3, 2, 7, 8] });
    const none = await eng.buildFirmware([], ratios, [], { noMovie: true });
    expect(Buffer.compare(Buffer.from(usual.file), Buffer.from(none.file))).toBe(0);
    expect((await eng.inspect(none.file)).ratioOrder).toBeUndefined();
    // Every ratio once.
    await expect(eng.buildFirmware([], ratios, [], { ratioOrder: [0, 7, 3, 1, 2] })).rejects.toMatchObject({ code: 'bad-edit' });
    await expect(eng.buildFirmware([], ratios, [], { ratioOrder: [0, 7, 3, 1, 8, 8] })).rejects.toMatchObject({ code: 'bad-edit' });
  }, 900_000);

  it.skipIf(!f120 || !existsSync(f120))('1.20: not offered, refused', async () => {
    const eng = await Engine.open(new Uint8Array(readFileSync(f120!)));
    expect(eng.info.features.ratioOrder).toBeFalsy();
    await expect(eng.buildFirmware([], [], [], { ratioOrder: [3, 0, 1, 2] })).rejects.toMatchObject({ code: 'bad-edit' });
  }, 300_000);
});
