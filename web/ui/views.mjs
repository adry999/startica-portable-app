import {
  today,
  cents,
  total,
  obligation,
  paymentIndex,
  cashSummary,
  allocations,
  paymentTenders,
  dueDayFor,
} from '../../shared/domain.mjs';
import { reviewCenter } from '../../shared/review-center.mjs';
import { normalizeSearchText } from '#shared/format/text-search.mjs';
import { $, esc, money, date, time, fileSize, monthLabel } from './dom.mjs';
import { session, message, mutate, renderSaveStatus } from './session.mjs';
import {
  pages,
  pageRows,
  button,
  actions,
  childName,
  parentContacts,
  tenderLabel,
  statusBadgeClass,
} from './parts.mjs';
import { renderFees } from './fees.mjs';
import { findUnassignedPaymentHintsByChild } from '#features/payment-assignment/index.web.mjs';
import { selectedMonth, contractOf, groupName } from './view-helpers.mjs';
import { renderReview } from './review.mjs';
import { renderDashboard, renderStatus, renderNotify } from './reports.mjs';
import { renderGroups, bindGroups, renderCategories, bindCategories } from './groups-categories.mjs';
import { profile } from './profile-audit.mjs';

export { bindGroups, bindCategories, profile };

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

// ─── Backup și stare ────────────────────────────────────────────────────────

export function renderHealth() {
  const { health } = session;
  const stale = !health.lastLocal || Date.now() - new Date(health.lastLocal).getTime() > 86400000,
    externalStale = !health.lastExternal || Date.now() - new Date(health.lastExternal).getTime() > 86400000;
  const hasError = !!(health.localError || health.externalError);
  const hasWarning = !hasError && (stale || !health.externalDir || externalStale);
  $('backupStatus').textContent = health.localError
    ? 'Backup local eșuat'
    : stale
      ? 'Backup local vechi/lipsă'
      : !health.externalDir
        ? 'Backup local OK · copie externă neconfigurată'
        : health.externalError || externalStale
          ? 'Copia externă necesită atenție'
          : 'Backup local și copie externă verificate';
  $('backupStatus').dataset.state = hasError ? 'error' : hasWarning ? 'warning' : 'ok';
  $('backupStatus').classList.toggle('danger', hasError || hasWarning);
  $('healthDetails').innerHTML =
    `<p>Bază: ${esc(health.database)}</p><p>Backup local: ${esc(time(health.lastLocal))}</p>` +
    `<p>Copie externă: ${esc(time(health.lastExternal))}</p>` +
    `<p class="danger">${esc(health.localError || health.externalError || (!health.externalDir ? 'Copia externă nu este configurată.' : ''))}</p>` +
    `<p>Sincronizarea în cloud nu este confirmată de aplicație. Verifică starea din Google Drive.</p>` +
    `<p>Păstrare locală: ultimele 20 de copii, câte una pentru ultimele 30 de zile cu backup și 12 luni cu backup. ` +
    `Copiile dinaintea importului, restaurării și migrării nu expiră automat: ${health.permanentBackups.count} copii, ${fileSize(health.permanentBackups.bytes)}. Șterge-le manual din Startica_Backup dacă nu mai sunt necesare.</p>`;
  // Câmpul nu se suprascrie cât timp utilizatorul scrie în el.
  if (!session.settingsDirty && !session.settingsBusy) $('externalDir').value = health.externalDir || '';
  renderSaveStatus();
}

// ─── Liste ──────────────────────────────────────────────────────────────────

// Selecția pt. arhivare/dezarhivare în masă — la Copii, Achitări și Cheltuieli.
// Persistă între randări (checkbox-urile revin bifate), se golește după operație.
const bulkSelection = { children: new Set(), payments: new Set(), expenses: new Set() };
const selectAllHeader = type => `<input type="checkbox" id="${type}SelectAll" title="Selectează tot ce se vede">`;

