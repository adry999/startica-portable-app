import { wireChildPicker } from '#shared/ui/child-picker.mjs';
import { groupCardMarkup } from './groups.view.mjs';

/** @typedef {import('../groups.types.mjs').GroupsControllerDependencies} GroupsControllerDependencies */

/** @param {GroupsControllerDependencies} dependencies */
export function createGroupsController({
  elements: { grid, createForm, nameInput, capacityInput },
  readRecords,
  submitMutation,
  showNotice,
}) {
  // Deschis by default doar cardul pe care operatorul a apăsat „Detalii” —
  // lista de membri, educatorul etc. nu au ce căuta în privirea generală.
  const expandedGroupIds = new Set();

  function render() {
    const records = readRecords();
    const children = records.children.filter(child => !child.archived);
    const groups = [...records.groups].sort((a, b) => a.name.localeCompare(b.name, 'ro'));
    grid.innerHTML =
      groups.map((group, index) => groupCardMarkup(group, children, index, expandedGroupIds.has(group.id))).join('') ||
      '<p class="groups-empty">Nu există grupe create încă. Adaugă prima mai sus.</p>';
    const unassigned = children
      .filter(child => !child.groupId)
      .sort((a, b) => a.name.localeCompare(b.name, 'ro'))
      .map(child => ({ id: child.id, label: child.name }));
    for (const picker of Array.from(grid.querySelectorAll('[data-child-picker]'))) wireChildPicker(picker, unassigned);
  }

  createForm.onsubmit = async event => {
    event.preventDefault();
    const name = nameInput.value.trim();
    if (!name) {
      showNotice('Completează numele grupei.', true);
      return;
    }
    const capacityRaw = capacityInput.value.trim();
    try {
      await submitMutation('/api/record', {
        type: 'groups',
        mode: 'create',
        record: { id: `GRP-${crypto.randomUUID()}`, name, capacity: capacityRaw ? Number(capacityRaw) : null },
      });
      createForm.reset();
      showNotice('Grupă creată.');
    } catch (error) {
      showNotice(/** @type {Error} */ (error).message, true);
    }
  };

  grid.addEventListener('click', async event => {
    const target = /** @type {HTMLElement} */ (event.target);
    const card = /** @type {HTMLElement | null} */ (target.closest('[data-group]'));
    if (!card) return;
    const id = card.dataset.group ?? '';
    if (target.closest('[data-toggle]')) {
      if (expandedGroupIds.has(id)) expandedGroupIds.delete(id);
      else expandedGroupIds.add(id);
      render();
      return;
    }
    try {
      if (target.dataset.save !== undefined) {
        const name = /** @type {HTMLInputElement} */ (card.querySelector('[data-name]')).value.trim();
        if (!name) {
          showNotice('Numele grupei nu poate fi gol.', true);
          return;
        }
        const capacityRaw = /** @type {HTMLInputElement} */ (card.querySelector('[data-capacity]')).value.trim();
        const educator = /** @type {HTMLInputElement} */ (card.querySelector('[data-educator]')).value.trim();
        const group = readRecords().groups.find(group => group.id === id);
        await submitMutation('/api/record', {
          type: 'groups',
          mode: 'update',
          record: { ...group, name, capacity: capacityRaw ? Number(capacityRaw) : null, educator },
        });
        showNotice('Grupă actualizată.');
      } else if (target.dataset.delete !== undefined) {
        await submitMutation('/api/group-delete', { id });
        expandedGroupIds.delete(id);
        showNotice('Grupă ștearsă.');
      } else if (target.dataset.addBtn !== undefined) {
        const childId = /** @type {HTMLInputElement} */ (card.querySelector('.child-picker-value')).value;
        if (!childId) return;
        const child = readRecords().children.find(child => child.id === childId);
        await submitMutation('/api/record', { type: 'children', mode: 'update', record: { ...child, groupId: id } });
        showNotice('Copil atribuit grupei.');
      } else if (target.dataset.remove !== undefined) {
        const child = readRecords().children.find(child => child.id === target.dataset.remove);
        await submitMutation('/api/record', { type: 'children', mode: 'update', record: { ...child, groupId: null } });
        showNotice('Copil scos din grupă.');
      }
    } catch (error) {
      showNotice(/** @type {Error} */ (error).message, true);
    }
  });

  return { render };
}
