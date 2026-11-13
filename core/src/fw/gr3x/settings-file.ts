// SPDX-License-Identifier: GPL-2.0-only
/**
 * GR III 2.10 / IIIx 1.60, the settings file (T-SET1, version 0.9.8): « Save Settings to Card » in Setup
 * writes every camera setting to C:\GRFILM.SET, the card's root.
 *
 *  - The file system (docs/film-mode-notes.md, image des réglages) : the singleton 0x53594d74()'s
 *    + 0x14, a table of methods: + 0x14 (fs, "C:", 0) a card there, + 0x1c (fs, path, mode, &handle, 0)
 *    open (mode 0 write, as the camera's C:\BLE_RF.txt dump), + 0x28 (fs, handle, buffer, size, 0)
 *    write, + 0x20 (fs, handle, 0) close.
 *  - The file: a header (GR3X_SETTINGS_HEADER bytes), then the record in use and the eight stored
 *    records (0x55063f34, 0x55063f38 + 4 n), GR3X_SETTINGS_RECORD bytes each, each followed by the
 *    32-bit sum of its bytes. Header: 'GRFS', format version, record size, record count, model (1 GR III,
 *    2 GR IIIx), GR Mod Film's version (8 ASCII bytes, zero-padded).
 *  - Run as the Execute of Create New Folder's dialog (film-roll.ts, its mode byte 2); a failure (no card,
 *    a record not in RAM, the file not opened or not written) sets the byte to 3, so that the dialog's
 *    end text says so.
 */
import { FirmwareError } from '../types';
import { GR3X_APP_DATA, GR3X_APP_DATA_WRITE, GR3X_ROLL_FRAME } from './film-roll';

const lo = (v: number) => v & 0xffff, hi = (v: number) => v >>> 16;

/** The Setup lines' ids (unused; after Hide Settings' 0x020001d0): Save Settings to Card, Load Settings from Card (T-SET2). */
export const GR3X_SETTINGS_ID = 0x020001d1, GR3X_SETTINGS_LOAD_ID = 0x020001d2;
export const GR3X_SETTINGS_PATH = 'C:\\GRFILM.SET';
export const GR3X_SETTINGS_MAGIC = 'GRFS', GR3X_SETTINGS_FORMAT = 1;
/** GR Mod Film's version written in the file by the builds of this program (the root package.json's, kept equal by a test). */
export const GR3X_SETTINGS_PROGRAM_VERSION = '0.9.9';
export const GR3X_SETTINGS_HEADER = 0x20, GR3X_SETTINGS_RECORD = 0xb28, GR3X_SETTINGS_COUNT = 9;
export const GR3X_SETTINGS_MODELS = { gr3: 1, gr3x: 2 } as const;
/** The four texts in `LANGS` order (cs da en fi fr de el hu it ja ko nl pl pt ru zh-CN es sv th zh-TW tr): the Setup line,
 * the dialog's question, its end text after a save and after a failure. Every character is one the camera's texts of
 * that language already show (checked in the emulator). */
