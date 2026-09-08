import { today, monthOK, STATUS_HISTORY_VALUES } from '../../shared/domain.mjs';
import { $, esc, date } from './dom.mjs';
import { session, message, mutate } from './session.mjs';

// Luna din care se aplică taxa și statutul. Începerea frecventării este cea
// corectă: din ea se calculează și lunile trecute. Contractul și luna curentă
// sunt rezerve pentru fișele incomplete.
const defaultFrom = c => (c.attendanceDate || c.contractDate || today()).slice(0, 7);

const missingFee = c => !c.feeHistory?.length;

const visibleChildren = () =>
  session.state.children
    .filter(c => !c.archived && ($('feesFilter').value === 'all' || missingFee(c)))
    .sort((a, b) => a.name.localeCompare(b.name, 'ro'));

function row(c) {
  const statusOptions = STATUS_HISTORY_VALUES.map(
    s => `<option value="${esc(s)}" ${s === 'Activ' ? 'selected' : ''}>${esc(s)}</option>`,
  ).join('');
  return (
    `<tr data-child="${esc(c.id)}"><td>${esc(c.contractNumber || c.id)}</td><td>${esc(c.name)}</td>` +
    `<td>${date(c.attendanceDate)}</td>` +
    `<td><input data-group value="${esc(c.group || '')}" placeholder="grupă"></td>` +
    `<td><input data-fee type="number" min="0" step="0.01" value="${esc(c.feeHistory?.at(-1)?.amount ?? c.fee ?? '')}" placeholder="taxă"></td>` +
    `<td><input data-from type="month" value="${esc(defaultFrom(c))}"></td>` +
    `<td><select data-status>${statusOptions}</select></td></tr>`
  );
}

export function renderFees() {
  const missing = session.state.children.filter(c => !c.archived && missingFee(c)).length;
  $('feesCount').textContent = missing;
  $('feesInfo').textContent = missing
    ? `${missing} copii fără taxă completată: nu pot fi evaluați și nu apar pe lista de notificat.`
    : 'Toți copiii nearhivați au taxa completată.';
  const rows = visibleChildren();
  $('feesTable').innerHTML =
    rows.map(row).join('') || '<tr><td colspan="7" class="empty">Nimic de completat pentru filtrul ales.</td></tr>';
  $('feesPending').textContent = `${rows.length} rânduri afișate`;
}

// Ce s-a completat efectiv: un rând fără taxă nu se trimite, ca să nu
// suprascrie tăcut o fișă pe care utilizatorul nu a atins-o.
function collect() {
  const updates = [];
  for (const tr of $('feesTable').querySelectorAll('tr[data-child]')) {
    const fee = tr.querySelector('[data-fee]').value.trim(),
      from = tr.querySelector('[data-from]').value,
      group = tr.querySelector('[data-group]').value.trim(),
      status = tr.querySelector('[data-status]').value;
    if (!fee) continue;
    if (!monthOK(from)) throw Error(`Completează luna de aplicare pentru ${tr.cells[1].textContent}.`);
    updates.push({ id: tr.dataset.child, fee: Number(fee), from, group, status });
  }
  return updates;
}

export function bindFees() {
  $('feesFilter').onchange = renderFees;

  $('feesApplyAll').onclick = () => {
    const amount = $('feesBulkAmount').value.trim(),
      group = $('feesBulkGroup').value.trim();
    if (!amount && !group) {
      message('Completează o taxă sau o grupă de aplicat.', true);
      return;
    }
    for (const tr of $('feesTable').querySelectorAll('tr[data-child]')) {
      if (amount) tr.querySelector('[data-fee]').value = amount;
      if (group) tr.querySelector('[data-group]').value = group;
    }
    message(`Valorile au fost puse pe rândurile afișate. Verifică excepțiile, apoi salvează.`);
  };

  $('feesSave').onclick = async () => {
    const b = $('feesSave');
    $('feesError').textContent = '';
    try {
      const updates = collect();
      if (!updates.length) throw Error('Nu ai completat nicio taxă.');
      b.disabled = true;
      const result = await mutate('/api/children-setup', { updates });
      if (!result.warning) message(`${updates.length} fișe completate. Verifică lista „De notificat”.`);
    } catch (e) {
      $('feesError').textContent = e.message;
      message(e.message, true);
    } finally {
      b.disabled = false;
    }
  };
}
