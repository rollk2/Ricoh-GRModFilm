// SPDX-License-Identifier: GPL-2.0-only
/**
 * GR Mod Film 1.2, test builds (`TestOptions.holdLines`): « Hold » lines in Fn Button Setting, GR IV Monochrome 1.11 (GR IV 1.21), step 1:
 * one line, « Hold Fn », under the screen's last line. The port of the GR III's WB Button line (gr3x/wb-button.ts), from the static reading
 * recorded in docs/film-mode-notes.md (« Lignes Hold dans Fn Button Setting »).
 *
 * The screen (FnButtonCustomController, constructor 0x531EA034) is a list of 6 rows of the type 0x22 (set up by 0x531E9D20), row k being of
 * « genre » GENRES[k] (the bytes at 0x53DD4310: 0..5; the Monochrome's fourth is Image Control Button), and each genre is dealt with by
 * functions with a switch of six cases:
 *   - the title text: 0x531EA524 (genre -> text: 0x1F9 Fn Button, 0x1FF ISO, 0x201 Drive, 0x203 / 0x205 WB or Image Control, 0x207 Movie, 0x209 Hold Movie);
 *   - the current function: 0x531EA18C (genre -> the setting's getter), used for the value's icon and text (0x531EA2D8) and the help (0x531EA330);
 *   - the opening: 0x531E9B14 (genre -> the list's controller id 0x020000E5 .. 0xEB, a base 0x020000E4);
 *   - the description under the list: 0x531EA0B8;
 *   - the row building loop 0x531EA5E8 (6 rows, genres <= 5 draw a value), the key down's last row 0x531EA414 (`cmp r0,#5`).
 * Everything above a genre 5 is, in the official code, an assertion; the new genre 6 is given its cases here, the list of rows 7 long.
 * Its list: the controller id 0x020000EC falls in the factory's default (0x53187DF8), which hands out the cached FnListController (0x1E4 bytes,
 * the three function vectors); SetCurrentMenu maps the id to a list record, a copy of Fn Button's (record 73: count 0x531D11E8 and draw
 * 0x531D3688 read the vector A at + 0x1B4) with our « set » and « is current » for the Hold byte.
 * The byte: this first step keeps it in RAM (HOLD_FN_BYTE, not saved: Off at every start); the settings bytes come next.
 */
import { FirmwareError } from '../../types';
import { assembleWords, branchWord, movWord } from './arm';
import { LANGUAGES, Patch, expectWord, widenTextRows } from './build';
import { addListRecords, installTexts, listTemplate } from './datestamp-menu';

export const HOLD_FN_BYTE = 0x55839032;
export const HOLD_FN_LIST_ID = 0x020000ec;
export const HOLD_TEXT_ID = 1040;
const NEW_GENRE = 6;
const RECORD_FN = 73;
const SELECT_TABLE = 0x53dceb08, SELECT_RECORD = 0x4c;

const SETUP_CALL = 0x531ea084, SETUP = 0x531e9d20, LIST_TYPES = 0x5359453c;
const GENRE_WORD = 0x53dd4314;
const LOOP_ROWS = [0x531ea634, 0x531ea6b4] as const, LOOP_VALUE = 0x531ea684, LAST_ROW = 0x531ea444;
const TITLE_CMP = 0x531ea534, TITLE_RETURN = 0x531ea55c;
const GETTER_CMP = 0x531ea19c;
const OPEN_CMP = 0x531e9b3c, OPEN_GO = 0x531e9b68;
const DESCRIPTION_CMP = 0x531ea0e0;
const lo = (v: number): number => v & 0xffff, hi = (v: number): number => v >>> 16;

