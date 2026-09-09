import { today, allocations } from '../../shared/domain.mjs';
import { unassignedPayments, assignmentRisk } from '../../shared/payment-matching.mjs';
import { $, esc, money, date, setNavCount } from './dom.mjs';
import { session, message, mutate } from './session.mjs';
import { sortTable } from './parts.mjs';
import { childPickerHTML, wireChildPicker } from './child-picker.mjs';

const BATCH = 200;
// Ultimul lot randat, ca fillSuggested/collect să știe sugestiile fiecărui
// rând fără să le recalculeze sau să le citească înapoi din HTML.
let lastItems = [];

// Sugestiile ordonate, plus lista completă: potrivirea automată nu este de
// încredere pe datele astea, deci alegerea rămâne întotdeauna a operatorului.
const optionLabel = s => `${s.name} — ${s.reasons.join('; ')}`;

// Două grupuri separate, pentru că indiciile nu sunt la fel de tari: numele din
// sursă arată spre un copil anume, pe când o sumă sau o lună neachitată se
// potrivesc la zeci de copii. Doar primul grup poate fi acceptat în masă.
function childOptions(suggestions) {
  const named = suggestions
    .filter(s => s.nameMatch)
    .map(s => ({ id: s.id, label: optionLabel(s), group: 'Nume potrivit în sursă' }));
  const weak = suggestions
    .filter(s => !s.nameMatch)
    .map(s => ({ id: s.id, label: optionLabel(s), group: 'Doar sumă sau lună — verifică' }));
  const rest = session.state.children
    .filter(c => !c.archived && !suggestions.some(s => s.id === c.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'ro'))
    .map(c => ({ id: c.id, label: c.name, group: 'Toți copiii' }));
  return [...named, ...weak, ...rest];
}

function row({ payment: p, suggestions }) {
  const months =
    allocations(p)
      .map(a => `${esc(a.month)}: ${money(a.amount)}`)
      .join('<br>') || '—';
  const source = p.sourceName || p.childName || '';
  return (
    `<tr data-payment="${esc(p.id)}"><td>${date(p.date)}</td><td><strong>${money(p.amount)}</strong></td>` +
    `<td>${esc(p.method || '')}</td><td>${months}</td>` +
    `<td>${source ? esc(source) : '<small>fără text în sursă</small>'}</td>` +
    `<td>${childPickerHTML({ placeholder: '— alege copilul —' })}</td></tr>`
  );
}

// Construirea sugestiilor pentru un lot de 200 costă ~50 ms, prea mult pentru
// fiecare randare a aplicației. Insigna și cardurile de risc sunt ieftine și se
// actualizează mereu; tabelul se construiește doar când ecranul este vizibil.
export function renderAssign(force = false) {
  const month = $('selectedMonth').value || today().slice(0, 7);
  const risk = assignmentRisk(session.state, month, today());
  setNavCount('assignCount', risk.unassigned);
  $('assignRisk').innerHTML =
    `<article class="card pink"><p>Achitări fără copil</p><strong>${risk.unassigned}</strong><small>nu se scad din datoria nimănui</small></article>` +
    `<article class="card yellow"><p>Din care pe luna ${esc(month)}</p><strong>${risk.coveringMonth}</strong><small>${money(risk.amountCoveringMonth)}</small></article>` +
    `<article class="card orange"><p>Copii pe lista de notificat</p><strong>${risk.notified}</strong><small>unii pot să fi achitat deja</small></article>`;

  if (!force && !$('assign').classList.contains('active')) return;
  const unsorted = unassignedPayments(session.state, BATCH);
  // Defalcarea se calculează pe lotul afișat, nu pe toate cele neasociate:
  // sugestiile pentru mii de achitări la fiecare randare ar încetini interfața.
  const unique = unsorted.filter(i => i.suggestions.filter(s => s.nameMatch).length === 1).length;
  const ambiguous = unsorted.filter(i => i.suggestions.filter(s => s.nameMatch).length > 1).length;
  $('assignInfo').textContent = risk.unassigned
    ? `Se afișează cele mai recente ${unsorted.length} din ${risk.unassigned}. ` +
      `Din ele: ${unique} cu un singur nume potrivit, ${ambiguous} cu mai mulți candidați, ` +
      `${unsorted.length - unique - ambiguous} fără niciun nume în sursă — acelea cer documentul original.`
    : 'Toate achitările au un copil asociat.';
  const items = sortTable(
    'assign',
    unsorted,
    {
      date: r => r.payment.date,
      amount: r => Number(r.payment.amount) || 0,
      method: r => r.payment.method || '',
      source: r => r.payment.sourceName || r.payment.childName || '',
    },
    () => renderAssign(true),
  );
  lastItems = items;
  $('assignTable').innerHTML =
    items.map(row).join('') || '<tr><td colspan="6" class="empty">Nu există achitări neasociate.</td></tr>';
  for (const tr of $('assignTable').querySelectorAll('tr[data-payment]')) {
    const item = items.find(i => i.payment.id === tr.dataset.payment);
    wireChildPicker(tr.querySelector('[data-child-picker]'), childOptions(item.suggestions));
  }
}

function collect() {
  const assignments = [];
  for (const tr of $('assignTable').querySelectorAll('tr[data-payment]')) {
    const childId = tr.querySelector('.child-picker-value').value;
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
      const item = lastItems.find(i => i.payment.id === tr.dataset.payment);
      const named = item.suggestions.filter(s => s.nameMatch);
      const hidden = tr.querySelector('.child-picker-value');
      // Un singur candidat cu nume potrivit; două nume la fel de plauzibile
      // înseamnă că trebuie ales manual.
      if (!hidden.value && named.length === 1) {
        hidden.value = named[0].id;
        tr.querySelector('.child-picker-input').value = optionLabel(named[0]);
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
    for (const tr of $('assignTable').querySelectorAll('tr[data-payment]')) {
      tr.querySelector('.child-picker-value').value = '';
      tr.querySelector('.child-picker-input').value = '';
    }
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
