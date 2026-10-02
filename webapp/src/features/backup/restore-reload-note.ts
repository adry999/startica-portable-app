// 46d: biletul lăsat chiar înainte de reîncărcarea completă (window.location.reload()) de
// după restaurarea unei arhive, ca toast-ul de confirmare să apară DUPĂ ce pagina s-a
// redeschis — același tipar ca biletul de comutare de filială (useBranchSwitch.ts).
const RESTORE_NOTE_KEY = 'backup.restored';

interface RestoreNote {
  createdAt: string;
}

export function writeRestoreDoneNote(note: RestoreNote): void {
  try {
    sessionStorage.setItem(RESTORE_NOTE_KEY, JSON.stringify(note));
  } catch {
    // Toast-ul de confirmare e doar o comoditate — lipsa lui nu blochează reîncărcarea.
  }
}

/** Citește o singură dată biletul lăsat înainte de reîncărcare. */
export function readRestoreDoneNote(): RestoreNote | null {
  try {
    const raw = sessionStorage.getItem(RESTORE_NOTE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(RESTORE_NOTE_KEY);
    return JSON.parse(raw) as RestoreNote;
  } catch {
    return null;
  }
}
