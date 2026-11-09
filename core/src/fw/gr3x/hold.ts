// SPDX-License-Identifier: GPL-2.0-only
/**
 * GR III 2.10 / IIIx 1.60, `holdButtons` (0.9.3): a function for the long press of Fn and of the four
 * keys of the 4-way pad, chosen in Fn Button Settings (lines « Hold ... », see wb-button.ts).
 *
 * The key codes at ActionModel::OnEvent (0x53221a1c), T-HOLD0 on the camera (2026-11-09):
 *  - up (Macro button) 26 pressed / 27 held, repeated / 28 released; down (WB button) 29 / 30 / 31;
 *    left (ISO button) 32 / 33 / 34; right (Drive button) 35 / 36 / 37;
 *  - Fn 22 pressed, 23 released, no held code (T-HOLD2: the events' translation, 0x532231e4, drops
 *    any held sub-state of Fn's event type 0x1b at 0x53223708, but none comes: turned into a code of
 *    ours, it never showed). Fn's long press is timed: tk_get_otm at the press and at the release,
 *    GR3X_FN_HOLD_MS or more runs the Hold function, on release.
 * The filter (at OnEvent's entry, after the rear dial's when that is off), in the viewfinder only
 * (controller 0x08000000 or 0x08000002: its key handler 0x5320c844 runs the buttons' functions at once,
 * through CaptureReadySwitchFunctionModel) and for a key whose Hold line is not Off (the 4-way pad
 * also not moving the AF point):
 *  - pressed: kept back (state: the key's press code, « hold run » cleared);
 *  - first held code (Fn: its release, held long enough): the Hold function, as a press and a
 *    release of that key sent to OnEvent with the key's own setting (Fn 0x922, ISO 0x924, Drive 0x926, WB 0xabb, Macro 0xac5) holding the Hold
 *    function for the time of the two calls; later held codes kept back;
 *  - released: after a Hold, kept back; else the press sent then the release goes on (a short press,
 *    on release).
 * Any other key, controller or state: as before. Hold settings: padding bytes of every record (0 Off,
 * the factory value; else the function), which follow the BOX as the rest of the record.
 */
import { branchWord } from '../aspect/arm';
import { FirmwareError } from '../types';
import type { Gr3xSite } from './round10';
import { gr3xRingNote } from './play-probe';

const lo = (v: number) => v & 0xffff, hi = (v: number) => v >>> 16;
const fail = (what: string): never => { throw new FirmwareError('unexpected-layout', `IIIx hold buttons: ${what}`); };

export const GR3X_KEY_EVENT_ENTRY = 0x53221a1c;
/** T-Kernel's tk_get_otm (function code 0x80510100: after tk_set_tim / tk_get_tim, before tk_dly_tsk,
 * the cyclic handlers' five and the alarms' five, by their argument counts): SYSTIM { hi, lo } in ms. */
export const GR3X_GET_OTM = 0x53050b7c;
/** Fn's long press: at least this long between its press and its release. */
export const GR3X_FN_HOLD_MS = 600;
/** Fn's press time (tk_get_otm's low word): round 10's zero-filled word 0x558043a0 (the film roll's
 * test forms' logs and T-DOF5's research copy only, never with this). */
export const GR3X_HOLD_TIME = 0x558043a0;
/** The keys: Fn, up (Macro), down (WB), left (ISO), right (Drive); their press code (the pad's held
 * and released codes follow it), their Hold setting and their own setting. Padding bytes 0x806,
 * 0x84a, 0x88e, 0xacf, 0xae3: no exact access through a record (settings_layout_probe.py); the
 * wide ones are another object's (0x806: a hardware block's bit fields, 0x5373xxxx; 0x88e: the
 * live values' record, 0x5355xxxx), the debug dump's reads, or none. */