const HEADINGS = {
  children: [
    selectAllHeader('children'),
    'Contract',
    'Copil',
    'Părinți / telefoane',
    'Grupă',
    'Scadență',
    'Statut',
    'Acțiuni',
  ],
  payments: [
    selectAllHeader('payments'),
    'Data',
    'Copil / sursă',
    'Total',
    'Luni acoperite',
    'Cash / Card / Transfer',
    'Acțiuni',
  ],
  expenses: [selectAllHeader('expenses'), 'Data', 'Categorie', 'Descriere', 'Suma', 'Acțiuni'],
};

const SORT_FIELDS = {
  children: [null, 'contract', 'name', null, 'group', 'dueDay', 'status'],
  payments: [null, 'date', 'child', 'amount'],
  expenses: [null, 'date', 'category', 'description', 'amount'],
};
const listSort = {
  children: { field: 'name', direction: 'asc', manual: false },
  payments: { field: 'date', direction: 'desc', manual: false },
  expenses: { field: 'date', direction: 'desc', manual: false },
};

const rowSelectCell = (type, r) =>
  `<input type="checkbox" class="row-select" data-id="${esc(r.id)}" ${bulkSelection[type].has(r.id) ? 'checked' : ''}>`;

const CELLS = {
  children: r => [
    rowSelectCell('children', r),
    esc(contractOf(r)),
    button('profile', 'children', r.id, r.name),
    parentContacts(r),
    esc(groupName(r.groupId) || 'Lipsește'),
    `ziua ${dueDayFor(r)}`,
    `<span class="badge ${statusBadgeClass(r.status)}">${esc(r.status)}${r.archived ? ' · Arhivat' : ''}</span>`,
    actions('children', r),
  ],
  payments: r => [
    rowSelectCell('payments', r),
    date(r.date),
    esc(childName(r)) + (r.childId ? '' : '<br><small>Neasociată</small>'),
    money(r.amount),
    allocations(r)
      .map(a => `${esc(monthLabel(a.month))}: ${money(a.amount)}`)
      .join('<br>') || 'Avans nerepartizat',
    tenderLabel(r),
    actions('payments', r),
  ],
  expenses: r => [
    rowSelectCell('expenses', r),
    date(r.date),
    esc(r.category),
    esc(r.description),
    money(r.amount),
    actions('expenses', r),
  ],
};

function matchesSearch(r, type, search) {
  if (!search) return true;
  return normalizeSearchText(
    JSON.stringify([
      r.name,
      r.parent,
      r.phone,
      r.parent2,
      r.phone2,
      type === 'children' ? groupName(r.groupId) : r.group,
      r.id,
      r.contractNumber,
      r.notes,
      r.description,
      r.category,
      type === 'payments' ? childName(r) : '',
    ]),
  ).includes(search);
}

const sortValue = (type, field, row) => {
  if (field === 'contract') return contractOf(row);
  if (field === 'name') return row.name;
  if (field === 'child') return childName(row);
  if (field === 'amount') return Number(row.amount) || 0;
  if (field === 'group') return groupName(row.groupId);
  if (field === 'dueDay') return dueDayFor(row);
  return row[field] || '';
};

function sortRows(type, rows) {
  const { field, direction } = listSort[type];
  const factor = direction === 'asc' ? 1 : -1;
  return rows.sort((a, b) => {
    const av = sortValue(type, field, a),
      bv = sortValue(type, field, b);
    if (typeof av === 'number' || typeof bv === 'number') return factor * (Number(av) - Number(bv));
    return factor * String(av).localeCompare(String(bv), 'ro', { numeric: true, sensitivity: 'base' });
  });
}

function listHead(type) {
  const { field: activeField, direction, manual } = listSort[type];
  return (
    '<tr>' +
    HEADINGS[type]
      .map((label, index) => {
        const field = SORT_FIELDS[type][index];
        if (!field) return `<th>${label}</th>`;
        const active = field === activeField && manual;
        return `<th aria-sort="${active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}"><button type="button" class="table-sort" data-sort-type="${type}" data-sort="${field}">${label}<span aria-hidden="true">${active ? (direction === 'asc' ? '↑' : '↓') : '↕'}</span></button></th>`;
      })
      .join('') +
    '</tr>'
  );
}

