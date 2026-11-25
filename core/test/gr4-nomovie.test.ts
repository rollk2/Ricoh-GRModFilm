// SPDX-License-Identifier: GPL-2.0-only
/**
 * GR Mod Film 1.2: no movie on the GR IV Monochrome 1.11 (GR IV 1.21). Needs GRMOD_GR4_121_FIRMWARE
 * (and GRMOD_GR4_120_FIRMWARE for the refusal on the earlier file); skipped without them.
 * The behaviour itself is checked in the emulator: tools/gr4v121/nomovie_probe.py.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { Engine } from '../src/app/engine';

const f121 = process.env.GRMOD_GR4_121_FIRMWARE;
const f120 = process.env.GRMOD_GR4_120_FIRMWARE;

describe('GR IV Monochrome: no movie', () => {
  it.skipIf(!f121 || !existsSync(f121))('1.21: built, self-checked, read back', async () => {
    const raw = new Uint8Array(readFileSync(f121!));
    const eng = await Engine.open(raw);
    expect(eng.info.features.noMovie).toBe(true);
    const built = await eng.buildFirmware([], [], [], { noMovie: true });
    expect(Object.values(built.checks).every((v) => v === true)).toBe(true);
    const back = await eng.inspect(built.file);
    expect(back.kind).toBe('modified');
    expect(back.noMovie).toBe(true);
  }, 300_000);
  it.skipIf(!f120 || !existsSync(f120))('1.20 (convergence step 2): offered, built and read back', async () => {
    const raw = new Uint8Array(readFileSync(f120!));
    const eng = await Engine.open(raw);
    expect(eng.info.features.noMovie).toBe(true);
    const built = await eng.buildFirmware([], [], [], { noMovie: true });
    expect(Object.values(built.checks).every((v) => v === true)).toBe(true);
    const back = await (await Engine.open(raw)).inspect(built.file);
    expect(back.verified).toBe(true);
    expect(back.noMovie).toBe(true);
  }, 300_000);
});
