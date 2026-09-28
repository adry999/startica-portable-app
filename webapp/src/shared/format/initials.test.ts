import { describe, expect, it } from 'vitest';
import { initials } from './initials';

describe('initials', () => {
  it('ia primele litere din primele două cuvinte', () => {
    expect(initials('Ana Maria Popescu')).toBe('AM');
  });
});
