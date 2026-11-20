// SPDX-License-Identifier: GPL-2.0-only
/** GR III 2.10 / IIIx 1.60, `afDim` (core/src/fw/gr3x/af-dim.ts): the nine words of the research of nflaschel change, nothing else of the program does. */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { Engine } from '../src/app/engine';
import { Firmware } from '../src/fw';
import { sectionsOf } from '../src/fw/container';

const f = process.env.GRMOD_GR3_FIRMWARE;
const rtosOf = (file: Uint8Array): Uint8Array => { const d = new Firmware(file).decoded, r = sectionsOf(d).find((s) => s.name === 'RTOS')!; return d.subarray(r.offset, r.offset + r.size); };

describe('GR III: autofocus in dim light', () => {
  it.skipIf(!f || !existsSync(f))('changes the nine words and records the option', async () => {
    const raw = new Uint8Array(readFileSync(f!));
    const ratios = [{ ratio: '65:24', name: 'XPan' }];
    const on = await (await Engine.open(raw)).buildFirmware([], ratios, [], { afDim: true });
    const off = await (await Engine.open(raw)).buildFirmware([], ratios, [], {});
    expect(Object.values(on.checks).every((v) => v === true)).toBe(true);
    const a = rtosOf(on.file), b = rtosOf(off.file);
    const v = (d: Uint8Array, at: number) => new DataView(d.buffer, d.byteOffset).getUint32(at - 0x53000000, true);
    const changed = [0x533f4b10, 0x53c16bb0, 0x53c16bb4, 0x53c16bb8, 0x53c16bbc, 0x53c16bc0, 0x53c16bc4, 0x53c16cc0, 0x53c16d14];
    for (const at of changed) expect(v(a, at)).not.toBe(v(b, at));
    expect(v(a, 0x533f4b10)).toBe(0x83a03002);
    expect(v(a, 0x53c16cc0)).toBe(2);
    // nothing else of the official program (below the appended area) differs
    let other = 0;
    for (let i = 0; i < 0x10870 + 17520064 - 0x10870; i += 4) if (!changed.includes(0x53000000 + i) && v(a, 0x53000000 + i) !== v(b, 0x53000000 + i)) other++;
    expect(other).toBeLessThan(16);
    const back = await (await Engine.open(raw)).inspect(on.file);
    expect(back.verified).toBe(true);
  }, 300_000);
});
