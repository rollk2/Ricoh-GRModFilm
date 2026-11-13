// SPDX-License-Identifier: GPL-2.0-only
// The WB button in Fn Button Settings (wb-button.ts). What its code does when it runs is checked in
// an emulator (tools/gr3x/wb_button_probe.py, and film_roll_check.py for the functions' list).
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildGr3xAdjResearch } from '../src/fw/gr3x/adj';
import { Engine } from '../src/app/engine';
import { planGr3xMenu } from '../src/fw/gr3x/geometry';
import { GR3X_ISO_GETTER_CALL, GR3X_ISO_KEY_ID, GR3X_MACRO_KEY_HANDLER, GR3X_MACRO_LINE_NAMES, GR3X_WB_KEY_EVENT, GR3X_WB_KEY_HANDLER, gr3xWbLineName } from '../src/fw/gr3x/wb-button';
import { readGr3xBuildRecipe, encodeGr3xRatioRecipe } from '../src/fw/gr3x/ratio-recipe';
import { GR3X_EVENT_TRANSLATION, GR3X_KEY_EVENT_ENTRY, gr3xHoldLineName } from '../src/fw/gr3x/hold';
import { GR3X_ADJ_SLOT_GETTERS } from '../src/fw/gr3x/film-roll';

const input = process.env.GRMOD_GR3_FIRMWARE;
const menu = planGr3xMenu([{ ratio: '65:24', name: 'XPan' }]);
const film = { dateImprint: true, dateMenu: 'submenu', round7: true, round8: true, round9: true, round10: true, filmMode: { codes: { 64: 'PORT' } }, dateHidden: true, afPoint: true, memoryU: true } as const;

describe('WB button names and recipe', () => {
  it('names the line after each language\'s ISO Button', () => {
    expect(gr3xWbLineName('ISO Button')).toBe('WB Button');
    expect(gr3xWbLineName('Touche ISO')).toBe('Touche WB');
    expect(gr3xWbLineName('ISOボタン')).toBe('WBボタン');
    expect(gr3xWbLineName('感光度按鈕')).toBe('白平衡按鈕');
    expect(() => gr3xWbLineName('Fn Button')).toThrow(/no ISO/);
  });
  it('is recorded in the recipe with the film mode only', () => {
    const at = (r: Uint8Array) => readGr3xBuildRecipe(r)!;
    const withWb = encodeGr3xRatioRecipe(menu, { round7: true, round8: true, round9: true, round10: true, dateImprint: true, filmMode: { codes: { 64: 'PORT' } }, wbButton: true });
    expect(at(withWb)).toMatchObject({ wbButton: true, filmMode: { codes: { 64: 'PORT' } } });
    const noFilm = encodeGr3xRatioRecipe(menu, { round7: true, round8: true, round9: true, round10: true, dateImprint: true, wbButton: true });
    expect(at(noFilm)).not.toHaveProperty('wbButton');
    const withMacro = encodeGr3xRatioRecipe(menu, { round7: true, round8: true, round9: true, round10: true, dateImprint: true, filmMode: { codes: {} }, wbButton: true, macroButton: true });
    expect(at(withMacro)).toMatchObject({ wbButton: true, macroButton: true });
    const macroAlone = encodeGr3xRatioRecipe(menu, { round7: true, round8: true, round9: true, round10: true, dateImprint: true, filmMode: { codes: {} }, macroButton: true });
    expect(at(macroAlone)).not.toHaveProperty('macroButton');
  });
  it('names the Hold lines in the 21 text rows', () => {
    expect(gr3xHoldLineName(1, 'Fn Button')).toBe('Hold Fn Button');
    expect(gr3xHoldLineName(2, 'Touche ISO')).toBe('Maint. Touche ISO');
    expect(gr3xHoldLineName(0, 'Fnボタン')).toBe('Fnボタン長押し');
    expect(() => gr3xHoldLineName(21, 'x')).toThrow();
  });
  it('has a Macro Button name for each of the 21 text rows', () => {
    expect(GR3X_MACRO_LINE_NAMES.length).toBe(21);
    expect(GR3X_MACRO_LINE_NAMES[1]).toBe('Macro Button');
    expect(GR3X_MACRO_LINE_NAMES[2]).toBe('Touche macro');
  });
});

