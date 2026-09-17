import test from 'node:test';
import assert from 'node:assert/strict';
import { createFeeSetupController } from './fee-setup.controller.mjs';

/** @param {any} value */
const asAny = value => /** @type {any} */ (value);

function createElement(extra = {}) {
  return asAny({ value: '', textContent: '', innerHTML: '', onclick: null, onchange: null, ...extra });
}

/**
 * @param {{ id: string, name: string, fee: string, feeInitial: string, group: string, groupInitial: string,
 *   status: string, statusInitial: string, from: string }} args
 */
function createFeeRow({ id, name, fee, feeInitial, group, groupInitial, status, statusInitial, from }) {
  const feeInput = asAny({ value: fee, dataset: { feeInitial } });
  const groupInput = asAny({ value: group, dataset: { groupInitial } });
  const statusInput = asAny({ value: status, dataset: { statusInitial } });
  const fromInput = asAny({ value: from });
  return asAny({
    dataset: { child: id },
    cells: [{}, { textContent: name }],
    querySelector: selector => {
      if (selector === '[data-fee]') return feeInput;
      if (selector === '[data-group]') return groupInput;
      if (selector === '[data-status]') return statusInput;
      if (selector === '[data-from]') return fromInput;
      return null;
    },
  });
}

/** @param {any[]} [rows] */
function createFakeTable(rows = []) {
  return asAny({ innerHTML: '', querySelectorAll: selector => (selector === 'tr[data-child]' ? rows : []) });
}

/**
 * @param {{ table?: any, readRecords?: () => any, readToday?: () => string,
 *   renderMissingFeeCount?: (count: number) => void }} [args]
 */
function createHarness({
  table = createFakeTable(),
  readRecords = () => ({ children: [], groups: [] }),
  readToday = () => '2026-09-15',
  renderMissingFeeCount = () => {},
} = {}) {
  const notices = [];
  const submittedRequests = [];
  const elements = {
    info: createElement(),
    table,
    pending: createElement(),
    filter: createElement({ value: '' }),
    bulkAmount: createElement(),
    bulkGroup: createElement(),
    bulkStatus: createElement(),
    applyAll: createElement(),
    save: createElement(),
    failure: createElement(),
  };

  const controller = createFeeSetupController({
    elements,
    readRecords,
    readToday,
    submitMutation: async (path, body) => {
      submittedRequests.push([path, body]);
      return {};
    },
    showNotice: (...args) => notices.push(args),
    renderMissingFeeCount,
  });

  return { controller, elements, notices, submittedRequests };
}

test('save.onclick trimite doar rândurile schimbate, cu doar câmpurile modificate, plus id și luna de aplicare', async () => {
  const rows = [
    createFeeRow({
      id: 'C-1',
      name: 'Ana',
      fee: '100',
      feeInitial: '100',
      group: '',
      groupInitial: '',
      status: 'Activ',
      statusInitial: 'Activ',
      from: '2026-09',
    }),
    createFeeRow({
      id: 'C-2',
      name: 'Bogdan',
      fee: '150',
      feeInitial: '100',
      group: '',
      groupInitial: '',
      status: 'Activ',
      statusInitial: 'Activ',
      from: '2026-09',
    }),
    createFeeRow({
      id: 'C-3',
      name: 'Cezar',
      fee: '100',
      feeInitial: '100',
      group: 'GRP-1',
      groupInitial: '',
      status: 'Activ',
      statusInitial: 'Activ',
      from: '2026-09',
    }),
    createFeeRow({
      id: 'C-4',
      name: 'Diana',
      fee: '100',
      feeInitial: '100',
      group: '',
      groupInitial: '',
      status: 'Suspendat',
      statusInitial: 'Activ',
      from: '2026-09',
    }),
  ];
  const { elements, submittedRequests } = createHarness({ table: createFakeTable(rows) });

  await elements.save.onclick();

  assert.equal(submittedRequests.length, 1);
  const [path, body] = submittedRequests[0];
  assert.equal(path, '/api/children-setup');
  assert.deepEqual(body.updates, [
    { id: 'C-2', from: '2026-09', fee: 150 },
    { id: 'C-3', from: '2026-09', groupId: 'GRP-1' },
    { id: 'C-4', from: '2026-09', status: 'Suspendat' },
  ]);
});

test('un rând schimbat fără lună de aplicare validă arată eroarea și nu trimite cererea', async () => {
  const rows = [
    createFeeRow({
      id: 'C-1',
      name: 'Ana Pop',
      fee: '150',
      feeInitial: '100',
      group: '',
      groupInitial: '',
      status: 'Activ',
      statusInitial: 'Activ',
      from: '',
    }),
  ];
  const { elements, submittedRequests } = createHarness({ table: createFakeTable(rows) });

  await elements.save.onclick();

  assert.match(elements.failure.textContent, /Completează luna de aplicare/);
  assert.equal(submittedRequests.length, 0);
});

test('applyAll fără nicio valoare de aplicat arată o eroare și nu schimbă rândurile', () => {
  const rows = [
    createFeeRow({
      id: 'C-1',
      name: 'Ana',
      fee: '100',
      feeInitial: '100',
      group: '',
      groupInitial: '',
      status: 'Activ',
      statusInitial: 'Activ',
      from: '2026-09',
    }),
  ];
  const { elements, notices } = createHarness({ table: createFakeTable(rows) });

  elements.applyAll.onclick();

  assert.deepEqual(notices, [['Completează o taxă, o grupă sau un statut de aplicat.', true]]);
  assert.equal(rows[0].querySelector('[data-fee]').value, '100');
});

test('render() numără copiii nearhivați fără taxă și scrie textul info, indiferent de filtru', () => {
  const records = {
    children: [
      { id: 'C-1', name: 'Ana', archived: false, feeHistory: [] },
      { id: 'C-2', name: 'Bogdan', archived: false, feeHistory: [{ from: '2026-01', amount: 100 }] },
      { id: 'C-3', name: 'Cezar', archived: true, feeHistory: [] },
    ],
    groups: [],
  };
  const missingCounts = [];
  const { controller, elements } = createHarness({
    readRecords: () => records,
    renderMissingFeeCount: count => missingCounts.push(count),
  });

  controller.render();

  assert.deepEqual(missingCounts, [1]);
  assert.match(elements.info.textContent, /1 copii fără taxă completată/);
});
