import { today, cents, obligation, paymentIndex, cashSummary, allocations, dueDayFor } from '../../shared/domain.mjs';
import { reviewCenter, filteredReviewItems, reviewFilters } from '../../shared/review-center.mjs';
import { $, esc, money, date, time, age, fileSize } from './dom.mjs';
import { session, api, message, renderSaveStatus } from './session.mjs';
import { pages, pageRows, button, actions, childName, parentContacts, tenderLabel, statusBadgeClass } from './parts.mjs';
import { renderFees } from './fees.mjs';
import { renderAssign } from './assign.mjs';

const selectedMonth = () => $('selectedMonth').value || today().slice(0, 7);
// Numărul de contract este identificatorul folosit în discuția cu părintele.
const contractOf = c => c.contractNumber || c.id;

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
    : `Contract: ${esc(r.contractNumber || r.id)} · Grupă: ${esc(r.group || 'necompletată')}`;
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

const HEADINGS = {
  children: ['Contract', 'Copil', 'Părinți / telefoane', 'Grupă', 'Statut', 'Acțiuni'],
  payments: ['Data', 'Copil / sursă', 'Total', 'Luni acoperite', 'Cash / Card / Transfer', 'Acțiuni'],
  expenses: ['Data', 'Categorie', 'Descriere', 'Suma', 'Acțiuni'],
};

const SORT_FIELDS = {
  children: ['contract', 'name', null, 'group', 'status'],
  payments: ['date', 'child', 'amount'],
  expenses: ['date', 'category', 'description', 'amount'],
};
const listSort = {
  children: { field: 'name', direction: 'asc', manual: false },
  payments: { field: 'date', direction: 'desc', manual: false },
  expenses: { field: 'date', direction: 'desc', manual: false },
};

