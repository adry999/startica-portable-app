import { formatDateTime } from '#shared/format/date-format.mjs';

/**
 * @param {{
 *   readState: () => any,
 *   isEditorOpen: () => boolean,
 *   elements: { indicator: HTMLElement, status: HTMLElement, detail: HTMLElement },
 * }} dependencies
 */
export function createSaveIndicator({ readState, isEditorOpen, elements }) {
  // Ordinea condițiilor este ordinea de gravitate: ultima care se potrivește
  // câștigă, deci o eroare acoperă întotdeauna un „se salvează”.
  function renderSaveStatus() {
    const state = readState();
    const draft = state.editorDirty && isEditorOpen();
    const backupError = state.health.localError || state.health.externalError;
    let status = 'saved',
      label = 'Date salvate',
      detail = state.lastSavedAt ? 'Pe disc · ' + formatDateTime(state.lastSavedAt) : 'Date încărcate de pe disc';
    if (!state.ready || state.loading) {
      status = 'pending';
      label = 'Se verifică datele…';
      detail = 'Se așteaptă confirmarea serverului';
    }
    if (draft || state.settingsDirty) {
      status = 'pending';
      label = 'Modificări nesalvate';
      detail = 'Apasă Salvează pentru a le păstra pe disc';
    }
    if (state.pending || state.busy || state.settingsBusy) {
      status = 'pending';
      label = 'Se salvează…';
      detail = 'Așteaptă confirmarea înainte de închidere';
    }
    if (backupError) {
      status = 'error';
      label = 'Problemă la backup';
      detail = backupError;
    }
    if (state.saveError || state.settingsError) {
      status = 'error';
      label = 'Salvare neconfirmată';
      detail = state.saveError || state.settingsError;
    }
    if (state.connectionError) {
      status = 'error';
      label = 'Conexiune întreruptă';
      detail = state.connectionError;
    }
    elements.indicator.dataset.state = status;
    elements.status.textContent = label;
    elements.detail.textContent = detail;
    elements.indicator.title =
      detail +
      (state.lastSavedAt ? '\nUltima salvare confirmată: ' + formatDateTime(state.lastSavedAt) : '') +
      '\nSalvarea locală nu confirmă sincronizarea Google Drive.';
  }
  return { renderSaveStatus };
}
