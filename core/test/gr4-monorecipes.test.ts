// SPDX-License-Identifier: GPL-2.0-only
/**
 * GR Mod Film 1.3: black-and-white recipes on the GR IV Monochrome 1.11 (GR IV 1.21): added looks made from .cube LUTs
 * (docs/gr4-mono-recettes-etude.md, sections 12 to 14). Needs GRMOD_GR4_121_FIRMWARE (and GRMOD_GR4_120_FIRMWARE for the refusal);
 * skipped without them. The looks themselves are checked in the emulator: tools/gr4v121/mono_recipe_probe.py.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { Engine } from '../src/app/engine';

const f121 = process.env.GRMOD_GR4_121_FIRMWARE;
const f120 = process.env.GRMOD_GR4_120_FIRMWARE;

/** A .cube of size 9: f(r, g, b) per entry, red fastest. */
function cube(f: (r: number, g: number, b: number) => [number, number, number]): string {
  const n = 9, lines = ['TITLE "Test"', `LUT_3D_SIZE ${n}`];
  for (let b = 0; b < n; b++) for (let g = 0; g < n; g++) for (let r = 0; r < n; r++) lines.push(f(r / (n - 1), g / (n - 1), b / (n - 1)).map((v) => v.toFixed(6)).join(' '));
  return lines.join('\n');
}
const grey = cube((r, g, b) => { const y = Math.pow(0.2126 * r + 0.7152 * g + 0.0722 * b, 1.15); return [y, y, y]; });
const redFilter = cube((r) => [r, r, r]);
const icon = new Uint8Array(40 * 40 * 4);

describe('GR IV Monochrome: black-and-white recipes', () => {
  it.skipIf(!f121 || !existsSync(f121))('1.21: converts a .cube, warns of a mix of channels, refuses another preset kind', async () => {
    const eng = await Engine.open(new Uint8Array(readFileSync(f121!)), { newFirmware: true });
    expect(eng.info.features.monoRecipes).toBe(true);
    const r = eng.convertPreset('cube', grey, undefined, { mono: true });
    expect(r.warnings).toEqual([]);
    expect(Array.from(r.matrixQ13)).toEqual([8192, 0, 0, 0, 8192, 0, 0, 0, 8192]);
    expect(Array.from(r.curves[0])).toEqual(Array.from(r.curves[1]));
    expect(Array.from(r.curves[0])).toEqual(Array.from(r.curves[2]));
    for (let i = 1; i < 256; i++) expect(r.curves[0][i]).toBeGreaterThanOrEqual(r.curves[0][i - 1]);
    expect(eng.convertPreset('cube', redFilter, undefined, { mono: true }).warnings).toContain('mono-mixing');
    expect(() => eng.convertPreset('xmp', '<x:xmpmeta/>', undefined, { mono: true })).toThrow(expect.objectContaining({ code: 'mono-cube-only' }));
  }, 300_000);
  it.skipIf(!f121 || !existsSync(f121))('1.21: two recipes with the whole product (no movie, buttons), built, self-checked, read back', async () => {
    const raw = new Uint8Array(readFileSync(f121!));
    const eng = await Engine.open(raw, { newFirmware: true });
    const slots = [grey, redFilter].map((text, i) => {
      const r = eng.convertPreset('cube', text, undefined, { mono: true });
      return { name: `Mono ${i + 1}`, matrixQ13: r.matrixQ13, curves: r.curves, icon };
    });
    const built = await eng.buildFirmware([], [], [], { noMovie: true, extraSlots: slots, monoRecipes: true });
    expect(Object.values(built.checks).every((v) => v === true)).toBe(true);
    const back = await (await Engine.open(raw, { newFirmware: true })).inspect(built.file);
    expect(back.kind).toBe('modified');
    expect(back.verified).toBe(true);
    expect(back.monoRecipes).toBe(true);
    expect(back.noMovie).toBe(true);
    expect(back.customButtons).toBe(true);
    expect(back.extraSlots?.map((x) => x.name)).toEqual(['Mono 1', 'Mono 2']);
    // Without added slots there is nothing to make black and white.
    await expect(eng.buildFirmware([], [], [], { noMovie: true, monoRecipes: true })).rejects.toMatchObject({ code: 'bad-edit' });
  }, 600_000);
  it.skipIf(!f120 || !existsSync(f120))('1.20: not offered, refused', async () => {
    const eng = await Engine.open(new Uint8Array(readFileSync(f120!)), { newFirmware: true });
    expect(eng.info.features.monoRecipes).toBeFalsy();
    expect(() => eng.convertPreset('cube', grey, undefined, { mono: true })).toThrow(expect.objectContaining({ code: 'bad-edit' }));
  }, 300_000);
});
