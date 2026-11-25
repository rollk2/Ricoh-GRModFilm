// SPDX-License-Identifier: GPL-2.0-only
/**
 * GR IV Monochrome recipes, test M3a (test builds only, `monoCurve`): one factory black-and-white look gets a tone curve of its own, to check on
 * the camera that a style's curve acts on the luminance as the study expects (docs/gr4-mono-recettes-etude.md, sections 9 and 10).
 *
 * No new style: the look keeps its name, its parameters, its RAW number and its place in the menu. Only its curve descriptor changes, in the
 * three variants' rows of the curve table (0x55054158, initialised data: written in its start-up image): a copy of High Contrast's
 * descriptor (own curve, flag 1; byte 5 cleared as for the added slots) whose three curve pointers (R, G, B) point to the one curve given
 * (256 values 0..16383, the format of every style curve).
 */
import { FirmwareError } from '../../types';
import { Patch, u32le } from './build';
import { adr } from '../target';

const GAMMA_TABLE = adr(0x55054158), TONES = 38, VARIANTS = 3, GAMMA_DESC = 20;
const HIGH_CONTRAST_COLUMN = 30, MONO_STANDARD_COLUMN = 28, SOLARIZED_COLUMN = 35;
/** Styles 25..32 are the columns 28..35. */
const columnOf = (style: number): number => style + 3;
const RAM = { source: adr(0x543b3100), destination: 0x55000000 };
const image = (a: number): number => RAM.source + (a - RAM.destination);
const wordOf = (b: Uint8Array): number => new DataView(b.buffer, b.byteOffset, 4).getUint32(0, true);

/**
 * `path`: 'own' (test M3a: High Contrast's descriptor, flag 1: the curve receives the signal through the base curve, which turned out much
 * brighter than Standard) or 'standard' (test M3a-4: Monochrome Standard's descriptor, flag 0, its three curve pointers replaced: the curve
 * receives what Standard's curves receive).
 */
export type MonoCurvePath = 'own' | 'standard' | 'linear';
/**
 * 'linear' (test M3a-6): as 'own', with a base curve of our own in word 0 that leaves the signal as it is (the format of Solarized's base:
 * a header 257, 257, 1, 0 then 257 values 0..16383), so that the curve receives what Standard's curves receive, without the official
 * base curve's brightening.
 */
export function installMonoCurve(p: Patch, style: number, curve: readonly number[], path: MonoCurvePath = 'own'): void {
  const fail = (m: string): never => { throw new FirmwareError('bad-edit', `mono curve test: ${m}`); };
  if (!(Number.isInteger(style) && style >= 25 && style <= 30)) fail('the look must be a black-and-white factory look (25..30)');
  if (curve.length !== 256 || curve.some((v) => !Number.isInteger(v) || v < 0 || v > 16383)) fail('256 values 0..16383');
  for (let i = 1; i < 256; i++) if (curve[i] < curve[i - 1]) fail('the curve must not decrease');
  const template = wordOf(p.readMapped(GAMMA_TABLE + 4 * (path !== 'standard' ? HIGH_CONTRAST_COLUMN : MONO_STANDARD_COLUMN), 4));
  const desc = p.readMapped(template, GAMMA_DESC).slice();
  if (desc[4] !== (path !== 'standard' ? 1 : 0)) throw new FirmwareError('unexpected-layout', 'the template curve descriptor is not as expected');
  const bytes = new Uint8Array(512);
  curve.forEach((v, i) => new DataView(bytes.buffer).setUint16(i * 2, v, true));
  const at = p.append(bytes, 4);
  if (path !== 'standard') desc[5] = 0;
  if (path === 'linear') {
    const solarizedBase = wordOf(p.readMapped(wordOf(p.readMapped(GAMMA_TABLE + 4 * SOLARIZED_COLUMN, 4)), 4));
    const head = p.readMapped(solarizedBase, 8);
    if ([0, 2, 4, 6].map((o) => new DataView(head.buffer, head.byteOffset).getUint16(o, true)).join(',') !== '257,257,1,0') throw new FirmwareError('unexpected-layout', 'Solarized\'s base curve header is not 257, 257, 1, 0');
    const base = new Uint8Array(8 + 257 * 2);
    const bv = new DataView(base.buffer);
    [257, 257, 1, 0].forEach((v, i) => bv.setUint16(i * 2, v, true));
    for (let i = 0; i <= 256; i++) bv.setUint16(8 + i * 2, Math.min(16383, i * 64), true);
    new DataView(desc.buffer).setUint32(0, p.append(base, 4), true);
  }
  for (let i = 0; i < 3; i++) new DataView(desc.buffer).setUint32(8 + i * 4, at, true);
  const descNew = p.append(desc, 4);
  for (let v = 0; v < VARIANTS; v++) {
    const slot = GAMMA_TABLE + 4 * (v * TONES + columnOf(style));
    const old = wordOf(p.readMapped(slot, 4));
    p.setWord(image(slot), descNew, `mono curve test: look ${style}'s curve (variant ${v}), was ${old.toString(16)}`);
  }
  void u32le;
}
