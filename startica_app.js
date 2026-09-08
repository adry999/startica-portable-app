import {
  emptyState,
  today,
  cents,
  total,
  normalizeRecord,
  obligation,
  cashSummary,
  allocations,
  paymentTenders,
  CHILD_STATUSES,
  STATUS_HISTORY_VALUES,
} from './domain.mjs';
import { readWorkbook, exportWorkbook } from './excel.mjs';
import { reviewCenter, filteredReviewItems } from './review-center.mjs';
const $ = id => document.getElementById(id),
  esc = v =>
    String(v ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c],
    );
const money = v =>
  v === null
    ? '—'
    : new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v) || 0) +
      ' lei';
const date = v => (v ? new Date(v + 'T12:00:00').toLocaleDateString('ro-RO') : '—'),
  time = v => (v ? new Date(v).toLocaleString('ro-RO') : 'niciodată');
let state = emptyState(),
  revision = 0,
  token = '',
  health = {},
  ready = false,
  pending = null,
  busy = false,
  editor = null,
  importData = null,
  restoreData = null,
  auditOffset = 0,
  csvData = null,
  csvLoading = false;
let editorDirty = false,
  settingsDirty = false,
  settingsBusy = false,
  loading = false,
  checkingHealth = false,
  lastSavedAt = '',
  saveError = '',
  settingsError = '',
  connectionError = '';
