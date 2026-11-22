// SPDX-License-Identifier: GPL-2.0-only
// Recipe and ratio packs (ui/src/packs.ts): written, read back, checked, merged.
import { describe, expect, it } from 'vitest';
import { makeRatioPack, makeRecipePack, mergeRatios, PackError, placeRecipes, readRatioPack, readRecipePack } from '../../ui/src/packs';

const portra = {
  names: { en: 'Portra 400', 'zh-CN': '' }, code: 'PORT', halation: { on: true, preview: 2 as const },
  icon: { mode: 'text' as const, text: 'P4', style: 'film' as const },
  preset: { fileName: 'Portra.xmp', kind: 'xmp' as const, text: '<x:xmpmeta>…</x:xmpmeta>' },
};

describe('recipe packs', () => {
  it('reads back what it writes, without empty names or empty recipes', () => {
    const text = makeRecipePack('gr3', [portra, { names: {} }]);
    const pack = readRecipePack(text);
    expect(pack.family).toBe('gr3');
    expect(pack.recipes).toEqual([{ ...portra, names: { en: 'Portra 400' } }]);
  });
  it('drops what is not valid and refuses what is not a recipe pack', () => {
    const odd = JSON.stringify({ format: 'grmod-film-recipes', v: 1, family: 'gr3', recipes: [
      { names: { en: 'Ektar', 'bad key': 'x' }, code: 'toolong', halation: { preview: 7 }, icon: { mode: 'image', image: 'javascript:1' } },
    ] });
    expect(readRecipePack(odd).recipes).toEqual([{ names: { en: 'Ektar' }, icon: { mode: 'keep', text: '', style: 'film' } }]);
    const fail = (t: string): string => { try { readRecipePack(t); return 'read'; } catch (e) { return (e as PackError).code; } };
    expect(fail('not json')).toBe('not-a-pack');
    expect(fail(makeRatioPack([{ ratio: '65:24', name: '' }]))).toBe('other-kind');
    expect(fail(JSON.stringify({ format: 'grmod-film-recipes', v: 2, recipes: [] }))).toBe('newer');
    expect(fail(makeRecipePack('gr3', [{ names: {} }]))).toBe('empty');
  });
  it('GR IV Monochrome packs: version 2, a name, an icon and a .cube only; older versions see a newer pack', () => {
    const apx = { names: { en: 'APX 100' }, icon: { mode: 'text' as const, text: 'GR1', style: 'film' as const },
      preset: { fileName: 'apx.cube', kind: 'cube' as const, text: 'LUT_3D_SIZE 2\n0 0 0\n1 0 0\n0 1 0\n1 1 0\n0 0 1\n1 0 1\n0 1 1\n1 1 1' } };
    const text = makeRecipePack('gr4mono', [apx, { ...portra, names: { en: 'Portra' } }]);
    const raw = JSON.parse(text);
    expect(raw.v).toBe(2);
    expect(raw.family).toBe('gr4mono');
    // Film code, halation and a preset that is not a .cube are not kept.
    expect(raw.recipes[1]).toEqual({ names: { en: 'Portra' }, icon: portra.icon });
    const pack = readRecipePack(text);
    expect(pack.family).toBe('gr4mono');
    expect(pack.recipes).toEqual([apx, { names: { en: 'Portra' }, icon: portra.icon }]);
    // A version-2 pack of another family was not written by this version.
    const fail = (t: string): string => { try { readRecipePack(t); return 'read'; } catch (e) { return (e as PackError).code; } };
    expect(fail(JSON.stringify({ ...raw, family: 'gr4' }))).toBe('newer');
    expect(fail(JSON.stringify({ ...raw, v: 3 }))).toBe('newer');
    expect(readRecipePack(makeRecipePack('gr4', [portra])).family).toBe('gr4');
  });
  it('GR IV packs mark the added looks; a Monochrome pack does not keep the mark', () => {
    const look = { names: { en: 'Astia' }, icon: { mode: 'text' as const, text: 'AS', style: 'film' as const }, added: true };
    const pack = readRecipePack(makeRecipePack('gr4', [portra, look]));
    expect(pack.recipes[1].added).toBe(true);
    expect(pack.recipes[0]).not.toHaveProperty('added');
    expect(readRecipePack(JSON.stringify({ format: 'grmod-film-recipes', v: 1, family: 'gr4', recipes: [{ names: { en: 'A' }, added: 'yes' }] })).recipes[0]).not.toHaveProperty('added');
    expect(readRecipePack(makeRecipePack('gr4mono', [look])).recipes[0]).not.toHaveProperty('added');
  });
  it('places recipes from the first slot, or in the empty ones only', () => {
    const slots = ['A', 'B', 'C', 'D'];
    expect(placeRecipes(slots, () => false, 2, 'replace')).toEqual(['A', 'B']);
    expect(placeRecipes(slots, (id) => id === 'B' || id === 'D', 3, 'add')).toEqual(['B', 'D']);
  });
});

describe('ratio packs', () => {
  it('reads back what it writes and refuses a recipe pack', () => {
    const pack = readRatioPack(makeRatioPack([{ ratio: ' 65:24 ', name: 'XPan' }, { ratio: '', name: 'none' }]));
    expect(pack.ratios).toEqual([{ ratio: '65:24', name: 'XPan' }]);
    expect(() => readRatioPack(makeRecipePack('gr3', [portra]))).toThrow(PackError);
  });
  it('replaces, or adds after the ratios there without the same ratio twice, within the limit', () => {
    const have = [{ ratio: '65:24', name: 'XPan' }, { ratio: '2:1', name: '' }];
    const pack = [{ ratio: '65 : 24', name: 'Pano' }, { ratio: '5:4', name: '' }, { ratio: '7:6', name: '' }];
    expect(mergeRatios(have, pack, 'replace', 9).ratios.map((r) => r.ratio)).toEqual(['65 : 24', '5:4', '7:6']);
    expect(mergeRatios(have, pack, 'add', 9)).toEqual({ ratios: [...have, pack[1], pack[2]], skipped: 1 });
    expect(mergeRatios(have, pack, 'add', 3)).toEqual({ ratios: [...have, pack[1]], skipped: 2 });
  });
});
