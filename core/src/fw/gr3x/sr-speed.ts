// SPDX-License-Identifier: GPL-2.0-only
/**
 * GR III 2.10 / IIIx 1.60, `srSpeed` (T-SR1): Shake Reduction by shutter speed. With Shake
 * Reduction On, SR is given as On while the shutter speed is the threshold or slower, Off when it is
 * faster.
 *
 * The live SR value (live record + 0x7d3, item 0xed, set from 0x53271dc4 by the menu's writers) has
 * one getter, 0x5354ae2c(live values), called only to hand it to DspStateService::SetStatus
 * (0x535781c4, item 8): at a change of the live shutter speed (event 0x82: speed, SR, item 0xe), at a
 * change of SR (event 0xed), at the full state sending 0x535785b4, and once more at 0x5349786c (a
 * copy of the shooting state). Each call becomes ours: the getter, then, when it says On, the live
 * speed (0x53548930(live values), APEX Tv as a float: log2(1/time)); faster than the threshold, 0.
 * The menu, its writers and the live value itself are untouched (the camera still shows SR On).
 *
 * The comparison is on the float's bits as signed integers (no VFP compare): the threshold is
 * positive, a speed of a second or more (Tv <= 0) compares lower, as it should. The boundary lies a
 * sixth of a stop above the threshold (between it and the next third-stop speed).
 *
 * `diag`: the key ring (play-probe.ts) notes each change of what is given: 60 SR Off (Shake Reduction
 * Off, or the camera's own rules), 61 On, 62 Off by the speed; RAM byte GR3X_SR_LAST (the note + 1).
 */
import { branchWord } from '../aspect/arm';
import { FirmwareError } from '../types';
import type { Gr3xSite } from './round10';
import { gr3xRingNote } from './play-probe';

const lo = (v: number) => v & 0xffff, hi = (v: number) => v >>> 16;
const fail = (what: string): never => { throw new FirmwareError('unexpected-layout', `IIIx SR speed: ${what}`); };

export const GR3X_SR_GET = 0x5354ae2c, GR3X_LIVE_TV = 0x53548930;
export const GR3X_SR_GET_CALLS = [0x5349786c, 0x53497bc4, 0x53497c24, 0x535785b4] as const;
/** RAM (diagnostic only): round 10's zero-filled byte after the roll's folder name (0x558043b0..b5). */
export const GR3X_SR_LAST = 0x558043b6;
/** Shutter speeds offered (the camera's third stops, 1/4000 .. 30 s), as exposure times in seconds. */
export const GR3X_SR_SPEEDS = [
  1 / 4000, 1 / 3200, 1 / 2500, 1 / 2000, 1 / 1600, 1 / 1250, 1 / 1000, 1 / 800, 1 / 640, 1 / 500, 1 / 400, 1 / 320, 1 / 250,
  1 / 200, 1 / 160, 1 / 125, 1 / 100, 1 / 80, 1 / 60, 1 / 50, 1 / 40, 1 / 30, 1 / 25, 1 / 20, 1 / 15, 1 / 13, 1 / 10, 1 / 8,
  1 / 6, 1 / 5, 1 / 4, 1 / 3, 0.4, 0.5, 0.6, 0.8, 1, 1.3, 1.6, 2, 2.5, 3.2, 4, 5, 6, 8, 10, 13, 15, 20, 25, 30,
] as const;

/** The boundary's float bits for a threshold given as an exposure time in seconds (a speed of the list). */
export function gr3xSrBoundary(seconds: number): number {
  const i = GR3X_SR_SPEEDS.findIndex(s => Math.abs(s / seconds - 1) < 1e-6);
  if (i < 0) fail(`threshold ${seconds} s is not a camera speed`);
  // The camera's third stops: Tv = 12 - i / 3 for 1/4000 (Tv 12) .. 30 s (Tv -5).
  const tv = 12 - i / 3 + 1 / 6;
  const f = new Float32Array([tv]);
  return new Int32Array(f.buffer)[0] >>> 0;
}

export interface Gr3xSrSpeedProgram {
  code(source: string): number;
  patch(address: number, expected: number, replacement: number, reason: string): void;
  u32(address: number): number;
  sites: readonly Gr3xSite[];
}

export function installGr3xSrSpeed(p: Gr3xSrSpeedProgram, seconds: number, diag = false) {
  const bl = (from: number, to: number) => branchWord(from, to, 14, true);
  for (const at of GR3X_SR_GET_CALLS) {
    if (p.u32(at) !== bl(at, GR3X_SR_GET)) fail(`SR getter call at ${at.toString(16)}`);
    if (p.sites.some(s => s.address === at)) fail(`${at.toString(16)} already patched`);
  }
  // The getter: mutex, ldr r0,[r5,#0x518], bl 0x5355181c (ldrb r0,[r3,#0x7d3]); the speed's: the same with 0x535510bc.
  if (p.u32(GR3X_SR_GET + 0x28) !== 0xe5950518 || p.u32(GR3X_LIVE_TV + 0x2c) !== 0xe5950518) fail('live getters');
  const bound = gr3xSrBoundary(seconds);
  const note = diag ? `push {r1};add r1,r6,#60;movw ip,#${lo(GR3X_SR_LAST)};movt ip,#${hi(GR3X_SR_LAST)};ldrb r0,[ip];add r2,r6,#61;cmp r0,r2;beq same;strb r2,[ip];${gr3xRingNote}same:pop {r1};` : '';
  // r0 the live values; returns the SR value given (r1..r3, ip, s0 clobbered: a call's scratch).
  const get = p.code(`push {r4,r5,r6,lr};mov r4,r0;bl #${GR3X_SR_GET};mov r5,r0;mov r6,#0;cmp r5,#0;beq out;mov r6,#1;
    mov r0,r4;bl #${GR3X_LIVE_TV};vmov r0,s0;movw r1,#${lo(bound)};movt r1,#${hi(bound)};cmp r0,r1;movge r5,#0;movge r6,#2;
    out:${note}mov r0,r5;pop {r4,r5,r6,pc};`);
  for (const at of GR3X_SR_GET_CALLS) p.patch(at, bl(at, GR3X_SR_GET), bl(at, get), 'SR speed: the SR given to the DSP state follows the shutter speed');
  return { srSpeedGet: get };
}
