// SPDX-License-Identifier: GPL-2.0-only
/**
 * GR Mod Film, convergence step 1 (docs/fusion-0.9.md): on GR IV 1.21 (Monochrome 1.11) our own program is kept and
 * offers our features only; GR Mod 0.9's additions are refused there until step 2. Needs GRMOD_GR4_121_FIRMWARE.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { Engine } from '../src/app/engine';
import type { BuildOptions } from '../src';
import { UPSTREAM_121 } from './fw-helpers/fusion';

const f121 = process.env.GRMOD_GR4_121_FIRMWARE;

describe.skipIf(UPSTREAM_121 || !f121 || !existsSync(f121))('GR IV 1.21 during convergence step 1', () => {
  it('offers our features, not yet the GR Mod 0.9 additions, and refuses them', async () => {
    const eng = await Engine.open(new Uint8Array(readFileSync(f121!)));
    const f = eng.info.features as Record<string, unknown>;
    for (const k of ['noMovie', 'customButtons', 'monoRecipes', 'ratioOrder', 'batteryPercent', 'customGrid']) expect(f[k], k).toBe(true);
    const later: [string, BuildOptions][] = [['filmGrain', { filmGrain: true } as BuildOptions], ['flashTtl', { flashTtl: true } as BuildOptions],
      ['shadowLearn', { shadowLearn: true } as BuildOptions], ['ratioShade', { ratioShade: true } as BuildOptions], ['videoAf', { videoAf: true } as BuildOptions],
      ['awbLearn', { awbLearn: true } as BuildOptions], ['constantLight', { constantLight: true } as BuildOptions], ['sensorShift', { sensorShift: true } as BuildOptions],
      ['movie4k', { movie4k: true } as BuildOptions], ['movieSr', { movieSr: true } as BuildOptions]];
    for (const [k, options] of later) {
      expect(f[k], k).toBeFalsy();
      await expect(eng.buildFirmware([], [], [], options), k).rejects.toThrow();
    }
  }, 300_000);
});
