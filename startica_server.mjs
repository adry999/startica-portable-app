import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openDatabase, createSettings } from './server/database.mjs';
import { createBackups } from './server/backups.mjs';
import { createStore } from './server/store.mjs';
import { createRouter } from './server/routes.mjs';

export { retentionKeep } from './server/backups.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
// Copia integrală a bazei nu are ce căuta pe calea fiecărei salvări. Vezi
// server/backups.mjs. 0 = backup la fiecare scriere (folosit în teste).
const DEFAULT_AUTO_BACKUP_INTERVAL_MS = 300000;

export function createApplication(options = {}) {
  const root = options.root || ROOT,
    dataDir = options.dataDir || join(root, 'Startica_Date'),
    backupDir = options.backupDir || join(root, 'Startica_Backup');
  const autoBackupIntervalMs = Number.isFinite(options.autoBackupIntervalMs)
    ? options.autoBackupIntervalMs
    : DEFAULT_AUTO_BACKUP_INTERVAL_MS;

  const { db, dbFile } = openDatabase({ dataDir, backupDir });
  const settings = createSettings(db);
  const backups = createBackups({ db, dbFile, backupDir, ...settings, autoBackupIntervalMs });
  const store = createStore({ db, backups });

  // Tokenul de sesiune se schimbă la fiecare pornire: o filă rămasă deschisă
  // dintr-o rulare anterioară trebuie să reîncarce înainte să scrie.
  const token = randomUUID();
  const handle = createRouter({
    root,
    token,
    dataDir,
    backupDir,
    allowShutdown: !!options.allowShutdown,
    settings,
    backups,
    store,
    shutdown: () => {
      server.close(() => db.close());
      server.closeIdleConnections();
    },
  });
  const server = createServer((req, res) => handle(req, res, server.address().port));

  return {
    server,
    db,
    backup: backups.backup,
    health: backups.health,
    envelope: store.envelope,
    close: () =>
      new Promise(resolveClose => {
        backups.cancelScheduledBackup();
        server.close(() => {
          db.close();
          resolveClose();
        });
      }),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const port = Number(process.env.STARTICA_PORT || 8765);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Port Startica invalid.');
  // Implicit ar opri tot procesul, pierzând fereastra fără explicație.
  process.on('unhandledRejection', e => console.error('Respingere netratată: ' + (e?.stack || e)));
  const app = createApplication({ allowShutdown: true });
  app.server.on('error', e => {
    console.error(
      e.code === 'EADDRINUSE' ? `Startica este deja pornită. Deschide http://127.0.0.1:${port}` : e.message,
    );
    app.db.close();
    process.exitCode = 1;
  });
  app.server.listen(port, '127.0.0.1', () => {
    console.log(`Startica: http://127.0.0.1:${port}`);
    if (process.env.STARTICA_NO_BROWSER !== '1')
      spawn('cmd.exe', ['/c', 'start', '', `http://127.0.0.1:${port}`], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      }).unref();
    // Copia de pornire este sincronă și crește cu dimensiunea bazei. Pe calea
    // de pornire, ea întârzia primul răspuns la /api/health, deci lansatorul
    // aștepta degeaba înainte să deschidă fereastra. Amânată, serverul este
    // gata imediat, iar copia se face cât se ridică browserul.
    setTimeout(() => {
      try {
        app.backup('pornire');
      } catch (e) {
        console.error('Backup la pornire: ' + e.message);
      }
    }, 0);
  });
  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    try {
      app.backup('inchidere');
    } catch (e) {
      console.error(e.message);
    }
    await app.close();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
