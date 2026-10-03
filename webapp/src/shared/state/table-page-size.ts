const STORAGE_KEY = 'table.pageSize';
export const DEFAULT_TABLE_PAGE_SIZE = 10;

function isValidPageSize(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

/** Preferință per calculator, comună tuturor tabelelor (nu una separată per ecran) — alegi o
 * dată „Pe pagină 50” și rămâne așa peste tot, până o schimbi din nou. */
export function readStoredPageSize(): number {
  try {
    const raw = Number(localStorage.getItem(STORAGE_KEY));
    return isValidPageSize(raw) ? raw : DEFAULT_TABLE_PAGE_SIZE;
  } catch {
    return DEFAULT_TABLE_PAGE_SIZE;
  }
}

export function storePageSize(size: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(size));
  } catch {
    // preferință doar pe acest calculator; dacă localStorage e indisponibil, alegerea rămâne doar pentru sesiunea curentă
  }
}
