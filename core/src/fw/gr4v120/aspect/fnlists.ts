// SPDX-License-Identifier: GPL-2.0-only
/**
 * GR Mod Film 1.2, test builds (`TestOptions.fnAll`): the Fn button functions offered to every button.
 *
 * The three lists of functions (byte tables, built by 0x531dcb00, 0x531dcb80 and 0x531dcc04, each function asked of the
 * filter 0x531d75d8 which leaves out the other models': ND Filter, White Balance and HDF on the Monochrome) are, in the
 * official file:
 *   A 0x53de50c4, 39 (Fn, the four-way pad's keys, Wireless short), B 0x53de515c, 35 (Wireless long), C 0x53de52bc, 37 (the seventh row
 *   of Fn Button Setting, setting `CustomSwitchFocusSetting`: left as it is, it is set up as the user wants it).
 * The jump tables that run them (GetEventCustomize 0x533990e0; GetEventSwitchWlan 0x53397a70, whose table at 0x53397bd8 is
 * indexed by function + 1 and ends in an assertion for 5, 6, 7 and 33, the four the Wireless lists do not offer) show that
 * the camera runs more than it lists:
 *   - 23 Flash Exposure Comp. is in no list (its own handler exists, the ADJ lever has it);
 *   - 37 Airplane Mode is in C only.
 * Added here, in the official order (23 after 22, 37 after 36): 23 and 37 in A and B. C is not touched. 5, 6, 7 and 33 stay out
 * of B (its executor refuses them).
 */
import { FirmwareError } from '../../types';
import { movImmediate, movWord } from './arm';
import { Patch, expectWord } from './build';
import { adr } from '../target';

interface FnList { name: string; table: number; count: number; movw: number; movt: number; end: number; add: readonly number[] }

const LISTS: readonly FnList[] = [
  { name: 'A', table: adr(0x53de50c4), count: 39, movw: adr(0x531dcb04), movt: adr(0x531dcb08), end: adr(0x531dcb18), add: [23, 37] },
  { name: 'B', table: adr(0x53de515c), count: 35, movw: adr(0x531dcb88), movt: adr(0x531dcb8c), end: adr(0x531dcb9c), add: [23, 37] },
];
const AFTER: Readonly<Record<number, number>> = { 23: 22, 37: 36, 46: 36 };

/** `macro`: the function Macro Mode (46, holdlines.ts) also in list A (Fn, ISO, Drive and the fourth button's lines and the Hold lines'), after the last. */
export function installFnLists(patch: Patch, macro = false): void {
  for (const l of LISTS) {
    // Convergence step 2: the list as it is now, the official one or GR Mod 0.9's Constant Light's (`lamp.ts`, the official one
    // with function 0x29 at the end), which is installed first.
    const lowWord = patch.word(l.movw), highWord = patch.word(l.movt), endWord = patch.word(l.end);
    if ((lowWord & 0xfff0f000) >>> 0 !== 0xe3004000 || (highWord & 0xfff0f000) >>> 0 !== 0xe3404000 || (endWord & 0xffffff00) >>> 0 !== 0xe2846000) {
      throw new FirmwareError('unexpected-layout', `fn list ${l.name}: not built as expected`);
    }
    const current = (movImmediate(lowWord) | (movImmediate(highWord) << 16)) >>> 0;
    const count = endWord & 0xff;
    if (current === l.table) expectWord(patch, l.end, 0xe2846000 | l.count);
    const official = Array.from(patch.read(current, count));
    const list = [...official];
    for (const f of [...l.add, ...(macro && l.name === 'A' ? [46] : [])]) {
      if (list.includes(f)) continue;
      const at = list.indexOf(AFTER[f]);
      if (at < 0) throw new FirmwareError('unexpected-layout', `fn list ${l.name}: ${AFTER[f]} not found`);
      list.splice(at + 1, 0, f);
    }
    if (list.length === official.length) continue;
    const table = patch.append(Uint8Array.from(list), 4);
    patch.setWord(l.movw, movWord(4, table & 0xffff), `fn list ${l.name}: the longer table, low half`);
    patch.setWord(l.movt, movWord(4, table >>> 16, true), `fn list ${l.name}: the longer table, high half`);
    patch.setWord(l.end, 0xe2846000 | list.length, `fn list ${l.name}: ${list.length} functions`);
  }
}
