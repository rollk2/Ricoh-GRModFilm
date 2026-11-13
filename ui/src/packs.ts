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
export interface RecipePack { format: typeof RECIPES_FORMAT; v: 1; family: PackFamily; recipes: PackRecipe[] }
export interface PackRatio { ratio: string; name: string }
export interface RatioPack { format: typeof RATIOS_FORMAT; v: 1; ratios: PackRatio[] }

export class PackError extends Error {
  code: 'not-a-pack' | 'other-kind' | 'newer' | 'empty';
  constructor(code: PackError['code']) { super(code); this.code = code; }
}

const MAX_RECIPES = 40;
const MAX_RATIOS = 40;
const FILM_CODE = /^[A-Z0-9]{4}$/;
const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');

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

export function makeRecipePack(family: PackFamily, recipes: PackRecipe[]): string {
  const pack: RecipePack = { format: RECIPES_FORMAT, v: 1, family, recipes: recipes.map((r) => cleanRecipe(r)!).filter((r) => !emptyRecipe(r)) };
  return JSON.stringify(pack, null, 1);
}
export function readRecipePack(text: string): RecipePack {
  const d = parse(text, RECIPES_FORMAT);
  const family: PackFamily = d.family === 'gr4' ? 'gr4' : 'gr3';
  const recipes = (Array.isArray(d.recipes) ? d.recipes : []).slice(0, MAX_RECIPES).map(cleanRecipe).filter((r): r is PackRecipe => !!r && !emptyRecipe(r));
  if (recipes.length === 0) throw new PackError('empty');
  return { format: RECIPES_FORMAT, v: 1, family, recipes };
}

const cleanRatio = (r: unknown): PackRatio | null => {
  if (!r || typeof r !== 'object') return null;
  const ratio = str((r as Record<string, unknown>).ratio, 24).trim();
  return ratio ? { ratio, name: str((r as Record<string, unknown>).name, 80) } : null;
};
export function makeRatioPack(ratios: PackRatio[]): string {
  const pack: RatioPack = { format: RATIOS_FORMAT, v: 1, ratios: ratios.map(cleanRatio).filter((r): r is PackRatio => !!r) };
  return JSON.stringify(pack, null, 1);
}
export function readRatioPack(text: string): RatioPack {
  const d = parse(text, RATIOS_FORMAT);
  const ratios = (Array.isArray(d.ratios) ? d.ratios : []).slice(0, MAX_RATIOS).map(cleanRatio).filter((r): r is PackRatio => !!r);
  if (ratios.length === 0) throw new PackError('empty');
  return { format: RATIOS_FORMAT, v: 1, ratios };
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
