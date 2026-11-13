// SPDX-License-Identifier: GPL-2.0-only
// The community collection (community/, ui/src/packs.ts): pack meta, the checks of the CI, the site's index.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { communityEntry, communityIndex, makeRatioPack, makeRecipePack, readRatioPack } from '../../ui/src/packs';

const recipe = { names: { en: 'Portra' }, code: 'PORT' };
const meta = { title: 'Warm set', author: 'Ana', description: 'Two warm films', license: 'CC0-1.0' };
const entry = (path: string, text: string): string => { try { communityEntry(path, text, text.length); return 'ok'; } catch (e) { return (e as Error).message; } };

describe('community packs', () => {
  it('keep their title, author, description and licence, trimmed', () => {
    const pack = readRatioPack(makeRatioPack([{ ratio: '65:24', name: 'XPan' }], { title: '  Pano ', author: '', license: 'CC0-1.0' }));
    expect(pack).toMatchObject({ title: 'Pano', license: 'CC0-1.0' });
    expect(pack).not.toHaveProperty('author');
  });
  it('are listed with their kind, films or ratios', () => {
    const e = communityEntry('recipes/warm.grfrecipes', makeRecipePack('gr3', [recipe, { names: { 'zh-CN': '金' } }], meta), 100);
    expect(e).toEqual({ kind: 'recipes', file: 'recipes/warm.grfrecipes', size: 100, title: 'Warm set', author: 'Ana', description: 'Two warm films', family: 'gr3', items: ['Portra', '金'] });
    const r = communityEntry('ratios/pano.grfratios', makeRatioPack([{ ratio: '65:24', name: 'XPan' }, { ratio: '2:1', name: '' }], meta), 10);
    expect(r.items).toEqual(['65:24 XPan', '2:1']);
    expect(communityIndex([r, e]).packs.map((p) => p.kind)).toEqual(['ratios', 'recipes']);
  });
  it('are refused in the wrong place, with the wrong name, without title or CC0, too large or invalid', () => {
    const good = makeRecipePack('gr3', [recipe], meta);
    expect(entry('recipes/warm.grfrecipes', good)).toBe('ok');
    expect(entry('warm.grfrecipes', good)).toMatch(/recipes\/ or ratios\//);
    expect(entry('recipes/my warm.grfrecipes', good)).toMatch(/plain file name/);
    expect(entry('ratios/warm.grfrecipes', good)).toMatch(/ends with .grfratios/);
    expect(entry('ratios/warm.grfratios', good)).toMatch(/not a valid ratios pack \(other-kind\)/);
    expect(entry('recipes/warm.grfrecipes', makeRecipePack('gr3', [recipe], { ...meta, title: '' }))).toMatch(/no title/);
    expect(entry('recipes/warm.grfrecipes', makeRecipePack('gr3', [recipe], { ...meta, license: 'CC-BY-4.0' }))).toMatch(/CC0-1.0 packs only/);
    expect(() => communityEntry('recipes/warm.grfrecipes', good, 9_000_000)).toThrow(/larger than/);
  });
  it('in the repository are all valid', () => {
    const root = join(__dirname, '../../community');
    for (const kind of ['recipes', 'ratios']) {
      for (const name of readdirSync(join(root, kind)).filter((n) => n !== 'README.md' && n !== '.gitkeep')) {
        const text = readFileSync(join(root, kind, name), 'utf8');
        expect(entry(`${kind}/${name}`, text)).toBe('ok');
      }
    }
  });
});
