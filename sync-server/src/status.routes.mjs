import { readMeta } from './backup.service.mjs';

/**
 * @param {{
 *   database: import('node:sqlite').DatabaseSync,
 *   branches: ReturnType<typeof import('./branches.repository.mjs').createBranchesRepository>,
 *   devices: ReturnType<typeof import('./devices.repository.mjs').createDevicesRepository>,
 *   now: () => Date,
 * }} dependencies
 */
export function createStatusRoutes({ database, branches, devices, now }) {
  function status() {
    return {
      branches: branches.count(),
      devices: devices.countActive(),
      lastBackupAt: readMeta(database, 'lastBackupAt') ?? null,
      serverTime: now().toISOString(),
    };
  }

  /** @type {import('./router.mjs').RouteDefinition[]} */
  const routes = [{ method: 'GET', pattern: /^\/v1\/status$/, auth: true, handle: () => status() }];
  return { routes };
}
