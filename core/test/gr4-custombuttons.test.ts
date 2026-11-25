// SPDX-License-Identifier: GPL-2.0-only
/**
 * GR Mod Film 1.2: the custom buttons on the GR IV Monochrome 1.11 (GR IV 1.21): every function on every button,
 * Hold lines, Macro Button line, ADJ Red Filter. Needs GRMOD_GR4_121_FIRMWARE (and GRMOD_GR4_120_FIRMWARE for the
 * refusal on the earlier file); skipped without them. The behaviour itself is checked in the emulator:
 * tools/gr4v121/holdlines_probe.py, holdbuttons_probe.py, adjredfilter_probe.py.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { Engine } from '../src/app/engine';

const f121 = process.env.GRMOD_GR4_121_FIRMWARE;
const f120 = process.env.GRMOD_GR4_120_FIRMWARE;

describe('GR IV Monochrome: custom buttons', () => {
  it.skipIf(!f121 || !existsSync(f121))('1.21: alone, built, self-checked, read back', async () => {
    const raw = new Uint8Array(readFileSync(f121!));
    const eng = await Engine.open(raw);
    expect(eng.info.features.customButtons).toBe(true);
    const built = await eng.buildFirmware([], [], [], { customButtons: true });
    expect(Object.values(built.checks).every((v) => v === true)).toBe(true);
    const back = await eng.inspect(built.file);
    expect(back.kind).toBe('modified');
    expect(back.verified).toBe(true);
    expect(back.customButtons).toBe(true);
    expect(back.noMovie).toBeFalsy();
  }, 300_000);
  it.skipIf(!f121 || !existsSync(f121))('1.21: with every other addition (they hook the same menus and ADJ lever)', async () => {
    const raw = new Uint8Array(readFileSync(f121!));
    const eng = await Engine.open(raw);
    const built = await eng.buildFirmware([], [], [], { customButtons: true, noMovie: true, adjSoftFocus: true, dateStamp: true, monoUnlock: true, directFlash: true, hdrGainMap: true, exposurePreview: true, adjSlots: 8, brightAuto: 'bright' });
    expect(Object.values(built.checks).every((v) => v === true)).toBe(true);
    const back = await eng.inspect(built.file);
    expect(back.verified).toBe(true);
    expect(back.customButtons).toBe(true);
    expect(back.noMovie).toBe(true);
    expect(back.exposurePreview).toBe(true);
  }, 300_000);
  // Convergence step 2 (docs/fusion-0.9.md): GR Mod Film's additions are part of the 1.20 program, which builds 1.20 and 1.21.
  for (const [release, file] of [['1.20', f120], ['1.21', f121]] as const) {
    it.skipIf(!file || !existsSync(file))(`${release}: with GR Mod 0.9's additions (Constant Light, grain, shadow correction, flash TTL, white balance, movie AF); Sensor Shift refused`, async () => {
      const raw = new Uint8Array(readFileSync(file!));
      const eng = await Engine.open(raw);
      expect(eng.info.features.customButtons).toBe(true);
      expect(eng.info.features.sensorShift).toBeFalsy();
      const built = await eng.buildFirmware([], [{ ratio: '65:24', name: 'XPan' }], [], { noMovie: true, constantLight: true, filmGrain: true, shadowLearn: true, flashTtl: true, awbLearn: true, videoAf: true, exposurePreview: true, adjSlots: 8, dateStamp: true, batteryPercent: true });
      expect(Object.values(built.checks).every((v) => v === true)).toBe(true);
      const back = await (await Engine.open(raw)).inspect(built.file);
      expect(back.verified).toBe(true);
      expect(back.customButtons).toBe(true);
      expect(back.noMovie).toBe(true);
      expect(back.constantLight).toBe(true);
      expect(back.flashTtl).toBe(true);
      // Fn function 46: our Macro Mode, GR Mod 0.9's Sensor Shift.
      await expect(eng.buildFirmware([], [], [], { sensorShift: true })).rejects.toMatchObject({ code: 'bad-edit' });
    }, 600_000);
  }
});
