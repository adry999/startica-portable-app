import { escapeHtml } from '#shared/format/html-escape.mjs';
import { confirmOnSecondClick } from '#shared/ui/confirm-twice-button.mjs';
import { listExpenseCategoryNames } from '../domain/expense-category-names.mjs';

/** @typedef {import('../expenses.types.mjs').ExpenseCategoriesControllerDependencies} ExpenseCategoriesControllerDependencies */

// Doar etichete text pentru sugestii (vezi editorul de cheltuieli); ștergerea
// unei categorii nu schimbă cheltuielile care o folosesc deja.
/** @param {ExpenseCategoriesControllerDependencies} dependencies */
export function createExpenseCategoriesController({
  elements: { chips, createForm, nameInput, categoryFilter },
  readRecords,
  submitMutation,
  showNotice,
}) {
  nameInput.setAttribute('aria-label', 'Categoria nouă');
  function render() {
    const records = readRecords();
    const categories = [...records.categories].sort((a, b) => a.name.localeCompare(b.name, 'ro'));
    chips.innerHTML =
      categories
        .map(
          category =>
            `<span class="category-chip" data-category="${escapeHtml(category.id)}">${escapeHtml(category.name)}` +
            `<button type="button" data-remove title="Șterge categoria" aria-label="Șterge ${escapeHtml(category.name)}">×</button></span>`,
        )
        .join('') ||
      '<span class="muted">Nicio categorie adăugată încă — se folosesc doar sugestiile implicite.</span>';
    // Selecția curentă a filtrului se păstrează la re-randare, ca alegerea
    // operatorului să nu sară înapoi pe „Toate” la fiecare mutație de stare.
    const current = categoryFilter.value;
    categoryFilter.innerHTML =
      '<option value="">Toate</option>' +
      listExpenseCategoryNames(records)
        .map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
        .join('');
    categoryFilter.value = current;
  }

  createForm.onsubmit = async event => {
    event.preventDefault();
    const name = nameInput.value.trim();
    if (!name) {
      showNotice('Completează numele categoriei.', true);
      return;
    }
    try {
      await submitMutation('/api/record', {
        type: 'categories',
        mode: 'create',
        record: { id: `CAT-${crypto.randomUUID()}`, name },
      });
      createForm.reset();
      showNotice('Categorie adăugată.');
    } catch (error) {
      showNotice(/** @type {Error} */ (error).message, true);
    }
  };

  chips.addEventListener('click', async event => {
    const target = /** @type {HTMLElement} */ (event.target);
    if (target.dataset.remove === undefined) return;
    const categoryElement = /** @type {HTMLElement | null} */ (target.closest('[data-category]'));
    const id = categoryElement?.dataset.category ?? '';
    const categoryName = readRecords().categories.find(category => category.id === id)?.name ?? 'categoria';
    if (!confirmOnSecondClick(target, `Sigur? Șterge ${categoryName}`)) return;
    try {
      await submitMutation('/api/category-delete', { id });
      showNotice('Categorie ștearsă.');
    } catch (error) {
      showNotice(/** @type {Error} */ (error).message, true);
    }
  });

  return { render };
}
