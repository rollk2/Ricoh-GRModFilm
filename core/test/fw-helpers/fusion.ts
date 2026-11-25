// SPDX-License-Identifier: GPL-2.0-only
/**
 * GR Mod Film, convergence with GR Mod 0.9 (docs/fusion-0.9.md). Step 1 keeps our own copy of the GR IV 1.21 program,
 * which offers our features only; GR Mod 0.9's additions (grain, Flash TTL, movie, shade, ...) come to 1.21 at step 2,
 * when our additions move onto its 1.20 program. Until then its 1.21 tests are not run: set this to true at step 2.
 */
export const UPSTREAM_121 = false;
/** Keeps a release unless it is 1.21 and the upstream 1.21 program is not in use yet. */
export const upstream121 = (version: string): boolean => UPSTREAM_121 || version !== '1.21';