// Totalurile de sus reflectă filtrele active (arhivare, lună, categorie,
// copil, metodă, căutare) — rows e deja filtrat, doar nepaginat.
function renderListSummary(type, rows) {
  const el = $(`${type}Summary`);
  if (!el) return;
  const sum = total(rows);
  if (type === 'children') {
    $('childrenSummaryText').innerHTML = `<strong>${rows.length}</strong> copii`;
  } else if (type === 'payments') {
    const byMethod = { Cash: 0, Card: 0, Transfer: 0, Altele: 0 };
    for (const r of rows)
      for (const t of paymentTenders(r)) {
        const m = Object.hasOwn(byMethod, t.method) ? t.method : 'Altele';
        byMethod[m] += cents(t.amount);
      }
    for (const m of Object.keys(byMethod)) byMethod[m] /= 100;
    // Textul e într-un <span> separat de buton, ca randarea repetată a
    // sumarului să nu șteargă butonul de arhivare/dezarhivare în masă.
    $('paymentsSummaryText').innerHTML =
      `<strong>${rows.length}</strong> achitări · <strong>${money(sum)}</strong> total` +
      ` · Cash: ${money(byMethod.Cash)} · Card: ${money(byMethod.Card)} · Transfer: ${money(byMethod.Transfer)}` +
      (byMethod.Altele ? ` · Altele: ${money(byMethod.Altele)}` : '');
  } else if (type === 'expenses') {
    $('expensesSummaryText').innerHTML =
      `<strong>${rows.length}</strong> cheltuieli · <strong>${money(sum)}</strong> total`;
  }
}

// Selecția curentă se păstrează la re-randare, ca la filtrul de categorii.
function renderPaymentsChildFilter() {
  const filter = $('paymentsChild');
  if (!filter) return;
  const current = filter.value;
  const names = [...session.state.children].sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  filter.innerHTML =
    '<option value="">Toți</option>' + names.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
  filter.value = current;
}

function updateBulkActionButton(type) {
  const btn = $(`${type}BulkArchive`) || $(`${type}BulkAction`);
  if (!btn) return;
  clearTimeout(btn._confirmTimer);
  btn.classList.remove('confirm-pending');
  const n = bulkSelection[type].size;
  btn.disabled = n === 0;
  const archive = $(`${type}Archive`)?.value;
  const isArchiveView = archive === 'archived';
  if (isArchiveView) {
    btn.textContent = n ? `Dezarhivează selectate (${n})` : 'Dezarhivează selectate';
  } else {
    btn.textContent = n ? `Arhivează selectate (${n})` : 'Arhivează selectate';
  }
}

// Casetele se reconstruiesc la fiecare randare a tabelului, deci legarea lor
// se reface aici, nu o singură dată la pornire (spre deosebire de bulkBtn,
// care e un element static din HTML, legat o singură dată în bindBulkAction).
function wireBulkSelection(type) {
  const selected = bulkSelection[type];
  const table = $(`${type}Table`),
    selectAll = $(`${type}SelectAll`);
  const boxes = [...table.querySelectorAll('.row-select')];
  for (const cb of boxes)
    cb.onchange = () => {
      if (cb.checked) selected.add(cb.dataset.id);
      else selected.delete(cb.dataset.id);
      updateBulkActionButton(type);
    };
  if (selectAll) {
    selectAll.checked = boxes.length > 0 && boxes.every(cb => cb.checked);
    selectAll.onchange = () => {
      for (const cb of boxes) {
        cb.checked = selectAll.checked;
        if (selectAll.checked) selected.add(cb.dataset.id);
        else selected.delete(cb.dataset.id);
      }
      updateBulkActionButton(type);
    };
  }
  updateBulkActionButton(type);
}

const TYPE_LABEL = { children: 'copii', payments: 'achitări', expenses: 'cheltuieli' };