describe.skipIf(!input)('GR III WB button', () => {
  let raw: Uint8Array;
  beforeAll(() => { raw = new Uint8Array(readFileSync(input!)); });
  it('adds its hooks to the film mode build and nothing else', async () => {
    const plain = await buildGr3xAdjResearch(raw, menu, film);
    const wb = await buildGr3xAdjResearch(raw, menu, { ...film, wbButton: true });
    expect(wb).toMatchObject({ wbButton: true });
    expect(plain).not.toHaveProperty('wbButton');
    const added = wb.sites.filter(s => !plain.sites.some(t => t.address === s.address));
    // The WB button's 14 sites, and the Movie/Wireless lists with GR Mod Film's functions (2 x 3).
    expect(added.filter(s => /^WB button/.test(s.reason)).length).toBe(14);
    expect(added.filter(s => /Wireless list/.test(s.reason)).length).toBe(6);
    expect(added.length).toBe(20);
    expect(wb.sites.find(s => s.address === GR3X_WB_KEY_HANDLER)!).toMatchObject({ expected: '0dc0a0e1' });
    expect(wb.sites.find(s => s.address === GR3X_WB_KEY_EVENT)!).toMatchObject({ expected: '007098e5' });
    // The sites both builds patch keep their place; only the appended code differs.
    for (const s of plain.sites) expect(wb.sites.find(t => t.address === s.address)!.expected).toBe(s.expected);
    const e = wb.entries as Record<string, number>;
    for (const k of ['wbOpen', 'wbKeyEntry', 'wbKeyEvent', 'wbScreenLines', 'wbScreenSetup', 'wbScreenOpen', 'wbScreenDraw', 'wbScreenHelp', 'wbListSet', 'wbListIsCurrent']) expect(e[k]).toBeGreaterThan(0x53000000);
  }, 240000);
  it('adds the Macro button\'s three sites to the WB button\'s', async () => {
    const wb = await buildGr3xAdjResearch(raw, menu, { ...film, wbButton: true });
    const both = await buildGr3xAdjResearch(raw, menu, { ...film, wbButton: true, macroButton: true });
    expect(both).toMatchObject({ wbButton: true, macroButton: true });
    const added = both.sites.filter(s => !wb.sites.some(t => t.address === s.address)).map(s => s.address).sort();
    expect(added).toEqual([GR3X_MACRO_KEY_HANDLER, GR3X_ISO_GETTER_CALL, GR3X_ISO_KEY_ID].sort());
    const e = both.entries as Record<string, number>;
    for (const k of ['macroPress', 'macroKeyEntry', 'isoKeySetting', 'isoKeyId', 'macroScreenValue', 'macroListSet', 'macroListIsCurrent']) expect(e[k]).toBeGreaterThan(0x53000000);
    await expect(buildGr3xAdjResearch(raw, menu, { ...film, macroButton: true })).rejects.toMatchObject({ code: 'unexpected-layout' });
  }, 240000);
  it('adds Snap DOF without a new site, with the Macro button only', async () => {
    const both = await buildGr3xAdjResearch(raw, menu, { ...film, wbButton: true, macroButton: true });
    const snap = await buildGr3xAdjResearch(raw, menu, { ...film, wbButton: true, macroButton: true, snapDof: true });
    expect(snap).toMatchObject({ snapDof: true });
    expect(snap.sites.map(s => s.address).sort()).toEqual(both.sites.map(s => s.address).sort());
    expect((snap.entries as Record<string, number>).snapStep).toBeGreaterThan(0x53000000);
    await expect(buildGr3xAdjResearch(raw, menu, { ...film, wbButton: true, snapDof: true })).rejects.toMatchObject({ code: 'unexpected-layout' });
  }, 240000);
  it('adds the Hold lines\' filter at the key entry, unless the rear dial filter has it', async () => {
    const base = { ...film, wbButton: true, macroButton: true, snapDof: true } as const;
    const snap = await buildGr3xAdjResearch(raw, menu, base);
    const hold = await buildGr3xAdjResearch(raw, menu, { ...base, holdButtons: true });
    expect(hold).toMatchObject({ holdButtons: true });
    const added = (b: typeof hold, a: typeof snap) => b.sites.filter(s => !a.sites.some(t => t.address === s.address)).map(s => s.address).sort();
    expect(added(hold, snap)).toEqual([GR3X_KEY_EVENT_ENTRY]);
    const dial = await buildGr3xAdjResearch(raw, menu, { ...base, rearDialOff: true });
    const both = await buildGr3xAdjResearch(raw, menu, { ...base, rearDialOff: true, holdButtons: true });
    expect(added(both, dial)).toEqual([]);
    const e = both.entries as Record<string, number>;
    for (const k of ['holdFilter', 'holdOrig', 'hold0ListSet', 'hold4ListIsCurrent']) expect(e[k]).toBeGreaterThan(0x53000000);
    await expect(buildGr3xAdjResearch(raw, menu, { ...film, wbButton: true, holdButtons: true })).rejects.toMatchObject({ code: 'unexpected-layout' });
  }, 240000);
  it('adds Rewind Film as button function 46, with the Macro button and without Snap DOF', async () => {
    const plain = await buildGr3xAdjResearch(raw, menu, { ...film, wbButton: true, macroButton: true });
    const rwb = await buildGr3xAdjResearch(raw, menu, { ...film, wbButton: true, macroButton: true, rewindButton: true });
    expect(rwb).toMatchObject({ rewindButton: true });
    expect((rwb.entries as Record<string, number>).rewindPress).toBeGreaterThan(0x53000000);
    await expect(buildGr3xAdjResearch(raw, menu, { ...film, wbButton: true, macroButton: true, snapDof: true, rewindButton: true })).rejects.toMatchObject({ code: 'unexpected-layout' });
    await expect(buildGr3xAdjResearch(raw, menu, { ...film, wbButton: true, rewindButton: true })).rejects.toMatchObject({ code: 'unexpected-layout' });
  }, 240000);
  it('adds Fn + the front dial to the Hold buttons\' filter, with the rear dial off only', async () => {
    const hold = await buildGr3xAdjResearch(raw, menu, { ...film, wbButton: true, macroButton: true, holdButtons: true, rearDialOff: true });
    const dial = await buildGr3xAdjResearch(raw, menu, { ...film, wbButton: true, macroButton: true, holdButtons: true, rearDialOff: true, fnDial: true });
    expect(dial).toMatchObject({ fnDial: true });
    // One more site: the events' translation (the front dial's turns as the rear dial's while Fn is held).
    expect(dial.sites.map(s => s.address).sort()).toEqual([...hold.sites.map(s => s.address), GR3X_EVENT_TRANSLATION].sort());
    await expect(buildGr3xAdjResearch(raw, menu, { ...film, wbButton: true, macroButton: true, holdButtons: true, fnDial: true })).rejects.toMatchObject({ code: 'unexpected-layout' });
  }, 240000);
  it('locks the film settings while a roll is loaded: menu lines, Fn functions, ADJ slots', async () => {
    const plain = await buildGr3xAdjResearch(raw, menu, film);
    const lock = await buildGr3xAdjResearch(raw, menu, { ...film, rollLock: true });
    expect(lock).toMatchObject({ rollLock: true });
    // T-LOCK2: the ADJ lever's five slot getters; the lines and the Fn functions use sites the film mode has.
    const added = lock.sites.filter(s => !plain.sites.some(t => t.address === s.address)).map(s => s.address).sort();
    expect(added).toEqual([...GR3X_ADJ_SLOT_GETTERS].sort());
    expect((lock.entries as Record<string, number>).linesHidden).toBeGreaterThan(0x53000000);
    await expect(buildGr3xAdjResearch(raw, menu, { dateImprint: true, dateMenu: 'submenu', round7: true, round8: true, round9: true, round10: true, rollLock: true })).rejects.toMatchObject({ code: 'unexpected-layout' });
  }, 240000);
  it('hides camera settings (menu, buttons, ADJ lever) with their values, recorded and recognised', async () => {
    const engine = await Engine.open(raw);
    const ratios = [{ ratio: '65:24', name: 'XPan' }];
    const base = { filmCount: 3, adjSoftFocus: true, afPoint: true, memoryU: true, filmMode: { codes: {} }, noMovie: true, wbButton: true, macroButton: true, grain: true } as const;
    const hiddenSettings = { faceEye: 0, afc: 2, flash: 1, gf2: 0, flashComp: 3 };
    const built = await engine.buildFirmware([], ratios, [], { ...base, hiddenSettings });
    expect(await (await Engine.open(raw)).inspect(built.file)).toMatchObject({ verified: true });
    const plain = await engine.buildFirmware([], ratios, [], base);
    expect(plain.sha256).not.toBe(built.sha256);
    await expect(engine.buildFirmware([], ratios, [], { ...base, hiddenSettings: { flash: 7 } })).rejects.toThrow(/value 7/);
    await expect(engine.buildFirmware([], ratios, [], { ...base, hiddenSettings: { macro: 0 } as never })).rejects.toThrow(/unknown setting/);
    await expect(engine.buildFirmware([], ratios, [], { filmCount: 3, hiddenSettings })).rejects.toThrow(/film mode/);
  }, 900000);
  it('0.9.7: gives the film mode Hide Settings in Setup (the camera chooses), recorded and recognised', async () => {
    const engine = await Engine.open(raw);
    const ratios = [{ ratio: '65:24', name: 'XPan' }];
    const base = { filmCount: 3, adjSoftFocus: true, afPoint: true, memoryU: true, filmMode: { codes: {} }, noMovie: true, wbButton: true, macroButton: true, grain: true } as const;
    const built = await engine.buildFirmware([], ratios, [], base);
    expect(await (await Engine.open(raw)).inspect(built.file)).toMatchObject({ verified: true });
    const recipe = readGr3xBuildRecipe(encodeGr3xRatioRecipe(planGr3xMenu(ratios), { round7: true, round8: true, round9: true, round10: true, afPoint: true, filmMode: { codes: {} }, hideMenu: true }))!;
    expect(recipe.hideMenu).toBe(true);
    const withFile = readGr3xBuildRecipe(encodeGr3xRatioRecipe(planGr3xMenu(ratios), { round7: true, round8: true, round9: true, round10: true, afPoint: true, filmMode: { codes: {} }, hideMenu: true, settingsFile: { version: '0.9.8' } }))!;
    expect(withFile.settingsFile).toEqual({ version: '0.9.8' });
    expect(readGr3xBuildRecipe(encodeGr3xRatioRecipe(planGr3xMenu(ratios), { round7: true, round8: true, round9: true, round10: true, filmMode: { codes: {} }, hideMenu: true }))!.hideMenu).toBeUndefined();
  }, 900000);
  it('needs the film mode', async () => {
    await expect(buildGr3xAdjResearch(raw, menu, { dateImprint: true, dateMenu: 'submenu', round7: true, round8: true, round9: true, round10: true, wbButton: true })).rejects.toMatchObject({ code: 'unexpected-layout' });
    await expect(buildGr3xAdjResearch(raw, menu, { dateImprint: true, dateMenu: 'submenu', round7: true, round8: true, round9: true, round10: true, filmRoll: 'fn7', wbButton: true })).rejects.toMatchObject({ code: 'unexpected-layout' });
  }, 240000);
  it('is built by the engine with the film mode, recorded and recognised', async () => {
    const engine = await Engine.open(raw);
    const ratios = [{ ratio: '65:24', name: 'XPan' }];
    const built = await engine.buildFirmware([], ratios, [], { filmCount: 3, adjSoftFocus: true, afPoint: true, memoryU: true, filmMode: { codes: {} }, noMovie: true, wbButton: true, macroButton: true });
    expect(await (await Engine.open(raw)).inspect(built.file)).toMatchObject({ verified: true });
    await expect(engine.buildFirmware([], ratios, [], { filmCount: 3, filmMode: { codes: {} }, macroButton: true })).rejects.toThrow(/WB button/);
    const without = await engine.buildFirmware([], ratios, [], { filmCount: 3, adjSoftFocus: true, afPoint: true, memoryU: true, filmMode: { codes: {} }, noMovie: true });
    expect(without.sha256).not.toBe(built.sha256);
    await expect(engine.buildFirmware([], ratios, [], { filmCount: 0, dateStamp: true, wbButton: true })).rejects.toThrow(/film mode/);
  }, 600000);
  it('builds Snap DOF and the rear dial off from the engine, recorded and recognised', async () => {
    const engine = await Engine.open(raw);
    const ratios = [{ ratio: '65:24', name: 'XPan' }];
    const base = { filmCount: 3, adjSoftFocus: true, afPoint: true, memoryU: true, filmMode: { codes: {} }, noMovie: true, wbButton: true, macroButton: true, grain: true } as const;
    const built = await engine.buildFirmware([], ratios, [], { ...base, snapDof: true, holdButtons: true, rollLock: true, playLast: true, rearDialOff: true });
    const seen = await (await Engine.open(raw)).inspect(built.file);
    expect(seen).toMatchObject({ verified: true });
    const plain = await engine.buildFirmware([], ratios, [], base);
    const snap = await engine.buildFirmware([], ratios, [], { ...base, snapDof: true });
    const dial = await engine.buildFirmware([], ratios, [], { ...base, rearDialOff: true });
    expect(new Set([plain.sha256, snap.sha256, dial.sha256, built.sha256]).size).toBe(4);
    for (const b of [snap, dial]) expect(await (await Engine.open(raw)).inspect(b.file)).toMatchObject({ verified: true });
    await expect(engine.buildFirmware([], ratios, [], { ...base, macroButton: false, snapDof: true })).rejects.toThrow(/Snap DOF/);
    await expect(engine.buildFirmware([], ratios, [], { ...base, macroButton: false, holdButtons: true })).rejects.toThrow(/Hold lines/);
  }, 900000);
  it('builds SR by shutter speed and Fn + the front dial from the engine, recorded and recognised', async () => {
    const engine = await Engine.open(raw);
    const ratios = [{ ratio: '65:24', name: 'XPan' }];
    const base = { filmCount: 3, adjSoftFocus: true, afPoint: true, memoryU: true, filmMode: { codes: {} }, noMovie: true, wbButton: true, macroButton: true, holdButtons: true, grain: true } as const;
    const full = await engine.buildFirmware([], ratios, [], { ...base, rollLock: true, playLast: true, rearDialOff: true, srSpeed: true });
    expect(await (await Engine.open(raw)).inspect(full.file)).toMatchObject({ verified: true });
    const sr = await engine.buildFirmware([], ratios, [], { ...base, srSpeed: true });
    const dial = await engine.buildFirmware([], ratios, [], { ...base, rearDialOff: true });
    const plain = await engine.buildFirmware([], ratios, [], base);
    expect(new Set([plain.sha256, sr.sha256, dial.sha256, full.sha256]).size).toBe(4);
    for (const b of [sr, dial]) expect(await (await Engine.open(raw)).inspect(b.file)).toMatchObject({ verified: true });
    // The rear dial off without the Hold lines: no Fn + front dial.
    const bare = await engine.buildFirmware([], ratios, [], { filmCount: 3, adjSoftFocus: true, afPoint: true, memoryU: true, rearDialOff: true, srSpeed: true });
    expect(await (await Engine.open(raw)).inspect(bare.file)).toMatchObject({ verified: true });
    await expect(engine.buildFirmware([], ratios, [], { filmCount: 3, srSpeed: true, gr3Round: 9 } as never)).rejects.toThrow(/round 10/);
  }, 900000);
});
