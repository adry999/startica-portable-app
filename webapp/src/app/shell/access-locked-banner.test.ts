import { describe, expect, it } from 'vitest';
import { normalizeProfile, completProfile } from '#shared/domain/computer-profile.mjs';
import type { AccessRowView } from '@shared/audit-log';
import { deriveAccessLockedBanner } from './access-locked-banner';

/** @param {Partial<AccessRowView>} [overrides] */
function row(overrides: Partial<AccessRowView> = {}): AccessRowView {
  return {
    id: 1,
    action: 'access.locked',
    dayKey: '2026-10-2',
    dayLabel: 'Azi · 2 octombrie',
    timeLabel: '09:00',
    actionLabel: 'Blocat (5 greșeli)',
    actionTone: 'pink',
    moduleLabel: '',
    deviceName: 'Calculator Educator',
    ...overrides,
  };
}

describe('deriveAccessLockedBanner (§5, punctul 3)', () => {
  it('nu arată nimic fără profil (încă neconfirmat)', () => {
    expect(deriveAccessLockedBanner([row()], null, '')).toBeNull();
    expect(deriveAccessLockedBanner([row()], undefined, '')).toBeNull();
  });

  it('nu arată nimic pe un profil care nu e Complet', () => {
    expect(deriveAccessLockedBanner([row()], normalizeProfile({ preset: 'educator' }), '')).toBeNull();
  });

  it('nu arată nimic fără nicio intrare access.locked', () => {
    const rows = [row({ id: 2, action: 'access.pin_fail', actionLabel: 'PIN greșit' })];
    expect(deriveAccessLockedBanner(rows, completProfile(), '')).toBeNull();
  });

  it('arată mesajul cu numele calculatorului blocat, pe profil Complet', () => {
    const banner = deriveAccessLockedBanner(
      [row({ id: 7, deviceName: 'Calculator grupa Mars' })],
      completProfile(),
      '',
    );
    expect(banner).toEqual({
      entryId: '7',
      message: 'Calculatorul „Calculator grupa Mars” a fost blocat după 5 PIN-uri greșite.',
    });
  });

  it('ia cea mai recentă intrare access.locked dintre mai multe (rows ordonate cele mai noi primele)', () => {
    const rows = [row({ id: 9, deviceName: 'Calculator nou' }), row({ id: 3, deviceName: 'Calculator vechi' })];
    const banner = deriveAccessLockedBanner(rows, completProfile(), '');
    expect(banner?.entryId).toBe('9');
  });

  it('ignoră access.blocked (alt eveniment, tot ton pink) — nu-l confundă cu access.locked', () => {
    const rows = [row({ id: 4, action: 'access.blocked', actionLabel: 'Acces respins' })];
    expect(deriveAccessLockedBanner(rows, completProfile(), '')).toBeNull();
  });

  it('nu reapare dacă ultima intrare e deja marcată ca văzută', () => {
    expect(deriveAccessLockedBanner([row({ id: 5 })], completProfile(), '5')).toBeNull();
  });

  it('reapare pentru o intrare access.locked NOUĂ, chiar dacă una veche a fost deja văzută', () => {
    const banner = deriveAccessLockedBanner([row({ id: 6 })], completProfile(), '5');
    expect(banner?.entryId).toBe('6');
  });
});
