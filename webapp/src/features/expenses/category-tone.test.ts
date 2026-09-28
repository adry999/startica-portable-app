import { describe, expect, it } from 'vitest';
import { categoryTone } from './category-tone';

describe('categoryTone', () => {
  it('întoarce neutral pentru un nume gol sau necunoscut', () => {
    expect(categoryTone('', ['Chirie', 'Salarii'])).toBe('neutral');
    expect(categoryTone('Necunoscută', ['Chirie', 'Salarii'])).toBe('neutral');
  });

  it('e stabil pe poziția alfabetică, indiferent de ordinea din listă', () => {
    const a = categoryTone('Chirie', ['Salarii', 'Chirie', 'Utilități']);
    const b = categoryTone('Chirie', ['Chirie', 'Salarii', 'Utilități']);
    expect(a).toBe(b);
  });

  it('două categorii diferite primesc tonuri diferite din primele 8', () => {
    const names = ['Chirie', 'Salarii'];
    expect(categoryTone('Chirie', names)).not.toBe(categoryTone('Salarii', names));
  });
});
