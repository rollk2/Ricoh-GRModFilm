// SPDX-License-Identifier: GPL-2.0-only
// The web site's host (ui/src/webhost.ts): storage, a folder picked by the user, downloads elsewhere.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DOWNLOADS, makeWebHost } from '../../ui/src/webhost';

function folder(name = 'CARD') {
  const files = new Map<string, Uint8Array>();
  const dir = (path: string): unknown => ({
    name,
    getDirectoryHandle: async (n: string) => dir(path + n + '/'),
    getFileHandle: async (n: string) => ({ createWritable: async () => {
      let data = new Uint8Array();
      return { write: async (d: Uint8Array) => { data = d.slice(); }, close: async () => { files.set(path + n, data); } };
    } }),
  });
  return { handle: dir(''), files };
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('web host', () => {
  it('keeps the project in its storage (memory without IndexedDB)', async () => {
    const h = makeWebHost('0.9.8');
    expect(h.available).toBe(true);
    expect(h.info).toMatchObject({ kind: 'web', version: '0.9.8' });
    expect(await h.storeGet('project.json')).toBeNull();
    await h.storeSet('project.json', '{"v":1}');
    expect(new TextDecoder().decode((await h.storeGet('project.json'))!)).toBe('{"v":1}');
    await h.storeDel('project.json');
    expect(await h.storeGet('project.json')).toBeNull();
  });
  it('writes into the folder the user picks (the card), sub-folders included', async () => {
    const f = folder();
    vi.stubGlobal('showDirectoryPicker', vi.fn(async () => f.handle));
    const h = makeWebHost('0.9.8');
    const root = await h.pickDirectory('card');
    expect(root).toMatch(/^folder\d+:$/);
    const firmware = Uint8Array.of(1, 2, 3), settings = Uint8Array.of(9);
    expect(await h.write(h.join(root, 'fwdc239b.bin'), firmware)).toMatchObject({ size: 3 });
    await h.write(h.join(root, 'GRFILM.SET'), settings);
    await h.write(h.join(root, 'MISC', 'x.txt'), settings);
    expect(f.files.get('fwdc239b.bin')).toEqual(firmware);
    expect(f.files.get('GRFILM.SET')).toEqual(settings);
    expect(f.files.get('MISC/x.txt')).toEqual(settings);
  });
  it('downloads the files where the browser cannot write into a folder, and reports a cancelled pick', async () => {
    const clicks: string[] = [];
    vi.stubGlobal('document', { createElement: () => ({ set href(_v: string) {}, set download(v: string) { clicks.push(v); }, set rel(_v: string) {}, click: () => undefined, remove: () => undefined }), body: { appendChild: () => undefined } });
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: () => undefined });
    const h = makeWebHost('0.9.8');
    expect(await h.pickDirectory('card')).toBe(DOWNLOADS);
    await h.write(h.join(DOWNLOADS, 'fwdc239b.bin'), Uint8Array.of(1));
    expect(clicks).toEqual(['fwdc239b.bin']);
    vi.stubGlobal('showDirectoryPicker', vi.fn(async () => { throw new Error('AbortError'); }));
    expect(await makeWebHost('0.9.8').pickDirectory('card')).toBe('');
  });
  it('has no card, no official download, no self-update', async () => {
    const h = makeWebHost('0.9.8');
    expect(await h.volumes()).toEqual([]);
    expect(await h.firmwareLatest('GR3')).toBeNull();
    await expect(h.firmwareDownload('GR3')).rejects.toMatchObject({ code: 'web-unavailable' });
    expect(await h.updateCheck()).toMatchObject({ current: '0.9.8', available: false, canInstall: false, reason: 'web' });
  });
});
