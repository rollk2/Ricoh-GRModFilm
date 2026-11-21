// Black-and-white recipes from a .cube LUT (GR IV Monochrome): the neutral axis, the warnings, the curve of the added slot.
import { describe, expect, it } from 'vitest';
import { MONO_MIXING_LIMIT, MONO_TONING_LIMIT, monoLutFromCube, monoRecipeCurve } from '../src/color/mono';

/** A .cube of size n whose output is f(r, g, b) (red varies fastest, as the format wants). */
function cube(n: number, f: (r: number, g: number, b: number) => [number, number, number], title = 'test'): string {
  const lines = [`TITLE "${title}"`, `LUT_3D_SIZE ${n}`];
  for (let b = 0; b < n; b++) for (let g = 0; g < n; g++) for (let r = 0; r < n; r++) lines.push(f(r / (n - 1), g / (n - 1), b / (n - 1)).map((v) => v.toFixed(6)).join(' '));
  return lines.join('\n');
}
const luma = (r: number, g: number, b: number): number => 0.2126 * r + 0.7152 * g + 0.0722 * b;

describe('mono recipes', () => {
  it('a grey LUT of the luminance: its curve on the neutral axis, no warning', () => {
    const lut = monoLutFromCube(cube(17, (r, g, b) => { const y = Math.pow(luma(r, g, b), 1.2); return [y, y, y]; }, 'Grey'));
    expect(lut.title).toBe('Grey');
    for (const i of [0, 64, 128, 255]) expect(lut.neutral[i]).toBeCloseTo(Math.pow(i / 255, 1.2), 2);
    expect(lut.toning).toBeLessThan(MONO_TONING_LIMIT);
    expect(lut.mixing).toBeLessThan(MONO_MIXING_LIMIT);
  });

  it('reports a toning (channels apart) and a mix of channels (a red filter)', () => {
    const sepia = monoLutFromCube(cube(17, (r, g, b) => { const y = luma(r, g, b); return [Math.min(1, y * 1.1), y, y * 0.85]; }));
    expect(sepia.toning).toBeGreaterThan(MONO_TONING_LIMIT);
    const red = monoLutFromCube(cube(17, (r) => [r, r, r]));
    expect(red.toning).toBeLessThan(MONO_TONING_LIMIT);
    expect(red.mixing).toBeGreaterThan(MONO_MIXING_LIMIT);
  });

  it('the curve is the LUT\'s neutral axis (the input is already Monochrome Standard\'s rendering), non-decreasing, within 0..16383', () => {
    const identity = monoLutFromCube(cube(17, (r, g, b) => [r, g, b]));
    const same = monoRecipeCurve(identity.neutral);
    for (let i = 0; i < 256; i++) expect(Math.abs(same[i] - Math.round(16383 * i / 255))).toBeLessThanOrEqual(2);
    // A LUT that dips is kept non-decreasing.
    const dip = monoLutFromCube(cube(17, (r, g, b) => { const y = luma(r, g, b); const v = y < 0.5 ? y : Math.max(0, y - 0.2 * Math.sin((y - 0.5) * Math.PI)); return [v, v, v]; }));
    const c = monoRecipeCurve(dip.neutral);
    for (let i = 1; i < 256; i++) expect(c[i]).toBeGreaterThanOrEqual(c[i - 1]);
    expect(Math.max(...c)).toBeLessThanOrEqual(16383);
    expect(() => monoRecipeCurve(new Float64Array(10))).toThrow();
  });
});
