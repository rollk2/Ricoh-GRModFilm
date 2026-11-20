// SPDX-License-Identifier: GPL-2.0-only
/**
 * GR Mod Film 1.2, test builds (`TestOptions.adjRedFilter`): Red Filter on the ADJ lever, GR IV Monochrome 1.11 (GR IV 1.21).
 *
 * The camera's ADJ lever functions are 0..0x14 (the table of 21 records of 0x5C at 0x53DCB494). ADJ Mode Setting offers 19 of them
 * (list 0x53DE6790: 10, Flash Exposure Comp., and 18, Framerate, are not in it). As GR III's soft focus (gr3x/adj-softfocus.ts) takes
 * a function that is not offered, this one takes function 18: the table keeps its 21 records (GR IV's table once grew and froze the
 * camera when ADJ was pressed, see exposure.ts), record 18 becomes Crop's with four handlers of its own, the name and icon lookups get
 * a case for 18, and 18 is added at the end of the list ADJ Mode Setting offers, for the Monochrome only (a model check where the
 * list's length is set: 0x531DCE68).
 *
 * Red Filter is the still setting at byte 0x9B4 of the settings object (getter 0x532A0EEC; the camera's own list of the still menu's
 * Red Filter line, controller 0x02000135, has the handlers): values 0 and 1 from the byte table 0x53DE6EB8; "is current" 0x531D7A28 and
 * "set" 0x531D5F80 (both take the value's index in r1) are the list's own and are used as they are. The value texts are the list's
 * (0x533907E0(resources + 4, value)); the function's name is the text 155 (Red Filter, as the Fn lists show it); the icon is drawn
 * here (a ring with a half-filled disc on the ADJ tile).
 */
import { FirmwareError } from '../../types';
import { assembleWords, branchWord, movImmediate, movWord } from './arm';
import { ICON_CATALOG, LOOKUP_BOUNDS, Patch, concat, expectWord, u16le, u32le } from './build';
import { paint, tile } from './exposure';

const ADJ_TABLE = 0x53dcb494, ADJ_RECORD = 0x5c, CROP = 0x13, RED_FILTER = 18;
const H_DRAW = 0x18, H_IS_CURRENT = 0x20, H_SET = 0x28, H_COUNT = 0x30;
export const RED_FILTER_ICON_ID = 738;
const RED_FILTER_NAME_TEXT = 155;
const VALUES_TABLE = 0x53de6eb8;
const IS_CURRENT = 0x531d7a28, SET = 0x531d5f80;
const APP = 0x53240cac, RESOURCES = 0x532415a0, VALUE_TEXT = 0x533907e0;
const LIST_ITEM = 0x5359468c, ITEM_SET_TEXT = 0x535a1a60;
const NAME_OF = 0x5338fd34, ICON_OF = 0x533916f0;
const SPEC_MODEL = 0x53242154, MODEL_NUMBER = 0x533f26e4;
const FUNCTION_LIST_LOW = 0x531dce3c, FUNCTION_LIST_HIGH = 0x531dce4c, FUNCTION_LIST_LENGTH = 0x531dce68;
const lo = (v: number): number => v & 0xffff, hi = (v: number): number => v >>> 16;

/** A ring with a half-filled disc, on the ADJ tile. */
export function drawRedFilterIcon(): Uint8Array {
  const px = new Uint8Array(40 * 40 * 4);
  tile(px);
  const cx = 20, cy = 20;
  paint(px, (x, y) => { const r = Math.hypot(x - cx, y - cy); return r <= 13 && r >= 11 ? 1 : 0; });
  paint(px, (x, y) => (Math.hypot(x - cx, y - cy) <= 8 && x >= cx ? 1 : 0));
  return px;
}

/** Appends a 40 x 40 icon of the given number (not yet given out) to ICONBIN; returns the new ICONBIN. */
export function appendIcon(patch: Patch, iconbin: Uint8Array, id: number, px: Uint8Array, width = 40, height = 40): Uint8Array {
  if (patch.word(ICON_CATALOG + id * 4) !== 0) throw new FirmwareError('unexpected-layout', 'icon number already in use');
  const pad = (4 - (iconbin.length % 4)) % 4;
  const offset = iconbin.length + pad;
  const descriptor = patch.append(concat([u16le([1, width, height, 0]), u32le([offset / 4])]), 16);
  patch.write(ICON_CATALOG + id * 4, u32le([descriptor]));
  for (const [site, register] of LOOKUP_BOUNDS) {
    if ((patch.word(site) & 0xfff0f000) >>> 0 !== (0xe3000000 | (register << 12)) >>> 0) throw new FirmwareError('unexpected-layout', 'icon bound is not a MOVW');
    patch.setWord(site, movWord(register, Math.max(id, movImmediate(patch.word(site)))), 'icon upper bound');
  }
  return concat([iconbin, new Uint8Array(pad), px]);
}

/** The icon (call with the other icons, before the menus). Returns ICONBIN with it appended. */
export function installAdjRedFilterIcon(patch: Patch, iconbin: Uint8Array): Uint8Array {
  return appendIcon(patch, iconbin, RED_FILTER_ICON_ID, drawRedFilterIcon());
}

/** After the icon; before anything that copies the ADJ table (adjslots, exposure preview). */
/**
 * `table`: where the ADJ function table is now (the official one, or the copy that exposure preview made). Run after the other
 * additions to the ADJ lever (soft focus, exposure preview): the name, icon and list hooks chain to what is already there.
 */
