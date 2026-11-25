/**
 * GR Mod Film: recipe and ratio packs (export, import with Replace or Add) and the community collection (packs published
 * with the site, shared through GitHub).
 */
import { LANGS, MAX_EXTRA_SLOTS } from '@grmod/core';
import type { LangCode, SlotId } from '@grmod/core';
import { host, onWeb } from '../host';
import { t } from '../i18n';
import { COMMUNITY_LICENSE, emptyRecipe, makeRatioPack, makeRecipePack, mergeRatios, PackError, placeRecipes, RATIOS_EXT, readRatioPack, readRecipePack, RECIPES_EXT } from '../packs';
import type { CommunityEntry, CommunityIndex, PackFamily, PackMeta, PackRecipe } from '../packs';
import { DOWNLOADS } from '../webhost';
import { ExtraSlot, IconState, RatioItem, SlotState, State, availableSlots, choose, emptySlot, fail, filmCountChoosable, monoRecipesOn, set, setSlot, state, toast } from './core';
import { familyOf, presetKey, scheduleSave } from './families';
import { addExtraSlot, decodeText, removeExtraSlot, renderIcon, runPreset, setExtraName, setHalation, setIcon } from './slots';
import { setActiveSlot } from './photo';
import { maxRatios, ratiosChanged, setFilmCount } from './ratios';

/** A file chosen by the user (the browser's file dialog), or null when cancelled. */
function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}
/** Saves a file the user keeps: downloaded on the web site, in a folder chosen in the program. */
async function saveFile(name: string, text: string): Promise<void> {
  const data = new TextEncoder().encode(text);
  const root = onWeb ? DOWNLOADS : await host.pickDirectory(t('pickFolder'));
  if (!root) return;
  try {
    await host.write(host.join(root, name), data);
    toast(onWeb ? t('packDownloaded', { p: name }) : t('exported', { p: host.join(root, name) }), 'ok');
  } catch (e) { fail(e); }
}
const packProblem = (e: unknown): string => t(e instanceof PackError ? (({ 'other-kind': 'packOtherKind', newer: 'packNewer', empty: 'packEmpty', 'not-a-pack': 'packBad' } as const)[e.code]) : 'packBad');

/** A slot with nothing in it (no preset, name, film code, halation level or drawn icon). */
const slotEmpty = (x: SlotState): boolean => !x.preset && !Object.values(x.names).some((n) => n && n.trim()) && !x.code && !(x.halation && x.halation.preview > 0) && x.icon.mode === 'keep';
const packFamily = (s: State = state): PackFamily => (s.model === 'MONO' ? 'gr4mono' : familyOf(s.model) === 'gr3' ? 'gr3' : 'gr4');
/** Where recipes go: every film the firmware can have (GR III / IIIx), or GR IV's two Cinema slots. */
const recipeSlots = (s: State = state): SlotId[] => (s.info ? s.info.slots.map((x) => x.id) : availableSlots(s));

/** An added slot with nothing in it: no preset, no name (a new one already has its « GR<n> » icon). */
const extraEmpty = (x: ExtraSlot): boolean => !x.preset && !x.name.trim();
const packIcon = (i: IconState): PackRecipe['icon'] => ({ mode: i.mode, text: i.text, style: i.style, ...(i.image ? { image: i.image } : {}) });

