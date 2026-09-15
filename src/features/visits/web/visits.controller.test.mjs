import test from 'node:test';
import assert from 'node:assert/strict';
import { createVisitsController } from './visits.controller.mjs';

/** @param {any} value */
const asAny = value => /** @type {any} */ (value);

/** @param {Record<string, unknown>} [overrides] */
function buildVisit(overrides = {}) {
  return {
    id: 'VIZ-1',
    name: 'Ana Popescu',
    birthDate: '2022-03-01',
    parent: 'Maria Popescu',
    phone: '0722000000',
    parent2: '',
    phone2: '',
    date: '2026-09-10',
    time: '10:00',
    status: 'Programată',
    statusChangedAt: '2026-09-01T10:00:00.000Z',
    history: [{ at: '2026-09-01T10:00:00.000Z', status: 'Programată', date: '2026-09-10', time: '10:00' }],
    desiredStartDate: '',
    desiredGroupId: null,
    source: '',
    healthNotes: '',
    postVisitNotes: '',
    notes: '',
    childId: '',
    archived: false,
    ...overrides,
  };
}

function createElement(extra = {}) {
  return asAny({ innerHTML: '', textContent: '', value: '', checked: false, ...extra });
}

/** @param {{ visits?: any[] }} [args] */
function createHarness({ visits = [buildVisit()] } = {}) {
  const records = { children: [], payments: [], expenses: [], groups: [], categories: [], visits };
  const notices = [];
  const submitted = [];
  const openEditorCalls = [];
  const enrolCalls = [];
  const profileOpened = [];
  const visitsCountCalls = [];

  const elements = {
    funnel: createElement(),
    calendar: createElement(),
    prevMonthButton: createElement(),
    nextMonthButton: createElement(),
    monthLabel: createElement(),
    todayButton: createElement(),
    search: createElement(),
    statusFilter: createElement(),
    allMonthsCheckbox: createElement(),
    archiveCheckbox: createElement(),
    head: createElement({ querySelectorAll: () => [] }),
    table: createElement(),
    summaryText: createElement(),
  };

  const controller = createVisitsController({
    elements,
    readRecords: () => records,
    readNow: () => new Date(2026, 8, 15, 9, 0, 0),
    submitMutation: async (...args) => {
      submitted.push(args);
      return { childId: 'ID-nou' };
    },
    showNotice: (...args) => notices.push(args),
    openEditor: (...args) => openEditorCalls.push(args),
    enrolChild: async (...args) => {
      enrolCalls.push(args);
      return { childId: 'ID-nou' };
    },
    openProfile: id => profileOpened.push(id),
    renderVisitsCount: count => visitsCountCalls.push(count),
  });

  return {
    controller,
    elements,
    records,
    notices,
    submitted,
    openEditorCalls,
    enrolCalls,
    profileOpened,
    visitsCountCalls,
  };
}

const clickTableAction = (table, id, action) =>
  table.onclick({ target: { closest: () => ({ dataset: { id, visitAction: action } }) } });
const clickCalendarDate = (calendar, date) => calendar.onclick({ target: { closest: () => ({ dataset: { date } }) } });

test('randarea implicită arată luna curentă și vizitele ei nearhivate', () => {
  const { controller, elements } = createHarness({
    visits: [buildVisit({ id: 'VIZ-1', date: '2026-09-10' }), buildVisit({ id: 'VIZ-2', date: '2026-08-05' })],
  });

  controller.render();

  assert.match(elements.monthLabel.textContent, /septembrie 2026/i);
  assert.match(elements.table.innerHTML, /Ana Popescu/);
  assert.doesNotMatch(elements.summaryText.innerHTML, />2</);
});

test('filtrul de statut restrânge lista la statutul ales', () => {
  const { controller, elements } = createHarness({
    visits: [
      buildVisit({ id: 'VIZ-1', name: 'Ana Popescu', status: 'Programată' }),
      buildVisit({ id: 'VIZ-2', name: 'Bogdan Ionescu', status: 'Efectuată' }),
    ],
  });
  controller.render();

  elements.statusFilter.value = 'Efectuată';
  elements.statusFilter.onchange();

  assert.match(elements.table.innerHTML, /Bogdan Ionescu/);
  assert.doesNotMatch(elements.table.innerHTML, /Ana Popescu/);
});

test('căutarea filtrează după numele părintelui', () => {
  const { controller, elements } = createHarness({
    visits: [
      buildVisit({ id: 'VIZ-1', name: 'Ana Popescu', parent: 'Maria Popescu' }),
      buildVisit({ id: 'VIZ-2', name: 'Bogdan Ionescu', parent: 'Elena Ionescu' }),
    ],
  });
  controller.render();

  elements.search.value = 'elena';
  elements.search.oninput();

  assert.match(elements.table.innerHTML, /Bogdan Ionescu/);
  assert.doesNotMatch(elements.table.innerHTML, /Ana Popescu/);
});

test('caseta „Arhivate” arată doar vizitele arhivate, nu și pe cele active', () => {
  const { controller, elements } = createHarness({
    visits: [
      buildVisit({ id: 'VIZ-1', name: 'Ana Popescu', archived: false }),
      buildVisit({ id: 'VIZ-2', name: 'Bogdan Ionescu', archived: true }),
    ],
  });
  controller.render();
  assert.doesNotMatch(elements.table.innerHTML, /Bogdan Ionescu/);

  elements.archiveCheckbox.checked = true;
  elements.archiveCheckbox.onchange();

  assert.match(elements.table.innerHTML, /Bogdan Ionescu/);
  assert.doesNotMatch(elements.table.innerHTML, /Ana Popescu/);
});

