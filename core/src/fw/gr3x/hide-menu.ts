// SPDX-License-Identifier: GPL-2.0-only
/**
 * GR III 2.10 / IIIx 1.60, `hideMenu` (T-HSET1): a « Hide Settings » line in Setup, after Firmware
 * Info/Options, opening a list of boxes, one per setting the film mode can take out of the camera
 * (hidden-settings.ts). T-HSET1: the line, the screen and the boxes' state only; nothing is hidden yet.
 *
 *  - The screen is Mode Memory's (ModeMemoryController), built once by the controllers' factory
 *    (0x5316f3b8, case 0x0200009b: kept at + 0x184 of the factory). Our line asks the factory for that
 *    same screen: at the factory's entry, for our id or Mode Memory's, the factory is asked for Mode
 *    Memory's, then the screen's list (vector + 0x168 / + 0x16c / + 0x170 of 0x28-byte items) is set
 *    to the list wanted when it holds the other one (our items are numbered from 32), the rows set up
 *    again (film-roll.ts memoryListSetup) and the title set (0x533a2ba0(+ 0x15c, text): ours, or
 *    Mode Memory's 0x208). No RAM of our own: the list itself tells which one is up.
 *  - Our boxes: each item's draw, toggle and write (member functions, this = the screen) keep their
 *    state in the screen's state bytes (+ 0x174 + k; Mode Memory reads its own again at each start).
 *    The state is bit k + 1 of byte 0x905 of the records (bit 0: Mode Memory's AF Point box, which then
 *    keeps to it): read at the screen's start (film-roll.ts afPointRead), written by each box into the
 *    record in use and the seven stored ones, the other bits kept.
 *  - The keys: the menu's key map (datestamp.ts) reads our id as Mode Memory's.
 * Names: the camera's own texts of the settings; the line's name in 21 languages, every character
 * one the camera's texts of that language already show.
 */
import { FirmwareError } from '../types';
import { GR3X_AF_POINT_SETTING } from './film-roll';

const lo = (v: number) => v & 0xffff, hi = (v: number) => v >>> 16;
const fail = (what: string): never => { throw new FirmwareError('unexpected-layout', `IIIx Hide Settings: ${what}`); };

/** The line's id (unused: GR III's end at 0x02000140) and the line it follows (Firmware Info/Options). */
export const GR3X_HSET_ID = 0x020001d0, GR3X_HSET_AFTER = 0x0200011a, GR3X_MEMORY_ID = 0x0200009b;
/** « Hide Settings » in `LANGS` order (cs da en fi fr de el hu it ja ko nl pl pt ru zh-CN es sv th zh-TW tr). */
export const GR3X_HSET_NAMES: readonly string[] = [
  'Skrýt nastavení', 'Skjul indstillinger', 'Hide Settings', 'Piilota asetukset', 'Masquer réglages', 'Einst. ausblenden',
  'Απόκρυψη ρυθμίσεων', 'Beállítások elrejtése', 'Nascondi impostaz.', '設定を表示しない', '설정 표시 안 함', 'Instell. verbergen',
  'Ukryj ustawienia', 'Ocultar definições', 'Скрыть настройки', '设置不显示', 'Ocultar ajustes', 'Dölj inställningar',
  'ซ่อนการตั้งค่า', '設定不顯示', 'Ayarları gizle',
];
/** The boxes: the setting (hidden-settings.ts GR3X_HIDEABLE) and the camera's text of its name. Box k: bit k + 1 of 0x905. */
export const GR3X_HSET_ITEMS = [
  { key: 'faceEye', text: 0x37 }, { key: 'afAssist', text: 0x3a }, { key: 'afc', text: 0x51 }, { key: 'mfMag', text: 0x5b },
  { key: 'flash', text: 0x79 }, { key: 'gf2', text: 0x49 }, { key: 'flashComp', text: 0x7f },
] as const;
export const GR3X_HSET_SETTING = GR3X_AF_POINT_SETTING;
const ITEM_BASE = 32, STATE = 0x174;
const FACTORY = 0x5316f3b8, MEMORY_COPY = 0x53207348, VECTOR_GROW = 0x532071fc, SET_TEXT = 0x533a2ba0, MEMORY_TITLE = 0x208;
const LIST_ROW = 0x53394758, ROW_ICON = 0x533a8990, TICK_ON = 0x10f, TICK_OFF = 0x10e;
const POINTER = 0x55063f34, STORED = 0x55063f38;
const ram = (r: string, label: string) => `cmp ${r},#0x40000000;blo ${label};cmp ${r},#0xc0000000;bhs ${label};tst ${r},#3;bne ${label};`;

export interface Gr3xHideMenuProgram {
  code(source: string): number;
  append(bytes: Uint8Array): number;
  u32(address: number): number;
}

/** At Mode Memory's screen start (film-roll.ts afPointRead; r0 the screen, r3 the record in use, r0 kept):
 * with our list up, each box from its bit. */
export function gr3xHideMenuRead(): string {
  return `ldr r1,[r0,#0x168];ldr r2,[r0,#0x16c];cmp r1,r2;beq hsno;ldrb r1,[r1];cmp r1,#${ITEM_BASE};blo hsno;
    mov r2,#0;${ram('r3', 'hsbits')}ldrb r2,[r3,#${GR3X_HSET_SETTING}];hsbits:` +
    GR3X_HSET_ITEMS.map((_, k) => `mov r1,r2,lsr #${k + 1};and r1,r1,#1;strb r1,[r0,#${STATE + k}];`).join('') + 'hsno:';
}