/** The open work as a recipe pack's text, or null when no film has anything. */
function recipePackText(meta?: PackMeta): string | null {
  const s = state;
  // GR IV Monochrome (1.3): the recipes are the added looks, each with its name, icon and .cube.
  if (s.model === 'MONO') {
    const mono: PackRecipe[] = s.extras.filter((x) => !extraEmpty(x)).map((x) => ({
      names: (x.name.trim() ? { en: x.name.trim() } : {}) as Record<string, string>,
      icon: packIcon(x.icon),
      ...(x.preset && x.preset.kind === 'cube' ? { preset: { fileName: x.preset.fileName, kind: x.preset.kind, text: x.preset.text } } : {}),
    }));
    return mono.length ? makeRecipePack('gr4mono', mono, meta) : null;
  }
  const recipes: PackRecipe[] = availableSlots(s).map((id) => s.slots[id]).filter((x) => !slotEmpty(x)).map((x) => ({
    names: Object.fromEntries(Object.entries(x.names).filter(([, v]) => v && v.trim())) as Record<string, string>,
    ...(x.code ? { code: x.code } : {}),
    ...(x.halation ? { halation: x.halation } : {}),
    icon: { mode: x.icon.mode, text: x.icon.text, style: x.icon.style, ...(x.icon.image ? { image: x.icon.image } : {}) },
    ...(x.preset ? { preset: { fileName: x.preset.fileName, kind: x.preset.kind, text: x.preset.text } } : {}),
  }));
  // GR IV (1.3.2): the added looks too, marked as such.
  if (packFamily(s) === 'gr4' && s.info?.family !== 'gr3x') for (const x of s.extras.filter((e) => !extraEmpty(e))) recipes.push({
    names: (x.name.trim() ? { en: x.name.trim() } : {}) as Record<string, string>,
    ...(x.halation ? { halation: x.halation } : {}),
    icon: packIcon(x.icon),
    ...(x.preset ? { preset: { fileName: x.preset.fileName, kind: x.preset.kind, text: x.preset.text } } : {}),
    added: true,
  });
  return recipes.length ? makeRecipePack(packFamily(s), recipes, meta) : null;
}
export async function exportRecipes(): Promise<void> {
  const text = recipePackText();
  if (!text) { toast(t('packNothing'), 'info'); return; }
  await saveFile(`GR Mod Film recipes${RECIPES_EXT}`, text);
}

/** A recipe pack chosen by the user, or `text` (a pack of the community collection). */
export async function importRecipes(text?: string): Promise<void> {
  if (state.busy) return;
  if (!state.info) { toast(t('packNeedFirmware'), 'info'); return; }
  if (text === undefined) {
    const f = await pickFile(`${RECIPES_EXT},.json`);
    if (!f) return;
    text = decodeText(new Uint8Array(await f.arrayBuffer()));
  }
  let pack;
  try { pack = readRecipePack(text); } catch (e) { toast(packProblem(e), 'error'); return; }
  if (pack.family !== packFamily()) { toast(t('packOtherCamera'), 'error'); return; }
  if (pack.family === 'gr4mono' && !monoRecipesOn()) { toast(t('packOtherCamera'), 'error'); return; }
  // GR IV: the recipes marked as added looks (all of a Monochrome pack) go to the added slots, the others to the Cinema slots.
  const gr4 = pack.family !== 'gr3';
  const toAdded = gr4 ? pack.recipes.filter((r) => pack.family === 'gr4mono' || r.added) : [];
  const toSlots = pack.recipes.filter((r) => !toAdded.includes(r));
  const slots = recipeSlots();
  const filled = (toSlots.length ? availableSlots().filter((id) => !slotEmpty(state.slots[id])).length : 0) + (toAdded.length ? state.extras.filter((x) => !extraEmpty(x)).length : 0);
  let mode: 'replace' | 'add' = 'replace';
  if (filled > 0) {
    const c = await choose(t('packRecipesTitle'), [t('packRecipesLine', { n: pack.recipes.length, m: filled })], t('packReplace'), t('packAdd'));
    if (!c) return;
    mode = c === 'alt' ? 'add' : 'replace';
  }
  let placed = 0; let first: string | undefined;
  if (toSlots.length) {
    // « Add »: only the films shown count as taken, the ones beyond the film count are free.
    const shown = new Set(availableSlots());
    const targets = placeRecipes(slots, (id) => !shown.has(id as SlotId) || slotEmpty(state.slots[id as SlotId]), toSlots.length, mode) as SlotId[];
    if (mode === 'replace') for (const id of slots) { if (!slotEmpty(state.slots[id])) clearSlot(id); }
    else for (const id of targets) clearSlot(id);
    targets.forEach((id, i) => applyRecipe(id, toSlots[i]));
    if (filmCountChoosable()) {
      const last = targets.length ? slots.indexOf(targets[targets.length - 1]) + 1 : 0;
      setFilmCount(mode === 'replace' ? Math.max(1, last) : Math.max(state.filmCount, last));
    }
    placed += targets.length; first = targets[0];
  }
  if (toAdded.length) {
    const r = placeAdded(toAdded, mode);
    placed += r.placed; first ??= r.first;
  }
  if (first) setActiveSlot(first);
  scheduleSave();
  const skipped = pack.recipes.length - placed;
  toast(t('packRecipesDone', { n: placed }) + (skipped ? ` · ${t('packSkipped', { n: skipped })}` : ''), skipped ? 'info' : 'ok');
}
/**
 * GR IV (Monochrome 1.3, colour 1.3.2): a pack's added looks. « Replace » takes the added looks away first, « Add » puts the pack's
 * after them; at most MAX_EXTRA_SLOTS either way.
 */
