import { escapeHtml } from '#shared/format/html-escape.mjs';
import { formatAge } from '#shared/format/date-format.mjs';
import { childPickerHTML } from '#shared/ui/child-picker.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').Group} Group */
/** @typedef {import('#shared/contracts/record-types.mjs').Child} Child */

// Aceleași culori ca la Dashboard, ca ecranul de Grupe să pară din aceeași
// familie vizuală, nu un ecran de administrare separat.
const GROUP_COLORS = ['orange', 'mint', 'yellow'];

/**
 * @param {Group} group
 * @param {Child[]} children
 * @param {number} index
 * @param {boolean} isExpanded
 */
export function groupCardMarkup(group, children, index, isExpanded) {
  const members = children
    .filter(child => child.groupId === group.id)
    .sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  const overCapacity = group.capacity && members.length > group.capacity;
  const fillValue = group.capacity ? `${members.length}/${group.capacity}` : `${members.length}`;
  const birthDates = members
    .map(child => child.birthDate)
    .filter(Boolean)
    .sort();
  const ageRange = !birthDates.length
    ? 'necunoscută'
    : birthDates[0] === birthDates.at(-1)
      ? formatAge(birthDates[0])
      : `${formatAge(birthDates.at(-1))} – ${formatAge(birthDates[0])}`;
  const unassigned = children.filter(child => !child.groupId);
  const colorClass = overCapacity ? 'pink' : GROUP_COLORS[index % GROUP_COLORS.length];
  return (
    `<article class="group-card ${isExpanded ? 'expanded' : ''}" data-group="${escapeHtml(group.id)}">` +
    `<button type="button" class="card ${colorClass} group-tile" data-toggle aria-expanded="${isExpanded}">` +
    `<svg class="group-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>` +
    `<p>${escapeHtml(group.name)}</p>` +
    `<strong>${fillValue}</strong>` +
    `<small>${overCapacity ? 'copii — peste capacitate' : 'copii'}</small>` +
    `</button>` +
    `<div class="group-details" ${isExpanded ? '' : 'hidden'}>` +
    `<div class="group-edit"><input data-name value="${escapeHtml(group.name)}" placeholder="nume grupă">` +
    `<input data-capacity type="number" min="1" max="1000" value="${group.capacity ?? ''}" placeholder="capacitate">` +
    `<button type="button" class="action-btn" data-save>Salvează</button></div>` +
    `<label class="field">Educator<input data-educator value="${escapeHtml(group.educator || '')}" placeholder="Nume educator"></label>` +
    `<p class="group-fact">Vârste: <strong>${ageRange}</strong></p>` +
    `<ul class="group-children">${
      members
        .map(
          child =>
            `<li><span>${escapeHtml(child.name)}</span><button type="button" data-remove="${escapeHtml(child.id)}" aria-label="Scoate din grupă" title="Scoate din grupă">×</button></li>`,
        )
        .join('') || '<li class="empty">Niciun copil atribuit.</li>'
    }</ul>` +
    `<div class="group-add">` +
    childPickerHTML({
      name: '',
      placeholder: unassigned.length ? 'Caută copil…' : 'Toți copiii nearhivați sunt atribuiți',
    }) +
    `<button type="button" class="action-btn" data-add-btn ${unassigned.length ? '' : 'disabled'}>+ Adaugă</button></div>` +
    `<button type="button" class="btn btn-ghost" data-delete>Șterge grupa</button>` +
    `</div>` +
    `</article>`
  );
}
