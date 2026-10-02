import { act, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { urlParamNumber, useUrlParams } from './useUrlParams';

function withRouter(initialEntry: string) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>;
  };
}

describe('useUrlParams', () => {
  it('pornește cu valorile implicite când parametrii lipsesc din URL', () => {
    const { result } = renderHook(() => useUrlParams({ q: '', grupa: 'all' }), { wrapper: withRouter('/copii') });
    expect(result.current[0]).toEqual({ q: '', grupa: 'all' });
  });

  it('citește valorile deja din URL', () => {
    const { result } = renderHook(() => useUrlParams({ q: '', grupa: 'all' }), {
      wrapper: withRouter('/copii?q=hudic&grupa=neptun'),
    });
    expect(result.current[0]).toEqual({ q: 'hudic', grupa: 'neptun' });
  });

  it('scrie un singur câmp fără să atingă restul', () => {
    const { result } = renderHook(() => useUrlParams({ q: '', grupa: 'all' }), {
      wrapper: withRouter('/copii?grupa=neptun'),
    });
    act(() => result.current[1]({ q: 'hudic' }));
    expect(result.current[0]).toEqual({ q: 'hudic', grupa: 'neptun' });
  });

  it('actualizează mai multe câmpuri ÎNTR-UN singur apel, atomic — nu se pierd reciproc', () => {
    // Regresie: două apeluri SEPARATE de setSearchParams în același tur de evenimente nu se
    // înlănțuie (al doilea suprascrie primul) — de-aia setParams acceptă un obiect, nu un câmp.
    const { result } = renderHook(() => useUrlParams({ q: '', pagina: '1' }), { wrapper: withRouter('/copii') });
    act(() => result.current[1]({ q: 'Ioana Ionescu', pagina: '1' }));
    expect(result.current[0]).toEqual({ q: 'Ioana Ionescu', pagina: '1' });
  });

  it('șterge parametrul din URL când valoarea revine la implicit', () => {
    const { result } = renderHook(() => useUrlParams({ grupa: 'all' }), { wrapper: withRouter('/copii?grupa=neptun') });
    act(() => result.current[1]({ grupa: 'all' }));
    expect(result.current[0]).toEqual({ grupa: 'all' });
  });
});

describe('urlParamNumber', () => {
  it('cade pe implicit pentru valori lipsă sau nevalide', () => {
    expect(urlParamNumber('', 1)).toBe(1);
    expect(urlParamNumber('abc', 1)).toBe(1);
    expect(urlParamNumber('0', 1)).toBe(1);
    expect(urlParamNumber('-3', 1)).toBe(1);
  });

  it('parsează un număr valid', () => {
    expect(urlParamNumber('3', 1)).toBe(3);
  });
});
