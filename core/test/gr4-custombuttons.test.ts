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
  it.skipIf(!f120 || !existsSync(f120))('1.20: not offered, refused', async () => {
    const eng = await Engine.open(new Uint8Array(readFileSync(f120!)));
    expect(eng.info.features.customButtons).toBeFalsy();
    await expect(eng.buildFirmware([], [], [], { customButtons: true })).rejects.toMatchObject({ code: 'bad-edit' });
  }, 300_000);
});
