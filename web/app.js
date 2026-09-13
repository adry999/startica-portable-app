import { $ } from './ui/dom.mjs';
import { session, message, load, setRenderers, renderSaveStatus, checkConnection, api } from './ui/session.mjs';
import { createAuditLogApi, createAuditLogController, createAuditLogView } from '#features/audit-log/index.web.mjs';
import { bindMonthPicker } from '#app/web/month-picker.mjs';
import { bindMobileNavigation } from '#app/web/mobile-navigation.mjs';
import { bindUnsavedChangesGuard } from '#app/web/unsaved-changes-guard.mjs';
import { pages } from './ui/parts.mjs';
import {
  go,
  render,
  renderList,
  renderHealth,
  profile,
  onViewOpened,
  bindGroups,
  bindCategories,
  bindBulkAction,
} from './ui/views.mjs';
import { openEditor, bindEditorForm, archive, deleteRecord, confirmReview } from './ui/editor.mjs';
import { bindTransfers } from './ui/transfers.mjs';
import { bindFees } from './ui/fees.mjs';
import { bindAssign } from './ui/assign.mjs';

const HEALTH_POLL_MS = 30000;
const LISTS = ['children', 'payments', 'expenses'];

setRenderers({ render, health: renderHealth });
bindEditorForm();
bindTransfers();
bindFees();
bindAssign();

const auditLog = createAuditLogController({
  fetchAuditPage: createAuditLogApi({ requestJson: api }).fetchAuditPage,
  renderAuditLog: createAuditLogView({
    listElement: $('auditList'),
    loadMoreButton: $('auditMore'),
    failureElement: $('auditFailure'),
  }),
});
onViewOpened('audit', auditLog.openFirstPage);
$('auditMore').onclick = () => void auditLog.loadNextPage();
bindGroups();
bindCategories();
bindBulkAction('children');
bindBulkAction('payments');
bindBulkAction('expenses');

// Calendarul se leagă înaintea navigației mobile: ascultătorul lui de Escape
// oprește propagarea când închide calendarul, ca cele două să nu reacționeze
// amândouă la aceeași apăsare (vezi month-picker.mjs).
bindMonthPicker({ byId: $, onMonthChange: render });
bindMobileNavigation({ byId: $ });

// Un singur ascultător pentru toate butoanele generate dinamic: rândurile din
// tabele se redesenează des, iar ascultătorii individuali s-ar pierde.
document.addEventListener('click', async event => {
  const b = event.target.closest('button');
  if (!b) return;
  try {
    if (b.dataset.view) go(b.dataset.view);
    if (b.dataset.scroll) $(b.dataset.scroll).scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (b.dataset.create) openEditor(b.dataset.create);
    if (b.dataset.close) {
      if (session.busy) {
        message('Așteaptă confirmarea salvării.', true);
        return;
      }
      $(b.dataset.close).close();
    }
    if (b.dataset.page) {
      pages[b.dataset.page] = Math.max(0, pages[b.dataset.page] + Number(b.dataset.delta));
      render();
    }
    const { action, type, id } = b.dataset;
    if (action === 'edit') openEditor(type, id);
    if (action === 'archive') {
      // Fără fereastră de confirmare: primul click doar cere confirmarea,
      // rămâne fix pe rând; al doilea, în 4 secunde, chiar arhivează.
      if (!b.classList.contains('confirm-pending')) {
        b.classList.add('confirm-pending');
        b.dataset.label = b.textContent;
        b.textContent = 'Sigur?';
        b._confirmTimer = setTimeout(() => {
          b.classList.remove('confirm-pending');
          b.textContent = b.dataset.label;
        }, 4000);
      } else {
        clearTimeout(b._confirmTimer);
        await archive(type, id);
      }
    }
    if (action === 'delete') await deleteRecord(type, id);
    if (action === 'profile') profile(id);
    if (action === 'confirm-review') await confirmReview(id);
  } catch (e) {
    message(e.message, true);
  }
});

// ─── Filtre ─────────────────────────────────────────────────────────────────

for (const type of LISTS)
  for (const suffix of ['Search', 'Archive', 'MonthFrom', 'MonthTo', 'Category', 'Child', 'Method'])
    if ($(`${type}${suffix}`))
      $(`${type}${suffix}`).oninput = () => {
        pages[type] = 0;
        renderList(type);
      };

const refreshReview = () => {
  pages.review = 0;
  render();
};
$('reviewFilter').onchange = refreshReview;
$('reviewSearch').oninput = refreshReview;
$('reviewReset').onclick = () => {
  $('reviewFilter').value = 'all';
  $('reviewSearch').value = '';
  refreshReview();
};

// ─── Antet și istoric ───────────────────────────────────────────────────────

$('reloadButton').onclick = async () => {
  try {
    const recovering = !!session.pending;
    await load();
    // După recuperarea unei operațiuni neconfirmate, formularele deschise pot
    // conține date depășite: se închid, iar utilizatorul redeschide ce trebuie.
    if (recovering) {
      for (const id of ['editor', 'importDialog', 'restoreDialog', 'csvDialog']) $(id).close();
      session.csvData = null;
      session.editor = null;
    }
    message(
      recovering
        ? 'Date reîncărcate. Formularul deschis a fost închis — redeschide înregistrarea dacă mai ai nevoie de ea.'
        : 'Date reîncărcate.',
    );
  } catch (e) {
    message(e.message, true);
  }
};
function printView(view) {
  document.body.dataset.printView = view;
  window.print();
}
window.addEventListener('afterprint', () => delete document.body.dataset.printView);
$('printButton').onclick = () => printView('status');
$('printNotify').onclick = () => printView('notify');

// ─── Starea formularelor ────────────────────────────────────────────────────

$('editorForm').addEventListener('input', () => {
  session.editorDirty = true;
  renderSaveStatus();
});
$('editorForm').addEventListener(
  'invalid',
  () => {
    session.saveError = 'Verifică și completează câmpurile marcate în formular.';
    renderSaveStatus();
  },
  true,
);
$('editor').addEventListener('close', () => {
  session.editorDirty = false;
  renderSaveStatus();
});
$('externalDir').addEventListener('input', () => {
  session.settingsDirty = $('externalDir').value !== (session.health.externalDir || '');
  renderSaveStatus();
});

bindUnsavedChangesGuard({ readState: () => session, isEditorOpen: () => $('editor').open });

// ─── Pornire ────────────────────────────────────────────────────────────────

setInterval(checkConnection, HEALTH_POLL_MS);
window.addEventListener('focus', checkConnection);
load().catch(e => message('Pornește aplicația din Porneste_Startica.cmd. ' + e.message, true));