export function installHoldLines(patch: Patch): void {
  const fail = (m: string): never => { throw new FirmwareError('unexpected-layout', `Hold lines: ${m}`); };
  // What we replace is what we expect.
  expectWord(patch, SETUP_CALL, branchWord(SETUP_CALL, SETUP, 14, true));
  expectWord(patch, GENRE_WORD, 0x00000504);
  for (const at of LOOP_ROWS) expectWord(patch, at, 0xe3540006); // cmp r4, #6
  expectWord(patch, LOOP_VALUE, 0xe3560005); // cmp r6, #5
  expectWord(patch, LAST_ROW, 0xe3500005); // cmp r0, #5
  expectWord(patch, TITLE_CMP, 0xe3510005); // cmp r1, #5
  expectWord(patch, GETTER_CMP, 0xe3510005); // cmp r1, #5
  expectWord(patch, OPEN_CMP, 0xe3530005); // cmp r3, #5
  expectWord(patch, DESCRIPTION_CMP, 0xe3530005); // cmp r3, #5

  // The list: 7 rows (all of the type 0x22).
  const setup = patch.append((at) => assembleWords(
    `push {r4, lr};sub sp, sp, #16
     mov r1, #0x22; mov r2, #0
     fill: strb r1, [sp, r2]; add r2, r2, #1; cmp r2, #7; blo fill
     ldr r0, [r0, #0x170]; mov r1, sp; mov r2, #7; mov r3, #0x3a
     bl #${LIST_TYPES}
     add sp, sp, #16; pop {r4, pc}`, at), 4);
  patch.setWord(SETUP_CALL, branchWord(SETUP_CALL, setup, 14, true), 'hold lines: the screen has 7 rows');
  // Row 6 is of genre 6 (the byte after the official five: padding of the table).
  patch.setWord(GENRE_WORD, 0x00060504, 'hold lines: row 6 is of genre 6');
  for (const at of LOOP_ROWS) patch.setWord(at, 0xe3540007, 'hold lines: the rows loop takes 7 rows');
  patch.setWord(LOOP_VALUE, 0xe3560006, 'hold lines: genre 6 draws a value');
  patch.setWord(LAST_ROW, 0xe3500006, 'hold lines: the last row is row 6');

  // Title (genre -> text), as the others: the function's own epilogue.
  const title = patch.append((at) => assembleWords(
    `cmp r1, #${NEW_GENRE}; bne other
     movw r0, #${HOLD_TEXT_ID}; b #${TITLE_RETURN}
     other: cmp r1, #5; b #${TITLE_CMP + 4}`, at), 4);
  patch.setWord(TITLE_CMP, branchWord(TITLE_CMP, title), 'hold lines: the title of row 6');
  // The current function (genre -> value): the Hold byte, returned through the title function's epilogue (the same frame: push {fp, ip, lr, pc}; sub sp, sp, #8).
  const getter = patch.append((at) => assembleWords(
    `cmp r1, #${NEW_GENRE}; bne other
     movw r0, #${lo(HOLD_FN_BYTE)}; movt r0, #${hi(HOLD_FN_BYTE)}; ldrb r0, [r0]
     b #${TITLE_RETURN}
     other: cmp r1, #5; b #${GETTER_CMP + 4}`, at), 4);
  patch.setWord(GETTER_CMP, branchWord(GETTER_CMP, getter), 'hold lines: the value of row 6');
  // Opening: the list's controller id; the common tail of the official cases sets the base and goes on.
  const open = patch.append((at) => assembleWords(
    `cmp r3, #${NEW_GENRE}; bne other
     movw r1, #${lo(HOLD_FN_LIST_ID)}; movt r1, #${hi(HOLD_FN_LIST_ID)}; b #${OPEN_GO}
     other: cmp r3, #5; b #${OPEN_CMP + 4}`, at), 4);
  patch.setWord(OPEN_CMP, branchWord(OPEN_CMP, open), 'hold lines: row 6 opens its list');
  // The description under the list: genre 6 reads as genre 0.
  const description = patch.append((at) => assembleWords(
    `cmp r3, #${NEW_GENRE}; moveq r3, #0
     cmp r3, #5; b #${DESCRIPTION_CMP + 4}`, at), 4);
  patch.setWord(DESCRIPTION_CMP, branchWord(DESCRIPTION_CMP, description), 'hold lines: the description of row 6');

  // The text, then the list's record: Fn Button's with our set and is current.
  widenTextRows(patch, HOLD_TEXT_ID);
  installTexts(patch, [{ id: HOLD_TEXT_ID, names: Array(LANGUAGES).fill('Hold Fn Button') as string[] }]);
  const fn = patch.read(SELECT_TABLE + RECORD_FN * SELECT_RECORD, SELECT_RECORD);
  const fv = new DataView(fn.buffer);
  if (fv.getUint32(0, true) !== 0x10000 || fv.getUint16(4, true) !== 0x1f9 || fv.getUint32(0x0c, true) !== 0x531d11e8 || fv.getUint32(0x14, true) !== 0x531d3688 ||
      fv.getUint32(0x24, true) !== 0x531d5620 || fv.getUint32(0x2c, true) !== 0x531d7020) fail('Fn Button\'s list record is not as expected');
  // (this = r0, the row's index in the function vector = r1)
  const set = patch.append((at) => assembleWords(
    `ldr r3, [r0, #0x1b4]; ldrb r1, [r3, r1]
     movw r2, #${lo(HOLD_FN_BYTE)}; movt r2, #${hi(HOLD_FN_BYTE)}; strb r1, [r2]; bx lr`, at), 4);
  const current = patch.append((at) => assembleWords(
    `ldr r3, [r0, #0x1b4]; ldrb r3, [r3, r1]
     movw r2, #${lo(HOLD_FN_BYTE)}; movt r2, #${hi(HOLD_FN_BYTE)}; ldrb r2, [r2]
     cmp r3, r2; moveq r0, #1; movne r0, #0; bx lr`, at), 4);
  const record = fn.slice();
  const rv = new DataView(record.buffer);
  rv.setUint16(4, HOLD_TEXT_ID, true);
  rv.setUint32(0x24, set, true);
  rv.setUint32(0x2c, current, true);
  void listTemplate; void movWord;
  addListRecords(patch, [{ id: HOLD_FN_LIST_ID, record }], 'hold lines');
}
