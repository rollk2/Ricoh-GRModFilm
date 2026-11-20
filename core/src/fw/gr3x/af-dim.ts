// SPDX-License-Identifier: GPL-2.0-only
/**
 * GR III 2.10 / IIIx 1.60, `afDim` (experimental): a faster autofocus in dim light.
 *
 * From the research of nflaschel (https://gr.nflaschel.de/, GR IIIx 1.60, November 2026): in dim light the final
 * focus comes from a contrast sweep, which counts a sharpness peak only when its rise and its fall both exceed a
 * margin, and which runs at 29 frames a second in the darkest of the four modes. Two changes only pay off together:
 *
 *  - a lower margin: the six per-mode base values (0x53c16bb0, about 570 to 600) times 0.32, two falling samples
 *    instead of three before a peak is accepted (0x53c16cc0), the rise floor of mode 0 from 0.02 to 0.014
 *    (0x53c16d14);
 *  - 49 frames a second where the camera would pick 29 (0x533f4b10: `movhi r3, #3` becomes `#2`).
 *
 *  - the dim-light scaling of the margin, b/y, becomes (b/y)^0.875: ten words of the helper at 0x5340c590, which the author
 *    published as the setting "X875" of his repository (https://github.com/nils-fl/RicohGR, MIT licence, tools/af_debug_card.py,
 *    tools/af_firmware.py): the early return of the dim-light branch is replaced by x / x^(1/8), the three square roots and a
 *    division. In total 19 words, the same as his flashed build.
 *
 * The same addresses and the same original values are in the 2.10 and the 1.60 programs. Nothing here is measured on
 * a camera of ours yet.
 */
import { FirmwareError } from '../types';

const MARGINS = 0x53c16bb0, MARGIN_ORIGINAL = [569.2, 569.2, 574.5, 597.8, 563.3, 563.3], MARGIN_FACTOR = 0.32;
/** The ten words of the helper (0x5340c5f0 .. 0x5340c614), as the official programs have them, and with the exponent 0.875. */
const SCALE = 0x5340c5f0;
const SCALE_OFFICIAL = [0x8a000008, 0xe3063bd4, 0xe34533c1, 0xedd37a00, 0xeeb40ae7, 0xeef1fa10, 0x5ef07a40, 0xeeb70ae7, 0xebf51d64, 0xeeb70bc0];
const SCALE_NEW = [0x8eb17ac0, 0x8eb17ac7, 0x8eb17ac7, 0x8e800a07, 0x8a000004, 0xeef57a00, 0xeeb40ae7, 0xeef1fa10, 0x4eb00a67, 0xeeb10ac0];
const FALLS = 0x53c16cc0, RISE_FLOOR = 0x53c16d14, FRAME_RATE = 0x533f4b10;

const bits = (x: number): number => { const v = new DataView(new ArrayBuffer(4)); v.setFloat32(0, x, true); return v.getUint32(0, true); };

export interface Gr3xAfDimContext {
  patch(address: number, expected: number, replacement: number, reason: string): void;
  u32(address: number): number;
}

export function installGr3xAfDim(c: Gr3xAfDimContext): void {
  const fail = (what: string): never => { throw new FirmwareError('unexpected-layout', `IIIx AF in dim light: ${what}`); };
  MARGIN_ORIGINAL.forEach((m, i) => {
    const at = MARGINS + 4 * i, was = c.u32(at);
    const v = new DataView(new ArrayBuffer(4)); v.setUint32(0, was, true);
    if (Math.abs(v.getFloat32(0, true) - m) > 0.1) fail(`the margin ${i} is not the official one`);
    c.patch(at, was, bits(Math.fround(v.getFloat32(0, true) * MARGIN_FACTOR)), `AF in dim light: margin ${i} x ${MARGIN_FACTOR}`);
  });
  SCALE_OFFICIAL.forEach((w, i) => c.patch(SCALE + 4 * i, w, SCALE_NEW[i], 'AF in dim light: the margin scaled by (b/y)^0.875'));
  c.patch(FALLS, 3, 2, 'AF in dim light: two falling samples before a peak is accepted');
  c.patch(RISE_FLOOR, bits(0.02), bits(0.014), 'AF in dim light: the rise floor');
  c.patch(FRAME_RATE, 0x83a03003, 0x83a03002, 'AF in dim light: 49 frames a second where the camera picks 29');
}
