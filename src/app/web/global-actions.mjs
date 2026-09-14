import { pageIndexByList } from '#shared/ui/pagination.mjs';
import { confirmOnSecondClick } from '#shared/ui/confirm-twice-button.mjs';

/**
 * @param {{
 *   element: (id: string) => any,
 *   sessionState: typeof import('./app-session.mjs').sessionState,
 *   navigation: ReturnType<typeof import('./navigation.mjs').createNavigation>,
 *   renderCycle: ReturnType<typeof import('./render-cycle.mjs').createRenderCycle>,
 *   recordEditor: any,
 *   childProfile: { openChildProfile: (childId: string) => void },
 *   showNotice: typeof import('./app-session.mjs').showNotice,
 *   loadSession: typeof import('./app-session.mjs').loadSession,
 *   renderSaveStatus: typeof import('./app-session.mjs').renderSaveStatus,
 * }} dependencies
 */
export function bindGlobalActions({
  element,
  sessionState,
  navigation,
  renderCycle,
  recordEditor,
  childProfile,
  showNotice,
  loadSession,
  renderSaveStatus,
}) {
  // Un singur ascultător pentru toate butoanele generate dinamic: rândurile din tabele se redesenează des.
  document.addEventListener('click', async event => {
    const button = /** @type {HTMLButtonElement | null} */ (
      /** @type {HTMLElement} */ (event.target).closest('button')
    );
    if (!button) return;
    try {
      if (button.dataset.view) navigation.go(button.dataset.view);
      if (button.dataset.scroll) element(button.dataset.scroll).scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (button.dataset.create) recordEditor.openEditor(/** @type {any} */ (button.dataset.create));
      if (button.dataset.close) {
        if (sessionState.busy) {
          showNotice('Așteaptă confirmarea salvării.', true);
          return;
        }
        element(button.dataset.close).close();
      }
      if (button.dataset.page) {
        const listId = /** @type {keyof typeof pageIndexByList} */ (button.dataset.page);
        pageIndexByList[listId] = Math.max(0, pageIndexByList[listId] + Number(button.dataset.delta));
        renderCycle.render();
      }
      // Atributele data-* vin din markup-ul generat de feature-uri, deci tipul și id-ul sunt cunoscute acolo.
      const { action } = button.dataset;
      const type = /** @type {any} */ (button.dataset.type);
      const id = /** @type {string} */ (button.dataset.id);
      if (action === 'edit') recordEditor.openEditor(type, id);
      if (action === 'archive' && confirmOnSecondClick(button, 'Sigur?')) await recordEditor.archiveRecord(type, id);
      if (action === 'delete') await recordEditor.deleteRecord(type, id);
      if (action === 'profile') childProfile.openChildProfile(id);
      if (action === 'confirm-review') await recordEditor.confirmReview(id);
      if (action === 'copy-message') {
        await navigator.clipboard.writeText(/** @type {string} */ (button.dataset.message));
        showNotice('Mesaj copiat.');
      }
    } catch (error) {
      showNotice(/** @type {Error} */ (error).message, true);
    }
  });

  // ─── Filtre ─────────────────────────────────────────────────────────────────

  const refreshReview = () => {
    pageIndexByList.review = 0;
    renderCycle.render();
  };
  element('reviewFilter').onchange = refreshReview;
  element('reviewSearch').oninput = refreshReview;
  element('reviewReset').onclick = () => {
    element('reviewFilter').value = 'all';
    element('reviewSearch').value = '';
    refreshReview();
  };

  // ─── Antet ──────────────────────────────────────────────────────────────────

  element('reloadButton').onclick = async () => {
    try {
      const recovering = !!sessionState.pending;
      await loadSession();
      // După recuperarea unei operațiuni neconfirmate, formularele deschise pot conține date depășite.
      if (recovering) {
        for (const id of ['editor', 'importDialog', 'restoreDialog', 'csvDialog']) element(id).close();
        sessionState.csvData = null;
        sessionState.editor = null;
      }
      showNotice(
        recovering
          ? 'Date reîncărcate. Formularul deschis a fost închis — redeschide înregistrarea dacă mai ai nevoie de ea.'
          : 'Date reîncărcate.',
      );
    } catch (error) {
      showNotice(/** @type {Error} */ (error).message, true);
    }
  };
  /** @param {string} view */
  function printView(view) {
    document.body.dataset.printView = view;
    window.print();
  }
  window.addEventListener('afterprint', () => delete document.body.dataset.printView);
  element('printButton').onclick = () => printView('status');
  element('printNotify').onclick = () => printView('notify');
  element('printProfile').onclick = () => printView('profile');

  // ─── Starea formularelor ────────────────────────────────────────────────────

  element('editorForm').addEventListener('input', () => {
    sessionState.editorDirty = true;
    renderSaveStatus();
  });
  element('editorForm').addEventListener(
    'invalid',
    () => {
      sessionState.saveError = 'Verifică și completează câmpurile marcate în formular.';
      renderSaveStatus();
    },
    true,
  );
  element('editor').addEventListener('close', () => {
    sessionState.editorDirty = false;
    renderSaveStatus();
  });
  element('externalDir').addEventListener('input', () => {
    sessionState.settingsDirty = element('externalDir').value !== (sessionState.health.externalDir || '');
    renderSaveStatus();
  });
}
