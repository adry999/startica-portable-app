import { useMemo, useState, type FormEvent } from 'react';
import { Badge, Card, DataTable, Drawer, SegmentedControl, useToast, type DataTableColumn } from '@shared/ui';
import { usePersistedState } from '@shared/state/usePersistedState';
import { total } from '@domain/money.mjs';
import { formatDate } from '#shared/format/date-format.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import { normalizeSearchText } from '#shared/format/text-search.mjs';
import { matchesRecordListSearch } from '#shared/ui/record-list-search.mjs';
import { useExpenses, categoryStyleFor } from './useExpenses';
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
  const [newExpenseDrawerOpen, setNewExpenseDrawerOpen] = useState(false);

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

  async function toggleArchived(expense: Expense) {
    try {
      await data.setExpenseArchived(expense, !expense.archived);
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
        <details className={styles.rowMenu} onClick={event => event.stopPropagation()}>
          <summary aria-label="Mai multe acțiuni">⋯</summary>
          <div className={styles.rowMenuPanel}>
            {/* TODO: pasul Formulare — editare completă a cheltuielii */}
            <button type="button">Editează</button>
            <button type="button" onClick={() => void toggleArchived(expense)}>
              {expense.archived ? 'Reactivează' : 'Arhivează'}
            </button>
            {/* TODO: pasul Formulare — ștergere definitivă, cu confirmare */}
            <button type="button" className={styles.rowMenuDanger}>
              Șterge definitiv
            </button>
          </div>
        </details>
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
        {/* TODO: pasul Formulare — export real */}
        <button type="button" className={styles.btnGhost}>
          Exportă
        </button>
        <button type="button" className={styles.btnPrimary} onClick={() => setNewExpenseDrawerOpen(true)}>
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
              data.categories.map(cat => (
                <span key={cat.id} className={styles.chip}>
                  {cat.name}
                  <button
                    type="button"
                    aria-label={`Șterge ${cat.name}`}
                    title="Șterge categoria"
                    onClick={() => void handleDeleteCategory(cat.id, cat.name)}
                  >
                    ×
                  </button>
                </span>
              ))
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
          <div className={styles.selectionBar}>
            <span>
              {selectedRowKeys.size} selectate · {formatMoney(selectedTotal)}
            </span>
            <button type="button" className={styles.selectionArchive} onClick={() => void archiveSelected()}>
              {archiveFilter === 'archived' ? 'Dezarhivează selectate' : 'Arhivează selectate'}
            </button>
            <button type="button" className={styles.selectionCancel} onClick={() => setSelectedRowKeys(new Set())}>
              Anulează ×
            </button>
          </div>
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

      <Drawer open={newExpenseDrawerOpen} title="Cheltuială nouă" onClose={() => setNewExpenseDrawerOpen(false)}>
        {/* TODO: pasul Formulare — formular complet, cu „+ Atașează bon” */}
        <p>Formular complet — pasul următor din plan.</p>
      </Drawer>
    </>
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
