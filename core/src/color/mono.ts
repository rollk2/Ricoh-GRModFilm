// SPDX-License-Identifier: GPL-2.0-only
// Black-and-white recipes for the GR IV Monochrome (docs/gr4-mono-recettes-etude.md): its sensor has no colour, so of a LUT only the
// tone curve on the neutral axis can be used; what the LUT does to colours (a toning, or a mix of the channels such as a film's spectral
// response) is reported, not reproduced.
import { applyCube, parseCube } from './cube';

export interface MonoLut {
  title: string;
  /** The LUT's output on the neutral axis (R = G = B = i / 255), as the mean of the three channels, 256 values 0..1. */
  neutral: Float64Array;
  /** Largest difference between a channel and the mean of the three, over the whole table (0 for a grey LUT). */
  toning: number;
  /** Largest difference between the grey a colour gives and the grey its luminance gives (0 when the LUT ignores colour). */
  mixing: number;
}

/** Above these the LUT colours or mixes channels noticeably (two levels in 255). */
export const MONO_TONING_LIMIT = 2 / 255, MONO_MIXING_LIMIT = 8 / 255;

export function monoLutFromCube(text: string): MonoLut {
  const cube = parseCube(text);
  const axis = new Float64Array(256 * 3);
  for (let i = 0; i < 256; i++) axis[3 * i] = axis[3 * i + 1] = axis[3 * i + 2] = i / 255;
  const out = applyCube(cube, axis);
  const neutral = new Float64Array(256);
  for (let i = 0; i < 256; i++) neutral[i] = (out[3 * i] + out[3 * i + 1] + out[3 * i + 2]) / 3;
  // A grid of colours: the toning (channels apart) and the mixing (a colour's grey against the grey of its luminance).
  const n = 9, grid = new Float64Array(n * n * n * 3);
  for (let r = 0, k = 0; r < n; r++) for (let g = 0; g < n; g++) for (let b = 0; b < n; b++, k += 3) { grid[k] = r / (n - 1); grid[k + 1] = g / (n - 1); grid[k + 2] = b / (n - 1); }
  const got = applyCube(cube, grid);
  const greys = new Float64Array(grid.length);
  for (let k = 0; k < grid.length; k += 3) {
    const y = 0.2126 * grid[k] + 0.7152 * grid[k + 1] + 0.0722 * grid[k + 2];
    greys[k] = greys[k + 1] = greys[k + 2] = y;
  }
  const grey = applyCube(cube, greys);
  let toning = 0, mixing = 0;
  for (let k = 0; k < got.length; k += 3) {
    const m = (got[k] + got[k + 1] + got[k + 2]) / 3;
    for (let c = 0; c < 3; c++) toning = Math.max(toning, Math.abs(got[k + c] - m));
    const mg = (grey[k] + grey[k + 1] + grey[k + 2]) / 3;
    mixing = Math.max(mixing, Math.abs(m - mg));
  }
  return { title: cube.title, neutral, toning, mixing };
}

/**
 * The curve of a black-and-white added slot (256 values 0..16383): the LUT's neutral axis itself, `c[i] = 16383 × LUT(i / 255)`, kept
 * non-decreasing. On the path of the added slots (curve descriptor flag 1, neutral base curve), the curve's input i is already what
 * Monochrome Standard renders (i / 255): measured on a grey chart with two LUTs (GR Mod Film 1.3, M5-3, docs/gr4-mono-recettes-etude.md
 * section 14.5). Until then the LUT was applied to Monochrome Standard's green curve, which darkened the shadows by up to 15 levels.
 */
export function monoRecipeCurve(neutral: ArrayLike<number>): Uint16Array {
  if (neutral.length !== 256) throw new Error('mono recipe: 256 values');
  const out = new Uint16Array(256);
  for (let i = 0; i < 256; i++) out[i] = Math.max(i ? out[i - 1] : 0, Math.min(16383, Math.max(0, Math.round(16383 * neutral[i]))));
  return out;
}
