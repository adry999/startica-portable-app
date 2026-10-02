import { spawn } from 'node:child_process';
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { format } from 'node:util';
import { loadEnvironment, dataLayout } from '#config/environment.mjs';
import { createRotatingLogFile } from '#core/server/files/rotating-log-file.mjs';
import { removeFileIfPresent } from '#core/server/files/remove-file-if-present.mjs';
import { createApplication } from './create-application.mjs';

// F12 (FEEDBACK-01-10.md): BNM publică „mâine” după-amiaza — reverificăm o dată pe oră în
// fereastra asta, până apare (sau până se închide ziua lucrătoare). Ora exactă de publicare
// nu e documentată public de BNM (verificat pe bnm.md — pagina tehnică nu o specifică), deci
// fereastra rămâne o estimare lată, nu un orar exact.
const BNM_POLL_WINDOW_START_HOUR = 13;
const BNM_POLL_WINDOW_END_HOUR = 18;
const HOUR_MS = 60 * 60 * 1000;

// §5.2 (32-actualizari.md): verificare de actualizare la pornire și o dată la 6 ore —
// manifestul e static (GitHub Releases), nicio fereastră orară nu se aplică aici.
const UPDATE_POLL_INTERVAL_MS = 6 * HOUR_MS;

// Lansatorul desktop nu are altă fereastră pentru mesajele serverului, deci consola merge în jurnal.
/** @param {string} logFile */
function redirectConsoleToLogFile(logFile) {
  mkdirSync(dirname(logFile), { recursive: true });
  const log = createRotatingLogFile({ file: logFile });
  console.log = (...args) => log.write('INFO', format(...args));
  console.warn = (...args) => log.write('WARN', format(...args));
  console.error = (...args) => log.write('ERROR', format(...args));
}

export function startServer() {
  const environment = loadEnvironment();
  const layout = environment.home ? dataLayout(environment.home) : undefined;
  const logFile = layout ? join(layout.logDir, 'startica.log') : undefined;
  if (logFile) redirectConsoleToLogFile(logFile);
  const portFile = environment.home ? join(environment.home, 'startica.port') : null;
  // Implicit ar opri tot procesul, pierzând fereastra fără explicație.
  process.on('unhandledRejection', e => {
    const failure = /** @type {Error} */ (e);
    console.error('Respingere netratată: ' + (failure?.stack || failure));
  });
  /** @type {ReturnType<typeof createApplication>} */
  let app;
  /** @type {NodeJS.Timeout | undefined} */
  let bnmPollTimer;
  /** @type {NodeJS.Timeout | undefined} */
  let updatePollTimer;
  // Înregistrat înaintea createApplication: și o bază coruptă la deschidere trebuie să ajungă în jurnal.
  process.on('uncaughtException', e => {
    const failure = /** @type {Error} */ (e);
    try {
      console.error('Excepție netratată: ' + (failure?.stack || failure));
      const result = app?.safeBackup('eroare');
      if (result?.warning) console.error(result.warning);
      // closeSync(), nu doar app.db.close() (A-5): acela ocolește garda databaseClosed
      // și lasă Comun\ (Personal) deschisă — a doua bază, nu doar cea a filialei active.
      app?.closeSync();
      if (portFile) removeFileIfPresent(portFile);
    } finally {
      process.exit(1);
    }
  });
  app = createApplication({
    ...(layout
      ? {
          dataDir: layout.dataDir,
          backupDir: layout.backupDir,
          home: environment.home,
          logFile,
        }
      : {}),
    allowShutdown: true,
    autoBackupIntervalMs: environment.autoBackupIntervalMs,
    autoDownloadUpdate: environment.autoDownloadUpdate,
  });
  app.server.on('error', e => {
    const failure = /** @type {NodeJS.ErrnoException} */ (e);
    console.error(
      failure.code === 'EADDRINUSE'
        ? `Startica este deja pornită. Deschide http://127.0.0.1:${environment.port}`
        : failure.message,
    );
    // closeSync(), nu doar app.db.close() (A-5) — vezi mai sus.
    app.closeSync();
    process.exitCode = 1;
  });
  app.server.listen(environment.port, '127.0.0.1', () => {
    const port = /** @type {import('node:net').AddressInfo} */ (app.server.address()).port;
    const address = `http://127.0.0.1:${port}`;
    console.log(`Startica: ${address}`);
    if (portFile) {
      // Lansatorul citește fișierul de îndată ce apare; nu are voie să-l vadă gol.
      writeFileSync(portFile + '.tmp', JSON.stringify({ port, pid: process.pid, database: app.database }));
      renameSync(portFile + '.tmp', portFile);
    }
    if (environment.openBrowser)
      spawn('cmd.exe', ['/c', 'start', '', address], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      }).unref();
    // Amânată: copia sincronă întârzia primul /api/health, iar lansatorul aștepta degeaba fereastra.
    setTimeout(() => {
      try {
        app.backup('pornire');
      } catch (e) {
        console.error('Backup la pornire: ' + /** @type {Error} */ (e).message);
      }
      // Notele medicale, jurnalul SMS și cursul BNM: fiecare sweep își prinde
      // singur eroarea (vezi create-branch-context.mjs), la fel la pornirea
      // procesului ca și după o schimbare de filială din selector.
      app.runStartupSweeps();
      // Motorul de sincronizare (Faza 3): no-op pe o instalare fără sync.json.
      app.startSync();
      // §5.2: verificarea de versiune nu face parte din runStartupSweeps() (acela ține de
      // filiala activă; actualizarea e per proces, vezi create-application.mjs) — nu
      // blochează pornirea, eșecul (fără internet) rămâne doar în jurnal.
      app.checkForUpdate().catch(e => {
        console.error('Verificare actualizare la pornire: ' + /** @type {Error} */ (e).message);
      });
    }, 0);
    // F12: verificare orară a cursului BNM de mâine, doar în fereastra 13–18 — restul orelor
    // timer-ul tot bate, dar funcția de mai jos se oprește imediat (vezi comentariul de sus).
    bnmPollTimer = setInterval(() => {
      const hour = new Date().getHours();
      if (hour < BNM_POLL_WINDOW_START_HOUR || hour >= BNM_POLL_WINDOW_END_HOUR) return;
      app.refreshTomorrowRateIfMissing().catch(e => {
        console.error('Curs BNM de mâine (verificare orară): ' + /** @type {Error} */ (e).message);
      });
    }, HOUR_MS);
    bnmPollTimer.unref();
    // §5.2: o dată la 6 ore (32-actualizari.md) — manifestul `latest.json` e static, deci
    // nu are nevoie de o fereastră orară ca BNM de mai sus.
    updatePollTimer = setInterval(() => {
      app.checkForUpdate().catch(e => {
        console.error('Verificare actualizare (periodică): ' + /** @type {Error} */ (e).message);
      });
    }, UPDATE_POLL_INTERVAL_MS);
    updatePollTimer.unref();
  });
  // Lansatorul folosește existența fișierului ca să afle dacă instanța găsită mai este vie.
  app.server.on('close', () => {
    if (portFile) removeFileIfPresent(portFile);
  });
  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    clearInterval(bnmPollTimer);
    clearInterval(updatePollTimer);
    try {
      app.backup('inchidere');
    } catch (e) {
      console.error(/** @type {Error} */ (e).message);
    }
    await app.close();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
