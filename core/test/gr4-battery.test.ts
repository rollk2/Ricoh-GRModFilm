// SPDX-License-Identifier: GPL-2.0-only
/**
 * GR Mod Film 1.3.5: the battery percentage on the GR IV 1.21 (GR IV Monochrome 1.11), ported from GR Mod 0.9.1
 * (`fw/gr4v121/aspect/battery.ts`). Needs GRMOD_GR4_121_FIRMWARE (and GRMOD_GR4_120_FIRMWARE for the refusal); skipped
 * without them. The hook itself is run in the emulator: tools/gr4v121/battery_probe.py.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { Engine } from '../src/app/engine';
import { BATTERY_ICON_ID, batteryIcons } from '../src/fw/gr4v121/aspect/battery';
import { ICON_CATALOG } from '../src/fw/gr4v121/aspect/build';

const f121 = process.env.GRMOD_GR4_121_FIRMWARE;
const f120 = process.env.GRMOD_GR4_120_FIRMWARE;
const BASE = 0x53000000;

describe('GR IV 1.21: battery percentage', () => {
  it('draws twelve 60x40 icons: 10..100 %, then "?" and "!"', () => {
    const icons = batteryIcons();
    expect(icons.map((x) => x.id)).toEqual(Array.from({ length: 12 }, (_, i) => BATTERY_ICON_ID + i));
    for (const x of icons) expect(x.px.length).toBe(60 * 40 * 4);
  });

  it.skipIf(!f121 || !existsSync(f121))('the hook, the icons, the zero fill up to the heap; built, read back, with the ratio order', async () => {
    const raw = new Uint8Array(readFileSync(f121!));
    const eng = await Engine.open(raw);
    expect(eng.info.features.batteryPercent).toBe(true);
    const g4 = (eng as any).g4, dec: Uint8Array = (eng as any).decoded;
    const rtos = () => dec.slice(g4.RTOS_OFFSET, g4.RTOS_OFFSET + g4.aspect.OFFICIAL_RTOS_LENGTH);
    const icons = () => dec.slice(g4.ICONBIN_OFFSET, g4.ICONBIN_OFFSET + g4.aspect.OFFICIAL_ICONBIN_LENGTH);
    const plain = g4.aspect.installExtensions(rtos(), icons(), [], { guard: true, customButtons: true, noMovie: true }, 4);
    const r = g4.aspect.installExtensions(rtos(), icons(), [], { guard: true, customButtons: true, noMovie: true, batteryPercent: true }, 4);
    const word = (img: Uint8Array, a: number) => new DataView(img.buffer, img.byteOffset).getUint32(a - BASE, true);
    // GetBatteryIcon now branches out; the start-up zero fill reaches the heap; the twelve icons are in the catalog.
    expect(word(plain.rtos, 0x533aa150)).toBe(0xe3510001);
    expect(word(r.rtos, 0x533aa150) >>> 24).toBe(0xea);
    expect(word(plain.rtos, 0x53000460)).toBe(0x55839040);
    expect(word(r.rtos, 0x53000460)).toBe(0x55839080);
    for (let i = 0; i < 12; i++) expect(word(r.rtos, ICON_CATALOG + (BATTERY_ICON_ID + i) * 4)).not.toBe(0);
    expect(r.iconbin.length - plain.iconbin.length).toBeGreaterThanOrEqual(12 * 60 * 40 * 4);
    // Every word the battery changes in the official image: the hook, the zero fill, the icon catalog and its bounds.
    const before = new Set(plain.words.map((w: { address: number }) => w.address));
    const added = r.words.map((w: { address: number }) => w.address).filter((a: number) => !before.has(a));
    for (const a of added) expect(a === 0x533aa150 || a === 0x53000460 || (a >= ICON_CATALOG - 0x40 && a < ICON_CATALOG + 1280 * 4)).toBe(true);

    const built = await eng.buildFirmware([], [], [], { noMovie: true, batteryPercent: true, ratioOrder: [3, 0, 1, 2] });
    expect(Object.values(built.checks).every((v) => v === true)).toBe(true);
    const back = await (await Engine.open(raw)).inspect(built.file);
    expect(back.verified).toBe(true);
    expect(back.batteryPercent).toBe(true);
    expect(back.ratioOrder).toEqual([3, 0, 1, 2]);
    expect(back.noMovie).toBe(true);
    // Without the option nothing is recorded.
    const none = await eng.buildFirmware([], [], [], { noMovie: true });
    expect((await eng.inspect(none.file)).batteryPercent).toBeUndefined();
  }, 900_000);

  it.skipIf(!f120 || !existsSync(f120))('1.20: offered by the GR Mod 0.9 program, built and read back', async () => {
    const raw = new Uint8Array(readFileSync(f120!));
    const eng = await Engine.open(raw);
    expect(eng.info.features.batteryPercent).toBe(true);
    const built = await eng.buildFirmware([], [], [], { batteryPercent: true });
    const back = await (await Engine.open(raw)).inspect(built.file);
    expect(back.verified).toBe(true);
    expect(back.batteryPercent).toEqual({ batteryPercent: true }.batteryPercent);
  }, 600_000);
});
