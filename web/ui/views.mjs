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
  monthCalendar,
  upcomingBirthdays,
} from '../../shared/domain.mjs';
import { reviewCenter, filteredReviewItems, reviewFilters } from '../../shared/review-center.mjs';
import { $, esc, money, date, time, age, fileSize, monthLabel, setNavCount } from './dom.mjs';
import { session, api, message, mutate, renderSaveStatus } from './session.mjs';
import {
  pages,
  pageRows,
  sortTable,
  button,
  actions,
  childName,
  parentContacts,
  tenderLabel,
  statusBadgeClass,
  expenseCategories,
} from './parts.mjs';
import { renderFees } from './fees.mjs';
import { renderAssign } from './assign.mjs';
import { childPickerHTML, wireChildPicker } from './child-picker.mjs';
import { unassignedSuggestionsByChild } from '../../shared/payment-matching.mjs';

const selectedMonth = () => $('selectedMonth').value || today().slice(0, 7);
// Numărul de contract este identificatorul folosit în discuția cu părintele.
const contractOf = c => c.contractNumber || c.id;
const groupName = id => session.state.groups.find(g => g.id === id)?.name || '';

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
  // Ecranul de asociere își construiește tabelul abia când devine vizibil.
  if (id === 'assign') renderAssign(true);
  if (id === 'audit') {
    auditOffset = 0;
    void renderAudit().catch(e => message(e.message, true));
  }
  window.scrollTo(0, 0);
}

// ─── De verificat ───────────────────────────────────────────────────────────

const reviewTag = (category, labels) =>
  `<span class="review-tag ${esc(category)}">${esc(labels[category] || category)}</span>`;

function reviewRow(item, labels) {
  const payment = item.type === 'payments',
    r = item.record;
  const details = payment
    ? `${date(r.date)} · ${money(r.amount)}${r.sourceName ? ` · sursă: ${esc(r.sourceName)}` : ''}${r.childId ? ` · copil: ${esc(childName(r))}` : ''}`
    : `Contract: ${esc(r.contractNumber || r.id)} · Grupă: ${esc(groupName(r.groupId) || 'necompletată')}`;
  const tags = item.categories.map(category => reviewTag(category, labels)).join('');
  const confirm = item.canConfirm ? button('confirm-review', 'payments', item.id, 'Confirmă asocierea') : '';
  return (
    `<div class="review-row"><span><strong>${esc(item.name)}</strong> · ${esc(item.id)}` +
    `<div class="review-tags">${tags}</div><small>${details}</small>` +
    `<small>${item.reasons.map(esc).join(' · ')}</small></span>` +
    `<div class="review-actions">${button('edit', item.type, item.id, payment ? 'Corectează achitarea' : 'Corectează fișa')}${confirm}</div></div>`
  );
}

