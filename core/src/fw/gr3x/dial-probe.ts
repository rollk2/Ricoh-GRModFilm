// SPDX-License-Identifier: GPL-2.0-only
/**
 * GR III 2.10 / IIIx 1.60, T-DIAL1 (test builds only, `dialProbe`): which key codes and which
 * routes the rear dial's rotation takes, before neutralising it (the build option to come).
 *
 *  - ActionModel::OnEvent (0x53221a1c, key code in r1, 1..0x40, every controller): a table of four
 *    { key, count } at GR3X_DIAL_TABLE counts the keys seen (a fifth different key is not counted).
 *  - The capture-ready rear dial router (0x53295da0, `RDIAL` in GR Mod's profile; r3 the direction,
 *    as tools/gr3x/rear_dial_probe.py runs it): byte + 8 counts its calls with direction 0, + 9
 *    with any other.
 *  - The date imprint's research module (datestamp.c -DKEY_DIAG) prints the table after the
 *    grain's tag, "  kk.cc" per key and "  mm.pp" for the router, then clears it: each photo shows
 *    the gestures made since the previous one was encoded.
 * Every register and the flags are kept; both hooks run the function's own first instruction.
 */
import { branchWord } from '../aspect/arm';
import { FirmwareError } from '../types';
import type { Gr3xSite } from './round10';

/** Round 10's zero-filled words (free: the WB key uses 0x55804390 and 0x55804394, the picture look word 0x558043a4). */
export const GR3X_DIAL_TABLE = 0x55804398;
export const GR3X_KEY_EVENT_ENTRY = 0x53221a1c, GR3X_REAR_DIAL_ROUTER = 0x53295da0;
const lo = (v: number) => v & 0xffff, hi = (v: number) => v >>> 16;

export interface Gr3xDialProgram {
  code(source: string): number;
  patch(address: number, expected: number, replacement: number, reason: string): void;
  u32(address: number): number;
  sites: readonly Gr3xSite[];
}

export function installGr3xDialProbe(p: Gr3xDialProgram) {
  const fail = (m: string): never => { throw new FirmwareError('unexpected-layout', `IIIx dial probe: ${m}`); };
  for (const at of [GR3X_KEY_EVENT_ENTRY, GR3X_REAR_DIAL_ROUTER]) {
    if (p.u32(at) !== 0xe1a0c00d) fail(`entry at ${at.toString(16)}`);
    if (p.sites.some(s => s.address === at)) fail(`already patched at ${at.toString(16)}`);
  }
  const T = `movw ip,#${lo(GR3X_DIAL_TABLE)};movt ip,#${hi(GR3X_DIAL_TABLE)};`;
  const key = p.code(`push {r0,r2,r3};mrs r3,cpsr;push {r3};${T}mov r2,#0;
    find:ldrb r0,[ip,r2,lsl #1];cmp r0,r1;beq hit;cmp r0,#0;beq hit;add r2,r2,#1;cmp r2,#4;blo find;b skip;
    hit:add r3,ip,r2,lsl #1;strb r1,[r3];ldrb r0,[r3,#1];cmp r0,#99;addlo r0,r0,#1;strb r0,[r3,#1];
    skip:pop {r3};msr cpsr_f,r3;pop {r0,r2,r3};mov ip,sp;b #${GR3X_KEY_EVENT_ENTRY + 4};`);
  p.patch(GR3X_KEY_EVENT_ENTRY, 0xe1a0c00d, branchWord(GR3X_KEY_EVENT_ENTRY, key), 'dial probe: the keys seen');
  const router = p.code(`push {r0,r1};mrs r1,cpsr;push {r1};${T}cmp r3,#0;moveq r1,#8;movne r1,#9;ldrb r0,[ip,r1];cmp r0,#99;addlo r0,r0,#1;strb r0,[ip,r1];
    pop {r1};msr cpsr_f,r1;pop {r0,r1};mov ip,sp;b #${GR3X_REAR_DIAL_ROUTER + 4};`);
  p.patch(GR3X_REAR_DIAL_ROUTER, 0xe1a0c00d, branchWord(GR3X_REAR_DIAL_ROUTER, router), 'dial probe: the rear dial router\'s calls');
  return { dialKey: key, dialRouter: router, dialTable: GR3X_DIAL_TABLE };
}
