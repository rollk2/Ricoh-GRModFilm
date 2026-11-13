// 0.9.9: packs of recipes and of ratios, files to keep one's work, move it between the program and the web site,
// or share it. A pack is JSON: the recipes carry their names, film code, halation, icon and the preset's own text.

export const RECIPES_FORMAT = 'grmod-film-recipes';
export const RATIOS_FORMAT = 'grmod-film-ratios';
export const RECIPES_EXT = '.grfrecipes';
export const RATIOS_EXT = '.grfratios';

/** The camera family a recipe pack is for: GR III / IIIx films, or GR IV's Cinema slots. */
export type PackFamily = 'gr3' | 'gr4';
export interface PackIcon { mode: 'keep' | 'text' | 'image'; text: string; style: 'film' | 'plain'; image?: string }
export interface PackRecipe {
  names: Record<string, string>;
  code?: string;
  halation?: { on: boolean; preview: 0 | 1 | 2 | 3; colour?: 'red' | 'white' };
  icon?: PackIcon;
  preset?: { fileName: string; kind: 'xmp' | 'cube'; text: string };
}
/** 1.0: what a shared pack says of itself (the community collection, community/README.md). */
export interface PackMeta { title?: string; author?: string; description?: string; license?: string }
/** The licence of the community collection: public domain, the author's own work. */
export const COMMUNITY_LICENSE = 'CC0-1.0';
export interface RecipePack extends PackMeta { format: typeof RECIPES_FORMAT; v: 1; family: PackFamily; recipes: PackRecipe[] }
export interface PackRatio { ratio: string; name: string }
export interface RatioPack extends PackMeta { format: typeof RATIOS_FORMAT; v: 1; ratios: PackRatio[] }

export class PackError extends Error {
  code: 'not-a-pack' | 'other-kind' | 'newer' | 'empty';
  constructor(code: PackError['code']) { super(code); this.code = code; }
}

const MAX_RECIPES = 40;
const MAX_RATIOS = 40;
const FILM_CODE = /^[A-Z0-9]{4}$/;
const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');
/** The meta fields kept: trimmed, bounded, only when not empty. */
function cleanMeta(d: Record<string, unknown> | PackMeta | undefined): PackMeta {
  const m = (d ?? {}) as Record<string, unknown>, out: PackMeta = {};
  const title = str(m.title, 60).trim(), author = str(m.author, 40).trim(), description = str(m.description, 300).trim(), license = str(m.license, 20).trim();
  if (title) out.title = title; if (author) out.author = author; if (description) out.description = description; if (license) out.license = license;
  return out;
}

function parse(text: string, format: string): Record<string, unknown> {
  let doc: unknown;
  try { doc = JSON.parse(text); } catch { throw new PackError('not-a-pack'); }
  if (!doc || typeof doc !== 'object') throw new PackError('not-a-pack');
  const d = doc as Record<string, unknown>;
  if (d.format !== format) throw new PackError(d.format === RECIPES_FORMAT || d.format === RATIOS_FORMAT ? 'other-kind' : 'not-a-pack');
  if (d.v !== 1) throw new PackError(typeof d.v === 'number' && d.v > 1 ? 'newer' : 'not-a-pack');
  return d;
}

