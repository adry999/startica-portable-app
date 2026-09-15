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

test('cardul „Achitări de urmărit” semnalează copiii fără taxă completată, nu îi ascunde sub „nicio acțiune”', () => {
  const html = renderAlerts({ missingFeeCount: 2 });
  const card = html.match(/<article class="alert alert-urgent">.*?<\/article>/s)?.[0] ?? '';

  assert.match(card, /Nu se pot calcula/);
  assert.match(card, /2 copii fără taxă/);
  assert.match(card, /data-view="fees"/);
  assert.doesNotMatch(card, /necesară/);
  assert.doesNotMatch(html, /Nicio acțiune în listele urmărite/);
});

test('cardul „Achitări de urmărit” se comportă ca azi când toți copiii nearhivați au taxa completată', () => {
  const evaluations = [asAny({ child: { id: 'C1' }, obligation: { notify: true } })];
  const html = renderAlerts({ missingFeeCount: 0, evaluations });

  assert.match(html, /1 copil trebuie notificat/);
  assert.match(html, /data-view="notify"/);
  assert.doesNotMatch(html, /Nu se pot calcula/);
});
