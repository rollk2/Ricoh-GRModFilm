// SPDX-License-Identifier: GPL-2.0-only
/**
 * GR Mod Film 1.2, test builds (`TestOptions.holdTest`): long presses of Fn and the four keys of the pad, GR IV Monochrome 1.11
 * (GR IV 1.21). The port of gr3x/hold.ts; the function of each long press is, in this first test build, a table in the file
 * (the camera's own « Hold » lines of Fn Button Setting come next).
 *
 * Key codes at ActionModel::OnEvent (0x53258098, code in r1, tail-called by the events' translation 0x5325825c), measured on a
 * Monochrome 1.11 (test builds of 2026-11-20, docs/film-mode-notes.md) and read in the translation (raw type 0x1b: state 2 -> 24, 1 -> 25):
 *  - Fn 24 pressed, 25 released, no held code: its long press is timed (tk_get_otm 0x53067d94 at the press and at the release,
 *    HOLD_MS or more runs the Hold function, on release);
 *  - up (Macro) 26 pressed / 22 held (!) / 28 released; down 29 / 30 / 31; left 32 / 33 / 34; right 35 / 36 / 37.
 * The filter (OnEvent's entry), in the live view only (controller 0x08000000 or 0x08000002) and for a key whose Hold function is
 * not Off:
 *  - pressed: kept back (state: the key's press code, « hold run » cleared);
 *  - first held code (Fn: its release, held long enough): the Hold function, run as a press and a release of Fn sent to OnEvent
 *    with Fn's setting (settings object + 0x1469, the getter 0x5329f50c) holding the function for the time of the two calls (Fn
 *    carries the five keys: the up key has no setting of its own); later held codes kept back;
 *  - released: after a Hold, kept back; else the press sent, then the release goes on (a short press, on release).
 * A key released after HOLD_MS or more without a held code runs the function too (the first test build on the camera ran nothing: the held
 * codes may not come once the press is kept back). Any other key, controller or state: as before. Live view: any controller of the 0x08000000 family (0x08000000 only was tried first,
 * and no long press ran on the camera: the identity of the live view's controller is not known, see  `idDiag`).
 */
import { FirmwareError } from '../../types';
import { assembleWords, branchWord } from './arm';
import { Patch, expectWord } from './build';
import { extendZeroFill } from './lookstash';

export const KEY_ENTRY = 0x53258098;
export const TK_GET_OTM = 0x53067d94;
const APP = 0x53240cac, CONTROLLERS = 0x53240e20, SETTINGS = 0x53241240;
/** Fn's function: byte 0x469 of the block 0x1000 into the settings object (getter 0x5329f50c: add r0,r0,#0x1000; ldrb r0,[r0,#0x469]). */
export const FN_BLOCK = 0x1000, FN_OFFSET = 0x469;
/** Time of Fn's press (word) and the state (bytes: the press kept back, « hold run »), in the zero-filled words before the heap. */
export const HOLD_TIME = 0x55839020, HOLD_STATE = 0x55839030;
export const HOLD_MS = 600;
export const KEY_RING = 0x55839038;
export const MAX_FUNCTION = 45;
/** Fn, up, down, left, right: press code, held code (0: none), release code. */
export const HOLD_KEYS = [
  { name: 'Fn', press: 24, held: 0, release: 25 },
  { name: 'Up', press: 26, held: 22, release: 28 },
  { name: 'Down', press: 29, held: 30, release: 31 },
  { name: 'Left', press: 32, held: 33, release: 34 },
  { name: 'Right', press: 35, held: 36, release: 37 },
] as const;
const lo = (v: number) => v & 0xffff, hi = (v: number) => v >>> 16;

