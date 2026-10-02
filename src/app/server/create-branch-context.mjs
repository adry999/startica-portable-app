import { randomUUID } from 'node:crypto';
import { openDatabase } from '#core/server/database/sqlite-connection.mjs';
import { createSettingsRepository } from '#core/server/settings/settings-repository.mjs';
import { createRecordRepository } from '#core/server/persistence/record-repository.mjs';
import { seedServices } from '#features/services/index.server.mjs';
import { createRevisionTransaction } from '#core/server/persistence/revision-transaction.mjs';
import { createRouteDispatcher } from '#core/server/http/route-dispatcher.mjs';
import { createAuditLogRepository, createAuditLogRoutes, createUndoRoutes } from '#features/audit-log/index.server.mjs';
import { createBackupService, createBackupRoutes } from '#features/backup/index.server.mjs';
import {
  createPaymentAssignmentService,
  createPaymentAssignmentRoutes,
} from '#features/payment-assignment/index.server.mjs';
import { createGroupsRoutes } from '#features/groups/index.server.mjs';
import { createPayerAliasesRoutes } from '#features/payer-aliases/index.server.mjs';
import { createExpenseCategoriesRoutes } from '#features/expenses/index.server.mjs';
import { createFeeSetupRoutes } from '#features/fee-setup/index.server.mjs';
import { createRecordEditingRoutes } from '#features/record-editing/index.server.mjs';
import { createVisitsService, createVisitsRoutes } from '#features/visits/index.server.mjs';
import { createChildrenRoutes } from '#features/children/index.server.mjs';
import { createDataTransferRoutes } from '#features/data-transfer/index.server.mjs';
import { findRecordIssues } from '#features/review-center/index.server.mjs';
import { createTelegramService, createTelegramRoutes } from '#features/telegram-notify/index.server.mjs';
import { createSmsService, createSmsRoutes, createSmsLogRepository } from '#features/sms-notify/index.server.mjs';
import { createAttendanceRoutes, createAttendanceRepository } from '#features/attendance/index.server.mjs';
import {
  createPersonalRoutes,
  createPersonalRepository,
  createCoachPaymentWriter,
  POOL_COACH_ROLE_ID,
} from '#features/personal/index.server.mjs';
import {
  createPoolRepository,
  createPoolRoutes,
  coachPayForMonth,
  parsePoolSettings,
  POOL_SETTINGS_KEY,
} from '#features/pool/index.server.mjs';
import {
  createSyncOutboxRepository,
  createSyncStateRepository,
  createSyncConflictsRepository,
  createOutboxRecordingRepository,
  createChangeSink,
  createSyncAttendanceWriter,
  createSyncPoolWriter,
  createSyncHttpClient,
  createSyncEngine,
  createSyncRoutes,
  createSyncConflictsRoutes,
  createLastSyncedAtTracker,
} from '#features/sync/index.server.mjs';
import { createSessionRoutes } from './session.routes.mjs';
import { createDiagnosticRoutes } from './diagnostic.routes.mjs';
import { createExchangeRatesRoutes } from './exchange-rates.routes.mjs';
import { createNotificationSettingsRoutes } from './notification-settings.routes.mjs';
import { createPlanPresetsRoutes } from './plan-presets.routes.mjs';
import { createKindergartenSettingsRoutes } from './kindergarten-settings.routes.mjs';
import { createReceiptNumberingService, createReceiptNumberingRoutes } from '#features/receipts/index.server.mjs';
import {
  parseExchangeRates,
  clampExchangeRates,
  parseExchangeRateSources,
  clampExchangeRateSources,
} from '#shared/domain/exchange-rates.mjs';
import { fetchBnmEurRate } from './bnm-exchange-rate.mjs';
import { today, shiftDays } from '#shared/domain/calendar-month.mjs';

/** @typedef {import('#core/server/branches/branch-registry.mjs').BranchEntry} BranchEntry */

const EXCHANGE_RATE_BACKFILL_DAYS = 30;