/** A recipe as written in a pack: what has no value is left out. */
function cleanRecipe(r: unknown): PackRecipe | null {
  if (!r || typeof r !== 'object') return null;
  const x = r as Record<string, unknown>;
  const names: Record<string, string> = {};
  if (x.names && typeof x.names === 'object') for (const [k, v] of Object.entries(x.names as Record<string, unknown>)) { const s = str(v, 80); if (s && /^[a-z]{2}(-[A-Z]{2})?$/.test(k)) names[k] = s; }
  const out: PackRecipe = { names };
  if (typeof x.code === 'string' && FILM_CODE.test(x.code)) out.code = x.code;
  const h = x.halation as Record<string, unknown> | undefined;
  if (h && typeof h === 'object' && [0, 1, 2, 3].includes(h.preview as number)) {
    out.halation = { on: h.on !== false, preview: h.preview as 0 | 1 | 2 | 3, ...(h.colour === 'red' || h.colour === 'white' ? { colour: h.colour } : {}) };
  }
  const i = x.icon as Record<string, unknown> | undefined;
  if (i && typeof i === 'object' && (i.mode === 'text' || i.mode === 'image' || i.mode === 'keep')) {
    const image = typeof i.image === 'string' && i.image.startsWith('data:image/') && i.image.length < 2_000_000 ? i.image : undefined;
    out.icon = { mode: i.mode === 'image' && !image ? 'keep' : i.mode, text: str(i.text, 16), style: i.style === 'plain' ? 'plain' : 'film', ...(image ? { image } : {}) };
  }
  const p = x.preset as Record<string, unknown> | undefined;
  if (p && typeof p === 'object' && typeof p.text === 'string' && p.text.length > 0 && p.text.length < 120_000_000) {
    out.preset = { fileName: str(p.fileName, 200) || 'preset', kind: p.kind === 'cube' ? 'cube' : 'xmp', text: p.text };
  }
  return out;
}
/** True when a recipe carries nothing (no name, code, preset, halation level or drawn icon). */
export function emptyRecipe(r: PackRecipe): boolean {
  return Object.keys(r.names).length === 0 && !r.code && !r.preset && !(r.halation && r.halation.preview > 0) && !(r.icon && r.icon.mode !== 'keep');
}

export function makeRecipePack(family: PackFamily, recipes: PackRecipe[], meta?: PackMeta): string {
  const pack: RecipePack = { format: RECIPES_FORMAT, v: 1, ...cleanMeta(meta), family, recipes: recipes.map((r) => cleanRecipe(r)!).filter((r) => !emptyRecipe(r)) };
  return JSON.stringify(pack, null, 1);
}
export function readRecipePack(text: string): RecipePack {
  const d = parse(text, RECIPES_FORMAT);
  const family: PackFamily = d.family === 'gr4' ? 'gr4' : 'gr3';
  const recipes = (Array.isArray(d.recipes) ? d.recipes : []).slice(0, MAX_RECIPES).map(cleanRecipe).filter((r): r is PackRecipe => !!r && !emptyRecipe(r));
  if (recipes.length === 0) throw new PackError('empty');
  return { format: RECIPES_FORMAT, v: 1, ...cleanMeta(d), family, recipes };
}

const cleanRatio = (r: unknown): PackRatio | null => {
  if (!r || typeof r !== 'object') return null;
  const ratio = str((r as Record<string, unknown>).ratio, 24).trim();
  return ratio ? { ratio, name: str((r as Record<string, unknown>).name, 80) } : null;
};
export function makeRatioPack(ratios: PackRatio[], meta?: PackMeta): string {
  const pack: RatioPack = { format: RATIOS_FORMAT, v: 1, ...cleanMeta(meta), ratios: ratios.map(cleanRatio).filter((r): r is PackRatio => !!r) };
  return JSON.stringify(pack, null, 1);
}
export function readRatioPack(text: string): RatioPack {
  const d = parse(text, RATIOS_FORMAT);
  const ratios = (Array.isArray(d.ratios) ? d.ratios : []).slice(0, MAX_RATIOS).map(cleanRatio).filter((r): r is PackRatio => !!r);
  if (ratios.length === 0) throw new PackError('empty');
  return { format: RATIOS_FORMAT, v: 1, ...cleanMeta(d), ratios };
}

/** The same ratio typed differently (« 65:24 », « 65 : 24 »). */
const ratioKey = (r: string): string => r.replace(/\s+/g, '').toLowerCase();
/**
 * The ratios after an import: « replace » takes the pack's, « add » puts the pack's after the ones there, without
 * the ratios already present; at most `max` either way. `skipped` counts what did not fit or was already there.
 */
