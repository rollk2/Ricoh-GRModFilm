// SPDX-License-Identifier: GPL-2.0-only
/**
 * GR Mod Film 1.2, test builds (`TestOptions.holdLines`): « Hold » lines in Fn Button Setting, GR IV Monochrome 1.11 (GR IV 1.21): step 1 was
 * one line, « Hold Fn »; step 2: five lines, each key's Hold line under its own (Fn, Hold Fn, ISO, Hold ISO, Drive, Hold Drive, the fourth key's,
 * Hold, then the Macro key's Hold, which has no line of its own), the bytes in the settings record. The port of the GR III's WB Button line (gr3x/wb-button.ts), from the static reading
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
 * The bytes: padding of the settings record that the factory defaults never write (the initialiser 0x5354754C run in the emulator on its default
 * block: tools/gr4v121/holdlines_probe.py lists the unwritten bytes; none is read by a getter): record offsets 0xF9, 0xFA, 0xFB, 0xE6, 0xE7 (the live
 * record is at CURRENT() + 4 = 0x550832AC), saved, loaded and copied to U1..U3 with the record, 0 (Off) in the factory's.
 * The keys, and which line each Hold line stands for (to be confirmed on the camera): Fn, up (Macro), down (the fourth line: White Balance or Image
 * Control Button), left (ISO Button), right (Drive Button).
 */
import { FirmwareError } from '../../types';
import { assembleWords, branchWord, movWord } from './arm';
import { LANGUAGES, Patch, expectWord, widenTextRows } from './build';
import { addListRecords, hookControllerFactory, installTexts } from './datestamp-menu';

/** The record's live copy and the Hold bytes (record offsets), in the order of the filter's keys: Fn, up, down, left, right. */
const RECORD = 0x550832a8 + 4;
export const HOLD_BYTES = [0xf9, 0xfa, 0xfb, 0xe6, 0xe7].map((o) => RECORD + o);
export const HOLD_FN_BYTE = HOLD_BYTES[0];
/** The Hold lines' list controller ids (the factory is told to hand out the Fn lists' controller for them), one per key. */
export const HOLD_LIST_IDS = [0x020001e0, 0x020001e1, 0x020001e2, 0x020001e3, 0x020001e4] as const;
/** A controller id of the factory's default bucket (the Fn lists'), which the Hold ids are changed to for the factory only. */
const FN_LIST_CONTROLLER = 0x020000ec;
/** Texts (all 21 languages: English so far): Hold Fn, Hold ISO, Hold Drive, Hold Image Control (Monochrome), Hold White Balance, Hold Macro. */
export const HOLD_TEXT_ID = 1040;
const HOLD_NAMES = ['Hold Fn Button', 'Hold ISO Button', 'Hold Drive Button', 'Hold Image Control Button', 'Hold White Balance Button', 'Hold Macro Button'];
/**
 * The screen's rows in order, by genre: the official genres 0..5 (Fn, ISO, Drive, the fourth, Movie, Hold Movie), the Hold lines 6..10 (Fn,
 * ISO, Drive, the fourth, Macro). Hold line g stands for the key HOLD_KEY_OF_GENRE[g - 6]: the index in the filter's keys (0 Fn, 1 up, 2 down,
 * 3 left, 4 right).
 */
const ROW_GENRES = [0, 6, 1, 7, 2, 8, 3, 9, 10, 4, 5] as const;
const HOLD_KEY_OF_GENRE = [0, 3, 4, 2, 1] as const;
const ROWS = ROW_GENRES.length;
const RECORD_FN = 73;
const SELECT_TABLE = 0x53dceb08, SELECT_RECORD = 0x4c;

const SETUP_CALL = 0x531ea084, SETUP = 0x531e9d20, LIST_TYPES = 0x5359453c;
const GENRE_TABLE = 0x53dd4310;
/** The genre table's readers: [movw, movt, register]. */
const GENRE_SITES: readonly (readonly [number, number, number])[] = [[0x531e9b30, 0x531e9b34, 3], [0x531ea0d4, 0x531ea0d8, 3], [0x531ea284, 0x531ea288, 3], [0x531ea348, 0x531ea34c, 3], [0x531ea5fc, 0x531ea604, 7]];
const LOOP_ROWS = [0x531ea634, 0x531ea6b4] as const, LOOP_VALUE = 0x531ea684, LAST_ROW = 0x531ea444;
const TITLE_CMP = 0x531ea534, TITLE_RETURN = 0x531ea55c;
const GETTER_CMP = 0x531ea19c;
const OPEN_CMP = 0x531e9b3c, OPEN_GO = 0x531e9b68;
const DESCRIPTION_CMP = 0x531ea0e0;
const MONO = 0x5340171c;
const lo = (v: number): number => v & 0xffff, hi = (v: number): number => v >>> 16;
const cmpImm = (r: number, v: number): number => (0xe3500000 | (r << 16) | v) >>> 0;

