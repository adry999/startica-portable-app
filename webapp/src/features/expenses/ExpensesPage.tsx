import { useMemo, useState } from 'react';
import { Button, Card, ConfirmDeleteDialog, DataTable, SegmentedControl, SelectionBar, useToast } from '@shared/ui';
import { usePersistedState } from '@shared/state/usePersistedState';
import { downloadCsv } from '@shared/csv-export';
import { total } from '@domain/money.mjs';
import { formatDate } from '#shared/format/date-format.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import { normalizeSearchText } from '#shared/format/text-search.mjs';
import { matchesRecordListSearch } from '#shared/ui/record-list-search.mjs';
import { useExpenses, type ExpenseFormInput } from './useExpenses';
import { ExpenseFormDrawer } from './ExpenseFormDrawer';
import { ExpensesSummaryCards } from './ExpensesSummaryCards';
import { ExpensesCategoryManager } from './ExpensesCategoryManager';
import { ExpensesFilters, type ArchiveFilter } from './ExpensesFilters';
import { buildExpenseColumns } from './expenseColumns';
import { DailyExpensesView, type DailyGroup } from './DailyExpensesView';
import type { Expense } from '@contracts/record-types.mjs';
import styles from './ExpensesPage.module.css';

export interface ExpensesPageProps {
  month: string;
}

type ViewMode = 'table' | 'daily';

