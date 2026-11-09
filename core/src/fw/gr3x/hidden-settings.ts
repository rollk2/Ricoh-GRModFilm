// SPDX-License-Identifier: GPL-2.0-only
/**
 * GR III 2.10 / IIIx 1.60, `hiddenSettings` (T-HIDE1): camera settings taken out of the camera, each
 * held at the value chosen in the program.
 *
 *  - Their Still Image Settings line is hidden (as the movie's, film-roll.ts `installGr3xHideLines`).
 *  - Their button functions leave the buttons' lists (the lists' filter 0x531b9410, which the main,
 *    Wireless and Hold Wireless builders ask) and a button still holding one runs Off (film-roll.ts,
 *    GetEventCustomize / GetEventSwitchWlan).
 *  - Their ADJ lever functions leave the five lists of ADJ Mode Setting (records 65..69: the lists
 *    GR3X_ADJ_LISTS, 19 functions each, counted by `mov r0,#0x13` at 0x531b3bac + 8 i) and a slot
 *    still holding one reads Off (the slot getters' wrapper, film-roll.ts).
 *  - At each settings load (round 10's scaffold), the value is written in the record in use and the
 *    eight stored records (U1..U3 and the others), so the camera starts with it and a recalled BOX
 *    brings it.
 * Settings (list records of 0x53b3c6c0: the set handler maps the menu's item to the stored value):
 */
import { FirmwareError } from '../types';
import type { Gr3xSite } from './round10';
import { gr3xSettingsHook, gr3xSettingsPrior } from './round10';

const lo = (v: number) => v & 0xffff, hi = (v: number) => v >>> 16;
const fail = (what: string): never => { throw new FirmwareError('unexpected-layout', `IIIx hidden settings: ${what}`); };

export interface Gr3xHideable {
  /** The Still Image Settings line. */ line: number;
  /** The settings record's byte. */ byte: number;
  /** The values in the menu's order (the program's choices), as stored. */ values: readonly number[];
  /** Button functions (0x53292ed0's numbers) and ADJ lever functions (0x53292810's). */ fn: readonly number[]; adj: readonly number[];
}
export const GR3X_HIDEABLE = {
  /** Off, Face Detection, Eye Detection (3 values; writer 0x53273064). */
  faceEye: { line: 0x0200005e, byte: 0x12c, values: [0, 1, 2], fn: [8], adj: [] },
  /** On, Off (writer 0x5324bbb4). */
  afAssist: { line: 0x0200005f, byte: 0x12e, values: [1, 0], fn: [], adj: [] },
  /** Focus-priority, FPS-priority (writer 0x5324bc68). */
  afc: { line: 0x02000063, byte: 0x13c, values: [1, 2], fn: [], adj: [] },
  /** On, Off (writer 0x532426c0). */
  mfMag: { line: 0x02000065, byte: 0x140, values: [1, 0], fn: [], adj: [] },
  /** Flash On, Flash On + Red-eye, Slow-speed Sync, Slow Sync + Red-eye (writer 0x5324beac). */
  flash: { line: 0x020000dd, byte: 0x164, values: [0, 1, 2, 3], fn: [20], adj: [8] },
  /** Off, On (writer 0x532734ec). */
  gf2: { line: 0x02000070, byte: 0xb22, values: [0, 1], fn: [41], adj: [0x13] },
} as const satisfies Record<string, Gr3xHideable>;
export type Gr3xHideableKey = keyof typeof GR3X_HIDEABLE;
export type Gr3xHiddenSettings = Partial<Record<Gr3xHideableKey, number>>;

/** Checks a choice and returns the lines, functions and ADJ functions it hides, and its bytes. */
export function gr3xHiddenPlan(hidden: Gr3xHiddenSettings) {
  const entries = Object.entries(hidden) as [string, number][];
  for (const [k, v] of entries) {
    const s = (GR3X_HIDEABLE as Record<string, Gr3xHideable>)[k];
    if (!s) fail(`unknown setting ${k}`);
    if (!s.values.includes(v)) fail(`${k}: value ${v} is not one of ${s.values.join(', ')}`);
  }
  const ss = entries.map(([k, v]) => [(GR3X_HIDEABLE as Record<string, Gr3xHideable>)[k], v] as const);
  return { lines: ss.map(([s]) => s.line), fns: ss.flatMap(([s]) => s.fn), adj: ss.flatMap(([s]) => s.adj), bytes: ss.map(([s, v]) => [s.byte, v] as const) };
}