export function installHoldLines(patch: Patch): void {
  const fail = (m: string): never => { throw new FirmwareError('unexpected-layout', `Hold lines: ${m}`); };
  // What we replace is what we expect.
  expectWord(patch, SETUP_CALL, branchWord(SETUP_CALL, SETUP, 14, true));
  expectWord(patch, GENRE_TABLE + 4, 0x00000504);
  for (const [l, h, r] of GENRE_SITES) { expectWord(patch, l, movWord(r, lo(GENRE_TABLE))); expectWord(patch, h, movWord(r, hi(GENRE_TABLE), true)); }
  for (const at of LOOP_ROWS) expectWord(patch, at, cmpImm(4, 6)); // cmp r4, #6
  expectWord(patch, LOOP_VALUE, cmpImm(6, 5)); // cmp r6, #5
  expectWord(patch, LAST_ROW, cmpImm(0, 5)); // cmp r0, #5
  expectWord(patch, TITLE_CMP, cmpImm(1, 5)); // cmp r1, #5
  expectWord(patch, GETTER_CMP, cmpImm(1, 5)); // cmp r1, #5
  expectWord(patch, OPEN_CMP, cmpImm(3, 5)); // cmp r3, #5
  expectWord(patch, DESCRIPTION_CMP, cmpImm(3, 5)); // cmp r3, #5

  // The list: the rows, all of the type 0x22.
  const setup = patch.append((at) => assembleWords(
    `push {r4, lr};sub sp, sp, #16
     mov r1, #0x22; mov r2, #0
     fill: strb r1, [sp, r2]; add r2, r2, #1; cmp r2, #${ROWS}; blo fill
     ldr r0, [r0, #0x170]; mov r1, sp; mov r2, #${ROWS}; mov r3, #0x3a
     bl #${LIST_TYPES}
     add sp, sp, #16; pop {r4, pc}`, at), 4);
  patch.setWord(SETUP_CALL, branchWord(SETUP_CALL, setup, 14, true), `hold lines: the screen has ${ROWS} rows`);
  // The genre table: one genre per row (the rows' order), read by five functions.
  const table = patch.append(Uint8Array.from(ROW_GENRES), 4);
  for (const [l, h, r] of GENRE_SITES) {
    patch.setWord(l, movWord(r, lo(table)), 'hold lines: the rows\' genres, low half');
    patch.setWord(h, movWord(r, hi(table), true), 'hold lines: the rows\' genres, high half');
  }
  for (const at of LOOP_ROWS) patch.setWord(at, cmpImm(4, ROWS), `hold lines: the rows loop takes ${ROWS} rows`);
  patch.setWord(LOOP_VALUE, cmpImm(6, 10), 'hold lines: genres up to 10 draw a value');
  patch.setWord(LAST_ROW, cmpImm(0, ROWS - 1), `hold lines: the last row is row ${ROWS - 1}`);

  // Title (genre -> text), as the others: the function's own epilogue; the fourth key's line by the model, as the official one.
  const title = patch.append((at) => assembleWords(
    `cmp r1, #6; blo other
     cmp r1, #10; bhi other
     cmp r1, #9; beq fourth
     sub r0, r1, #6
     cmp r1, #10; moveq r0, #5
     add r0, r0, #${HOLD_TEXT_ID}; b #${TITLE_RETURN}
     fourth: bl #${MONO}; cmp r0, #0; movwne r0, #${HOLD_TEXT_ID + 3}; movweq r0, #${HOLD_TEXT_ID + 4}; b #${TITLE_RETURN}
     other: cmp r1, #5; b #${TITLE_CMP + 4}`, at), 4);
  patch.setWord(TITLE_CMP, branchWord(TITLE_CMP, title), 'hold lines: the titles of the Hold rows');
  // The current function (genre -> value): the Hold byte (0 .. 45, else Off), through the title function's epilogue (same frame).
  const getter = patch.append((at) => assembleWords(
    `cmp r1, #6; blo other
     cmp r1, #10; bhi other
     sub r1, r1, #6
     ${HOLD_KEY_OF_GENRE.map((k, i) => `cmp r1, #${i}; movweq r0, #${lo(HOLD_BYTES[k])}; movteq r0, #${hi(HOLD_BYTES[k])}`).join('\n')}
     ldrb r0, [r0]; cmp r0, #45; movhi r0, #0
     b #${TITLE_RETURN}
     other: cmp r1, #5; b #${GETTER_CMP + 4}`, at), 4);
  patch.setWord(GETTER_CMP, branchWord(GETTER_CMP, getter), 'hold lines: the values of the Hold rows');
  // Opening: the list's controller id; the common tail of the official cases sets the base and goes on.
  const open = patch.append((at) => assembleWords(
    `cmp r3, #6; blo other
     cmp r3, #10; bhi other
     sub r3, r3, #6
     ${HOLD_LIST_IDS.map((id, i) => `cmp r3, #${i}; movweq r1, #${lo(id)}; movteq r1, #${hi(id)}`).join('\n')}
     b #${OPEN_GO}
     other: cmp r3, #5; b #${OPEN_CMP + 4}`, at), 4);
  patch.setWord(OPEN_CMP, branchWord(OPEN_CMP, open), 'hold lines: the Hold rows open their lists');
  // The description under the list: the Hold rows read as genre 0.
  const description = patch.append((at) => assembleWords(
    `cmp r3, #6; movhs r3, #0
     cmp r3, #5; b #${DESCRIPTION_CMP + 4}`, at), 4);
  patch.setWord(DESCRIPTION_CMP, branchWord(DESCRIPTION_CMP, description), 'hold lines: the description of the Hold rows');

  // The texts, then the lists' records: Fn Button's with our set and is current.
  widenTextRows(patch, HOLD_TEXT_ID + HOLD_NAMES.length - 1);
  installTexts(patch, HOLD_NAMES.map((n, i) => ({ id: HOLD_TEXT_ID + i, names: Array(LANGUAGES).fill(n) as string[] })));
  const fn = patch.read(SELECT_TABLE + RECORD_FN * SELECT_RECORD, SELECT_RECORD);
  const fv = new DataView(fn.buffer);
  if (fv.getUint32(0, true) !== 0x10000 || fv.getUint16(4, true) !== 0x1f9 || fv.getUint32(0x0c, true) !== 0x531d11e8 || fv.getUint32(0x14, true) !== 0x531d3688 ||
      fv.getUint32(0x24, true) !== 0x531d5620 || fv.getUint32(0x2c, true) !== 0x531d7020) fail('Fn Button\'s list record is not as expected');
  const entries = HOLD_LIST_IDS.map((id, i) => {
    const byte = HOLD_BYTES[HOLD_KEY_OF_GENRE[i]];
    const g = 6 + i; // the genre of this key's Hold line
    // (this = r0, the row's index in the function vector = r1)
    const set = patch.append((at) => assembleWords(
      `ldr r3, [r0, #0x1b4]; ldrb r1, [r3, r1]
       movw r2, #${lo(byte)}; movt r2, #${hi(byte)}; strb r1, [r2]; bx lr`, at), 4);
    const current = patch.append((at) => assembleWords(
      `ldr r3, [r0, #0x1b4]; ldrb r3, [r3, r1]
       movw r2, #${lo(byte)}; movt r2, #${hi(byte)}; ldrb r2, [r2]
       cmp r3, r2; moveq r0, #1; movne r0, #0; bx lr`, at), 4);
    const record = fn.slice();
    const rv = new DataView(record.buffer);
    rv.setUint16(4, g === 9 ? HOLD_TEXT_ID + 3 : g === 10 ? HOLD_TEXT_ID + 5 : HOLD_TEXT_ID + (g - 6), true);
    rv.setUint32(0x24, set, true);
    rv.setUint32(0x2c, current, true);
    return { id, record };
  });
  addListRecords(patch, entries, 'hold lines');
  // The factory hands out the Fn lists' controller (a cached object) for the Hold ids.
  hookControllerFactory(patch, `${HOLD_LIST_IDS.map((id) => `movw ip, #${lo(id)}; movt ip, #${hi(id)}; cmp r1, ip; beq list`).join('\n')}
     b prior
     list: movw r1, #${lo(FN_LIST_CONTROLLER)}; movt r1, #${hi(FN_LIST_CONTROLLER)}`, 'hold lines: the Hold lists\' controller');
}