export function installAdjRedFilter(patch: Patch, table = ADJ_TABLE): void {
  const fail = (m: string): never => { throw new FirmwareError('unexpected-layout', `ADJ Red Filter: ${m}`); };
  const rec = new DataView(patch.read(table + RED_FILTER * ADJ_RECORD, ADJ_RECORD).buffer.slice(0));
  if (rec.getUint32(0x10, true) !== 0x531bc0f0 || rec.getUint32(H_DRAW, true) !== 0x531bfd5c || rec.getUint32(H_COUNT, true) !== 0x531bbcfc) fail('record 18 is not Framerate\'s');
  const crop = patch.read(table + CROP * ADJ_RECORD, ADJ_RECORD);
  const cv = new DataView(crop.buffer);
  if (cv.getUint32(0x10, true) !== 0x531bbc60 || cv.getUint32(0x3c, true) !== 0x531be524) fail('Crop\'s record is not as expected');
  expectWord(patch, IS_CURRENT, 0xe1a0c00d); // mov ip, sp
  expectWord(patch, SET, 0xe1a0c00d);
  // The name and icon functions: the official ones, or already hooked by another addition (then ours chains to its hook).
  const tail = (site: number): string => {
    const w = patch.word(site);
    if (w === 0xe3510000) return `cmp r1, #0; b #${site + 4}`;
    if ((w >>> 24) === 0xea) { const off = (w & 0xffffff) << 8 >> 8; return `b #${site + 8 + off * 4}`; }
    return fail('the name / icon function is neither official nor hooked');
  };
  const nameTail = tail(NAME_OF), iconTail = tail(ICON_OF);
  const lengthWord = patch.word(FUNCTION_LIST_LENGTH);
  if ((lengthWord & 0xffffff00) >>> 0 !== 0xe2846000) fail('the list length is not as expected');

  // Handlers (this = r0, value index = r1): the strip's text for value i, the count.
  const draw = patch.append((at) => assembleWords(
    `push {r4, r5, r6, lr}
     mov r5, r0; mov r4, r1; mov r6, #0
     cmp r4, #1; bhi item
     bl #${APP}; bl #${RESOURCES}
     movw r3, #${lo(VALUES_TABLE)}; movt r3, #${hi(VALUES_TABLE)}
     ldrb r1, [r3, r4]; add r0, r0, #4; bl #${VALUE_TEXT}
     mov r6, r0
     item: ldr r0, [r5, #0x1f8]; uxtb r1, r4; bl #${LIST_ITEM}
     mov r1, r6; pop {r4, r5, r6, lr}; b #${ITEM_SET_TEXT}`, at), 16);
  const count = patch.append((at) => assembleWords('mov r0, #2; bx lr', at), 16);
  const record = crop.slice();
  const rv = new DataView(record.buffer);
  rv.setUint32(H_DRAW, draw, true);
  rv.setUint32(H_IS_CURRENT, IS_CURRENT, true);
  rv.setUint32(H_SET, SET, true);
  rv.setUint32(H_COUNT, count, true);
  rv.setUint32(0x3c, 0, true);
  for (let off = 0; off < ADJ_RECORD; off += 4) {
    const word = rv.getUint32(off, true), at = table + RED_FILTER * ADJ_RECORD + off;
    if (word !== patch.word(at)) patch.setWord(at, word, 'ADJ Red Filter: record 18 (Crop\'s, with handlers of its own)');
  }

  // Name and icon.
  const name = patch.append((at) => assembleWords(
    `cmp r1, #${RED_FILTER}; movweq r0, #${RED_FILTER_NAME_TEXT}; bxeq lr
     ${nameTail}`, at), 16);
  patch.setWord(NAME_OF, branchWord(NAME_OF, name), 'ADJ Red Filter: the function\'s name');
  const icon = patch.append((at) => assembleWords(
    `cmp r1, #${RED_FILTER}; bne other
     cmp r2, #0; movne r0, #0; movweq r0, #${RED_FILTER_ICON_ID}; bx lr
     other: ${iconTail}`, at), 16);
  patch.setWord(ICON_OF, branchWord(ICON_OF, icon), 'ADJ Red Filter: the function\'s icon');

  // ADJ Mode Setting's list: 18 added at the end, offered on the Monochrome only (its length is set here).
  const listAt = (movImmediate(patch.word(FUNCTION_LIST_LOW)) | (movImmediate(patch.word(FUNCTION_LIST_HIGH)) << 16)) >>> 0;
  const old = [...patch.read(listAt, lengthWord & 0xff)];
  if (old.includes(RED_FILTER) || old.some((f) => f > 0x15)) fail('the function list is not as expected');
  const newList = patch.append(Uint8Array.from([...old, RED_FILTER]), 16);
  patch.setWord(FUNCTION_LIST_LOW, movWord(4, lo(newList)), 'ADJ Red Filter: the function list, low half');
  patch.setWord(FUNCTION_LIST_HIGH, movWord(4, hi(newList), true), 'ADJ Red Filter: the function list, high half');
  const length = patch.append((at) => assembleWords(
    `push {r0, r1, r2, r3, ip, lr}
     bl #${APP}; bl #${SPEC_MODEL}; bl #${MODEL_NUMBER}
     cmp r0, #2
     pop {r0, r1, r2, r3, ip, lr}
     add r6, r4, #${old.length}
     addeq r6, r6, #1
     b #${FUNCTION_LIST_LENGTH + 4}`, at), 16);
  patch.setWord(FUNCTION_LIST_LENGTH, branchWord(FUNCTION_LIST_LENGTH, length), 'ADJ Red Filter: the list is one longer on the Monochrome');
}