// Butonul e static în HTML, deci legarea e o singură dată la pornire — spre
// deosebire de casetele din tabel, reconstruite la fiecare randare.
export function bindBulkAction(type) {
  const btn = $(`${type}BulkArchive`) || $(`${type}BulkAction`);
  if (!btn) return;
  btn.onclick = async () => {
    if (!btn.classList.contains('confirm-pending')) {
      btn.classList.add('confirm-pending');
      btn.dataset.label = btn.textContent;
      btn.textContent = `Sigur? ${btn.textContent}`;
      btn._confirmTimer = setTimeout(() => {
        btn.classList.remove('confirm-pending');
        btn.textContent = btn.dataset.label;
      }, 4000);
      return;
    }
    clearTimeout(btn._confirmTimer);
    btn.classList.remove('confirm-pending');
    btn.disabled = true;
    const ids = [...bulkSelection[type]];
    const archive = $(`${type}Archive`)?.value;
    const isArchiveView = archive === 'archived';
    const targetState = !isArchiveView;
    try {
      for (const id of ids) {
        const r = session.state[type].find(x => x.id === id);
        if (!r) continue;
        if (targetState && r.archived) continue;
        if (!targetState && !r.archived) continue;
        await mutate('/api/record', {
          type,
          mode: 'update',
          record: { ...r, archived: targetState, archivedAt: targetState ? new Date().toISOString() : null },
        });
      }
      bulkSelection[type].clear();
      const action = isArchiveView ? 'dezarhivate' : 'arhivate';
      message(`${ids.length} ${TYPE_LABEL[type]} ${action}.`);
    } catch (e) {
      message(e.message, true);
    } finally {
      updateBulkActionButton(type);
    }
  };
}

export function setListSort(type, field, direction) {
  const current = listSort[type];
  if (!current || !SORT_FIELDS[type].includes(field)) return;
  current.direction = direction;
  current.field = field;
  current.manual = true;
  pages[type] = 0;
  renderList(type);
}

export function renderList(type) {
  const search = normalizeSearchText($(`${type}Search`).value),
    archive = $(`${type}Archive`).value,
    monthFrom = $(`${type}MonthFrom`)?.value,
    monthTo = $(`${type}MonthTo`)?.value,
    category = $(`${type}Category`)?.value,
    childId = $(`${type}Child`)?.value,
    method = $(`${type}Method`)?.value;
  const rows = session.state[type].filter(
    r =>
      (archive === 'all' || (archive === 'archived' ? r.archived : !r.archived)) &&
      (!monthFrom || r.date.slice(0, 7) >= monthFrom) &&
      (!monthTo || r.date.slice(0, 7) <= monthTo) &&
      (!category || r.category === category) &&
      (!childId || r.childId === childId) &&
      (!method || paymentTenders(r).some(t => t.method === method)) &&
      matchesSearch(r, type, search),
  );
  renderListSummary(type, rows);
  const headings = HEADINGS[type];
  sortRows(type, rows);
  const head = $(`${type}Head`);
  head.innerHTML = listHead(type);
  for (const sortButton of head.querySelectorAll('[data-sort]'))
    sortButton.onclick = () =>
      setListSort(
        sortButton.dataset.sortType,
        sortButton.dataset.sort,
        sortButton.parentElement.getAttribute('aria-sort') === 'ascending' ? 'desc' : 'asc',
      );
  $(`${type}Table`).innerHTML =
    pageRows(type, rows)
      .map(
        r =>
          `<tr class="${r.archived ? 'archived-row' : ''}">${CELLS[type](r)
            .map(c => `<td>${c}</td>`)
            .join('')}</tr>`,
      )
      .join('') ||
    `<tr><td colspan="${headings.length}" class="empty">Nu există înregistrări pentru filtrele alese.</td></tr>`;
  if (type === 'children' || type === 'payments' || type === 'expenses') wireBulkSelection(type);
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
    review = reviewCenter(session.state);
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
  for (const type of ['children', 'payments', 'expenses']) renderList(type);
  renderStatus(month, allChildren, render);
  renderNotify(month, nonArchived, unassignedByChild, render);
  renderFees();
  renderGroups();
  renderCategories();
  renderPaymentsChildFilter();
  renderReview(review);
}
