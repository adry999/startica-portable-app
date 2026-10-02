// §5.2 (PROMPT-CLAUDE-CODE-10.md §8 Partea 2, docs/design/screens/32-actualizari.md): descarcă
// instalerul anunțat de update-check.service.mjs în <home>\Actualizari, verifică SHA-256 (D-8:
// un fișier corupt sau falsificat nu are voie să rămână pe disc ca „gata de instalat”), și ține
// minte — într-o cheie de settings, nu doar pe disc — care versiune verificată e gata să ruleze
// la următoarea închidere (main.mjs/create-application.mjs, quit-time spawn).
import { createWriteStream, existsSync, mkdirSync, renameSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { UPDATE_DIR_NAME } from '#config/environment.mjs';
import { sha256Hex } from '#core/server/persistence/content-digest.mjs';
import { removeFileIfPresent } from '#core/server/files/remove-file-if-present.mjs';

// Chei de settings (convenția SYNC_LAST_SERVER_URL_SETTING din sync-connect.service.mjs) —
// ținute pe baza COMUNĂ (create-application.mjs), nu pe o filială: actualizarea e per
// instalare, nu per filială activă, la fel ca updateChecker însuși.
export const UPDATE_PENDING_VERSION_SETTING = 'updatePendingVersion';
export const UPDATE_PENDING_FILE_SETTING = 'updatePendingFile';

/** @param {string} downloadUrl */
function fileNameFromUrl(downloadUrl) {
  try {
    const name = new URL(downloadUrl).pathname.split('/').pop();
    return name ? decodeURIComponent(name) : 'Startica_Setup.exe';
  } catch {
    return 'Startica_Setup.exe';
  }
}

/**
 * @param {{
 *   home: string,
 *   fetch?: typeof fetch,
 *   readSetting: (key: string) => string,
 *   writeSetting: (key: string, value: string) => void,
 *   mkdirSyncFn?: typeof mkdirSync,
 * }} dependencies
 */
export function createUpdateDownloadService({
  home,
  fetch: fetchImpl = globalThis.fetch,
  readSetting,
  writeSetting,
  mkdirSyncFn = mkdirSync,
}) {
  function directory() {
    const dir = join(home, UPDATE_DIR_NAME);
    mkdirSyncFn(dir, { recursive: true });
    return dir;
  }

  /**
   * Descarcă `downloadUrl` în `<home>\Actualizari\<nume>`, verifică SHA-256 față de cel din
   * manifest și, doar la succes, reține versiunea+calea ca „gata de instalat”. Nu aruncă
   * niciodată — un eșec de rețea/verificare înseamnă „cardul 37a rămâne, cu link manual”
   * (32-actualizari.md), nu o eroare care oprește restul aplicației.
   * @param {{ downloadUrl: string | null, sha256: string | null, version: string }} args
   * @returns {Promise<{ ok: true, file: string, version: string } | { ok: false, error: string }>}
   */
  async function downloadAndVerify({ downloadUrl, sha256, version }) {
    if (!downloadUrl || !sha256)
      return { ok: false, error: 'Lipsește adresa de descărcare sau suma de control (SHA-256) din manifest.' };
    const dir = directory();
    const file = join(dir, fileNameFromUrl(downloadUrl));
    const temp = file + '.tmp';
    let response;
    try {
      response = await fetchImpl(downloadUrl);
    } catch (error) {
      return { ok: false, error: 'Descărcarea a eșuat: ' + /** @type {Error} */ (error).message };
    }
    if (!response.ok || !response.body) return { ok: false, error: `Descărcarea a eșuat (HTTP ${response.status}).` };
    try {
      await pipeline(
        /** @type {any} */ (Readable.fromWeb(/** @type {any} */ (response.body))),
        createWriteStream(temp),
      );
    } catch (error) {
      removeFileIfPresent(temp);
      return { ok: false, error: 'Scrierea pe disc a eșuat: ' + /** @type {Error} */ (error).message };
    }
    // D-8: comparare în timp constant nu e necesară aici (nu e un secret — e o sumă de control
    // publică, din manifestul semnat doar prin faptul că vine de pe GitHub Releases).
    const actual = sha256Hex(/** @type {any} */ (await readFile(temp)));
    if (actual !== sha256.toLowerCase()) {
      removeFileIfPresent(temp);
      return { ok: false, error: 'Fișierul descărcat nu corespunde sumei de control (SHA-256) — a fost șters.' };
    }
    removeFileIfPresent(file); // o versiune verificată anterioară, cu același nume de fișier
    renameSync(temp, file);
    writeSetting(UPDATE_PENDING_VERSION_SETTING, version);
    writeSetting(UPDATE_PENDING_FILE_SETTING, file);
    return { ok: true, file, version };
  }

  /**
   * Actualizarea verificată, gata de instalat — `null` dacă nu există nicio versiune gata
   * (nicio descărcare încă, sau fișierul a dispărut de pe disc între timp).
   * @returns {{ version: string, file: string } | null}
   */
  function pendingUpdate() {
    const version = readSetting(UPDATE_PENDING_VERSION_SETTING);
    const file = readSetting(UPDATE_PENDING_FILE_SETTING);
    if (!version || !file || !existsSync(file)) return null;
    return { version, file };
  }

  /** După ce instalerul a fost lansat la închidere (quit-time spawn) — nu are rost să-l mai
   * lanseze din nou la următoarea pornire, dacă procesul anterior nu s-a oprit curat. */
  function clearPending() {
    writeSetting(UPDATE_PENDING_VERSION_SETTING, '');
    writeSetting(UPDATE_PENDING_FILE_SETTING, '');
  }

  return { downloadAndVerify, pendingUpdate, clearPending };
}
