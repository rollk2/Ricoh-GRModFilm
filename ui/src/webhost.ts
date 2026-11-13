// The platform behind the page when GR Mod Film runs as a web site (GitHub Pages), without the shell.
// Same interface as host.ts's shell host; what a browser cannot do is either done another way (a folder
// chosen with the File System Access API, or a download) or reported as unavailable.
import type { DirEntry, FirmwareRelease, HostInfo, ParkedEntry, ParkedFailure, ReleaseNote, UpdateInfo, UpdateState, Volume } from './host';

/** The site's release page (what « update » and the release notes point at). */
export const WEB_RELEASES = 'https://github.com/rollk2/Ricoh-GRModFilm/releases';

/** The model's download page on Ricoh's site (with the licence): the site cannot fetch the file itself (no CORS). */
export const ricohPage = (model: string): string => `https://www.ricoh-imaging.co.jp/english/support/digital/${
  model.startsWith('GR3X') ? 'gr3x_s' : model.startsWith('GR3') ? 'gr3_s' : 'gr4_s'}.html`;

export class WebHostError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}

// --- Storage: IndexedDB (one object store of byte arrays), or memory where there is none (tests).
const DB = 'grmod-film', STORE = 'store';
const memory = new Map<string, Uint8Array>();
function db(): Promise<IDBDatabase> | null {
  if (typeof indexedDB === 'undefined') return null;
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => { open.result.createObjectStore(STORE); };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db()!;
  return new Promise((resolve, reject) => {
    const r = run(d.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

// --- Folders: a folder chosen by the user (Chrome, Edge) is kept by an id used as a path root; without
// the API (Safari, Firefox) the root is DOWNLOADS and each written file is downloaded.
export const DOWNLOADS = 'downloads:';
interface DirHandle { name: string; getDirectoryHandle(n: string, o?: { create?: boolean }): Promise<DirHandle>; getFileHandle(n: string, o?: { create?: boolean }): Promise<{ createWritable(): Promise<{ write(d: Uint8Array): Promise<void>; close(): Promise<void> }> }> }
const folders = new Map<string, DirHandle>();
let nextFolder = 1;
type Picker = (o?: { mode?: 'readwrite'; id?: string }) => Promise<DirHandle>;
const picker = (): Picker | undefined => (globalThis as unknown as { showDirectoryPicker?: Picker }).showDirectoryPicker;
/** True where the browser can write into a folder the user picks (the card): Chrome, Edge. */
export const canPickFolder = (): boolean => typeof picker() === 'function';

function download(name: string, data: Uint8Array): void {
  const url = URL.createObjectURL(new Blob([data as unknown as BlobPart], { type: 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

async function sha256(data: Uint8Array): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', data as unknown as BufferSource));
  return Array.from(d, (b) => b.toString(16).padStart(2, '0')).join('');
}
const unavailable = (what: string): never => { throw new WebHostError('web-unavailable', `${what} is not available on the web site`); };

export function makeWebHost(version: string) {
  const info: HostInfo = { kind: 'web', token: '', version, os: 'web' };
  return {
    available: true,
    info,
    sep: '/',
    join(root: string, ...parts: string[]): string {
      let p = root;
      for (const part of parts) p = p.endsWith('/') ? p + part : p + '/' + part;
      return p;
    },
    async volumes(_all = false): Promise<Volume[]> { return []; },
    async list(_path: string): Promise<DirEntry[]> { return []; },
    async read(_path: string): Promise<Uint8Array> { return unavailable('Reading the card'); },
    async write(path: string, data: Uint8Array): Promise<{ size: number; sha256: string }> {
      const parts = path.split('/');
      const root = parts.shift()!, name = parts.pop()!;
      if (root === DOWNLOADS || root.startsWith(DOWNLOADS)) download(name, data);
      else {
        const top = folders.get(root);
        if (!top) unavailable('This folder');
        let dir = top!;
        for (const sub of parts) dir = await dir.getDirectoryHandle(sub, { create: true });
        const w = await (await dir.getFileHandle(name, { create: true })).createWritable();
        await w.write(data); await w.close();
      }
      return { size: data.length, sha256: await sha256(data) };
    },
    async move(_from: string, _to: string): Promise<void> { unavailable('Moving files on the card'); },
    /** The folder the user picks (its id as a path root), DOWNLOADS without the API, '' when cancelled. */
    async pickDirectory(_title: string): Promise<string> {
      const pick = picker();
      if (!pick) return DOWNLOADS;
      try {
        const h = await pick({ mode: 'readwrite', id: 'grmod-card' });
        const id = `folder${nextFolder++}:`;
        folders.set(id, h);
        return id;
      } catch { return ''; }
    },
    async reveal(_path: string): Promise<void> { /* nothing to show */ },
    async eject(_id: string): Promise<void> { /* the browser cannot eject a card */ },
    async storeGet(key: string): Promise<Uint8Array | null> {
      if (!db()) return memory.get(key) ?? null;
      const v = await tx('readonly', (s) => s.get(key) as IDBRequest<Uint8Array | undefined>);
      return v ? new Uint8Array(v) : null;
    },
    async storeSet(key: string, data: Uint8Array | string): Promise<void> {
      const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data.slice();
      if (!db()) { memory.set(key, bytes); return; }
      await tx('readwrite', (s) => s.put(bytes, key));
    },
    async storeDel(key: string): Promise<void> {
      if (!db()) { memory.delete(key); return; }
      await tx('readwrite', (s) => s.delete(key));
    },
    async parked(_volumeId: string): Promise<ParkedEntry[]> { return []; },
    async parkedRead(_volumeId: string, _path: string): Promise<Uint8Array> { return unavailable('Parked files'); },
    async parkedDelete(_volumeId: string, _paths: string[]): Promise<{ deleted: string[]; failed: ParkedFailure[] }> { return { deleted: [], failed: [] }; },
    async parkedBackup(_volumeId: string, _paths: string[]): Promise<{ saved: { path: string; dest: string; existed: boolean }[]; failed: ParkedFailure[] }> { return { saved: [], failed: [] }; },
    async backups(): Promise<{ dir: string; entries: ParkedEntry[] }> { return { dir: '', entries: [] }; },
    async backupRead(_path: string): Promise<Uint8Array> { return unavailable('Firmware copies'); },
    async backupsDelete(_paths: string[]): Promise<{ deleted: string[]; failed: ParkedFailure[] }> { return { deleted: [], failed: [] }; },
    async backupsReveal(_path?: string): Promise<void> { /* none */ },
    async windowChrome(_c: { caption: string; text: string; dark: boolean }): Promise<void> { /* the browser's own */ },
    async firmwareLatest(_model: string): Promise<FirmwareRelease | null> { return null; },
    async firmwareDownload(_model: string, _version?: string, _signal?: AbortSignal): Promise<{ name: string; version: string; data: Uint8Array }> {
      return unavailable('Downloading the official firmware');
    },
    async firmwareProgress(): Promise<{ active: boolean; received: number; total: number }> { return { active: false, received: 0, total: 0 }; },
    async firmwarePage(model: string, _version?: string): Promise<void> { window.open(ricohPage(model), '_blank', 'noopener'); },
    async updateCheck(): Promise<UpdateInfo> { return { current: version, available: false, size: 0, canInstall: false, reason: 'web', ready: false }; },
    async updateDownload(_signal?: AbortSignal): Promise<void> { /* the site is always the latest */ },
    async updateProgress(): Promise<{ active: boolean; received: number; total: number }> { return { active: false, received: 0, total: 0 }; },
    async updateInstall(): Promise<void> { /* nothing to install */ },
    async updatePage(): Promise<void> { window.open(WEB_RELEASES, '_blank', 'noopener'); },
    async updateState(): Promise<UpdateState> { return { current: version }; },
    async updateNotes(): Promise<UpdateState & { releases: ReleaseNote[] }> { return { current: version, releases: [] }; },
    async releasePage(v: string): Promise<void> { window.open(`${WEB_RELEASES}/tag/v${v}`, '_blank', 'noopener'); },
    async openPage(url: string): Promise<void> { window.open(url, '_blank', 'noopener'); },
    async sidecar(_name: string): Promise<Uint8Array | null> { return null; },
  };
}