/**
 * Corpul lui `createApplication` de până la Faza 6 (deschiderea bazei,
 * serviciile, rutele, dispatcher-ul HTTP) — extras ca să poată fi rulat de
 * câte ori e nevoie, o dată per filială deschisă, nu doar o dată la pornirea
 * procesului (decizia 2 din docs/superpowers/plans/2026-09-27-filiale.md).
 * @param {{
 *   branch: BranchEntry,
 *   dataDir: string,
 *   backupDir: string,
 *   home: string | undefined,
 *   logFile: string | undefined,
 *   root: string,
 *   version: string,
 *   autoBackupIntervalMs: number,
 *   allowShutdown: boolean,
 *   fetch: typeof fetch,
 *   shutdown: () => void,
 *   listBranches: () => BranchEntry[],
 *   scheduleFile: string,
 *   forbiddenFolders: () => string[],
 *   branchRoutes: import('#core/server/http/route-dispatcher.mjs').RouteDefinition[],
 *   syncDevice?: import('#features/sync/index.server.mjs').SyncDeviceRepository,
 *   common?: import('./create-common-context.mjs').CommonContext,
 *   fullBackupService?: ReturnType<typeof import('#features/backup/index.server.mjs').createFullBackupService>,
 *   restoreFullBackup?: (file: string) => void,
 * }} options
 */
