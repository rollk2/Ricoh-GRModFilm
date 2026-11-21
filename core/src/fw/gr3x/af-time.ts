// SPDX-License-Identifier: GPL-2.0-only
/**
 * GR III 2.10 / IIIx 1.60, T-AFT1 (test builds only, `afTime`): the contrast autofocus's action codes and their durations, printed by the
 * date imprint, to learn what an autofocus press really does and how long each phase lasts.
 *
 * CafProcess's per-frame dispatcher (0x5340a2bc; `this` + 0xc44c holds the action code: 1, 2, 4, 8, 0x10, 0x20, 0x40, 0x80, 0 at rest in
 * all likelihood; per nflaschel's research, https://gr.nflaschel.de/ and https://github.com/nils-fl/RicohGR, a dim press goes 2 (the
 * lens travels), 4 (the sweep), 8 and 0x80 (accept and finish)) writes the code it ends on at its common exit, 0x5340a354
 * (`strh r4, [r6, r1]`, r1 = 0x44c, r4 = the new code, r6 = this + 0xc000; r0, r2 and r3 are live after it). Our hook runs just before it: when
 * the code changes it notes, in the key ring (dial-probe.ts, printed by the date imprint, two digits a byte), one byte for the phase that
 * ends, the OLD code: tens = how long that code lasted in 50 ms steps (9: 450 ms or more, or never seen), ones = the old code's bit
 * position + 1 (0 for 0, 1 for code 1, 2 for code 2, 3 for code 4, 4 for 8, 5 for 0x10, 6 for 0x20, 7 for 0x40, 8 for 0x80).
 * The time of the last change is the word at 0x55804388 (the film probe's, which this build excludes).
 * Every register and the flags are kept; the hook then does the function's own store and goes on.
 */
import { branchWord } from '../aspect/arm';
import { FirmwareError } from '../types';
import type { Gr3xSite } from './round10';
import { GR3X_GET_OTM } from './hold';
import { gr3xRingNote } from './play-probe';

const lo = (v: number) => v & 0xffff, hi = (v: number) => v >>> 16;
export const GR3X_AFT_STORE = 0x5340a354, GR3X_AFT_STAMP = 0x55804388;

export interface Gr3xAfTimeProgram {
  code(source: string): number;
  patch(address: number, expected: number, replacement: number, reason: string): void;
  u32(address: number): number;
  sites: readonly Gr3xSite[];
}

export function installGr3xAfTime(p: Gr3xAfTimeProgram): void {
  const fail = (m: string): never => { throw new FirmwareError('unexpected-layout', `IIIx AF timing: ${m}`); };
  if (p.u32(GR3X_AFT_STORE) !== 0xe18640b1) fail('the dispatcher\'s store is not `strh r4, [r6, r1]`');
  if (p.u32(GR3X_AFT_STORE - 4) !== 0xe3a00001) fail('the dispatcher\'s exit is not as expected');
  if (p.sites.some(s => s.address === GR3X_AFT_STORE)) fail('the store is already patched');
  const hook = p.code(`push {r0,r1,r2,r3,ip,lr}
    add r2,r6,r1
    ldrh r2,[r2]
    cmp r2,r4
    beq done
    sub sp,sp,#8
    mov r0,sp
    bl #${GR3X_GET_OTM}
    ldr r0,[sp,#4]
    add sp,sp,#8
    movw ip,#${lo(GR3X_AFT_STAMP)}
    movt ip,#${hi(GR3X_AFT_STAMP)}
    ldr r3,[ip]
    str r0,[ip]
    sub r0,r0,r3
    mov r3,#0
    steps:
    cmp r3,#9
    bhs stepped
    cmp r0,#50
    blo stepped
    sub r0,r0,#50
    add r3,r3,#1
    b steps
    stepped:
    mov r0,#0
    position:
    cmp r2,#0
    beq positioned
    add r0,r0,#1
    mov r2,r2,lsr #1
    b position
    positioned:
    add r3,r3,r3,lsl #2
    mov r3,r3,lsl #1
    add r1,r3,r0
    ${gr3xRingNote}
    done:
    pop {r0,r1,r2,r3,ip,lr}
    push {ip}
    add ip,r6,r1
    strh r4,[ip]
    pop {ip}
    b #${GR3X_AFT_STORE + 4}`);
  p.patch(GR3X_AFT_STORE, 0xe18640b1, branchWord(GR3X_AFT_STORE, hook), 'AF timing: the action code\'s changes noted with their durations');
}
