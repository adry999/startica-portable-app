import { describe, expect, it } from 'vitest';
import { dismissUpdateValue, shouldShowUpdateBanner } from './update-banner';

describe('shouldShowUpdateBanner', () => {
  it('arată bara dacă n-a fost niciodată închisă', () => {
    expect(shouldShowUpdateBanner('', '2.2.0', '2026-10-02')).toBe(true);
  });

  it('nu arată bara în aceeași zi, pentru aceeași versiune respinsă', () => {
    const dismissed = dismissUpdateValue('2.2.0', '2026-10-02');
    expect(shouldShowUpdateBanner(dismissed, '2.2.0', '2026-10-02')).toBe(false);
  });

  it('arată din nou bara a doua zi, pentru aceeași versiune', () => {
    const dismissed = dismissUpdateValue('2.2.0', '2026-10-02');
    expect(shouldShowUpdateBanner(dismissed, '2.2.0', '2026-10-03')).toBe(true);
  });

  it('arată bara imediat dacă a apărut o versiune mai nouă decât cea respinsă, chiar în aceeași zi', () => {
    const dismissed = dismissUpdateValue('2.2.0', '2026-10-02');
    expect(shouldShowUpdateBanner(dismissed, '2.3.0', '2026-10-02')).toBe(true);
  });

  it('tolerează o valoare stocată malformată (fără separator) — arată bara', () => {
    expect(shouldShowUpdateBanner('ceva-neasteptat', '2.2.0', '2026-10-02')).toBe(true);
  });
});

describe('dismissUpdateValue', () => {
  it('compune data și versiunea cu „|”', () => {
    expect(dismissUpdateValue('2.2.0', '2026-10-02')).toBe('2026-10-02|2.2.0');
  });
});
