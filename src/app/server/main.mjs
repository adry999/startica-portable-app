import { spawn } from 'node:child_process';
import { loadEnvironment } from '#config/environment.mjs';
import { createApplication } from './create-application.mjs';

export function startServer() {
  const environment = loadEnvironment();
  // Implicit ar opri tot procesul, pierzând fereastra fără explicație.
  process.on('unhandledRejection', e => {
    const failure = /** @type {Error} */ (e);
    console.error('Respingere netratată: ' + (failure?.stack || failure));
  });
  const app = createApplication({ allowShutdown: true, autoBackupIntervalMs: environment.autoBackupIntervalMs });
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
    const address = `http://127.0.0.1:${/** @type {import('node:net').AddressInfo} */ (app.server.address()).port}`;
    console.log(`Startica: ${address}`);
    if (environment.openBrowser)
      spawn('cmd.exe', ['/c', 'start', '', address], {
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
        console.error('Backup la pornire: ' + /** @type {Error} */ (e).message);
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
      console.error(/** @type {Error} */ (e).message);
    }
    await app.close();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
