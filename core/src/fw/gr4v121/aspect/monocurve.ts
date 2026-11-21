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

const GAMMA_TABLE = 0x55054158, TONES = 38, VARIANTS = 3, GAMMA_DESC = 20;
const HIGH_CONTRAST_COLUMN = 30, MONO_STANDARD_COLUMN = 28;
/** Styles 25..32 are the columns 28..35. */
const columnOf = (style: number): number => style + 3;
const RAM = { source: 0x543b4900, destination: 0x55000000 };
const image = (a: number): number => RAM.source + (a - RAM.destination);
const wordOf = (b: Uint8Array): number => new DataView(b.buffer, b.byteOffset, 4).getUint32(0, true);

/**
 * `path`: 'own' (test M3a: High Contrast's descriptor, flag 1: the curve receives the signal through the base curve, which turned out much
 * brighter than Standard) or 'standard' (test M3a-4: Monochrome Standard's descriptor, flag 0, its three curve pointers replaced: the curve
 * receives what Standard's curves receive).
 */
export function installMonoCurve(p: Patch, style: number, curve: readonly number[], path: 'own' | 'standard' = 'own'): void {
  const fail = (m: string): never => { throw new FirmwareError('bad-edit', `mono curve test: ${m}`); };
  if (!(Number.isInteger(style) && style >= 25 && style <= 30)) fail('the look must be a black-and-white factory look (25..30)');
  if (curve.length !== 256 || curve.some((v) => !Number.isInteger(v) || v < 0 || v > 16383)) fail('256 values 0..16383');
  for (let i = 1; i < 256; i++) if (curve[i] < curve[i - 1]) fail('the curve must not decrease');
  const template = wordOf(p.readMapped(GAMMA_TABLE + 4 * (path === 'own' ? HIGH_CONTRAST_COLUMN : MONO_STANDARD_COLUMN), 4));
  const desc = p.readMapped(template, GAMMA_DESC).slice();
  if (desc[4] !== (path === 'own' ? 1 : 0)) throw new FirmwareError('unexpected-layout', 'the template curve descriptor is not as expected');
  const bytes = new Uint8Array(512);
  curve.forEach((v, i) => new DataView(bytes.buffer).setUint16(i * 2, v, true));
  const at = p.append(bytes, 4);
  if (path === 'own') desc[5] = 0;
  for (let i = 0; i < 3; i++) new DataView(desc.buffer).setUint32(8 + i * 4, at, true);
  const descNew = p.append(desc, 4);
  for (let v = 0; v < VARIANTS; v++) {
    const slot = GAMMA_TABLE + 4 * (v * TONES + columnOf(style));
    const old = wordOf(p.readMapped(slot, 4));
    p.setWord(image(slot), descNew, `mono curve test: look ${style}'s curve (variant ${v}), was ${old.toString(16)}`);
  }
  void u32le;
}
