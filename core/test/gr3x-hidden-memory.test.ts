// SPDX-License-Identifier: GPL-2.0-only
// T-HIDE3: a hidden setting's Mode Memory box leaves the list and is held « memorized » with the value.
import { describe, expect, it } from 'vitest';
import { gr3xHiddenPlan } from '../src/fw/gr3x/hidden-settings';

describe('hidden settings and Mode Memory', () => {
  it('hides the boxes of Flash Mode, Flash Exposure Comp. and GF-2 Flash Mode, and writes them memorized', () => {
    const plan = gr3xHiddenPlan({ faceEye: 2, afAssist: 0, afc: 1, mfMag: 0, flash: 0, gf2: 1, flashComp: 3 });
    expect(plan.memoryItems.sort((a, b) => a - b)).toEqual([5, 6, 10]);
    for (const box of [0xaf8, 0xafa, 0xb24]) expect(plan.bytes).toContainEqual([box, 1, 0]);
    expect(plan.bytes).toContainEqual([0xb22, 1, 0]);
  });
  it('leaves Mode Memory alone for settings without a box', () => {
    const plan = gr3xHiddenPlan({ faceEye: 2, afAssist: 0, afc: 1, mfMag: 0 });
    expect(plan.memoryItems).toEqual([]);
    expect(plan.bytes.map(b => b[0]).sort((a, b) => a - b)).toEqual([0x12c, 0x12e, 0x13c, 0x140]);
  });
});