/** `title`: the line's text id; `listSetup`: film-roll.ts memoryListSetup (the rows' view types for the list as it is). */
export function installGr3xHideMenu(p: Gr3xHideMenuProgram, title: number, listSetup: number) {
  if (p.u32(FACTORY + 4) !== 0xe1a0c00d) fail('the factory');
  if (p.u32(MEMORY_COPY) !== 0xe1a0c00d || p.u32(VECTOR_GROW) !== 0xe1a0c00d) fail('Mode Memory\'s list');
  const entries: Record<string, number> = {};
  const tick = (r: string) => `cmp ${r},#0;movwne r1,#${TICK_ON};movweq r1,#${TICK_OFF};`;
  const items = new Uint8Array(GR3X_HSET_ITEMS.length * 0x28), iv = new DataView(items.buffer);
  GR3X_HSET_ITEMS.forEach(({ text }, k) => {
    const off = STATE + k, bit = 1 << (k + 1), n = ITEM_BASE + k;
    const draw = p.code(`ldrb ip,[r0,#${off}];mov r0,r1;${tick('ip')}b #${ROW_ICON};`);
    const toggle = p.code(`push {r4,lr};mov r4,r0;ldrb r3,[r4,#${off}];eor r3,r3,#1;strb r3,[r4,#${off}];
      ldr r2,[r4,#0x168];ldr ip,[r4,#0x16c];mov r1,#0;
      find:cmp r2,ip;bhs none;ldrb r3,[r2];cmp r3,#${n};beq found;add r2,r2,#0x28;add r1,r1,#1;b find;
      none:mov r1,#0;
      found:ldr r0,[r4,#0x164];bl #${LIST_ROW};ldrb ip,[r4,#${off}];${tick('ip')}pop {r4,lr};b #${ROW_ICON};`);
    // The bit into the record in use and the seven stored copies (0..6), the other bits kept.
    const put = `ldrb ip,[r3,#${GR3X_HSET_SETTING}];bic ip,ip,#${bit};orr ip,ip,r1;strb ip,[r3,#${GR3X_HSET_SETTING}];`;
    const write = p.code(`ldrb r1,[r0,#${off}];cmp r1,#0;movne r1,#${bit};
      movw r2,#${lo(POINTER)};movt r2,#${hi(POINTER)};ldr r3,[r2];${ram('r3', 'w0')}${put}w0:
      mov r0,#0;wl:movw r2,#${lo(STORED)};movt r2,#${hi(STORED)};ldr r3,[r2,r0,lsl #2];${ram('r3', 'wn')}${put}
      wn:add r0,r0,#1;cmp r0,#6;bls wl;bx lr;`);
    iv.setUint32(k * 0x28, n, true); iv.setUint32(k * 0x28 + 4, text, true);
    iv.setUint32(k * 0x28 + 8, draw, true); iv.setUint32(k * 0x28 + 0x10, toggle, true); iv.setUint32(k * 0x28 + 0x18, write, true);
    entries[`hsDraw${k}`] = draw; entries[`hsToggle${k}`] = toggle; entries[`hsWrite${k}`] = write;
  });
  const table = p.append(items), end = table + items.length;
  entries.hsItems = table;
  // The factory's own start (its first instruction, displaced by datestamp.ts's hook), then on.
  entries.hsFactoryBody = p.code(`movw r3,#0x13b;b #${FACTORY + 4};`);
  // At the factory's entry for our id or Mode Memory's (datestamp.ts): Mode Memory's screen, with the list wanted.
  entries.hsFactory = p.code(`push {r4,r5,r6,lr};mov r5,r1;movw r1,#${lo(GR3X_MEMORY_ID)};movt r1,#${hi(GR3X_MEMORY_ID)};
    bl #${entries.hsFactoryBody};mov r6,r0;${ram('r6', 'out')}
    ldr r1,[r6,#0x168];ldr r2,[r6,#0x16c];mov r3,#0;cmp r1,r2;beq cur;ldrb r3,[r1];cmp r3,#${ITEM_BASE};movlo r3,#0;movhs r3,#1;
    cur:movw ip,#${lo(GR3X_HSET_ID)};movt ip,#${hi(GR3X_HSET_ID)};cmp r5,ip;moveq r4,#1;movne r4,#0;cmp r3,r4;beq out;
    str r1,[r6,#0x16c];cmp r4,#0;beq memory;
    movw r5,#${lo(table)};movt r5,#${hi(table)};
    each:ldr ip,[r6,#0x16c];ldr r3,[r6,#0x170];cmp ip,r3;beq grow;
    mov r2,#0;copy:ldr r3,[r5,r2];str r3,[ip,r2];add r2,r2,#4;cmp r2,#0x28;blo copy;
    add ip,ip,#0x28;str ip,[r6,#0x16c];b next;
    grow:add r0,r6,#0x168;mov r1,r5;bl #${VECTOR_GROW};
    next:add r5,r5,#0x28;movw r3,#${lo(end)};movt r3,#${hi(end)};cmp r5,r3;blo each;b rows;
    memory:mov r0,r6;bl #${MEMORY_COPY};
    rows:mov r0,r6;bl #${listSetup};
    ldr r0,[r6,#0x15c];cmp r4,#0;movweq r1,#${MEMORY_TITLE};movwne r1,#${title};bl #${SET_TEXT};
    out:mov r0,r6;pop {r4,r5,r6,pc};`);
  const factory = entries.hsFactory;
  return { entries, factoryPrefix: `movw ip,#${lo(GR3X_HSET_ID)};movt ip,#${hi(GR3X_HSET_ID)};cmp r1,ip;beq #${factory};
    movw ip,#${lo(GR3X_MEMORY_ID)};movt ip,#${hi(GR3X_MEMORY_ID)};cmp r1,ip;beq #${factory};` };
}