const CELLS = {
  children: r => [
    esc(contractOf(r)),
    button('profile', 'children', r.id, r.name),
    parentContacts(r),
    esc(r.group || 'Lipsește'),
    `<span class="badge ${statusBadgeClass(r.status)}">${esc(r.status)}${r.archived ? ' · Arhivat' : ''}</span>`,
    actions('children', r),
  ],
  payments: r => [
    date(r.date),
    esc(childName(r)) + (r.childId ? '' : '<br><small>Neasociată</small>'),
    money(r.amount),
    allocations(r)
      .map(a => `${esc(a.month)}: ${money(a.amount)}`)
      .join('<br>') || 'Avans nerepartizat',
    tenderLabel(r),
    actions('payments', r),
  ],
  expenses: r => [date(r.date), esc(r.category), esc(r.description), money(r.amount), actions('expenses', r)],
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
    r.group,
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
    month = $(`${type}Month`)?.value;
  const rows = session.state[type].filter(
    r =>
      (archive === 'all' || (archive === 'archived' ? r.archived : !r.archived)) &&
      (!month || r.date.startsWith(month)) &&
      matchesSearch(r, type, search),
  );
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
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

function renderDashboard(month, cash, review, index) {
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
  $('reviewCount').textContent = review.items.length;
  const toNotify = session.state.children.filter(
    c => !c.archived && obligation(c, month, session.state.payments, today(), index).notify,
  ).length;
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
  $('bars').innerHTML = history
    .map(
      r =>
        `<div class="bar" title="${r.month}: ${money(r.value)}"><i style="height:${(r.value / max) * 100}%"></i><small>${r.month.slice(5)}</small></div>`,
    )
    .join('');
}

function renderStatus(month, index) {
  $('statusPeriod').textContent = `Luna ${month} · situație la ${date(today())}`;
  $('statusTable').innerHTML =
    pageRows('status', session.state.children)
      .map(c => {
        const o = obligation(c, month, session.state.payments, today(), index);
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

function renderNotify(month, index) {
  const evaluate = c => obligation(c, month, session.state.payments, today(), index);
  const all = session.state.children.filter(c => !c.archived).map(c => ({ child: c, o: evaluate(c) }));
  const rows = all
    .filter(r => r.o.notify)
    // Cea mai veche întârziere prima: aia costă cel mai mult dacă mai așteaptă.
    .sort((a, b) => a.o.daysToDue - b.o.daysToDue || a.child.name.localeCompare(b.child.name, 'ro'));

  const late = rows.filter(r => r.o.daysToDue < 0);
  const soon = rows.filter(r => r.o.daysToDue >= 0);
  const owed = rows.reduce((sum, r) => sum + cents(r.o.rest), 0) / 100;
  // Fișele fără taxă sau fără perioadă confirmată nu pot fi evaluate deloc;
  // fără cifra asta, un „0 de notificat” ar părea liniștitor pe nedrept.
  const unknown = all.filter(r => r.o.label === 'De verificat').length;

  $('notifyCount').textContent = rows.length;
  $('notifyPeriod').textContent = `Luna ${month} · situație la ${date(today())}`;
  $('notifyStats').innerHTML =
    `<article class="card pink"><p>Cu întârziere</p><strong>${late.length}</strong><small>scadența a trecut</small></article>` +
    `<article class="card yellow"><p>Scadente în curând</p><strong>${soon.length}</strong><small>în cel mult 3 zile</small></article>` +
    `<article class="card orange"><p>Sumă de încasat</p><strong>${money(owed)}</strong><small>total pe lista de mai jos</small></article>` +
    `<article class="card mint"><p>Nu pot fi evaluați</p><strong>${unknown}</strong><small>fără taxă sau perioadă confirmată</small></article>`;

  $('notifyTable').innerHTML =
    rows
      .map(
        ({ child: c, o }) =>
          `<tr class="${o.daysToDue < 0 ? 'late-row' : ''}"><td>${esc(contractOf(c))}</td>` +
          `<td>${button('profile', 'children', c.id, c.name)}</td><td>${parentContacts(c)}</td>` +
          `<td>${esc(c.group || '—')}</td><td>${date(o.due)}</td><td>${esc(termLabel(o.daysToDue))}</td>` +
          `<td>${money(o.expected)}</td><td>${money(o.paid)}</td><td><strong>${money(o.rest)}</strong></td>` +
          `<td>${esc(o.label)}</td></tr>`,
      )
      .join('') ||
    `<tr><td colspan="10" class="empty">${
      unknown
        ? 'Nimeni de notificat, dar ' + unknown + ' fișe nu pot fi evaluate. Completează taxa și perioada.'
        : 'Nimeni de notificat pentru luna aceasta.'
    }</td></tr>`;
}

function renderGroups() {
  const children = session.state.children.filter(c => !c.archived);
  const groups = [...new Set(children.map(c => String(c.group || '').trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'ro'),
  );
  $('groupsGrid').innerHTML =
    groups
      .map(
        g =>
          `<article class="card mint"><h3>${esc(g)}</h3><p>${children.filter(c => String(c.group || '').trim() === g).length} copii nearhivați</p></article>`,
      )
      .join('') || '<p>Nu sunt grupe completate.</p>';
}

function renderChildrenSummary(review) {
  const children = session.state.children.filter(c => !c.archived);
  const active = children.filter(c => c.status === 'Activ').length;
  const occupiedGroups = new Set(children.map(c => String(c.group || '').trim()).filter(Boolean)).size;
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
  // Un singur index de încasări pentru toate ecranele randării curente.
  const index = paymentIndex(session.state.payments, today());
  renderDashboard(month, cash, review, index);
  renderChildrenSummary(review);
  for (const type of ['children', 'payments', 'expenses']) renderList(type);
  renderStatus(month, index);
  renderNotify(month, index);
  renderFees();
  renderAssign();
  renderGroups();
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
              .map(a => `${esc(a.month)}: ${money(a.amount)}`)
              .join('<br>') || 'Avans nerepartizat'
          }</td></tr>`,
      )
      .join('') || `<tr><td colspan="4" class="empty">Fără achitări.</td></tr>`;
  $('profileBody').innerHTML =
    `<div class="profile-head"><div><h3>${esc(c.name)}</h3>` +
    `<span class="badge ${statusBadgeClass(c.status)}">${esc(c.status)}${c.archived ? ' · Arhivat' : ''}</span></div>` +
    `<p class="muted">Contract ${esc(contractOf(c))} · Grupa ${esc(c.group || 'nealocată')} · Vârstă ${age(c.birthDate)}</p></div>` +
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
