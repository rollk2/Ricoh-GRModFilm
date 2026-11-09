// SPDX-License-Identifier: GPL-2.0-only
/**
 * GR III 2.10 / IIIx 1.60, T-PLAY0 (test builds only, `playProbe`): which way playback's opening goes.
 * The film mode's playback opened on the last roll frame after a P picture (T-PLAY1's protocol).
 *
 * The playback model's opening, 0x534e40c8(this, kind) (reached from 0x534e0a80 / 0x534e0aa0): it
 * checks the file in use (0x534e3e84, which falls back to MoveToLastFile 0x534e3e04 when it is no
 * longer valid), then, with this[2] 0 and this[3] (« a file was created ») set, moves to the created
 * file (MoveToCreationFile 0x534e4030: its search 0x534e91c4 returns 0 when found) and clears this[3].
 * Noted in the key ring (dial-probe.ts's GR3X_DIAL_TABLE, printed by the date module's KEY_DIAG):
 *  - at the opening: 10 + this[2] (capped 9), 20 + this[3] (capped 9), 30 + (this[6] & 7);
 *  - MoveToCreationFile: 50, then its search: 60 found, 61 not found;
 *  - MoveToLastFile: 77.
 */
import { branchWord } from '../aspect/arm';
import { FirmwareError } from '../types';
import type { Gr3xSite } from './round10';
import { GR3X_DIAL_TABLE } from './dial-probe';

const lo = (v: number) => v & 0xffff, hi = (v: number) => v >>> 16;
export const GR3X_PLAY_OPEN = 0x534e40c8, GR3X_MOVE_TO_CREATION = 0x534e4030, GR3X_MOVE_TO_LAST = 0x534e3e04;
export const GR3X_CREATION_SEARCH_CALL = 0x534e407c, GR3X_CREATION_SEARCH = 0x534e91c4;

export interface Gr3xPlayProbeProgram {
  code(source: string): number;
  patch(address: number, expected: number, replacement: number, reason: string): void;
  u32(address: number): number;
  sites: readonly Gr3xSite[];
}

/** r1 into the ring (r0, r1, r2, ip used and restored but ip; flags changed). */
const note = `push {r0,r1,r2};movw ip,#${lo(GR3X_DIAL_TABLE)};movt ip,#${hi(GR3X_DIAL_TABLE)};ldrb r0,[ip,#7];cmp r0,#7;movhs r0,#0;
  strb r1,[ip,r0];add r0,r0,#1;cmp r0,#7;moveq r0,#0;strb r0,[ip,#7];pop {r0,r1,r2};`;

export function installGr3xPlayProbe(p: Gr3xPlayProbeProgram) {
  const fail = (m: string): never => { throw new FirmwareError('unexpected-layout', `IIIx play probe: ${m}`); };
  for (const at of [GR3X_PLAY_OPEN, GR3X_MOVE_TO_CREATION, GR3X_MOVE_TO_LAST]) {
    if (p.u32(at) !== 0xe1a0c00d) fail(`entry ${at.toString(16)}`);
    if (p.sites.some(s => s.address === at)) fail(`${at.toString(16)} already patched`);
  }
  const bl = (from: number, to: number) => branchWord(from, to, 14, true);
  if (p.u32(GR3X_CREATION_SEARCH_CALL) !== bl(GR3X_CREATION_SEARCH_CALL, GR3X_CREATION_SEARCH)) fail('creation search call');
  const cap = (r: string) => `cmp ${r},#9;movhi ${r},#9;`;
  const open = p.code(`push {r1};ldrb r1,[r0,#2];${cap('r1')}add r1,r1,#10;${note}ldrb r1,[r0,#3];${cap('r1')}add r1,r1,#20;${note}
    ldrb r1,[r0,#6];and r1,r1,#7;add r1,r1,#30;${note}pop {r1};mov ip,sp;b #${GR3X_PLAY_OPEN + 4};`);
  const creation = p.code(`push {r1};mov r1,#50;${note}pop {r1};mov ip,sp;b #${GR3X_MOVE_TO_CREATION + 4};`);
  const search = p.code(`push {r4,lr};bl #${GR3X_CREATION_SEARCH};mov r4,r0;cmp r0,#0;moveq r1,#60;movne r1,#61;${note}mov r0,r4;pop {r4,pc};`);
  const last = p.code(`push {r1};mov r1,#77;${note}pop {r1};mov ip,sp;b #${GR3X_MOVE_TO_LAST + 4};`);
  p.patch(GR3X_PLAY_OPEN, 0xe1a0c00d, branchWord(GR3X_PLAY_OPEN, open), 'play probe: playback opening noted');
  p.patch(GR3X_MOVE_TO_CREATION, 0xe1a0c00d, branchWord(GR3X_MOVE_TO_CREATION, creation), 'play probe: MoveToCreationFile noted');
  p.patch(GR3X_CREATION_SEARCH_CALL, bl(GR3X_CREATION_SEARCH_CALL, GR3X_CREATION_SEARCH), bl(GR3X_CREATION_SEARCH_CALL, search), 'play probe: the created file\'s search noted');
  p.patch(GR3X_MOVE_TO_LAST, 0xe1a0c00d, branchWord(GR3X_MOVE_TO_LAST, last), 'play probe: MoveToLastFile noted');
  return { playOpen: open, playCreation: creation, playSearch: search, playLast: last };
}
