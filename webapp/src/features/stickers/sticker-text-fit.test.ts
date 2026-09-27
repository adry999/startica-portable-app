import { describe, expect, it } from 'vitest';
import { bigTextFitsLabel, bigTextFontSizePx, type StickerLabelSize } from './sticker-text-fit';

const LABEL_SIZES: StickerLabelSize[] = ['58x30', '58x40', '58x60'];

describe('bigTextFontSizePx', () => {
  it('dă 30 px pentru text de cel mult 12 caractere, la mărimea 58×40', () => {
    expect(bigTextFontSizePx('Avram Maria', '58x40')).toBe(30);
  });

  it('dă 24 px pentru text de 13–18 caractere, la mărimea 58×40', () => {
    expect(bigTextFontSizePx('Ședința 2 oct.', '58x40')).toBe(24);
  });

  it('dă 20 px pentru text de peste 18 caractere, la mărimea 58×40', () => {
    expect(bigTextFontSizePx('Ședința cu părinții joi', '58x40')).toBe(20);
  });

  it('scade cu 4 px la eticheta 58×30 față de 58×40, pentru aceeași lungime', () => {
    expect(bigTextFontSizePx('Avram Maria', '58x30')).toBe(bigTextFontSizePx('Avram Maria', '58x40') - 4);
  });

  it('crește cu 6 px la eticheta 58×60 față de 58×40, pentru aceeași lungime', () => {
    expect(bigTextFontSizePx('Avram Maria', '58x60')).toBe(bigTextFontSizePx('Avram Maria', '58x40') + 6);
  });

  it('nu scade mărimea fontului pe măsură ce textul se scurtează, la nicio mărime de etichetă', () => {
    for (const size of LABEL_SIZES) {
      const lengths = [1, 5, 12, 13, 18, 19, 24];
      for (let i = 1; i < lengths.length; i++) {
        const shorter = bigTextFontSizePx('a'.repeat(lengths[i - 1]), size);
        const longer = bigTextFontSizePx('a'.repeat(lengths[i]), size);
        expect(longer).toBeLessThanOrEqual(shorter);
      }
    }
  });
});

describe('bigTextFitsLabel — criteriul „Textul nu iese din etichetă la nicio mărime"', () => {
  for (const size of LABEL_SIZES) {
    it(`încape pentru un interval realist de lungimi la eticheta ${size}`, () => {
      for (let length = 1; length <= 24; length++) {
        const text = 'A'.repeat(length);
        expect(bigTextFitsLabel(text, size), `lungime ${length} la ${size}`).toBe(true);
      }
    });
  }

  it('încape pentru textele implicite ale template-urilor, la toate mărimile', () => {
    const templateTexts = ['Avram Maria', 'Fără arahide', 'Ședința cu părinții', 'Cutia cu plastilină', 'Scrie aici'];
    for (const size of LABEL_SIZES) {
      for (const text of templateTexts) {
        expect(bigTextFitsLabel(text, size), `„${text}" la ${size}`).toBe(true);
      }
    }
  });
});