export const GR3X_SETTINGS_TEXTS = {
  line: ['Uložit nastavení na kartu', 'Gem indstil. på kort', 'Save Settings to Card', 'Tallenna asetukset korttiin', 'Enreg. réglages sur carte', 'Einst. auf Karte speichern', 'Αποθήκ. ρυθμίσεων στην κάρτα', 'Beáll. mentése kártyára', 'Salva impost. su scheda', '設定をカードに保存', '설정을 카드에 저장', 'Instell. opslaan op kaart', 'Zapisz ustaw. na karcie', 'Guardar defin. no cartão', 'Сохр. настройки на карту', '保存设置到存储卡', 'Guardar ajustes en tarjeta', 'Spara inst. på kortet', 'บันทึกการตั้งค่าลงการ์ด', '設定存入記憶卡', 'Ayarları karta kaydet'],
  question: ['Uložit nastavení na kartu?', 'Gem indstillinger på kortet?', 'Save the settings to the card?', 'Tallennetaanko asetukset korttiin?', 'Enregistrer les réglages sur la carte ?', 'Einstellungen auf Karte speichern?', 'Αποθήκευση ρυθμίσεων στην κάρτα', 'Menti a beállításokat a kártyára?', 'Salvare le impostazioni sulla scheda?', '設定をカードに保存します', '설정을 카드에 저장', 'Instellingen opslaan op de kaart?', 'Zapisać ustawienia na karcie?', 'Guardar as definições no cartão?', 'Сохранить настройки на карту?', '将设置保存到存储卡', 'Guardar los ajustes en la tarjeta?', 'Spara inställningarna på kortet?', 'บันทึกการตั้งค่าลงการ์ดหรือไม่', '將設定存入記憶卡', 'Ayarlar karta kaydedilsin mi?'],
  done: ['Nastavení uloženo.', 'Indstillinger gemt.', 'Settings saved.', 'Asetukset tallennettu.', 'Réglages enregistrés.', 'Einstellungen gespeichert.', 'Οι ρυθμίσεις αποθηκεύτηκαν.', 'Beállítások mentve.', 'Impostazioni salvate.', '設定を保存しました', '설정이 저장되었습니다.', 'Instellingen opgeslagen.', 'Ustawienia zapisane.', 'Definições guardadas.', 'Настройки сохранены.', '设置已保存', 'Ajustes guardados.', 'Inställningar sparade.', 'บันทึกการตั้งค่าแล้ว', '設定已存入', 'Ayarlar kaydedildi.'],
  failed: ['Nastavení nebylo uloženo.', 'Indstillinger ikke gemt.', 'Settings not saved.', 'Asetuksia ei tallennettu.', 'Réglages non enregistrés.', 'Einstellungen nicht gespeichert.', 'Οι ρυθμίσεις δεν αποθηκεύτηκαν.', 'A beállítások nincsenek mentve.', 'Impostazioni non salvate.', '設定を保存できませんでした', '설정을 저장하지 못했습니다.', 'Instellingen niet opgeslagen.', 'Ustawienia nie zostały zapisane.', 'Definições não guardadas.', 'Настройки не сохранены.', '设置未保存', 'Ajustes no guardados.', 'Inställningar inte sparade.', 'ไม่ได้บันทึกการตั้งค่า', '設定未存入', 'Ayarlar kaydedilmedi.'],
} as const;
/** T-SET2's four texts, in the same order: the Load line, its question, its end text after a load (restart the camera)
 * and after a failure. Every character is one the camera's texts of that language already show (checked in the emulator). */
