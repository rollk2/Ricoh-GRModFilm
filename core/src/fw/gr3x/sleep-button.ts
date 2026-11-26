// SPDX-License-Identifier: GPL-2.0-only
/**
 * GR III 2.10 / IIIx 1.60, `sleepButton` (T-SLP1, 2026-11-26): « Sleep Mode » as a button function (47), the camera's own
 * sleep at once (docs/film-mode-notes.md, « GR III : mode veille »).
 *
 * The camera has a sleep (Setup, Sleep Mode: Off, 1 .. 30 min) run by AppShutDownModel (0x5320afbc(0x5320ad88())): when the
 * delay is over, its timer handler (0x5322aaf4) calls 0x5322a89c(model): + 0x40 = 1 (asleep), the screen off (0x5322a850),
 * event 0x19a posted. Its event handler (0x5322ae44, called by the events' dispatcher 0x5316d5dc before the models that run
 * the buttons' functions) counts the events 1 .. 0x2d as activity (0x5323becc): asleep, any of them wakes the camera
 * (0x5322a970: the screen on, + 0x40 = 0). That is any key, as the camera does it.
 *
 *  - The function (`enter`, every register kept): the model's own conditions for falling asleep (0x5322a3f0: the event
 *    queue, sleep allowed + 9, the shooting and recording states), without the delay's setting (the key works with Sleep
 *    Mode Off too), then 0x5322a89c(model); already asleep, nothing. Before it, GR3X_SLEEP_FLAG = 1.
 *  - The key that put the camera to sleep is still to be released: at the activity test of the event handler
 *    (0x5322aed4, `bl 0x5323becc`), while the flag is up, a key event's release (its state byte 1) and its held repeats
 *    (state 2, sub-state not 0) are no activity, and the release takes the flag down; a press (state 2) takes it down and
 *    is activity as before: it wakes the camera. When the function ran on the release (a Hold key, a short press kept back
 *    until its release), the next event is a press: it wakes the camera.
 */
import { FirmwareError } from '../types';
import type { Gr3xSite } from './round10';

const lo = (v: number) => v & 0xffff, hi = (v: number) => v >>> 16;
const blWord = (at: number, to: number) => (0xeb000000 | (((to - at - 8) >> 2) & 0xffffff)) >>> 0;
const fail = (what: string): never => { throw new FirmwareError('unexpected-layout', `IIIx sleep button: ${what}`); };

/** The function's number (Snap DOF / Rewind Film are 46). */
export const GR3X_SLEEP_FUNCTION = 47;
/** Its text: the Setup line « Sleep Mode »'s title (its draw 0x53198a88, 21 languages). */
export const GR3X_SLEEP_TEXT = 0x24d;
/** Its icon without the film mode's icons: the camera's « External Display Settings » function's (31). With them, a crescent
 * moon drawn after them (film-mode-icons.ts, `sleepModeIcon`: the film icons' base + 4). */
export const GR3X_SLEEP_ICON = 0x16e;
/** RAM: round 10's zero-filled byte GR3X_SR_LAST, used by the SR speed's diagnostic only (never with this). */
export const GR3X_SLEEP_FLAG = 0x558043b6;

const APP = 0x5320ad88, SHUTDOWN_MODEL = 0x5320afbc, ENTER = 0x5322a89c;
/** In the event handler: `bl 0x5323becc` (r0 the event's kind, r7 the event, r4 the model). */
export const GR3X_SLEEP_ACTIVITY_CALL = 0x5322aed4, GR3X_ACTIVITY = 0x5323becc;
/** The conditions of 0x5322a3f0 / 0x5322a38c (the model r4, the app r5, 0x5320b19c(app) r6). */
const QUEUE = 0x5320aefc, QUEUE_READY = 0x53228a90, CAPTURE_MODEL = 0x5320b19c, LOCK_MODEL = 0x5320b13c, LOCKED = 0x53233874;
const LIVE = 0x53525d5c, LIVE_STATE = 0x53548638, LIVE_BUSY = 0x53548f50, BUSY_MODEL = 0x5320b1fc, BUSY = 0x5323c1f0;
const STATES = [0x532372f0, 0x53236f30, 0x532374e0] as const;

