import { useState } from 'react';

/**
 * Stare persistată în localStorage (ex. viewMode[page] din spec-ul de redesign).
 * localStorage poate lipsi sau fi blocat (mod privat) — orice eșec cade pe defaultValue,
 * fără să blocheze ecranul.
 */
export function usePersistedState<T extends string>(key: string, defaultValue: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      return (localStorage.getItem(key) as T | null) ?? defaultValue;
    } catch {
      return defaultValue;
    }
  });

  function update(next: T) {
    setValue(next);
    try {
      localStorage.setItem(key, next);
    } catch {
      // Stocare indisponibilă — starea rămâne doar în memorie pentru sesiunea curentă.
    }
  }

  return [value, update];
}
