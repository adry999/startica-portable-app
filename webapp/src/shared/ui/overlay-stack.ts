/**
 * Ordinea panourilor deschise (Drawer/Dialog) — folosită doar ca să decidă cine răspunde la
 * taste globale (Esc, Ctrl+Enter) când un `Dialog` (ex. `UnsavedChangesDialog`, 40c) rămâne
 * deschis peste un `Drawer`/`Dialog` de bază (convenția „confirmare imbricată, nu panou
 * imbricat” — vezi R13, architecture.test.ts). Fără acest tracker, ambele ar primi aceeași
 * tastă și ar reacționa amândouă (idempotent la Esc, dar o dublă trimitere la Ctrl+Enter).
 */
let stack: symbol[] = [];

export function pushOverlay(): symbol {
  const id = Symbol('overlay');
  stack = [...stack, id];
  return id;
}

export function popOverlay(id: symbol): void {
  stack = stack.filter(entry => entry !== id);
}

export function isTopOverlay(id: symbol | null): boolean {
  if (id === null) return false;
  return stack[stack.length - 1] === id;
}
