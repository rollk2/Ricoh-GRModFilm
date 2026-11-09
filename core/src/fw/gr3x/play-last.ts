// SPDX-License-Identifier: GPL-2.0-only
/**
 * GR III 2.10 / IIIx 1.60, `playLast` (T-PLAY2): playback opens on the last picture taken.
 *
 * With the film mode, a picture of P (Av, Tv, M) goes to the free modes' folder, older (lower) than
 * the rolls' folders. Its file then fails the files index's append (0x535ba278: the index expects a
 * new file at its end), so playback is not told that a file was created (message 0x2d601003, its
 * flag this[3]) and reopens on the picture it last showed, or on the last file of the highest folder
 * (MoveToLastFile 0x534e3e04): a roll's frame (T-PLAY0). File numbers go up by one whatever the
 * folder (the user's remark), and the camera writes each picture's (folder, number) into its request:
 *  - the files service's save of a request (0x535a87a0; r7 the request, + 0x10 its folder, + 0x12 its
 *    number: the camera stores them as the media's last folder (+ 6, read with 100 as default by
 *    0x535b2e64) and last number (+ 2, compared with 9999 by 0x535b2188)): they are given by the
 *    file's creation (0x535ba278, its two calls 0x535a88d8 and 0x535a890c; before it they are 0:
 *    T-PLAY2d noted no picture at 0x535a88ac); after it, both are kept with a « new picture » flag
 *    (a folder 100..999 and a number 1..9999 only);
 *  - playback's opening (0x534e40c8(this, kind)): with the flag, its file reference (this + 6: kind
 *    byte, + 8 folder, + 0xa number: T-PLAY0b) becomes that picture, « file created » (this[3]) is
 *    cleared and the flag too; the opening then checks the reference as always (0x534e3e84: a file
 *    no longer there falls back to MoveToLastFile). Without the flag, nothing changes.
 * RAM: GR3X_PLAY_LAST, 4 bytes of round 10's zero-filled words (0x558043b8: the film roll's folder
 * log of its test forms only; then the AF Point, Apply to U and hold states): the folder halfword
 * with bit 15 the « new picture » flag, the number halfword.
 * `diag` (T-PLAY2d, T-PLAY3d): the key ring notes the save (41; 44 a creation without a valid folder and number), the opening with (42) or without (43) the
 * flag, the file check of the reference (0x534ea298 at 0x534e3ed0: 80 found, 81 not), MoveToLastFile (77).
 */
import { branchWord } from '../aspect/arm';
import { FirmwareError } from '../types';
import type { Gr3xSite } from './round10';
import { gr3xRingNote } from './play-probe';

const lo = (v: number) => v & 0xffff, hi = (v: number) => v >>> 16;
export const GR3X_PLAY_LAST = 0x558043b8;
export const GR3X_PLAY_CHECK_CALL = 0x534e3ed0, GR3X_PLAY_CHECK = 0x534ea298, GR3X_MOVE_TO_LAST = 0x534e3e04;
export const GR3X_CREATE_CALLS = [0x535a88d8, 0x535a890c] as const, GR3X_CREATE = 0x535ba278, GR3X_PLAY_OPEN = 0x534e40c8;

export interface Gr3xPlayLastProgram {
  code(source: string): number;
  patch(address: number, expected: number, replacement: number, reason: string): void;
  u32(address: number): number;
  sites: readonly Gr3xSite[];
}

export function installGr3xPlayLast(p: Gr3xPlayLastProgram, diag = false) {
  const fail = (m: string): never => { throw new FirmwareError('unexpected-layout', `IIIx play last: ${m}`); };
  const bl = (from: number, to: number) => branchWord(from, to, 14, true);
  for (const at of GR3X_CREATE_CALLS) if (p.u32(at) !== bl(at, GR3X_CREATE)) fail('the save\'s creation call');
  if (p.u32(GR3X_PLAY_OPEN) !== 0xe1a0c00d) fail('playback opening');
  for (const at of [...GR3X_CREATE_CALLS, GR3X_PLAY_OPEN]) if (p.sites.some(s => s.address === at)) fail(`${at.toString(16)} already patched`);
  const L = `movw ip,#${lo(GR3X_PLAY_LAST)};movt ip,#${hi(GR3X_PLAY_LAST)};`;
  // The creation, then (r7 the request, kept by it) its folder and number; its result returned.
  const n = (v: number) => diag ? `push {r1};mov r1,#${v};${gr3xRingNote}pop {r1};` : '';
  const saved = p.code(`push {r4,lr};bl #${GR3X_CREATE};mov r4,r0;ldrh r0,[r7,#0x10];ldrh r1,[r7,#0x12];sub r2,r0,#100;cmp r2,#900;bhs bad;
    sub r2,r1,#1;movw r3,#9999;cmp r2,r3;bhs bad;${L}orr r0,r0,#0x8000;strh r0,[ip];strh r1,[ip,#2];${n(41)}b done;
    bad:${n(44)}done:mov r0,r4;pop {r4,pc};`);
  // At the opening (r0 this, r1 the kind).
  const open = p.code(`push {r2};${L}ldrh r2,[ip];tst r2,#0x8000;beq go;bic r2,r2,#0x8000;strh r2,[ip];
    strb r1,[r0,#6];strh r2,[r0,#8];ldrh r2,[ip,#2];strh r2,[r0,#0xa];mov r2,#0;strb r2,[r0,#3];${n(42)}pop {r2};mov ip,sp;b #${GR3X_PLAY_OPEN + 4};
    go:${n(43)}pop {r2};mov ip,sp;b #${GR3X_PLAY_OPEN + 4};`);
  for (const at of GR3X_CREATE_CALLS) p.patch(at, bl(at, GR3X_CREATE), bl(at, saved), 'play last: each created picture\'s folder and number kept');
  p.patch(GR3X_PLAY_OPEN, 0xe1a0c00d, branchWord(GR3X_PLAY_OPEN, open), 'play last: playback opens on the last picture taken');
  if (!diag) return { playLastSaved: saved, playLastOpen: open };
  if (p.u32(GR3X_PLAY_CHECK_CALL) !== bl(GR3X_PLAY_CHECK_CALL, GR3X_PLAY_CHECK) || p.u32(GR3X_MOVE_TO_LAST) !== 0xe1a0c00d) fail('diagnostic sites');
  const check = p.code(`push {r4,lr};bl #${GR3X_PLAY_CHECK};mov r4,r0;cmp r0,#0;movne r1,#80;moveq r1,#81;${gr3xRingNote}mov r0,r4;pop {r4,pc};`);
  const last = p.code(`push {r1};mov r1,#77;${gr3xRingNote}pop {r1};mov ip,sp;b #${GR3X_MOVE_TO_LAST + 4};`);
  p.patch(GR3X_PLAY_CHECK_CALL, bl(GR3X_PLAY_CHECK_CALL, GR3X_PLAY_CHECK), bl(GR3X_PLAY_CHECK_CALL, check), 'play last diagnostic: the reference\'s check noted');
  p.patch(GR3X_MOVE_TO_LAST, 0xe1a0c00d, branchWord(GR3X_MOVE_TO_LAST, last), 'play last diagnostic: MoveToLastFile noted');
  return { playLastSaved: saved, playLastOpen: open, playLastCheck: check, playLastLast: last };
}
