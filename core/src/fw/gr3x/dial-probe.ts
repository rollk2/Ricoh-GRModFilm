// SPDX-License-Identifier: GPL-2.0-only
/**
 * GR III 2.10 / IIIx 1.60, T-DIAL2 (test builds only, `dialProbe`): which key codes the rear dial's
 * rotation gives, before neutralising it (the build option to come).
 *
 *  - ActionModel::OnEvent (0x53221a1c, key code in r1, 1..0x40, every controller): the last eleven
 *    keys in a ring at GR3X_DIAL_TABLE (bytes 0..10, byte 11 the next slot), written here only.
 *  - The date imprint's research module (datestamp.c -DKEY_DIAG) prints them in order after the
 *    grain's tag. T-DIAL1's table of counts, cleared by the encode, lost counts (the hook and the
 *    encode share the words badly) and the capture-ready rear dial router (0x53295da0) turned out
 *    to be called all the time (99 both ways on every photo): both dropped.
 * Every register and the flags are kept; the hook runs the function's own first instruction.
 */
import { branchWord } from '../aspect/arm';
import { FirmwareError } from '../types';
import type { Gr3xSite } from './round10';

/** Round 10's zero-filled words (free: the WB key uses 0x55804390 and 0x55804394, the picture look word 0x558043a4). */
export const GR3X_DIAL_TABLE = 0x55804398;
export const GR3X_KEY_EVENT_ENTRY = 0x53221a1c;
const lo = (v: number) => v & 0xffff, hi = (v: number) => v >>> 16;

export interface Gr3xDialProgram {
  code(source: string): number;
  patch(address: number, expected: number, replacement: number, reason: string): void;
  u32(address: number): number;
  sites: readonly Gr3xSite[];
}

export function installGr3xDialProbe(p: Gr3xDialProgram) {
  const fail = (m: string): never => { throw new FirmwareError('unexpected-layout', `IIIx dial probe: ${m}`); };
  const at = GR3X_KEY_EVENT_ENTRY;
  if (p.u32(at) !== 0xe1a0c00d) fail('key entry');
  if (p.sites.some(s => s.address === at)) fail('key entry already patched');
  const T = `movw ip,#${lo(GR3X_DIAL_TABLE)};movt ip,#${hi(GR3X_DIAL_TABLE)};`;
  const key = p.code(`push {r0,r2};mrs r2,cpsr;push {r2};${T}ldrb r0,[ip,#11];cmp r0,#11;movhs r0,#0;strb r1,[ip,r0];add r0,r0,#1;cmp r0,#11;moveq r0,#0;strb r0,[ip,#11];
    pop {r2};msr cpsr_f,r2;pop {r0,r2};mov ip,sp;b #${at + 4};`);
  p.patch(at, 0xe1a0c00d, branchWord(at, key), 'dial probe: the last keys');
  return { dialKey: key, dialTable: GR3X_DIAL_TABLE };
}
