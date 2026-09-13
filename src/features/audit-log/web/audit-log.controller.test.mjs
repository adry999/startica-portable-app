import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '#core/web/api-error.mjs';
import { ViewStatus } from '#core/web/view-state.mjs';
import { createAuditLogController } from './audit-log.controller.mjs';

const auditEntry = id => ({
  id,
  occurredAt: '2026-09-01T10:00:00.000Z',
  action: 'modificare',
  recordType: 'children',
  recordId: `CHILD-${id}`,
  before: null,
  after: { id },
});

function createHarness(fetchAuditPage) {
  const renderedStates = [];
  const controller = createAuditLogController({
    fetchAuditPage,
    renderAuditLog: state => renderedStates.push(state),
  });
  return { controller, renderedStates };
}

const entryIds = controller => controller.getState().entries.map(entry => entry.id);

test('afișează încărcarea, apoi prima pagină', async () => {
  const { controller, renderedStates } = createHarness(async () => ({
    entries: [auditEntry(2), auditEntry(1)],
    nextBeforeEntryId: null,
  }));

  await controller.openFirstPage();

  assert.deepEqual(
    renderedStates.map(state => state.status),
    [ViewStatus.Loading, ViewStatus.Ready],
  );
  assert.deepEqual(entryIds(controller), [2, 1]);
  assert.equal(controller.getState().hasMore, false);
});

test('un istoric gol are stare proprie', async () => {
  const { controller } = createHarness(async () => ({ entries: [], nextBeforeEntryId: null }));

  await controller.openFirstPage();

  assert.equal(controller.getState().status, ViewStatus.Empty);
});

test('o cădere de rețea la deschidere este marcată ca reluabilă', async () => {
  const { controller } = createHarness(async () => {
    throw new ApiError('Conexiune întreruptă.', { kind: 'network' });
  });

  await controller.openFirstPage();

  assert.equal(controller.getState().status, ViewStatus.Failed);
  assert.deepEqual(controller.getState().failure, { message: 'Conexiune întreruptă.', retryable: true });
});

test('pagina următoare se cere o singură dată și continuă de la ultimul id afișat', async () => {
  const requestedCursors = [];
  const secondPage = Promise.withResolvers();
  const { controller } = createHarness(beforeEntryId => {
    requestedCursors.push(beforeEntryId);
    return beforeEntryId === null
      ? Promise.resolve({ entries: [auditEntry(3), auditEntry(2)], nextBeforeEntryId: 2 })
      : secondPage.promise;
  });
  await controller.openFirstPage();

  const nextPageRequest = controller.loadNextPage();
  const repeatedClick = controller.loadNextPage();
  secondPage.resolve({ entries: [auditEntry(1)], nextBeforeEntryId: null });
  await Promise.all([nextPageRequest, repeatedClick]);

  assert.deepEqual(requestedCursors, [null, 2]);
  assert.deepEqual(entryIds(controller), [3, 2, 1]);
  assert.equal(controller.getState().hasMore, false);
});

test('răspunsul întârziat al unei deschideri anterioare este ignorat', async () => {
  const staleOpening = Promise.withResolvers();
  let fetchCount = 0;
  const { controller } = createHarness(() =>
    ++fetchCount === 1 ? staleOpening.promise : Promise.resolve({ entries: [auditEntry(9)], nextBeforeEntryId: null }),
  );

  const staleRequest = controller.openFirstPage();
  await controller.openFirstPage();
  staleOpening.resolve({ entries: [auditEntry(1)], nextBeforeEntryId: null });
  await staleRequest;

  assert.deepEqual(entryIds(controller), [9]);
});

test('eșecul paginii următoare păstrează intrările deja afișate', async () => {
  const { controller } = createHarness(async beforeEntryId => {
    if (beforeEntryId === null) return { entries: [auditEntry(3), auditEntry(2)], nextBeforeEntryId: 2 };
    throw new ApiError('Serverul a refuzat cererea.', { kind: 'rejected', status: 500 });
  });
  await controller.openFirstPage();

  await controller.loadNextPage();

  const state = controller.getState();
  assert.equal(state.status, ViewStatus.Ready);
  assert.deepEqual(entryIds(controller), [3, 2]);
  assert.equal(state.isLoadingMore, false);
  assert.deepEqual(state.failure, { message: 'Serverul a refuzat cererea.', retryable: false });
});
