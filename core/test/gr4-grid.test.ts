// SPDX-License-Identifier: GPL-2.0-only
/**
 * GR Mod Film 1.3.5: custom grid lines on the GR IV 1.21 (GR IV Monochrome 1.11), ported from GR Mod 0.9.1
 * (`fw/gr4v121/aspect/grid.ts`). Needs GRMOD_GR4_121_FIRMWARE; skipped without it. The hooks are run in the emulator:
 * tools/gr4v121/grid_probe.py.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { Engine } from '../src/app/engine';
import { CAMERA_GRID, gridByte, gridLinesOf } from '../src/fw/gr4v121/aspect/grid';

const f121 = process.env.GRMOD_GR4_121_FIRMWARE;
const f120 = process.env.GRMOD_GR4_120_FIRMWARE;
const BASE = 0x53000000;
// 3x3: the thirds and both diagonals; 4x4: the quarters only (no centre lines, no diagonals).
const GRID = { g3: [true, false, true, true, false, true, true, true], g4: [true, false, true, true, false, true, false, false] };

describe('GR IV 1.21: custom grid lines', () => {
  it('one byte per style, line i in bit i', () => {
    expect(gridByte(CAMERA_GRID.g3)).toBe(0b00101101);
    expect(gridLinesOf(gridByte(GRID.g3))).toEqual(GRID.g3);
  });

  it.skipIf(!f121 || !existsSync(f121))('two hooks; built, read back with the battery and the ratio order; the camera grid is no option', async () => {
    const raw = new Uint8Array(readFileSync(f121!));
    const eng = await Engine.open(raw, { newFirmware: true });
    expect(eng.info.features.customGrid).toBe(true);
    const g4 = (eng as any).g4, dec: Uint8Array = (eng as any).decoded;
    const r = g4.aspect.installExtensions(dec.slice(g4.RTOS_OFFSET, g4.RTOS_OFFSET + g4.aspect.OFFICIAL_RTOS_LENGTH), dec.slice(g4.ICONBIN_OFFSET, g4.ICONBIN_OFFSET + g4.aspect.OFFICIAL_ICONBIN_LENGTH), [], { guard: true, customButtons: true, customGrid: GRID }, 4);
    const word = (a: number) => new DataView(r.rtos.buffer, r.rtos.byteOffset).getUint32(a - BASE, true);
    expect(word(0x5359c510) >>> 24).toBe(0xea);
    expect(word(0x5359c2ec) >>> 24).toBe(0xea);

    const built = await eng.buildFirmware([], [], [], { noMovie: true, customGrid: GRID, batteryPercent: true, ratioOrder: [0, 3, 1, 2] });
    expect(Object.values(built.checks).every((v) => v === true)).toBe(true);
    const back = await (await Engine.open(raw, { newFirmware: true })).inspect(built.file);
    expect(back.verified).toBe(true);
    expect(back.customGrid).toEqual(GRID);
    expect(back.batteryPercent).toBe(true);
    expect(back.ratioOrder).toEqual([0, 3, 1, 2]);
    // The camera's own grid: no option, the same file as without it.
    const same = await eng.buildFirmware([], [], [], { noMovie: true, customGrid: CAMERA_GRID });
    const none = await eng.buildFirmware([], [], [], { noMovie: true });
    expect(Buffer.compare(Buffer.from(same.file), Buffer.from(none.file))).toBe(0);
    await expect(eng.buildFirmware([], [], [], { customGrid: { g3: [true], g4: GRID.g4 } })).rejects.toMatchObject({ code: 'bad-edit' });
  }, 900_000);

  it.skipIf(!f120 || !existsSync(f120))('1.20: not offered in this program, refused', async () => {
    const eng = await Engine.open(new Uint8Array(readFileSync(f120!)), { newFirmware: true });
    expect(eng.info.features.customGrid).toBeFalsy();
    await expect(eng.buildFirmware([], [], [], { customGrid: GRID })).rejects.toMatchObject({ code: 'bad-edit' });
  }, 300_000);
});
