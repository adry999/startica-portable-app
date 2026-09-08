import { today } from '../domain.mjs';
import { unassignedPayments, assignmentRisk } from '../payment-matching.mjs';
import { $, esc, money, date } from './dom.mjs';
import { session, message, mutate } from './session.mjs';

const BATCH = 200;

// Sugestiile ordonate, plus lista completă: potrivirea automată nu este de
// încredere pe datele astea, deci alegerea rămâne întotdeauna a operatorului.
const option = s => `<option value="${esc(s.id)}">${esc(s.name)} — ${esc(s.reasons.join('; '))}</option>`;

// Două grupuri separate, pentru că indiciile nu sunt la fel de tari: numele din
// sursă arată spre un copil anume, pe când o sumă sau o lună neachitată se
// potrivesc la zeci de copii. Doar primul grup poate fi acceptat în masă.
function childOptions(suggestions) {
  const named = suggestions
    .filter(s => s.nameMatch)
    .map(option)
    .join('');
  const weak = suggestions
    .filter(s => !s.nameMatch)
    .map(option)
    .join('');
  const rest = session.state.children
    .filter(c => !c.archived && !suggestions.some(s => s.id === c.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'ro'))
    .map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`)
    .join('');
  return (
    '<option value="">— alege copilul —</option>' +
    (named ? `<optgroup label="Nume potrivit în sursă">${named}</optgroup>` : '') +
    (weak ? `<optgroup label="Doar sumă sau lună — verifică">${weak}</optgroup>` : '') +
    `<optgroup label="Toți copiii">${rest}</optgroup>`
  );
}

function row({ payment: p, suggestions }) {
  const months = (p.allocations || []).map(a => `${esc(a.month)}: ${money(a.amount)}`).join('<br>') || '—';
  const source = p.sourceName || p.childName || '';
  return (
    `<tr data-payment="${esc(p.id)}"><td>${date(p.date)}</td><td><strong>${money(p.amount)}</strong></td>` +
    `<td>${esc(p.method || '')}</td><td>${months}</td>` +
    `<td>${source ? esc(source) : '<small>fără text în sursă</small>'}</td>` +
    `<td><select data-assign>${childOptions(suggestions)}</select></td></tr>`
  );
}

// Construirea sugestiilor pentru un lot de 200 costă ~50 ms, prea mult pentru
// fiecare randare a aplicației. Insigna și cardurile de risc sunt ieftine și se
// actualizează mereu; tabelul se construiește doar când ecranul este vizibil.
export function renderAssign(force = false) {
  const month = $('selectedMonth').value || today().slice(0, 7);
  const risk = assignmentRisk(session.state, month, today());
  $('assignCount').textContent = risk.unassigned;
  $('assignRisk').innerHTML =
    `<article class="card pink"><p>Achitări fără copil</p><strong>${risk.unassigned}</strong><small>nu se scad din datoria nimănui</small></article>` +
    `<article class="card yellow"><p>Din care pe luna ${esc(month)}</p><strong>${risk.coveringMonth}</strong><small>${money(risk.amountCoveringMonth)}</small></article>` +
    `<article class="card orange"><p>Copii pe lista de notificat</p><strong>${risk.notified}</strong><small>unii pot să fi achitat deja</small></article>`;

  if (!force && !$('assign').classList.contains('active')) return;
  const items = unassignedPayments(session.state, BATCH);
  // Defalcarea se calculează pe lotul afișat, nu pe toate cele neasociate:
  // sugestiile pentru mii de achitări la fiecare randare ar încetini interfața.
  const unique = items.filter(i => i.suggestions.filter(s => s.nameMatch).length === 1).length;
  const ambiguous = items.filter(i => i.suggestions.filter(s => s.nameMatch).length > 1).length;
  $('assignInfo').textContent = risk.unassigned
    ? `Se afișează cele mai recente ${items.length} din ${risk.unassigned}. ` +
      `Din ele: ${unique} cu un singur nume potrivit, ${ambiguous} cu mai mulți candidați, ` +
      `${items.length - unique - ambiguous} fără niciun nume în sursă — acelea cer documentul original.`
    : 'Toate achitările au un copil asociat.';
  $('assignTable').innerHTML =
    items.map(row).join('') || '<tr><td colspan="6" class="empty">Nu există achitări neasociate.</td></tr>';
}

function collect() {
  const assignments = [];
  for (const tr of $('assignTable').querySelectorAll('tr[data-payment]')) {
    const childId = tr.querySelector('[data-assign]').value;
    if (childId) assignments.push({ id: tr.dataset.payment, childId });
  }
  return assignments;
}

export function bindAssign() {
  // Completează doar rândurile unde numele din sursă indică un copil anume.
  // Potrivirile bazate exclusiv pe sumă sau pe luna neachitată sunt lăsate
  // deliberat pe seama operatorului: acceptate în masă, ar lega achitări de
  // copii la întâmplare, iar rezultatul ar fi o listă de notificat care pare
  // corectă și nu este.
  $('assignFillSuggested').onclick = () => {
    let filled = 0;
    for (const tr of $('assignTable').querySelectorAll('tr[data-payment]')) {
      const select = tr.querySelector('[data-assign]');
      const named = select.querySelectorAll('optgroup[label="Nume potrivit în sursă"] option');
      // Un singur candidat cu nume potrivit; două nume la fel de plauzibile
      // înseamnă că trebuie ales manual.
      if (!select.value && named.length === 1) {
        select.value = named[0].value;
        filled++;
      }
    }
    message(
      filled
        ? `${filled} rânduri completate acolo unde numele din sursă indică un singur copil. Verifică-le înainte de a salva.`
        : 'Niciun rând nu are un nume potrivit fără ambiguitate. Alege manual.',
      !filled,
    );
  };

  $('assignClear').onclick = () => {
    for (const select of $('assignTable').querySelectorAll('[data-assign]')) select.value = '';
    message('Selecțiile au fost golite.');
  };

  $('assignSave').onclick = async () => {
    const b = $('assignSave');
    $('assignError').textContent = '';
    try {
      const assignments = collect();
      if (!assignments.length) throw Error('Nu ai ales niciun copil.');
      b.disabled = true;
      const result = await mutate('/api/payments-assign', { assignments });
      if (!result.warning) message(`${assignments.length} achitări asociate.`);
    } catch (e) {
      $('assignError').textContent = e.message;
      message(e.message, true);
    } finally {
      b.disabled = false;
    }
  };
}
