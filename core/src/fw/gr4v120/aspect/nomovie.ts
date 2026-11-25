// SPDX-License-Identifier: GPL-2.0-only
/**
 * GR Mod Film 1.2: no movie (GR IV / HDF / Monochrome, firmware 1.21 = GR IV Monochrome 1.11).
 *
 * The movie is taken out in two places, the two that GR Mod Film's GR III / IIIx build (film-roll.ts, T20-VID1
 * and T20-VID2) takes out and that the firmware's own structure makes the same here:
 *
 *  - The Movie Settings tab. The five menu tabs are built from five static descriptors (menuwide.ts); the
 *    first word of each is a pointer to a method that says whether the tab is shown (0x531b1084 for the movie
 *    tab, 0x531b108c playback, ... each `mov r0, #1; bx lr`). Called at every change of tab and when the menu
 *    opens, which skips a tab that answers 0. The movie descriptor's first word points to a method that
 *    answers 0 instead. The wide menus (`menuwide.ts`) copy the descriptors when they are installed: this
 *    one is installed before them.
 *  - Its two lines elsewhere: Still/Movie in the still menu (id 0x02000082, item 18 of the still descriptor
 *    0x53dc74b0, also item 8 of the movie one) and Movie Edit in the playback menu (id 0x04000033, item 16 of
 *    0x53dc783c). An item's visibility is a method pointer at descriptor + 0x254 + 8 * item (null: always
 *    shown); the builder (0x531b5494) leaves the item out when the method answers 0. Both get the method that
 *    answers 0.
 *  - Two functions of the Fn button lists: 18 Framerate and 19 Still/Movie (the text function 0x5338fbac gives
 *    their texts, found in the English row of the text table: function 18 -> text 'Framerate', 19 ->
 *    'Still/Movie'). Three lists (0x53de50c4, 0x53de515c, 0x53de52bc: the Fn, the Wireless and the
 *    4-way / Hold buttons' functions) are built by the constructors 0x531dcb00, 0x531dcb80 and 0x531dcc04, each
 *    asking the same filter 0x531d75d8(function) whether it is listed (0 leaves it out). The filter answers 0
 *    for those two first.
 *  - The movie mode. The photo / movie setting (CommonStillMovie, byte +0xb76 of the settings object) is
 *    read through one getter, 0x5329b310 (`ldrb r0, [r0, #0xb76]; bx lr`, 56 callers) and written by one
 *    setter, 0x532790ac(object, value) (the store at 0x532790b8, then the change notice 0x162 / 0xf). The
 *    getter always answers 0 (still): nothing in the camera ever sees the movie mode, whatever byte the saved
 *    settings hold. The setter stores 0 whatever it is given, so the byte never leaves 0 either.
 *
 * Found in the official 1.20 / 1.11 files by reading: the same code at 0x5327885c / 0x5329aac0 / 0x531b0ca0 /
 * 0x53dc6568 in 1.20 (see docs/film-mode-notes.md, « GR IV Monochrome : No movie »).
 */
import { assembleWords, branchWord } from './arm';
import { Patch, expectWord } from './build';
import { adr, byRelease } from '../target';

/** The movie tab's descriptor (menuwide.ts OTHER_TABS[0]): its first word is the tab's visibility method. */
export const MOVIE_TAB = adr(0x53dc7bd0);
/** The official visibility method of the movie tab (`mov r0, #1; bx lr`). */
export const MOVIE_TAB_VISIBLE = adr(0x531b1084);
/** The still and playback menu descriptors; an item's id at +0x1bc + 4 * item, its visibility method at +0x254 + 8 * item. */
export const STILL_MENU = adr(0x53dc74b0);
export const PLAYBACK_MENU = adr(0x53dc783c);
const D_ID = 0x1bc;
const D_VISIBLE = 0x254;
export const STILL_MOVIE_ITEM = 18;
export const STILL_MOVIE_ID = 0x02000082;
export const MOVIE_EDIT_ITEM = 16;
/** Movie Edit's id: 1.21 numbers the playback menu's lines one higher from 0x04000032 (every 0x040000xx id of this menu). */
export const MOVIE_EDIT_ID = byRelease({ '1.20': 0x04000032, '1.21': 0x04000033 });
/** The Fn functions' filter (`sub r0, r0, #0x19` first), asked by the three lists' constructors. */
export const FN_FILTER = adr(0x531d75d8);
export const FN_FRAMERATE = 18;
export const FN_STILL_MOVIE = 19;
/** CommonStillMovie's getter: `ldrb r0, [r0, #0xb76]; bx lr`. */
export const STILL_MOVIE_GETTER = adr(0x5329b310);
/** CommonStillMovie's setter and the store it begins with. */
export const STILL_MOVIE_SETTER = adr(0x532790ac);
export const STILL_MOVIE_STORE = adr(0x532790b8);