export const GR3X_SETTINGS_LOAD_TEXTS = {
  line: ["Načíst nastavení z karty", "Hent indstil. fra kort", "Load Settings from Card", "Lataa asetukset kortilta", "Charger réglages carte", "Einst. von Karte laden", "Φόρτωση ρυθμίσεων κάρτας", "Beáll. betöltése kártyáról", "Carica impost. da scheda", "カードの設定を適用", "카드에서 설정 불러오기", "Instell. laden van kaart", "Wczytaj ustaw. z karty", "Carregar defin. do cartão", "Загр. настройки с карты", "应用存储卡中的设置", "Cargar ajustes de tarjeta", "Läs in inst. från kort", "โหลดการตั้งค่าจากการ์ด", "套用記憶卡中的設定", "Ayarları karttan yükle"],
  question: ["Načíst nastavení z karty?", "Hent indstillinger fra kortet?", "Load the settings from the card?", "Ladataanko asetukset kortilta?", "Charger les réglages de la carte ?", "Einstellungen von Karte laden?", "Φόρτωση ρυθμίσεων από την κάρτα", "Betölti a beállításokat a kártyáról?", "Caricare le impostazioni dalla scheda?", "カードの設定を適用します", "카드에서 설정 불러오기", "Instellingen laden van de kaart?", "Wczytać ustawienia z karty?", "Carregar as definições do cartão?", "Загрузить настройки с карты?", "应用存储卡中的设置", "Cargar los ajustes de la tarjeta?", "Läsa in inställningar från kortet?", "โหลดการตั้งค่าจากการ์ด", "套用記憶卡中的設定", "Ayarlar karttan yüklensin mi?"],
  done: ["Načteno. Restartujte fotoaparát.", "Hentet. Genstart kameraet.", "Loaded. Restart the camera.", "Ladattu. Käynnistä kamera uudelleen.", "Chargé. Redémarrez l'appareil.", "Geladen. Kamera neu starten.", "Φορτώθηκε. Επανεκκινήστε τη φωτογρ. μηχανή.", "Betöltve. Indítsa újra a fényképezőgépet.", "Caricato. Riavviare la fotocamera.", "適用しました。カメラを再起動してください", "불러오기 완료. 카메라를 다시 켜십시오.", "Geladen. Start de camera opnieuw.", "Wczytano. Uruchom aparat ponownie.", "Carregado. Reinicie a câmara.", "Загружено. Перезапустите камеру.", "已应用。请重新启动相机", "Cargado. Reinicie la cámara.", "Inläst. Starta om kameran.", "โหลดแล้ว รีสตาร์ทกล้อง", "已套用。請重新啟動相機", "Yüklendi. Fotoğraf makinesini yeniden başlatın."],
  failed: ["Nastavení nebylo načteno.", "Indstillinger ikke hentet.", "Settings not loaded.", "Asetuksia ei ladattu.", "Réglages non chargés.", "Einstellungen nicht geladen.", "Οι ρυθμίσεις δεν φορτώθηκαν.", "A beállítások nincsenek betöltve.", "Impostazioni non caricate.", "設定を適用できませんでした", "설정을 불러오지 못했습니다.", "Instellingen niet geladen.", "Ustawienia nie zostały wczytane.", "Definições não carregadas.", "Настройки не загружены.", "设置未应用", "Ajustes no cargados.", "Inställningar inte inlästa.", "ไม่ได้โหลดการตั้งค่า", "設定未套用", "Ayarlar yüklenmedi."],
} as const;
const FS_SINGLETON = 0x53594d74, POINTER = 0x55063f34, STORED = 0x55063f38;

export interface Gr3xSettingsProgram {
  code(source: string): number;
  append(bytes: Uint8Array): number;
  u32(address: number): number;
}

/** The header the camera writes (its version field: the program's version, cut to 8 bytes). */
export function gr3xSettingsHeader(model: keyof typeof GR3X_SETTINGS_MODELS, version: string): Uint8Array {
  const h = new Uint8Array(GR3X_SETTINGS_HEADER), v = new DataView(h.buffer);
  h.set(new TextEncoder().encode(GR3X_SETTINGS_MAGIC), 0);
  v.setUint16(4, GR3X_SETTINGS_FORMAT, true); v.setUint16(6, GR3X_SETTINGS_RECORD, true); v.setUint16(8, GR3X_SETTINGS_COUNT, true);
  v.setUint16(10, GR3X_SETTINGS_MODELS[model], true);
  const ver = new TextEncoder().encode(version).subarray(0, 8);
  if (/[^ -~]/.test(version)) throw new FirmwareError('bad-edit', 'IIIx settings file: the version must be ASCII');
  h.set(ver, 12);
  return h;
}

/**
 * The save: `fail` is the dialog's mode byte (set to 3 on a failure). Every register the camera may
 * still need is kept (r4..r11).
 */
