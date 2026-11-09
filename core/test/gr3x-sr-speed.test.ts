// SPDX-License-Identifier: GPL-2.0-only
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { assembleWords } from '../src/fw/aspect/arm';
import { buildGr3xAdjResearch } from '../src/fw/gr3x/adj';
import { planGr3xMenu } from '../src/fw/gr3x/geometry';
import { GR3X_SR_GET_CALLS, GR3X_SR_GETTER, GR3X_SR_LIST, GR3X_SR_LIVE_LOAD, GR3X_SR_SPEEDS, gr3xSrBoundary, gr3xSrSpeedText } from '../src/fw/gr3x/sr-speed';

const f32 = (key: number) => new Float32Array(new Int32Array([(key >> 0) < 0 ? (key >> 0) ^ 0x7fffffff : key >> 0]).buffer)[0];

describe('SR by shutter speed', () => {
  it('encodes vmov between core and single registers', () => {
    expect(assembleWords('vmov r0, s0; vmov r3, s15; vmov s0, r4; vmoveq r5, s1', 0x53000000)).toEqual([0xee100a10, 0xee173a90, 0xee004a10, 0x0e105a90]);
  });
  it('names the speeds as the camera shows them', () => {
    expect(GR3X_SR_SPEEDS.map(gr3xSrSpeedText).slice(0, 3)).toEqual(['1/4000', '1/3200', '1/2500']);
    expect(gr3xSrSpeedText(1 / 3)).toBe('1/3');
    expect(gr3xSrSpeedText(0.4)).toBe('0.4"');
    expect(gr3xSrSpeedText(1.3)).toBe('1.3"');
    expect(gr3xSrSpeedText(30)).toBe('30"');
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
    // The keys keep the floats' order, negative ones included.
    const keys = GR3X_SR_SPEEDS.map(s => gr3xSrBoundary(s) >> 0);
    for (let i = 1; i < keys.length; i++) expect(keys[i]).toBeLessThan(keys[i - 1]);
    expect(f32(gr3xSrBoundary(2))).toBeCloseTo(-1 + 1 / 6, 5);
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
    // The menu: Shake Reduction's list and the byte's two readers too, and 52 more texts.
    const list = await buildGr3xAdjResearch(raw, menu, { ...film, srSpeed: {} });
    const listAdded = list.sites.filter(s => !plain.sites.some(t => t.address === s.address)).map(s => s.address).sort();
    expect(listAdded).toEqual([...GR3X_SR_GET_CALLS, GR3X_SR_GETTER + 8, GR3X_SR_LIVE_LOAD, ...Object.values(GR3X_SR_LIST)].sort());
    expect((list as unknown as { catalogs: { textColumns: number } }).catalogs.textColumns - (plain as unknown as { catalogs: { textColumns: number } }).catalogs.textColumns).toBe(52);
  }, 240000);
});
