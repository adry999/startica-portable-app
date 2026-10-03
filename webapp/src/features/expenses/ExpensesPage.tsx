import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Button,
  Card,
  ConfirmDeleteDialog,
  DataTable,
  Drawer,
  LoadingState,
  monthDayBounds,
  MonthStepper,
  Pagination,
  RowMenu,
  SegmentedControl,
  SelectionBar,
  useToast,
  useTopbarActions,
  useUndoToast,
  type PeriodPreset,
} from '@shared/ui';
import { useAppSession } from '@shared/api/session';
import { usePersistedState } from '@shared/state/usePersistedState';
import { usePersistedSort } from '@shared/state/usePersistedSort';
import { useUrlParams } from '@shared/state/useUrlParams';
import { readStoredPageSize, storePageSize } from '@shared/state/table-page-size';
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
import { toUserError } from '@shared/api/to-user-error';

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
  const undoToast = useUndoToast();
  const session = useAppSession();
  const [searchParams, setSearchParams] = useSearchParams();

  const [viewMode, setViewMode] = usePersistedState<ViewMode>('view.expenses', 'table');
  // §13.2 PROMPT-8 („același lucru în Cheltuieli"): căutarea și pastilele rămân la întoarcerea din
  // fișă — stare în URL (useUrlParams), nu useState. Perioada rămâne useState (nu e listată
  // explicit în §13.2, iar cele 3 câmpuri legate ar complica inutil URL-ul).
  const [urlFilters, setUrlFilters] = useUrlParams({ q: '', categorie: '', metoda: '', arhivare: 'active' });
  const search = urlFilters.q;
  const category = urlFilters.categorie;
  const method = urlFilters.metoda;
  const archiveFilter = urlFilters.arhivare as ArchiveFilter;
  const setSearch = (value: string) => setUrlFilters({ q: value });
  const setCategory = (value: string) => setUrlFilters({ categorie: value });
  const setMethod = (value: string) => setUrlFilters({ metoda: value });
  const setArchiveFilter = (value: ArchiveFilter) => setUrlFilters({ arhivare: value });
  // §5.1: perioadă independentă de MonthStepper-ul din antet (E-1 — acela controlează doar
  // cardurile KPI); implicit 'luna', cu limitele lunii din MonthStepper la montare (nu ale lunii
  // calendaristice reale — altfel tabelul ar porni gol dacă `month` diferă de „azi”), ca tabelul
  // să arate la montare exact ce arăta înainte de §5.1.
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('luna');
  const [periodFrom, setPeriodFrom] = useState(() => monthDayBounds(monthKey).from);
  const [periodTo, setPeriodTo] = useState(() => monthDayBounds(monthKey).to);
  const [selectedRowKeys, setSelectedRowKeys] = useState<ReadonlySet<string>>(new Set<string>());
  const [formTarget, setFormTarget] = useState<Expense | 'new' | null>(null);
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);
  // §13.1: cele mai noi primele implicit, alegerea utilizatorului persistă pe pagină.
  const [sort, setSort] = usePersistedSort('sort.expenses', { key: 'date', direction: 'desc' });

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

  const filteredExpenses = useMemo(() => {
    const normalizedSearch = normalizeSearchText(search);
    return expensesData.expenses.filter(
      expense =>
        (archiveFilter === 'all' || (archiveFilter === 'archived' ? expense.archived : !expense.archived)) &&
        (!periodFrom || expense.date >= periodFrom) &&
        (!periodTo || expense.date <= periodTo) &&
        (!category || expense.category === category) &&
        (!method || expense.method === method) &&
        matchesRecordListSearch('expenses', expense, expensesData.records, normalizedSearch),
    );
  }, [expensesData.expenses, expensesData.records, search, category, method, archiveFilter, periodFrom, periodTo]);

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

  // „Pe zile" nu avea nicio paginare — randa toate cheltuielile filtrate deodată (audit 03.10,
  // același bug ca Achitări „Pe luni"). Antetul fiecărei zile păstrează totalul real al zilei,
  // chiar dacă pagina curentă arată doar o parte din înregistrările ei.
  const [dailyPage, setDailyPage] = useState(1);
  const [dailyPageSize, setDailyPageSize] = useState(() => readStoredPageSize());
  const firstDailyFilterRender = useRef(true);

  const dailyTotalPages = Math.max(1, Math.ceil(filteredExpenses.length / dailyPageSize));
  const dailyCurrentPage = Math.min(dailyPage, dailyTotalPages);
  const dailyPageStart = (dailyCurrentPage - 1) * dailyPageSize;
  const dailyVisibleIds = useMemo(() => {
    const ids = new Set<string>();
    let index = 0;
    for (const group of dailyGroups) {
      for (const expense of group.items) {
        if (index >= dailyPageStart && index < dailyPageStart + dailyPageSize) ids.add(expense.id);
        index += 1;
      }
    }
    return ids;
  }, [dailyGroups, dailyPageStart, dailyPageSize]);

  const pagedDailyGroups: DailyGroup[] = useMemo(
    () =>
      dailyGroups
        .map(group => ({ ...group, items: group.items.filter(item => dailyVisibleIds.has(item.id)) }))
        .filter(group => group.items.length > 0),
    [dailyGroups, dailyVisibleIds],
  );

  useEffect(() => {
    if (firstDailyFilterRender.current) {
      firstDailyFilterRender.current = false;
      return;
    }
    setDailyPage(1);
  }, [search, category, method, archiveFilter, periodPreset, periodFrom, periodTo]);

  function changeDailyPageSize(nextSize: number) {
    setDailyPageSize(nextSize);
    storePageSize(nextSize);
    setDailyPage(1);
  }

  async function deleteCategoryConfirmed(id: string) {
    try {
      await expensesData.deleteCategory(id);
      toast.show({ message: 'Categorie ștearsă.' });
    } catch (error) {
      toast.show({ message: toUserError(error) });
    }
  }

  async function toggleArchived(expense: Expense) {
    try {
      await expensesData.setExpenseArchived(expense, !expense.archived);
    } catch (error) {
      toast.show({ message: toUserError(error) });
    }
  }

  // 40b: cheltuială nou-creată — „Anulează · N” cere POST /api/undo (fereastră 15s, verificată
  // server-side); auditId vine din plicul lui /api/record (revision-transaction.mjs).
  function showUndoAfterCreate(input: ExpenseFormInput, auditId: number | undefined) {
    if (!auditId) return;
    undoToast.show({
      title: 'Cheltuială adăugată',
      detail: `${formatMoney(Number(input.amount))} · ${input.category}`,
      onUndo: () => session.mutate('/api/undo', { auditId }),
    });
  }

  // C1: întoarce succesul real, nu doar dacă cererea a pornit — „Salvează și schimbă” din
  // useBranchSwitch schimbă filiala doar când save() (deci și funcția asta) întoarce true.
  async function submitExpenseForm(input: ExpenseFormInput): Promise<boolean> {
    try {
      if (formTarget && formTarget !== 'new') {
        await expensesData.updateExpense(formTarget, input);
      } else {
        const { auditId } = await expensesData.createExpense(input);
        showUndoAfterCreate(input, auditId);
      }
      setFormTarget(null);
      toast.show({ message: formTarget !== 'new' && formTarget ? 'Cheltuială actualizată.' : 'Cheltuială adăugată.' });
      return true;
    } catch (error) {
      toast.show({ message: toUserError(error) });
      return false;
    }
  }

  async function quickAddExpense(input: ExpenseFormInput): Promise<boolean> {
    try {
      const { auditId } = await expensesData.createExpense(input);
      showUndoAfterCreate(input, auditId);
      toast.show({ message: 'Cheltuială adăugată.' });
      return true;
    } catch (error) {
      toast.show({ message: toUserError(error) });
      return false;
    }
  }

  async function deleteExpenseForever(expense: Expense) {
    try {
      await expensesData.deleteExpense(expense.id);
      toast.show({ message: 'Cheltuială ștearsă definitiv.' });
    } catch (error) {
      toast.show({ message: toUserError(error) });
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
      toast.show({ message: toUserError(error) });
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
      toast.show({ message: toUserError(error) });
    }
  }

  // M1: secvențial, nu Promise.all — session.mutate refuză o mutație pornită cât alta e
  // „pending”, deci un Promise.all lasă doar prima anulare să reușească.
  async function undoArchiveSelected(targets: Expense[], archived: boolean) {
    try {
      for (const expense of targets) await expensesData.setExpenseArchived(expense, archived);
    } catch (error) {
      toast.show({ message: toUserError(error) });
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
      <Button size="header" onClick={() => setFormTarget('new')}>
        + Cheltuială nouă
      </Button>
      <RowMenu
        ariaLabel="Mai multe opțiuni"
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
          periodPreset={periodPreset}
          onPeriodPresetChange={setPeriodPreset}
          periodFrom={periodFrom}
          onPeriodFromChange={setPeriodFrom}
          periodTo={periodTo}
          onPeriodToChange={setPeriodTo}
        />

        {selectedRowKeys.size > 0 && (
          <SelectionBar
            label={
              <>
                {selectedRowKeys.size} selectate · {formatMoney(selectedTotal)}
              </>
            }
            onCancel={() => setSelectedRowKeys(new Set())}
            actions={[
              {
                label: archiveFilter === 'archived' ? 'Dezarhivează selectate' : 'Arhivează selectate',
                onClick: () => void archiveSelected(),
                tone: 'accent',
              },
            ]}
            danger={
              showDeleteForever ? { label: 'Șterge definitiv', onClick: () => setBulkDeleteOpen(true) } : undefined
            }
          />
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
              sort={sort}
              onSortChange={setSort}
              emptyState={<p>Nu există înregistrări pentru filtrele alese.</p>}
            />
            <p className={styles.summaryText}>
              <span>{filteredExpenses.length} înregistrări</span>
              <strong>Total {formatMoney(total(filteredExpenses))}</strong>
            </p>
          </>
        ) : (
          <>
            <DailyExpensesView
              groups={pagedDailyGroups}
              categoryNames={expensesData.categoryNames}
              onQuickAdd={quickAddExpense}
            />
            <Pagination
              page={dailyCurrentPage}
              totalPages={dailyTotalPages}
              totalRows={filteredExpenses.length}
              pageSize={dailyPageSize}
              onPageChange={setDailyPage}
              onPageSizeChange={changeDailyPageSize}
              ariaLabel="Pagini cheltuieli"
            />
          </>
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
        size="detail"
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
