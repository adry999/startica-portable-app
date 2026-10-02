import { describe, expect, it } from 'vitest';
import { pathForSearchResult, viewForPathname } from './routes';
import type { SearchResult } from './search-records';

describe('pathForSearchResult', () => {
  it('deschide direct fișa copilului sau achitarea', () => {
    expect(pathForSearchResult({ type: 'children', id: 'c1', label: '', detail: '' })).toBe('/copii/c1');
    expect(pathForSearchResult({ type: 'payments', id: 'p1', label: '', detail: '' })).toBe('/achitari/p1');
  });

  // 41c: cheltuielile nu au încă o rută pe id — rezultatul duce la listă, nu la un /cheltuieli/:id inexistent.
  it('o cheltuială duce la listă, nu la un /cheltuieli/:id inexistent', () => {
    const result: SearchResult = { type: 'expenses', id: 'e1', label: '', detail: '' };
    expect(pathForSearchResult(result)).toBe('/cheltuieli');
  });
});

describe('viewForPathname', () => {
  it('derivă modulul din primul segment al căii', () => {
    expect(viewForPathname('/cheltuieli')).toBe('expenses');
    expect(viewForPathname('/copii/c1')).toBe('children');
    expect(viewForPathname('/')).toBe('dashboard');
  });
});
