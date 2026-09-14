import { confirmOnSecondClick } from '#shared/ui/confirm-twice-button.mjs';
import { byId } from '#shared/ui/element-lookup.mjs';
import { setNavCount } from '#shared/ui/nav-count-badge.mjs';
import { pageIndexByList } from '#shared/ui/pagination.mjs';
import { today } from '#shared/domain/calendar-month.mjs';
import { DomainEvent } from '#shared/contracts/domain-events.mjs';
import { createAuditLogApi, createAuditLogController, createAuditLogView } from '#features/audit-log/index.web.mjs';
import { createBackupController, createBackupHealthView } from '#features/backup/index.web.mjs';
import {
  createNotifyListView,
  createPaymentStatusView,
  evaluateChildrenForMonth,
} from '#features/billing/index.web.mjs';
import {
  buildBirthdayCalendar,
  childEditorFields,
  createChildProfileView,
  createChildrenCsvDialog,
  createChildrenListView,
  listUpcomingBirthdays,
} from '#features/children/index.web.mjs';
import { createChildrenSummaryView, createDashboardView } from '#features/dashboard/index.web.mjs';
import { createExcelTransferController, loadXLSX } from '#features/data-transfer/index.web.mjs';
import {
  createExpenseCategoriesController,
  createExpensesListView,
  expenseEditorFields,
  listExpenseCategoryNames,
} from '#features/expenses/index.web.mjs';
import { createFeeSetupController } from '#features/fee-setup/index.web.mjs';
import { createGroupsController } from '#features/groups/index.web.mjs';
import {
  createPaymentAssignmentApi,
  createPaymentAssignmentController,
  createPaymentAssignmentView,
  findUnassignedPaymentHintsByChild,
} from '#features/payment-assignment/index.web.mjs';
import { createPaymentsListView, paymentEditorFields } from '#features/payments/index.web.mjs';
import { createRecordEditorDialog } from '#features/record-editing/index.web.mjs';
import { buildReviewCenter, createReviewCenterView, findRecordIssues } from '#features/review-center/index.web.mjs';
import {
  acceptResult,
  checkConnection,
  eventBus,
  loadSession,
  renderSaveStatus,
  requestJson,
  sessionState,
  setRenderers,
  showNotice,
  submitMutation as submitStoreMutation,
} from './app-session.mjs';
import { bindMobileNavigation } from './mobile-navigation.mjs';
import { bindMonthPicker, readSelectedMonth } from './month-picker.mjs';
import { createNavigation } from './navigation.mjs';
import { createRenderCycle } from './render-cycle.mjs';
import { bindUnsavedChangesGuard } from './unsaved-changes-guard.mjs';

const HEALTH_POLL_MS = 30000;

// Compoziția leagă id-uri din index.html de factory-uri tipate; tipul exact îl verifică fiecare factory.
/**
 * @param {string} id
 * @returns {any}
 */
const element = id => byId(id);
const readRecords = () => sessionState.state;
// Feature-urile trimit corpuri tipate diferit; store-ul le completează cu revizia și requestId-ul.
const submitMutation = /** @type {(path: string, body: any, base?: number) => Promise<any>} */ (submitStoreMutation);

const navigation = createNavigation({ byId });

const renderCycle = createRenderCycle({
  readRecords,
  readSelectedMonth,
  readToday: today,
  buildReviewCenter,
  evaluateChildrenForMonth,
  findUnassignedPaymentHintsByChild,
  reportRenderFailure: (_screenName, failure) => showNotice(failure.message, true),
});
// Abonate înaintea celorlalte ecrane: la reîncărcare și la schimbarea lunii se randează întâi tot, ca înainte.
eventBus.subscribe(DomainEvent.RecordsReloaded, () => renderCycle.render());
eventBus.subscribe(DomainEvent.SelectedMonthChanged, () => renderCycle.render());

const renderBackupHealth = createBackupHealthView({
  elements: {
    status: element('backupStatus'),
    details: element('healthDetails'),
    externalDirInput: element('externalDir'),
  },
  isExternalDirLocked: () => sessionState.settingsDirty || sessionState.settingsBusy,
});
setRenderers({
  render: () => {},
  health: () => {
    renderBackupHealth(/** @type {any} */ (sessionState.health));
    renderSaveStatus();
  },
});
createBackupController({
  elements: {
    backupButton: element('backupButton'),
    restoreButton: element('restoreButton'),
    restoreDialog: element('restoreDialog'),
    backupSelect: element('backupSelect'),
    restoreConfirm: element('restoreConfirm'),
    restorePreview: element('restorePreview'),
    commitRestore: element('commitRestore'),
    settingsForm: element('settingsForm'),
    externalDirInput: element('externalDir'),
  },
  sessionState: /** @type {any} */ (sessionState),
  requestJson,
  submitMutation,
  acceptResult,
  showNotice,
  renderSaveStatus,
});
createExcelTransferController({
  elements: {
    importButton: element('importButton'),
    excelInput: element('excelInput'),
    importPreview: element('importPreview'),
    importDialog: element('importDialog'),
    importConfirm: element('importConfirm'),
    commitImport: element('commitImport'),
    exportButton: element('exportButton'),
  },
  sessionState,
  readRecords,
  requestJson,
  submitMutation,
  showNotice,
  loadXlsx: loadXLSX,
  findRecordIssues,
});
createChildrenCsvDialog({
  elements: {
    importButton: element('importChildrenButton'),
    fileInput: element('childrenCsvInput'),
    dialog: element('csvDialog'),
    preview: element('csvPreview'),
    confirmInput: element('csvConfirm'),
    commitButton: element('commitCsv'),
    errorText: element('csvError'),
  },
  sessionState,
  requestJson,
  submitMutation,
  showNotice,
});
const childProfile = createChildProfileView({
  elements: { body: element('profileBody'), dialog: element('profile') },
  readRecords,
  readSelectedMonth,
});

