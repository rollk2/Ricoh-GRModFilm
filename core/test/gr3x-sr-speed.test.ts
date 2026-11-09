// SPDX-License-Identifier: GPL-2.0-only
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { assembleWords } from '../src/fw/aspect/arm';
import { buildGr3xAdjResearch } from '../src/fw/gr3x/adj';
import { planGr3xMenu } from '../src/fw/gr3x/geometry';
import { GR3X_SR_GET_CALLS, GR3X_SR_SPEEDS, gr3xSrBoundary } from '../src/fw/gr3x/sr-speed';

const f32 = (bits: number) => new Float32Array(new Uint32Array([bits]).buffer)[0];

describe('SR by shutter speed', () => {
  it('encodes vmov between core and single registers', () => {
    expect(assembleWords('vmov r0, s0; vmov r3, s15; vmov s0, r4; vmoveq r5, s1', 0x53000000)).toEqual([0xee100a10, 0xee173a90, 0xee004a10, 0x0e105a90]);
  });
  it('offers the camera\'s third stops, 1/4000 to 30 s', () => {
    expect(GR3X_SR_SPEEDS.length).toBe(52);
    expect(GR3X_SR_SPEEDS[0]).toBe(1 / 4000);
    expect(GR3X_SR_SPEEDS.at(-1)).toBe(30);
  });
  it('puts the boundary a sixth of a stop above the threshold', () => {
    expect(f32(gr3xSrBoundary(1 / 20))).toBeCloseTo(4.5, 5);
    expect(f32(gr3xSrBoundary(1 / 4000))).toBeCloseTo(12 + 1 / 6, 5);
    expect(f32(gr3xSrBoundary(1))).toBeCloseTo(1 / 6, 5);
    expect(gr3xSrBoundary(30) >> 0).toBeLessThan(0);
    expect(() => gr3xSrBoundary(1 / 21)).toThrow(/not a camera speed/);
    // Between the threshold's speed and the next faster one, as the camera rounds them (log2 of 1/time).
    for (let i = 1; i < GR3X_SR_SPEEDS.length; i++) {
      const b = f32(gr3xSrBoundary(GR3X_SR_SPEEDS[i]));
      expect(Math.log2(1 / GR3X_SR_SPEEDS[i])).toBeLessThan(b);
      expect(Math.log2(1 / GR3X_SR_SPEEDS[i - 1])).toBeGreaterThan(b);
    }
  });
});

const input = process.env.GRMOD_GR3_FIRMWARE;
const menu = planGr3xMenu([{ ratio: '65:24', name: 'XPan' }]);
const film = { dateImprint: true, dateMenu: 'submenu', round7: true, round8: true, round9: true, round10: true, filmMode: { codes: { 64: 'PORT' } }, dateHidden: true, afPoint: true, memoryU: true } as const;
describe.skipIf(!input)('GR III SR by shutter speed', () => {
  it('patches the four calls of the live SR getter and nothing else', async () => {
    const raw = new Uint8Array(readFileSync(input!));
    const plain = await buildGr3xAdjResearch(raw, menu, film);
    const sr = await buildGr3xAdjResearch(raw, menu, { ...film, srSpeed: { seconds: 1 / 20 } });
    expect(sr).toMatchObject({ srSpeed: { seconds: 1 / 20 } });
    const added = sr.sites.filter(s => !plain.sites.some(t => t.address === s.address)).map(s => s.address).sort();
    expect(added).toEqual([...GR3X_SR_GET_CALLS].sort());
    await expect(buildGr3xAdjResearch(raw, menu, { ...film, srSpeed: { seconds: 1 / 20, diag: true } })).rejects.toMatchObject({ code: 'unexpected-layout' });
  }, 240000);
});
