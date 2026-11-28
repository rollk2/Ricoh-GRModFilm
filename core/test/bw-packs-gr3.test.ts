// SPDX-License-Identifier: GPL-2.0-only
// 1.3.6: the black-and-white film packs for the GR III / IIIx (community/recipes/bw-films-*-gr3.grfrecipes). Each LUT goes
// through the films' own conversion: recognised as black and white (one row of weights for R, G and B), close to the LUT.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { readRecipePack } from '../../ui/src/packs';
import { convertGr3xCube } from '../src/color/gr3x-import';

const pack = (name: string) => readRecipePack(readFileSync(new URL(`../../community/recipes/${name}.grfrecipes`, import.meta.url), 'utf8'));
const gr3 = [pack('bw-films-agfa-fuji-polaroid-rollei-gr3'), pack('bw-films-ilford-kodak-gr3')];
const mono = [pack('bw-films-agfa-fuji-polaroid-rollei-monochrome'), pack('bw-films-ilford-kodak-monochrome')];

describe('GR III black-and-white film packs', () => {
  it('are the Monochrome packs\' films, for the GR III, each with a code of its own', () => {
    const codes = gr3.flatMap((p) => p.recipes.map((r) => r.code));
    expect(gr3.map((p) => p.family)).toEqual(['gr3', 'gr3']);
    expect(codes).toHaveLength(24);
    expect(new Set(codes).size).toBe(24);
    for (const c of codes) expect(c).toMatch(/^[A-Z0-9]{4}$/);
    gr3.forEach((p, k) => expect(p.recipes.map((r) => [r.names, r.preset?.text, r.icon])).toEqual(mono[k].recipes.map((r) => [r.names, r.preset?.text, r.icon])));
  });
  it('each film converts as black and white, close to its LUT', () => {
    for (const r of gr3.flatMap((p) => p.recipes)) {
      const c = convertGr3xCube(r.preset!.text);
      const M = c.params.M1;
      expect(M.every((row) => row.every((v, k) => v === M[0][k])), r.names.en).toBe(true);
      // Rollei IR400 (an infrared film: a strong negative blue weight, clipped) is the one far from its LUT.
      expect(c.meanDE, r.names.en).toBeLessThan(r.names.en === 'Rollei IR400' ? 4 : 1.6);
    }
  }, 600000);
});
