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
/** The live bytes of the other keys' own functions (+ FN_BLOCK): Fn, up (none: the Macro Button line's byte), down, left (ISO Button), right (Drive Button). */
export const OWN_OFFSETS = [0x469, 0, 0x46c, 0x46a, 0x46b] as const;
/**
 * Time of Fn's press (word) and the state (bytes 0 and 1: the press kept back, « hold run »), in the zero-filled words before the
 * heap. Build revision 3 (GR Mod Film 1.2.0 .. 1.3.3) used 0x55839020 and 0x55839030: the first is also the added slots' state
 * pointer (`slots.ts` SLOT_STATE), the second the power-off pictures' mode (`shutdown.ts`); every Hold key press overwrote the
 * pointer, and the next look change after waking the camera (the press that wakes it) crashed it (docs/gr4-mono-recettes-etude.md
 * 14.7). From revision 4 they are 0x55839014 and 0x55839018, used otherwise only by the HDR gain map's test counters.
 */
export const HOLD_TIME = 0x55839014, HOLD_STATE = 0x55839018;
export const HOLD_TIME_R3 = 0x55839020, HOLD_STATE_R3 = 0x55839030;
export const HOLD_MS = 600;
export const MAX_FUNCTION = 46;
/** The function « Macro Mode »: the up key's own short press. */
export const MACRO_FUNCTION = 46;
/** Fn, up, down, left, right: press code, held code (0: none), release code. */
export const HOLD_KEYS = [
  { name: 'Fn', press: 24, held: 0, release: 25 },
  { name: 'Up', press: 26, held: 22, release: 28 },
  { name: 'Down', press: 29, held: 30, release: 31 },
  { name: 'Left', press: 32, held: 33, release: 34 },
  { name: 'Right', press: 35, held: 36, release: 37 },
] as const;
const lo = (v: number) => v & 0xffff, hi = (v: number) => v >>> 16;

export interface HoldLive {
  /** The five bytes holding the keys' Hold functions (Fn, up, down, left, right). */
  hold: readonly number[];
  /** The Macro Button line's byte (0: Macro Mode, 255: Off, else the function), or 0 for no Macro Button. */
  macro: number;
}