export interface Gr3xSleepProgram {
  code(source: string): number;
  patch(address: number, expected: number, replacement: number, reason: string): void;
  u32(address: number): number;
  sites: readonly Gr3xSite[];
}

/** Returns `enter` (the function's code, every register kept) and the activity test's replacement. */
export function installGr3xSleepButton(p: Gr3xSleepProgram) {
  if (p.sites.some(s => s.address === GR3X_SLEEP_ACTIVITY_CALL)) fail('the activity test is already patched');
  if (p.u32(GR3X_SLEEP_ACTIVITY_CALL) !== blWord(GR3X_SLEEP_ACTIVITY_CALL, GR3X_ACTIVITY)) fail('the activity test is not as expected');
  // The model's code as the camera has it: the entry, its flag, the conditions' first calls.
  if (p.u32(ENTER) !== 0xe1a0c00d || p.u32(ENTER + 0x18) !== 0xe5c02040) fail('the sleep entry is not as expected');
  if (p.u32(0x5322a3f0 + 0x28) !== blWord(0x5322a418, QUEUE_READY) || p.u32(0x5322a38c + 0x30) !== blWord(0x5322a3bc, LOCKED)) fail('the sleep conditions are not as expected');
  const ram = (r: string, label: string) => `cmp ${r},#0x40000000;blo ${label};cmp ${r},#0xc0000000;bhs ${label};tst ${r},#3;bne ${label};`;
  const enter = p.code(`push {r0,r1,r2,r3,r4,r5,r6,ip,lr};
    bl #${APP};mov r5,r0;bl #${SHUTDOWN_MODEL};${ram('r0', 'done')}mov r4,r0;
    ldrb r0,[r4,#0x40];cmp r0,#0;bne done;ldrb r0,[r4,#9];cmp r0,#0;beq done;
    mov r0,r5;bl #${CAPTURE_MODEL};mov r6,r0;
    mov r0,r5;bl #${QUEUE};bl #${QUEUE_READY};cmp r0,#0;beq done;
    mov r0,r5;bl #${LOCK_MODEL};mov r1,#2;bl #${LOCKED};cmp r0,#0;bne done;
    bl #${LIVE};ldr r0,[r0];bl #${LIVE_STATE};sub r0,r0,#2;cmp r0,#1;bls done;
    mov r0,r5;bl #${BUSY_MODEL};bl #${BUSY};cmp r0,#0;bne done;
    ${STATES.map(s => `mov r0,r6;bl #${s};cmp r0,#0;bne done;`).join('')}
    bl #${LIVE};ldr r0,[r0];bl #${LIVE_BUSY};cmp r0,#0;bne done;
    movw ip,#${lo(GR3X_SLEEP_FLAG)};movt ip,#${hi(GR3X_SLEEP_FLAG)};mov r0,#1;strb r0,[ip];
    mov r0,r4;bl #${ENTER};
    done:pop {r0,r1,r2,r3,r4,r5,r6,ip,pc};`);
  // The activity test (r0 the kind, r7 the event): r2, r3 and ip are free here (caller-saved, the handler reloads them).
  const activity = p.code(`movw ip,#${lo(GR3X_SLEEP_FLAG)};movt ip,#${hi(GR3X_SLEEP_FLAG)};ldrb r3,[ip];cmp r3,#0;beq native;
    sub r2,r0,#1;cmp r2,#0x2c;bhi native;
    ldr r2,[r7,#4];${ram('r2', 'native')}ldrb r3,[r2];cmp r3,#1;beq released;cmp r3,#2;bne native;
    ldr r3,[r2,#4];cmp r3,#0;movne r0,#0;bxne lr;
    mov r3,#0;strb r3,[ip];b native;
    released:mov r3,#0;strb r3,[ip];mov r0,#0;bx lr;
    native:b #${GR3X_ACTIVITY};`);
  p.patch(GR3X_SLEEP_ACTIVITY_CALL, blWord(GR3X_SLEEP_ACTIVITY_CALL, GR3X_ACTIVITY), blWord(GR3X_SLEEP_ACTIVITY_CALL, activity),
    'sleep button: the key that put the camera to sleep does not wake it when released');
  return { sleepEnter: enter, sleepActivity: activity };
}
