import { $, esc, age } from './dom.mjs';
import { session, message, mutate } from './session.mjs';
import { expenseCategories } from './parts.mjs';
import { childPickerHTML, wireChildPicker } from './child-picker.mjs';

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

export function renderGroups() {
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
export function renderCategories() {
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