export function installGr3xSettingsSave(p: Gr3xSettingsProgram, fail: number, model: keyof typeof GR3X_SETTINGS_MODELS, version: string) {
  if (p.u32(FS_SINGLETON) !== 0xe1a0c00d) throw new FirmwareError('unexpected-layout', 'IIIx settings file: the file system');
  const entries: Record<string, number> = {};
  const path = p.append(new Uint8Array([...new TextEncoder().encode(GR3X_SETTINGS_PATH), 0]));
  const drive = p.append(new Uint8Array([...new TextEncoder().encode('C:'), 0]));
  const header = p.append(gr3xSettingsHeader(model, version));
  const ram = (r: string, label: string) => `cmp ${r},#0x40000000;blo ${label};cmp ${r},#0xc0000000;bhs ${label};tst ${r},#3;bne ${label};`;
  // Stack: [sp] the fifth argument (0), [sp + 4] the handle, [sp + 8] a record's sum (`put`, r2 the buffer,
  // r3 its size: its own fifth argument, the handle at its sp + 20). r4 the file system, r5 the record's index, r6 its address.
  entries.settingsSave = p.code(`push {r4,r5,r6,r7,r8,lr};sub sp,sp,#16;mov r0,#0;str r0,[sp];str r0,[sp,#4];
    bl #${FS_SINGLETON};ldr r4,[r0,#0x14];${ram('r4', 'failed')}
    ldr r3,[r4];mov r0,r4;movw r1,#${lo(drive)};movt r1,#${hi(drive)};mov r2,#0;ldr r3,[r3,#0x14];mov lr,pc;bx r3;cmp r0,#0;beq failed;
    mov r0,r4;movw r1,#${lo(path)};movt r1,#${hi(path)};mov r2,#0;add r3,sp,#4;mov r7,#0;str r7,[sp];ldr ip,[r4];ldr ip,[ip,#0x1c];mov lr,pc;bx ip;cmp r0,#0;beq failed;
    movw r2,#${lo(header)};movt r2,#${hi(header)};mov r3,#${GR3X_SETTINGS_HEADER};bl put;cmp r0,#0;beq close;
    mov r5,#0;
    each:cmp r5,#0;movweq r0,#${lo(POINTER)};movteq r0,#${hi(POINTER)};ldreq r6,[r0];
    subne r0,r5,#1;movwne r1,#${lo(STORED)};movtne r1,#${hi(STORED)};ldrne r6,[r1,r0,lsl #2];
    ${ram('r6', 'close')}
    mov r2,r6;movw r3,#${GR3X_SETTINGS_RECORD};bl put;cmp r0,#0;beq close;
    mov r0,#0;mov r1,#0;movw r3,#${GR3X_SETTINGS_RECORD};sum:ldrb r2,[r6,r1];add r0,r0,r2;add r1,r1,#1;cmp r1,r3;blo sum;str r0,[sp,#8];
    add r2,sp,#8;mov r3,#4;bl put;cmp r0,#0;beq close;
    add r5,r5,#1;cmp r5,#${GR3X_SETTINGS_COUNT};blo each;mov r8,#1;b closing;
    close:mov r8,#0;
    closing:ldr r3,[r4];mov r0,r4;ldr r1,[sp,#4];mov r2,#0;ldr r3,[r3,#0x20];mov lr,pc;bx r3;cmp r8,#0;bne done;
    failed:movw r0,#${lo(fail)};movt r0,#${hi(fail)};mov r1,#3;strb r1,[r0];
    done:mov r0,#1;add sp,sp,#16;pop {r4,r5,r6,r7,r8,pc};
    put:push {r7,lr};sub sp,sp,#8;mov ip,#0;str ip,[sp];ldr r1,[sp,#20];mov r0,r4;ldr ip,[r4];ldr ip,[ip,#0x28];mov lr,pc;bx ip;add sp,sp,#8;pop {r7,pc};`);
  return entries;
}

/** The records loaded (T-SET2): the record in use and the stored ones 0..6; the file's ninth (stored 7, the
 * camera's factory record, found empty) is left as it is. Saved as the camera does (app data index 1 for the
 * record in use, 2 + n for stored n, 0xb26 bytes). */
const LOADED = 8, SAVED_SIZE = 0xb26;

/**
 * T-SET2, « Load Settings from Card »: run as the dialog's Execute in mode 4; a failure sets the mode byte to 5.
 *  1. checks before any change: a card, every record pointer in RAM, the file opened (mode 1), its header
 *     ('GRFS', format 1, the record size and count, this camera's model) and every record's sum (read in
 *     0x100-byte pieces on the stack, the file then closed);
 *  2. the file opened again, each record read into its place (the ninth read and dropped);
 *  3. each loaded record's roll rewound (frame 0) and saved. The camera reads its settings again at the
 *     next power-on (the dialog's end text asks for it), where GR Mod's guard checks every value.
 */
