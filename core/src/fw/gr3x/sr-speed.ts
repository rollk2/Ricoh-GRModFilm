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
 * The comparison is on the float's bits as signed integers (no VFP compare), a negative one's other
 * bits inverted (x ^ 0x7fffffff: then the order of the integers is the floats'). The boundary lies
 * a sixth of a stop above the threshold (between it and the next third-stop speed).
 *
 * `diag`: the key ring (play-probe.ts) notes each change of what is given: 60 SR Off (Shake Reduction
 * Off, or the camera's own rules), 61 On, 62 Off by the speed; RAM byte GR3X_SR_LAST (the note + 1).
 *
 * The menu (T-SR2, no `seconds`): Shake Reduction's own list (record 42: Off, On) becomes Off, 1/4000
 * .. 30" (53 values), kept in its own byte (+0x4f6: 0 Off, 1 + k the speed GR3X_SR_SPEEDS[k]; 1, the
 * factory On, is 1/4000: always On), so it follows every BOX and P, Av, Tv, M as Shake Reduction
 * did (the settings record has no free byte left). The byte's readers see On / Off: its getter
 * (0x53245378: the SR button's cycle, the panels, the icons) and the live value's (0x53271dc4) give
 * 1 for any speed. The list's four functions are record 42's own: count 53, each value drawn with
 * the On icon and its text (Off: the camera's icon and text 2), set through the native writer
 * (0x532731d4, Off first then the value, so that the live value changes and the DSP state is sent
 * again), current when the byte is the value. The SR button turns a speed Off, then back to
 * 1/4000. The speed's boundaries are a table of float bits (`append`). `icon` (T-SR3): the
 * shooting screen's SR icon follows the speed too.
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

/** The boundary's order key (float bits, a negative one's other bits inverted) for a threshold given
 * as an exposure time in seconds (a speed of the list). */
export function gr3xSrBoundary(seconds: number): number {
  const i = GR3X_SR_SPEEDS.findIndex(s => Math.abs(s / seconds - 1) < 1e-6);
  if (i < 0) fail(`threshold ${seconds} s is not a camera speed`);
  // The camera's third stops: Tv = 12 - i / 3 for 1/4000 (Tv 12) .. 30 s (Tv -5).
  const tv = 12 - i / 3 + 1 / 6;
  const bits = new Int32Array(new Float32Array([tv]).buffer)[0];
  return (bits < 0 ? bits ^ 0x7fffffff : bits) >>> 0;
}

export interface Gr3xSrSpeedProgram {
  code(source: string): number;
  append?(bytes: Uint8Array): number;
  patch(address: number, expected: number, replacement: number, reason: string): void;
  u32(address: number): number;
  sites: readonly Gr3xSite[];
}

/** The texts of the speeds, as the camera shows them (1/4000 .. 1/3, 0.4" .. 30"). */
export function gr3xSrSpeedText(seconds: number): string {
  if (seconds < 0.35) return `1/${Math.round(1 / seconds)}`;
  return `${seconds}"`;
}

export const GR3X_SR_GETTER = 0x53245378, GR3X_SR_LIVE_LOAD = 0x53271dd8, GR3X_SR_WRITER = 0x532731d4;
/** Record 42's count, draw, set and is-current functions (referenced by it only). */
export const GR3X_SR_LIST = { count: 0x531b3af4, draw: 0x531b5258, set: 0x531b6d84, current: 0x531b84dc } as const;
const APP = 0x5320ad88, SETTINGS = 0x5320b31c, DRAW = 0x5339e8b0, ICON_OFF = 0x1ae, ICON_ON = 0x1b0, TEXT_OFF = 2;
const RECORD_POINTER = 0x55063f34, SR_BYTE = 0x4f6, LIVE_VALUES = 0x53525d5c;
/** The shooting screen's SR icon: its chooser and its one call (T-SR3). */
export const GR3X_SR_ICON_CHOOSER = 0x532a9ae0, GR3X_SR_ICON_CALL = 0x53170e30;
/** RAM (icon diagnostic only): round 10's zero-filled byte after GR3X_SR_LAST. */
export const GR3X_SR_ICON_LAST = 0x558043b7;

export function installGr3xSrSpeed(p: Gr3xSrSpeedProgram, seconds: number | undefined, diag = false, srText = 0, icon: boolean | 'diag' = false) {
  const bl = (from: number, to: number) => branchWord(from, to, 14, true);
  for (const at of GR3X_SR_GET_CALLS) {
    if (p.u32(at) !== bl(at, GR3X_SR_GET)) fail(`SR getter call at ${at.toString(16)}`);
    if (p.sites.some(s => s.address === at)) fail(`${at.toString(16)} already patched`);
  }
  // The getter: mutex, ldr r0,[r5,#0x518], bl 0x5355181c (ldrb r0,[r3,#0x7d3]); the speed's: the same with 0x535510bc.
  if (p.u32(GR3X_SR_GET + 0x28) !== 0xe5950518 || p.u32(GR3X_LIVE_TV + 0x2c) !== 0xe5950518) fail('live getters');
  const note = diag ? `push {r1};add r1,r6,#60;movw ip,#${lo(GR3X_SR_LAST)};movt ip,#${hi(GR3X_SR_LAST)};ldrb r0,[ip];add r2,r6,#61;cmp r0,r2;beq same;strb r2,[ip];${gr3xRingNote}same:pop {r1};` : '';
  // The boundary in r1: fixed, or from the setting's byte (none: 1/4000 or below, no record).
  let boundary: string;
  if (seconds !== undefined) {
    const bound = gr3xSrBoundary(seconds);
    boundary = `movw r1,#${lo(bound)};movt r1,#${hi(bound)};`;
  } else {
    if (!p.append || !srText) fail('the menu needs its texts and its table');
    const table = p.append!(new Uint8Array(new Uint32Array(GR3X_SR_SPEEDS.map(gr3xSrBoundary)).buffer));
    boundary = `movw ip,#${lo(RECORD_POINTER)};movt ip,#${hi(RECORD_POINTER)};ldr ip,[ip];cmp ip,#0x40000000;blo out;cmp ip,#0xc0000000;bhs out;tst ip,#3;bne out;
      ldrb r1,[ip,#${SR_BYTE}];sub r1,r1,#1;cmp r1,#${GR3X_SR_SPEEDS.length};bhs out;cmp r1,#0;beq out;
      movw ip,#${lo(table)};movt ip,#${hi(table)};ldr r1,[ip,r1,lsl #2];`;
  }
  // r0 the live values; returns the SR value given (r1..r3, ip, s0 clobbered: a call's scratch).
  const get = p.code(`push {r4,r5,r6,lr};mov r4,r0;bl #${GR3X_SR_GET};mov r5,r0;mov r6,#0;cmp r5,#0;beq out;mov r6,#1;
    push {r1};mov r0,r4;bl #${GR3X_LIVE_TV};pop {r1};${boundary}vmov r0,s0;cmp r0,#0;mvnlt r0,r0;eorlt r0,r0,#0x80000000;cmp r0,r1;movge r5,#0;movge r6,#2;
    out:${note}mov r0,r5;pop {r4,r5,r6,pc};`);
  for (const at of GR3X_SR_GET_CALLS) p.patch(at, bl(at, GR3X_SR_GET), bl(at, get), 'SR speed: the SR given to the DSP state follows the shutter speed');
  if (seconds !== undefined) return { srSpeedGet: get };

  // The menu. The byte's readers: On / Off.
  if (p.u32(GR3X_SR_GETTER) !== 0xe5903004 || p.u32(GR3X_SR_GETTER + 4) !== 0xe5d304f6 || p.u32(GR3X_SR_GETTER + 8) !== 0xe12fff1e) fail('SR getter');
  if (p.u32(GR3X_SR_LIVE_LOAD) !== 0xe5d454f6 || p.u32(GR3X_SR_LIVE_LOAD + 4) !== 0xe3530000) fail('live SR value');
  const L = GR3X_SR_LIST;
  if (p.u32(L.count) !== 0xe3a00002 || p.u32(L.count + 4) !== 0xe12fff1e) fail('list count');
  for (const at of [L.draw, L.set, L.current]) if (p.u32(at) !== (at === L.current ? 0xe1a0c00d : 0xe1a0c00d)) fail('list functions');
  for (const at of [GR3X_SR_GETTER + 8, GR3X_SR_LIVE_LOAD, L.count, L.draw, L.set, L.current]) if (p.sites.some(s => s.address === at)) fail(`${at.toString(16)} already patched`);
  const norm = p.code('cmp r0,#0;movne r0,#1;bx lr;');
  p.patch(GR3X_SR_GETTER + 8, 0xe12fff1e, branchWord(GR3X_SR_GETTER + 8, norm), 'SR speed: Shake Reduction\'s getter gives On for any speed');
  // In 0x53271dc4, after its push (lr saved): r5 the byte as On / Off; the flags are set again after.
  const live = p.code(`ldrb r5,[r4,#${SR_BYTE}];cmp r5,#0;movne r5,#1;bx lr;`);
  p.patch(GR3X_SR_LIVE_LOAD, 0xe5d454f6, bl(GR3X_SR_LIVE_LOAD, live), 'SR speed: the live SR value On for any speed');
  const n = GR3X_SR_SPEEDS.length + 1;
  p.patch(L.count, 0xe3a00002, 0xe3a00000 | n, `SR speed: Shake Reduction\'s list of ${n} (Off, 1/4000 .. 30")`);
  // draw(this, target, item): the target drawn with an icon and a text.
  const draw = p.code(`mov r0,r1;cmp r2,#0;movweq r1,#${ICON_OFF};moveq r2,#${TEXT_OFF};beq go;movw r1,#${ICON_ON};
    movw r3,#${srText - 1};add r2,r2,r3;go:b #${DRAW};`);
  // set(this, item): Off, then the value (item = the byte).
  const set = p.code(`push {r4,r5,r6,lr};mov r4,r1;bl #${APP};bl #${SETTINGS};mov r5,r0;cmp r4,#0;beq last;mov r1,#0;bl #${GR3X_SR_WRITER};
    last:mov r0,r5;mov r1,r4;bl #${GR3X_SR_WRITER};pop {r4,r5,r6,pc};`);
  // current(this, item): the byte is the item.
  const current = p.code(`push {r4,lr};mov r4,r1;bl #${APP};bl #${SETTINGS};ldr r3,[r0,#4];ldrb r0,[r3,#${SR_BYTE}];cmp r0,r4;moveq r0,#1;movne r0,#0;pop {r4,pc};`);
  p.patch(L.draw, 0xe1a0c00d, branchWord(L.draw, draw), 'SR speed: Shake Reduction\'s values drawn (Off, the speeds)');
  p.patch(L.set, 0xe1a0c00d, branchWord(L.set, set), 'SR speed: Shake Reduction\'s value set');
  p.patch(L.current, 0xe1a0c00d, branchWord(L.current, current), 'SR speed: Shake Reduction\'s current value');
  // The SR icon of the shooting screen (T-SR3): its chooser 0x532a9ae0(model, r1, r2, r3, [sp]),
  // called once, at 0x53170e30, with bytes of the display's record ([view + 0x4e8]: r1 + 0x940,
  // r2 + 0x8c8, r3 + 0x928, [sp] + 0x8f8): r1 not 0, the icon of [sp] (0x53293a20); else r2 and r3
  // pick 0x1ae (r2 0, r3 0), 0x1af (0, 1), 0x1b0 (1, 0: the SR On icon), 0x1b1 (1, 1). r1 = 0 and r2
  // not 0 (SR shown On): r2 given as 0 when the live speed is faster than the threshold. T-FN1 to
  // T-FN5 took 0x533676ac (it prints « On » / « Off » on the debug console) and the settings monitor
  // 0x532a4f18: no effect, as expected now. `diag`: the key ring notes each change of
  // 60 + (r2 not 0) + 2 (r3 not 0) + 4 (r1 not 0) + 8 (r2 made 0); RAM byte GR3X_SR_ICON_LAST.
  if (!icon) return { srSpeedGet: get, srSpeedDraw: draw, srSpeedSet: set, srSpeedCurrent: current, srSpeedText: srText };
  const at = GR3X_SR_ICON_CALL;
  if (p.u32(at) !== bl(at, GR3X_SR_ICON_CHOOSER)) fail('SR icon call');
  if (p.sites.some(s => s.address === at)) fail('SR icon call already patched');
  const keep = boundary.replace(/\bout;/g, 'keep;');
  const iconNote = icon === 'diag' ? `mov r1,#60;cmp r2,#0;addne r1,r1,#1;cmp r3,#0;addne r1,r1,#2;cmp r0,#0;addne r1,r1,#4;cmp r4,#0;addne r1,r1,#8;
    movw ip,#${lo(GR3X_SR_ICON_LAST)};movt ip,#${hi(GR3X_SR_ICON_LAST)};ldrb r0,[ip];add r2,r1,#1;cmp r0,r2;beq same;strb r2,[ip];${gr3xRingNote}same:` : '';
  // The fifth argument stays at [sp]: everything pushed is popped before the jump to the chooser.
  const shown = p.code(`push {r0,r1,r2,r3,r4,lr};mov r4,#0;cmp r1,#0;bne keep;cmp r2,#0;beq keep;
    bl #${LIVE_VALUES};ldr r0,[r0];bl #${GR3X_LIVE_TV};${keep}vmov r0,s0;cmp r0,#0;mvnlt r0,r0;eorlt r0,r0,#0x80000000;cmp r0,r1;movge r4,#1;
    keep:${icon === 'diag' ? `ldr r0,[sp,#4];ldr r2,[sp,#8];ldr r3,[sp,#12];${iconNote}` : ''}cmp r4,#0;pop {r0,r1,r2,r3,r4,lr};movne r2,#0;b #${GR3X_SR_ICON_CHOOSER};`);
  p.patch(at, bl(at, GR3X_SR_ICON_CHOOSER), bl(at, shown), 'SR speed: the shooting screen\'s SR icon follows the shutter speed');
  return { srSpeedGet: get, srSpeedDraw: draw, srSpeedSet: set, srSpeedCurrent: current, srSpeedShown: shown, srSpeedText: srText };
}
