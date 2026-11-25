// SPDX-License-Identifier: GPL-2.0-only
/**
 * GR Mod Film, convergence step 2 (docs/fusion-0.9.md): files of GR Mod Film 1.2 .. 1.3.5 for GR IV 1.21 (Monochrome 1.11)
 * were built by GR Mod Film's own copy of the program, kept frozen in `fw/gr4v121film`. Their record and their Hold words
 * differ from the 1.20 program's; the engine recognises them with that copy. Built here with the copy, as 1.3.5 built them,
 * then read back by the engine. Needs GRMOD_GR4_121_FIRMWARE.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { Engine } from '../src/app/engine';
import * as Legacy from '../src/fw/gr4v121film';

const f121 = process.env.GRMOD_GR4_121_FIRMWARE;
const GRID = { g3: [true, false, true, true, false, true, true, true], g4: [true, false, true, true, false, true, false, false] };

describe.skipIf(!f121 || !existsSync(f121))('GR IV 1.21: files of GR Mod Film 1.2 .. 1.3.5', () => {
  for (const [name, features] of [
    ['buttons and no movie (revision 4)', { guard: true, customButtons: true, noMovie: true }],
    ['with the ratio order, the battery and the 1.3.5 grid', { guard: true, customButtons: true, noMovie: true, ratioOrder: [3, 0, 2, 1], batteryPercent: true, customGrid: GRID, dateStamp: true }],
  ] as const) {
    it(`${name}: recognised and verified`, async () => {
      const raw = new Uint8Array(readFileSync(f121!));
      const old = await Legacy.buildFirmware(raw, [], [], [], features as never);
      const back = await (await Engine.open(raw)).inspect(old.file);
      expect(back.kind).toBe('modified');
      expect(back.verified).toBe(true);
      expect(back.customButtons).toBe(true);
      expect(back.noMovie).toBe(true);
      if ('ratioOrder' in features) {
        expect(back.ratioOrder).toEqual([3, 0, 2, 1]);
        expect(back.batteryPercent).toBe(true);
        expect(back.customGrid).toEqual(GRID);
      }
      // The 1.20 program does not build that file again (other Hold words, another record): the copy does.
      const now = await (await Engine.open(raw)).buildFirmware([], [], [], { noMovie: true });
      expect(Buffer.compare(Buffer.from(now.file), Buffer.from(old.file))).not.toBe(0);
    }, 600_000);
  }
});
