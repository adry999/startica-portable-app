import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Button,
  Card,
  ConfirmDeleteDialog,
  DataTable,
  Drawer,
  LoadingState,
  MonthStepper,
  RowMenu,
  SegmentedControl,
  SelectionBar,
  useToast,
  useTopbarActions,
} from '@shared/ui';
import { usePersistedState } from '@shared/state/usePersistedState';
import { downloadCsv } from '@shared/csv-export';
import { shiftMonth } from '@shared/format/month-shift';
import { formatNameList } from '@shared/format/name-list';
import { total } from '@domain/money.mjs';
import { formatDate } from '#shared/format/date-format.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import { normalizeSearchText } from '#shared/format/text-search.mjs';
import { matchesRecordListSearch } from '#shared/ui/record-list-search.mjs';
import { useExpenses, categoryDeleteDescription, type ExpenseFormInput } from './useExpenses';
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
  // E-1: Cheltuieli are propria lună, independentă de MonthPicker-ul global (vizibil doar pe
  // Dashboard) — altfel „Total lună” și tabelul ar rămâne blocate pe luna din Dashboard.
  const [monthKey, setMonthKey] = useState(month);
  const expensesData = useExpenses(monthKey);
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [viewMode, setViewMode] = usePersistedState<ViewMode>('view.expenses', 'table');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [method, setMethod] = useState('');
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>('active');
  const [selectedRowKeys, setSelectedRowKeys] = useState<ReadonlySet<string>>(new Set<string>());
  const [formTarget, setFormTarget] = useState<Expense | 'new' | null>(null);
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);

  // „+ Adaugă cheltuială" de pe Dashboard trece direct la formular (08-dashboard.md #3), fără
  // să rămână în URL — altfel s-ar redeschide la orice re-render sau navigare înapoi.
  useEffect(() => {
    if (searchParams.get('nou') !== '1') return;
    setFormTarget('new');
    setSearchParams(
      params => {
        const next = new URLSearchParams(params);
        next.delete('nou');
        return next;
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const [deleteTarget, setDeleteTarget] = useState<
    { kind: 'category'; id: string; name: string } | { kind: 'expense'; expense: Expense } | null
  >(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const monthExpenses = useMemo(
    () => expensesData.expenses.filter(expense => expense.date.startsWith(monthKey)),
    [expensesData.expenses, monthKey],
  );

  const filteredExpenses = useMemo(() => {
    const normalizedSearch = normalizeSearchText(search);
    return monthExpenses.filter(
      expense =>
        (archiveFilter === 'all' || (archiveFilter === 'archived' ? expense.archived : !expense.archived)) &&
        (!category || expense.category === category) &&
        (!method || expense.method === method) &&
        matchesRecordListSearch('expenses', expense, expensesData.records, normalizedSearch),
    );
  }, [monthExpenses, expensesData.records, search, category, method, archiveFilter]);

  function exportFiltered() {
    downloadCsv(
      `cheltuieli-${monthKey}.csv`,
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

  // C1: întoarce succesul real, nu doar dacă cererea a pornit — „Salvează și schimbă” din
  // useBranchSwitch schimbă filiala doar când save() (deci și funcția asta) întoarce true.
  async function submitExpenseForm(input: ExpenseFormInput): Promise<boolean> {
    try {
      if (formTarget && formTarget !== 'new') await expensesData.updateExpense(formTarget, input);
      else await expensesData.createExpense(input);
      setFormTarget(null);
      toast.show({ message: formTarget !== 'new' && formTarget ? 'Cheltuială actualizată.' : 'Cheltuială adăugată.' });
      return true;
    } catch (error) {
      toast.show({ message: (error as Error).message });
      return false;
    }
  }

  async function quickAddExpense(input: ExpenseFormInput): Promise<boolean> {
    try {
      await expensesData.createExpense(input);
      toast.show({ message: 'Cheltuială adăugată.' });
      return true;
    } catch (error) {
      toast.show({ message: (error as Error).message });
      return false;
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

  async function deleteSelectedForever() {
    const ids = [...selectedRowKeys];
    const targets = expensesData.expenses.filter(expense => ids.includes(expense.id));
    if (targets.length === 0) return;
    try {
      await expensesData.deleteManyForever(targets.map(expense => expense.id));
      setSelectedRowKeys(new Set());
      toast.show({
        message: `${targets.length} ${targets.length === 1 ? 'cheltuială ștearsă' : 'cheltuieli șterse'} definitiv.`,
      });
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
        onAction: () => void undoArchiveSelected(targets, !targetArchived),
      });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  // M1: secvențial, nu Promise.all — session.mutate refuză o mutație pornită cât alta e
  // „pending”, deci un Promise.all lasă doar prima anulare să reușească.
  async function undoArchiveSelected(targets: Expense[], archived: boolean) {
    try {
      for (const expense of targets) await expensesData.setExpenseArchived(expense, archived);
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  // Antetul e identic în Tabel și în Pe zile (06-cheltuieli.md #2) — lună locală + comutator + Exportă + Cheltuială nouă.
  useTopbarActions(
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
      <MonthStepper
        value={monthKey}
        tone="white"
        onPrev={() => setMonthKey(current => shiftMonth(current, -1))}
        onNext={() => setMonthKey(current => shiftMonth(current, 1))}
      />
      <Button variant="ghost" onClick={exportFiltered}>
        Exportă
      </Button>
      <Button onClick={() => setFormTarget('new')}>+ Cheltuială nouă</Button>
      <RowMenu
        ariaLabel="Mai multe opțiuni"
        trigger="⋯"
        items={[{ label: 'Administrează categorii', onClick: () => setCategoryDrawerOpen(true) }]}
      />
    </div>,
  );

  if (expensesData.status === 'loading') return <LoadingState />;
  if (expensesData.status === 'failed')
    return <p className={styles.notice}>{expensesData.failureMessage || 'Datele nu au putut fi încărcate.'}</p>;

  const selectedExpenses = filteredExpenses.filter(expense => selectedRowKeys.has(expense.id));
  const selectedTotal = total(selectedExpenses);
  const allSelectedArchived = selectedExpenses.length > 0 && selectedExpenses.every(expense => expense.archived);
  const showDeleteForever = archiveFilter === 'archived' || (archiveFilter === 'all' && allSelectedArchived);

  const columns = buildExpenseColumns({
    onEdit: expense => setFormTarget(expense),
    onToggleArchived: expense => void toggleArchived(expense),
    onRequestDelete: expense => setDeleteTarget({ kind: 'expense', expense }),
  });

  return (
    <>
      <ExpensesSummaryCards
        month={monthKey}
        monthTotal={expensesData.monthTotal}
        monthExpenseCount={expensesData.monthExpenseCount}
        categorySummary={expensesData.categorySummary}
      />

      <Card className={styles.tableCard}>
        <ExpensesFilters
          search={search}
          onSearchChange={setSearch}
          archiveFilter={archiveFilter}
          onArchiveFilterChange={setArchiveFilter}
          category={category}
          onCategoryChange={setCategory}
          categoryNames={expensesData.categoryNames}
          method={method}
          onMethodChange={setMethod}
        />

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
            {showDeleteForever && (
              <button type="button" className={styles.selectionDeleteForever} onClick={() => setBulkDeleteOpen(true)}>
                Șterge definitiv
              </button>
            )}
          </SelectionBar>
        )}

        {viewMode === 'table' ? (
          <>
            <DataTable
              bare
              columns={columns}
              rows={filteredExpenses}
              rowKey={expense => expense.id}
              selectable
              selectedRowKeys={selectedRowKeys}
              onSelectedRowKeysChange={setSelectedRowKeys}
              emptyState={<p>Nu există înregistrări pentru filtrele alese.</p>}
            />
            <p className={styles.summaryText}>
              <span>{filteredExpenses.length} înregistrări</span>
              <strong>Total {formatMoney(total(filteredExpenses))}</strong>
            </p>
          </>
        ) : (
          <DailyExpensesView
            groups={dailyGroups}
            categoryNames={expensesData.categoryNames}
            onQuickAdd={quickAddExpense}
          />
        )}
      </Card>

      {/* C2: 'closed' distinct de 'new' — altfel a doua „+ Cheltuială nouă” reia instanța
          (și valorile) primei, în loc să pornească de la un formular gol. */}
      <ExpenseFormDrawer
        key={formTarget === null ? 'closed' : formTarget === 'new' ? 'new' : formTarget.id}
        target={formTarget}
        categoryNames={expensesData.categoryNames}
        onSubmit={submitExpenseForm}
        onSubmitAndAddAnother={quickAddExpense}
        onClose={() => setFormTarget(null)}
      />

      {/* E-3: administrarea categoriilor nu mai stă deasupra toolbar-ului — ascunsă în meniul ⋯ până e nevoie. */}
      <Drawer
        open={categoryDrawerOpen}
        title="Categorii de cheltuieli"
        width={480}
        onClose={() => setCategoryDrawerOpen(false)}
      >
        <ExpensesCategoryManager
          categories={expensesData.categories}
          onCreateCategory={expensesData.createCategory}
          onRenameCategory={expensesData.renameCategory}
          onRequestDelete={category => setDeleteTarget({ kind: 'category', id: category.id, name: category.name })}
        />
      </Drawer>

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        title={deleteTarget?.kind === 'category' ? 'Ștergere categorie' : 'Ștergere definitivă'}
        description={
          deleteTarget?.kind === 'category'
            ? categoryDeleteDescription(deleteTarget.name, expensesData.expenses)
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

      <ConfirmDeleteDialog
        open={bulkDeleteOpen}
        title={`Ștergi definitiv ${selectedExpenses.length} ${selectedExpenses.length === 1 ? 'cheltuială' : 'cheltuieli'}?`}
        description={`${formatNameList(selectedExpenses.map(expense => expense.description || expense.category))}. Doar înregistrarea. Nu poate fi anulată.`}
        confirmLabel={`Șterge ${selectedExpenses.length} ${selectedExpenses.length === 1 ? 'cheltuială' : 'cheltuieli'}`}
        onCancel={() => setBulkDeleteOpen(false)}
        onConfirm={() => {
          void deleteSelectedForever();
          setBulkDeleteOpen(false);
        }}
      />
    </>
  );
}
