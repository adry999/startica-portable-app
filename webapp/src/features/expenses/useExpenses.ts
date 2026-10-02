import { useAppSession } from '@shared/api/session';
import { total } from '@domain/money.mjs';
import { normalizeRecord } from '@domain/record-schema.mjs';
import { stripDiacritics } from '#shared/format/text-search.mjs';
import { listExpenseCategoryNames } from '#features/expenses/domain/expense-category-names.mjs';
import { canonicalCategoryName } from '#features/expenses/domain/canonical-category-name.mjs';
import { GENERAL_CATEGORY_ID } from '#shared/domain/expense-categories.mjs';
import type { BadgeTone } from '@shared/ui';
import type { Expense, ExpenseCategory, RecordsSnapshot } from '@contracts/record-types.mjs';

export interface ExpenseFormInput {
  date: string;
  amount: string;
  category: string;
  method: string;
  description: string;
  notes: string;
}

export type ExpensesStatus = 'loading' | 'ready' | 'failed';

export interface CategoryStyle {
  label: string;
  tone: BadgeTone;
  color: string;
}

export interface CategorySummaryItem extends CategoryStyle {
  amount: number;
  percent: number;
}

export interface ExpensesData {
  status: ExpensesStatus;
  failureMessage: string;
  records: RecordsSnapshot;
  expenses: Expense[];
  categories: ExpenseCategory[];
  categoryNames: string[];
  monthTotal: number;
  monthExpenseCount: number;
  categorySummary: CategorySummaryItem[];
  createCategory: (typed: string) => Promise<void>;
  renameCategory: (id: string, typed: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  setExpenseArchived: (expense: Expense, archived: boolean) => Promise<void>;
  // auditId: 40b — ExpensesPage îl ține minte pentru UndoToast/POST /api/undo.
  createExpense: (input: ExpenseFormInput) => Promise<{ auditId?: number }>;
  updateExpense: (previous: Expense, input: ExpenseFormInput) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  deleteManyForever: (ids: string[]) => Promise<void>;
}

// Culorile exacte din spec (README redesign, secțiunea Cheltuieli) pentru cele
// 5 categorii uzuale; potrivire după substring, fără diacritice, ca „Alimente”
// și „Alimentație” să cadă în același bucket. Orice altă categorie din date
// (ex. „Chirie”) intră la „Altele”, cu o culoare neutră din tokens.
const CATEGORY_STYLES: (CategoryStyle & { test: (comparableName: string) => boolean })[] = [
  { label: 'Salarii', tone: 'orange', color: 'var(--orange)', test: name => name.includes('salari') },
  { label: 'Alimentație', tone: 'yellow', color: 'var(--yellow)', test: name => name.includes('aliment') },
  { label: 'Utilități', tone: 'mint', color: 'var(--mint)', test: name => name.includes('utilit') },
  { label: 'Materiale', tone: 'pink', color: 'var(--pink)', test: name => name.includes('material') },
  {
    label: 'Întreținere',
    tone: 'neutral',
    color: 'var(--subtle)',
    test: name => name.includes('intretinere') || name.includes('reparatii'),
  },
];
const OTHER_CATEGORY_STYLE: CategoryStyle = { label: 'Altele', tone: 'neutral', color: 'var(--muted)' };

function comparable(name: string): string {
  return stripDiacritics(name).toLocaleLowerCase('ro-RO');
}

/** Textul dialogului „Scrie ȘTERGE” pentru o categorie — spune câte cheltuieli
 * (arhivate sau nu — serverul le mută pe toate) ajung la „General”, ca operatorul
 * să știe dinainte, nu doar după ștergere. */
export function categoryDeleteDescription(categoryName: string, expenses: Expense[]): string {
  const count = expenses.filter(expense => expense.category === categoryName).length;
  if (count === 0) return `Ștergi categoria „${categoryName}”? Nicio cheltuială nu o folosește.`;
  const noun = count === 1 ? 'cheltuială' : 'cheltuieli';
  const verb = count === 1 ? 'va fi mutată' : 'vor fi mutate';
  return `Ștergi categoria „${categoryName}”? ${count} ${noun} ${verb} la „General”.`;
}

/** Un singur loc pentru maparea categorie → culoare/tonă, folosit atât de Badge-urile din tabel cât și de bara/legenda de categorii. */
export function categoryStyleFor(categoryName: string): CategoryStyle {
  const key = comparable(categoryName);
  return CATEGORY_STYLES.find(style => style.test(key)) ?? OTHER_CATEGORY_STYLE;
}

function buildCategorySummary(monthExpenses: Expense[]): CategorySummaryItem[] {
  const buckets = new Map<string, { style: CategoryStyle; items: Expense[] }>();
  for (const expense of monthExpenses) {
    const style = categoryStyleFor(expense.category);
    const bucket = buckets.get(style.label) ?? { style, items: [] };
    bucket.items.push(expense);
    buckets.set(style.label, bucket);
  }
  const monthTotal = total(monthExpenses);
  // Ordinea din spec, cu „Altele” la final — un bucket lipsă din date tot apare, cu suma 0.
  const orderedStyles = [...CATEGORY_STYLES, OTHER_CATEGORY_STYLE];
  return orderedStyles
    .map(style => {
      const amount = total(buckets.get(style.label)?.items ?? []);
      return { ...style, amount, percent: monthTotal > 0 ? (amount / monthTotal) * 100 : 0 };
    })
    .filter(item => item.amount > 0 || item.label !== OTHER_CATEGORY_STYLE.label);
}

/**
 * Date derivate din sesiune (lista brută, categoriile, totalul și
 * repartizarea pe categorii pentru luna curentă din topbar) + mutațiile de
 * orchestrare. Filtrarea tabelului/vizualizarea „Pe zile” rămân în
 * ExpensesPage, ca stare de UI locală — la fel ca ChildrenListView.
 */
export function useExpenses(month: string): ExpensesData {
  const session = useAppSession();
  const { state, ready, loading, saveError } = session.state;
  const records = state as RecordsSnapshot;

  async function createCategory(typed: string) {
    const name = canonicalCategoryName(typed, records);
    if (!name) throw new Error('Completează numele categoriei.');
    if (records.categories.some(category => category.name === name)) throw new Error('Categoria există deja.');
    await session.mutate('/api/record', {
      type: 'categories',
      mode: 'create',
      record: { id: `CAT-${crypto.randomUUID()}`, name },
    });
  }

  async function renameCategory(id: string, typed: string) {
    if (id === GENERAL_CATEGORY_ID) throw new Error('Categoria „General” nu poate fi redenumită.');
    const category = records.categories.find(c => c.id === id);
    if (!category) throw new Error('Categoria nu mai există.');
    const name = canonicalCategoryName(typed, records);
    if (!name) throw new Error('Completează numele categoriei.');
    if (name === category.name) return;
    if (records.categories.some(c => c.id !== id && c.name === name)) throw new Error('Categoria există deja.');
    // Server-ul propagă noul nume la cheltuielile categoriei, în aceeași tranzacție
    // (vezi /api/category-rename) — categoria e doar o etichetă text, fără FK.
    await session.mutate('/api/category-rename', { id, name });
  }

  async function deleteCategory(id: string) {
    if (id === GENERAL_CATEGORY_ID) throw new Error('Categoria „General” nu poate fi ștearsă.');
    await session.mutate('/api/category-delete', { id });
  }

  async function setExpenseArchived(expense: Expense, archived: boolean) {
    await session.mutate('/api/record', {
      type: 'expenses',
      mode: 'update',
      record: { ...expense, archived, archivedAt: archived ? new Date().toISOString() : null },
    });
  }

  function expenseFromInput(base: Partial<Expense>, input: ExpenseFormInput) {
    return normalizeRecord('expenses', {
      ...base,
      date: input.date,
      amount: Number(input.amount),
      category: canonicalCategoryName(input.category, records),
      method: input.method || undefined,
      description: input.description.trim(),
      notes: input.notes,
    }) as Expense;
  }

  async function createExpense(input: ExpenseFormInput) {
    const record = expenseFromInput({ id: `EXP-${crypto.randomUUID()}` }, input);
    const result = await session.mutate('/api/record', { type: 'expenses', mode: 'create', record });
    return { auditId: (result as { auditId?: number } | undefined)?.auditId };
  }

  async function updateExpense(previous: Expense, input: ExpenseFormInput) {
    const record = expenseFromInput(previous, input);
    await session.mutate('/api/record', { type: 'expenses', mode: 'update', record });
  }

  async function deleteExpense(id: string) {
    await session.mutate('/api/record-delete', { type: 'expenses', id });
  }

  async function deleteManyForever(ids: string[]) {
    await session.mutate('/api/record-delete', { type: 'expenses', ids });
  }

  if (!ready) {
    return {
      status: loading || !saveError ? 'loading' : 'failed',
      failureMessage: saveError,
      records,
      expenses: [],
      categories: [],
      categoryNames: [],
      monthTotal: 0,
      monthExpenseCount: 0,
      categorySummary: [],
      createCategory,
      renameCategory,
      deleteCategory,
      setExpenseArchived,
      createExpense,
      updateExpense,
      deleteExpense,
      deleteManyForever,
    };
  }

  const monthExpenses = records.expenses.filter(expense => !expense.archived && expense.date.startsWith(month));
  const categories = [...records.categories].sort((a, b) => a.name.localeCompare(b.name, 'ro'));

  return {
    status: 'ready',
    failureMessage: '',
    records,
    expenses: records.expenses,
    categories,
    categoryNames: listExpenseCategoryNames(records),
    monthTotal: total(monthExpenses),
    monthExpenseCount: monthExpenses.length,
    categorySummary: buildCategorySummary(monthExpenses),
    createCategory,
    renameCategory,
    deleteCategory,
    setExpenseArchived,
    createExpense,
    updateExpense,
    deleteExpense,
    deleteManyForever,
  };
}
