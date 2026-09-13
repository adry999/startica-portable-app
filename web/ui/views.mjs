import { today, obligation, paymentIndex, cashSummary } from '../../shared/domain.mjs';
import { buildReviewCenter } from '#features/review-center/index.web.mjs';
import { findUnassignedPaymentHintsByChild } from '#features/payment-assignment/index.web.mjs';
import { $ } from './dom.mjs';
import { session } from './session.mjs';
import { selectedMonth } from './view-helpers.mjs';
import { renderDashboard, renderStatus, renderNotify } from './reports.mjs';

// Ecranele mutate în src/features se redesenează la fiecare render(), cu evaluările calculate o singură dată.
const renderListeners = [];

export function onRender(listener) {
  renderListeners.push(listener);
}

/** @type {Map<string, { activate: () => void, deactivate?: () => void }>} */
const screens = new Map();

export function registerScreen(viewId, screen) {
  screens.set(viewId, screen);
}

export function go(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === id));
  let currentNav;
  document.querySelectorAll('.nav').forEach(v => {
    const current = v.dataset.view === id;
    v.classList.toggle('active', current);
    if (current) v.setAttribute('aria-current', 'page');
    else v.removeAttribute('aria-current');
    if (current) currentNav = v;
  });
  if (currentNav) {
    const label = Array.from(currentNav.childNodes)
      .filter(node => node.nodeType === 3)
      .map(node => node.textContent.trim())
      .filter(Boolean)
      .join(' ');
    $('currentViewLabel').textContent = label;
  }
  // În varianta compactă, alegerea unei secțiuni închide lista; pe desktop
  // navigația rămâne afișată prin CSS, fără atributul hidden.
  document.querySelector('.sidebar')?.classList.remove('is-nav-open');
  $('navToggle').setAttribute('aria-expanded', 'false');
  for (const [viewId, screen] of screens)
    if (viewId === id) screen.activate();
    else screen.deactivate?.();
  window.scrollTo(0, 0);
}

function renderChildrenSummary(review) {
  const children = session.state.children.filter(c => !c.archived);
  const active = children.filter(c => c.status === 'Activ').length;
  const occupiedGroups = new Set(children.map(c => c.groupId).filter(Boolean)).size;
  // Centrul grupează deja observațiile după tip și ID; Set-ul păstrează
  // protecția explicită dacă regulile de verificare se extind ulterior.
  const incomplete = new Set(
    review.items.filter(item => item.type === 'children' && !item.record.archived).map(item => item.id),
  ).size;
  $('activeChildrenStat').textContent = active;
  $('occupiedGroupsStat').textContent = occupiedGroups;
  $('incompleteChildrenStat').textContent = incomplete;
}

export function render() {
  const month = selectedMonth(),
    cash = cashSummary(session.state, month),
    review = buildReviewCenter(session.state);
  // Un singur index de încasări și o singură funcție de evaluare pentru toate
  // ecranele randării curente (Dashboard, Situația plăților, De notificat).
  const asOf = today();
  const index = paymentIndex(session.state.payments, asOf);
  const evaluate = c => obligation(c, month, session.state.payments, asOf, index);
  // Dashboard, Status și Notify au nevoie de aceiași copii evaluați; calculat
  // o singură dată, altfel obligation() rula de mai multe ori pe copil.
  const allChildren = session.state.children.map(c => ({ child: c, o: evaluate(c) }));
  const nonArchived = allChildren.filter(r => !r.child.archived);
  const unassignedByChild = findUnassignedPaymentHintsByChild(session.state);
  renderDashboard(month, cash, review, nonArchived);
  renderChildrenSummary(review);
  renderStatus(month, allChildren, render);
  renderNotify(month, nonArchived, unassignedByChild, render);
  for (const listener of renderListeners) listener({ month, review });
}