/** `functions`: the Hold function of Fn, up, down, left, right (0: none), baked into the file. */
export function installHoldButtons(patch: Patch, functions: readonly number[], idDiag = false, liveBytes: readonly number[] = []): number {
  if (functions.length !== 5 || functions.some((f) => !Number.isInteger(f) || f < 0 || f > MAX_FUNCTION)) throw new FirmwareError('internal', 'hold buttons: five functions 0..45');
  expectWord(patch, KEY_ENTRY, 0xe1a0c00d);
  expectWord(patch, TK_GET_OTM, 0xe92d0010);
  expectWord(patch, TK_GET_OTM + 0x20, 0x80510100);
  extendZeroFill(patch);
  const table = patch.append(Uint8Array.from(functions), 4);
  const orig = patch.append((at) => assembleWords(`mov ip,sp; b #${KEY_ENTRY + 4}`, at), 4);
  const K = HOLD_KEYS;
  const S = `movw ip,#${lo(HOLD_STATE)};movt ip,#${hi(HOLD_STATE)};`;
  const T = `movw ip,#${lo(HOLD_TIME)};movt ip,#${hi(HOLD_TIME)};`;
  const now = `sub sp,sp,#8;mov r0,sp;bl #${TK_GET_OTM};ldr r0,[sp,#4];add sp,sp,#8;`;
  // ip = the settings object + FN_BLOCK (Fn's field is at + FN_OFFSET), or branch to `label` when the object is not where it should be.
  const FIELD = (label: string) => `bl #${APP};bl #${SETTINGS};cmp r0,#0x55000000;blo ${label};cmp r0,#0x56000000;bhs ${label};add ip,r0,#${FN_BLOCK};`;
  const classify = K.map((k, i) => ([[k.press, 0], ...(k.held ? [[k.held, 1]] : []), [k.release, 2]] as const).map(([c, ph]) =>
    `cmp r5,#${c};moveq r6,#${i};moveq r7,#${ph};beq cls;`).join('')).join('');
  const pressOf = K.map((k, i) => `cmp r6,#${i};moveq r1,#${k.press};`).join('');
  const releaseOf = K.map((k, i) => `cmp r6,#${i};moveq r1,#${k.release};`).join('');
  // Test builds (`mark`): what the filter does, in the key diagnostics' ring (8 bytes at KEY_RING, byte 7 the next slot): for each event of a
  // key with a Hold function in the live view, 0x10 + key (pressed), 0x20 + key (held code), 0x30 + key (released), then 0x40 + key (the
  // press replayed: a short press), 0x80 + key (the function run), 0xA0 + key (back from it); key 0 Fn, 1 up, 2 down, 3 left, 4 right.
  const RING = (reg: string) => idDiag ? `movw ip,#${lo(KEY_RING)};movt ip,#${hi(KEY_RING)};ldrb r2,[ip,#7];cmp r2,#7;movhs r2,#0;strb ${reg},[ip,r2];add r2,r2,#1;cmp r2,#7;moveq r2,#0;strb r2,[ip,#7];` : '';
  const ring = '';
  const phaseMark = idDiag ? `cmp r7,#1;movlo r1,#0x10;moveq r1,#0x20;movhi r1,#0x30;add r1,r1,r6;${RING('r1')}` : '';
  // `liveBytes`: the addresses of the five bytes holding the keys' Hold functions (the Hold lines of Fn Button Setting), read in place of the table.
  const live = liveBytes.length === 5 ? liveBytes.map((a, k) => `cmp r6,#${k};movweq r0,#${lo(a)};movteq r0,#${hi(a)};`).join('') + 'ldrb r8,[r0];' : '';
  const tbl = live || `movw r0,#${lo(table)};movt r0,#${hi(table)};ldrb r8,[r0,r6];`;
  const filter = patch.append((at) => assembleWords(`push {r0,r1,r4,r5,r6,r7,r8,lr};mov r4,r0;mov r5,r1;
    ${classify}b pass;
    cls:${tbl}cmp r8,#0;beq pass;cmp r8,#${MAX_FUNCTION};bhi pass;
    bl #${APP};bl #${CONTROLLERS};ldr r0,[r0];${ring}cmp r0,#0x08000000;blo pass;cmp r0,#0x09000000;bhs pass;
    ${phaseMark}${pressOf}${S}cmp r7,#0;bne notpress;strb r1,[ip];mov r0,#0;strb r0,[ip,#1];
    ${now}${T}str r0,[ip];b handled;
    notpress:ldrb r0,[ip];cmp r0,r1;bne pass;cmp r7,#1;bne release;
    ldrb r0,[ip,#1];cmp r0,#0;bne handled;mov r0,#1;strb r0,[ip,#1];
    run:${idDiag ? `add r1,r6,#0x80;${RING('r1')}` : ''}${FIELD('handled')}ldrb r2,[ip,#${FN_OFFSET}];strb r8,[ip,#${FN_OFFSET}];push {r2,ip};
    mov r1,#${K[0].press};mov r0,r4;bl #${orig};mov r1,#${K[0].release};mov r0,r4;bl #${orig};pop {r2,ip};strb r2,[ip,#${FN_OFFSET}];${idDiag ? `add r1,r6,#0xA0;${RING('r1')}` : ''}b handled;
    release:${S}mov r0,#0;strb r0,[ip];ldrb r0,[ip,#1];cmp r0,#0;bne handled;
    push {r1};${now}pop {r1};${T}ldr r2,[ip];sub r0,r0,r2;movw r2,#${HOLD_MS};cmp r0,r2;bhs run;
    short:${idDiag ? `add r1,r6,#0x40;${RING('r1')}` : ''}${pressOf}mov r0,r4;bl #${orig};
    pass:pop {r0,r1,r4,r5,r6,r7,r8,lr};mov ip,sp;b #${KEY_ENTRY + 4};
    handled:mov r0,#1;str r0,[sp];pop {r0,r1,r4,r5,r6,r7,r8,pc};`, at), 4);
  patch.setWord(KEY_ENTRY, branchWord(KEY_ENTRY, filter), 'hold buttons: long presses at the key entry');
  return filter;
}
