import { describe, expect, it } from 'vitest';
import { pageWindow } from './page-window';

describe('pageWindow', () => {
  it('o singură pagină', () => {
    expect(pageWindow(1, 1)).toEqual([1]);
  });

  it('2 pagini — fără elipsă', () => {
    expect(pageWindow(1, 2)).toEqual([1, 2]);
    expect(pageWindow(2, 2)).toEqual([1, 2]);
  });

  it('7 pagini — toate vizibile, fără elipsă, indiferent de pagina curentă', () => {
    expect(pageWindow(1, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(pageWindow(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(pageWindow(7, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('13 pagini, curentă la început — o singură elipsă spre final', () => {
    expect(pageWindow(1, 13)).toEqual([1, 2, 'ellipsis', 13]);
  });

  it('13 pagini, curentă la mijloc — elipsă pe ambele părți', () => {
    expect(pageWindow(7, 13)).toEqual([1, 'ellipsis', 6, 7, 8, 'ellipsis', 13]);
  });

  it('13 pagini, curentă la final — o singură elipsă spre început', () => {
    expect(pageWindow(13, 13)).toEqual([1, 'ellipsis', 12, 13]);
  });

  it('31 pagini, curentă la pagina 2 — fără elipsă înainte (goluri de o pagină nu primesc „…”)', () => {
    expect(pageWindow(2, 31)).toEqual([1, 2, 3, 'ellipsis', 31]);
  });

  it('31 pagini, curentă la mijloc', () => {
    expect(pageWindow(16, 31)).toEqual([1, 'ellipsis', 15, 16, 17, 'ellipsis', 31]);
  });

  it('31 pagini, curentă la final', () => {
    expect(pageWindow(31, 31)).toEqual([1, 'ellipsis', 30, 31]);
  });
});
