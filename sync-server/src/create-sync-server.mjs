import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { openSyncDatabase } from './database.mjs';
import { createRouter, fail } from './router.mjs';
import { bearerToken, createRateLimiter, hashToken } from './auth.mjs';
import { clientVersionHeader, createVersionGate } from './version-gate.mjs';
import { createDevicesRepository } from './devices.repository.mjs';
import { createPairingService } from './pairing.service.mjs';
import { createBranchesRepository } from './branches.repository.mjs';
import { scheduleDailyBackup } from './backup.service.mjs';
import { createChangesService } from './changes.service.mjs';
import { createEventHub } from './events.mjs';
import { createDevicesRoutes } from './devices.routes.mjs';
import { createBranchesRoutes } from './branches.routes.mjs';
import { createStatusRoutes } from './status.routes.mjs';
import { createChangesRoutes } from './changes.routes.mjs';

const PAIRING_RATE_LIMIT = { limit: 5, windowMs: 10 * 60 * 1000 };

/**
 * Compunerea serverului de sincronizare — echivalentul create-application.mjs din
 * aplicație, dar pentru sync-server/ (pachet separat, fără nicio dependență din src/).
 * @param {{
 *   config: import('./config.mjs').SyncServerConfig,
 *   now?: () => Date,
 *   createId?: () => string,
 *   log?: (message: unknown) => void,
 *   accessLog?: (message: string) => void,
 * }} options
 */
export function createSyncServer({
  config,
  now = () => new Date(),
  createId = randomUUID,
  log = console.error,
  accessLog = console.log,
}) {
  const database = openSyncDatabase(config.dataDir);
  const devices = createDevicesRepository(database);
  const pairing = createPairingService(database);
  const branches = createBranchesRepository(database);
  const changesService = createChangesService({ database, devices });
  const events = createEventHub();
  const pairingRateLimiter = createRateLimiter(PAIRING_RATE_LIMIT);
  const checkClientVersion = createVersionGate({ minClientVersion: config.minClientVersion });

  /** @param {import('node:http').IncomingMessage} request */
  function authenticate(request) {
    const token = bearerToken(request);
    if (!token) fail('device-token-missing', 401);
    const device = devices.findByTokenHash(hashToken(token));
    if (!device) fail('device-unknown', 401);
    if (device.revokedAt) fail('device-revoked', 401);
    // §5.2 (37d): ținută pe dispozitiv la fiecare cerere autentificată, nu doar la pair() —
    // ultima văzută, pentru coloana Versiune din Calculatoare conectate.
    devices.touchLastSeen(device.id, { version: clientVersionHeader(request), now: now().toISOString() });
    return device;
  }

  const deviceRoutes = createDevicesRoutes({ devices, pairing, config, pairingRateLimiter, createId, now });
  const branchRoutes = createBranchesRoutes({ branches, devices, now });
  const statusRoutes = createStatusRoutes({ database, branches, devices, now });
  const changeRoutes = createChangesRoutes({ changesService, branches, devices, events, now });

  const router = createRouter({
    routes: [...deviceRoutes.routes, ...branchRoutes.routes, ...statusRoutes.routes, ...changeRoutes.routes],
    authenticate,
    trustProxy: config.trustProxy,
    log,
    accessLog,
    checkClientVersion,
  });

  const server = createServer((request, response) => {
    router.handleRequest(request, response);
  });

  const backup = scheduleDailyBackup({
    database,
    dataDir: config.dataDir,
    hour: config.backupHour,
    keep: config.backupKeep,
    historyDays: config.historyDays,
    now,
  });

  function close() {
    backup.stop();
    pairingRateLimiter.stop();
    events.closeAll();
    // O conexiune SSE abandonată de client (fetch anulat) poate rămâne „pe jumătate
    // deschisă” din perspectiva serverului până la următoarea scriere; closeAllConnections
    // o rupe imediat, altfel server.close() ar aștepta degeaba oprirea acelui soclu.
    server.closeAllConnections();
    return new Promise(done => server.close(() => done(undefined))).then(() => database.close());
  }

  return { server, database, devices, branches, pairing, changesService, events, close };
}
