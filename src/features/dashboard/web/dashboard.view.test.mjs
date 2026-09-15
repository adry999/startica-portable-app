import test from 'node:test';
import assert from 'node:assert/strict';
import { createDashboardView } from './dashboard.view.mjs';

/** @param {any} value */
const asAny = value => /** @type {any} */ (value);

const elementStub = () => asAny({ textContent: '', innerHTML: '', querySelectorAll: () => [] });

/** @param {{ missingFeeCount: number, evaluations?: any[], reviewItems?: any[] }} args */
function renderAlerts({ missingFeeCount, evaluations = [], reviewItems = [] }) {
  const alerts = elementStub();
  const renderDashboard = createDashboardView({
    elements: asAny({
      incomeStat: elementStub(),
      expenseStat: elementStub(),
      netStat: elementStub(),
      incomeMethods: elementStub(),
      advanceStat: elementStub(),
      alerts,
      bars: elementStub(),
      birthdaysHighlightCount: elementStub(),
      birthdaysHighlightDetail: elementStub(),
      birthdaysUpcoming: elementStub(),
      birthdaysCalendar: elementStub(),
    }),
    readRecords: () => asAny({ children: [], payments: [], expenses: [], groups: [], categories: [] }),
    readToday: () => '2026-09-15',
    listUpcomingBirthdays: () => [],
    buildBirthdayCalendar: () => [],
    renderReviewCount: () => {},
  });
  renderDashboard({ month: '2026-09', review: { items: reviewItems }, evaluations, missingFeeCount });
  return alerts.innerHTML;
}

test('cardul „Achitări de urmărit” arată numărul real de notificat și copiii fără taxă, chiar dacă nimeni nu trebuie notificat acum', () => {
  const html = renderAlerts({ missingFeeCount: 2 });
  const card = html.match(/<article class="alert alert-urgent">.*?<\/article>/s)?.[0] ?? '';

  assert.match(card, /0 de notificat · 2 fără taxă \(nu se pot calcula\)/);
  assert.match(card, />Completează</);
  assert.match(card, /data-view="fees"/);
  assert.doesNotMatch(card, /necesară/);
  assert.doesNotMatch(html, /Nicio acțiune în listele urmărite/);
});

test('cardul „Achitări de urmărit” arată numărul real de notificat și copiii fără taxă, când există și notificări de trimis', () => {
  const evaluations = [asAny({ child: { id: 'C1' }, obligation: { notify: true } })];
  const html = renderAlerts({ missingFeeCount: 2, evaluations });
  const card = html.match(/<article class="alert alert-urgent">.*?<\/article>/s)?.[0] ?? '';

  assert.match(card, /1 de notificat · 2 fără taxă \(nu se pot calcula\)/);
  assert.match(card, />Vezi lista</);
  assert.match(card, /data-view="notify"/);
});

test('cardul „Achitări de urmărit” se comportă ca azi când toți copiii nearhivați au taxa completată', () => {
  const evaluations = [asAny({ child: { id: 'C1' }, obligation: { notify: true } })];
  const html = renderAlerts({ missingFeeCount: 0, evaluations });

  assert.match(html, /1 copil trebuie notificat/);
  assert.match(html, /data-view="notify"/);
  assert.doesNotMatch(html, /Nu se pot calcula/);
});
