import { useMemo, useState, type FormEvent } from 'react';
import {
  Badge,
  Card,
  DataTable,
  Drawer,
  RowMenu,
  SegmentedControl,
  SelectionBar,
  useToast,
  type DataTableColumn,
} from '@shared/ui';
import { usePersistedState } from '@shared/state/usePersistedState';
import { downloadCsv } from '@shared/csv-export';
import { total } from '@domain/money.mjs';
import { today } from '@domain/calendar-month.mjs';
import { formatDate } from '#shared/format/date-format.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import { normalizeSearchText } from '#shared/format/text-search.mjs';
import { matchesRecordListSearch } from '#shared/ui/record-list-search.mjs';
import { useExpenses, categoryStyleFor, type ExpenseFormInput } from './useExpenses';
import type { Expense } from '@contracts/record-types.mjs';
import styles from './ExpensesPage.module.css';

export interface ExpensesPageProps {
  month: string;
}

type ViewMode = 'table' | 'daily';
type ArchiveFilter = 'active' | 'archived' | 'all';

export function ExpensesPage({ month }: ExpensesPageProps) {
  const data = useExpenses(month);
  const toast = useToast();

  const [viewMode, setViewMode] = usePersistedState<ViewMode>('view.expenses', 'table');
  const [search, setSearch] = useState('');
  const [monthFrom, setMonthFrom] = useState('');
  const [monthTo, setMonthTo] = useState('');
  const [category, setCategory] = useState('');
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>('active');
  const [selectedRowKeys, setSelectedRowKeys] = useState<ReadonlySet<string>>(new Set<string>());
  const [newCategoryName, setNewCategoryName] = useState('');
  const [formTarget, setFormTarget] = useState<Expense | 'new' | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');

  const filteredExpenses = useMemo(() => {
    const normalizedSearch = normalizeSearchText(search);
    return data.expenses.filter(
      expense =>
        (archiveFilter === 'all' || (archiveFilter === 'archived' ? expense.archived : !expense.archived)) &&
        (!monthFrom || expense.date.slice(0, 7) >= monthFrom) &&
        (!monthTo || expense.date.slice(0, 7) <= monthTo) &&
        (!category || expense.category === category) &&
        matchesRecordListSearch('expenses', expense, data.records, normalizedSearch),
    );
  }, [data.expenses, data.records, search, monthFrom, monthTo, category, archiveFilter]);

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

  const dailyGroups = useMemo(() => {
    const byDate = new Map<string, Expense[]>();
    for (const expense of filteredExpenses) byDate.set(expense.date, [...(byDate.get(expense.date) ?? []), expense]);
    return [...byDate.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, items]) => ({ date, items, dayTotal: total(items) }));
  }, [filteredExpenses]);

  async function handleCreateCategory(event: FormEvent) {
    event.preventDefault();
    try {
      await data.createCategory(newCategoryName);
      setNewCategoryName('');
      toast.show({ message: 'Categorie adăugată.' });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  async function handleDeleteCategory(id: string, name: string) {
    if (!window.confirm(`Ștergi categoria „${name}”? Cheltuielile care o folosesc deja nu se modifică.`)) return;
    try {
      await data.deleteCategory(id);
      toast.show({ message: 'Categorie ștearsă.' });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  function startEditingCategory(id: string, name: string) {
    setEditingCategoryId(id);
    setEditingCategoryName(name);
  }

  async function commitEditingCategory() {
    if (!editingCategoryId) return;
    const id = editingCategoryId;
    setEditingCategoryId(null);
    try {
      await data.renameCategory(id, editingCategoryName);
      toast.show({ message: 'Categorie redenumită.' });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  async function toggleArchived(expense: Expense) {
    try {
      await data.setExpenseArchived(expense, !expense.archived);
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  async function submitExpenseForm(input: ExpenseFormInput) {
    try {
      if (formTarget && formTarget !== 'new') await data.updateExpense(formTarget, input);
      else await data.createExpense(input);
      setFormTarget(null);
      toast.show({ message: formTarget !== 'new' && formTarget ? 'Cheltuială actualizată.' : 'Cheltuială adăugată.' });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  async function deleteExpenseForever(expense: Expense) {
    if (!window.confirm(`Ștergi definitiv cheltuiala ${expense.id}? Nu poate fi anulată, spre deosebire de arhivare.`))
      return;
    try {
      await data.deleteExpense(expense.id);
      toast.show({ message: 'Cheltuială ștearsă definitiv.' });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  async function archiveSelected() {
    const targetArchived = archiveFilter !== 'archived';
    const ids = [...selectedRowKeys];
    const targets = data.expenses.filter(expense => ids.includes(expense.id) && expense.archived !== targetArchived);
    if (targets.length === 0) return;
    try {
      for (const expense of targets) await data.setExpenseArchived(expense, targetArchived);
      setSelectedRowKeys(new Set());
      const single = targets.length === 1;
      const noun = single ? 'cheltuială' : 'cheltuieli';
      const verb = targetArchived ? (single ? 'arhivată' : 'arhivate') : single ? 'dezarhivată' : 'dezarhivate';
      toast.show({
        message: `${targets.length} ${noun} ${verb}`,
        actionLabel: 'Anulează',
        onAction: () => {
          void Promise.all(targets.map(expense => data.setExpenseArchived(expense, !targetArchived)));
        },
      });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  if (data.status === 'loading') return <p className={styles.notice}>Se încarcă datele…</p>;
  if (data.status === 'failed')
    return <p className={styles.notice}>{data.failureMessage || 'Datele nu au putut fi încărcate.'}</p>;

  const activeTotal = data.expenses.filter(expense => !expense.archived).length;
  const archivedTotal = data.expenses.filter(expense => expense.archived).length;
  const selectedTotal = total(filteredExpenses.filter(expense => selectedRowKeys.has(expense.id)));

  const columns: DataTableColumn<Expense>[] = [
    { key: 'date', header: 'Data', sortValue: expense => expense.date, render: expense => formatDate(expense.date) },
    {
      key: 'description',
      header: 'Descriere/furnizor',
      sortValue: expense => expense.description,
      render: expense => expense.description || '—',
    },
    {
      key: 'category',
      header: 'Categorie',
      sortValue: expense => expense.category,
      render: expense => <Badge tone={categoryStyleFor(expense.category).tone}>{expense.category}</Badge>,
    },
    {
      key: 'amount',
      header: 'Suma',
      align: 'end',
      sortValue: expense => expense.amount,
      render: expense => <strong>{formatMoney(expense.amount)}</strong>,
    },
    {
      key: 'menu',
      header: '',
      align: 'end',
      render: expense => (
        <RowMenu
          items={[
            { label: 'Editează', onClick: () => setFormTarget(expense) },
            {
              label: expense.archived ? 'Reactivează' : 'Arhivează',
              onClick: () => void toggleArchived(expense),
            },
            {
              label: 'Șterge definitiv',
              danger: true,
              disabled: !expense.archived,
              title: expense.archived ? undefined : 'Arhivează întâi cheltuiala',
              onClick: () => void deleteExpenseForever(expense),
            },
          ]}
        />
      ),
    },
  ];

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
        <button type="button" className={styles.btnGhost} onClick={exportFiltered}>
          Exportă
        </button>
        <button type="button" className={styles.btnPrimary} onClick={() => setFormTarget('new')}>
          + Cheltuială nouă
        </button>
      </div>

      <div className={styles.kpiRow}>
        <Card tone="mint" decorative className={styles.kpiCard}>
          <p className={styles.kpiLabel}>Total lună</p>
          <strong className={styles.kpiValue}>{formatMoney(data.monthTotal)}</strong>
        </Card>

        <Card className={styles.categoryCard}>
          <p className={styles.kpiLabel}>Pe categorii, luna curentă</p>
          <div className={styles.categoryBar}>
            {data.categorySummary
              .filter(item => item.amount > 0)
              .map(item => (
                <span key={item.label} style={{ width: `${item.percent}%`, background: item.color }} />
              ))}
          </div>
          <div className={styles.categoryLegend}>
            {data.categorySummary.map(item => (
              <div key={item.label} className={styles.categoryLegendItem}>
                <span className={styles.categoryDot} style={{ background: item.color }} />
                <span>{item.label}</span>
                <strong>{formatMoney(item.amount)}</strong>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className={styles.tableCard}>
        <div className={styles.chipsRow}>
          <div className={styles.chips}>
            {data.categories.length === 0 ? (
              <span className={styles.notice}>
                Nicio categorie adăugată încă — se folosesc doar sugestiile implicite.
              </span>
            ) : (
              data.categories.map(cat =>
                editingCategoryId === cat.id ? (
                  <span key={cat.id} className={styles.chip}>
                    <input
                      autoFocus
                      className={styles.chipEditInput}
                      style={{ width: `${Math.max(4, editingCategoryName.length)}ch` }}
                      value={editingCategoryName}
                      aria-label={`Redenumește ${cat.name}`}
                      onChange={event => setEditingCategoryName(event.target.value)}
                      onBlur={() => void commitEditingCategory()}
                      onKeyDown={event => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          void commitEditingCategory();
                        } else if (event.key === 'Escape') {
                          setEditingCategoryId(null);
                        }
                      }}
                    />
                  </span>
                ) : (
                  <span key={cat.id} className={styles.chip}>
                    <button
                      type="button"
                      className={styles.chipLabel}
                      title="Redenumește categoria"
                      onClick={() => startEditingCategory(cat.id, cat.name)}
                    >
                      {cat.name}
                    </button>
                    <button
                      type="button"
                      aria-label={`Șterge ${cat.name}`}
                      title="Șterge categoria"
                      onClick={() => void handleDeleteCategory(cat.id, cat.name)}
                    >
                      ×
                    </button>
                  </span>
                ),
              )
            )}
          </div>
          <form className={styles.chipForm} onSubmit={handleCreateCategory}>
            <input
              value={newCategoryName}
              onChange={event => setNewCategoryName(event.target.value)}
              placeholder="Categorie nouă"
              aria-label="Categoria nouă"
            />
            <button type="submit" className={styles.btnGhostSmall}>
              + Adaugă
            </button>
          </form>
        </div>

        <div className={styles.toolbar}>
          <input
            className={styles.search}
            type="search"
            placeholder="Caută descriere sau categorie…"
            value={search}
            onChange={event => setSearch(event.target.value)}
            aria-label="Caută cheltuială"
          />
          <input
            className={styles.select}
            type="month"
            value={monthFrom}
            onChange={event => setMonthFrom(event.target.value)}
            aria-label="De la luna"
          />
          <input
            className={styles.select}
            type="month"
            value={monthTo}
            onChange={event => setMonthTo(event.target.value)}
            aria-label="Până la luna"
          />
          <select
            className={styles.select}
            value={category}
            onChange={event => setCategory(event.target.value)}
            aria-label="Filtru categorie"
          >
            <option value="">Categorie ▾</option>
            {data.categoryNames.map(name => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <SegmentedControl
            ariaLabel="Filtru arhivare"
            value={archiveFilter}
            onChange={setArchiveFilter}
            options={[
              { value: 'active', label: `Activi · ${activeTotal}` },
              { value: 'archived', label: `Arhivați · ${archivedTotal}` },
              { value: 'all', label: `Toți · ${activeTotal + archivedTotal}` },
            ]}
          />
        </div>

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
        categoryNames={data.categoryNames}
        onSubmit={submitExpenseForm}
        onClose={() => setFormTarget(null)}
      />
    </>
  );
}

function ExpenseFormDrawer({
  target,
  categoryNames,
  onSubmit,
  onClose,
}: {
  target: Expense | 'new' | null;
  categoryNames: string[];
  onSubmit: (input: ExpenseFormInput) => void;
  onClose: () => void;
}) {
  const editing = target !== null && target !== 'new' ? target : null;
  const [date, setDate] = useState(editing?.date || today());
  const [amount, setAmount] = useState(editing?.amount !== undefined ? String(editing.amount) : '');
  const [category, setCategory] = useState(editing?.category || 'Altele');
  const [description, setDescription] = useState(editing?.description || '');
  const [notes, setNotes] = useState(editing?.notes || '');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit({ date, amount, category, description, notes });
  }

  return (
    <Drawer
      open={target !== null}
      title={editing ? 'Editează: cheltuială' : 'Adaugă: cheltuială'}
      width={520}
      onClose={onClose}
      footer={
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={() => onSubmit({ date, amount, category, description, notes })}
        >
          Salvează
        </button>
      }
    >
      <form className={styles.editorForm} onSubmit={handleSubmit}>
        <label className={styles.editorField}>
          Data cheltuielii
          <input type="date" required value={date} onChange={event => setDate(event.target.value)} />
        </label>
        <label className={styles.editorField}>
          Suma
          <input
            type="number"
            required
            min={0.01}
            step="0.01"
            value={amount}
            onChange={event => setAmount(event.target.value)}
          />
        </label>
        <label className={styles.editorField}>
          Categorie
          <input
            type="text"
            required
            list="expenseCategoryOptions"
            value={category}
            onChange={event => setCategory(event.target.value)}
          />
          <datalist id="expenseCategoryOptions">
            {categoryNames.map(name => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </label>
        <label className={styles.editorField}>
          Descriere
          <input type="text" value={description} onChange={event => setDescription(event.target.value)} />
        </label>
        <label className={styles.editorField}>
          Observații
          <textarea value={notes} onChange={event => setNotes(event.target.value)} rows={3} />
        </label>
      </form>
    </Drawer>
  );
}

interface DailyGroup {
  date: string;
  items: Expense[];
  dayTotal: number;
}

/**
 * Vizualizare simplă „Pe zile”, fără coloana de buget — bugetul pe categorii e
 * o funcție nouă, explicit în afara scopului (vezi README-ul redesign-ului).
 */
function DailyExpensesView({ groups }: { groups: DailyGroup[] }) {
  if (groups.length === 0) return <p className={styles.notice}>Nu există înregistrări pentru filtrele alese.</p>;

  return (
    <div className={styles.dailyList}>
      {groups.map(group => (
        <div key={group.date} className={styles.dayGroup}>
          <div className={styles.dayHead}>
            <strong>{formatDate(group.date)}</strong>
            <span>{formatMoney(group.dayTotal)}</span>
          </div>
          {group.items.map(expense => (
            <div key={expense.id} className={styles.dayRow}>
              <span className={styles.dayRowDesc}>{expense.description || '—'}</span>
              <Badge tone={categoryStyleFor(expense.category).tone}>{expense.category}</Badge>
              <span className={styles.dayRowAmount}>{formatMoney(expense.amount)}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
