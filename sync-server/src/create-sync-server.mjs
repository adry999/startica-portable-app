import { createServer } from 'node:http';
import { openSyncDatabase } from './database.mjs';
import { createRouter } from './router.mjs';

/**
 * Compunerea serverului de sincronizare — echivalentul create-application.mjs din
 * aplicație, dar pentru sync-server/ (pachet separat, fără nicio dependență din src/).
 * Doar scheletul din Task 1 (bază + router, fără rute): devices/pairing/branches (Task 2)
 * și changes/events (Task 3) se adaugă aici, incremental.
 * @param {{ config: import('./config.mjs').SyncServerConfig, log?: (message: unknown) => void }} options
 */
export function createSyncServer({ config, log = console.error }) {
  const database = openSyncDatabase(config.dataDir);

  const router = createRouter({
    routes: [],
    authenticate: () => {
      throw Object.assign(new Error('Niciun dispozitiv nu este încă acceptat.'), { status: 501 });
    },
    trustProxy: config.trustProxy,
    log,
  });

  const server = createServer((request, response) => {
    router.handleRequest(request, response);
  });

  function close() {
    return new Promise(done => server.close(() => done(undefined))).then(() => database.close());
  }

  return { server, database, close };
}
