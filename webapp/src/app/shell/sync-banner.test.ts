import { describe, expect, it } from 'vitest';
import { deriveSyncBanner } from './sync-banner';
import type { SyncStatus } from '@shared/api/useSyncStatus';

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

describe('deriveSyncBanner', () => {
  it('nu arată nimic cât conexiunea e online, indiferent de câte modificări așteaptă (sync normal)', () => {
    expect(deriveSyncBanner({ ...BASE_SYNC, pending: 7 })).toBeNull();
  });

  it('nu arată nimic doar pentru conflicte — acelea au propriul flux (Rezolvă)', () => {
    expect(deriveSyncBanner({ ...BASE_SYNC, conflicts: 2 })).toBeNull();
  });

  it('„offline” arată numărul de modificări nesincronizate, fără acțiune', () => {
    const banner = deriveSyncBanner({ ...BASE_SYNC, connection: 'offline', pending: 14 });
    expect(banner?.message).toContain('14 modificări nesincronizate');
    expect(banner?.message).toContain('Sincronizare oprită');
    expect(banner?.actionLabel).toBeUndefined();
  });

  it('„offline” cu o singură modificare foloseşte singularul', () => {
    const banner = deriveSyncBanner({ ...BASE_SYNC, connection: 'offline', pending: 1 });
    expect(banner?.message).toContain('1 modificare nesincronizată');
  });

  it('„revoked” arată acțiunea „Reconectează” și numărul de modificări', () => {
    const banner = deriveSyncBanner({ ...BASE_SYNC, connection: 'revoked', pending: 3 });
    expect(banner?.actionLabel).toBe('Reconectează');
    expect(banner?.message).toContain('3 modificări nesincronizate');
  });

  it('„offline” cu 0 în așteptare tot arată banda (sincronizarea chiar nu merge)', () => {
    const banner = deriveSyncBanner({ ...BASE_SYNC, connection: 'offline', pending: 0 });
    expect(banner?.message).toContain('0 modificări nesincronizate');
  });
});
