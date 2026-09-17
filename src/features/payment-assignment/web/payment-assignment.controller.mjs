import { DomainEvent } from '#shared/contracts/domain-events.mjs';
import { describeFailure } from '#core/web/view-state.mjs';
import { listUnassignedPayments } from '../domain/unassigned-payment-queue.mjs';
import { measureAssignmentRisk } from '../domain/unassigned-payment-risk.mjs';

/** @typedef {import('../payment-assignment.types.mjs').AssignmentQueueEntry} AssignmentQueueEntry */
/** @typedef {import('../payment-assignment.types.mjs').AssignmentRisk} AssignmentRisk */
/** @typedef {import('../payment-assignment.types.mjs').PaymentAssignmentControllerDependencies} PaymentAssignmentControllerDependencies */

const ASSIGNMENT_QUEUE_LIMIT = 200;

/** @param {PaymentAssignmentControllerDependencies} dependencies */
export function createPaymentAssignmentController({
  readRecords,
  readSelectedMonth,
  readToday,
  submitAssignments,
  eventBus,
  renderAssignmentScreen,
  renderUnassignedCount,
}) {
  /** @type {Map<string, string>} */
  const selectedChildIdByPaymentId = new Map();
  /** @type {AssignmentQueueEntry[]} */
  let queue = [];
  /** @type {AssignmentRisk} */
  let risk = { unassigned: 0, coveringMonth: 0, amountCoveringMonth: 0, notified: 0 };
  let isActive = false;
  let isSaving = false;
  /** @type {{ message: string, retryable: boolean } | null} */
  let failure = null;

  function renderScreen() {
    if (!isActive) return;
    renderAssignmentScreen({
      risk,
      queue: queue.map(({ payment, suggestions }) => ({
        payment,
        suggestions,
        selectedChildId: selectedChildIdByPaymentId.get(payment.id) ?? '',
      })),
      selectedCount: selectedChildIdByPaymentId.size,
      isSaving,
      failure,
    });
  }

  // Contorul din navigație e ieftin și se actualizează mereu; sugestiile pentru un lot costă zeci
  // de ms, deci se calculează doar pentru ecranul vizibil și doar la schimbarea datelor.
  function refresh() {
    const records = readRecords();
    risk = measureAssignmentRisk(records, readSelectedMonth(), readToday());
    renderUnassignedCount(risk.unassigned);
    if (!isActive) return;
    queue = listUnassignedPayments(records, ASSIGNMENT_QUEUE_LIMIT);
    const openPaymentIds = new Set(queue.map(entry => entry.payment.id));
    for (const paymentId of selectedChildIdByPaymentId.keys())
      if (!openPaymentIds.has(paymentId)) selectedChildIdByPaymentId.delete(paymentId);
    renderScreen();
  }

  function activate() {
    isActive = true;
    refresh();
  }

  function deactivate() {
    isActive = false;
  }

  /**
   * @param {string} paymentId
   * @param {string} childId șir gol pentru a renunța la selecție
   */
  function selectChild(paymentId, childId) {
    if (!queue.some(entry => entry.payment.id === paymentId)) return;
    if (childId) selectedChildIdByPaymentId.set(paymentId, childId);
    else selectedChildIdByPaymentId.delete(paymentId);
    failure = null;
    renderScreen();
  }

  // Se completează doar un candidat unic cu nume potrivit; sumele și lunile se potrivesc la zeci de copii.
  function selectUnambiguousNameMatches() {
    let selectedNow = 0;
    for (const { payment, suggestions } of queue) {
      const nameMatches = suggestions.filter(suggestion => suggestion.nameMatch);
      if (nameMatches.length !== 1 || selectedChildIdByPaymentId.has(payment.id)) continue;
      selectedChildIdByPaymentId.set(payment.id, nameMatches[0].id);
      selectedNow++;
    }
    renderScreen();
    return selectedNow;
  }

  function clearSelections() {
    selectedChildIdByPaymentId.clear();
    failure = null;
    renderScreen();
  }

  async function saveSelections() {
    if (isSaving) return { saved: 0 };
    const assignments = [...selectedChildIdByPaymentId].map(([id, childId]) => ({ id, childId }));
    if (!assignments.length) {
      failure = { message: 'Nu ai ales niciun copil.', retryable: false };
      renderScreen();
      return { saved: 0 };
    }

    isSaving = true;
    failure = null;
    renderScreen();
    try {
      await submitAssignments(assignments);
      // Selecțiile făcute cât timp salvarea era în curs rămân pentru următoarea salvare.
      for (const { id } of assignments) selectedChildIdByPaymentId.delete(id);
      eventBus.publish(DomainEvent.PaymentsAssigned, {
        paymentIds: assignments.map(assignment => assignment.id),
        childIds: [...new Set(assignments.map(assignment => assignment.childId))],
      });
      return { saved: assignments.length };
    } catch (error) {
      failure = describeFailure(error);
      return { saved: 0 };
    } finally {
      isSaving = false;
      renderScreen();
    }
  }

  const unsubscribers = [
    eventBus.subscribe(DomainEvent.RecordsReloaded, refresh),
    eventBus.subscribe(DomainEvent.SelectedMonthChanged, refresh),
  ];

  return {
    activate,
    deactivate,
    refresh,
    selectChild,
    selectUnambiguousNameMatches,
    clearSelections,
    saveSelections,
    dispose: () => unsubscribers.forEach(unsubscribe => unsubscribe()),
  };
}
