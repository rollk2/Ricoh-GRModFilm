// SPDX-License-Identifier: GPL-2.0-only
/**
 * GR Mod Film 1.2, test builds only (`TestOptions.keyDiag`): the key codes of the GR IV Monochrome 1.11 (GR IV 1.21).
 *
 * The camera turns each hardware key event into a key code (the translation 0x53257a10, which then jumps to
 * ActionModel::OnEvent 0x5325784c with the code in r1: the same layout as the GR III's 0x53222bdc / 0x53221414,
 * see gr3x/dial-probe.ts). This notes the last seven codes in a ring of 8 bytes at KEY_RING (byte 7: the next slot) and
 * the date imprint (with `{ words: KEY_RING }`) prints them on the 720-pixel pictures, so that a short and a long press of
 * each key can be read on the camera. The shot's codes 5 to 8 and a code equal to the one before it (a held key's repeats)
 * are left out.
 *
 * KEY_RING is FRAME_LOOK and the word after it (the look stash's, and a diagnostic word that nothing else uses here):
 * a build with the key diagnostics has no guard (no look stash).
 */
import { FirmwareError } from '../../types';
import { assembleWords, branchWord } from './arm';
import { Patch, expectWord } from './build';
import { extendZeroFill } from './lookstash';
import { adr } from '../target';

export const KEY_ENTRY = adr(0x5325784c);
export const KEY_RING = adr(0x55839038);

/** `next`: the filter the entry already goes to (the hold buttons'), which the diagnostics go on to in place of OnEvent's first instruction. */
export function installKeyDiag(patch: Patch, next = 0): void {
  if (!next) expectWord(patch, KEY_ENTRY, 0xe1a0c00d); // mov ip, sp
  extendZeroFill(patch);
  const lo = KEY_RING & 0xffff, hi = KEY_RING >>> 16;
  const hook = patch.append((at) => [
    ...assembleWords(`push {r0,r2};movw ip,#${lo};movt ip,#${hi};
      sub r2,r1,#5;cmp r2,#3;bls skip;
      ldrb r0,[ip,#7];cmp r0,#7;movhs r0,#0;
      subs r2,r0,#1;movmi r2,#6;ldrb r2,[ip,r2];cmp r2,r1;beq skip;
      strb r1,[ip,r0];add r0,r0,#1;cmp r0,#7;moveq r0,#0;strb r0,[ip,#7];
      skip:pop {r0,r2};${next ? `b #${next}` : `mov ip,sp;b #${KEY_ENTRY + 4}`}`, at),
  ], 4);
  if (hook === 0) throw new FirmwareError('internal', 'key diagnostics');
  patch.setWord(KEY_ENTRY, branchWord(KEY_ENTRY, hook), 'key diagnostics: the last key codes in a ring');
}
