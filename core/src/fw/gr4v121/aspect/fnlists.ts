// SPDX-License-Identifier: GPL-2.0-only
/**
 * GR Mod Film 1.2, test builds (`TestOptions.fnAll`): the Fn button functions offered to every button.
 *
 * The three lists of functions (byte tables, built by 0x531dd108, 0x531dd188 and 0x531dd20c, each function asked of the
 * filter 0x531d7be0 which leaves out the other models': ND Filter, White Balance and HDF on the Monochrome) are, in the
 * official file:
 *   A 0x53de6764, 39 (Fn, the four-way pad's keys, Wireless short), B 0x53de67fc, 35 (Wireless long), C 0x53de695c, 37 (Focus).
 * The jump tables that run them (GetEventCustomize 0x53399990; GetEventSwitchWlan 0x53398320, whose table at 0x53398488 is
 * indexed by function + 1 and ends in an assertion for 5, 6, 7 and 33, the four the Wireless lists do not offer) show that
 * the camera runs more than it lists:
 *   - 23 Flash Exposure Comp. is in no list (its own handler exists, the ADJ lever has it);
 *   - 37 Airplane Mode is in C only.
 * Added here, in the official order (23 after 22, 37 after 36): 23 and 37 in A and B, 23 in C. 5, 6, 7 and 33 stay out of B
 * and C (their executor refuses them: they are not added without reading it).
 */
import { FirmwareError } from '../../types';
import { movWord } from './arm';
import { Patch, expectWord } from './build';

interface FnList { name: string; table: number; count: number; movw: number; movt: number; end: number; add: readonly number[] }

const LISTS: readonly FnList[] = [
  { name: 'A', table: 0x53de6764, count: 39, movw: 0x531dd10c, movt: 0x531dd110, end: 0x531dd120, add: [23, 37] },
  { name: 'B', table: 0x53de67fc, count: 35, movw: 0x531dd190, movt: 0x531dd194, end: 0x531dd1a4, add: [23, 37] },
  { name: 'C', table: 0x53de695c, count: 37, movw: 0x531dd214, movt: 0x531dd218, end: 0x531dd228, add: [23] },
];
const AFTER: Readonly<Record<number, number>> = { 23: 22, 37: 36 };

export function installFnLists(patch: Patch): void {
  for (const l of LISTS) {
    expectWord(patch, l.movw, movWord(4, l.table & 0xffff));
    expectWord(patch, l.movt, movWord(4, l.table >>> 16, true));
    expectWord(patch, l.end, 0xe2846000 | l.count);
    const official = Array.from(patch.read(l.table, l.count));
    const list = [...official];
    for (const f of l.add) {
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
