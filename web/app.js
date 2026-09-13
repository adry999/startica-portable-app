import { $ } from './ui/dom.mjs';
import {
  session,
  message,
  load,
  setRenderers,
  renderSaveStatus,
  checkConnection,
  api,
  accept,
  mutate,
  eventBus,
} from './ui/session.mjs';
import { createBackupController, createBackupHealthView } from '#features/backup/index.web.mjs';
import { createAuditLogApi, createAuditLogController, createAuditLogView } from '#features/audit-log/index.web.mjs';
import {
  createPaymentAssignmentApi,
  createPaymentAssignmentController,
  createPaymentAssignmentView,
} from '#features/payment-assignment/index.web.mjs';
import { createReviewCenterView } from '#features/review-center/index.web.mjs';
import { createGroupsController } from '#features/groups/index.web.mjs';
import { createExpenseCategoriesController } from '#features/expenses/index.web.mjs';
import { DomainEvent } from '#shared/contracts/domain-events.mjs';
import { today } from '#shared/domain/calendar-month.mjs';
import { setNavCount } from '#shared/ui/nav-count-badge.mjs';
import { selectedMonth } from './ui/view-helpers.mjs';
import { bindMonthPicker } from '#app/web/month-picker.mjs';
import { bindMobileNavigation } from '#app/web/mobile-navigation.mjs';
import { bindUnsavedChangesGuard } from '#app/web/unsaved-changes-guard.mjs';
import { pages } from './ui/parts.mjs';
import { go, render, renderList, profile, registerScreen, onRender, bindBulkAction } from './ui/views.mjs';
import { openEditor, bindEditorForm, archive, deleteRecord, confirmReview } from './ui/editor.mjs';
import { bindTransfers } from './ui/transfers.mjs';
import { createFeeSetupController } from '#features/fee-setup/index.web.mjs';

const HEALTH_POLL_MS = 30000;
const LISTS = ['children', 'payments', 'expenses'];

const renderBackupHealth = createBackupHealthView({
  elements: { status: $('backupStatus'), details: $('healthDetails'), externalDirInput: $('externalDir') },
  isExternalDirLocked: () => session.settingsDirty || session.settingsBusy,
});
setRenderers({
  render,
  health: () => {
    renderBackupHealth(session.health);
    renderSaveStatus();
  },
});
createBackupController({
  elements: {
    backupButton: $('backupButton'),
    restoreButton: $('restoreButton'),
    restoreDialog: $('restoreDialog'),
    backupSelect: $('backupSelect'),
    restoreConfirm: $('restoreConfirm'),
    restorePreview: $('restorePreview'),
    commitRestore: $('commitRestore'),
    settingsForm: $('settingsForm'),
    externalDirInput: $('externalDir'),
  },
  sessionState: session,
  requestJson: api,
  submitMutation: mutate,
  acceptResult: accept,
  showNotice: message,
  renderSaveStatus,
});
bindEditorForm();
bindTransfers();

const auditLog = createAuditLogController({
  fetchAuditPage: createAuditLogApi({ requestJson: api }).fetchAuditPage,
  renderAuditLog: createAuditLogView({
    listElement: $('auditList'),
    loadMoreButton: $('auditMore'),
    failureElement: $('auditFailure'),
  }),
});
registerScreen('audit', { activate: auditLog.openFirstPage });
$('auditMore').onclick = () => void auditLog.loadNextPage();

const paymentAssignmentApi = createPaymentAssignmentApi({ submitMutation: mutate });
const paymentAssignment = createPaymentAssignmentController({
  readRecords: () => session.state,
  readSelectedMonth: selectedMonth,
  readToday: today,
  submitAssignments: async assignments => {
    const result = await paymentAssignmentApi.submitAssignments(assignments);
    if (!result.warning) message(`${assignments.length} achitări asociate.`);
    return result;
  },
  eventBus,
  renderAssignmentScreen: createPaymentAssignmentView({
    elements: {
      risk: $('assignRisk'),
      summary: $('assignInfo'),
      tableBody: $('assignTable'),
      saveButton: $('assignSave'),
      failure: $('assignError'),
    },
    readChildren: () => session.state.children,
    readSelectedMonth: selectedMonth,
    onSelectChild: (paymentId, childId) => paymentAssignment.selectChild(paymentId, childId),
  }),
  renderUnassignedCount: count => setNavCount('assignCount', count),
});
registerScreen('assign', paymentAssignment);
$('assignFillSuggested').onclick = () => {
  const filled = paymentAssignment.selectUnambiguousNameMatches();
  message(
    filled
      ? `${filled} rânduri completate acolo unde numele din sursă indică un singur copil. Verifică-le înainte de a salva.`
      : 'Niciun rând nu are un nume potrivit fără ambiguitate. Alege manual.',
    !filled,
  );
};
$('assignClear').onclick = () => {
  paymentAssignment.clearSelections();
  message('Selecțiile au fost golite.');
};
$('assignSave').onclick = () => void paymentAssignment.saveSelections();

const renderReviewCenter = createReviewCenterView({
  elements: {
    progress: $('reviewProgress'),
    list: $('reviewList'),
    filter: $('reviewFilter'),
    search: $('reviewSearch'),
  },
  readRecords: () => session.state,
});
const groups = createGroupsController({
  elements: {
    grid: $('groupsGrid'),
    createForm: $('groupCreateForm'),
    nameInput: $('groupNameInput'),
    capacityInput: $('groupCapacityInput'),
  },
  readRecords: () => session.state,
  submitMutation: mutate,
  showNotice: message,
});
const expenseCategories = createExpenseCategoriesController({
  elements: {
    chips: $('categoriesChips'),
    createForm: $('categoryCreateForm'),
    nameInput: $('categoryNameInput'),
    categoryFilter: $('expensesCategory'),
  },
  readRecords: () => session.state,
  submitMutation: mutate,
  showNotice: message,
});
const feeSetup = createFeeSetupController({
  elements: {
    info: $('feesInfo'),
    table: $('feesTable'),
    pending: $('feesPending'),
    filter: $('feesFilter'),
    bulkAmount: $('feesBulkAmount'),
    bulkGroup: $('feesBulkGroup'),
    bulkStatus: $('feesBulkStatus'),
    applyAll: $('feesApplyAll'),
    save: $('feesSave'),
    failure: $('feesError'),
  },
  readRecords: () => session.state,
  readToday: today,
  submitMutation: mutate,
  showNotice: message,
  renderMissingFeeCount: count => setNavCount('feesCount', count),
});
onRender(({ review }) => {
  feeSetup.render();
  groups.render();
  expenseCategories.render();
  renderReviewCenter(review);
});
bindBulkAction('children');
bindBulkAction('payments');
bindBulkAction('expenses');

// Calendarul se leagă înaintea navigației mobile: ascultătorul lui de Escape
// oprește propagarea când închide calendarul, ca cele două să nu reacționeze
// amândouă la aceeași apăsare (vezi month-picker.mjs).
bindMonthPicker({
  byId: $,
  onMonthChange: () => {
    render();
    eventBus.publish(DomainEvent.SelectedMonthChanged, { month: selectedMonth() });
  },
});
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
