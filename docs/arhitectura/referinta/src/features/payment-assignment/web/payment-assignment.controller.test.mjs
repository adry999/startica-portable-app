import test from 'node:test';
import assert from 'node:assert/strict';
import { createDomainEventBus } from '#core/web/domain-event-bus.mjs';
import { ApiError } from '#core/web/api-error.mjs';
import { DOMAIN_EVENT_NAMES, DomainEvent } from '#shared/contracts/domain-events.mjs';
import { ASSIGNMENT_DAY, SEPTEMBER, createAssignmentRecords } from '../test-support/assignment-fixtures.mjs';
import { createPaymentAssignmentController } from './payment-assignment.controller.mjs';

function createHarness({ submitAssignments = async () => {} } = {}) {
  const records = createAssignmentRecords();
  const eventBus = createDomainEventBus({
    eventNames: DOMAIN_EVENT_NAMES,
    onListenerError: error => {
      throw error;
    },
  });
  const renderedScreens = [];
  const renderedCounts = [];
  const publishedAssignments = [];
  eventBus.subscribe(DomainEvent.PaymentsAssigned, payload => publishedAssignments.push(payload));
  const controller = createPaymentAssignmentController({
    readRecords: () => records,
    readSelectedMonth: () => SEPTEMBER,
    readToday: () => ASSIGNMENT_DAY,
    submitAssignments,
    eventBus,
    renderAssignmentScreen: state => renderedScreens.push(state),
    renderUnassignedCount: count => renderedCounts.push(count),
  });
  return {
    controller,
    records,
    eventBus,
    renderedScreens,
    renderedCounts,
    publishedAssignments,
    lastScreen: () => renderedScreens.at(-1),
  };
}

const selectedChildOf = (screen, paymentId) => screen.queue.find(row => row.payment.id === paymentId).selectedChildId;

test('ecranul activ primește achitările fără copil, riscul lunii și contorul', () => {
  const { controller, lastScreen, renderedCounts } = createHarness();

  controller.activate();

  assert.deepEqual(
    lastScreen()
      .queue.map(row => row.payment.id)
      .sort(),
    ['PAY-BLANK', 'PAY-MIHAI', 'PAY-POP'],
  );
  assert.deepEqual(lastScreen().risk, { unassigned: 3, coveringMonth: 3, amountCoveringMonth: 4500, notified: 0 });
  assert.deepEqual(renderedCounts, [3]);
});

test('completează automat doar potrivirile de nume fără ambiguitate', () => {
  const { controller, lastScreen } = createHarness();
  controller.activate();

  const selectedNow = controller.selectUnambiguousNameMatches();

  assert.equal(selectedNow, 1);
  assert.equal(selectedChildOf(lastScreen(), 'PAY-MIHAI'), 'CHILD-MIHAI');
  assert.equal(selectedChildOf(lastScreen(), 'PAY-POP'), '');
  assert.equal(selectedChildOf(lastScreen(), 'PAY-BLANK'), '');
});

test('completarea automată nu suprascrie o alegere manuală', () => {
  const { controller, lastScreen } = createHarness();
  controller.activate();
  controller.selectChild('PAY-MIHAI', 'CHILD-ANA');

  assert.equal(controller.selectUnambiguousNameMatches(), 0);
  assert.equal(selectedChildOf(lastScreen(), 'PAY-MIHAI'), 'CHILD-ANA');
});

test('salvarea trimite selecțiile, le golește și anunță celelalte ecrane', async () => {
  const submitted = [];
  const { controller, lastScreen, publishedAssignments } = createHarness({
    submitAssignments: async assignments => void submitted.push(assignments),
  });
  controller.activate();
  controller.selectChild('PAY-MIHAI', 'CHILD-MIHAI');
  controller.selectChild('PAY-POP', 'CHILD-IOANA');

  const result = await controller.saveSelections();

  assert.deepEqual(result, { saved: 2 });
  assert.deepEqual(submitted, [
    [
      { id: 'PAY-MIHAI', childId: 'CHILD-MIHAI' },
      { id: 'PAY-POP', childId: 'CHILD-IOANA' },
    ],
  ]);
  assert.equal(lastScreen().selectedCount, 0);
  assert.deepEqual(publishedAssignments, [
    { paymentIds: ['PAY-MIHAI', 'PAY-POP'], childIds: ['CHILD-MIHAI', 'CHILD-IOANA'] },
  ]);
});

test('fără selecții nu trimite nimic și explică motivul', async () => {
  let submitCount = 0;
  const { controller, lastScreen } = createHarness({ submitAssignments: async () => void submitCount++ });
  controller.activate();

  assert.deepEqual(await controller.saveSelections(), { saved: 0 });
  assert.equal(submitCount, 0);
  assert.deepEqual(lastScreen().failure, { message: 'Nu ai ales niciun copil.', retryable: false });
});

test('un al doilea click pe Salvează în timpul salvării nu dublează cererea', async () => {
  const pendingSubmit = Promise.withResolvers();
  let submitCount = 0;
  const { controller, lastScreen } = createHarness({
    submitAssignments: () => {
      submitCount++;
      return pendingSubmit.promise;
    },
  });
  controller.activate();
  controller.selectChild('PAY-MIHAI', 'CHILD-MIHAI');

  const firstSave = controller.saveSelections();
  assert.deepEqual(await controller.saveSelections(), { saved: 0 });
  assert.equal(lastScreen().isSaving, true);
  pendingSubmit.resolve(undefined);
  await firstSave;

  assert.equal(submitCount, 1);
  assert.equal(lastScreen().isSaving, false);
});

test('o cădere de rețea păstrează selecțiile pentru reluare', async () => {
  const { controller, lastScreen, publishedAssignments } = createHarness({
    submitAssignments: async () => {
      throw new ApiError('Conexiune întreruptă.', { kind: 'network' });
    },
  });
  controller.activate();
  controller.selectChild('PAY-MIHAI', 'CHILD-MIHAI');

  assert.deepEqual(await controller.saveSelections(), { saved: 0 });
  assert.deepEqual(lastScreen().failure, { message: 'Conexiune întreruptă.', retryable: true });
  assert.equal(lastScreen().selectedCount, 1);
  assert.deepEqual(publishedAssignments, []);
});

test('reîncărcarea datelor cu ecranul inactiv actualizează doar contorul', () => {
  const { eventBus, renderedScreens, renderedCounts } = createHarness();

  eventBus.publish(DomainEvent.RecordsReloaded, { revision: 2 });

  assert.deepEqual(renderedCounts, [3]);
  assert.equal(renderedScreens.length, 0);
});

test('selecția unei achitări asociate între timp dispare la reîncărcare', () => {
  const { controller, records, eventBus, lastScreen } = createHarness();
  controller.activate();
  controller.selectChild('PAY-MIHAI', 'CHILD-MIHAI');

  const assignedElsewhere = records.payments.find(payment => payment.id === 'PAY-MIHAI');
  assert.ok(assignedElsewhere);
  assignedElsewhere.childId = 'CHILD-MIHAI';
  eventBus.publish(DomainEvent.RecordsReloaded, { revision: 3 });

  assert.equal(lastScreen().selectedCount, 0);
  assert.deepEqual(
    lastScreen()
      .queue.map(row => row.payment.id)
      .sort(),
    ['PAY-BLANK', 'PAY-POP'],
  );
});

test('după dispose, evenimentele nu mai ajung la controller', () => {
  const { controller, eventBus, renderedCounts } = createHarness();

  controller.dispose();
  eventBus.publish(DomainEvent.SelectedMonthChanged, { month: '2026-10' });

  assert.deepEqual(renderedCounts, []);
});
