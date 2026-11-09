// SPDX-License-Identifier: GPL-2.0-only
/**
 * GR III 2.10 / IIIx 1.60, `holdButtons` (0.9.3): a function for the long press of Fn and of the four
 * keys of the 4-way pad, chosen in Fn Button Settings (lines « Hold ... », see wb-button.ts).
 *
 * The key codes at ActionModel::OnEvent (0x53221a1c), T-HOLD0 on the camera (2026-11-09):
 *  - up (Macro button) 26 pressed / 27 held, repeated / 28 released; down (WB button) 29 / 30 / 31;
 *    left (ISO button) 32 / 33 / 34; right (Drive button) 35 / 36 / 37;
 *  - Fn 22 pressed, 23 released, no held code: the events' translation (0x532231e4, Fn's event type
 *    0x1b: state 2 pressed, its sub-state at + 4 0 first, else held; state 1 released) drops Fn's
 *    held sub-state (0x53223708, `bne` to the « nothing » return), as it turns Wireless's into 60
 *    (Hold Wireless) and the pad's into 27 / 30 / 33 / 36. There it becomes GR3X_FN_HELD (99), a code
 *    of ours that only the filter below sees (it never reaches the camera's OnEvent).
 * The filter (at OnEvent's entry, after the rear dial's when that is off), in the viewfinder only
 * (controller 0x08000000 or 0x08000002: its key handler 0x5320c844 runs the buttons' functions at once,
 * through CaptureReadySwitchFunctionModel) and for a key whose Hold line is not Off (the 4-way pad
 * also not moving the AF point):
 *  - pressed: kept back (state: the key's press code, « hold run » cleared);
 *  - first held code: the Hold function, as a press and a release of that key sent to OnEvent with
 *    the key's own setting (Fn 0x922, ISO 0x924, Drive 0x926, WB 0xabb, Macro 0xac5) holding the Hold
 *    function for the time of the two calls; later held codes kept back;
 *  - released: after a Hold, kept back; else the press sent then the release goes on (a short press,
 *    on release).
 * Any other key, controller or state: as before. Hold settings: padding bytes of every record (0 Off,
 * the factory value; else the function), which follow the BOX as the rest of the record.
 */
import { branchWord } from '../aspect/arm';
import { FirmwareError } from '../types';
import type { Gr3xSite } from './round10';

const lo = (v: number) => v & 0xffff, hi = (v: number) => v >>> 16;
const fail = (what: string): never => { throw new FirmwareError('unexpected-layout', `IIIx hold buttons: ${what}`); };

export const GR3X_KEY_EVENT_ENTRY = 0x53221a1c;
/** Fn's held sub-state in the events' translation: `bne` to the « nothing » return. */
export const GR3X_FN_HELD_SITE = 0x53223708, GR3X_FN_HELD_DROP = 0x53223424;
export const GR3X_FN_HELD = 99;
/** The keys: Fn, up (Macro), down (WB), left (ISO), right (Drive); their press code (the pad's held
 * and released codes follow it), their Hold setting and their own setting. Padding bytes 0x806,
 * 0x84a, 0x88e, 0xacf, 0xae3: no exact access through a record (settings_layout_probe.py); the
 * wide ones are another object's (0x806: a hardware block's bit fields, 0x5373xxxx; 0x88e: the
 * live values' record, 0x5355xxxx), the debug dump's reads, or none. */
export const GR3X_HOLD_KEYS = [
  { name: 'Fn', press: 22, release: 23, held: GR3X_FN_HELD, hold: 0x806, own: 0x922, ownFunction: 0 },
  { name: 'Macro', press: 26, release: 28, held: 27, hold: 0x84a, own: 0xac5, ownFunction: 45 },
  { name: 'WB', press: 29, release: 31, held: 30, hold: 0x88e, own: 0xabb, ownFunction: 44 },
  { name: 'ISO', press: 32, release: 34, held: 33, hold: 0xacf, own: 0x924, ownFunction: 0 },
  { name: 'Drive', press: 35, release: 37, held: 36, hold: 0xae3, own: 0x926, ownFunction: 0 },
] as const;
/** RAM: the press kept back (its code, 0 none) and « hold run »: round 10's zero-filled words, the
 * area's last two bytes (0x558043be, 0x558043bf: after the AF Point and Apply to U states). */
