import {
  today,
  cents,
  total,
  normalizeRecord,
  allocations,
  paymentTenders,
  CHILD_STATUSES,
  STATUS_HISTORY_VALUES,
} from '../domain.mjs';
import { $, esc, money } from './dom.mjs';
import { session, message, mutate, renderSaveStatus } from './session.mjs';
import { field, select, textarea } from './parts.mjs';

const ID_PREFIX = { children: 'ID', payments: 'PAY', expenses: 'EXP' };
const TITLE = { children: 'copil', payments: 'achitare', expenses: 'cheltuială' };

// ─── Repartizarea pe luni ───────────────────────────────────────────────────

export function addAllocation(a) {
  session.editorDirty = true;
  const row = document.createElement('div');
  row.className = 'allocation';
  row.innerHTML =
    `<label>Luna<input type="month" data-month value="${esc(a.month)}" required></label>` +
    `<label>Suma<input type="number" data-amount value="${esc(a.amount)}" min="0.01" step="0.01" required></label>` +
    `<button type="button" class="action-btn" aria-label="Elimină repartizarea">×</button>`;
  row.querySelector('button').onclick = () => {
    session.editorDirty = true;
    row.remove();
    allocationBalance();
  };
  row.oninput = allocationBalance;
  $('allocationRows').append(row);
  allocationBalance();
}

const readAllocations = () =>
  [...$('allocationRows').children].map(row => ({
    month: row.querySelector('[data-month]').value,
    amount: Number(row.querySelector('[data-amount]').value),
  }));

// Un câmp gol înseamnă „metoda nu a fost folosită”, nu o sumă de zero.
const readTenders = () =>
  [...document.querySelectorAll('[data-tender]')]
    .map(input => ({ method: input.dataset.tender, amount: Number(input.value) }))
    .filter(p => p.amount !== 0);

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

// ─── Istoricul taxelor și al statutului ─────────────────────────────────────

export function parseHistory(value, key) {
  return value
    .split('\n')
    .filter(s => s.trim())
    .map(s => {
      const parts = s.split('=');
      if (parts.length !== 2) throw Error('Istoric invalid. Folosește formatul lună = valoare.');
      return { from: parts[0].trim(), [key]: key === 'amount' ? Number(parts[1].trim()) : parts[1].trim() };
    });
}

const upsertHistory = (rows, from, key, value) => [...rows.filter(r => r.from !== from), { from, [key]: value }];

// ─── Formularele ────────────────────────────────────────────────────────────

function childFields(r) {
  const groups = [...new Set(session.state.children.map(c => c.group).filter(Boolean))];
  return (
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
    '<p class="notice full">Taxele se aplică integral lunii începute. O taxă sau un statut schimbat adaugă o intrare din luna aleasă. Poți corecta explicit rândurile din istoric. Completează data începerii pentru calculul obligațiilor.</p>'
  );
}

function paymentFields(r) {
  const children = session.state.children
    .map(
      c =>
        `<option value="${esc(c.id)}" ${c.id === r.childId ? 'selected' : ''}>${esc(c.name)}${c.archived ? ' (arhivat)' : ''}</option>`,
    )
    .join('');
  const methods = [...new Set(['Cash', 'Card', 'Transfer', ...paymentTenders(r).map(p => p.method)])]
    .map(method =>
      field(
        'tender' + method,
        method,
        paymentTenders(r).find(p => p.method === method)?.amount || '',
        'number',
        `min="0" step="0.01" data-tender="${esc(method)}"`,
      ),
    )
    .join('');
  return (
    `<label class="field full">Copil<select name="childId"><option value="">Copil neasociat</option>${children}</select></label>` +
    field('date', 'Data încasării', r.date || today(), 'date', 'required') +
    field('amount', 'Total achitare (calculat automat)', r.amount ?? 0, 'number', 'readonly step="0.01"') +
    `<div class="full tender-fields"><p>Completează una sau mai multe metode. Totalul se calculează automat; repartizarea pe luni folosește acest total o singură dată.</p>${methods}</div>` +
    field('sourceName', 'Nume din sursă / plătitor', r.sourceName || r.childName || '') +
    `<div class="full"><h3>Repartizare pe luni</h3><p>Suma rămasă nerepartizată este evidențiată ca avans.</p><div id="allocationRows"></div><button type="button" class="action-btn" id="addAllocation">+ Lună</button><p id="allocationBalance"></p></div>` +
    `<label class="field full"><span><input name="reviewed" type="checkbox" ${r.reviewed ? 'checked' : ''}> Am verificat observațiile importului</span><small>${esc(r.verification || 'Fără observații de import')}</small></label>`
  );
}

const expenseFields = r =>
  field('date', 'Data cheltuielii', r.date || today(), 'date', 'required') +
  field('amount', 'Suma', r.amount ?? '', 'number', 'required min="0.01" step="0.01"') +
  field('category', 'Categorie', r.category || 'Altele', 'text', 'required') +
  field('description', 'Descriere', r.description);

const FIELDS = { children: childFields, payments: paymentFields, expenses: expenseFields };

