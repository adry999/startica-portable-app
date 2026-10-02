import { describe, expect, it } from 'vitest';
import { normalizeProfile } from '#shared/domain/computer-profile.mjs';
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
  minVersion: '',
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

  it('§5.2 (426) „incompatible” arată versiunea curentă și ținta minimă, fără acțiune', () => {
    const result = deriveSyncStatus(
      { ...BASE_SYNC, connection: 'incompatible', minVersion: '2.2.0' },
      BASE_LOCAL,
      undefined,
      '2.1.0',
    );
    expect(result?.mode).toBe('incompatible');
    expect(result?.label).toBe('Versiune prea veche');
    expect(result?.detail).toBe('Versiunea 2.1.0 e prea veche, actualizează la 2.2.0.');
    expect(result?.actionLabel).toBeUndefined();
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

  describe('§5.3 (36d) — „Profil X · acces limitat”', () => {
    it('profilul Complet nu arată nicio notă de profil', () => {
      const result = deriveSyncStatus(BASE_SYNC, BASE_LOCAL, normalizeProfile({ preset: 'complet' }));
      expect(result?.detail).toBe('Toate calculatoarele au aceleași date');
    });

    it('un profil restrâns înlocuiește detaliul cu „Profil X · acces limitat” pe starea sincronizat', () => {
      const result = deriveSyncStatus(BASE_SYNC, BASE_LOCAL, normalizeProfile({ preset: 'educator' }));
      expect(result?.mode).toBe('synced');
      expect(result?.detail).toBe('Profil Educator · acces limitat');
    });

    it('pe o altă stare (ex. fără internet), nota de profil se adaugă la detaliul tehnic', () => {
      const result = deriveSyncStatus(
        { ...BASE_SYNC, connection: 'offline', pending: 3 },
        BASE_LOCAL,
        normalizeProfile({ preset: 'bazin' }),
      );
      expect(result?.detail).toBe(
        '3 modificări salvate local. Se trimit automat când revine conexiunea. · Profil Bazin · acces limitat',
      );
    });

    it('un profil blocat arată „Acces blocat”, nu doar „acces limitat”', () => {
      const result = deriveSyncStatus(BASE_SYNC, BASE_LOCAL, normalizeProfile({ preset: 'educator', blocked: true }));
      expect(result?.detail).toBe('Acces blocat');
    });

    it('fără profil (apelant care nu-l trimite), comportamentul rămâne cel de astăzi', () => {
      const result = deriveSyncStatus(BASE_SYNC, BASE_LOCAL);
      expect(result?.detail).toBe('Toate calculatoarele au aceleași date');
    });
  });
});