function renderSaveStatus() {
  const draft = editorDirty && $('editor').open,
    backupError = health.localError || health.externalError;
  let status = 'saved',
    label = 'Date salvate',
    detail = lastSavedAt ? 'Pe disc · ' + time(lastSavedAt) : 'Date încărcate de pe disc';
  if (!ready || loading) {
    status = 'pending';
    label = 'Se verifică datele…';
    detail = 'Se așteaptă confirmarea serverului';
  }
  if (draft || settingsDirty) {
    status = 'pending';
    label = 'Modificări nesalvate';
    detail = 'Apasă Salvează pentru a le păstra pe disc';
  }
  if (pending || busy || settingsBusy) {
    status = 'pending';
    label = 'Se salvează…';
    detail = 'Așteaptă confirmarea înainte de închidere';
  }
  if (backupError) {
    status = 'error';
    label = 'Problemă la backup';
    detail = backupError;
  }
  if (saveError || settingsError) {
    status = 'error';
    label = 'Salvare neconfirmată';
    detail = saveError || settingsError;
  }
  if (connectionError) {
    status = 'error';
    label = 'Conexiune întreruptă';
    detail = connectionError;
  }
  const indicator = $('saveIndicator');
  indicator.dataset.state = status;
  $('saveStatus').textContent = label;
  $('saveDetail').textContent = detail;
  indicator.title =
    detail +
    (lastSavedAt ? '\nUltima salvare confirmată: ' + time(lastSavedAt) : '') +
    '\nSalvarea locală nu confirmă sincronizarea Google Drive.';
}
const pages = { children: 0, payments: 0, expenses: 0, review: 0 };
function message(text, error = false) {
  $('message').className = 'notice' + (error ? ' error' : '');
  $('message').textContent = text;
}
// Serverul poate: (a) să nu răspundă — operațiunea are stare necunoscută și
// trebuie verificată; (b) să răspundă cu ceva ce nu e JSON — a fost contactat,
// deci nu e o problemă de conexiune. Cele două cazuri cer acțiuni diferite din
// partea utilizatorului, deci nu pot avea același mesaj.
const networkFailure = () => {
  connectionError = 'Apasă „Reîncarcă datele” pentru a verifica ultima operațiune.';
  renderSaveStatus();
  return Object.assign(Error('Conexiune întreruptă. ' + connectionError), { network: true });
};
async function api(path, body) {
  let response;
  try {
    response = await fetch(path, {
      signal: AbortSignal.timeout(body === undefined ? 10000 : 60000),
      ...(body === undefined
        ? {}
        : {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Startica-Token': token },
            body: JSON.stringify(body),
          }),
    });
  } catch {
    throw networkFailure();
  }
  let result;
  try {
    result = await response.json();
  } catch (e) {
    // Corpul întrerupt sau expirat rămâne o cădere de conexiune.
    if (e?.name === 'AbortError' || e?.name === 'TimeoutError') throw networkFailure();
    connectionError = '';
    renderSaveStatus();
    throw Object.assign(
      Error(`Serverul a răspuns neașteptat (cod ${response.status}). Reîncarcă aplicația și verifică jurnalele.`),
      { status: response.status },
    );
  }
  connectionError = '';
  renderSaveStatus();
  if (!response.ok) throw Object.assign(Error(result.error || 'Operațiunea a eșuat.'), { status: response.status });
  return result;
}
function accept(result) {
  if (result.state) {
    state = result.state;
    revision = result.revision;
    ready = true;
    lastSavedAt = result.updatedAt || '';
    render();
  }
  if (result.health) {
    health = result.health;
    renderHealth();
  }
  if (result.warning) message(result.warning, true);
  renderSaveStatus();
}
async function load() {
  if (busy || settingsBusy) return;
  if (pending) {
    await executePending();
    return;
  }
  loading = true;
  renderSaveStatus();
  try {
    token = (await api('/api/session')).token;
    accept(await api('/api/state'));
    health = await api('/api/health');
    saveError = '';
    renderHealth();
  } catch (e) {
    saveError = e.message;
    throw e;
  } finally {
    loading = false;
    renderSaveStatus();
  }
}
async function executePending() {
  if (busy) return;
  busy = true;
  saveError = '';
  renderSaveStatus();
  try {
    const result = await api(pending.path, pending.body);
    pending = null;
    accept(result);
    if (!result.warning) message('Date salvate.');
    return result;
  } catch (e) {
    saveError = e.message;
    if (e.status) {
      pending = null;
      if (e.status === 403) token = (await api('/api/session')).token;
    }
    message(e.message, true);
    throw e;
  } finally {
    busy = false;
    renderSaveStatus();
  }
}
async function mutate(path, body, base = revision) {
  if (!ready) throw Error('Așteaptă încărcarea datelor.');
  if (pending || busy) throw Error('Verifică operațiunea anterioară cu „Reîncarcă datele”.');
  pending = { path, body: { ...body, revision: base, requestId: crypto.randomUUID() } };
  return executePending();
}
function childName(p) {
  return state.children.find(c => c.id === p.childId)?.name || p.childName || p.sourceName || 'Copil neasociat';
}
function parentContacts(c) {
  return (
    [
      [c.parent, c.phone],
      [c.parent2, c.phone2],
    ]
      .filter(pair => pair.some(Boolean))
      .map(([name, phone]) => `${esc(name || 'Nume necompletat')}${phone ? '<br>' + esc(phone) : ''}`)
      .join('<br>') || 'Necompletat'
  );
}
function tenderLabel(p) {
  return paymentTenders(p)
    .map(part => `${esc(part.method)}: ${money(part.amount)}`)
    .join('<br>');
}
function button(action, type, id, label) {
  return `<button type="button" class="action-btn" data-action="${action}" data-type="${type}" data-id="${esc(id)}">${esc(label)}</button>`;
}
function actions(type, r) {
  return (
    button('edit', type, r.id, 'Editează') +
    ' ' +
    button('archive', type, r.id, r.archived ? 'Reactivează' : 'Arhivează')
  );
}
function go(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === id));
  document.querySelectorAll('.nav').forEach(v => v.classList.toggle('active', v.dataset.view === id));
  if (id === 'audit') {
    auditOffset = 0;
    void renderAudit().catch(e => message(e.message, true));
  }
  window.scrollTo(0, 0);
}
function reviewTag(category, labels) {
  return `<span class="review-tag ${esc(category)}">${esc(labels[category] || category)}</span>`;
}
function renderReview(center) {
  const filter = $('reviewFilter').value,
    search = $('reviewSearch').value,
    rows = filteredReviewItems(center, filter, search),
    progress = center.progress;
  $('reviewProgress').innerHTML =
    `<article><small>Probleme afișate</small><strong>${rows.length}</strong><small>din ${center.items.length} fișe / achitări cu observații</small></article><article><small>Verificări import confirmate</small><strong>${progress.confirmed} / ${progress.total}</strong><small>confirmarea păstrează asocierea și suma existente</small></article><article><small>Verificări import rămase</small><strong>${progress.pending}</strong><small>achitările fără copil, dublurile și sumele provizorii necesită corectare</small></article>`;
  $('reviewList').innerHTML = `<div id="reviewPager" class="pager"></div><div id="reviewRows"></div>`;
  const visible = pageRows('review', rows);
  $('reviewRows').innerHTML =
    visible
      .map(item => {
        const payment = item.type === 'payments',
          r = item.record;
        const details = payment
          ? `${date(r.date)} · ${money(r.amount)}${r.sourceName ? ` · sursă: ${esc(r.sourceName)}` : ''}${r.childId ? ` · copil: ${esc(childName(r))}` : ''}`
          : `Contract: ${esc(r.contractNumber || r.id)} · Grupă: ${esc(r.group || 'necompletată')}`;
        const tags = item.categories.map(category => reviewTag(category, center.labels)).join('');
        const confirm = item.canConfirm ? button('confirm-review', 'payments', item.id, 'Confirmă asocierea') : '';
        return `<div class="review-row"><span><strong>${esc(item.name)}</strong> · ${esc(item.id)}<div class="review-tags">${tags}</div><small>${details}</small><small>${item.reasons.map(esc).join(' · ')}</small></span><div class="review-actions">${button('edit', item.type, item.id, payment ? 'Corectează achitarea' : 'Corectează fișa')}${confirm}</div></div>`;
      })
      .join('') || '<p class="empty">Nu există înregistrări pentru filtrul ales.</p>';
}
function renderHealth() {
  const stale = !health.lastLocal || Date.now() - new Date(health.lastLocal).getTime() > 86400000,
    externalStale = !health.lastExternal || Date.now() - new Date(health.lastExternal).getTime() > 86400000;
  $('backupStatus').textContent = health.localError
    ? 'Backup local eșuat'
    : stale
      ? 'Backup local vechi/lipsă'
      : !health.externalDir
        ? 'Backup local OK · copie externă neconfigurată'
        : health.externalError || externalStale
          ? 'Copia externă necesită atenție'
          : 'Backup local și copie externă verificate';
  $('backupStatus').classList.toggle(
    'danger',
    !!(health.localError || stale || !health.externalDir || health.externalError || externalStale),
  );
  $('healthDetails').innerHTML =
    `<p>Bază: ${esc(health.database)}</p><p>Backup local: ${esc(time(health.lastLocal))}</p><p>Copie externă: ${esc(time(health.lastExternal))}</p><p class="danger">${esc(health.localError || health.externalError || (!health.externalDir ? 'Copia externă nu este configurată.' : ''))}</p><p>Sincronizarea în cloud nu este confirmată de aplicație. Verifică starea din Google Drive.</p><p>Păstrare locală: ultimele 20 de copii, câte una pentru ultimele 30 de zile cu backup și 12 luni cu backup. Copiile dinaintea importului, restaurării și migrării sunt păstrate separat.</p>`;
  if (!settingsDirty && !settingsBusy) $('externalDir').value = health.externalDir || '';
  renderSaveStatus();
}
function pageRows(type, rows) {
  const page = (pages[type] = Math.min(pages[type], Math.max(0, Math.ceil(rows.length / 100) - 1)));
  const pager = $(`${type}Pager`);
  if (pager)
    pager.innerHTML = `<span>${rows.length} înregistrări · pagina ${page + 1}/${Math.max(1, Math.ceil(rows.length / 100))}</span><button class="action-btn" data-page="${type}" data-delta="-1" ${page === 0 ? 'disabled' : ''}>Înapoi</button><button class="action-btn" data-page="${type}" data-delta="1" ${(page + 1) * 100 >= rows.length ? 'disabled' : ''}>Înainte</button>`;
  return rows.slice(page * 100, (page + 1) * 100);
}
function renderList(type) {
  const search = $(`${type}Search`).value.toLocaleLowerCase('ro-RO'),
    archive = $(`${type}Archive`).value,
    month = $(`${type}Month`)?.value;
  const rows = state[type].filter(
    r =>
      (archive === 'all' || (archive === 'archived' ? r.archived : !r.archived)) &&
      (!month || r.date.startsWith(month)) &&
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
      ])
        .toLocaleLowerCase('ro-RO')
        .includes(search),
  );
  if (type !== 'children') rows.sort((a, b) => b.date.localeCompare(a.date));
  const headings =
    type === 'children'
      ? ['Copil', 'Părinți / telefoane', 'Grupă', 'Statut', 'Acțiuni']
      : type === 'payments'
        ? ['Data', 'Copil / sursă', 'Total', 'Luni acoperite', 'Cash / Card / Transfer', 'Acțiuni']
        : ['Data', 'Categorie', 'Descriere', 'Suma', 'Acțiuni'];
  $(`${type}Head`).innerHTML = '<tr>' + headings.map(h => `<th>${h}</th>`).join('') + '</tr>';
  $(`${type}Table`).innerHTML =
    pageRows(type, rows)
      .map(r => {
        const cells =
          type === 'children'
            ? [
                button('profile', type, r.id, r.name),
                parentContacts(r),
                esc(r.group || 'Lipsește'),
                esc(r.status) + (r.archived ? ' · Arhivat' : ''),
                actions(type, r),
              ]
            : type === 'payments'
              ? [
                  date(r.date),
                  esc(childName(r)) + (r.childId ? '' : '<br><small>Neasociată</small>'),
                  money(r.amount),
                  allocations(r)
                    .map(a => `${esc(a.month)}: ${money(a.amount)}`)
                    .join('<br>') || 'Avans nerepartizat',
                  tenderLabel(r),
                  actions(type, r),
                ]
              : [date(r.date), esc(r.category), esc(r.description), money(r.amount), actions(type, r)];
        return `<tr class="${r.archived ? 'archived-row' : ''}">${cells.map(c => `<td>${c}</td>`).join('')}</tr>`;
      })
      .join('') ||
    `<tr><td colspan="${headings.length}" class="empty">Nu există înregistrări pentru filtrele alese.</td></tr>`;
}
function render() {
  const month = $('selectedMonth').value || today().slice(0, 7),
    cash = cashSummary(state, month),
    review = reviewCenter(state);
  $('incomeStat').textContent = money(cash.income);
  $('expenseStat').textContent = money(cash.expense);
  $('netStat').textContent = money(cash.net);
  $('incomeMethods').textContent = Object.entries(cash.byMethod)
    .filter(([method, value]) => method !== 'Altele' || value)
    .map(([method, value]) => `${method}: ${money(value)}`)
    .join(' · ');
  $('advanceStat').textContent = money(
    state.payments
      .filter(p => !p.archived && p.date <= today())
      .reduce((sum, p) => sum + cents(p.amount) - allocations(p).reduce((n, a) => n + cents(a.amount), 0), 0) / 100,
  );
  $('reviewCount').textContent = review.items.length;
  $('alerts').innerHTML =
    `<p>${review.items.length} fișe sau achitări de verificat.</p><p>${state.payments.filter(p => !p.archived && !p.childId).length} plăți fără copil asociat.</p>`;
  for (const type of ['children', 'payments', 'expenses']) renderList(type);
  $('statusPeriod').textContent = `Luna ${month} · situație la ${date(today())}`;
  $('statusTable').innerHTML =
    state.children
      .map(c => {
        const o = obligation(c, month, state.payments);
        return `<tr><td>${esc(c.name)}${c.archived ? ' (arhivat)' : ''}</td><td>${money(o.expected)}</td><td>${money(o.paid)}</td><td>${money(o.rest)}</td><td>${money(o.credit)}</td><td>${date(o.due)}</td><td>${esc(o.label)}</td></tr>`;
      })
      .join('') || '<tr><td colspan="7">Nu sunt copii.</td></tr>';
  const groups = [...new Set(state.children.map(c => c.group).filter(Boolean))].sort();
  $('groupsGrid').innerHTML =
    groups
      .map(
        g =>
          `<article class="card mint"><h3>${esc(g)}</h3><p>${state.children.filter(c => c.group === g && !c.archived).length} copii nearhivați</p></article>`,
      )
      .join('') || '<p>Nu sunt grupe completate.</p>';
  renderReview(review);
  const history = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(`${month}-15T12:00:00`);
    d.setMonth(d.getMonth() - i);
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    history.push({ month: m, value: cashSummary(state, m).income });
  }
  const max = Math.max(1, ...history.map(r => r.value));
  $('bars').innerHTML = history
    .map(
      r =>
        `<div class="bar" title="${r.month}: ${money(r.value)}"><i style="height:${(r.value / max) * 100}%"></i><small>${r.month.slice(5)}</small></div>`,
    )
    .join('');
}
function field(name, label, value = '', type = 'text', extra = '') {
  return `<label class="field">${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
}
function select(name, label, value, choices) {
  return `<label class="field">${label}<select name="${name}">${[...new Set([value, ...choices])].map(v => `<option value="${esc(v)}" ${v === value ? 'selected' : ''}>${esc(v || 'Neasociat')}</option>`).join('')}</select></label>`;
}
function textarea(name, label, value) {
  return `<label class="field full">${label}<textarea name="${name}">${esc(value || '')}</textarea></label>`;
}
function openEditor(type, id) {
  if (!ready || pending) {
    message('Reîncarcă datele înainte de a deschide un formular.', true);
    return;
  }
  const existing = state[type].find(r => r.id === id);
  const r = structuredClone(
    existing || { id: `${{ children: 'ID', payments: 'PAY', expenses: 'EXP' }[type]}-${crypto.randomUUID()}` },
  );
  editor = { type, record: r, mode: existing ? 'update' : 'create', revision };
  editorDirty = false;
  $('editorTitle').textContent =
    (existing ? 'Editează: ' : 'Adaugă: ') + { children: 'copil', payments: 'achitare', expenses: 'cheltuială' }[type];
  $('editorError').textContent = '';
  let html = '';
  if (type === 'children') {
    const groups = [...new Set(state.children.map(c => c.group).filter(Boolean))];
    html =
      field('name', 'Nume copil', r.name, 'text', 'required') +
      field('parent', 'Părinte 1 (opțional)', r.parent) +
      field('phone', 'Telefon părinte 1 (opțional)', r.phone, 'tel') +
      field('parent2', 'Părinte 2 (opțional)', r.parent2) +
      field('phone2', 'Telefon părinte 2 (opțional)', r.phone2, 'tel') +
      field('group', 'Grupă (nume sau număr)', r.group, 'text', 'list="groupOptions"') +
      `<datalist id="groupOptions">${groups.map(g => `<option value="${esc(g)}"></option>`).join('')}</datalist>` +
      field('birthDate', 'Data nașterii', r.birthDate, 'date') +
      field('contractDate', 'Data contractului', r.contractDate, 'date') +
      field('attendanceDate', 'Început frecventare', r.attendanceDate, 'date') +
      field('withdrawalDate', 'Retragere', r.withdrawalDate, 'date') +
      select('status', 'Statut', r.status || 'Activ', CHILD_STATUSES) +
      field('statusFrom', 'Statut aplicabil din luna', today().slice(0, 7), 'month', 'required') +
      field('fee', 'Taxa lunară (gol = necunoscută)', r.fee ?? '', 'number', 'min="0" step="0.01"') +
      field('feeFrom', 'Taxa aplicabilă din luna', today().slice(0, 7), 'month') +
      field('dueDay', 'Ziua scadenței', r.dueDay || 10, 'number', 'min="1" max="31" required') +
      textarea(
        'feeHistory',
        'Istoric taxe — câte un rând: 2026-09 = 2000',
        (r.feeHistory || []).map(f => `${f.from} = ${f.amount}`).join('\n'),
      ) +
      textarea(
        'statusHistory',
        'Istoric statut — câte un rând: 2026-09 = Activ',
        (r.statusHistory || []).map(f => `${f.from} = ${f.status}`).join('\n'),
      ) +
      '<p class="notice full">Taxele se aplică integral lunii începute. O taxă sau un statut schimbat adaugă o intrare din luna aleasă. Poți corecta explicit rândurile din istoric. Completează data începerii pentru calculul obligațiilor.</p>';
  } else if (type === 'payments') {
    html =
      `<label class="field full">Copil<select name="childId"><option value="">Copil neasociat</option>${state.children.map(c => `<option value="${esc(c.id)}" ${c.id === r.childId ? 'selected' : ''}>${esc(c.name)}${c.archived ? ' (arhivat)' : ''}</option>`).join('')}</select></label>` +
      field('date', 'Data încasării', r.date || today(), 'date', 'required') +
      field('amount', 'Total achitare (calculat automat)', r.amount ?? 0, 'number', 'readonly step="0.01"') +
      `<div class="full tender-fields"><p>Completează una sau mai multe metode. Totalul se calculează automat; repartizarea pe luni folosește acest total o singură dată.</p>${[...new Set(['Cash', 'Card', 'Transfer', ...paymentTenders(r).map(p => p.method)])].map(method => field('tender' + method, method, paymentTenders(r).find(p => p.method === method)?.amount || '', 'number', `min="0" step="0.01" data-tender="${esc(method)}"`)).join('')}</div>` +
      field('sourceName', 'Nume din sursă / plătitor', r.sourceName || r.childName || '') +
      `<div class="full"><h3>Repartizare pe luni</h3><p>Suma rămasă nerepartizată este evidențiată ca avans.</p><div id="allocationRows"></div><button type="button" class="action-btn" id="addAllocation">+ Lună</button><p id="allocationBalance"></p></div>` +
      `<label class="field full"><span><input name="reviewed" type="checkbox" ${r.reviewed ? 'checked' : ''}> Am verificat observațiile importului</span><small>${esc(r.verification || 'Fără observații de import')}</small></label>`;
  } else
    html =
      field('date', 'Data cheltuielii', r.date || today(), 'date', 'required') +
      field('amount', 'Suma', r.amount ?? '', 'number', 'required min="0.01" step="0.01"') +
      field('category', 'Categorie', r.category || 'Altele', 'text', 'required') +
      field('description', 'Descriere', r.description);
  html += textarea('notes', 'Observații', r.notes);
  $('editorFields').innerHTML = html;
  if (type === 'payments') {
    for (const a of allocations(r)) addAllocation(a);
    if (!existing) addAllocation({ month: $('selectedMonth').value, amount: '' });
    $('addAllocation').onclick = () => addAllocation({ month: '', amount: '' });
    for (const input of document.querySelectorAll('[data-tender]')) input.oninput = updatePaymentTotal;
    updatePaymentTotal();
  }
  editorDirty = false;
  $('editor').showModal();
  renderSaveStatus();
}
function addAllocation(a) {
  editorDirty = true;
  const row = document.createElement('div');
  row.className = 'allocation';
  row.innerHTML = `<label>Luna<input type="month" data-month value="${esc(a.month)}" required></label><label>Suma<input type="number" data-amount value="${esc(a.amount)}" min="0.01" step="0.01" required></label><button type="button" class="action-btn" aria-label="Elimină repartizarea">×</button>`;
  row.querySelector('button').onclick = () => {
    editorDirty = true;
    row.remove();
    allocationBalance();
  };
  row.oninput = allocationBalance;
  $('allocationRows').append(row);
  allocationBalance();
}
function readAllocations() {
  return [...$('allocationRows').children].map(row => ({
    month: row.querySelector('[data-month]').value,
    amount: Number(row.querySelector('[data-amount]').value),
  }));
}
function readTenders() {
  return [...document.querySelectorAll('[data-tender]')]
    .map(input => ({ method: input.dataset.tender, amount: Number(input.value) }))
    .filter(p => p.amount !== 0);
}
function updatePaymentTotal() {
  $('editorForm').elements.amount.value = (readTenders().reduce((sum, p) => sum + cents(p.amount), 0) / 100).toFixed(2);
  allocationBalance();
}
function allocationBalance() {
  if (!$('allocationRows')) return;
  const amount = Number($('editorForm').elements.amount.value),
    allocated = total(readAllocations());
  $('allocationBalance').textContent =
    `Repartizat: ${money(allocated)} · Nerepartizat: ${money((cents(amount) - cents(allocated)) / 100)}`;
  renderSaveStatus();
}
function parseHistory(value, key) {
  return value
    .split('\n')
    .filter(s => s.trim())
    .map(s => {
      const parts = s.split('=');
      if (parts.length !== 2) throw Error('Istoric invalid. Folosește formatul lună = valoare.');
      return { from: parts[0].trim(), [key]: key === 'amount' ? Number(parts[1].trim()) : parts[1].trim() };
    });
}
function upsertHistory(rows, from, key, value) {
  const rest = rows.filter(r => r.from !== from);
  return [...rest, { from, [key]: value }];
}
$('editorForm').onsubmit = async event => {
  event.preventDefault();
  if (busy) return;
  const f = event.currentTarget,
    v = Object.fromEntries(new FormData(f));
  $('editorSave').disabled = true;
  try {
    let r = { ...editor.record, notes: v.notes };
    if (editor.type === 'children') {
      r = {
        ...r,
        name: v.name.trim(),
        parent: v.parent.trim(),
        phone: v.phone.trim(),
        parent2: v.parent2.trim(),
        phone2: v.phone2.trim(),
        group: v.group.trim(),
        birthDate: v.birthDate,
        contractDate: v.contractDate,
        attendanceDate: v.attendanceDate,
        withdrawalDate: v.withdrawalDate,
        status: v.status,
        fee: v.fee === '' ? null : Number(v.fee),
        dueDay: Number(v.dueDay),
        feeHistory: parseHistory(v.feeHistory, 'amount'),
        statusHistory: parseHistory(v.statusHistory, 'status'),
      };
      if (r.fee !== null && v.feeFrom && (!r.feeHistory.length || r.fee !== editor.record.fee))
        r.feeHistory = upsertHistory(r.feeHistory, v.feeFrom, 'amount', r.fee);
      if (!r.statusHistory.length && (editor.record.status || r.status) === 'Activ' && r.attendanceDate)
        r.statusHistory = [{ from: r.attendanceDate.slice(0, 7), status: 'Activ' }];
      if (
        STATUS_HISTORY_VALUES.includes(r.status) &&
        (!r.statusHistory.length || r.status !== (editor.record.status || 'Activ'))
      )
        r.statusHistory = upsertHistory(r.statusHistory, v.statusFrom, 'status', r.status);
    } else if (editor.type === 'payments') {
      r = normalizeRecord('payments', {
        ...r,
        childId: v.childId,
        date: v.date,
        amount: undefined,
        tenders: readTenders(),
        sourceName: v.sourceName,
        reviewed: v.reviewed === 'on',
        allocations: readAllocations(),
      });
      if (
        editor.mode === 'create' &&
        state.payments.some(
          p =>
            !p.archived &&
            p.childId === r.childId &&
            p.date === r.date &&
            cents(p.amount) === cents(r.amount) &&
            p.method === r.method,
        ) &&
        !confirm('Există o plată cu același copil, aceeași dată, sumă și metodă. Confirmi că este o plată distinctă?')
      )
        return;
    } else
      r = {
        ...r,
        date: v.date,
        amount: Number(v.amount),
        category: v.category.trim(),
        description: v.description.trim(),
      };
    r = normalizeRecord(editor.type, r);
    await mutate('/api/record', { type: editor.type, record: r, mode: editor.mode }, editor.revision);
    $('editor').close();
    editor = null;
  } catch (e) {
    saveError = e.message;
    $('editorError').textContent = e.message;
    message(e.message, true);
  } finally {
    $('editorSave').disabled = false;
    renderSaveStatus();
  }
};
async function archive(type, id) {
  const r = state[type].find(r => r.id === id);
  if (
    !confirm(
      `${r.archived ? 'Reactivezi' : 'Arhivezi'} înregistrarea ${id}? ${type === 'children' ? 'Arhivarea ascunde copilul din registrul curent; nu modifică obligațiile istorice.' : 'Arhivarea exclude suma din rapoarte și este înregistrată în istoric.'}`,
    )
  )
    return;
  await mutate('/api/record', {
    type,
    mode: 'update',
    record: { ...r, archived: !r.archived, archivedAt: r.archived ? '' : new Date().toISOString() },
  });
}
async function confirmReview(id) {
  const record = state.payments.find(item => item.id === id);
  if (!record || record.reviewed) return;
  await mutate('/api/record', { type: 'payments', mode: 'update', record: { ...record, reviewed: true } });
  message('Potrivirea automată a fost marcată ca verificată.');
}
function profile(id) {
  const c = state.children.find(r => r.id === id),
    payments = state.payments.filter(p => p.childId === id),
    o = obligation(c, $('selectedMonth').value, payments);
  $('profileBody').innerHTML =
    `<h3>${esc(c.name)}</h3><p>${parentContacts(c)} · Grupa ${esc(c.group)}</p><p>Contract: ${date(c.contractDate)} · Frecventare: ${date(c.attendanceDate)} · Retragere: ${date(c.withdrawalDate)}</p><p>${esc(c.notes)}</p><p>Luna ${esc($('selectedMonth').value)}: ${esc(o.label)} · Rest ${money(o.rest)} · Credit ${money(o.credit)}</p><h3>Taxe și statute</h3><pre>${esc(JSON.stringify({ taxe: c.feeHistory || [], statute: c.statusHistory || [] }, null, 2))}</pre><h3>Achitări</h3>${
      payments
        .map(
          p =>
            `<p>${date(p.date)} · ${money(p.amount)} · ${tenderLabel(p)} · ${allocations(p)
              .map(a => `${esc(a.month)}: ${money(a.amount)}`)
              .join('; ')}${p.archived ? ' · Arhivată' : ''}</p>`,
        )
        .join('') || '<p>Fără achitări.</p>'
    }`;
  $('profile').showModal();
}
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
const summaryHTML = s =>
  `<p>${s.children} copii · ${s.payments} achitări · ${s.expenses} cheltuieli</p><p>Total achitări: ${money(s.paymentTotal)} · Total cheltuieli: ${money(s.expenseTotal)}</p>`;
$('importChildrenButton').onclick = () => {
  if (!ready || pending || busy || csvLoading) {
    message('Așteaptă sau reîncarcă datele înainte de import.', true);
    return;
  }
  $('childrenCsvInput').click();
};
$('childrenCsvInput').onchange = async event => {
  const file = event.target.files[0];
  if (!file || csvLoading) return;
  csvLoading = true;
  csvData = null;
  $('commitCsv').disabled = true;
  $('csvError').textContent = '';
  try {
    if (file.size > 2000000) throw Error('CSV prea mare (maximum 2 MB).');
    const csv = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
    const report = await api('/api/children-csv-preview', { csv });
    $('csvConfirm').value = '';
    $('csvPreview').innerHTML =
      `<p><strong>${esc(file.name)}</strong></p><p>${report.total} rânduri · ${report.additions.length} copii noi · ${report.skipped} existenți, nemodificați · ${report.conflicts} conflicte, neimportate</p>${report.errors.map(e => `<p class="danger">${esc(e)}</p>`).join('')}${report.warnings.map(w => `<p>${esc(w)}</p>`).join('')}<div class="table-wrap"><table><thead><tr><th>Rând / contract</th><th>Copil</th><th>Părinte / telefon</th><th>Naștere / frecventare</th><th>Rezultat</th></tr></thead><tbody>${report.rows.map(r => `<tr><td>${r.line} / ${esc(r.contractNumber)}</td><td>${esc(r.name)}</td><td>${parentContacts(r)}</td><td>${date(r.birthDate)}<br>${date(r.attendanceDate)}</td><td>${esc(r.reason)}${r.warnings.map(w => `<br><small>${esc(w)}</small>`).join('')}</td></tr>`).join('')}</tbody></table></div>`;
    if (!report.errors.length && report.additions.length)
      csvData = { csv, revision: report.revision, count: report.additions.length };
    $('csvDialog').showModal();
  } catch (e) {
    message(e.message, true);
  } finally {
    csvLoading = false;
    event.target.value = '';
  }
};
$('csvConfirm').oninput = () => {
  $('commitCsv').disabled = !csvData || $('csvConfirm').value !== 'IMPORT COPII';
};
$('commitCsv').onclick = async () => {
  if (!csvData || busy) return;
  $('commitCsv').disabled = true;
  $('csvError').textContent = '';
  try {
    const count = csvData.count;
    const result = await mutate(
      '/api/children-csv',
      { csv: csvData.csv, confirm: $('csvConfirm').value },
      csvData.revision,
    );
    $('csvDialog').close();
    csvData = null;
    if (!result.warning)
      message(`${count} copii importați. Fișele existente, achitările și cheltuielile au fost păstrate.`);
  } catch (e) {
    $('csvError').textContent = e.message;
    message(e.message, true);
  } finally {
    $('commitCsv').disabled = !csvData || !!pending;
  }
};
$('csvDialog').addEventListener('close', () => {
  if (!pending) csvData = null;
});
$('importButton').onclick = () => $('excelInput').click();
$('excelInput').onchange = async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 20000000) throw Error('Fișier prea mare (maximum 20 MB).');
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
    const parsed = readWorkbook(workbook, XLSX);
    let report = parsed;
    if (!parsed.errors.length) {
      const checked = await api('/api/import-preview', { state: parsed.state });
      report = { ...checked, warnings: [...parsed.warnings] };
    }
    importData = report.errors.length ? null : { state: report.state, revision };
    $('importConfirm').value = '';
    $('commitImport').disabled = !importData;
    $('importPreview').innerHTML =
      `<p>${esc(file.name)}</p><p class="notice">Datele curente (${state.children.length} copii, ${state.payments.length} plăți, ${state.expenses.length} cheltuieli) vor fi înlocuite după backup.</p>${report.summary ? summaryHTML(report.summary) : ''}${report.errors.map(e => `<p class="danger">${esc(e)}</p>`).join('')}<details open><summary>${report.warnings.length} avertizări</summary>${report.warnings.map(w => `<p>${esc(w.id || '')} ${esc(w.reason)}</p>`).join('')}</details>`;
    $('importDialog').showModal();
  } catch (e) {
    message(e.message, true);
  } finally {
    event.target.value = '';
  }
};
$('commitImport').onclick = async () => {
  if (!importData) return;
  $('commitImport').disabled = true;
  try {
    await mutate('/api/import', { state: importData.state, confirm: $('importConfirm').value }, importData.revision);
    $('importDialog').close();
    importData = null;
  } catch (e) {
    message(e.message, true);
  } finally {
    $('commitImport').disabled = false;
  }
};
$('exportButton').onclick = () => {
  if (!ready || pending) {
    message('Reîncarcă datele înainte de export.', true);
    return;
  }
  XLSX.writeFile(exportWorkbook(state, XLSX), `Startica_complet_${today()}.xlsx`, { compression: true });
};
$('backupButton').onclick = async () => {
  const b = $('backupButton');
  b.disabled = true;
  try {
    const result = await api('/api/backup', {});
    accept(result);
    if (!result.warning) message('Backup local verificat creat.');
  } catch (e) {
    message(e.message, true);
  } finally {
    b.disabled = false;
  }
};
$('settingsForm').onsubmit = async event => {
  event.preventDefault();
  if (settingsBusy || pending || busy) return;
  const b = event.currentTarget.querySelector('button'),
    field = $('externalDir');
  b.disabled = true;
  field.disabled = true;
  settingsBusy = true;
  settingsError = '';
  renderSaveStatus();
  try {
    const result = await api('/api/settings', { externalDir: field.value });
    settingsDirty = false;
    accept(result);
    if (!result.warning)
      message(
        health.externalDir
          ? 'Copia în folderul extern a fost verificată. Confirmă separat sincronizarea în Google Drive.'
          : 'Backup local configurat.',
      );
  } catch (e) {
    settingsError = e.message;
    message(e.message, true);
  } finally {
    b.disabled = false;
    field.disabled = false;
    settingsBusy = false;
    renderSaveStatus();
  }
};
async function previewRestore() {
  restoreData = null;
  $('commitRestore').disabled = true;
  const name = $('backupSelect').value;
  if (!name) return;
  const s = await api('/api/backup-preview?name=' + encodeURIComponent(name));
  if ($('backupSelect').value !== name) return;
  restoreData = { name, revision };
  $('restorePreview').innerHTML = summaryHTML(s) + s.errors.map(e => `<p class="danger">${esc(e)}</p>`).join('');
  $('commitRestore').disabled = !!s.errors.length;
}
$('restoreButton').onclick = async () => {
  try {
    const backups = await api('/api/backups');
    if (!backups.length) throw Error('Nu există backupuri.');
    $('backupSelect').innerHTML = backups
      .map(b => `<option value="${esc(b.name)}">${esc(time(b.modified))} · ${esc(b.name)}</option>`)
      .join('');
    $('restoreConfirm').value = '';
    $('restoreDialog').showModal();
    await previewRestore();
  } catch (e) {
    message(e.message, true);
  }
};
$('backupSelect').onchange = () => previewRestore().catch(e => message(e.message, true));
$('commitRestore').onclick = async () => {
  if (!restoreData) return;
  $('commitRestore').disabled = true;
  try {
    await mutate('/api/restore', { name: restoreData.name, confirm: $('restoreConfirm').value }, restoreData.revision);
    $('restoreDialog').close();
  } catch (e) {
    message(e.message, true);
  } finally {
    $('commitRestore').disabled = false;
  }
};
document.addEventListener('click', async event => {
  const b = event.target.closest('button');
  if (!b) return;
  try {
    if (b.dataset.view) go(b.dataset.view);
    if (b.dataset.create) openEditor(b.dataset.create);
    if (b.dataset.close) {
      if (busy) {
        message('Așteaptă confirmarea salvării.', true);
        return;
      }
      $(b.dataset.close).close();
    }
    if (b.dataset.page) {
      pages[b.dataset.page] = Math.max(0, pages[b.dataset.page] + Number(b.dataset.delta));
      render();
    }
    const { action, type, id } = b.dataset;
    if (action === 'edit') openEditor(type, id);
    if (action === 'archive') await archive(type, id);
    if (action === 'profile') profile(id);
    if (action === 'confirm-review') await confirmReview(id);
  } catch (e) {
    message(e.message, true);
  }
});
for (const type of ['children', 'payments', 'expenses'])
  for (const suffix of ['Search', 'Archive', 'Month'])
    if ($(`${type}${suffix}`))
      $(`${type}${suffix}`).oninput = () => {
        pages[type] = 0;
        renderList(type);
      };
$('reviewFilter').onchange = () => {
  pages.review = 0;
  render();
};
$('reviewSearch').oninput = () => {
  pages.review = 0;
  render();
};
$('reviewReset').onclick = () => {
  $('reviewFilter').value = 'all';
  $('reviewSearch').value = '';
  pages.review = 0;
  render();
};
$('selectedMonth').value = today().slice(0, 7);
$('selectedMonth').onchange = () => {
  if (!$('selectedMonth').value) $('selectedMonth').value = today().slice(0, 7);
  render();
};
$('reloadButton').onclick = async () => {
  try {
    const recovering = !!pending;
    await load();
    if (recovering) {
      $('editor').close();
      $('importDialog').close();
      $('restoreDialog').close();
      $('csvDialog').close();
      csvData = null;
      editor = null;
    }
    message('Date reîncărcate. Pentru un formular în conflict, închide-l și redeschide înregistrarea.');
  } catch (e) {
    message(e.message, true);
  }
};
$('auditMore').onclick = () => {
  auditOffset += 100;
  void renderAudit(true).catch(e => message(e.message, true));
};
$('printButton').onclick = () => window.print();
$('editorForm').addEventListener('input', () => {
  editorDirty = true;
  renderSaveStatus();
});
$('editorForm').addEventListener(
  'invalid',
  () => {
    saveError = 'Verifică și completează câmpurile marcate în formular.';
    renderSaveStatus();
  },
  true,
);
$('editor').addEventListener('close', () => {
  editorDirty = false;
  renderSaveStatus();
});
$('externalDir').addEventListener('input', () => {
  settingsDirty = $('externalDir').value !== (health.externalDir || '');
  renderSaveStatus();
});
window.addEventListener('beforeunload', event => {
  if (pending || busy || settingsBusy || settingsDirty || (editorDirty && $('editor').open)) {
    event.preventDefault();
    event.returnValue = '';
  }
});
for (const dialog of document.querySelectorAll('dialog'))
  dialog.addEventListener('cancel', event => {
    if (busy) event.preventDefault();
  });
async function checkConnection() {
  if (!ready || busy || pending || settingsBusy || loading || checkingHealth) return;
  checkingHealth = true;
  try {
    health = await api('/api/health');
    renderHealth();
  } catch (e) {
    message(e.message, true);
  } finally {
    checkingHealth = false;
  }
}
setInterval(checkConnection, 30000);
window.addEventListener('focus', checkConnection);
load().catch(e => message('Pornește aplicația din Porneste_Startica.cmd. ' + e.message, true));