const auditLog = createAuditLogController({
  fetchAuditPage: createAuditLogApi({ requestJson }).fetchAuditPage,
  renderAuditLog: createAuditLogView({
    listElement: element('auditList'),
    loadMoreButton: element('auditMore'),
    failureElement: element('auditFailure'),
  }),
});
navigation.registerScreen('audit', { activate: auditLog.openFirstPage });
element('auditMore').onclick = () => void auditLog.loadNextPage();

const paymentAssignmentApi = createPaymentAssignmentApi({ submitMutation });
const paymentAssignment = createPaymentAssignmentController({
  readRecords,
  readSelectedMonth,
  readToday: today,
  submitAssignments: async assignments => {
    const result = /** @type {{ warning?: string }} */ (await paymentAssignmentApi.submitAssignments(assignments));
    if (!result.warning) showNotice(`${assignments.length} achitări asociate.`);
    return result;
  },
  eventBus,
  renderAssignmentScreen: createPaymentAssignmentView({
    elements: {
      risk: element('assignRisk'),
      summary: element('assignInfo'),
      tableBody: element('assignTable'),
      saveButton: element('assignSave'),
      failure: element('assignError'),
    },
    readChildren: () => readRecords().children,
    readSelectedMonth,
    onSelectChild: (paymentId, childId) => paymentAssignment.selectChild(paymentId, childId),
  }),
  renderUnassignedCount: count => setNavCount('assignCount', count),
});
navigation.registerScreen('assign', paymentAssignment);
element('assignFillSuggested').onclick = () => {
  const filled = paymentAssignment.selectUnambiguousNameMatches();
  showNotice(
    filled
      ? `${filled} rânduri completate acolo unde numele din sursă indică un singur copil. Verifică-le înainte de a salva.`
      : 'Niciun rând nu are un nume potrivit fără ambiguitate. Alege manual.',
    !filled,
  );
};
element('assignClear').onclick = () => {
  paymentAssignment.clearSelections();
  showNotice('Selecțiile au fost golite.');
};
element('assignSave').onclick = () => void paymentAssignment.saveSelections();

const recordEditor = createRecordEditorDialog({
  elements: {
    editor: element('editor'),
    editorForm: element('editorForm'),
    editorTitle: element('editorTitle'),
    editorFields: element('editorFields'),
    editorError: element('editorError'),
    editorSave: element('editorSave'),
  },
  fieldsByType: { children: childEditorFields, payments: paymentEditorFields, expenses: expenseEditorFields },
  sessionState,
  readRecords,
  submitMutation,
  showNotice,
  renderSaveStatus,
  readExpenseCategoryNames: () => listExpenseCategoryNames(readRecords()),
});

// ─── Ecranele randate la fiecare reîncărcare a datelor ──────────────────────