export function installGr3xSettingsLoad(p: Gr3xSettingsProgram, fail: number, model: keyof typeof GR3X_SETTINGS_MODELS) {
  if (p.u32(FS_SINGLETON) !== 0xe1a0c00d) throw new FirmwareError('unexpected-layout', 'IIIx settings file: the file system');
  const entries: Record<string, number> = {};
  const path = p.append(new Uint8Array([...new TextEncoder().encode(GR3X_SETTINGS_PATH), 0]));
  const drive = p.append(new Uint8Array([...new TextEncoder().encode('C:'), 0]));
  const ram = (r: string, label: string) => `cmp ${r},#0x40000000;blo ${label};cmp ${r},#0xc0000000;bhs ${label};tst ${r},#3;bne ${label};`;
  const call = (off: number) => `ldr ip,[r4];ldr ip,[ip,#${off}];mov lr,pc;bx ip;`;
  // r5 = the address of record k (0: in use, 1..7: stored k - 1); r10 gets it (0 for the ninth).
  const target = `cmp r5,#0;movweq r0,#${lo(POINTER)};movteq r0,#${hi(POINTER)};ldreq r10,[r0];
    subne r0,r5,#1;movwne r1,#${lo(STORED)};movtne r1,#${hi(STORED)};ldrne r10,[r1,r0,lsl #2];cmp r5,#${LOADED};movhs r10,#0;`;
  // Stack: [sp] spare, [sp + 4] the handle, [sp + 8] the error word, [sp + 0x20] a 0x100-byte buffer.
  entries.settingsLoad = p.code(`push {r4,r5,r6,r7,r8,r9,r10,lr};sub sp,sp,#0x120;mov r0,#0;str r0,[sp,#4];str r0,[sp,#8];
    bl #${FS_SINGLETON};ldr r4,[r0,#0x14];${ram('r4', 'failed')}
    mov r0,r4;movw r1,#${lo(drive)};movt r1,#${hi(drive)};mov r2,#0;${call(0x14)}cmp r0,#0;beq failed;
    mov r5,#0;ptrs:${target}${ram('r10', 'failed')}add r5,r5,#1;cmp r5,#${LOADED};blo ptrs;
    bl openr;cmp r0,#0;beq failed;
    add r2,sp,#0x20;mov r3,#${GR3X_SETTINGS_HEADER};bl get;cmp r0,#0;beq bad;
    ldr r0,[sp,#0x20];movw r1,#0x5247;movt r1,#0x5346;cmp r0,r1;bne bad;
    ldrh r0,[sp,#0x24];cmp r0,#${GR3X_SETTINGS_FORMAT};bne bad;ldrh r0,[sp,#0x26];movw r1,#${GR3X_SETTINGS_RECORD};cmp r0,r1;bne bad;
    ldrh r0,[sp,#0x28];cmp r0,#${GR3X_SETTINGS_COUNT};bne bad;ldrh r0,[sp,#0x2a];cmp r0,#${GR3X_SETTINGS_MODELS[model]};bne bad;
    mov r5,#0;
    check:mov r6,#0;movw r7,#${GR3X_SETTINGS_RECORD};
    piece:cmp r7,#0;beq sum;mov r8,#0x100;cmp r7,r8;movlo r8,r7;add r2,sp,#0x20;mov r3,r8;bl get;cmp r0,#0;beq bad;
    mov r1,#0;add r9,sp,#0x20;add1:ldrb r2,[r9,r1];add r6,r6,r2;add r1,r1,#1;cmp r1,r8;blo add1;sub r7,r7,r8;b piece;
    sum:add r2,sp,#0x20;mov r3,#4;bl get;cmp r0,#0;beq bad;ldr r0,[sp,#0x20];cmp r0,r6;bne bad;
    add r5,r5,#1;cmp r5,#${GR3X_SETTINGS_COUNT};blo check;
    bl closef;
    bl openr;cmp r0,#0;beq failed;
    add r2,sp,#0x20;mov r3,#${GR3X_SETTINGS_HEADER};bl get;cmp r0,#0;beq bad;
    mov r5,#0;
    load:${target}cmp r10,#0;beq drop;mov r2,r10;movw r3,#${GR3X_SETTINGS_RECORD};bl get;cmp r0,#0;beq bad;b loaded;
    drop:movw r7,#${GR3X_SETTINGS_RECORD};
    dpiece:cmp r7,#0;beq loaded;mov r8,#0x100;cmp r7,r8;movlo r8,r7;add r2,sp,#0x20;mov r3,r8;bl get;cmp r0,#0;beq bad;sub r7,r7,r8;b dpiece;
    loaded:add r2,sp,#0x20;mov r3,#4;bl get;cmp r0,#0;beq bad;
    add r5,r5,#1;cmp r5,#${GR3X_SETTINGS_COUNT};blo load;
    bl closef;
    mov r5,#0;
    keep:${target}mov r0,#0;strb r0,[r10,#${GR3X_ROLL_FRAME}];
    bl #${GR3X_APP_DATA};ldr r0,[r0,#8];cmp r5,#0;moveq r1,#1;addne r1,r5,#1;movw r2,#${SAVED_SIZE};mov r3,r10;bl #${GR3X_APP_DATA_WRITE};
    add r5,r5,#1;cmp r5,#${LOADED};blo keep;
    b done;
    bad:bl closef;
    failed:movw r0,#${lo(fail)};movt r0,#${hi(fail)};mov r1,#5;strb r1,[r0];
    done:mov r0,#1;add sp,sp,#0x120;pop {r4,r5,r6,r7,r8,r9,r10,pc};
    openr:push {r7,lr};sub sp,sp,#8;add ip,sp,#24;str ip,[sp];mov r0,r4;movw r1,#${lo(path)};movt r1,#${hi(path)};mov r2,#1;add r3,sp,#20;${call(0x1c)}add sp,sp,#8;pop {r7,pc};
    get:push {r7,lr};sub sp,sp,#8;add ip,sp,#24;str ip,[sp];ldr r1,[sp,#20];mov r0,r4;${call(0x24)}add sp,sp,#8;pop {r7,pc};
    closef:push {r7,lr};ldr r1,[sp,#12];mov r0,r4;mov r2,#0;${call(0x20)}pop {r7,pc};`);
  return entries;
}