export function openEditor(type, id) {
  if (!session.ready || session.pending) {
    message('Reîncarcă datele înainte de a deschide un formular.', true);
    return;
  }
  const existing = session.state[type].find(r => r.id === id);
  const r = structuredClone(existing || { id: `${ID_PREFIX[type]}-${crypto.randomUUID()}` });
  // Revizia este reținută la deschidere: salvarea se compară cu datele pe care
  // utilizatorul chiar le-a văzut, nu cu cele sosite între timp.
  session.editor = { type, record: r, mode: existing ? 'update' : 'create', revision: session.revision };
  $('editorTitle').textContent = (existing ? 'Editează: ' : 'Adaugă: ') + TITLE[type];
  $('editorError').textContent = '';
  $('editorFields').innerHTML = FIELDS[type](r) + textarea('notes', 'Observații', r.notes);
  if (type === 'payments') {
    for (const a of allocations(r)) addAllocation(a);
    if (!existing) addAllocation({ month: $('selectedMonth').value, amount: '' });
    $('addAllocation').onclick = () => addAllocation({ month: '', amount: '' });
    for (const input of document.querySelectorAll('[data-tender]')) input.oninput = updatePaymentTotal;
    updatePaymentTotal();
  }
  // addAllocation a marcat formularul ca modificat; deschiderea nu este o modificare.
  session.editorDirty = false;
  $('editor').showModal();
  renderSaveStatus();
}

// ─── Salvarea ───────────────────────────────────────────────────────────────

function childFromForm(r, v) {
  const record = {
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
  const previous = session.editor.record;
  // O taxă sau un statut schimbat adaugă o intrare din luna aleasă, ca lunile
  // trecute să păstreze valoarea de atunci.
  if (record.fee !== null && v.feeFrom && (!record.feeHistory.length || record.fee !== previous.fee))
    record.feeHistory = upsertHistory(record.feeHistory, v.feeFrom, 'amount', record.fee);
  if (!record.statusHistory.length && (previous.status || record.status) === 'Activ' && record.attendanceDate)
    record.statusHistory = [{ from: record.attendanceDate.slice(0, 7), status: 'Activ' }];
  if (
    STATUS_HISTORY_VALUES.includes(record.status) &&
    (!record.statusHistory.length || record.status !== (previous.status || 'Activ'))
  )
    record.statusHistory = upsertHistory(record.statusHistory, v.statusFrom, 'status', record.status);
  return record;
}

function paymentFromForm(r, v) {
  const record = normalizeRecord('payments', {
    ...r,
    childId: v.childId,
    date: v.date,
    // Totalul se recalculează din metode; valoarea din câmp e doar afișaj.
    amount: undefined,
    tenders: readTenders(),
    sourceName: v.sourceName,
    reviewed: v.reviewed === 'on',
    allocations: readAllocations(),
  });
  const duplicate = session.state.payments.some(
    p =>
      !p.archived &&
      p.childId === record.childId &&
      p.date === record.date &&
      cents(p.amount) === cents(record.amount) &&
      p.method === record.method,
  );
  if (
    session.editor.mode === 'create' &&
    duplicate &&
    !confirm('Există o plată cu același copil, aceeași dată, sumă și metodă. Confirmi că este o plată distinctă?')
  )
    return null;
  return record;
}

const expenseFromForm = (r, v) => ({
  ...r,
  date: v.date,
  amount: Number(v.amount),
  category: v.category.trim(),
  description: v.description.trim(),
});

const FROM_FORM = { children: childFromForm, payments: paymentFromForm, expenses: expenseFromForm };

export function bindEditorForm() {
  $('editorForm').onsubmit = async event => {
    event.preventDefault();
    if (session.busy) return;
    const v = Object.fromEntries(new FormData(event.currentTarget));
    const { type, mode, revision } = session.editor;
    $('editorSave').disabled = true;
    try {
      let r = FROM_FORM[type]({ ...session.editor.record, notes: v.notes }, v);
      if (r === null) return; // dublură neconfirmată
      r = normalizeRecord(type, r);
      await mutate('/api/record', { type, record: r, mode }, revision);
      $('editor').close();
      session.editor = null;
    } catch (e) {
      session.saveError = e.message;
      $('editorError').textContent = e.message;
      message(e.message, true);
    } finally {
      $('editorSave').disabled = false;
      renderSaveStatus();
    }
  };
}

// ─── Acțiuni pe rânduri ─────────────────────────────────────────────────────

export async function archive(type, id) {
  const r = session.state[type].find(item => item.id === id);
  const explanation =
    type === 'children'
      ? 'Arhivarea ascunde copilul din registrul curent; nu modifică obligațiile istorice.'
      : 'Arhivarea exclude suma din rapoarte și este înregistrată în istoric.';
  if (!confirm(`${r.archived ? 'Reactivezi' : 'Arhivezi'} înregistrarea ${id}? ${explanation}`)) return;
  await mutate('/api/record', {
    type,
    mode: 'update',
    record: { ...r, archived: !r.archived, archivedAt: r.archived ? '' : new Date().toISOString() },
  });
}

export async function confirmReview(id) {
  const record = session.state.payments.find(item => item.id === id);
  if (!record || record.reviewed) return;
  await mutate('/api/record', { type: 'payments', mode: 'update', record: { ...record, reviewed: true } });
  message('Potrivirea automată a fost marcată ca verificată.');
}