export interface Gr3xHiddenProgram {
  code(source: string): number;
  patch(address: number, expected: number, replacement: number, reason: string): void;
  u32(address: number): number;
  sites: Gr3xSite[];
}

/** The ADJ Mode Setting lists (five slots) and their counts. */
export const GR3X_ADJ_LISTS = [0x53b4eba0, 0x53b5a430, 0x53b5a404, 0x53b58fb0, 0x53b5a4b4] as const;
export const GR3X_ADJ_LIST_COUNTS = [0x531b3bac, 0x531b3bb4, 0x531b3bbc, 0x531b3bc4, 0x531b3bcc] as const;
const ADJ_LIST_LENGTH = 19;
const RECORD_POINTER = 0x55063f34, STORED_RECORDS = 0x55063f38;

/** The ADJ lists without `adj` (after any other edit of their words, the round 10 soft focus's). */
export function installGr3xHiddenAdjLists(p: Gr3xHiddenProgram, adj: readonly number[]) {
  if (!adj.length) return;
  const word = (at: number) => { const s = p.sites.find(x => x.address === at); return s ? wordOf(s.replacement) : p.u32(at) >>> 0; };
  GR3X_ADJ_LISTS.forEach((list, i) => {
    const now = Array.from({ length: 20 }, (_, k) => (word(list + (k & ~3)) >>> (8 * (k & 3))) & 255);
    const kept = now.slice(0, ADJ_LIST_LENGTH).filter(f => !adj.includes(f));
    const next = [...kept, ...Array(ADJ_LIST_LENGTH - kept.length).fill(0), now[19]];
    for (let w = 0; w < 5; w++) {
      const old = word(list + 4 * w), nw = (next[4 * w] | next[4 * w + 1] << 8 | next[4 * w + 2] << 16 | next[4 * w + 3] << 24) >>> 0;
      if (old === nw) continue;
      const site = p.sites.find(x => x.address === list + 4 * w);
      if (site) { site.replacement = hexWord(nw); site.reason += '; hidden settings: out of the ADJ list'; }
      else p.patch(list + 4 * w, old, nw, 'hidden settings: out of the ADJ list');
    }
    const count = GR3X_ADJ_LIST_COUNTS[i];
    if (p.u32(count) !== 0xe3a00013) fail('ADJ list count');
    p.patch(count, 0xe3a00013, (0xe3a00000 | kept.length) >>> 0, `hidden settings: ADJ list of ${kept.length}`);
  });
}

/** At each settings load (the scaffold's hook): the values into the record in use and the eight stored ones. */
export function installGr3xHiddenValues(p: Gr3xHiddenProgram, bytes: readonly (readonly [number, number])[]) {
  if (!bytes.length) return {};
  const prior = gr3xSettingsPrior(p, 'load');
  const ram = (r: string, label: string) => `cmp ${r},#0x40000000;blo ${label};cmp ${r},#0xc0000000;bhs ${label};tst ${r},#3;bne ${label};`;
  const put = (r: string) => bytes.map(([o, v]) => `mov r1,#${v};strb r1,[${r},#${o}];`).join('');
  const load = p.code(`push {r4,r5,r6,lr};bl #${prior};mov r5,r0;
    movw r4,#${lo(RECORD_POINTER)};movt r4,#${hi(RECORD_POINTER)};ldr r2,[r4];${ram('r2', 'stored')}${put('r2')}
    stored:mov r6,#0;each:movw r4,#${lo(STORED_RECORDS)};movt r4,#${hi(STORED_RECORDS)};ldr r2,[r4,r6,lsl #2];${ram('r2', 'next')}${put('r2')}
    next:add r6,r6,#1;cmp r6,#8;blo each;mov r0,r5;pop {r4,r5,r6,pc};`);
  gr3xSettingsHook(p, 'load', load, 'hidden settings: the settings load, then the hidden settings\' values in every record');
  return { hiddenValues: load };
}

function wordOf(hexBytes: string) { const b = hexBytes.match(/../g)!.map(x => parseInt(x, 16)); return (b[0] | b[1] << 8 | b[2] << 16 | b[3] << 24) >>> 0; }
function hexWord(w: number) { return [w & 255, w >>> 8 & 255, w >>> 16 & 255, w >>> 24 & 255].map(b => b.toString(16).padStart(2, '0')).join(''); }