export function createBranchContext({
  branch,
  dataDir,
  backupDir,
  home,
  logFile,
  root,
  version,
  autoBackupIntervalMs,
  allowShutdown,
  fetch: fetchImpl,
  shutdown,
  listBranches,
  scheduleFile,
  forbiddenFolders,
  branchRoutes,
  // Neconfigurat implicit, ca un context construit fără parametrul acesta (dacă
  // vreun test o face direct) să se comporte exact ca o instalare fără sync.json.
  syncDevice = { read: () => null, write: () => {}, clear: () => {} },
  // Baza comună (Personal 24): opțional aici — rutele care o folosesc (Task 3) o
  // cer explicit; un context construit fără el (teste izolate de filială) nu o vede deloc.
  common,
  // 42d: ambele opționale aici — un context de test izolat de filială (fără create-application.mjs
  // în jur) nu are de unde să le primească; createBackupRoutes tratează lipsa lor ca „restaurare
  // de arhivă completă indisponibilă” și păstrează doar fluxul legacy pe un singur `.db`.
  fullBackupService,
  restoreFullBackup,
}) {
  // Per context de filială (deschidere sau schimbare), nu per proces (A-1 din audit): un
  // token unic la nivel de proces era valid pe orice filială, deci o filă rămasă deschisă
  // pe filiala veche (alt tab, sau o rulare anterioară) putea scrie fără să știe în filiala
  // devenită între timp activă. Regenerat de fiecare dată — inclusiv la revenirea pe aceeași
  // filială — ca reîncărcarea să fie obligatorie, nu doar „dacă filiala chiar s-a schimbat”.
  const sessionToken = randomUUID();
  const { db, dbFile } = openDatabase({ dataDir, backupDir });
  // A doua închidere (rută /api/shutdown și apoi app.close(), sau invers, ori
  // schimbarea filialei urmată de închiderea aplicației) ar arunca la o bază deja închisă.
  let databaseClosed = false;
  function closeDatabase() {
    if (databaseClosed) return;
    databaseClosed = true;
    db.close();
  }
  const settings = createSettingsRepository(db);
  // settings.setting citește o coloană SQLite (tip generic în node:sqlite); valorile scrise
  // sunt mereu string (vezi settings-repository.mjs), deci tipul e sigur aici.
  const readSetting = /** @type {(key: string) => string} */ (settings.setting);
  const backups = createBackupService({
    database: db,
    databaseFile: dbFile,
    backupDirectory: backupDir,
    readSetting,
    writeSetting: settings.setSetting,
    autoBackupIntervalMs,
    forbiddenFolders,
  });

  const rawRecordRepository = createRecordRepository(db);
  // 40b: ștampila sesiunii active (nu per proces — vezi comentariul lui sessionToken mai sus),
  // citită de POST /api/undo ca gardă „doar de pe același calculator".
  const auditLogRepository = createAuditLogRepository(db, { sessionToken });

  // Semințele Grădiniță/Bazin (B3) trebuie să existe înainte ca vreo achitare să se poată
  // salva (validarea cere un `service` existent) — sincron, aici, nu în rutele Servicii
  // (care nu există încă la fiecare pornire dacă nimeni nu a deschis fila), la fel ca
  // seedExpenseCategories. Depozitul brut (fără outbox), vezi service-seeding.mjs.
  seedServices({ database: db, recordRepository: rawRecordRepository });

  // Sincronizare (Faza 2 a planului): trei depozite noi pe baza acestei filiale și
  // o singură verificare de activare (sync.json există), partajată de depozitul
  // împachetat mai jos, de changeSink (replaceAllRecords) și de prezență.
  const syncOutboxRepository = createSyncOutboxRepository(db);
  const syncStateRepository = createSyncStateRepository(db);
  const syncConflictsRepository = createSyncConflictsRepository(db);
  const isSyncEnabled = () => !!syncDevice.read();
  const recordRepository = createOutboxRecordingRepository(rawRecordRepository, syncOutboxRepository, isSyncEnabled);
  const syncChangeSink = createChangeSink({ outbox: syncOutboxRepository, isEnabled: isSyncEnabled });
  // A doua instanță, doar pentru cascada de ștergere definitivă a unui copil (B2): aceleași
  // interogări pregătite ca ale rutei /api/attendance, dar fără transformarea acesteia în rută —
  // record-editing.routes.mjs o apelează direct, în tranzacția ei (vezi removeAllForChild).
  const attendanceRepositoryForRecordEditing = createAttendanceRepository(db, {
    onChange: change => syncChangeSink.record(change.kind, change.id, change.payload),
  });

  // Motorul de sincronizare (Faza 3): construit doar dacă acest calculator e conectat
  // (sync.json existent la deschiderea filialei) — o instalare neconfigurată nu are
  // niciun motor, deci nu pornește niciun timer și nu face nicio cerere de rețea
  // (constrângere obligatorie a planului). Reconectarea (Faza 5) reconstruiește
  // contextul filialei, ca un motor nou să se construiască cu noul sync.json.
  const syncAttendanceWriter = createSyncAttendanceWriter(db);
  const syncPoolWriter = createSyncPoolWriter(db);
  /** @type {ReturnType<typeof createSyncEngine> | null} */
  let syncEngine = null;
  // Statusul motorului setului comun (Personal 24, decizia 9) se adună la cel al filialei —
  // `common` poate lipsi doar într-un context de test izolat de filială (vezi mai jos).
  const syncRoutes = createSyncRoutes({
    syncDevice,
    getEngine: () => syncEngine,
    getCommonEngine: () => common?.sync.getEngine() ?? null,
  });
  const syncDeviceFile = syncDevice.read();
  // DECIZII.md punctul 55: persistă lastSyncedAt în sync.json (motorul îl ține doar în
  // memorie) — un singur tracker, ascultat de ambele motoare ale instalării (vezi și
  // create-common-context.mjs), ca „ultima sincronizare” să reflecte oricare dintre ele.
  const lastSyncedAtTracker = createLastSyncedAtTracker({ syncDevice });
  if (syncDeviceFile) {
    syncEngine = createSyncEngine({
      database: db,
      branch,
      rawRecordRepository,
      outbox: syncOutboxRepository,
      syncState: syncStateRepository,
      conflicts: syncConflictsRepository,
      auditTrail: auditLogRepository,
      readSetting,
      writeSetting: settings.setSetting,
      attendanceRepository: syncAttendanceWriter,
      poolRepository: syncPoolWriter,
      backups,
      client: createSyncHttpClient({
        serverUrl: syncDeviceFile.serverUrl,
        token: syncDeviceFile.token,
        fetch: fetchImpl ?? globalThis.fetch,
      }),
      deviceId: syncDeviceFile.deviceId,
      deviceName: syncDeviceFile.deviceName,
      onStatus: status => {
        lastSyncedAtTracker.handleStatus(status);
        syncRoutes.onStatus();
      },
      onRecordsChanged: syncRoutes.onRecordsChanged,
    });
  }

  const { runRevisionTransaction, replaceAllRecords } = createRevisionTransaction({
    database: db,
    // Brut, nu împachetat: runRevisionTransaction îl folosește doar pentru citire
    // (readEnvelope, currentRevision — identice pe raw și pe cel cu outbox), dar
    // replaceAllRecords (restaurare/import) scrie prin el direct — altfel fiecare
    // înregistrare „reapare” ca nouă după DELETE FROM records (raw.find nu mai
    // găsește nimic), inundând outbox-ul cu toată evidența în loc de diferențe (C-2).
    // changeSink de mai jos rămâne calea prin care diferențele reale ajung în outbox.
    recordRepository: rawRecordRepository,
    backups,
    auditTrail: auditLogRepository,
    changeSink: syncChangeSink,
  });

  // Task 9 (14c): rute separate de sync.routes.mjs, ca să nu-l încarce — folosesc
  // aceleași depozite, rezolvarea trece prin runRevisionTransaction ca orice altă
  // scriere (idempotență + verificare de revizie).
  const syncConflictsRoutes = createSyncConflictsRoutes({
    conflicts: syncConflictsRepository,
    outbox: syncOutboxRepository,
    syncState: syncStateRepository,
    rawRecordRepository,
    auditTrail: auditLogRepository,
    runRevisionTransaction,
    getEngine: () => syncEngine,
    // Conflictele setului comun (Personal 24, decizia 9 — kind „staff”) se rezolvă prin
    // aceleași două rute, tăgăduite `dataset: 'comun'` de client.
    common: common
      ? {
          conflicts: common.sync.conflicts,
          outbox: common.sync.outbox,
          state: common.sync.state,
          rawRepository: common.sync.rawRepository,
          auditTrail: common.sync.auditTrail,
          getEngine: common.sync.getEngine,
          runInTransaction: common.sync.runInTransaction,
        }
      : undefined,
  });

  const recordWriteDependencies = { recordRepository, auditTrail: auditLogRepository, runRevisionTransaction };
  const paymentAssignmentService = createPaymentAssignmentService(recordWriteDependencies);
  const receiptNumberingService = createReceiptNumberingService({
    ...recordWriteDependencies,
    readSetting,
    writeSetting: settings.setSetting,
  });
  const visitsService = createVisitsService(recordWriteDependencies);
  // readEnvelope() nu are câmpul „ok” din RevisionEnvelope (nu e rezultatul unei scrieri);
  // rutele de previzualizare citesc doar state/revision/updatedAt din el.
  const readEnvelope = /** @type {() => import('#shared/contracts/persistence.mjs').RevisionEnvelope} */ (
    recordRepository.readEnvelope
  );

  // Bazin (Faza 5-6, 2026-09-27-personal-bazin.md): a doua instanță a depozitului Personal peste
  // aceleași `common.kinds` (idempotentă — semințele se scriu o singură dată, dacă lipsesc), ca
  // Pool să nu importe `#features/personal` (regula „niciun feature nu importă alt feature”) și
  // totuși să plătească antrenorii prin aceeași logică (salary_payments + avansuri) ca Personal.
  const personalRepositoryForPool = common ? createPersonalRepository(common) : null;
  const listCoaches = () =>
    personalRepositoryForPool
      ? personalRepositoryForPool
          .staffForBranch(branch.id)
          .filter(staff => !staff.archivedAt && staff.roleId === POOL_COACH_ROLE_ID)
      : [];
  const coachPaymentWriter = personalRepositoryForPool
    ? createCoachPaymentWriter({
        personalRepository: personalRepositoryForPool,
        branchId: branch.id,
        recordRepository,
        auditTrail: auditLogRepository,
      })
    : null;
  const poolRepository = createPoolRepository(db, {
    onChange: change => syncChangeSink.record(change.kind, change.id, change.payload),
  });
  // Portul citit de Personal (decizia 6): cardul de salariu și „Închide luna” calculează cu
  // aceeași funcție, pe aceleași date — niciodată două formule pentru aceeași sumă.
  const readCoachPayForMonth = (staffId, month) => {
    const settings = parsePoolSettings(readSetting(POOL_SETTINGS_KEY));
    if (!settings) return null;
    const bookings = poolRepository.listBookings({ includeArchived: true });
    const sessions = poolRepository.sessionsForMonth(month);
    return coachPayForMonth({ coachId: staffId, bookings, sessions, month, settings, todayStr: today() });
  };

  const routes = [
    ...createSessionRoutes({
      sessionToken,
      version,
      readEnvelope: recordRepository.readEnvelope,
      backupService: backups,
      commonBackupService: common?.backups,
      allowShutdown: !!allowShutdown,
      shutdown,
      branch,
      listBranches,
      syncDevice,
      poolEnabled: () => !!parsePoolSettings(readSetting(POOL_SETTINGS_KEY))?.enabled,
    }),
    ...createDiagnosticRoutes({
      version,
      home,
      logFile,
      database: dbFile,
      backupDirectory: backupDir,
      readSetting,
      backupService: backups,
      allowShutdown: !!allowShutdown,
      branch,
      listBranches,
    }),
    ...createAuditLogRoutes({ auditLogRepository }),
    ...createUndoRoutes({ auditLogRepository, recordRepository, runRevisionTransaction, sessionToken }),
    ...createPaymentAssignmentRoutes({ paymentAssignmentService }),
    ...createVisitsRoutes({ visitsService }),
    ...createRecordEditingRoutes({
      ...recordWriteDependencies,
      attendanceRepository: attendanceRepositoryForRecordEditing,
    }),
    ...createChildrenRoutes({ ...recordWriteDependencies, readEnvelope }),
    ...createDataTransferRoutes({
      ...recordWriteDependencies,
      replaceAllRecords,
      readEnvelope,
      findRecordIssues,
    }),
    ...createGroupsRoutes(recordWriteDependencies),
    ...createPayerAliasesRoutes(recordWriteDependencies),
    ...createExpenseCategoriesRoutes({ ...recordWriteDependencies, rawRecordRepository, database: db }),
    ...createFeeSetupRoutes(recordWriteDependencies),
    ...createBackupRoutes({
      backupService: backups,
      readSetting,
      writeSetting: settings.setSetting,
      auditTrail: auditLogRepository,
      runRevisionTransaction,
      replaceAllRecords,
      backupDirectory: backupDir,
      forbiddenFolders,
      // 42d: arhiva completă (toate bazele) — construită o singură dată în create-application.mjs,
      // pasată gata construită, la fel ca `common` mai sus (decizia din plan, pasul 6).
      fullBackupService,
      restoreFullBackup,
    }),
    ...createTelegramRoutes({
      dataDirectory: dataDir,
      telegramService: createTelegramService({ fetch: fetchImpl ?? globalThis.fetch }),
      auditTrail: auditLogRepository,
    }),
    ...createSmsRoutes({
      database: db,
      dataDirectory: dataDir,
      smsService: createSmsService({ fetch: fetchImpl ?? globalThis.fetch }),
      auditTrail: auditLogRepository,
    }),
    ...createAttendanceRoutes({
      database: db,
      recordRepository,
      onChange: change => syncChangeSink.record(change.kind, change.id, change.payload),
    }),
    // common e opțional doar pentru un context construit fără el (test izolat de filială);
    // create-application.mjs îl dă întotdeauna, deci Personal e mereu montat în aplicația reală.
    ...(common
      ? createPersonalRoutes({
          common,
          branchId: branch.id,
          listBranches,
          auditTrail: auditLogRepository,
          recordRepository,
          runRevisionTransaction,
          readCoachPayForMonth,
        })
      : []),
    // Bazin (23): rute separate de Personal, ca niciun feature să nu importe altul — vezi
    // `personalRepositoryForPool`/`coachPaymentWriter` de mai sus.
    ...(coachPaymentWriter
      ? createPoolRoutes({
          poolRepository,
          recordRepository,
          runRevisionTransaction,
          auditTrail: auditLogRepository,
          readSetting,
          writeSetting: settings.setSetting,
          listCoaches,
          payCoach: coachPaymentWriter.payCoach,
        })
      : []),
    ...createNotificationSettingsRoutes({
      scheduleFile,
      readSetting,
      writeSetting: settings.setSetting,
      auditTrail: auditLogRepository,
    }),
    ...createExchangeRatesRoutes({
      readSetting,
      writeSetting: settings.setSetting,
      fetch: fetchImpl ?? globalThis.fetch,
      backfill: days => backfillExchangeRates(days),
    }),
    ...createPlanPresetsRoutes({ readSetting, writeSetting: settings.setSetting }),
    ...createKindergartenSettingsRoutes({
      readSetting,
      writeSetting: settings.setSetting,
      recordRepository,
      auditTrail: auditLogRepository,
    }),
    ...createReceiptNumberingRoutes({ receiptNumberingService }),
    ...syncRoutes.routes,
    ...syncConflictsRoutes,
    ...branchRoutes,
  ];

  const { dispatchRequest } = createRouteDispatcher({
    root,
    sessionToken,
    // Fiecare feature își tipează propriile rute; adunate aici, TS lărgește
    // `method` la string — cast spre forma așteptată de dispatcher.
    routes: /** @type {import('#core/server/http/route-dispatcher.mjs').RouteDefinition[]} */ (routes),
  });

  // Preia de la BNM orice zi lipsă din [startDate, endDate] (inclusiv) și scrie
  // doar completările reale ale acestei bucle — nu un instantaneu al rateler curente,
  // ca să nu suprascriem la scriere o corectare manuală (POST /api/exchange-rates)
  // făcută în timp ce bucla încă așteaptă alte zeci de cereri (M8 din audit). Nu
  // aruncă niciodată — o zi fără curs publicat (weekend, sărbătoare) sau un eșec de
  // rețea rămâne pur și simplu necompletată, fără să oprească celelalte zile din interval.
  async function fetchMissingRatesInRange(startDate, endDate) {
    if (startDate > endDate) return;
    const current = parseExchangeRates(readSetting('exchangeRates'));
    const fetchedRates = {};
    const fetchedSources = {};
    for (let date = startDate; date <= endDate; date = shiftDays(date, 1)) {
      if (Object.hasOwn(current, date)) continue;
      const result = await fetchBnmEurRate({ fetch: fetchImpl ?? globalThis.fetch, date });
      if ('rate' in result) {
        fetchedRates[date] = result.rate;
        fetchedSources[date] = 'bnm';
      }
    }
    if (Object.keys(fetchedRates).length === 0) return;
    // Recitite chiar înainte de scriere, ca o corectare făcută în timpul buclei de mai
    // sus să câștige: completarea BNM se aplică doar peste zilele încă lipsă acum.
    const latestRates = parseExchangeRates(readSetting('exchangeRates'));
    const latestSources = parseExchangeRateSources(readSetting('exchangeRateSources'));
    settings.setSetting('exchangeRates', JSON.stringify(clampExchangeRates({ ...fetchedRates, ...latestRates })));
    settings.setSetting(
      'exchangeRateSources',
      JSON.stringify(clampExchangeRateSources({ ...fetchedSources, ...latestSources })),
    );
  }

  // Apelat la deschiderea oricărei filiale (pornirea procesului sau o schimbare —
  // decizia 7 din plan): completează retroactiv orice zi lucrătoare fără curs
  // salvat, nu doar ziua curentă — dacă aplicația a stat închisă câteva zile, un
  // calcul ulterior tot trebuie să găsească exact cursul zilei respective, nu doar
  // pe cel mai recent cunoscut. Fără istoric deloc (filială nouă), completarea se
  // oprește la ultimele EXCHANGE_RATE_BACKFILL_DAYS zile.
  async function refreshExchangeRateIfMissing() {
    const todayStr = today();
    const current = parseExchangeRates(readSetting('exchangeRates'));
    const lastKnownDate = Object.keys(current).sort().at(-1);
    const startDate = lastKnownDate ? shiftDays(lastKnownDate, 1) : shiftDays(todayStr, -EXCHANGE_RATE_BACKFILL_DAYS);
    await fetchMissingRatesInRange(startDate, todayStr);
  }

  // F12 (FEEDBACK-01-10.md): BNM publică „mâine” după-amiaza, înaintea zilei lucrătoare
  // următoare — verificat separat de restul, pentru că e singura zi din VIITOR pe care
  // o urmărim (restul funcției de mai sus se oprește strict la azi).
  async function refreshTomorrowRateIfMissing() {
    const tomorrow = shiftDays(today(), 1);
    await fetchMissingRatesInRange(tomorrow, tomorrow);
  }

  // „Vezi încă N zile” (38e): extinde istoricul înapoi de la cea mai veche zi cunoscută —
  // spre deosebire de refreshExchangeRateIfMissing (care completează goluri până la azi),
  // asta merge înapoi în timp, pentru calendarul lunar.
  /** @param {number} days */
  async function backfillExchangeRates(days) {
    const current = parseExchangeRates(readSetting('exchangeRates'));
    const earliestKnown = Object.keys(current).sort().at(0) ?? today();
    const endDate = shiftDays(earliestKnown, -1);
    const startDate = shiftDays(earliestKnown, -days);
    await fetchMissingRatesInRange(startDate, endDate);
  }

  // Rulat la fiecare deschidere a acestei filiale (pornirea procesului sau
  // după o schimbare din selector), nu doar o dată per proces: fiecare filială
  // are propriile note medicale, propriul jurnal SMS și propriul curs BNM.
  function runStartupSweeps() {
    try {
      visitsService.expireHealthNotes();
    } catch (e) {
      console.error('Expirare date medicale: ' + /** @type {Error} */ (e).message);
    }
    try {
      createSmsLogRepository(db).expireOldEntries(today());
    } catch (e) {
      console.error('Expirare jurnal SMS: ' + /** @type {Error} */ (e).message);
    }
    // refreshExchangeRateIfMissing e asincronă: un try/catch sincron în jurul apelului
    // (fără await) nu prinde niciodată respingerea ei — .catch() e singurul mod corect,
    // altfel o filială închisă chiar când sweep-ul rulează ar lăsa o respingere netratată.
    refreshExchangeRateIfMissing().catch(e => {
      console.error('Curs BNM la pornire: ' + /** @type {Error} */ (e).message);
    });
    // F12: BNM publică uneori cursul de mâine încă din prima parte a zilei — verificăm și
    // la pornire, nu doar în fereastra orară 13–18 (programarea orară trăiește în main.mjs).
    refreshTomorrowRateIfMissing().catch(e => {
      console.error('Curs BNM de mâine la pornire: ' + /** @type {Error} */ (e).message);
    });
  }

  return {
    branch,
    db,
    dbFile,
    dataDir,
    backupDir,
    backups,
    recordRepository,
    auditLogRepository,
    readSetting,
    // 42d: fullBackupService (create-application.mjs) citește/scrie lastLocal/externalDir
    // ale arhivei complete pe setările FILIALEI ACTIVE, la fel ca backups de mai sus —
    // singurul consumator e create-application.mjs, nicio rută de-aici nu-l expune direct.
    writeSetting: settings.setSetting,
    // Motorul de sincronizare (Faza 3, nu construită aici) se leagă de exact aceste
    // depozite; rawRecordRepository e drumul prin care aplică modificările primite
    // de pe server, ca ele să nu se întoarcă în propriul outbox (decizia 4 din plan).
    sync: {
      outbox: syncOutboxRepository,
      state: syncStateRepository,
      conflicts: syncConflictsRepository,
      rawRecordRepository,
      engine: syncEngine,
    },
    dispatchRequest,
    runStartupSweeps,
    // Apelat separat de runStartupSweeps (create-application.mjs, main.mjs): pornirea
    // motorului face cereri de rețea, deci nu trebuie să întârzie sweep-urile locale.
    // Fără motor (instalare neconfigurată) e un no-op.
    startSync: () => syncEngine?.start(),
    envelope: recordRepository.readEnvelope,
    backup: backups.backup,
    safeBackup: backups.safeBackup,
    health: backups.health,
    expireHealthNotes: visitsService.expireHealthNotes,
    // Un al doilea repository doar pentru sweep e mai simplu decât să scoatem instanța rutelor.
    /** @param {string} [todayStr] */
    expireSmsLog: (todayStr = today()) => createSmsLogRepository(db).expireOldEntries(todayStr),
    refreshExchangeRateIfMissing,
    refreshTomorrowRateIfMissing,
    backfillExchangeRates,
    // Motorul setului comun (Personal 24, decizia 9) trăiește în create-common-context.mjs,
    // pornit o singură dată și nereconstruit la schimbarea filialei — dar SSE-ul local
    // (/api/sync/events) e reconstruit la fiecare context de filială, deci punctul lui
    // onStatus/onRecordsChanged trebuie realiniat de fiecare dată. create-application.mjs
    // ține minte contextul activ și apelează aceste două metode, nu pe cele ale motorului.
    notifySyncStatus: () => syncRoutes.onStatus(),
    /** @param {number} revision */
    notifyCommonRecordsChanged: revision => syncRoutes.onRecordsChanged(revision, 'comun'),
    // A-2: un flux SSE (/api/sync/events) rămas deschis ține conexiunea vie la infinit —
    // server.close(callback) din create-application.mjs așteaptă tocmai închiderea ei, deci
    // trebuie terminată explicit ÎNAINTE de acel apel, nu în interiorul callback-ului lui.
    closeStreams: () => syncRoutes.close(),
    close: () => {
      backups.cancelScheduledBackup();
      syncEngine?.stop();
      syncRoutes.close();
      closeDatabase();
    },
  };
}