export const GR3X_HOLD_KEYS = [
  { name: 'Fn', press: 22, release: 23, held: 0, hold: 0x806, own: 0x922, ownFunction: 0 },
  { name: 'Macro', press: 26, release: 28, held: 27, hold: 0x84a, own: 0xac5, ownFunction: 45 },
  { name: 'WB', press: 29, release: 31, held: 30, hold: 0x88e, own: 0xabb, ownFunction: 44 },
  { name: 'ISO', press: 32, release: 34, held: 33, hold: 0xacf, own: 0x924, ownFunction: 0 },
  { name: 'Drive', press: 35, release: 37, held: 36, hold: 0xae3, own: 0x926, ownFunction: 0 },
] as const;
/** RAM: the press kept back (its code, 0 none) and « hold run »: round 10's zero-filled words, the
 * area's last two bytes (0x558043be, 0x558043bf: after the AF Point and Apply to U states). */
export const GR3X_HOLD_STATE = 0x558043be;
/** The front dial's rotation at OnEvent (T-SR2's key ring on the camera, 2026-11-09: 9 and 10, one
 * notch each way, with Fn held), and the rear dial's codes they stand for (T-DIAL2: 24, 25). */
export const GR3X_FRONT_DIAL_KEYS = [9, 10] as const, GR3X_REAR_DIAL_CODES = [24, 25] as const;
/** The events' translation into OnEvent's codes, and the raw types of the front dial's turns (the
 * rear dial's: + 2). */
export const GR3X_EVENT_TRANSLATION = 0x532231e4, GR3X_FRONT_DIAL_TYPES = [0x22, 0x23] as const;
/** The viewfinder's key handler's jump table (0x5320c844: entry key - 1). */
export const GR3X_VIEW_KEY_TABLE = 0x5320c874;
/** Its dial cases' calls of the action poster 0x532a0d70: 24, 25, 9, 10. */
export const GR3X_DIAL_POSTS = [0x5320d8c4, 0x5320d834, 0x5320e3ac, 0x5320e31c] as const;
const RECORD_POINTER = 0x55063f34;
const APP = 0x5320ad88, CONTROLLERS = 0x5320aefc, STATE = 0x5320b61c, AF_MOVE = 0x532a441c;

export interface Gr3xHoldProgram {
  code(source: string): number;
  patch(address: number, expected: number, replacement: number, reason: string): void;
  u32(address: number): number;
  sites: readonly Gr3xSite[];
}

/**
 * Installs the filter. `max`: the highest function (above: Off). Returns the filter's address, to be
 * jumped to with OnEvent's arguments (r0 this, r1 the key, lr) in place of its first instruction:
 * the rear dial's filter goes on there, else OnEvent's entry is patched to it here (`entryPatched`
 * false).
 */