export interface Gr3xSettingsFile { model: 'gr3' | 'gr3x'; version: string; records: Uint8Array[] }

/** Reads and checks a settings file (the program, T-SET3): header, size, each record's sum. */
export function readGr3xSettingsFile(file: Uint8Array): Gr3xSettingsFile {
  const bad = (what: string): never => { throw new FirmwareError('bad-edit', `settings file: ${what}`); };
  if (file.length < GR3X_SETTINGS_HEADER) bad('too short');
  const v = new DataView(file.buffer, file.byteOffset, file.byteLength);
  if (new TextDecoder().decode(file.subarray(0, 4)) !== GR3X_SETTINGS_MAGIC) bad('not a GR Mod Film settings file');
  if (v.getUint16(4, true) !== GR3X_SETTINGS_FORMAT) bad('unknown format version');
  const size = v.getUint16(6, true), count = v.getUint16(8, true), model = v.getUint16(10, true);
  if (size !== GR3X_SETTINGS_RECORD || count !== GR3X_SETTINGS_COUNT) bad('unknown layout');
  const name = model === GR3X_SETTINGS_MODELS.gr3 ? 'gr3' : model === GR3X_SETTINGS_MODELS.gr3x ? 'gr3x' : bad('unknown model');
  if (file.length !== GR3X_SETTINGS_HEADER + count * (size + 4)) bad('wrong length');
  const records = Array.from({ length: count }, (_, k) => {
    const at = GR3X_SETTINGS_HEADER + k * (size + 4), r = file.slice(at, at + size);
    if (r.reduce((a, b) => (a + b) >>> 0, 0) !== v.getUint32(at + size, true)) bad(`record ${k} damaged`);
    return r;
  });
  const version = new TextDecoder().decode(file.subarray(12, 20)).replace(/\0+$/, '');
  return { model: name, version, records };
}