export const GR3X_HOLD_STATE = 0x558043be;
const RECORD_POINTER = 0x55063f34;
const APP = 0x5320ad88, CONTROLLERS = 0x5320aefc, STATE = 0x5320b61c, AF_MOVE = 0x532a441c;

export interface Gr3xHoldProgram {
  code(source: string): number;
  patch(address: number, expected: number, replacement: number, reason: string): void;
  u32(address: number): number;
  sites: readonly Gr3xSite[];
}

/**
 * Installs the Fn held code and the filter. `max`: the highest function (above: Off). Returns the
 * filter's address, to be jumped to with OnEvent's arguments (r0 this, r1 the key, lr) in place of
 * its first instruction: the rear dial's filter goes on there, else the caller patches OnEvent's
 * entry to it (`entryPatched` false: done here).
 */
export function installGr3xHoldButtons(p: Gr3xHoldProgram, max: number, entryPatched: boolean) {
  const at = GR3X_KEY_EVENT_ENTRY;
  if (p.u32(at) !== 0xe1a0c00d) fail('key entry');
  const dropWord = branchWord(GR3X_FN_HELD_SITE, GR3X_FN_HELD_DROP, 1);
  if (p.u32(GR3X_FN_HELD_SITE) !== dropWord || p.u32(GR3X_FN_HELD_SITE - 8) !== 0xe5923004 || p.u32(GR3X_FN_HELD_SITE + 4) !== 0xe3a01016)
    fail('Fn held sub-state');
  if (p.sites.some(s => s.address === GR3X_FN_HELD_SITE)) fail('Fn held sub-state already patched');
  if (!entryPatched && p.sites.some(s => s.address === at)) fail('key entry already patched');
  // OnEvent after its first instruction: callable with bl (r0 this, r1 the key).
  const orig = p.code(`mov ip,sp;b #${at + 4};`);
  const S = `movw ip,#${lo(GR3X_HOLD_STATE)};movt ip,#${hi(GR3X_HOLD_STATE)};`;
  const R = (label: string) => `movw ip,#${lo(RECORD_POINTER)};movt ip,#${hi(RECORD_POINTER)};ldr ip,[ip];cmp ip,#0x40000000;blo ${label};cmp ip,#0xc0000000;bhs ${label};tst ip,#3;bne ${label};`;
  const K = GR3X_HOLD_KEYS;
  // r4 this, r5 the key; r6 the key's index, r7 the phase (0 pressed, 1 held, 2 released), r8 the Hold function.
  const classify = K.map((k, i) => [[k.press, 0], [k.held, 1], [k.release, 2]].map(([c, ph]) =>
    `cmp r5,#${c};moveq r6,#${i};moveq r7,#${ph};beq cls;`).join('')).join('');
  const holdByte = K.map((k, i) => `cmp r6,#${i};movweq r0,#${k.hold};`).join('');
  const ownByte = K.map((k, i) => `cmp r6,#${i};movweq r0,#${k.own};`).join('');
  // The value the key's own setting needs to run the function in r3 (WB, Macro: their own function is 0).
  const ownValue = K.filter(k => k.ownFunction).map(k => `cmp r6,#${K.indexOf(k)};bne v${k.name};cmp r3,#${k.ownFunction};moveq r3,#0;v${k.name}:`).join('');
  const pressOf = K.map((k, i) => `cmp r6,#${i};moveq r1,#${k.press};`).join('');
  const releaseOf = K.map((k, i) => `cmp r6,#${i};moveq r1,#${k.release};`).join('');
  const filter = p.code(`push {r0,r1,r4,r5,r6,r7,r8,lr};mov r4,r0;mov r5,r1;
    ${classify}b pass;
    cls:${R('pass')}${holdByte}ldrb r8,[ip,r0];cmp r8,#0;beq pass;cmp r8,#${max};bhi pass;
    bl #${APP};bl #${CONTROLLERS};ldr r0,[r0];bic r0,r0,#2;cmp r0,#0x08000000;bne pass;
    cmp r6,#0;beq noaf;bl #${APP};bl #${STATE};bl #${AF_MOVE};cmp r0,#0;bne pass;noaf:
    ${pressOf}${S}cmp r7,#0;bne notpress;strb r1,[ip];mov r0,#0;strb r0,[ip,#1];b handled;
    notpress:ldrb r0,[ip];cmp r0,r1;bne pass;cmp r7,#1;bne release;
    ldrb r0,[ip,#1];cmp r0,#0;bne handled;mov r0,#1;strb r0,[ip,#1];
    ${R('handled')}${ownByte}ldrb r2,[ip,r0];mov r3,r8;${ownValue}strb r3,[ip,r0];push {r0,r1,r2,ip};
    mov r0,r4;bl #${orig};${releaseOf}mov r0,r4;bl #${orig};pop {r0,r1,r2,ip};strb r2,[ip,r0];b handled;
    release:mov r0,#0;strb r0,[ip];ldrb r0,[ip,#1];cmp r0,#0;bne handled;mov r0,r4;bl #${orig};
    pass:cmp r5,#${GR3X_FN_HELD};beq none;pop {r0,r1,r4,r5,r6,r7,r8,lr};mov ip,sp;b #${at + 4};
    none:mov r0,#0;str r0,[sp];pop {r0,r1,r4,r5,r6,r7,r8,pc};
    handled:mov r0,#1;str r0,[sp];pop {r0,r1,r4,r5,r6,r7,r8,pc};`);
  // Fn held: GR3X_FN_HELD to OnEvent (its entry: the filters), the translation's frame undone as its
  // other ends do with ldm sp,{r4,r5,fp,sp,lr} (r0 is still this).
  const fnHeld = p.code(`mov r1,#${GR3X_FN_HELD};sub sp,fp,#0x14;ldr r4,[sp];ldr r5,[sp,#4];ldr lr,[sp,#16];ldr fp,[sp,#8];ldr sp,[sp,#12];b #${at};`);
  p.patch(GR3X_FN_HELD_SITE, dropWord, branchWord(GR3X_FN_HELD_SITE, fnHeld, 1), 'hold buttons: Fn\'s held state as a key of ours');
  if (!entryPatched) p.patch(at, 0xe1a0c00d, branchWord(at, filter), 'hold buttons: long presses at the key entry');
  return { holdFilter: filter, holdOrig: orig, holdFnHeld: fnHeld };
}

/** The Hold lines' names in each text row (ja en fr de es pt it nl da sv fi pl cs hu tr el ru ko
 * zh-TW zh-CN th), from the row's own line name (Fn Button, ISO Button, ...) as that row's « Hold
 * Wireless Btn. » says hold. */
export function gr3xHoldLineName(row: number, button: string): string {
  const f: readonly ((x: string) => string)[] = [
    x => `${x}長押し`, x => `Hold ${x}`, x => `Maint. ${x}`, x => `${x} halten`, x => `Mant. ${x}`, x => `Manter ${x}`,
    x => `Mant. ${x}`, x => `${x} indr.`, x => `Hold ${x}`, x => `Håll ${x}`, x => `Pito ${x}`, x => `wstrz ${x}`,
    x => `podr. ${x}`, x => `Tartás ${x}`, x => `Tut ${x}`, x => `αναμ. ${x}`, x => `удерж. ${x}`, x => `${x} 긴누름`,
    x => `長按${x}`, x => `长按${x}`, x => `กด${x}ค้าง`,
  ];
  if (row < 0 || row >= f.length) fail(`text row ${row}`);
  return f[row](button);
}
