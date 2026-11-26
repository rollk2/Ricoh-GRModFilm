// SPDX-License-Identifier: GPL-2.0-only
// GR III 2.10 / IIIx 1.60, Sleep Mode on a button (sleep-button.ts, T-SLP1): its RAM flag and its refusals.
// The function itself runs in the emulator (tools/gr3x/sleep_button_probe.py).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildGr3xAdjResearch } from '../src/fw/gr3x/adj';
import { GR3X_FORMAT_FLAG } from '../src/fw/gr3x/film-format';
import { planGr3xMenu } from '../src/fw/gr3x/geometry';
import { GR3X_PLAY_LAST } from '../src/fw/gr3x/play-last';
import { GR3X_FILL_R10, GR3X_R10 } from '../src/fw/gr3x/round10';
import { GR3X_SLEEP_FLAG } from '../src/fw/gr3x/sleep-button';
import { GR3X_SR_LAST, GR3X_SR_STATE } from '../src/fw/gr3x/sr-speed';
import { GR3X_HOLD_STATE } from '../src/fw/gr3x/hold';
import { GR3X_ROLL_DIAG } from '../src/fw/gr3x/film-roll';

describe('GR III Sleep Mode button: its flag', () => {
  it('has a byte of its own in the zero-filled words, not the format rewind\'s (T-SLP1 shared it)', () => {
    expect(GR3X_SLEEP_FLAG).not.toBe(GR3X_FORMAT_FLAG);
    expect(GR3X_SLEEP_FLAG).not.toBe(GR3X_SR_LAST);
    expect(GR3X_SLEEP_FLAG).not.toBe(GR3X_SR_STATE);
    expect(GR3X_SLEEP_FLAG >= GR3X_R10.slotState && GR3X_SLEEP_FLAG < GR3X_FILL_R10).toBe(true);
    // The End Screen's reserved word (test builds only), before the folders' return address (GR3X_ROLL_DIAG - 4).
    expect(GR3X_SLEEP_FLAG >= GR3X_R10.endScreenChoice && GR3X_SLEEP_FLAG < GR3X_ROLL_DIAG - 4).toBe(true);
    for (const [at, size] of [[GR3X_PLAY_LAST, 4], [GR3X_HOLD_STATE, 2], [GR3X_FORMAT_FLAG, 1]] as const) {
      expect(GR3X_SLEEP_FLAG >= at && GR3X_SLEEP_FLAG < at + size).toBe(false);
    }
  });
});

const input = process.env.GRMOD_GR3_FIRMWARE;
const menu = planGr3xMenu([{ ratio: '65:24', name: 'XPan' }]);
const film = { dateImprint: true, dateMenu: 'submenu', round7: true, round8: true, round9: true, round10: true, filmMode: { codes: { 64: 'PORT' } }, dateHidden: true, afPoint: true, memoryU: true,
  wbButton: true, macroButton: true, rewindButton: true } as const;
describe.skipIf(!input)('GR III Sleep Mode button: refusals', () => {
  it('is refused with the two test builds that use its word (AF timing, film probe)', async () => {
    const raw = new Uint8Array(readFileSync(input!));
    await expect(buildGr3xAdjResearch(raw, menu, { ...film, sleepButton: true, afTime: true, grain: true, grainTag: 'keys' })).rejects.toThrow(/sleep button/);
    await expect(buildGr3xAdjResearch(raw, menu, { ...film, sleepButton: true, filmProbe: true })).rejects.toThrow(/sleep button/);
  }, 240000);
});
