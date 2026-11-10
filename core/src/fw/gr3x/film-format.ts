// SPDX-License-Identifier: GPL-2.0-only
/**
 * GR III 2.10 / IIIx 1.60, `formatRewind` (T-FMT1): formatting the card rewinds every roll.
 *
 * Before (T19-CARD3), a roll whose folder was gone was only noticed at the next advance (that frame
 * became frame 1 of a new roll), so the screen counter kept its number after a format; and a format
 * makes folder 100 again, so a roll kept in folder 100 even went on. Decision of 2026-11-10: every
 * loaded roll (U1, U2, U3 and the other BOXes) is rewound as soon as the card is formatted.
 *
 *  - The format (MediaFormat, src/MediaFormat.cpp): its one call, 0x534e62a0 `bl 0x534f0658`, in the
 *    media task, which returns the byte + 0x11 of its object (the caller then posts 0x25480206). A
 *    format done on the camera gives 1 (T-FMT2, ring « 51 »; T-FMT1 took 0 for done and never
 *    rewound). 1: a RAM byte (GR3X_FORMAT_FLAG) set, nothing else (no settings written from that task).
 *  - The screen counter's hook (film-roll.ts, at 0x532aa1f4, the user interface's task, as the Rewind
 *    Film line's action): first, with the byte set, the byte cleared and every going roll (started,
 *    frame not 0) of the six BOXes ended as the Rewind does (frame 0, the BOX's record saved), and the
 *    record in use's too when its mode is one of them (saved as well); then the counter as before. The
 *    counter is drawn in a U mode with Film Roll Mode on, before any shot: a roll formatted away never
 *    takes a frame. Every register is kept.
 */
import { branchWord } from '../aspect/arm';
import { FirmwareError } from '../types';
import type { Gr3xSite } from './round10';
import { gr3xRingNote } from './play-probe';
import { GR3X_APP_DATA, GR3X_APP_DATA_WRITE, GR3X_ROLL_COUNTER, GR3X_ROLL_FLAGS, GR3X_ROLL_FRAME, GR3X_ROLL_STARTED } from './film-roll';

const lo = (v: number) => v & 0xffff, hi = (v: number) => v >>> 16;
const fail = (what: string): never => { throw new FirmwareError('unexpected-layout', `IIIx format rewind: ${what}`); };

export const GR3X_FORMAT_CALL = 0x534e62a0, GR3X_FORMAT = 0x534f0658;
/** RAM: round 10's zero-filled byte after the roll's folder name (0x558043b0..b5); the SR speed's
 * diagnostic (test builds only) uses it too. */
export const GR3X_FORMAT_FLAG = 0x558043b6;
const MODEL = 0x55063f30, STORED = MODEL + 8, RECORD = 0xb26;

export interface Gr3xFormatProgram {
  code(source: string): number;
  patch(address: number, expected: number, replacement: number, reason: string): void;
  u32(address: number): number;
  sites: Gr3xSite[];
}

function wordOf(hexBytes: string) { const b = hexBytes.match(/../g)!.map(x => parseInt(x, 16)); return (b[0] | b[1] << 8 | b[2] << 16 | b[3] << 24) >>> 0; }
function hexWord(w: number) { return [w & 255, w >>> 8 & 255, w >>> 16 & 255, w >>> 24 & 255].map(b => b.toString(16).padStart(2, '0')).join(''); }

