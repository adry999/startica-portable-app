import { escapeHtml } from '#shared/format/html-escape.mjs';
import { formatDateTime } from '#shared/format/date-format.mjs';
import { today } from '#shared/domain/calendar-month.mjs';
import { recordsSummaryMarkup } from '#shared/ui/records-summary.mjs';

/** @typedef {import('../backup.types.mjs').BackupControllerDependencies} BackupControllerDependencies */

// O zi în ms, ca la starea de sănătate a backupului: peste atât, cea mai recentă copie externă atrage atenția.
const STALE_AFTER_MS = 86400000;

/** @param {BackupControllerDependencies} dependencies */
export function createBackupController({
  elements: {
    backupButton,
    restoreButton,
    restoreDialog,
    restoreSource,
    restoreExternal,
    restoreFolder,
    restoreFolderLoad,
    backupSelect,
    restoreConfirm,
    restorePreview,
    commitRestore,
    settingsForm,
    externalDirInput,
    diagnosticButton,
  },
  sessionState,
  requestJson,
  submitMutation,
  acceptResult,
  showNotice,
  renderSaveStatus,
}) {
  // Ținută local: nimic altceva din interfață nu are nevoie de backupul ales pentru restaurare.
  /** @type {{ name: string, dir: string, revision: number } | null} */
  let restoreData = null;
  // Notița de vechime a folderului extern, afișată sub listă; previewRestore() o păstrează la fiecare rerandare.
  let staleFolderNotice = '';

  const selectedSource = () => /** @type {HTMLInputElement} */ (restoreSource.querySelector('input:checked')).value;
  const currentDir = () => (selectedSource() === 'extern' ? restoreFolder.value.trim() : '');

  function clearRestoreSelection() {
    restoreData = null;
    backupSelect.innerHTML = '';
    restorePreview.innerHTML = '';
    commitRestore.disabled = true;
    staleFolderNotice = '';
  }

  async function previewRestore() {
    restoreData = null;
    commitRestore.disabled = true;
    const name = backupSelect.value;
    if (!name) return;
    const dir = currentDir();
    const query =
      '/api/backup-preview?name=' + encodeURIComponent(name) + (dir ? '&dir=' + encodeURIComponent(dir) : '');
    let preview;
    try {
      preview = await requestJson(query);
    } catch (error) {
      // Selecția s-a schimbat cât timp răspunsul era pe drum.
      if (backupSelect.value !== name || currentDir() !== dir) return;
      const message = /** @type {Error} */ (error).message;
      restorePreview.innerHTML = staleFolderNotice + `<p class="danger">${escapeHtml(message)}</p>`;
      commitRestore.disabled = true;
      return;
    }
    if (backupSelect.value !== name || currentDir() !== dir) return;
    restoreData = { name, dir, revision: sessionState.revision };
    restorePreview.innerHTML =
      staleFolderNotice +
      recordsSummaryMarkup(preview) +
      (preview.notes || [])
        .map(/** @param {string} note */ note => `<p class="notice">${escapeHtml(note)}</p>`)
        .join('') +
      preview.errors.map(/** @param {string} error */ error => `<p class="danger">${escapeHtml(error)}</p>`).join('');
    commitRestore.disabled = !!preview.errors.length;
  }

  async function loadLocalBackups() {
    clearRestoreSelection();
    const backups = await requestJson('/api/backups');
    if (selectedSource() !== 'local') return;
    if (!backups.length) {
      restorePreview.innerHTML = '<p class="notice">Nu există backupuri locale.</p>';
      return;
    }
    backupSelect.innerHTML = backups
      .map(
        /** @param {{ name: string, modified: string }} entry */
        entry =>
          `<option value="${escapeHtml(entry.name)}">${escapeHtml(formatDateTime(entry.modified))} · ${escapeHtml(entry.name)}</option>`,
      )
      .join('');
    await previewRestore();
  }

  async function loadExternalBackups() {
    clearRestoreSelection();
    const dir = restoreFolder.value.trim();
    restoreFolderLoad.disabled = true;
    try {
      const { backups } = await requestJson('/api/external-backups?dir=' + encodeURIComponent(dir));
      if (selectedSource() !== 'extern' || restoreFolder.value.trim() !== dir) return;
      if (!backups.length) {
        restorePreview.innerHTML = '<p class="danger">Nu există copii Startica în acest folder.</p>';
        return;
      }
      backupSelect.innerHTML = backups
        .map(
          /** @param {{ name: string, modified: string }} entry */
          (entry, index) =>
            `<option value="${escapeHtml(entry.name)}">${escapeHtml(formatDateTime(entry.modified))} · ${escapeHtml(entry.name)}${index === 0 ? ' · cea mai recentă' : ''}</option>`,
        )
        .join('');
      if (Date.now() - new Date(backups[0].modified).getTime() > STALE_AFTER_MS)
        staleFolderNotice = `<p class="notice">Cea mai recentă copie e din ${escapeHtml(formatDateTime(backups[0].modified))}; verifică dacă Drive a terminat sincronizarea pe acest calculator.</p>`;
      await previewRestore();
    } catch (error) {
      if (selectedSource() !== 'extern' || restoreFolder.value.trim() !== dir) return;
      restorePreview.innerHTML = `<p class="danger">${escapeHtml(/** @type {Error} */ (error).message)}</p>`;
    } finally {
      restoreFolderLoad.disabled = false;
    }
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
    restoreConfirm.value = '';
    // Sursa revine mereu pe „local” la deschidere, indiferent ce era ales înainte.
    /** @type {HTMLInputElement} */ (restoreSource.querySelector('input[value="local"]')).checked = true;
    restoreExternal.hidden = true;
    if (!restoreFolder.value.trim()) restoreFolder.value = sessionState.health.externalDir || '';
    restoreDialog.showModal();
    try {
      await loadLocalBackups();
    } catch (error) {
      showNotice(/** @type {Error} */ (error).message, true);
    }
  };

  restoreSource.addEventListener('change', () => {
    clearRestoreSelection();
    restoreExternal.hidden = selectedSource() !== 'extern';
    const reload =
      selectedSource() === 'extern' ? (restoreFolder.value.trim() ? loadExternalBackups() : null) : loadLocalBackups();
    reload?.catch(error => showNotice(/** @type {Error} */ (error).message, true));
  });

  restoreFolderLoad.onclick = () =>
    loadExternalBackups().catch(error => showNotice(/** @type {Error} */ (error).message, true));

  backupSelect.onchange = () => previewRestore().catch(error => showNotice(/** @type {Error} */ (error).message, true));

  commitRestore.onclick = async () => {
    if (!restoreData) return;
    const { name, dir, revision } = restoreData;
    const wasExternalDirEmpty = !sessionState.health.externalDir;
    commitRestore.disabled = true;
    try {
      const result = await submitMutation('/api/restore', { name, dir, confirm: restoreConfirm.value }, revision);
      restoreDialog.close();
      if (dir)
        showNotice(
          'Datele au fost restaurate din folderul extern.' +
            (wasExternalDirEmpty && result.health && result.health.externalDir === dir
              ? ' Folderul a fost setat pentru copiile viitoare.'
              : ''),
        );
    } catch (error) {
      showNotice(/** @type {Error} */ (error).message, true);
    } finally {
      commitRestore.disabled = false;
    }
  };

  diagnosticButton.onclick = async () => {
    diagnosticButton.disabled = true;
    try {
      const diagnostic = await requestJson('/api/diagnostic');
      const url = URL.createObjectURL(new Blob([JSON.stringify(diagnostic, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `startica-diagnostic-${today()}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      showNotice(/** @type {Error} */ (error).message, true);
    } finally {
      diagnosticButton.disabled = false;
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
