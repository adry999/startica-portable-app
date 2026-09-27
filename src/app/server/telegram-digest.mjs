import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvironment, dataLayout, BRANCH_REGISTRY_FILE_NAME } from '#config/environment.mjs';
import { isoDateOf } from '#shared/domain/calendar-month.mjs';
import { clampNotificationPreferences, isDigestRunTooLate } from '#shared/domain/notification-preferences.mjs';
import { openDatabaseReadOnly } from '#core/server/database/sqlite-connection.mjs';
import { createRecordRepository } from '#core/server/persistence/record-repository.mjs';
import { readSettingValue } from '#core/server/settings/settings-repository.mjs';
import { createRotatingLogFile } from '#core/server/files/rotating-log-file.mjs';
import { readBranchRegistry } from '#core/server/branches/branch-registry.mjs';
import { branchDirectories } from '#core/server/branches/branch-layout.mjs';
import { listUpcomingBirthdays } from '#features/children/index.server.mjs';
import { countVisitsForDays } from '#features/visits/index.server.mjs';
import { evaluateChildrenForMonth } from '#features/billing/index.server.mjs';
import {
  readTelegramConfig,
  readTelegramState,
  writeTelegramState,
  createTelegramService,
  classifyTelegramFailure,
  buildDailyDigest,
  pruneSentKeys,
} from '#features/telegram-notify/index.server.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

function resolveHome(home) {
  if (home) return home;
  return loadEnvironment().home || ROOT;
}

function defaultLog(home) {
  const logDir = dataLayout(home).logDir;
  const file = join(logDir, 'telegram.log');
  mkdirSync(logDir, { recursive: true });
  return createRotatingLogFile({ file });
}

// Un rând `notificationPreferences` corupt revine tăcut la implicite în orice alt
// apelant (formularul de setări nu are un jurnal la care să scrie), dar aici
// contează: un operator cu preferințe resetate misterios n-are altă urmă (audit 2026-09-22).
/**
 * @param {string | undefined} raw
 * @param {{ write(level: string, message: string): void }} log
 */
function readNotificationPreferences(raw, log) {
  if (!raw) return clampNotificationPreferences(null);
  try {
    return clampNotificationPreferences(JSON.parse(raw));
  } catch (error) {
    log.write(
      'WARN',
      `Preferințe de notificare corupte, folosesc implicitele: ${/** @type {Error} */ (error).message}`,
    );
    return clampNotificationPreferences(null);
  }
}

/**
 * Rezumatul unei singure filiale — corpul de până la Faza 6, cu `dataDir`
 * primit direct (îl calculează apelantul, per filială) în loc de `home`.
 * Cu `branchName` dat, jurnalul e prefixat cu ea (mai multe filiale în registru).
 * @param {{ dataDir: string, branchName?: string, now: Date, fetch: typeof fetch, log: { write(level: string, message: string): void } }} params
 * @returns {Promise<number>} codul de ieșire pentru `process.exitCode`
 */
