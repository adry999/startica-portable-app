export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

export interface SaveStatusResult {
  status: SaveStatus;
  label: string;
  detail: string;
}

export interface SessionStateForSaveStatus {
  ready: boolean;
  loading: boolean;
  pending: unknown;
  busy: boolean;
  saveError: string;
  connectionError: string;
  lastSavedAt: string;
  health: { localError?: string; externalError?: string };
}

function formatSavedAt(iso: string): string {
  return `Salvat · ${new Date(iso).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}`;
}

/**
 * Ordinea condițiilor contează: ultima care se potrivește câștigă, o eroare
 * acoperă mereu o stare de „se salvează”.
 */
export function deriveSaveStatus(state: SessionStateForSaveStatus): SaveStatusResult {
  let status: SaveStatus = 'saved';
  let label = formatSavedAt(state.lastSavedAt);
  // F26 (PROMPT-11 §14.4): al doilea rând al cardului — SaveStatusCard apare doar fără
  // sincronizare configurată (vezi Sidebar.tsx), deci mereu „Doar pe acest calculator”.
  let detail = state.lastSavedAt ? 'Doar pe acest calculator' : 'Date încărcate de pe disc';

  if (!state.ready || state.loading) {
    status = 'unsaved';
    label = 'Se verifică datele…';
    detail = 'Se așteaptă confirmarea serverului';
  }
  if (state.pending && !state.busy) {
    status = 'unsaved';
    label = 'Nesalvat';
    detail = 'Conexiune întreruptă — apasă „Salvează acum" pentru a relua';
  }
  if (state.busy) {
    status = 'saving';
    label = 'Se salvează…';
    detail = 'Așteaptă confirmarea înainte de închidere';
  }
  const backupError = state.health.localError || state.health.externalError;
  if (backupError) {
    status = 'error';
    label = 'Problemă la backup';
    detail = backupError;
  }
  if (state.saveError) {
    status = 'error';
    label = 'Salvare neconfirmată';
    detail = state.saveError;
  }
  if (state.connectionError) {
    status = 'error';
    label = 'Conexiune întreruptă';
    detail = state.connectionError;
  }
  return { status, label, detail };
}