function placeAdded(recipes: PackRecipe[], mode: 'replace' | 'add'): { placed: number; first?: string } {
  if (mode === 'replace') while (state.extras.length) removeExtraSlot(state.extras[state.extras.length - 1].key);
  else for (const x of [...state.extras]) if (extraEmpty(x)) removeExtraSlot(x.key);
  const room = Math.max(0, MAX_EXTRA_SLOTS - state.extras.length), take = recipes.slice(0, room);
  let first: string | undefined, placed = 0;
  for (const r of take) {
    const before = state.extras.length;
    addExtraSlot();
    if (state.extras.length === before) break;
    const key = state.extras[state.extras.length - 1].key;
    first ??= key; placed++;
    const name = (r.names.en || Object.values(r.names)[0] || '').trim();
    if (name) setExtraName(key, name);
    if (r.icon && r.icon.mode !== 'keep') setIcon(key, { mode: r.icon.mode, text: r.icon.text, style: r.icon.style, image: r.icon.image });
    if (r.halation && !monoRecipesOn()) setHalation(key, r.halation);
    if (r.preset) {
      if (host.available) void host.storeSet(presetKey(key), r.preset.text).catch(() => undefined);
      void runPreset(key, r.preset.fileName, r.preset.kind, r.preset.text);
    }
  }
  return { placed, first };
}
function clearSlot(id: SlotId): void {
  setSlot(id, emptySlot());
  if (host.available) void host.storeDel(presetKey(id)).catch(() => undefined);
}
function applyRecipe(id: SlotId, r: PackRecipe): void {
  if (emptyRecipe(r)) return;
  const names = Object.fromEntries(Object.entries(r.names).filter(([k]) => (LANGS as readonly string[]).includes(k))) as Partial<Record<LangCode, string>>;
  setSlot(id, { names, ...(r.code ? { code: r.code } : {}), ...(r.halation ? { halation: r.halation } : {}),
    icon: r.icon ? { mode: r.icon.mode, text: r.icon.text, style: r.icon.style, ...(r.icon.image ? { image: r.icon.image } : {}) } : emptySlot().icon });
  void renderIcon(id);
  if (r.preset) {
    if (host.available) void host.storeSet(presetKey(id), r.preset.text).catch(() => undefined);
    void runPreset(id, r.preset.fileName, r.preset.kind, r.preset.text);
  }
}