async function runTelegramDigestForBranch({ dataDir, branchName, now, fetch: fetchImpl, log: baseLog }) {
  const log = branchName ? { write: (level, message) => baseLog.write(level, `[${branchName}] ${message}`) } : baseLog;
  try {
    const todayStr = isoDateOf(now);

    const config = readTelegramConfig(dataDir);
    if (!config) {
      log.write('INFO', 'Neconfigurat');
      return 0;
    }
    if (!config.chatId) {
      log.write('INFO', 'Neconectat');
      return 0;
    }

    const state = readTelegramState(dataDir);
    if (Object.hasOwn(state.sentKeys, `zi:${todayStr}`)) {
      log.write('INFO', 'Trimis deja azi');
      return 0;
    }

    const opened = openDatabaseReadOnly({ dataDir });
    if (!opened) {
      log.write('INFO', 'Baza lipsește');
      return 0;
    }

    let records, preferences;
    try {
      records = createRecordRepository(opened.db).readSnapshot();
      // Coloana `value` e mereu text (settings-repository scrie doar string-uri);
      // tipul SQLite generic al node:sqlite nu poate exprima asta.
      preferences = readNotificationPreferences(
        /** @type {string | undefined} */ (readSettingValue(opened.db, 'notificationPreferences')),
        log,
      );
    } catch (error) {
      const message = 'Baza nu a putut fi citită; pornește Startica.';
      log.write('ERROR', `${message} ${/** @type {Error} */ (error)?.stack || error}`);
      writeTelegramState(dataDir, { ...state, lastRun: now.toISOString(), lastError: message });
      return 0;
    } finally {
      // Închisă imediat, înainte de orice apel de rețea: un al doilea proces
      // nu are voie să țină baza deschisă cât timp vorbește cu Telegram.
      opened.db.close();
    }

    // Ora de tăiere e relativă la ora rezumatului (implicit 08:00 + 10h = 18:00);
    // un rezumat de seară nu mai ajută la nimic, a doua zi pleacă normal.
    if (isDigestRunTooLate(now, preferences.digestTime)) {
      log.write('INFO', 'Rezumat ratat: prea târziu pentru azi');
      return 0;
    }

    const birthdays = preferences.birthdaysEnabled
      ? listUpcomingBirthdays(records.children, preferences.birthdaysDaysBefore, todayStr)
      : [];
    const visits = preferences.visitsEnabled
      ? countVisitsForDays(records.visits, todayStr, preferences.visitsHorizonDays).items
      : [];
    const overdue = preferences.overdueEnabled
      ? evaluateChildrenForMonth(records, todayStr.slice(0, 7), todayStr).filter(entry => entry.obligation.notify)
      : [];
    const { text, keys } = buildDailyDigest({
      todayStr,
      birthdays,
      visits,
      overdue,
      sentKeys: state.sentKeys,
      preferences,
    });
    if (!text) {
      log.write('INFO', 'Nimic de semnalat (dezactivat)');
      return 0;
    }

    const telegramService = createTelegramService({ fetch: fetchImpl });
    try {
      await telegramService.sendMessage({ token: config.token, chatId: config.chatId, text });
    } catch (error) {
      const { kind, message } = classifyTelegramFailure(error);
      writeTelegramState(dataDir, { ...state, lastRun: now.toISOString(), lastError: message });
      log.write(kind === 'transient' ? 'WARN' : 'ERROR', message);
      // Tranzitoriu: ieșire 1, ca Task Scheduler să reia; permanent: 0, fără reluări inutile.
      return kind === 'transient' ? 1 : 0;
    }

    const sentKeys = pruneSentKeys(
      { ...state.sentKeys, ...Object.fromEntries(keys.map(key => [key, todayStr])) },
      todayStr,
    );
    const nowIso = now.toISOString();
    writeTelegramState(dataDir, { ...state, sentKeys, lastRun: nowIso, lastSuccess: nowIso, lastError: '' });
    log.write('INFO', `Trimis: ${keys.length} chei`);
    return 0;
  } catch (error) {
    // Un proces programat fără fereastră nu are cui să-i arate o excepție: se
    // termină curat, cu motivul în jurnal, în loc să crape necontrolat.
    log.write('ERROR', `Excepție neașteptată: ${/** @type {Error} */ (error)?.stack || error}`);
    return 0;
  }
}

/**
 * Compune rezumatul zilnic din cele trei feature-uri (§3.3 din specificație)
 * și îl trimite prin Telegram, pentru fiecare filială care are `telegram.json`
 * (decizia 8 din docs/superpowers/plans/2026-09-27-filiale.md — un registru lipsă
 * înseamnă o singură filială, cea migrată, exact comportamentul de dinainte de Faza 6);
 * procesul rulează separat de server, cu Startica închisă.
 * @param {{ home?: string, now?: Date, fetch: typeof fetch, log?: { write(level: string, message: string): void } }} options
 * @returns {Promise<number>} codul de ieșire pentru `process.exitCode` — cel mai mare dintre filiale
 */
export async function runTelegramDigest({ home: homeOption, now = new Date(), fetch: fetchImpl, log: logOption }) {
  const home = resolveHome(homeOption);
  const log = logOption || defaultLog(home);
  const legacy = dataLayout(home);

  /** @type {import('#core/server/branches/branch-registry.mjs').BranchEntry[]} */
  let branches;
  try {
    const registry = readBranchRegistry(join(home, BRANCH_REGISTRY_FILE_NAME));
    branches = registry?.branches?.length
      ? registry.branches
      : [{ id: '', name: '', color: '', address: '', createdAt: '', folder: null }];
  } catch (error) {
    // Un registru corupt oprește pornirea serverului cu mesaj (decizia 4), dar
    // procesul programat nu are cui să-l arate: rămâne fără să trimită nimic azi.
    log.write('ERROR', `Registrul filialelor (filiale.json) este corupt: ${/** @type {Error} */ (error).message}`);
    return 0;
  }

  const multipleBranches = branches.length >= 2;
  let worstExitCode = 0;
  for (const branch of branches) {
    const { dataDir } = branchDirectories({ home, legacy, branch });
    const exitCode = await runTelegramDigestForBranch({
      dataDir,
      branchName: multipleBranches ? branch.name : undefined,
      now,
      fetch: fetchImpl,
      log,
    });
    worstExitCode = Math.max(worstExitCode, exitCode);
  }
  return worstExitCode;
}