test('„Toate lunile” include vizitele din afara lunii afișate', () => {
  const { controller, elements } = createHarness({
    visits: [
      buildVisit({ id: 'VIZ-1', name: 'Ana Popescu', date: '2026-09-10' }),
      buildVisit({ id: 'VIZ-2', name: 'Bogdan Ionescu', date: '2026-12-01' }),
    ],
  });
  controller.render();
  assert.doesNotMatch(elements.table.innerHTML, /Bogdan Ionescu/);

  elements.allMonthsCheckbox.checked = true;
  elements.allMonthsCheckbox.onchange();

  assert.match(elements.table.innerHTML, /Bogdan Ionescu/);
});

test('navigarea la luna următoare și înapoi la azi schimbă eticheta lunii', () => {
  const { controller, elements } = createHarness();
  controller.render();

  elements.nextMonthButton.onclick();
  assert.match(elements.monthLabel.textContent, /octombrie 2026/i);

  elements.prevMonthButton.onclick();
  elements.prevMonthButton.onclick();
  assert.match(elements.monthLabel.textContent, /august 2026/i);

  elements.todayButton.onclick();
  assert.match(elements.monthLabel.textContent, /septembrie 2026/i);
});

test('un clic pe o zi din calendar restrânge lista la ziua aceea, iar al doilea clic o eliberează', () => {
  const { controller, elements } = createHarness({
    visits: [
      buildVisit({ id: 'VIZ-1', name: 'Ana Popescu', date: '2026-09-10' }),
      buildVisit({ id: 'VIZ-2', name: 'Bogdan Ionescu', date: '2026-09-20' }),
    ],
  });
  controller.render();

  clickCalendarDate(elements.calendar, '2026-09-10');
  assert.match(elements.table.innerHTML, /Ana Popescu/);
  assert.doesNotMatch(elements.table.innerHTML, /Bogdan Ionescu/);

  clickCalendarDate(elements.calendar, '2026-09-10');
  assert.match(elements.table.innerHTML, /Bogdan Ionescu/);
});

test('un buton rapid de statut trimite applyVisitStatus prin submitMutation', () => {
  const visit = buildVisit({ id: 'VIZ-1', status: 'Programată' });
  const { controller, elements, submitted } = createHarness({ visits: [visit] });
  controller.render();

  clickTableAction(elements.table, 'VIZ-1', 'Efectuată');

  assert.equal(submitted.length, 1);
  const [path, body] = submitted[0];
  assert.equal(path, '/api/record');
  assert.equal(body.type, 'visits');
  assert.equal(body.mode, 'update');
  assert.equal(body.record.status, 'Efectuată');
  assert.equal(body.record.history.at(-1).status, 'Efectuată');
});

test('„Înscrie copilul” deschide editorul de copii precompletat cu title și submit personalizate', async () => {
  const visit = buildVisit({
    id: 'VIZ-1',
    name: 'Ana Popescu',
    status: 'Efectuată',
    desiredGroupId: 'GRP-1',
    desiredStartDate: '2026-10-01',
    source: 'Recomandare',
  });
  const { controller, elements, openEditorCalls, enrolCalls, notices, profileOpened } = createHarness({
    visits: [visit],
  });
  controller.render();

  clickTableAction(elements.table, 'VIZ-1', 'enrol');

  assert.equal(openEditorCalls.length, 1);
  const [type, id, options] = openEditorCalls[0];
  assert.equal(type, 'children');
  assert.equal(id, undefined);
  assert.equal(options.title, 'Înscrie copilul: Ana Popescu');
  assert.deepEqual(options.prefill, {
    name: 'Ana Popescu',
    birthDate: '2022-03-01',
    parent: 'Maria Popescu',
    phone: '0722000000',
    parent2: '',
    phone2: '',
    groupId: 'GRP-1',
    attendanceDate: '2026-10-01',
    healthNotes: '',
    notes: 'Sursă: Recomandare',
  });

  const child = { id: 'ID-nou', name: 'Ana Popescu' };
  await options.submit(child);

  assert.equal(enrolCalls.length, 1);
  assert.deepEqual(enrolCalls[0], ['VIZ-1', child]);
  assert.deepEqual(notices, [['Copil înscris. Vizita a fost marcată „Înscris”.']]);
  assert.deepEqual(profileOpened, ['ID-nou']);
});

test('nav badge counts all scheduled visits from today onward, not just today and tomorrow', () => {
  const { controller, visitsCountCalls } = createHarness({
    visits: [
      buildVisit({ id: 'VIZ-1', date: '2026-09-15', status: 'Programată' }),
      buildVisit({ id: 'VIZ-2', date: '2026-09-16', status: 'Programată' }),
      buildVisit({ id: 'VIZ-3', date: '2026-09-20', status: 'Programată' }),
      buildVisit({ id: 'VIZ-4', date: '2026-10-05', status: 'Programată' }),
      buildVisit({ id: 'VIZ-5', date: '2026-09-14', status: 'Programată' }),
    ],
  });

  controller.render();

  assert.equal(visitsCountCalls.length, 1);
  assert.equal(visitsCountCalls[0], 4);
});
