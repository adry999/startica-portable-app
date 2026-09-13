import { escapeHtml } from '#shared/format/html-escape.mjs';
import { formatDateTime } from '#shared/format/date-format.mjs';
import { recordsSummaryMarkup } from '#shared/ui/records-summary.mjs';

/** @typedef {import('../backup.types.mjs').BackupControllerDependencies} BackupControllerDependencies */

/** @param {BackupControllerDependencies} dependencies */
export function createBackupController({
  elements: {
    backupButton,
    restoreButton,
    restoreDialog,
    backupSelect,
    restoreConfirm,
    restorePreview,
    commitRestore,
    settingsForm,
    externalDirInput,
  },
  sessionState,
  requestJson,
  submitMutation,
  acceptResult,
  showNotice,
  renderSaveStatus,
}) {
  // Ținută local: nimic altceva din interfață nu are nevoie de backupul ales pentru restaurare.
  /** @type {{ name: string, revision: number } | null} */
  let restoreData = null;

  async function previewRestore() {
    restoreData = null;
    commitRestore.disabled = true;
    const name = backupSelect.value;
    if (!name) return;
    const preview = await requestJson('/api/backup-preview?name=' + encodeURIComponent(name));
    // Selecția s-a schimbat cât timp răspunsul era pe drum.
    if (backupSelect.value !== name) return;
    restoreData = { name, revision: sessionState.revision };
    restorePreview.innerHTML =
      recordsSummaryMarkup(preview) +
      preview.errors.map(/** @param {string} error */ error => `<p class="danger">${escapeHtml(error)}</p>`).join('');
    commitRestore.disabled = !!preview.errors.length;
  }

  backupButton.onclick = async () => {
    backupButton.disabled = true;
    try {
      const result = await requestJson('/api/backup', {});
      acceptResult(result);
      if (!result.warning) showNotice('Backup local verificat creat.');
    } catch (error) {
      showNotice(/** @type {Error} */ (error).message, true);
    } finally {
      backupButton.disabled = false;
    }
  };

  restoreButton.onclick = async () => {
    try {
      const backups = await requestJson('/api/backups');
      if (!backups.length) throw Error('Nu există backupuri.');
      backupSelect.innerHTML = backups
        .map(
          /** @param {{ name: string, modified: string }} entry */
          entry =>
            `<option value="${escapeHtml(entry.name)}">${escapeHtml(formatDateTime(entry.modified))} · ${escapeHtml(entry.name)}</option>`,
        )
        .join('');
      restoreConfirm.value = '';
      restoreDialog.showModal();
      await previewRestore();
    } catch (error) {
      showNotice(/** @type {Error} */ (error).message, true);
    }
  };

  backupSelect.onchange = () => previewRestore().catch(error => showNotice(/** @type {Error} */ (error).message, true));

  commitRestore.onclick = async () => {
    if (!restoreData) return;
    commitRestore.disabled = true;
    try {
      await submitMutation(
        '/api/restore',
        { name: restoreData.name, confirm: restoreConfirm.value },
        restoreData.revision,
      );
      restoreDialog.close();
    } catch (error) {
      showNotice(/** @type {Error} */ (error).message, true);
    } finally {
      commitRestore.disabled = false;
    }
  };

  settingsForm.onsubmit = async event => {
    event.preventDefault();
    if (sessionState.settingsBusy || sessionState.pending || sessionState.busy) return;
    const submitButton = /** @type {HTMLButtonElement} */ (settingsForm.querySelector('button'));
    submitButton.disabled = true;
    externalDirInput.disabled = true;
    sessionState.settingsBusy = true;
    sessionState.settingsError = '';
    renderSaveStatus();
    try {
      const result = await requestJson('/api/settings', { externalDir: externalDirInput.value });
      sessionState.settingsDirty = false;
      acceptResult(result);
      if (!result.warning)
        showNotice(
          sessionState.health.externalDir
            ? 'Copia în folderul extern a fost verificată. Confirmă separat sincronizarea în Google Drive.'
            : 'Backup local configurat.',
        );
    } catch (error) {
      sessionState.settingsError = /** @type {Error} */ (error).message;
      showNotice(/** @type {Error} */ (error).message, true);
    } finally {
      submitButton.disabled = false;
      externalDirInput.disabled = false;
      sessionState.settingsBusy = false;
      renderSaveStatus();
    }
  };

  return {};
}
