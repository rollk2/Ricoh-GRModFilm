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
 *    0x535b2e64) and last number (+ 2, compared with 9999 by 0x535b2188)): at 0x535a88ac, both are
 *    kept with a « new picture » flag (a folder 100..999 and a number 1..9999 only);
 *  - playback's opening (0x534e40c8(this, kind)): with the flag, its file reference (this + 6: kind
 *    byte, + 8 folder, + 0xa number: T-PLAY0b) becomes that picture, « file created » (this[3]) is
 *    cleared and the flag too; the opening then checks the reference as always (0x534e3e84: a file
 *    no longer there falls back to MoveToLastFile). Without the flag, nothing changes.
 * RAM: GR3X_PLAY_LAST (round 10's zero-filled words, the research ring's: folder, number halfwords,
 * flag byte), so not with the key probes.
 */
import { branchWord } from '../aspect/arm';
import { FirmwareError } from '../types';
import type { Gr3xSite } from './round10';

const lo = (v: number) => v & 0xffff, hi = (v: number) => v >>> 16;
export const GR3X_PLAY_LAST = 0x558043a8;
export const GR3X_SAVE_REQUEST_SITE = 0x535a88ac, GR3X_PLAY_OPEN = 0x534e40c8;

export interface Gr3xPlayLastProgram {
  code(source: string): number;
  patch(address: number, expected: number, replacement: number, reason: string): void;
  u32(address: number): number;
  sites: readonly Gr3xSite[];
}

export function installGr3xPlayLast(p: Gr3xPlayLastProgram) {
  const fail = (m: string): never => { throw new FirmwareError('unexpected-layout', `IIIx play last: ${m}`); };
  if (p.u32(GR3X_SAVE_REQUEST_SITE) !== 0xe5972010 || p.u32(GR3X_SAVE_REQUEST_SITE - 4) >>> 24 !== 0xeb) fail('the save\'s request read');
  if (p.u32(GR3X_PLAY_OPEN) !== 0xe1a0c00d) fail('playback opening');
  for (const at of [GR3X_SAVE_REQUEST_SITE, GR3X_PLAY_OPEN]) if (p.sites.some(s => s.address === at)) fail(`${at.toString(16)} already patched`);
  const L = `movw ip,#${lo(GR3X_PLAY_LAST)};movt ip,#${hi(GR3X_PLAY_LAST)};`;
  // In the save (r7 the request; r2 then the request's word + 0x10, as the camera's own instruction).
  const saved = p.code(`push {r0,r1,r2,r3};ldrh r0,[r7,#0x10];ldrh r1,[r7,#0x12];sub r2,r0,#100;cmp r2,#900;bhs keep;
    sub r2,r1,#1;movw r3,#9999;cmp r2,r3;bhs keep;${L}strh r0,[ip];strh r1,[ip,#2];mov r0,#1;strb r0,[ip,#4];
    keep:pop {r0,r1,r2,r3};ldr r2,[r7,#0x10];b #${GR3X_SAVE_REQUEST_SITE + 4};`);
  // At the opening (r0 this, r1 the kind).
  const open = p.code(`${L}push {r2};ldrb r2,[ip,#4];cmp r2,#0;beq go;mov r2,#0;strb r2,[ip,#4];
    strb r1,[r0,#6];ldrh r2,[ip];strh r2,[r0,#8];ldrh r2,[ip,#2];strh r2,[r0,#0xa];mov r2,#0;strb r2,[r0,#3];
    go:pop {r2};mov ip,sp;b #${GR3X_PLAY_OPEN + 4};`);
  p.patch(GR3X_SAVE_REQUEST_SITE, 0xe5972010, branchWord(GR3X_SAVE_REQUEST_SITE, saved), 'play last: each picture\'s folder and number kept');
  p.patch(GR3X_PLAY_OPEN, 0xe1a0c00d, branchWord(GR3X_PLAY_OPEN, open), 'play last: playback opens on the last picture taken');
  return { playLastSaved: saved, playLastOpen: open };
}
