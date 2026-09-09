import { paymentTenders } from '../../shared/domain.mjs';
import { $, esc, money } from './dom.mjs';
import { session } from './session.mjs';

// Sugestii de bază pt. categoria de cheltuieli — nu o listă închisă, clientul
// poate scrie oricând una nouă (vezi editor.mjs).
const DEFAULT_EXPENSE_CATEGORIES = [
  'Chirie',
  'Utilități',
  'Salarii',
  'Materiale educaționale',
  'Alimente',
  'Reparații și întreținere',
  'Altele',
];
export const expenseCategories = () =>
  [
    ...new Set([
      ...DEFAULT_EXPENSE_CATEGORIES,
      ...session.state.categories.map(c => c.name),
      ...session.state.expenses.map(e => e.category).filter(Boolean),
    ]),
  ].sort((a, b) => a.localeCompare(b, 'ro'));

const PAGE_SIZE = 100;
// Pagina curentă a fiecărei liste. Resetată când se schimbă filtrele.
export const pages = { children: 0, payments: 0, expenses: 0, review: 0, status: 0 };

// Sortare pt. tabele cu antet static în HTML (Status, De notificat, Asociere
// achitări) — spre deosebire de listHead() din views.mjs, antetul nu se
// regenerează la fiecare randare, deci butoanele se leagă o singură dată aici;
// randările următoare doar actualizează aria-sort și săgeata.
const tableSort = {};

export function sortTable(id, rows, columns, rerender) {
  const head = $(`${id}Head`);
  const s = tableSort[id];
  if (head)
    for (const button of head.querySelectorAll('[data-sort]')) {
      const th = button.closest('th');
      const active = s?.field === button.dataset.sort;
      th.setAttribute('aria-sort', active ? (s.direction === 'asc' ? 'ascending' : 'descending') : 'none');
      button.querySelector('span').textContent = active ? (s.direction === 'asc' ? '↑' : '↓') : '↕';
      button.onclick = () => {
        tableSort[id] = { field: button.dataset.sort, direction: active && s.direction === 'asc' ? 'desc' : 'asc' };
        rerender();
      };
    }
  if (!s) return rows;
  const getValue = columns[s.field];
  if (!getValue) return rows;
  const factor = s.direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = getValue(a),
      bv = getValue(b);
    if (typeof av === 'number' || typeof bv === 'number') return factor * ((Number(av) || 0) - (Number(bv) || 0));
    return factor * String(av).localeCompare(String(bv), 'ro', { numeric: true, sensitivity: 'base' });
  });
}

export function pageRows(type, rows) {
  const lastPage = Math.max(0, Math.ceil(rows.length / PAGE_SIZE) - 1);
  const page = (pages[type] = Math.min(pages[type], lastPage));
  const pager = $(`${type}Pager`);
  if (pager)
    pager.innerHTML =
      `<span>${rows.length} înregistrări · pagina ${page + 1}/${lastPage + 1}</span>` +
      `<button class="action-btn" data-page="${type}" data-delta="-1" ${page === 0 ? 'disabled' : ''}>Înapoi</button>` +
      `<button class="action-btn" data-page="${type}" data-delta="1" ${(page + 1) * PAGE_SIZE >= rows.length ? 'disabled' : ''}>Înainte</button>`;
  return rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
}

export function button(action, type, id, label) {
  return `<button type="button" class="action-btn" data-action="${action}" data-type="${type}" data-id="${esc(id)}">${esc(label)}</button>`;
}

export function actions(type, r) {
  return (
    `<span class="actions">` +
    button('edit', type, r.id, 'Editează') +
    button('archive', type, r.id, r.archived ? 'Reactivează' : 'Arhivează') +
    (r.archived ? button('delete', type, r.id, 'Șterge definitiv') : '') +
    `</span>`
  );
}

// O achitare importată poate să nu aibă copil asociat; atunci se arată numele
// din sursă, ca rândul să rămână identificabil.
export function childName(p) {
  return session.state.children.find(c => c.id === p.childId)?.name || p.childName || p.sourceName || 'Copil neasociat';
}

export function parentContacts(c) {
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

// Reutilizează culorile deja definite pentru achitări (verde/galben/roz).
const STATUS_BADGE_CLASS = { Activ: 'active', Suspendat: 'partial', Retras: 'late' };
export const statusBadgeClass = status => STATUS_BADGE_CLASS[status] || 'partial';

export function tenderLabel(p) {
  return paymentTenders(p)
    .map(part => `${esc(part.method)}: ${money(part.amount)}`)
    .join('<br>');
}

export const summaryHTML = s =>
  `<p>${s.children} copii · ${s.payments} achitări · ${s.expenses} cheltuieli</p>` +
  `<p>Total achitări: ${money(s.paymentTotal)} · Total cheltuieli: ${money(s.expenseTotal)}</p>`;

export function field(name, label, value = '', type = 'text', extra = '') {
  return `<label class="field">${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
}

// Valoarea curentă este adăugată la opțiuni chiar dacă nu este una dintre cele
// oferite, ca editarea unei fișe vechi să nu îi schimbe tăcut câmpul.
export function select(name, label, value, choices) {
  const options = [...new Set([value, ...choices])]
    .map(v => `<option value="${esc(v)}" ${v === value ? 'selected' : ''}>${esc(v || 'Neasociat')}</option>`)
    .join('');
  return `<label class="field">${label}<select name="${name}">${options}</select></label>`;
}

export function textarea(name, label, value) {
  return `<label class="field full">${label}<textarea name="${name}">${esc(value || '')}</textarea></label>`;
}
