/**
 * GR Mod Film's own switches: the film mode and its film codes, the movie taken out, the rear dial off, Shake Reduction by
 * shutter speed (beta) and the settings file (GRFILM.SET). GR III 2.10 / GR IIIx 1.60, except « no movie », which the
 * GR IV 1.21 (Monochrome 1.11) file has too.
 */
import { readGr3xSettingsFile } from '@grmod/core';
import type { SlotId } from '@grmod/core';
import { t } from '../i18n';
import { State, filmCountChoosable, setSlot, set, shownSlots, state, toast } from './core';
import { scheduleSave } from './families';

/** A film's code: 4 characters A-Z or 0-9 (DCF file names). */
export const FILM_CODE = /^[A-Z0-9]{4}$/;
/** The film mode needs a full GR III / IIIx file (round 10, date imprint stage); it is built on GR III 2.10 / GR IIIx 1.60 only. */
export const filmModeChoosable = (s: State = state): boolean => s.info?.family === 'gr3x' && (s.info.version === '2.10' || s.info.version === '1.60') && !!s.info.features.dateStamp && filmCountChoosable(s);
export function filmModeOn(s: State = state): boolean { return !!s.filmMode && filmModeChoosable(s); }
/** No movie: the GR III 2.10 / GR IIIx 1.60 file, or the GR IV Monochrome 1.11 (GR IV 1.21) file (GR Mod Film 1.2). */
export const noMovieChoosable = (s: State = state): boolean => filmModeChoosable(s) || !!s.info?.features.noMovie;
export function noMovieOn(s: State = state): boolean { return !!s.noMovie && noMovieChoosable(s); }
export function setFilmMode(filmMode: boolean): void {
  if (filmMode && !filmModeChoosable()) return;
  set({ filmMode }); scheduleSave();
}
export function setNoMovie(noMovie: boolean): void {
  if (noMovie && !noMovieChoosable()) return;
  set({ noMovie }); scheduleSave();
}
export function rearDialOffOn(s: State = state): boolean { return !!s.rearDialOff && filmModeChoosable(s); }
export function setRearDialOff(rearDialOff: boolean): void {
  if (rearDialOff && !filmModeChoosable()) return;
  set({ rearDialOff }); scheduleSave();
}
/** Beta (GR Mod Film 1.3.5): Shake Reduction by shutter speed (the lens can still hum on some speeds). */
export function srSpeedOn(s: State = state): boolean { return !!s.srSpeed && filmModeChoosable(s); }
export function setSrSpeed(srSpeed: boolean): void {
  if (srSpeed && !filmModeChoosable()) return;
  set({ srSpeed }); scheduleSave();
}
/** 0.9.7: the camera chooses what it hides (Setup > Hide Settings); the program's former list is kept in projects but no longer built. */
export function hiddenSettingsOn(_s: State = state): Record<string, number> { return {}; }
/** Hide a setting with that value, or show it again (`value` undefined). */
export function setHiddenSetting(key: string, value: number | undefined): void {
  const next = { ...state.hiddenSettings };
  if (value === undefined) delete next[key]; else next[key] = value;
  set({ hiddenSettings: next }); scheduleSave();
}
/** A film's code as typed: upper case, A-Z and 0-9 only, at most 4 characters ('' for none). */
export function setFilmCode(id: SlotId, code: string): void {
  const c = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  setSlot(id, { code: c || undefined }); scheduleSave();
}
/** The film mode's codes of the films built (complete codes only). */
export function filmCodes(s: State = state): Partial<Record<SlotId, string>> {
  return Object.fromEntries(shownSlots(s).map((x) => [x.id, s.slots[x.id]?.code]).filter(([, c]) => typeof c === 'string' && FILM_CODE.test(c as string)));
}
/** A film code being typed and not yet 4 characters long. */
export function filmCodeProblem(id: SlotId, s: State = state): boolean { const c = s.slots[id]?.code; return !!c && !FILM_CODE.test(c); }
/** GR Mod Film's own switches that make a build by themselves. */
export function filmExtrasOn(s: State = state): boolean { return filmModeOn(s) || noMovieOn(s) || rearDialOffOn(s) || srSpeedOn(s); }

// ------------------------------------------------------------------ the settings file (0.9.8)
/** The settings file's name on the card (core GR3X_SETTINGS_PATH, at the root). */
export const SETTINGS_FILE = 'GRFILM.SET';
/** The camera the open firmware is for (the settings file says which it was written by). */
const openModel = (s: State = state): 'gr3' | 'gr3x' | undefined => s.info?.family !== 'gr3x' ? undefined : s.info.filename === 'fwdc243b.bin' ? 'gr3x' : 'gr3';
/** The settings file opened, when it is for the open firmware's camera and the film mode is on (its Load line). */
export function settingsFileFor(s: State = state) {
  return s.settingsFile && filmModeOn(s) && openModel(s) === s.settingsFile.model ? s.settingsFile : null;
}
/** Opens a GRFILM.SET (written by « Save Settings to Card ») and checks it as the camera will. */
export async function loadSettingsFile(f: File): Promise<void> {
  try {
    const data = new Uint8Array(await f.arrayBuffer());
    const got = readGr3xSettingsFile(data);
    set({ settingsFile: { name: f.name, data, model: got.model, version: got.version } });
    const m = openModel();
    if (m && m !== got.model) toast(t('settingsFileOtherModel'), 'info');
  } catch { toast(t('settingsFileBad'), 'error'); }
}
export function clearSettingsFile(): void { set({ settingsFile: null }); }