/** `functions`: the Hold function of Fn, up, down, left, right (0: none), baked into the file, unless `live` gives their bytes. */
export function installHoldButtons(patch: Patch, functions: readonly number[], live?: HoldLive, revision = 4): number {
  const holdState = revision >= 4 ? HOLD_STATE : HOLD_STATE_R3, holdTime = revision >= 4 ? HOLD_TIME : HOLD_TIME_R3;
  if (functions.length !== 5 || functions.some((f) => !Number.isInteger(f) || f < 0 || f > MAX_FUNCTION)) throw new FirmwareError('internal', 'hold buttons: five functions 0..46');
  expectWord(patch, KEY_ENTRY, 0xe1a0c00d);
  expectWord(patch, TK_GET_OTM, 0xe92d0010);
  expectWord(patch, TK_GET_OTM + 0x20, 0x80510100);
  extendZeroFill(patch);
  const table = patch.append(Uint8Array.from(functions), 4);
  const orig = patch.append((at) => assembleWords(`mov ip,sp; b #${KEY_ENTRY + 4}`, at), 4);
  const K = HOLD_KEYS;
  const own = !!(live && live.macro);
  const S = `movw ip,#${lo(holdState)};movt ip,#${hi(holdState)};`;
  const T = `movw ip,#${lo(holdTime)};movt ip,#${hi(holdTime)};`;
  const now = `sub sp,sp,#8;mov r0,sp;bl #${TK_GET_OTM};ldr r0,[sp,#4];add sp,sp,#8;`;
  // r0 = the settings object, or branch to `label` when it is not where it should be.
  const OBJECT = (label: string) => `bl #${APP};bl #${SETTINGS};cmp r0,#0x55000000;blo ${label};cmp r0,#0x56000000;bhs ${label};`;
  const classify = K.map((k, i) => ([[k.press, 0], ...(k.held ? [[k.held, 1]] : []), [k.release, 2]] as const).map(([c, ph]) =>
    `cmp r5,#${c};moveq r6,#${i};moveq r7,#${ph};beq cls;`).join('')).join('');
  const pressOf = K.map((k, i) => `cmp r6,#${i};moveq r1,#${k.press};`).join('');
  // r8: the key's Hold function.
  const hold = live
    ? live.hold.map((a, k) => `cmp r6,#${k};movweq r0,#${lo(a)};movteq r0,#${hi(a)};`).join('') + 'ldrb r8,[r0];'
    : `movw r0,#${lo(table)};movt r0,#${hi(table)};ldrb r8,[r0,r6];`;
  // r9: the key's own function (0 none), with the Macro Button.
  const ownFn = own ? `${OBJECT('pass')}
    cmp r6,#1;bne notup;
    movw r0,#${lo(live!.macro)};movt r0,#${hi(live!.macro)};ldrb r9,[r0];cmp r9,#0;moveq r9,#${MACRO_FUNCTION};beq owned;cmp r9,#255;moveq r9,#0;b owned;
    notup:add ip,r0,#${FN_BLOCK};
    ${OWN_OFFSETS.map((o, k) => (o ? `cmp r6,#${k};ldrbeq r9,[ip,#${o}];` : '')).join('')}owned:` : '';
  // A key is dealt with here when it has a Hold function, or, with the Macro Button, when its own function is not what the camera does itself.
  const special = own
    ? `cmp r8,#0;bne special;cmp r6,#1;beq upkey;cmp r9,#${MACRO_FUNCTION};beq special;b pass;upkey:cmp r9,#${MACRO_FUNCTION};beq pass;special:`
    : 'cmp r8,#0;beq pass;';
  // What a short press does: its own function (with the Macro Button), else the camera's (the press replayed, the release goes on).
  const short = own
    ? `short:cmp r6,#1;beq upshort;cmp r9,#${MACRO_FUNCTION};bne native;mov r8,#${MACRO_FUNCTION};bl runf;b handled;
       upshort:cmp r9,#${MACRO_FUNCTION};beq native;cmp r9,#0;beq handled;mov r8,r9;bl runf;b handled;
       native:${pressOf}mov r0,r4;bl #${orig};b pass;`
    : `short:${pressOf}mov r0,r4;bl #${orig};b pass;`;
  const filter = patch.append((at) => assembleWords(`push {r0,r1,r4,r5,r6,r7,r8,r9,lr};mov r4,r0;mov r5,r1;
    ${classify}b pass;
    cls:${hold}cmp r8,#${MAX_FUNCTION};movhi r8,#0;${ownFn}${special}
    bl #${APP};bl #${CONTROLLERS};ldr r0,[r0];cmp r0,#0x08000000;blo pass;cmp r0,#0x09000000;bhs pass;
    ${pressOf}${S}cmp r7,#0;bne notpress;strb r1,[ip];mov r0,#0;strb r0,[ip,#1];
    ${now}${T}str r0,[ip];b handled;
    notpress:ldrb r0,[ip];cmp r0,r1;bne pass;cmp r7,#1;bne release;
    cmp r8,#0;beq handled;ldrb r0,[ip,#1];cmp r0,#0;bne handled;mov r0,#1;strb r0,[ip,#1];bl runf;b handled;
    release:${S}mov r0,#0;strb r0,[ip];ldrb r0,[ip,#1];cmp r0,#0;bne handled;
    cmp r8,#0;beq short;push {r1};${now}pop {r1};${T}ldr r2,[ip];sub r0,r0,r2;movw r2,#${HOLD_MS};cmp r0,r2;blo short;bl runf;b handled;
    ${short}
    pass:pop {r0,r1,r4,r5,r6,r7,r8,r9,lr};mov ip,sp;b #${KEY_ENTRY + 4};
    handled:mov r0,#1;str r0,[sp];pop {r0,r1,r4,r5,r6,r7,r8,r9,pc};
    runf:push {r0,r1,r2,r3,r9,ip,lr};
    cmp r8,#${MACRO_FUNCTION};bne fnrun;
    mov r1,#${K[1].press};mov r0,r4;bl #${orig};mov r1,#${K[1].release};mov r0,r4;bl #${orig};b rundone;
    fnrun:${OBJECT('rundone')}add ip,r0,#${FN_BLOCK};ldrb r2,[ip,#${FN_OFFSET}];strb r8,[ip,#${FN_OFFSET}];push {r2,ip};
    mov r1,#${K[0].press};mov r0,r4;bl #${orig};mov r1,#${K[0].release};mov r0,r4;bl #${orig};pop {r2,ip};strb r2,[ip,#${FN_OFFSET}];
    rundone:pop {r0,r1,r2,r3,r9,ip,pc};`, at), 4);
  patch.setWord(KEY_ENTRY, branchWord(KEY_ENTRY, filter), 'hold buttons: long presses at the key entry');
  return filter;
}
