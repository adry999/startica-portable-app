import { today, monthOK, STATUS_HISTORY_VALUES } from '../../shared/domain.mjs';
import { $, esc, date, setNavCount } from './dom.mjs';
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

function groupOptions(selected) {
  const groups = [...session.state.groups].sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  return (
    `<option value="">Fără grupă</option>` +
    groups
      .map(g => `<option value="${esc(g.id)}" ${g.id === selected ? 'selected' : ''}>${esc(g.name)}</option>`)
      .join('')
  );
}

function row(c) {
  const currentStatus = c.status || 'Activ';
  const statusOptions = [...new Set([currentStatus, ...STATUS_HISTORY_VALUES])]
    .map(s => `<option value="${esc(s)}" ${s === currentStatus ? 'selected' : ''}>${esc(s)}</option>`)
    .join('');
  const currentFee = c.feeHistory?.at(-1)?.amount ?? c.fee ?? '';
  return (
    `<tr data-child="${esc(c.id)}"><td>${esc(c.contractNumber || c.id)}</td><td>${esc(c.name)}</td>` +
    `<td>${date(c.attendanceDate)}</td>` +
    `<td><select data-group data-group-initial="${esc(c.groupId || '')}">${groupOptions(c.groupId || '')}</select></td>` +
    `<td><input data-fee type="number" min="0" step="0.01" value="${esc(currentFee)}" data-fee-initial="${esc(currentFee)}" placeholder="taxă"></td>` +
    `<td><input data-from type="month" value="${esc(defaultFrom(c))}"></td>` +
    `<td><select data-status data-status-initial="${esc(currentStatus)}">${statusOptions}</select></td></tr>`
  );
}

export function renderFees() {
  const missing = session.state.children.filter(c => !c.archived && missingFee(c)).length;
  setNavCount('feesCount', missing);
  $('feesInfo').textContent = missing
    ? `${missing} copii fără taxă completată: nu pot fi evaluați și nu apar pe lista de notificat.`
    : 'Toți copiii nearhivați au taxa completată.';
  const rows = visibleChildren();
  $('feesTable').innerHTML =
    rows.map(row).join('') || '<tr><td colspan="7" class="empty">Nimic de completat pentru filtrul ales.</td></tr>';
  $('feesPending').textContent = `${rows.length} rânduri afișate`;
  $('feesBulkGroup').innerHTML = groupOptions('');
}

// Se trimite un câmp doar dacă diferă de valoarea afișată inițial, ca un rând
// neatins să nu suprascrie tăcut o fișă existentă.
function collect() {
  const updates = [];
  for (const tr of $('feesTable').querySelectorAll('tr[data-child]')) {
    const feeInput = tr.querySelector('[data-fee]'),
      groupInput = tr.querySelector('[data-group]'),
      statusInput = tr.querySelector('[data-status]'),
      fromInput = tr.querySelector('[data-from]');
    const fee = feeInput.value.trim(),
      group = groupInput.value,
      status = statusInput.value;
    const update = { id: tr.dataset.child, from: fromInput.value };
    let changed = false;
    if (fee !== '' && fee !== feeInput.dataset.feeInitial) {
      update.fee = Number(fee);
      changed = true;
    }
    if (group !== groupInput.dataset.groupInitial) {
      update.groupId = group || null;
      changed = true;
    }
    if (status !== statusInput.dataset.statusInitial) {
      update.status = status;
      changed = true;
    }
    if (!changed) continue;
    if (!monthOK(update.from)) throw Error(`Completează luna de aplicare pentru ${tr.cells[1].textContent}.`);
    updates.push(update);
  }
  return updates;
}

export function bindFees() {
  $('feesFilter').onchange = renderFees;

  $('feesApplyAll').onclick = () => {
    const amount = $('feesBulkAmount').value.trim(),
      group = $('feesBulkGroup').value,
      status = $('feesBulkStatus').value;
    if (!amount && !group && !status) {
      message('Completează o taxă, o grupă sau un statut de aplicat.', true);
      return;
    }
    for (const tr of $('feesTable').querySelectorAll('tr[data-child]')) {
      if (amount) tr.querySelector('[data-fee]').value = amount;
      if (group) tr.querySelector('[data-group]').value = group;
      if (status) tr.querySelector('[data-status]').value = status;
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