// Opțiunile filtrului vin din aceeași listă pe care o folosește gruparea, ca
// adăugarea unei categorii să nu ceară și o editare în HTML.
let filtersReady = false;
function fillReviewFilter() {
  if (filtersReady) return;
  $('reviewFilter').innerHTML = reviewFilters
    .map(([value, label]) => `<option value="${esc(value)}">${esc(label)}</option>`)
    .join('');
  filtersReady = true;
}
function renderReview(center) {
  fillReviewFilter();
  const rows = filteredReviewItems(center, $('reviewFilter').value, $('reviewSearch').value),
    progress = center.progress;
  $('reviewProgress').innerHTML =
    `<article><small>Probleme afișate</small><strong>${rows.length}</strong><small>din ${center.items.length} fișe / achitări cu observații</small></article>` +
    `<article><small>Verificări import confirmate</small><strong>${progress.confirmed} / ${progress.total}</strong><small>confirmarea păstrează asocierea și suma existente</small></article>` +
    `<article><small>Verificări import rămase</small><strong>${progress.pending}</strong><small>achitările fără copil, dublurile și sumele provizorii necesită corectare</small></article>`;
  $('reviewList').innerHTML = `<div id="reviewPager" class="pager"></div><div id="reviewRows"></div>`;
  $('reviewRows').innerHTML =
    pageRows('review', rows)
      .map(item => reviewRow(item, center.labels))
      .join('') || '<p class="empty">Nu există înregistrări pentru filtrul ales.</p>';
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
const selectAllHeader = type =>
  `<input type="checkbox" id="${type}SelectAll" title="Selectează tot ce se vede">`;

const HEADINGS = {
  children: [selectAllHeader('children'), 'Contract', 'Copil', 'Părinți / telefoane', 'Grupă', 'Statut', 'Acțiuni'],
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
  children: [null, 'contract', 'name', null, 'group', 'status'],
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

const normalizeSearch = value =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('ro-RO');

function matchesSearch(r, type, search) {
  if (!search) return true;
  return normalizeSearch(
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
    $('expensesSummaryText').innerHTML = `<strong>${rows.length}</strong> cheltuieli · <strong>${money(sum)}</strong> total`;
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
  const search = normalizeSearch($(`${type}Search`).value),
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

// ─── Dashboard ──────────────────────────────────────────────────────────────

function renderDashboard(month, cash, review, all) {
  $('incomeStat').textContent = money(cash.income);
  $('expenseStat').textContent = money(cash.expense);
  $('netStat').textContent = money(cash.net);
  $('incomeMethods').textContent = Object.entries(cash.byMethod)
    .filter(([method, value]) => method !== 'Altele' || value)
    .map(([method, value]) => `${method}: ${money(value)}`)
    .join(' · ');
  // Avans = partea dintr-o plată încasată, dar nerepartizată pe nicio lună.
  $('advanceStat').textContent = money(
    session.state.payments
      .filter(p => !p.archived && p.date <= today())
      .reduce((sum, p) => sum + cents(p.amount) - allocations(p).reduce((n, a) => n + cents(a.amount), 0), 0) / 100,
  );
  setNavCount('reviewCount', review.items.length);
  const upcomingBirthdayRows = upcomingBirthdays(session.state.children, 5);
  const upcomingBirthdayCount = upcomingBirthdayRows.length;
  const hasBirthdayToday = upcomingBirthdayRows.some(r => r.daysUntil === 0);
  $('birthdaysHighlightCount').textContent = (hasBirthdayToday ? '🎉 ' : '') + upcomingBirthdayCount;
  $('birthdaysHighlightDetail').textContent = upcomingBirthdayCount
    ? `${upcomingBirthdayCount} ${upcomingBirthdayCount === 1 ? 'copil' : 'copii'} în următoarele 5 zile`
    : 'Niciuna în următoarele 5 zile';
  const toNotify = all.filter(r => r.o.notify).length;
  const unassigned = session.state.payments.filter(p => !p.archived && !p.childId).length;
  const attentionItems = [
    {
      count: toNotify,
      icon: '!',
      title: 'Achitări de urmărit',
      detail: toNotify === 1 ? '1 copil trebuie notificat.' : `${toNotify} copii trebuie notificați.`,
      action: 'Vezi lista',
      view: 'notify',
      tone: 'urgent',
    },
    {
      count: review.items.length,
      icon: '✓',
      title: 'Înregistrări de verificat',
      detail:
        review.items.length === 1
          ? '1 fișă sau achitare necesită verificare.'
          : `${review.items.length} fișe sau achitări necesită verificare.`,
      action: 'Verifică',
      view: 'review',
      tone: 'review',
    },
    {
      count: unassigned,
      icon: '↗',
      title: 'Achitări neasociate',
      detail:
        unassigned === 1
          ? '1 achitare nu este legată de un copil.'
          : `${unassigned} achitări nu sunt legate de un copil.`,
      action: 'Asociază',
      view: 'assign',
      tone: 'assign',
    },
  ];
  const allClear = attentionItems.every(item => item.count === 0);
  $('alerts').innerHTML = allClear
    ? '<div class="attention-empty"><strong>Nicio acțiune în listele urmărite.</strong>' +
      (session.state.children.length || session.state.payments.length
        ? 'Nu există notificări, înregistrări de verificat sau achitări neasociate.'
        : 'Nu sunt copii sau achitări înregistrate încă.') +
      '</div>'
    : attentionItems
        .map(item => {
          const clear = item.count === 0;
          const detail = clear ? 'Nicio acțiune necesară pe această listă.' : item.detail;
          return `<article class="alert alert-${item.tone}${clear ? ' alert-clear' : ''}"><span class="alert-count">${item.count}</span><i aria-hidden="true">${item.icon}</i><div><strong>${item.title}</strong><small>${detail}</small></div><button class="alert-action" data-view="${item.view}">${clear ? 'Vezi lista' : item.action}<span aria-hidden="true">→</span></button></article>`;
        })
        .join('');

  const history = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(`${month}-15T12:00:00`);
    d.setMonth(d.getMonth() - i);
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    history.push({ month: m, value: cashSummary(session.state, m).income });
  }
  const max = Math.max(1, ...history.map(r => r.value));
  // Culoarea ține de luna calendaristică, nu de poziția din fereastra de 12
  // luni — altfel aceeași lună schimba culoare la fiecare mutare a lunii selectate.
  const BAR_COLORS = ['orange', 'yellow', 'mint'];
  $('bars').innerHTML = history
    .map(
      r =>
        `<div class="bar ${BAR_COLORS[Number(r.month.slice(5, 7)) % 3]}" title="${r.month}: ${money(r.value)}"><i style="height:${(r.value / max) * 100}%"></i><small>${r.month.slice(5)}</small></div>`,
    )
    .join('');

  renderBirthdays();
}

const CAL_WEEKDAYS = ['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm', 'Dum'];

function calendarCellHTML(cell) {
  const chips = cell.names
    .map(
      n =>
        `<span class="cal-chip" title="${esc(n.name)} · împlinește ${n.turningAge} ${n.turningAge === 1 ? 'an' : 'ani'}">${esc(n.name)}</span>`,
    )
    .join('');
  const cls = [
    'cal-cell',
    cell.inMonth ? '' : 'cal-outside',
    cell.isToday ? 'cal-today' : '',
    cell.isCurrentWeek ? 'cal-current-week' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const confetti = cell.isToday && cell.names.length ? '<span class="cal-confetti" aria-hidden="true">🎉</span>' : '';
  return `<div class="${cls}">${confetti}<span class="cal-daynum">${cell.day}</span>${chips ? `<div class="cal-chips">${chips}</div>` : ''}</div>`;
}

// Calendar lunar cu adevărat, nu o listă: săptămâna curentă evidențiată prin
// fundalul rândului, ziua de naștere afișată direct pe ziua ei.
function birthdaysCalendarHTML(weeks) {
  const header = CAL_WEEKDAYS.map(l => `<div class="cal-weekday">${l}</div>`).join('');
  const cells = weeks.flat().map(calendarCellHTML).join('');
  return header + cells;
}

function upcomingBirthdayPillHTML(r) {
  const label = r.daysUntil === 0 ? 'azi' : r.daysUntil === 1 ? 'mâine' : `în ${r.daysUntil} zile`;
  const confetti = r.daysUntil === 0 ? '🎉 ' : '';
  return (
    `<span class="upcoming-pill${r.daysUntil === 0 ? ' is-today' : ''}">${confetti}${esc(r.child.name)}` +
    `<small>${label} · împlinește ${r.turningAge} ${r.turningAge === 1 ? 'an' : 'ani'}</small></span>`
  );
}

function renderBirthdays() {
  const upcoming = upcomingBirthdays(session.state.children, 5);
  $('birthdaysUpcoming').innerHTML =
    upcoming.map(upcomingBirthdayPillHTML).join('') ||
    '<p class="upcoming-empty">Nicio zi de naștere în următoarele 5 zile.</p>';
  $('birthdaysCalendar').innerHTML = birthdaysCalendarHTML(monthCalendar(session.state.children));
}

const STATUS_COLUMNS = {
  contract: r => contractOf(r.child),
  name: r => r.child.name,
  expected: r => r.o.expected,
  paid: r => r.o.paid,
  rest: r => r.o.rest,
  credit: r => r.o.credit,
  due: r => r.o.due,
  label: r => r.o.label,
};

function renderStatus(month, all) {
  $('statusPeriod').textContent = `Luna ${month} · situație la ${date(today())}`;
  const sorted = sortTable('status', all, STATUS_COLUMNS, render);
  $('statusTable').innerHTML =
    pageRows('status', sorted)
      .map(({ child: c, o }) => {
        return (
          `<tr><td>${esc(contractOf(c))}</td><td>${esc(c.name)}${c.archived ? ' (arhivat)' : ''}</td>` +
          `<td>${money(o.expected)}</td><td>${money(o.paid)}</td><td>${money(o.rest)}</td><td>${money(o.credit)}</td>` +
          `<td>${date(o.due)}</td><td>${esc(o.label)}</td></tr>`
        );
      })
      .join('') || '<tr><td colspan="8">Nu sunt copii.</td></tr>';
}

// ─── De notificat ───────────────────────────────────────────────────────────

// Textul din coloana „Termen”, formulat din perspectiva persoanei care sună.
function termLabel(days) {
  if (days < 0) return `întârziere ${-days} ${-days === 1 ? 'zi' : 'zile'}`;
  if (days === 0) return 'scadent azi';
  return `în ${days} ${days === 1 ? 'zi' : 'zile'}`;
}

const NOTIFY_COLUMNS = {
  contract: r => contractOf(r.child),
  name: r => r.child.name,
  group: r => groupName(r.child.groupId),
  due: r => r.o.due,
  daysToDue: r => r.o.daysToDue,
  expected: r => r.o.expected,
  paid: r => r.o.paid,
  rest: r => r.o.rest,
  label: r => r.o.label,
};

function renderNotify(month, all, unassignedByChild) {
  const notified = all.filter(r => r.o.notify);
  // Implicit: întârzierea cea mai veche prima — costă cel mai mult dacă mai
  // așteaptă. Un click pe un antet suprascrie asta cu sortarea manuală.
  const rows = sortTable(
    'notify',
    [...notified].sort((a, b) => a.o.daysToDue - b.o.daysToDue || a.child.name.localeCompare(b.child.name, 'ro')),
    NOTIFY_COLUMNS,
    render,
  );

  const late = notified.filter(r => r.o.daysToDue < 0);
  const soon = notified.filter(r => r.o.daysToDue >= 0);
  const owed = notified.reduce((sum, r) => sum + cents(r.o.rest), 0) / 100;
  // Fișele fără taxă sau fără perioadă confirmată nu pot fi evaluate deloc;
  // fără cifra asta, un „0 de notificat” ar părea liniștitor pe nedrept.
  const unknown = all.filter(r => r.o.label === 'De verificat').length;

  setNavCount('notifyCount', notified.length);
  $('notifyPeriod').textContent = `Luna ${month} · situație la ${date(today())}`;
  $('notifyStats').innerHTML =
    `<article class="card pink"><p>Cu întârziere</p><strong>${late.length}</strong><small>scadența a trecut</small></article>` +
    `<article class="card yellow"><p>Nescadente încă</p><strong>${soon.length}</strong><small>de plată, dar scadența n-a trecut</small></article>` +
    `<article class="card orange"><p>Sumă de încasat</p><strong>${money(owed)}</strong><small>total pe lista de mai jos</small></article>` +
    `<article class="card mint"><p>Nu pot fi evaluați</p><strong>${unknown}</strong><small>fără taxă sau perioadă confirmată</small></article>`;

  $('notifyTable').innerHTML =
    rows
      .map(({ child: c, o }) => {
        // Plata poate sta needentificată în Asociere achitări: fără semnalul
        // ăsta, operatorul ar suna un părinte care de fapt a plătit deja.
        const hint = unassignedByChild.has(c.id)
          ? ` <button type="button" class="hint-link" data-view="assign">posibilă plată neasociată</button>`
          : '';
        return (
          `<tr class="${o.daysToDue < 0 ? 'late-row' : ''}"><td>${esc(contractOf(c))}</td>` +
          `<td>${button('profile', 'children', c.id, c.name)}</td><td>${parentContacts(c)}</td>` +
          `<td>${esc(groupName(c.groupId) || '—')}</td><td>${date(o.due)}</td><td>${esc(termLabel(o.daysToDue))}</td>` +
          `<td>${money(o.expected)}</td><td>${money(o.paid)}</td><td><strong>${money(o.rest)}</strong></td>` +
          `<td>${esc(o.label)}${hint}</td></tr>`
        );
      })
      .join('') ||
    `<tr><td colspan="10" class="empty">${
      unknown
        ? 'Nimeni de notificat, dar ' + unknown + ' fișe nu pot fi evaluate. Completează taxa și perioada.'
        : 'Nimeni de notificat pentru luna aceasta.'
    }</td></tr>`;
}

// Deschis by default doar cardul pe care operatorul a apăsat „Detalii” —
// lista de membri, educatorul etc. nu au ce căuta în privirea generală.
const expandedGroups = new Set();
// Aceleași culori ca la Dashboard, ca ecranul de Grupe să pară din aceeași
// familie vizuală, nu un ecran de administrare separat.
const GROUP_COLORS = ['orange', 'mint', 'yellow'];

function groupCard(g, children, index) {
  const members = children.filter(c => c.groupId === g.id).sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  const overCapacity = g.capacity && members.length > g.capacity;
  const fillValue = g.capacity ? `${members.length}/${g.capacity}` : `${members.length}`;
  const birthDates = members.map(c => c.birthDate).filter(Boolean).sort();
  const ageRange = !birthDates.length
    ? 'necunoscută'
    : birthDates[0] === birthDates.at(-1)
      ? age(birthDates[0])
      : `${age(birthDates.at(-1))} – ${age(birthDates[0])}`;
  const expanded = expandedGroups.has(g.id);
  const unassigned = children.filter(c => !c.groupId);
  const colorClass = overCapacity ? 'pink' : GROUP_COLORS[index % GROUP_COLORS.length];
  return (
    `<article class="group-card ${expanded ? 'expanded' : ''}" data-group="${esc(g.id)}">` +
    `<button type="button" class="card ${colorClass} group-tile" data-toggle aria-expanded="${expanded}">` +
    `<svg class="group-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>` +
    `<p>${esc(g.name)}</p>` +
    `<strong>${fillValue}</strong>` +
    `<small>${overCapacity ? 'copii — peste capacitate' : 'copii'}</small>` +
    `</button>` +
    `<div class="group-details" ${expanded ? '' : 'hidden'}>` +
    `<div class="group-edit"><input data-name value="${esc(g.name)}" placeholder="nume grupă">` +
    `<input data-capacity type="number" min="1" max="1000" value="${g.capacity ?? ''}" placeholder="capacitate">` +
    `<button type="button" class="action-btn" data-save>Salvează</button></div>` +
    `<label class="field">Educator<input data-educator value="${esc(g.educator || '')}" placeholder="Nume educator"></label>` +
    `<p class="group-fact">Vârste: <strong>${ageRange}</strong></p>` +
    `<ul class="group-children">${
      members
        .map(
          c =>
            `<li><span>${esc(c.name)}</span><button type="button" data-remove="${esc(c.id)}" aria-label="Scoate din grupă" title="Scoate din grupă">×</button></li>`,
        )
        .join('') || '<li class="empty">Niciun copil atribuit.</li>'
    }</ul>` +
    `<div class="group-add">` +
    childPickerHTML({
      placeholder: unassigned.length ? 'Caută copil…' : 'Toți copiii nearhivați sunt atribuiți',
    }) +
    `<button type="button" class="action-btn" data-add-btn ${unassigned.length ? '' : 'disabled'}>+ Adaugă</button></div>` +
    `<button type="button" class="btn btn-ghost" data-delete>Șterge grupa</button>` +
    `</div>` +
    `</article>`
  );
}

function renderGroups() {
  const children = session.state.children.filter(c => !c.archived);
  const groups = [...session.state.groups].sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  $('groupsGrid').innerHTML =
    groups.map((g, i) => groupCard(g, children, i)).join('') ||
    '<p class="groups-empty">Nu există grupe create încă. Adaugă prima mai sus.</p>';
  const unassigned = children
    .filter(c => !c.groupId)
    .sort((a, b) => a.name.localeCompare(b.name, 'ro'))
    .map(c => ({ id: c.id, label: c.name }));
  for (const picker of $('groupsGrid').querySelectorAll('[data-child-picker]')) wireChildPicker(picker, unassigned);
}

export function bindGroups() {
  $('groupCreateForm').onsubmit = async event => {
    event.preventDefault();
    const name = $('groupNameInput').value.trim();
    if (!name) {
      message('Completează numele grupei.', true);
      return;
    }
    const capacityRaw = $('groupCapacityInput').value.trim();
    try {
      await mutate('/api/record', {
        type: 'groups',
        mode: 'create',
        record: { id: `GRP-${crypto.randomUUID()}`, name, capacity: capacityRaw ? Number(capacityRaw) : null },
      });
      $('groupCreateForm').reset();
      message('Grupă creată.');
    } catch (e) {
      message(e.message, true);
    }
  };

  $('groupsGrid').addEventListener('click', async event => {
    const card = event.target.closest('[data-group]');
    if (!card) return;
    const id = card.dataset.group;
    if (event.target.closest('[data-toggle]')) {
      if (expandedGroups.has(id)) expandedGroups.delete(id);
      else expandedGroups.add(id);
      renderGroups();
      return;
    }
    try {
      if (event.target.dataset.save !== undefined) {
        const name = card.querySelector('[data-name]').value.trim();
        if (!name) {
          message('Numele grupei nu poate fi gol.', true);
          return;
        }
        const capacityRaw = card.querySelector('[data-capacity]').value.trim();
        const educator = card.querySelector('[data-educator]').value.trim();
        const g = session.state.groups.find(g => g.id === id);
        await mutate('/api/record', {
          type: 'groups',
          mode: 'update',
          record: { ...g, name, capacity: capacityRaw ? Number(capacityRaw) : null, educator },
        });
        message('Grupă actualizată.');
      } else if (event.target.dataset.delete !== undefined) {
        await mutate('/api/group-delete', { id });
        expandedGroups.delete(id);
        message('Grupă ștearsă.');
      } else if (event.target.dataset.addBtn !== undefined) {
        const childId = card.querySelector('.child-picker-value').value;
        if (!childId) return;
        const c = session.state.children.find(c => c.id === childId);
        await mutate('/api/record', { type: 'children', mode: 'update', record: { ...c, groupId: id } });
        message('Copil atribuit grupei.');
      } else if (event.target.dataset.remove !== undefined) {
        const c = session.state.children.find(c => c.id === event.target.dataset.remove);
        await mutate('/api/record', { type: 'children', mode: 'update', record: { ...c, groupId: null } });
        message('Copil scos din grupă.');
      }
    } catch (e) {
      message(e.message, true);
    }
  });
}

// ─── Categorii de cheltuieli ────────────────────────────────────────────────
// Doar etichete text pentru sugestii (vezi editor.mjs); ștergerea unei
// categorii nu schimbă cheltuielile care o folosesc deja.
function renderCategories() {
  const categories = [...session.state.categories].sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  $('categoriesChips').innerHTML =
    categories
      .map(
        c =>
          `<span class="category-chip" data-category="${esc(c.id)}">${esc(c.name)}` +
          `<button type="button" data-remove title="Șterge categoria">×</button></span>`,
      )
      .join('') || '<span class="muted">Nicio categorie adăugată încă — se folosesc doar sugestiile implicite.</span>';
  // Selecția curentă a filtrului se păstrează la re-randare, ca alegerea
  // operatorului să nu sară înapoi pe „Toate” la fiecare mutație de stare.
  const filter = $('expensesCategory');
  const current = filter.value;
  filter.innerHTML =
    '<option value="">Toate</option>' + expenseCategories().map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  filter.value = current;
}

export function bindCategories() {
  $('categoryCreateForm').onsubmit = async event => {
    event.preventDefault();
    const name = $('categoryNameInput').value.trim();
    if (!name) {
      message('Completează numele categoriei.', true);
      return;
    }
    try {
      await mutate('/api/record', {
        type: 'categories',
        mode: 'create',
        record: { id: `CAT-${crypto.randomUUID()}`, name },
      });
      $('categoryCreateForm').reset();
      message('Categorie adăugată.');
    } catch (e) {
      message(e.message, true);
    }
  };
  $('categoriesChips').addEventListener('click', async event => {
    if (event.target.dataset.remove === undefined) return;
    const id = event.target.closest('[data-category]').dataset.category;
    try {
      await mutate('/api/category-delete', { id });
      message('Categorie ștearsă.');
    } catch (e) {
      message(e.message, true);
    }
  });
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
  const unassignedByChild = unassignedSuggestionsByChild(session.state);
  renderDashboard(month, cash, review, nonArchived);
  renderChildrenSummary(review);
  for (const type of ['children', 'payments', 'expenses']) renderList(type);
  renderStatus(month, allChildren);
  renderNotify(month, nonArchived, unassignedByChild);
  renderFees();
  renderAssign();
  renderGroups();
  renderCategories();
  renderPaymentsChildFilter();
  renderReview(review);
}

// ─── Fișa copilului ─────────────────────────────────────────────────────────

const profileSection = (title, html) => `<section class="profile-section"><h4>${esc(title)}</h4>${html}</section>`;

function historyList(rows, render) {
  return rows.length
    ? `<ul class="history-list">${[...rows]
        .sort((a, b) => a.from.localeCompare(b.from))
        .map(r => `<li><strong>${esc(r.from)}</strong> ${render(r)}</li>`)
        .join('')}</ul>`
    : '<p class="muted">Fără istoric.</p>';
}

export function profile(id) {
  const c = session.state.children.find(r => r.id === id),
    payments = session.state.payments.filter(p => p.childId === id),
    month = selectedMonth(),
    o = obligation(c, month, payments);
  const paymentsRows =
    payments
      .map(
        p =>
          `<tr class="${p.archived ? 'archived-row' : ''}"><td>${date(p.date)}</td><td>${money(p.amount)}</td>` +
          `<td>${tenderLabel(p)}</td><td>${
            allocations(p)
              .map(a => `${esc(monthLabel(a.month))}: ${money(a.amount)}`)
              .join('<br>') || 'Avans nerepartizat'
          }</td></tr>`,
      )
      .join('') || `<tr><td colspan="4" class="empty">Fără achitări.</td></tr>`;
  $('profileBody').innerHTML =
    `<div class="profile-head"><div><h3>${esc(c.name)}</h3>` +
    `<span class="badge ${statusBadgeClass(c.status)}">${esc(c.status)}${c.archived ? ' · Arhivat' : ''}</span></div>` +
    `<p class="muted">Contract ${esc(contractOf(c))} · Grupa ${esc(session.state.groups.find(g => g.id === c.groupId)?.name || 'nealocată')} · Vârstă ${age(c.birthDate)}</p></div>` +
    `<div class="profile-grid">` +
    profileSection('Părinți', `<p>${parentContacts(c)}</p>`) +
    profileSection(
      'Contract',
      `<p>Contract: ${date(c.contractDate)}<br>Frecventare: ${date(c.attendanceDate)}<br>Retragere: ${date(c.withdrawalDate)}</p>`,
    ) +
    profileSection(
      'Taxă și scadență',
      `<p>Taxă curentă: ${o.expected === null ? 'necunoscută' : money(o.expected)}<br>Ziua scadenței: ${dueDayFor(c)}<br>Scadență luna ${esc(month)}: ${date(o.due)}</p>`,
    ) +
    profileSection(
      `Situație luna ${month}`,
      `<p>${esc(o.label)}<br>Rest: ${money(o.rest)} · Credit: ${money(o.credit)}</p>`,
    ) +
    `</div>` +
    profileSection(
      'Istoric taxe și statut',
      `<div class="profile-grid">` +
        profileSection(
          'Taxe',
          historyList(c.feeHistory || [], f => `— ${money(f.amount)}`),
        ) +
        profileSection(
          'Statut',
          historyList(c.statusHistory || [], s => `— ${esc(s.status)}`),
        ) +
        `</div>`,
    ) +
    profileSection('Achitări', `<div class="table-wrap"><table><tbody>${paymentsRows}</tbody></table></div>`) +
    (c.notes ? profileSection('Observații', `<p>${esc(c.notes)}</p>`) : '');
  $('profile').showModal();
}

// ─── Istoric ────────────────────────────────────────────────────────────────

let auditOffset = 0;

async function renderAudit(append = false) {
  const rows = await api(`/api/audit?offset=${auditOffset}`);
  const html =
    rows
      .map(r => {
        const before = JSON.parse(r.before_json || 'null'),
          after = JSON.parse(r.after_json || 'null');
        const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
        const diff = [...keys]
          .filter(k => JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k]))
          .map(k => `${k}: ${JSON.stringify(before?.[k] ?? null)} → ${JSON.stringify(after?.[k] ?? null)}`)
          .join('\n');
        return `<details><summary>${esc(time(r.created_at))} · ${esc(r.action)} · ${esc(r.record_id || 'Setări')}</summary><pre>${esc(diff)}</pre></details>`;
      })
      .join('') || '<p>Nu mai sunt modificări.</p>';
  if (append) $('auditList').insertAdjacentHTML('beforeend', html);
  else $('auditList').innerHTML = html;
  $('auditMore').disabled = rows.length < 100;
}

export function moreAudit() {
  auditOffset += 100;
  return renderAudit(true);
}