export function installGr3xHoldButtons(p: Gr3xHoldProgram, max: number, entryPatched: boolean, fnDial: boolean | 'diag' = false) {
  const at = GR3X_KEY_EVENT_ENTRY;
  if (p.u32(at) !== 0xe1a0c00d) fail('key entry');
  if (!entryPatched && p.sites.some(s => s.address === at)) fail('key entry already patched');
  // tk_get_otm: push {r4}; add r4,sp,#4; push {lr}; ldr ip,=0x80510100; svc #6; ...
  if (p.u32(GR3X_GET_OTM) !== 0xe92d0010 || p.u32(GR3X_GET_OTM + 0xc) !== 0xe59fc00c || p.u32(GR3X_GET_OTM + 0x10) !== 0xef000006 || p.u32(GR3X_GET_OTM + 0x20) !== 0x80510100)
    fail('tk_get_otm');
  // OnEvent after its first instruction: callable with bl (r0 this, r1 the key).
  const orig = p.code(`mov ip,sp;b #${at + 4};`);
  const S = `movw ip,#${lo(GR3X_HOLD_STATE)};movt ip,#${hi(GR3X_HOLD_STATE)};`;
  const T = `movw ip,#${lo(GR3X_HOLD_TIME)};movt ip,#${hi(GR3X_HOLD_TIME)};`;
  // The milliseconds since start-up (low word of tk_get_otm's SYSTIM) in r0; r1..r3, ip clobbered.
  const now = `sub sp,sp,#8;mov r0,sp;bl #${GR3X_GET_OTM};ldr r0,[sp,#4];add sp,sp,#8;`;
  const R = (label: string) => `movw ip,#${lo(RECORD_POINTER)};movt ip,#${hi(RECORD_POINTER)};ldr ip,[ip];cmp ip,#0x40000000;blo ${label};cmp ip,#0xc0000000;bhs ${label};tst ip,#3;bne ${label};`;
  const K = GR3X_HOLD_KEYS;
  // r4 this, r5 the key; r6 the key's index, r7 the phase (0 pressed, 1 held, 2 released), r8 the Hold function.
  const classify = K.map((k, i) => ([[k.press, 0], ...(k.held ? [[k.held, 1]] : []), [k.release, 2]] as const).map(([c, ph]) =>
    `cmp r5,#${c};moveq r6,#${i};moveq r7,#${ph};beq cls;`).join('')).join('');
  const holdByte = K.map((k, i) => `cmp r6,#${i};movweq r0,#${k.hold};`).join('');
  const ownByte = K.map((k, i) => `cmp r6,#${i};movweq r0,#${k.own};`).join('');
  // The value the key's own setting needs to run the function in r3 (WB, Macro: their own function is 0).
  const ownValue = K.filter(k => k.ownFunction).map(k => `cmp r6,#${K.indexOf(k)};bne v${k.name};cmp r3,#${k.ownFunction};moveq r3,#0;v${k.name}:`).join('');
  const pressOf = K.map((k, i) => `cmp r6,#${i};moveq r1,#${k.press};`).join('');
  const releaseOf = K.map((k, i) => `cmp r6,#${i};moveq r1,#${k.release};`).join('');
  // `fnDial`: Fn's press kept back even with its Hold line Off (a long press then runs as a short
  // one); the front dial's turns while it is kept back become the rear dial's (fnDialRaw below).
  const fnOff = fnDial ? 'cmp r6,#0;beq fnon;' : '';
  const filter = p.code(`push {r0,r1,r4,r5,r6,r7,r8,lr};mov r4,r0;mov r5,r1;
    ${classify}b pass;
    cls:${R('pass')}${holdByte}ldrb r8,[ip,r0];${fnOff}cmp r8,#0;beq pass;fnon:cmp r8,#${max};bhi pass;
    bl #${APP};bl #${CONTROLLERS};ldr r0,[r0];bic r0,r0,#2;cmp r0,#0x08000000;bne pass;
    cmp r6,#0;beq noaf;bl #${APP};bl #${STATE};bl #${AF_MOVE};cmp r0,#0;bne pass;noaf:
    ${pressOf}${S}cmp r7,#0;bne notpress;strb r1,[ip];mov r0,#0;strb r0,[ip,#1];
    cmp r6,#0;bne handled;${now}${T}str r0,[ip];b handled;
    notpress:ldrb r0,[ip];cmp r0,r1;bne pass;cmp r7,#1;bne release;
    ldrb r0,[ip,#1];cmp r0,#0;bne handled;mov r0,#1;strb r0,[ip,#1];
    run:${R('handled')}${ownByte}ldrb r2,[ip,r0];mov r3,r8;${ownValue}strb r3,[ip,r0];push {r0,r1,r2,ip};
    mov r0,r4;bl #${orig};${releaseOf}mov r0,r4;bl #${orig};pop {r0,r1,r2,ip};strb r2,[ip,r0];b handled;
    release:mov r0,#0;strb r0,[ip];ldrb r0,[ip,#1];cmp r0,#0;bne handled;
    cmp r6,#0;bne short;cmp r8,#0;beq short;push {r1};${now}pop {r1};${T}ldr r2,[ip];sub r0,r0,r2;movw r2,#${GR3X_FN_HOLD_MS};cmp r0,r2;bhs run;
    short:mov r0,r4;bl #${orig};
    pass:pop {r0,r1,r4,r5,r6,r7,r8,lr};mov ip,sp;b #${at + 4};
    handled:mov r0,#1;str r0,[sp];pop {r0,r1,r4,r5,r6,r7,r8,pc};`);
  if (!entryPatched) p.patch(at, 0xe1a0c00d, branchWord(at, filter), 'hold buttons: long presses at the key entry');
  if (!fnDial) return { holdFilter: filter, holdOrig: orig };
  // T-FN4: the events' translation (0x532231e4: ldrh r3,[r1], the raw event's type): while Fn's
  // press is kept back, a front dial turn (type 0x22 / 0x23, codes 9 / 10) becomes the rear dial's
  // (0x24 / 0x25, codes 24 / 25), written in the event too (when in RAM), so that the rest of the
  // camera sees the rear dial; « hold run » set, so that Fn's release does nothing. T-FN1 to T-FN3
  // sent 24 / 25 to OnEvent: the action's event was posted, the shutter speed did not change.
  if (p.u32(GR3X_EVENT_TRANSLATION) !== 0xe1d130b0 || p.u32(GR3X_EVENT_TRANSLATION + 4) !== 0xe1a0c00d) fail('events\' translation');
  if (p.sites.some(s => s.address === GR3X_EVENT_TRANSLATION)) fail('events\' translation already patched');
  const [F1] = GR3X_FRONT_DIAL_TYPES;
  const raw = p.code(`ldrh r3,[r1];sub ip,r3,#${F1};cmp ip,#1;bhi back;movw ip,#${lo(GR3X_HOLD_STATE)};movt ip,#${hi(GR3X_HOLD_STATE)};ldrb ip,[ip];cmp ip,#${K[0].press};bne back;
    add r3,r3,#2;cmp r1,#0x40000000;blo flag;cmp r1,#0xc0000000;bhs flag;tst r1,#1;bne flag;strh r3,[r1];
    flag:push {r0};movw ip,#${lo(GR3X_HOLD_STATE)};movt ip,#${hi(GR3X_HOLD_STATE)};mov r0,#1;strb r0,[ip,#1];pop {r0};
    back:b #${GR3X_EVENT_TRANSLATION + 4};`);
  p.patch(GR3X_EVENT_TRANSLATION, 0xe1d130b0, branchWord(GR3X_EVENT_TRANSLATION, raw), 'Fn + front dial: the front dial\'s turns as the rear dial\'s while Fn is held');
  if (fnDial !== 'diag') return { holdFilter: filter, holdOrig: orig, fnDialRaw: raw };
  // T-FN2: the viewfinder's key handler (0x5320c844) reaching its cases 24 and 25 (jump table
  // 0x5320c874, entry key - 1): 74, 75 noted, then the case.
  const cases = GR3X_REAR_DIAL_CODES.map((k, i) => {
    const entry = GR3X_VIEW_KEY_TABLE + 4 * (k - 1), target = p.u32(entry);
    if (target !== [0x5320d890, 0x5320d800][i]) fail('viewfinder key table');
    const stub = p.code(`push {r0,r1,r2,ip};mov r1,#${74 + i};${gr3xRingNote}pop {r0,r1,r2,ip};b #${target};`);
    p.patch(entry, target, stub, `Fn + front dial diagnostic: the viewfinder's case ${k} noted`);
    return stub;
  });
  // T-FN3: the events each dial action posts (0x532a0d70(model, list): the list's vector { begin,
  // end } of 12-byte events), noted 80 + their number (19 at most) at the four dial cases' calls
  // (24, 25, 9, 10), before the call.
  const POST = 0x532a0d70;
  const count = p.code(`push {r0,r1,r2,r3,ip,lr};mov r2,#0;ldr r3,[r1];cmp r3,#0;beq none;ldr r2,[r3,#4];ldr r3,[r3];sub r2,r2,r3;
    mov r3,#0;div:cmp r2,#12;blo none2;sub r2,r2,#12;add r3,r3,#1;b div;none2:mov r2,r3;none:cmp r2,#19;movhi r2,#19;add r1,r2,#80;${gr3xRingNote}
    pop {r0,r1,r2,r3,ip,lr};b #${POST};`);
  for (const at of GR3X_DIAL_POSTS) {
    if (p.u32(at) !== branchWord(at, POST, 14, true)) fail('dial action call');
    p.patch(at, branchWord(at, POST, 14, true), branchWord(at, count, 14, true), 'Fn + front dial diagnostic: the dial action\'s events counted');
  }
  return { holdFilter: filter, holdOrig: orig, fnDialRaw: raw, fnDialCases: cases[0], fnDialCount: count };
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