export function ExpensesPage({ month }: ExpensesPageProps) {
  const expensesData = useExpenses(month);
  const toast = useToast();

  const [viewMode, setViewMode] = usePersistedState<ViewMode>('view.expenses', 'table');
  const [search, setSearch] = useState('');
  const [monthFrom, setMonthFrom] = useState('');
  const [monthTo, setMonthTo] = useState('');
  const [category, setCategory] = useState('');
  const [method, setMethod] = useState('');
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>('active');
  const [selectedRowKeys, setSelectedRowKeys] = useState<ReadonlySet<string>>(new Set<string>());
  const [formTarget, setFormTarget] = useState<Expense | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<
    { kind: 'category'; id: string; name: string } | { kind: 'expense'; expense: Expense } | null
  >(null);

  const filteredExpenses = useMemo(() => {
    const normalizedSearch = normalizeSearchText(search);
    return expensesData.expenses.filter(
      expense =>
        (archiveFilter === 'all' || (archiveFilter === 'archived' ? expense.archived : !expense.archived)) &&
        (!monthFrom || expense.date.slice(0, 7) >= monthFrom) &&
        (!monthTo || expense.date.slice(0, 7) <= monthTo) &&
        (!category || expense.category === category) &&
        (!method || expense.method === method) &&
        matchesRecordListSearch('expenses', expense, expensesData.records, normalizedSearch),
    );
  }, [expensesData.expenses, expensesData.records, search, monthFrom, monthTo, category, method, archiveFilter]);

  function exportFiltered() {
    downloadCsv(
      `cheltuieli-${month}.csv`,
      ['Data', 'Categorie', 'Sumă', 'Descriere', 'Notițe'],
      filteredExpenses.map(expense => [
        formatDate(expense.date),
        expense.category,
        expense.amount,
        expense.description,
        expense.notes ?? '',
      ]),
    );
  }

  const dailyGroups: DailyGroup[] = useMemo(() => {
    const byDate = new Map<string, Expense[]>();
    for (const expense of filteredExpenses) byDate.set(expense.date, [...(byDate.get(expense.date) ?? []), expense]);
    return [...byDate.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, items]) => ({ date, items, dayTotal: total(items) }));
  }, [filteredExpenses]);

  async function deleteCategoryConfirmed(id: string) {
    try {
      await expensesData.deleteCategory(id);
      toast.show({ message: 'Categorie ștearsă.' });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  async function toggleArchived(expense: Expense) {
    try {
      await expensesData.setExpenseArchived(expense, !expense.archived);
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  async function submitExpenseForm(input: ExpenseFormInput) {
    try {
      if (formTarget && formTarget !== 'new') await expensesData.updateExpense(formTarget, input);
      else await expensesData.createExpense(input);
      setFormTarget(null);
      toast.show({ message: formTarget !== 'new' && formTarget ? 'Cheltuială actualizată.' : 'Cheltuială adăugată.' });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  async function deleteExpenseForever(expense: Expense) {
    try {
      await expensesData.deleteExpense(expense.id);
      toast.show({ message: 'Cheltuială ștearsă definitiv.' });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  async function archiveSelected() {
    const targetArchived = archiveFilter !== 'archived';
    const ids = [...selectedRowKeys];
    const targets = expensesData.expenses.filter(
      expense => ids.includes(expense.id) && expense.archived !== targetArchived,
    );
    if (targets.length === 0) return;
    try {
      for (const expense of targets) await expensesData.setExpenseArchived(expense, targetArchived);
      setSelectedRowKeys(new Set());
      const single = targets.length === 1;
      const noun = single ? 'cheltuială' : 'cheltuieli';
      const verb = targetArchived ? (single ? 'arhivată' : 'arhivate') : single ? 'dezarhivată' : 'dezarhivate';
      toast.show({
        message: `${targets.length} ${noun} ${verb}`,
        actionLabel: 'Anulează',
        onAction: () => {
          void Promise.all(targets.map(expense => expensesData.setExpenseArchived(expense, !targetArchived)));
        },
      });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  if (expensesData.status === 'loading') return <p className={styles.notice}>Se încarcă datele…</p>;
  if (expensesData.status === 'failed')
    return <p className={styles.notice}>{expensesData.failureMessage || 'Datele nu au putut fi încărcate.'}</p>;

  const activeTotal = expensesData.expenses.filter(expense => !expense.archived).length;
  const archivedTotal = expensesData.expenses.filter(expense => expense.archived).length;
  const selectedTotal = total(filteredExpenses.filter(expense => selectedRowKeys.has(expense.id)));

  const columns = buildExpenseColumns({
    onEdit: expense => setFormTarget(expense),
    onToggleArchived: expense => void toggleArchived(expense),
    onRequestDelete: expense => setDeleteTarget({ kind: 'expense', expense }),
  });

  return (
    <>
      <div className={styles.headerActions}>
        <SegmentedControl
          ariaLabel="Vizualizare cheltuieli"
          value={viewMode}
          onChange={setViewMode}
          options={[
            { value: 'table', label: 'Tabel' },
            { value: 'daily', label: 'Pe zile' },
          ]}
        />
        <Button variant="ghost" onClick={exportFiltered}>
          Exportă
        </Button>
        <Button onClick={() => setFormTarget('new')}>+ Cheltuială nouă</Button>
      </div>

      <ExpensesSummaryCards monthTotal={expensesData.monthTotal} categorySummary={expensesData.categorySummary} />

      <Card className={styles.tableCard}>
        <ExpensesCategoryManager
          categories={expensesData.categories}
          onCreateCategory={expensesData.createCategory}
          onRenameCategory={expensesData.renameCategory}
          onRequestDelete={category => setDeleteTarget({ kind: 'category', id: category.id, name: category.name })}
        />

        <ExpensesFilters
          search={search}
          onSearchChange={setSearch}
          monthFrom={monthFrom}
          onMonthFromChange={setMonthFrom}
          monthTo={monthTo}
          onMonthToChange={setMonthTo}
          archiveFilter={archiveFilter}
          onArchiveFilterChange={setArchiveFilter}
          activeTotal={activeTotal}
          archivedTotal={archivedTotal}
          category={category}
          onCategoryChange={setCategory}
          categoryNames={expensesData.categoryNames}
          method={method}
          onMethodChange={setMethod}
        />

        <p className={styles.summaryText}>
          <strong>{filteredExpenses.length}</strong> cheltuieli ·{' '}
          <strong>{formatMoney(total(filteredExpenses))}</strong> total
        </p>

        {selectedRowKeys.size > 0 && (
          <SelectionBar
            label={
              <>
                {selectedRowKeys.size} selectate · {formatMoney(selectedTotal)}
              </>
            }
            onCancel={() => setSelectedRowKeys(new Set())}
          >
            <button type="button" className={styles.selectionArchive} onClick={() => void archiveSelected()}>
              {archiveFilter === 'archived' ? 'Dezarhivează selectate' : 'Arhivează selectate'}
            </button>
          </SelectionBar>
        )}

        {viewMode === 'table' ? (
          <DataTable
            columns={columns}
            rows={filteredExpenses}
            rowKey={expense => expense.id}
            selectable
            selectedRowKeys={selectedRowKeys}
            onSelectedRowKeysChange={setSelectedRowKeys}
            emptyState={<p>Nu există înregistrări pentru filtrele alese.</p>}
          />
        ) : (
          <DailyExpensesView groups={dailyGroups} />
        )}
      </Card>

      <ExpenseFormDrawer
        key={formTarget === 'new' || formTarget === null ? 'new' : formTarget.id}
        target={formTarget}
        categoryNames={expensesData.categoryNames}
        onSubmit={submitExpenseForm}
        onClose={() => setFormTarget(null)}
      />

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        title={deleteTarget?.kind === 'category' ? 'Ștergere categorie' : 'Ștergere definitivă'}
        description={
          deleteTarget?.kind === 'category'
            ? `Ștergi categoria „${deleteTarget.name}”? Cheltuielile care o folosesc deja nu se modifică.`
            : deleteTarget?.kind === 'expense'
              ? `Ștergi definitiv cheltuiala ${deleteTarget.expense.id}? Nu poate fi anulată, spre deosebire de arhivare.`
              : ''
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget?.kind === 'category') void deleteCategoryConfirmed(deleteTarget.id);
          else if (deleteTarget?.kind === 'expense') void deleteExpenseForever(deleteTarget.expense);
          setDeleteTarget(null);
        }}
      />
    </>
  );
}
