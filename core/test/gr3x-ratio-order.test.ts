// SPDX-License-Identifier: GPL-2.0-only
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { planGr3xMenu } from '../src/fw/gr3x/geometry';
import { encodeGr3xRatioRecipe, readGr3xBuildRecipe } from '../src/fw/gr3x/ratio-recipe';
import { Engine } from '../src/app/engine';

describe('Aspect Ratio menu order', () => {
  const ratios = [{ ratio: '65:24', name: 'XPan' }, { ratio: '4:3', name: '4:3' }];
  it('keeps 3:2, 1:1 and the added ratios without an order, and follows one when given', () => {
    expect(planGr3xMenu(ratios).map(r => r.id)).toEqual([0, 3, 4, 5]);
    const menu = planGr3xMenu(ratios, [4, 0, 5, 3]);
    expect(menu.map(r => r.name)).toEqual(['XPan', '3:2', '4:3', '1:1']);
    expect(() => planGr3xMenu(ratios, [4, 0, 3])).toThrow(/ratio order/);
    expect(() => planGr3xMenu(ratios, [4, 0, 5, 5])).toThrow(/ratio order/);
    expect(() => planGr3xMenu(ratios, [4, 0, 5, 9])).toThrow(/ratio order/);
  });
  it('records the order only when it is not the usual one', () => {
    const base = { round7: true, round8: true, round9: true, round10: true } as const;
    expect(readGr3xBuildRecipe(encodeGr3xRatioRecipe(planGr3xMenu(ratios), base))!.ratioOrder).toBeUndefined();
    expect(readGr3xBuildRecipe(encodeGr3xRatioRecipe(planGr3xMenu(ratios, [0, 3, 4, 5]), base))!.ratioOrder).toBeUndefined();
    expect(readGr3xBuildRecipe(encodeGr3xRatioRecipe(planGr3xMenu(ratios, [4, 0, 5, 3]), base))!.ratioOrder).toEqual([4, 0, 5, 3]);
  });
});

const input = process.env.GRMOD_GR3_FIRMWARE;
describe.skipIf(!input)('GR III Aspect Ratio menu order', () => {
  it('builds a reordered menu from the engine, recorded and recognised', async () => {
    const raw = new Uint8Array(readFileSync(input!));
    const engine = await Engine.open(raw);
    const ratios = [{ ratio: '65:24', name: 'XPan' }];
    const plain = await engine.buildFirmware([], ratios, [], { filmCount: 3 });
    const moved = await engine.buildFirmware([], ratios, [], { filmCount: 3, ratioOrder: [4, 0, 3] });
    expect(moved.sha256).not.toBe(plain.sha256);
    expect(await (await Engine.open(raw)).inspect(moved.file)).toMatchObject({ verified: true });
    expect(await (await Engine.open(raw)).inspect(plain.file)).toMatchObject({ verified: true });
    await expect(engine.buildFirmware([], ratios, [], { filmCount: 3, ratioOrder: [4, 0] })).rejects.toThrow(/ratio order/);
  }, 600000);
});
