export { createSyncOutboxRepository } from './server/sync-outbox.repository.mjs';
export { createSyncStateRepository } from './server/sync-state.repository.mjs';
export { createSyncConflictsRepository } from './server/sync-conflicts.repository.mjs';
export { createOutboxRecordingRepository, createChangeSink } from './server/outbox-recording-repository.mjs';
export {
  createSyncDeviceRepository,
  readSyncDeviceFile,
  writeSyncDeviceFile,
} from './server/sync-device.repository.mjs';
export { createSyncHttpClient, SyncNetworkError, SyncRevokedError, SyncHttpError } from './server/sync-http-client.mjs';
export {
  createChangeApplier,
  createSyncAttendanceWriter,
  createSyncPoolWriter,
  SyncApplyError,
  COMMON_KINDS,
} from './server/change-applier.mjs';
export { createSyncEngine } from './server/sync-engine.service.mjs';
export { createSyncRoutes } from './server/sync.routes.mjs';
export { createSyncConflictsRoutes } from './server/sync-conflicts.routes.mjs';
export {
  readLocalSnapshot,
  writeLocalSnapshot,
  readCommonSnapshot,
  writeCommonSnapshot,
} from './server/snapshot-io.mjs';
export { createSyncConnectService } from './server/sync-connect.service.mjs';
export { createSyncConnectRoutes } from './server/sync-connect.routes.mjs';
export { deriveSyncMode, SYNC_MODES } from './domain/sync-status.mjs';

// Reexport de tip, pentru consumatorii din afara feature-ului (create-application.mjs,
// create-branch-context.mjs, session.routes.mjs): index.server.mjs e singura cale
// publică, `sync.types.d.mts` e privat (tests/architecture/import-boundaries.test.mjs).
/** @typedef {import('./sync.types.d.mts').SyncDeviceFile} SyncDeviceFile */
/** @typedef {import('./sync.types.d.mts').SyncDeviceRepository} SyncDeviceRepository */