export function mergeRatios(existing: PackRatio[], incoming: PackRatio[], mode: 'replace' | 'add', max: number): { ratios: PackRatio[]; skipped: number } {
  const out: PackRatio[] = mode === 'replace' ? [] : existing.filter((r) => r.ratio.trim());
  const seen = new Set(out.map((r) => ratioKey(r.ratio)));
  let skipped = 0;
  for (const r of incoming) {
    if (seen.has(ratioKey(r.ratio)) || out.length >= max) { skipped++; continue; }
    seen.add(ratioKey(r.ratio)); out.push(r);
  }
  return { ratios: out, skipped };
}
/**
 * Where each recipe of a pack goes: « replace » fills the slots from the first, « add » only the empty ones, in
 * order. The list is shorter than the pack when there are not enough places.
 */
export function placeRecipes(slots: readonly string[], isEmpty: (id: string) => boolean, count: number, mode: 'replace' | 'add'): string[] {
  return (mode === 'replace' ? [...slots] : slots.filter(isEmpty)).slice(0, count);
}

// ------------------------------------------------------------------ the community collection (1.0)
/** The largest pack the collection takes (a few films with their .cube presets). */
export const COMMUNITY_MAX_BYTES = 8_000_000;
/** One pack of the collection as the site lists it (community/index.json). */
export interface CommunityEntry {
  kind: 'recipes' | 'ratios'; file: string; size: number;
  title: string; author: string; description: string;
  /** Recipes: the camera family, and each film's name (English, else the first given). */
  family?: PackFamily; items: string[];
}
export interface CommunityIndex { v: 1; packs: CommunityEntry[] }

/**
 * A file of the collection checked as the site and the CI read it: its folder decides the kind, and it must be
 * a valid pack of that kind, with a title and the collection's licence. Throws a message for the CI otherwise.
 */
export function communityEntry(path: string, text: string, size: number): CommunityEntry {
  const m = /^(recipes|ratios)\/([A-Za-z0-9][A-Za-z0-9._-]{0,80})$/.exec(path);
  if (!m) throw new Error(`${path}: a pack goes in recipes/ or ratios/, with a plain file name (letters, digits, . _ -)`);
  const kind = m[1] as 'recipes' | 'ratios';
  if (!m[2].endsWith(kind === 'recipes' ? RECIPES_EXT : RATIOS_EXT)) throw new Error(`${path}: a ${kind} pack ends with ${kind === 'recipes' ? RECIPES_EXT : RATIOS_EXT}`);
  if (size > COMMUNITY_MAX_BYTES) throw new Error(`${path}: larger than ${COMMUNITY_MAX_BYTES / 1e6} MB`);
  let pack: RecipePack | RatioPack;
  try { pack = kind === 'recipes' ? readRecipePack(text) : readRatioPack(text); } catch (e) { throw new Error(`${path}: not a valid ${kind} pack (${e instanceof PackError ? e.code : 'unreadable'})`); }
  if (!pack.title) throw new Error(`${path}: the pack has no title`);
  if (pack.license !== COMMUNITY_LICENSE) throw new Error(`${path}: the collection takes ${COMMUNITY_LICENSE} packs only (licence: ${pack.license ?? 'none'})`);
  const items = 'recipes' in pack
    ? pack.recipes.map((r, i) => r.names.en || Object.values(r.names)[0] || r.code || `Film ${i + 1}`)
    : pack.ratios.map((r) => (r.name ? `${r.ratio} ${r.name}` : r.ratio));
  return { kind, file: path, size, title: pack.title, author: pack.author ?? '', description: pack.description ?? '', ...('family' in pack ? { family: pack.family } : {}), items };
}
/** The collection's index, packs sorted by kind then title. */
export function communityIndex(entries: CommunityEntry[]): CommunityIndex {
  return { v: 1, packs: [...entries].sort((a, b) => a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title)) };
}
