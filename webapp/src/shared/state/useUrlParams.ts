import { useSearchParams } from 'react-router-dom';

/**
 * Filtre/căutare/pagină ținute în query string, nu în `useState` local (§13.2 PROMPT-8 — Copii,
 * Achitări, Cheltuieli: filtrele și căutarea rămân la întoarcerea din fișă). Sursa adevărului e
 * URL-ul, deci starea supraviețuiește remontării ecranului (navigare către fișă și înapoi), spre
 * deosebire de `useState`.
 *
 * Toate câmpurile unui ecran trec printr-un singur `setSearchParams` per interacție (`setParams`
 * acceptă un obiect parțial) — două apeluri separate de `setSearchParams` în același tur de
 * evenimente nu se înlănțuie (al doilea citește snapshot-ul dinaintea primului și îl suprascrie),
 * deci „schimbă filtrul ȘI resetează pagina” trebuie să fie UN singur apel, nu două.
 *
 * Un parametru lipsește din URL cât timp valoarea e cea implicită — un link „curat" fără filtre active.
 */
export function useUrlParams<Defaults extends Record<string, string>>(
  defaults: Defaults,
): [Defaults, (updates: Partial<Defaults>) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const keys = Object.keys(defaults) as (keyof Defaults & string)[];
  const values = Object.fromEntries(keys.map(key => [key, searchParams.get(key) ?? defaults[key]])) as Defaults;

  function setParams(updates: Partial<Defaults>) {
    setSearchParams(
      params => {
        const next = new URLSearchParams(params);
        for (const key of Object.keys(updates) as (keyof Defaults & string)[]) {
          const value = updates[key] as string | undefined;
          if (value === undefined || value === defaults[key]) next.delete(key);
          else next.set(key, value);
        }
        return next;
      },
      { replace: true },
    );
  }

  return [values, setParams];
}

/** Citește/scrie un câmp numeric dintr-un `useUrlParams` (ex. „pagina") — string în URL, number în UI. */
export function urlParamNumber(raw: string, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
