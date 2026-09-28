import { describe, expect, it } from 'vitest';
import { deriveSyncStatus } from './sync-status';
import type { SyncStatus } from '@shared/api/useSyncStatus';
import type { SessionStateForSaveStatus } from './save-status';

const BASE_SYNC: SyncStatus = {
  configured: true,
  serverUrl: 'https://sync.exemplu.md',
  deviceName: 'Calculator A',
  connection: 'online',
  pending: 0,
  pushing: false,
  lastSyncedAt: '2026-09-27T09:06:00.000Z',
  conflicts: 0,
  lastError: '',
};

const BASE_LOCAL: SessionStateForSaveStatus = {
  ready: true,
  loading: false,
  pending: null,
  busy: false,
  saveError: '',
  connectionError: '',
  lastSavedAt: '2026-09-27T09:06:00.000Z',
  health: {},
};

describe('deriveSyncStatus', () => {
  it('cardul derivă cele 4 stări din spec în ordinea conflict > offline > se sincronizează > sincronizat', () => {
    expect(deriveSyncStatus({ ...BASE_SYNC, conflicts: 2, connection: 'offline', pending: 5 }, BASE_LOCAL)?.mode).toBe(
      'conflict',
    );
    expect(deriveSyncStatus({ ...BASE_SYNC, connection: 'offline', pending: 3 }, BASE_LOCAL)?.mode).toBe('offline');
    expect(deriveSyncStatus({ ...BASE_SYNC, pending: 3 }, BASE_LOCAL)?.mode).toBe('syncing');
    expect(deriveSyncStatus(BASE_SYNC, BASE_LOCAL)?.mode).toBe('synced');
  });

  it('deconectat (revoked) are întâietate asupra „fără internet”, cu propriul text', () => {
    const result = deriveSyncStatus({ ...BASE_SYNC, connection: 'revoked' }, BASE_LOCAL);
    expect(result?.mode).toBe('revoked');
    expect(result?.label).toBe('Deconectat de pe server');
    expect(result?.actionLabel).toBe('Reconectează din Backup și setări');
  });

  it('conflictul arată contorul și acțiunea Rezolvă', () => {
    const result = deriveSyncStatus({ ...BASE_SYNC, conflicts: 3 }, BASE_LOCAL);
    expect(result?.label).toBe('3 conflicte');
    expect(result?.actionLabel).toBe('Rezolvă');
  });

  it('sincronizat arată ora ultimei sincronizări', () => {
    const result = deriveSyncStatus(BASE_SYNC, BASE_LOCAL);
    expect(result?.label).toMatch(/^Sincronizat · \d{2}:\d{2}$/);
  });

  it('o eroare locală (salvare, conexiune sau backup) are întâietate — întoarce null', () => {
    expect(deriveSyncStatus(BASE_SYNC, { ...BASE_LOCAL, saveError: 'Eroare' })).toBeNull();
    expect(deriveSyncStatus(BASE_SYNC, { ...BASE_LOCAL, connectionError: 'Eroare' })).toBeNull();
    expect(deriveSyncStatus(BASE_SYNC, { ...BASE_LOCAL, health: { localError: 'Eroare' } })).toBeNull();
  });
});