const renderDashboard = createDashboardView({
  elements: {
    incomeStat: element('incomeStat'),
    expenseStat: element('expenseStat'),
    netStat: element('netStat'),
    incomeMethods: element('incomeMethods'),
    advanceStat: element('advanceStat'),
    alerts: element('alerts'),
    bars: element('bars'),
    birthdaysHighlightCount: element('birthdaysHighlightCount'),
    birthdaysHighlightDetail: element('birthdaysHighlightDetail'),
    birthdaysUpcoming: element('birthdaysUpcoming'),
    birthdaysCalendar: element('birthdaysCalendar'),
  },
  readRecords,
  readToday: today,
  listUpcomingBirthdays,
  buildBirthdayCalendar,
  renderReviewCount: count => setNavCount('reviewCount', count),
});
const renderChildrenSummary = createChildrenSummaryView({
  elements: {
    activeChildren: element('activeChildrenStat'),
    occupiedGroups: element('occupiedGroupsStat'),
    incompleteChildren: element('incompleteChildrenStat'),
  },
  readRecords,
});
const renderPaymentStatus = createPaymentStatusView({
  elements: { period: element('statusPeriod'), table: element('statusTable') },
  readToday: today,
  requestRender: () => renderCycle.render(),
});
const renderNotifyList = createNotifyListView({
  elements: { period: element('notifyPeriod'), stats: element('notifyStats'), table: element('notifyTable') },
  readRecords,
  readToday: today,
  requestRender: () => renderCycle.render(),
  renderNotifyCount: count => setNavCount('notifyCount', count),
});
const listDependencies = { readRecords, submitMutation, showNotice };
const childrenList = createChildrenListView({
  elements: {
    search: element('childrenSearch'),
    archive: element('childrenArchive'),
    head: element('childrenHead'),
    table: element('childrenTable'),
    summaryText: element('childrenSummaryText'),
    bulkButton: element('childrenBulkAction'),
  },
  ...listDependencies,
});
const paymentsList = createPaymentsListView({
  elements: {
    search: element('paymentsSearch'),
    child: element('paymentsChild'),
    method: element('paymentsMethod'),
    monthFrom: element('paymentsMonthFrom'),
    monthTo: element('paymentsMonthTo'),
    archive: element('paymentsArchive'),
    head: element('paymentsHead'),
    table: element('paymentsTable'),
    summaryText: element('paymentsSummaryText'),
    bulkButton: element('paymentsBulkArchive'),
  },
  ...listDependencies,
});
const expensesList = createExpensesListView({
  elements: {
    search: element('expensesSearch'),
    monthFrom: element('expensesMonthFrom'),
    monthTo: element('expensesMonthTo'),
    category: element('expensesCategory'),
    archive: element('expensesArchive'),
    head: element('expensesHead'),
    table: element('expensesTable'),
    summaryText: element('expensesSummaryText'),
    bulkButton: element('expensesBulkArchive'),
  },
  ...listDependencies,
});
const feeSetup = createFeeSetupController({
  elements: {
    info: element('feesInfo'),
    table: element('feesTable'),
    pending: element('feesPending'),
    filter: element('feesFilter'),
    bulkAmount: element('feesBulkAmount'),
    bulkGroup: element('feesBulkGroup'),
    bulkStatus: element('feesBulkStatus'),
    applyAll: element('feesApplyAll'),
    save: element('feesSave'),
    failure: element('feesError'),
  },
  readRecords,
  readToday: today,
  submitMutation,
  showNotice,
  renderMissingFeeCount: count => setNavCount('feesCount', count),
});
const groups = createGroupsController({
  elements: {
    grid: element('groupsGrid'),
    createForm: element('groupCreateForm'),
    nameInput: element('groupNameInput'),
    capacityInput: element('groupCapacityInput'),
  },
  readRecords,
  submitMutation,
  showNotice,
});
const expenseCategories = createExpenseCategoriesController({
  elements: {
    chips: element('categoriesChips'),
    createForm: element('categoryCreateForm'),
    nameInput: element('categoryNameInput'),
    categoryFilter: element('expensesCategory'),
  },
  readRecords,
  submitMutation,
  showNotice,
});
const renderReviewCenter = createReviewCenterView({
  elements: {
    progress: element('reviewProgress'),
    list: element('reviewList'),
    filter: element('reviewFilter'),
    search: element('reviewSearch'),
  },
  readRecords,
});

// Ordinea de dinainte de migrare: listele citesc filtrul de categorie înainte ca lista de categorii să-i refacă opțiunile.
renderCycle.addScreen('dashboard', ({ month, review, activeEvaluations }) =>
  renderDashboard({ month, review, evaluations: activeEvaluations }),
);
renderCycle.addScreen('children-summary', ({ review }) => renderChildrenSummary({ review }));
renderCycle.addScreen('payment-status', ({ month, evaluations }) => renderPaymentStatus({ month, evaluations }));
renderCycle.addScreen('notify-list', ({ month, activeEvaluations, unassignedPaymentHintsByChild }) =>
  renderNotifyList({ month, evaluations: activeEvaluations, unassignedPaymentHintsByChild }),
);
renderCycle.addScreen('children-list', () => childrenList.render());
renderCycle.addScreen('payments-list', () => paymentsList.render());
renderCycle.addScreen('expenses-list', () => expensesList.render());
renderCycle.addScreen('fee-setup', () => feeSetup.render());
renderCycle.addScreen('groups', () => groups.render());
renderCycle.addScreen('expense-categories', () => expenseCategories.render());
renderCycle.addScreen('review-center', ({ review }) => renderReviewCenter(review));

// Calendarul se leagă înaintea navigației mobile: ascultătorul lui de Escape oprește propagarea
// când închide calendarul, ca cele două să nu reacționeze la aceeași apăsare.
bindMonthPicker({
  byId: element,
  onMonthChange: () => eventBus.publish(DomainEvent.SelectedMonthChanged, { month: readSelectedMonth() }),
});
bindMobileNavigation({ byId: element });

// Un singur ascultător pentru toate butoanele generate dinamic: rândurile din tabele se redesenează des.
document.addEventListener('click', async event => {
  const button = /** @type {HTMLButtonElement | null} */ (/** @type {HTMLElement} */ (event.target).closest('button'));
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

bindUnsavedChangesGuard({ readState: () => sessionState, isEditorOpen: () => element('editor').open });

// ─── Pornire ────────────────────────────────────────────────────────────────

setInterval(checkConnection, HEALTH_POLL_MS);
window.addEventListener('focus', checkConnection);
loadSession().catch(error =>
  showNotice('Pornește aplicația din Porneste_Startica.cmd. ' + /** @type {Error} */ (error).message, true),
);
