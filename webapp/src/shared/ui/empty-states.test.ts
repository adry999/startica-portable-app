import { describe, expect, it } from 'vitest';
import { EMPTY_STATES, resolveEmptyStateTitle } from './empty-states';

describe('empty-states', () => {
  it('fiecare cheie are un titlu nevid și o variantă validă', () => {
    for (const [key, entry] of Object.entries(EMPTY_STATES)) {
      const title = resolveEmptyStateTitle(entry, { luna: 'septembrie', zi: 'Sâmbătă', data: '12.09.2026' });
      expect(title, `cheia ${key}`).not.toHaveLength(0);
      expect(['first', 'done', 'period']).toContain(entry.variant);
    }
  });

  it('interpolează parametrii în titlurile care depind de ei', () => {
    expect(resolveEmptyStateTitle(EMPTY_STATES['achitari.period'], { luna: 'octombrie' })).toBe(
      'Nicio achitare în octombrie',
    );
    expect(resolveEmptyStateTitle(EMPTY_STATES['situatia.done'], { luna: 'octombrie' })).toBe(
      'Toți au achitat octombrie',
    );
  });

  it('folosește un fallback rezonabil când parametrii lipsesc', () => {
    expect(resolveEmptyStateTitle(EMPTY_STATES['cheltuieli.period'])).toBe('Nicio cheltuială în luna aleasă');
  });

  it('titlurile fixe (fără parametri) rămân neschimbate', () => {
    expect(resolveEmptyStateTitle(EMPTY_STATES['grupe.first'])).toBe('Nicio grupă încă');
  });
});