export function installNoMovie(patch: Patch): void {
  expectWord(patch, MOVIE_TAB, MOVIE_TAB_VISIBLE);
  expectWord(patch, MOVIE_TAB_VISIBLE, 0xe3a00001); // mov r0, #1
  expectWord(patch, MOVIE_TAB_VISIBLE + 4, 0xe12fff1e); // bx lr
  expectWord(patch, STILL_MOVIE_GETTER, 0xe5d00b76); // ldrb r0, [r0, #0xb76]
  expectWord(patch, STILL_MOVIE_GETTER + 4, 0xe12fff1e); // bx lr
  expectWord(patch, STILL_MOVIE_SETTER, 0xe1a0c00d); // mov ip, sp
  expectWord(patch, STILL_MOVIE_STORE, 0xe5c01b76); // strb r1, [r0, #0xb76]

  for (const [menu, item, id] of [[STILL_MENU, STILL_MOVIE_ITEM, STILL_MOVIE_ID], [PLAYBACK_MENU, MOVIE_EDIT_ITEM, MOVIE_EDIT_ID]] as const) {
    expectWord(patch, menu + D_ID + 4 * item, id);
    expectWord(patch, menu + D_VISIBLE + 8 * item, 0); // no visibility method: always shown
    expectWord(patch, menu + D_VISIBLE + 8 * item + 4, 0);
  }

  // The movie tab: its visibility method answers 0.
  const hidden = patch.append([0xe3a00000, 0xe12fff1e], 4); // mov r0, #0; bx lr
  patch.setWord(MOVIE_TAB, hidden, 'no movie: the Movie Settings tab is not shown');
  // The two lines: the same method as their visibility.
  patch.setWord(STILL_MENU + D_VISIBLE + 8 * STILL_MOVIE_ITEM, hidden, 'no movie: the Still/Movie line is not shown');
  patch.setWord(PLAYBACK_MENU + D_VISIBLE + 8 * MOVIE_EDIT_ITEM, hidden, 'no movie: the Movie Edit line is not shown');

  // The getter: still, always.
  patch.setWord(STILL_MOVIE_GETTER, 0xe3a00000, 'no movie: the photo / movie setting always reads still'); // mov r0, #0

  // The setter: the value stored is 0 (r1 is the value; the rest of the function is unchanged).
  const store = patch.append((at) => [
    ...assembleWords('mov r1, #0\nstrb r1, [r0, #0xb76]', at),
    branchWord(at + 8, STILL_MOVIE_STORE + 4),
  ], 4);
  patch.setWord(STILL_MOVIE_STORE, branchWord(STILL_MOVIE_STORE, store), 'no movie: the photo / movie setting is stored as still');
}

/**
 * The Fn lists: Framerate and Still/Movie are not listed. After GR Mod 0.9's Constant Light (`lamp.ts`), which reads the filter's
 * entry as the camera has it (convergence step 2, docs/fusion-0.9.md).
 */
export function installNoMovieFn(patch: Patch): void {
  expectWord(patch, FN_FILTER, 0xe2400019); // sub r0, r0, #0x19
  expectWord(patch, FN_FILTER + 4, 0xe1a0c00d); // mov ip, sp
  const filter = patch.append((at) => [
    ...assembleWords(`cmp r0, #${FN_FRAMERATE}\nmoveq r0, #0\nbxeq lr\ncmp r0, #${FN_STILL_MOVIE}\nmoveq r0, #0\nbxeq lr\nsub r0, r0, #0x19`, at),
    branchWord(at + 28, FN_FILTER + 4),
  ], 4);
  patch.setWord(FN_FILTER, branchWord(FN_FILTER, filter), 'no movie: Framerate and Still/Movie are not listed as Fn functions');

}
