import { setNavCount } from '#shared/ui/nav-count-badge.mjs';
import { today } from '#shared/domain/calendar-month.mjs';
import { createAuditLogApi, createAuditLogController, createAuditLogView } from '#features/audit-log/index.web.mjs';
import { createBackupController, createBackupHealthView } from '#features/backup/index.web.mjs';
import { createNotifyListView, createPaymentStatusView } from '#features/billing/index.web.mjs';
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
import { createFeeSetupController, hasMissingFee } from '#features/fee-setup/index.web.mjs';
import { createGroupsController } from '#features/groups/index.web.mjs';
import {
  createPaymentAssignmentApi,
  createPaymentAssignmentController,
  createPaymentAssignmentView,
} from '#features/payment-assignment/index.web.mjs';
import { createPaymentsListView, paymentEditorFields } from '#features/payments/index.web.mjs';
import { createRecordEditorDialog } from '#features/record-editing/index.web.mjs';
import { createReviewCenterView, findRecordIssues } from '#features/review-center/index.web.mjs';
import {
  countVisitsForDays,
  createVisitRemindersController,
  createVisitsApi,
  createVisitsController,
  visitEditorFields,
} from '#features/visits/index.web.mjs';

/**
 * Leagă id-urile din index.html de ecranele fiecărui feature și le înregistrează în ciclul de randare.
 * @param {{
 *   element: (id: string) => any,
 *   sessionState: typeof import('./app-session.mjs').sessionState,
 *   readRecords: () => any,
 *   requestJson: typeof import('./app-session.mjs').requestJson,
 *   submitMutation: (path: string, body: any, base?: number) => Promise<any>,
 *   acceptResult: typeof import('./app-session.mjs').acceptResult,
 *   showNotice: typeof import('./app-session.mjs').showNotice,
 *   renderSaveStatus: typeof import('./app-session.mjs').renderSaveStatus,
 *   setRenderers: typeof import('./app-session.mjs').setRenderers,
 *   eventBus: typeof import('./app-session.mjs').eventBus,
 *   renderCycle: ReturnType<typeof import('./render-cycle.mjs').createRenderCycle>,
 *   navigation: ReturnType<typeof import('./navigation.mjs').createNavigation>,
 *   readSelectedMonth: () => string,
 * }} dependencies
 */
export function composeScreens(dependencies) {
  const { element, sessionState, readRecords, requestJson, submitMutation, acceptResult, showNotice } = dependencies;
  const { renderSaveStatus, setRenderers, eventBus, renderCycle, navigation, readSelectedMonth } = dependencies;

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
      restoreSource: element('restoreSource'),
      restoreExternal: element('restoreExternal'),
      restoreFolder: element('restoreFolder'),
      restoreFolderLoad: element('restoreFolderLoad'),
      backupSelect: element('backupSelect'),
      restoreConfirm: element('restoreConfirm'),
      restorePreview: element('restorePreview'),
      commitRestore: element('commitRestore'),
      settingsForm: element('settingsForm'),
      externalDirInput: element('externalDir'),
      diagnosticButton: element('diagnosticButton'),
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
    fieldsByType: {
      children: childEditorFields,
      payments: paymentEditorFields,
      expenses: expenseEditorFields,
      visits: visitEditorFields,
    },
    sessionState,
    readRecords,
    submitMutation,
    showNotice,
    renderSaveStatus,
    readExpenseCategoryNames: () => listExpenseCategoryNames(readRecords()),
  });

  const visitsApi = createVisitsApi({ submitMutation });
  const visits = createVisitsController({
    elements: {
      funnel: element('visitsFunnel'),
      calendar: element('visitsCalendar'),
      prevMonthButton: element('visitsPrevMonth'),
      nextMonthButton: element('visitsNextMonth'),
      monthLabel: element('visitsMonthLabel'),
      todayButton: element('visitsToday'),
      search: element('visitsSearch'),
      statusFilter: element('visitsStatus'),
      allMonthsCheckbox: element('visitsAllMonths'),
      archiveCheckbox: element('visitsArchive'),
      head: element('visitsHead'),
      table: element('visitsTable'),
      summaryText: element('visitsSummaryText'),
    },
    readRecords,
    readNow: () => new Date(),
    submitMutation,
    showNotice,
    openEditor: recordEditor.openEditor,
    enrolChild: visitsApi.enrolChild,
    openProfile: childProfile.openChildProfile,
    renderVisitsCount: count => setNavCount('visitsCount', count),
  });

  // Fereastra Notification poate lipsi (headless, browsere vechi) sau localStorage poate
  // arunca într-un profil de navigare privată blocat; portul rămâne tăcut, nu aplicația.
  const notifications = {
    permission: () => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission),
    request: () =>
      typeof Notification === 'undefined' ? Promise.resolve('unsupported') : Notification.requestPermission(),
    show: (title, body, key, onClick) => {
      if (typeof Notification === 'undefined') return;
      const notification = new Notification(title, { body, tag: key });
      notification.onclick = () => {
        window.focus();
        onClick?.();
      };
    },
  };
  const REMINDER_KEYS_STORAGE_KEY = 'startica.visitReminders';
  const rememberedKeys = {
    read: () => {
      try {
        const raw = localStorage.getItem(REMINDER_KEYS_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    },
    write: keys => {
      try {
        localStorage.setItem(REMINDER_KEYS_STORAGE_KEY, JSON.stringify(keys));
      } catch {
        // Profil de navigare privată sau stocare blocată: memento-urile nu persistă, dar aplicația continuă.
      }
    },
  };
  createVisitRemindersController({
    readRecords,
    readNow: () => new Date(),
    notifications,
    rememberedKeys,
    eventBus,
    elements: { button: element('visitsNotifyButton'), hint: element('visitsNotifyHint') },
    goToVisits: () => navigation.go('visits'),
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
    summarizeUpcomingVisits: () => countVisitsForDays(readRecords().visits, today()),
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
    elements: {
      period: element('notifyPeriod'),
      stats: element('notifyStats'),
      table: element('notifyTable'),
      copyAllButton: element('copyAllMessages'),
    },
    readRecords,
    readToday: today,
    requestRender: () => renderCycle.render(),
    renderNotifyCount: count => setNavCount('notifyCount', count),
    showNotice,
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

  // Listele citesc filtrul de categorie înainte ca lista de categorii să-i refacă opțiunile.
  renderCycle.addScreen('dashboard', ({ month, review, activeEvaluations }) =>
    renderDashboard({
      month,
      review,
      evaluations: activeEvaluations,
      // Aceeași regulă ca badge-ul „Taxe și grupe”, ca Dashboard să nu spună „nicio acțiune” cu taxe lipsă.
      missingFeeCount: activeEvaluations.filter(({ child }) => hasMissingFee(child)).length,
    }),
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
  renderCycle.addScreen('visits', () => visits.render());

  return { recordEditor, childProfile };
}
