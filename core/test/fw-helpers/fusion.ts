// SPDX-License-Identifier: GPL-2.0-only
/**
 * GR Mod Film, convergence with GR Mod 0.9 (docs/fusion-0.9.md).
 *
 * Step 2: firmware 1.21 is built by the 1.20 program with GR Mod Film's additions, so GR Mod 0.9's 1.21 tests run again.
 * Sensor Shift is not offered by GR Mod Film: its Fn function 46 is our Macro Mode, and the custom buttons are in every GR IV
 * build (`fw/gr4v120/aspect/build.ts`); its tests wait for a new number for one of the two.
 */
export const UPSTREAM_121 = true;
export const SENSOR_SHIFT = false;
/** Keeps a release unless it is 1.21 and the upstream 1.21 program is not in use yet. */
export const upstream121 = (version: string): boolean => UPSTREAM_121 || version !== '1.21';