/** `counter`: the film roll's screen counter (film-roll.ts entries.filmRollCounter). */
export function installGr3xFormatRewind(p: Gr3xFormatProgram, counter: number, diag = false) {
  const bl = (from: number, to: number) => branchWord(from, to, 14, true);
  if (p.u32(GR3X_FORMAT_CALL) !== bl(GR3X_FORMAT_CALL, GR3X_FORMAT)) fail('the format\'s call');
  if (p.u32(GR3X_FORMAT) !== 0xe1a0c00d) fail('the format');
  if (p.sites.some(s => s.address === GR3X_FORMAT_CALL)) fail('the format\'s call already patched');
  const site = p.sites.find(s => s.address === GR3X_ROLL_COUNTER) ?? fail('the screen counter\'s hook');
  if (wordOf(site.replacement) !== branchWord(GR3X_ROLL_COUNTER, counter)) fail('the screen counter\'s hook');
  const F = `movw ip,#${lo(GR3X_FORMAT_FLAG)};movt ip,#${hi(GR3X_FORMAT_FLAG)};`;
  const ram = (r: string, label: string) => `cmp ${r},#0x40000000;blo ${label};cmp ${r},#0xc0000000;bhs ${label};tst ${r},#3;bne ${label};`;
  // `diag` (T-FMT2): the key ring notes 50 + the format's result (9 at most), and 60 + the rolls rewound (9 at most).
  const fnote = diag ? `push {r0,r1};cmp r0,#9;movhi r0,#9;add r1,r0,#50;${gr3xRingNote}pop {r0,r1};` : '';
  const formatted = p.code(`push {r4,lr};bl #${GR3X_FORMAT};${fnote}cmp r0,#1;bne out;${F}mov r4,#1;strb r4,[ip];out:pop {r4,pc};`);
  // r4 the mode in use (0 none), r5 the BOX, r6 its record; r7 the record in use.
  const end = (rec: string, index: string) => `add r9,r9,#1;mov r0,#0;strb r0,[${rec},#${GR3X_ROLL_FRAME}];bl #${GR3X_APP_DATA};ldr r0,[r0,#8];${index}movw r2,#${RECORD};mov r3,${rec};bl #${GR3X_APP_DATA_WRITE};`;
  const going = (rec: string, label: string) => `ldrb r0,[${rec},#${GR3X_ROLL_FLAGS}];tst r0,#${GR3X_ROLL_STARTED};beq ${label};ldrb r0,[${rec},#${GR3X_ROLL_FRAME}];cmp r0,#0;beq ${label};`;
  const rewind = p.code(`push {r0,r1,r2,r3,r4,r5,r6,r7,r8,r9,r10,r11,ip,lr};mrs r0,cpsr;push {r0};${F}ldrb r0,[ip];cmp r0,#0;beq done;mov r0,#0;strb r0,[ip];
    mov r9,#0;movw r8,#${lo(MODEL)};movt r8,#${hi(MODEL)};mov r4,#0;ldr r0,[r8];${ram('r0', 'boxes')}ldrb r4,[r0];
    boxes:mov r5,#1;each:add r0,r8,#8;ldr r6,[r0,r5,lsl #2];${ram('r6', 'next')}${going('r6', 'next')}${end('r6', 'add r1,r5,#2;')}
    next:add r5,r5,#1;cmp r5,#6;bls each;
    sub r0,r4,#1;cmp r0,#5;bhi noted;ldr r7,[r8,#4];${ram('r7', 'noted')}${going('r7', 'noted')}${end('r7', 'mov r1,#1;')}
    noted:${diag ? `cmp r9,#9;movhi r9,#9;add r1,r9,#60;${gr3xRingNote}` : ''}
    done:pop {r0};msr cpsr_f,r0;pop {r0,r1,r2,r3,r4,r5,r6,r7,r8,r9,r10,r11,ip,lr};b #${counter};`);
  p.patch(GR3X_FORMAT_CALL, bl(GR3X_FORMAT_CALL, GR3X_FORMAT), bl(GR3X_FORMAT_CALL, formatted), 'format rewind: a done format noted');
  site.replacement = hexWord(branchWord(GR3X_ROLL_COUNTER, rewind));
  site.reason += '; format rewind: every roll rewound after a format';
  if (STORED !== MODEL + 8) fail('records');
  return { formatDone: formatted, formatRewind: rewind };
}
