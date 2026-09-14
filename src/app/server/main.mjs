import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnvironment } from '#config/environment.mjs';
import { createRotatingLogFile } from '#core/server/files/rotating-log-file.mjs';
import { removeFileIfPresent } from '#core/server/files/remove-file-if-present.mjs';
import { createApplication } from './create-application.mjs';

// Lansatorul desktop nu are altă fereastră pentru mesajele serverului, deci consola merge în jurnal.
/** @param {string} home */
function redirectConsoleToLogFile(home) {
  const logsDir = join(home, 'Jurnale');
  mkdirSync(logsDir, { recursive: true });
  const logFile = createRotatingLogFile({ file: join(logsDir, 'startica.log') });
  console.log = (...args) => logFile.write('INFO', args.join(' '));
  console.warn = (...args) => logFile.write('WARN', args.join(' '));
  console.error = (...args) => logFile.write('ERROR', args.join(' '));
}

export function startServer() {
  const environment = loadEnvironment();
  if (environment.home) redirectConsoleToLogFile(environment.home);
  const portFile = environment.home ? join(environment.home, 'startica.port') : null;
  // Implicit ar opri tot procesul, pierzând fereastra fără explicație.
  process.on('unhandledRejection', e => {
    const failure = /** @type {Error} */ (e);
    console.error('Respingere netratată: ' + (failure?.stack || failure));
  });
  const app = createApplication({
    ...(environment.home
      ? {
          dataDir: join(environment.home, 'Startica_Date'),
          backupDir: join(environment.home, 'Startica_Backup'),
          home: environment.home,
        }
      : {}),
    allowShutdown: true,
    autoBackupIntervalMs: environment.autoBackupIntervalMs,
  });
  // Fără această captură, o eroare neprevăzută ar închide procesul brusc, fără jurnal și fără backup.
  process.on('uncaughtException', e => {
    const failure = /** @type {Error} */ (e);
    console.error('Excepție netratată: ' + (failure?.stack || failure));
    const result = app.safeBackup('eroare');
    if (result.warning) console.error(result.warning);
    app.db.close();
    process.exit(1);
  });
  app.server.on('error', e => {
    const failure = /** @type {NodeJS.ErrnoException} */ (e);
    console.error(
      failure.code === 'EADDRINUSE'
        ? `Startica este deja pornită. Deschide http://127.0.0.1:${environment.port}`
        : failure.message,
    );
    app.db.close();
    process.exitCode = 1;
  });
  app.server.listen(environment.port, '127.0.0.1', () => {
    const port = /** @type {import('node:net').AddressInfo} */ (app.server.address()).port;
    const address = `http://127.0.0.1:${port}`;
    console.log(`Startica: ${address}`);
    if (portFile) writeFileSync(portFile, JSON.stringify({ port, pid: process.pid, database: app.database }));
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
    }, 0);
  });
  // Lansatorul folosește existența fișierului ca să afle dacă instanța găsită mai este vie.
  app.server.on('close', () => {
    if (portFile) removeFileIfPresent(portFile);
  });
  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
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