function ratioPackText(meta?: PackMeta): string | null {
  const ratios = state.ratios.filter((r) => r.ratio.trim()).map((r) => ({ ratio: r.ratio.trim(), name: r.name }));
  return ratios.length ? makeRatioPack(ratios, meta) : null;
}
export async function exportRatios(): Promise<void> {
  const text = ratioPackText();
  if (!text) { toast(t('packNothing'), 'info'); return; }
  await saveFile(`GR Mod Film ratios${RATIOS_EXT}`, text);
}
/** A ratio pack chosen by the user, or `text` (a pack of the community collection). */
export async function importRatios(text?: string): Promise<void> {
  if (state.busy) return;
  if (text === undefined) {
    const f = await pickFile(`${RATIOS_EXT},.json`);
    if (!f) return;
    text = decodeText(new Uint8Array(await f.arrayBuffer()));
  }
  let pack;
  try { pack = readRatioPack(text); } catch (e) { toast(packProblem(e), 'error'); return; }
  const existing = state.ratios.filter((r) => r.ratio.trim());
  let mode: 'replace' | 'add' = 'replace';
  if (existing.length > 0) {
    const c = await choose(t('packRatiosTitle'), [t('packRatiosLine', { n: pack.ratios.length, m: existing.length })], t('packReplace'), t('packAdd'));
    if (!c) return;
    mode = c === 'alt' ? 'add' : 'replace';
  }
  const { ratios, skipped } = mergeRatios(existing.map((r) => ({ ratio: r.ratio, name: r.name })), pack.ratios, mode, maxRatios());
  const kept = new Map(existing.map((r) => [r.ratio, r]));
  const next: RatioItem[] = ratios.map((r) => {
    const old = mode === 'add' ? kept.get(r.ratio) : undefined;
    return old ?? { id: Math.random().toString(36).slice(2, 10), ratio: r.ratio, name: r.name };
  });
  set({ ratios: next, activeRatio: next[0]?.id });
  ratiosChanged(true);
  const added = mode === 'add' ? next.length - existing.length : next.length;
  toast(t('packRatiosDone', { n: added }) + (skipped ? ` · ${t('packSkipped', { n: skipped })}` : ''), skipped ? 'info' : 'ok');
}

// ------------------------------------------------------------------ the community collection (1.0)
/** The repository's collection (community/ on GitHub), published with the site. */
export const COMMUNITY_SITE = 'https://rollk2.github.io/Ricoh-GRModFilm/community/';
const COMMUNITY_UPLOAD = 'https://github.com/rollk2/Ricoh-GRModFilm/upload/main/community/';
/** Where the collection is read: beside the page on the site, from the site in the program. */
const communityBase = (): string => (onWeb ? new URL('community/', location.href).href : COMMUNITY_SITE);
export async function loadCommunity(): Promise<CommunityIndex> {
  const r = await fetch(communityBase() + 'index.json', { cache: 'no-cache' });
  if (!r.ok) throw new Error(String(r.status));
  const doc = await r.json() as CommunityIndex;
  return { v: 1, packs: Array.isArray(doc?.packs) ? doc.packs : [] };
}
/** Imports a pack of the collection (Replace or Add, as an import from a file). */
export async function importCommunity(e: CommunityEntry): Promise<void> {
  if (e.kind === 'recipes' && !state.info) { toast(t('packNeedFirmware'), 'info'); return; }
  let text: string;
  try {
    const r = await fetch(communityBase() + e.file, { cache: 'no-cache' });
    if (!r.ok) throw new Error(String(r.status));
    text = await r.text();
  } catch { toast(t('communityNetError'), 'error'); return; }
  if (e.kind === 'recipes') await importRecipes(text); else await importRatios(text);
}
/** True when there is something to share of that kind. */
export const canShare = (kind: 'recipes' | 'ratios'): boolean => !!(kind === 'recipes' ? recipePackText() : ratioPackText());
/**
 * Shares the open work: the pack (with its title, author, description and the collection's licence) is saved,
 * then GitHub's upload page of the collection's folder opens, where the file is dropped and proposed.
 */
export async function sharePack(kind: 'recipes' | 'ratios', meta: { title: string; author: string; description: string }): Promise<void> {
  const full: PackMeta = { ...meta, license: COMMUNITY_LICENSE };
  const text = kind === 'recipes' ? recipePackText(full) : ratioPackText(full);
  if (!text) { toast(t('packNothing'), 'info'); return; }
  const slug = meta.title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'pack';
  await saveFile(slug + (kind === 'recipes' ? RECIPES_EXT : RATIOS_EXT), text);
  await host.openPage(COMMUNITY_UPLOAD + kind);
}
