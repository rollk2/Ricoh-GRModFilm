// SPDX-License-Identifier: GPL-2.0-only
// T-SET1: the settings file the camera writes (C:\GRFILM.SET), read back by the program.
import { describe, expect, it } from 'vitest';
import { GR3X_SETTINGS_COUNT, GR3X_SETTINGS_HEADER, GR3X_SETTINGS_RECORD, GR3X_SETTINGS_TEXTS, gr3xSettingsHeader, readGr3xSettingsFile } from '../src/fw/gr3x/settings-file';
import { LANGS } from '../src/fw/names';

function file(model: 'gr3' | 'gr3x', version: string, seed = 1) {
  let x = seed;
  const records = Array.from({ length: GR3X_SETTINGS_COUNT }, () => Uint8Array.from({ length: GR3X_SETTINGS_RECORD }, () => (x = (x * 1103515245 + 12345) >>> 0) >>> 24));
  const out = new Uint8Array(GR3X_SETTINGS_HEADER + GR3X_SETTINGS_COUNT * (GR3X_SETTINGS_RECORD + 4));
  out.set(gr3xSettingsHeader(model, version));
  records.forEach((r, k) => {
    const at = GR3X_SETTINGS_HEADER + k * (GR3X_SETTINGS_RECORD + 4);
    out.set(r, at); new DataView(out.buffer).setUint32(at + GR3X_SETTINGS_RECORD, r.reduce((a, b) => (a + b) >>> 0, 0), true);
  });
  return { out, records };
}

describe('settings file', () => {
  it('reads what the camera writes: model, version, the nine records', () => {
    for (const model of ['gr3', 'gr3x'] as const) {
      const { out, records } = file(model, '0.9.8');
      const got = readGr3xSettingsFile(out);
      expect(got.model).toBe(model); expect(got.version).toBe('0.9.8'); expect(got.records).toEqual(records);
    }
  });
  it('refuses a file that is not one, of an unknown layout, cut or damaged', () => {
    const { out } = file('gr3', '0.9.8');
    expect(() => readGr3xSettingsFile(out.slice(0, 10))).toThrow(/too short/);
    const magic = out.slice(); magic[0] = 0x58; expect(() => readGr3xSettingsFile(magic)).toThrow(/not a GR Mod Film settings file/);
    const fmt = out.slice(); fmt[4] = 9; expect(() => readGr3xSettingsFile(fmt)).toThrow(/format version/);
    const model = out.slice(); model[10] = 7; expect(() => readGr3xSettingsFile(model)).toThrow(/unknown model/);
    expect(() => readGr3xSettingsFile(out.slice(0, out.length - 1))).toThrow(/wrong length/);
    const damaged = out.slice(); damaged[GR3X_SETTINGS_HEADER + 3 * (GR3X_SETTINGS_RECORD + 4) + 100] ^= 1;
    expect(() => readGr3xSettingsFile(damaged)).toThrow(/record 3 damaged/);
  });
  it('has its four texts in every language', () => {
    for (const g of ['line', 'question', 'done', 'failed'] as const) {
      expect(GR3X_SETTINGS_TEXTS[g]).toHaveLength(LANGS.length);
      expect(GR3X_SETTINGS_TEXTS[g].every(t => t.length > 0 && !/[\u2013\u2014]/.test(t))).toBe(true);
    }
  });
});
