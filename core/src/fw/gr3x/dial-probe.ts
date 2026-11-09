// SPDX-License-Identifier: GPL-2.0-only
/**
 * GR III 2.10 / IIIx 1.60, T-DIAL2 (test builds only, `dialProbe`): which key codes the rear dial's
 * rotation gives, before neutralising it (the build option to come).
 *
 *  - ActionModel::OnEvent (0x53221a1c, key code in r1, 1..0x40, every controller): the last seven
 *    keys in a ring at GR3X_DIAL_TABLE (bytes 0..6, byte 7 the next slot), written here only.
 *  - The date imprint's research module (datestamp.c -DKEY_DIAG) prints them in order after the
 *    grain's tag. T-DIAL1's table of counts, cleared by the encode, lost counts (the hook and the
 *    encode share the words badly) and the capture-ready rear dial router (0x53295da0) turned out
 *    to be called all the time (99 both ways on every photo): both dropped.
 * Every register and the flags are kept; the hook runs the function's own first instruction.
 */
import { branchWord } from '../aspect/arm';
import { FirmwareError } from '../types';
import type { Gr3xSite } from './round10';

/** The research ring: 8 bytes of round 10's zero-filled words that nothing else uses (0x55804390..
 * 0x558043a3 hold the WB key's words and the film roll's flags, 0x558043a4 the picture look word,
 * 0x558043b0 on the roll's folder name and states). Up to T-DOF3 it was at 0x55804398, over the
 * film roll's flags (test builds only). */
export const GR3X_DIAL_TABLE = 0x558043a8, GR3X_DIAL_RING = 7;
export const GR3X_KEY_EVENT_ENTRY = 0x53221a1c;
const lo = (v: number) => v & 0xffff, hi = (v: number) => v >>> 16;

export interface Gr3xDialProgram {
  code(source: string): number;
  patch(address: number, expected: number, replacement: number, reason: string): void;
  u32(address: number): number;
  sites: readonly Gr3xSite[];
}

/** The rear dial's rotation as ActionModel::OnEvent receives it (T-DIAL1, T-DIAL2 on the camera:
 * 24 and 25, in the viewfinder as in Snap mode; up / down / left / right 26 / 29 / 32 / 35, OK 50,
 * ADJ pressed 14, the shot 5 to 8). */
export const GR3X_REAR_DIAL_KEYS = [24, 25] as const;

/**
 * `rearDialOff` (build option): the rear dial's rotation ignored everywhere (viewfinder, menus,
 * playback), its four buttons and OK as before. At ActionModel::OnEvent's entry, which every key
 * of every controller goes through, the two codes return 1 (handled) without anything done; any
 * other key goes on (the function's own first instruction, then + 4). With the probe (T-DIAL3)
 * the key is noted in the ring first, then filtered. With `probe: 'hold'` (T-HOLD0: the codes of
 * short and long presses) the shot's codes 5 to 8 and a key equal to the last noted are left out,
 * so that a held key's repeats take one slot.
 */
/** `fnHeld` (Fn + front dial, hold.ts): the hold state's address; while its first byte is Fn's
 * press (22: Fn kept back), the rear dial's codes go on (the front dial's turns made into them). */
export function installGr3xRearDialOff(p: Gr3xDialProgram, probe: boolean | 'hold' = false, next?: number, fnHeld?: number) {
  const fail = (m: string): never => { throw new FirmwareError('unexpected-layout', `IIIx rear dial off: ${m}`); };
  const at = GR3X_KEY_EVENT_ENTRY;
  if (p.u32(at) !== 0xe1a0c00d) fail('key entry');
  if (p.sites.some(s => s.address === at)) fail('key entry already patched');
  const T = `movw ip,#${lo(GR3X_DIAL_TABLE)};movt ip,#${hi(GR3X_DIAL_TABLE)};`;
  const skip = probe === 'hold' ? 'sub r2,r1,#5;cmp r2,#3;bls hskip;subs r2,r0,#1;movmi r2,#6;ldrb r2,[ip,r2];cmp r2,r1;beq hskip;' : '';
  const ring = probe ? `push {r0,r2};${T}ldrb r0,[ip,#7];cmp r0,#7;movhs r0,#0;${skip}strb r1,[ip,r0];add r0,r0,#1;cmp r0,#7;moveq r0,#0;strb r0,[ip,#7];${probe === 'hold' ? 'hskip:' : ''}pop {r0,r2};` : '';
  const [a, b] = GR3X_REAR_DIAL_KEYS;
  // `next`: the hold buttons' filter (hold.ts), which goes on to OnEvent itself.
  const held = fnHeld ? `bne go;movw ip,#${lo(fnHeld)};movt ip,#${hi(fnHeld)};ldrb ip,[ip];cmp ip,#22;beq go;mov r0,#1;bx lr;go:` : 'moveq r0,#1;bxeq lr;';
  const filter = p.code(`${ring}cmp r1,#${a};cmpne r1,#${b};${held}${next ? `b #${next};` : `mov ip,sp;b #${at + 4};`}`);
  p.patch(at, 0xe1a0c00d, branchWord(at, filter), 'rear dial off: its rotation ignored');
  return { rearDialFilter: filter, ...(probe ? { dialTable: GR3X_DIAL_TABLE } : {}) };
}

export function installGr3xDialProbe(p: Gr3xDialProgram) {
  const fail = (m: string): never => { throw new FirmwareError('unexpected-layout', `IIIx dial probe: ${m}`); };
  const at = GR3X_KEY_EVENT_ENTRY;
  if (p.u32(at) !== 0xe1a0c00d) fail('key entry');
  if (p.sites.some(s => s.address === at)) fail('key entry already patched');
  const T = `movw ip,#${lo(GR3X_DIAL_TABLE)};movt ip,#${hi(GR3X_DIAL_TABLE)};`;
  const key = p.code(`push {r0,r2};mrs r2,cpsr;push {r2};${T}ldrb r0,[ip,#7];cmp r0,#7;movhs r0,#0;strb r1,[ip,r0];add r0,r0,#1;cmp r0,#7;moveq r0,#0;strb r0,[ip,#7];
    pop {r2};msr cpsr_f,r2;pop {r0,r2};mov ip,sp;b #${at + 4};`);
  p.patch(at, 0xe1a0c00d, branchWord(at, key), 'dial probe: the last keys');
  return { dialKey: key, dialTable: GR3X_DIAL_TABLE };
}
