import { useMemo, useState } from 'react';
import {
  Badge,
  Card,
  DataTable,
  Drawer,
  SearchSelect,
  SegmentedControl,
  useToast,
  type DataTableColumn,
} from '@shared/ui';
import { useAppSession } from '@shared/api/session';
import { useTopbarActions } from '../../app/shell/TopbarActions';
import { downloadCsv } from '@shared/csv-export';
import { formatDate } from '#shared/format/date-format.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import { allocations } from '#shared/domain/payment-allocations.mjs';
import { useChildren, type ChildRow } from './useChildren';
import { useChildProfile } from './useChildProfile';
import { ChildFormDrawer } from './ChildFormDrawer';
import { buildChildRecord, type ChildFormValues } from './child-form';
import type { Child, Payment, PaymentAllocation } from '@contracts/record-types.mjs';
import type { ViewKey } from '../../app/shell/nav-items';
import styles from './ChildrenPage.module.css';

export interface ChildrenPageProps {
  month: string;
  onNavigate: (view: ViewKey) => void;
  /** Sursa fișei deschise — controlată din URL (/copii/:childId) de ruta din App.tsx. */
  childId: string | null;
  onOpenChild: (id: string) => void;
  onCloseChild: () => void;
}

const AVATAR_TONES = ['toneOrange', 'toneMint', 'toneYellow', 'tonePink'] as const;
const GROUP_BADGE_TONES = ['orange', 'mint', 'yellow', 'pink'] as const;

function hashIndex(value: string, length: number): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash % length;
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('');
}

/** „Copii" (1c) + „Fișa copilului" (1e) — fișa e o rută imbricată (/copii/:childId), nu o intrare nouă în ViewKey. */
export function ChildrenPage({ month, onNavigate, childId, onOpenChild, onCloseChild }: ChildrenPageProps) {
  if (childId) {
    return <ChildProfileView childId={childId} month={month} onBack={onCloseChild} onNavigate={onNavigate} />;
  }
  return <ChildrenListView month={month} onNavigate={onNavigate} onOpenChild={onOpenChild} />;
}

type ArchiveFilter = 'active' | 'archived' | 'all';

function ChildrenListView({
  month,
  onNavigate,
  onOpenChild,
}: {
  month: string;
  onNavigate: (view: ViewKey) => void;
  onOpenChild: (id: string) => void;
}) {
  const data = useChildren(month);
  const session = useAppSession();
  const toast = useToast();

  const [query, setQuery] = useState('');
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>('active');
  const [groupFilter, setGroupFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [selectedRowKeys, setSelectedRowKeys] = useState<ReadonlySet<string>>(new Set<string>());
  const [formTarget, setFormTarget] = useState<Child | 'new' | null>(null);
  const [moveGroupId, setMoveGroupId] = useState('');

  useTopbarActions(
    <div className={styles.headerActions}>
      <button type="button" className={styles.btnPrimary} onClick={() => setFormTarget('new')}>
        + Adaugă copil
      </button>
    </div>,
  );

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('ro-RO');
    return data.rows.filter(row => {
      if (archiveFilter === 'active' && row.archived) return false;
      if (archiveFilter === 'archived' && !row.archived) return false;
      if (groupFilter === 'none' && row.groupId) return false;
      if (groupFilter !== 'all' && groupFilter !== 'none' && row.groupId !== groupFilter) return false;
      if (paymentFilter !== 'all' && row.payment.label !== paymentFilter) return false;
      if (normalizedQuery) {
        const haystack = `${row.name} ${row.child.contractNumber ?? row.child.id}`.toLocaleLowerCase('ro-RO');
        if (!haystack.includes(normalizedQuery)) return false;
      }
      return true;
    });
  }, [data.rows, archiveFilter, groupFilter, paymentFilter, query]);

  async function archiveSelected() {
    const ids = [...selectedRowKeys];
    const targets = data.rows.filter(row => ids.includes(row.id) && !row.archived);
    if (targets.length === 0) return;
    const archivedAt = new Date().toISOString();
    try {
      for (const row of targets) {
        await session.mutate('/api/record', {
          type: 'children',
          mode: 'update',
          record: { ...row.child, archived: true, archivedAt },
        });
      }
      setSelectedRowKeys(new Set());
      toast.show({
        message: `${targets.length} ${targets.length === 1 ? 'copil arhivat' : 'copii arhivați'}`,
        actionLabel: 'Anulează',
        onAction: () => {
          void Promise.all(
            targets.map(row =>
              session.mutate('/api/record', {
                type: 'children',
                mode: 'update',
                record: { ...row.child, archived: false, archivedAt: null },
              }),
            ),
          );
        },
      });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  async function unarchiveSelected() {
    const ids = [...selectedRowKeys];
    const targets = data.rows.filter(row => ids.includes(row.id) && row.archived);
    if (targets.length === 0) return;
    try {
      for (const row of targets) {
        await session.mutate('/api/record', {
          type: 'children',
          mode: 'update',
          record: { ...row.child, archived: false, archivedAt: null },
        });
      }
      setSelectedRowKeys(new Set());
      toast.show({
        message: `${targets.length} ${targets.length === 1 ? 'copil dezarhivat' : 'copii dezarhivați'}`,
      });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  async function moveSelectedToGroup(groupId: string) {
    const ids = [...selectedRowKeys];
    const targets = data.rows.filter(row => ids.includes(row.id));
    if (targets.length === 0) return;
    const nextGroupId = groupId === '__none__' ? null : groupId;
    try {
      for (const row of targets) {
        await session.mutate('/api/record', {
          type: 'children',
          mode: 'update',
          record: { ...row.child, groupId: nextGroupId },
        });
      }
      setSelectedRowKeys(new Set());
      setMoveGroupId('');
      toast.show({ message: `${targets.length} ${targets.length === 1 ? 'copil mutat' : 'copii mutați'} în grupă.` });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  function exportSelected() {
    const ids = [...selectedRowKeys];
    const targets = data.rows.filter(row => ids.includes(row.id));
    if (targets.length === 0) return;
    downloadCsv(
      `copii-${month}.csv`,
      ['Nume', 'Contract', 'Părinte', 'Telefon', 'Grupă', 'Scadență', 'Plată lună curentă'],
      targets.map(row => [
        row.name,
        row.contractLabel,
        row.parent,
        row.phone,
        row.groupName,
        row.dueDateLabel,
        row.payment.label,
      ]),
    );
  }

  async function toggleArchived(row: ChildRow) {
    try {
      await session.mutate('/api/record', {
        type: 'children',
        mode: 'update',
        record: { ...row.child, archived: !row.archived, archivedAt: row.archived ? null : new Date().toISOString() },
      });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  async function submitChildForm(values: ChildFormValues) {
    try {
      const previous = formTarget && formTarget !== 'new' ? formTarget : null;
      const record = buildChildRecord(previous, `ID-${crypto.randomUUID()}`, values);
      await session.mutate('/api/record', {
        type: 'children',
        mode: previous ? 'update' : 'create',
        record,
      });
      setFormTarget(null);
      toast.show({ message: previous ? 'Fișă actualizată.' : 'Copil adăugat.' });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  async function deleteChildForever(row: ChildRow) {
    if (!window.confirm(`Ștergi definitiv fișa ${row.name}? Nu poate fi anulată, spre deosebire de arhivare.`)) return;
    try {
      await session.mutate('/api/record-delete', { type: 'children', id: row.id });
      toast.show({ message: 'Fișă ștearsă definitiv.' });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  if (data.status === 'loading') return <p className={styles.notice}>Se încarcă datele…</p>;
  if (data.status === 'failed')
    return <p className={styles.notice}>{data.failureMessage || 'Datele nu au putut fi încărcate.'}</p>;

  const columns: DataTableColumn<ChildRow>[] = [
    {
      key: 'name',
      header: 'Copil',
      sortValue: row => row.name,
      render: row => (
        <div className={styles.childCell}>
          <span className={`${styles.avatar} ${styles[AVATAR_TONES[hashIndex(row.id, AVATAR_TONES.length)]]}`}>
            {initials(row.name)}
          </span>
          <div>
            <strong>{row.name}</strong>
            <small>{row.contractLabel}</small>
          </div>
        </div>
      ),
    },
    {
      key: 'parent',
      header: 'Părinte',
      sortValue: row => row.parent,
      render: row => (
        <div className={styles.parentCell}>
          <span>{row.parent || '—'}</span>
          {row.phone && <small>{row.phone}</small>}
        </div>
      ),
    },
    {
      key: 'group',
      header: 'Grupă',
      sortValue: row => row.groupName,
      render: row =>
        row.groupName ? (
          <Badge tone={GROUP_BADGE_TONES[hashIndex(row.groupId || '', GROUP_BADGE_TONES.length)]}>
            {row.groupName}
          </Badge>
        ) : (
          <Badge tone="neutral">Nealocată</Badge>
        ),
    },
    {
      key: 'due',
      header: 'Scadență',
      render: row => row.dueDateLabel,
    },
    {
      key: 'payment',
      header: 'Plată luna curentă',
      render: row => (
        <Badge tone={row.payment.tone}>
          <span className={styles.dot} />
          {row.payment.label}
        </Badge>
      ),
    },
    {
      key: 'menu',
      header: '',
      align: 'end',
      render: row => (
        <details className={styles.rowMenu} onClick={event => event.stopPropagation()}>
          <summary aria-label="Mai multe acțiuni">⋯</summary>
          <div className={styles.rowMenuPanel}>
            <button type="button" onClick={() => setFormTarget(row.child)}>
              Editează
            </button>
            <button type="button" onClick={() => toggleArchived(row)}>
              {row.archived ? 'Reactivează' : 'Arhivează'}
            </button>
            <button
              type="button"
              className={styles.rowMenuDanger}
              disabled={!row.archived}
              title={row.archived ? undefined : 'Arhivează întâi fișa'}
              onClick={() => void deleteChildForever(row)}
            >
              Șterge definitiv
            </button>
          </div>
        </details>
      ),
    },
  ];

  return (
    <>
      <div className={styles.statsRow}>
        <Card tone="orange" className={styles.statCard}>
          <strong className={styles.statValueOrange}>{data.summary.activeCount}</strong>
          <div>
            <span>Copii activi</span>
            <small>statut curent din fișă</small>
          </div>
        </Card>
        <Card tone="mint" className={styles.statCard}>
          <strong className={styles.statValueMint}>{data.summary.occupiedGroupsCount}</strong>
          <div>
            <span>Grupe ocupate</span>
            <small>din {data.groups.length} grupe</small>
          </div>
        </Card>
        <Card tone="yellow" className={styles.statCard}>
          <strong className={styles.statValueYellow}>{data.summary.incompleteCount}</strong>
          <div className={styles.statMain}>
            <span>Fișe de verificat</span>
            <small>în centrul de verificare</small>
          </div>
          <button type="button" className={styles.statLink} onClick={() => onNavigate('review')}>
            Verifică →
          </button>
        </Card>
      </div>

      <div className={styles.tableCard}>
        <div className={styles.toolbar}>
          <input
            className={styles.search}
            type="search"
            placeholder="Caută nume sau contract…"
            value={query}
            onChange={event => setQuery(event.target.value)}
            aria-label="Caută copil"
          />
          <SegmentedControl
            ariaLabel="Filtru arhivare"
            value={archiveFilter}
            onChange={value => {
              setArchiveFilter(value);
              setSelectedRowKeys(new Set());
            }}
            options={[
              { value: 'active', label: `Activi · ${data.activeTotal}` },
              { value: 'archived', label: `Arhivați · ${data.archivedTotal}` },
              { value: 'all', label: `Toți · ${data.activeTotal + data.archivedTotal}` },
            ]}
          />
          <SearchSelect
            className={styles.filterSelect}
            ariaLabel="Filtru grupă"
            value={groupFilter}
            onChange={setGroupFilter}
            options={[
              { value: 'all', label: 'Toate grupele' },
              { value: 'none', label: 'Fără grupă' },
              ...data.groups.map(group => ({ value: group.id, label: group.name })),
            ]}
          />
          <SearchSelect
            className={styles.filterSelect}
            ariaLabel="Filtru plată"
            value={paymentFilter}
            onChange={setPaymentFilter}
            options={[
              { value: 'all', label: 'Toate plățile' },
              { value: 'Achitat', label: 'Achitat' },
              { value: 'Parțial', label: 'Parțial' },
              { value: 'Neachitat', label: 'Neachitat' },
              { value: 'Scadent', label: 'Scadent' },
            ]}
          />
        </div>

        {selectedRowKeys.size > 0 && (
          <div className={styles.selectionBar}>
            <span>{selectedRowKeys.size} selectați</span>
            <span className={styles.selectionDivider}>|</span>
            <SearchSelect
              className={styles.filterSelect}
              ariaLabel="Mută în grupa"
              placeholder="Mută în grupă…"
              value={moveGroupId}
              onChange={setMoveGroupId}
              options={[
                { value: '__none__', label: 'Fără grupă' },
                ...data.groups.map(group => ({ value: group.id, label: group.name })),
              ]}
            />
            <button type="button" disabled={!moveGroupId} onClick={() => void moveSelectedToGroup(moveGroupId)}>
              Mută
            </button>
            <button type="button" onClick={exportSelected}>
              Exportă
            </button>
            {archiveFilter === 'archived' ? (
              <button type="button" className={styles.selectionArchive} onClick={() => void unarchiveSelected()}>
                Dezarhivează
              </button>
            ) : (
              <button type="button" className={styles.selectionArchive} onClick={() => void archiveSelected()}>
                Arhivează
              </button>
            )}
            <button type="button" className={styles.selectionCancel} onClick={() => setSelectedRowKeys(new Set())}>
              Anulează ×
            </button>
          </div>
        )}

        <DataTable
          bare
          columns={columns}
          rows={filteredRows}
          rowKey={row => row.id}
          selectable
          selectedRowKeys={selectedRowKeys}
          onSelectedRowKeysChange={setSelectedRowKeys}
          onRowClick={row => onOpenChild(row.id)}
          emptyState={<p>Niciun copil nu corespunde filtrelor curente.</p>}
        />
      </div>

      <ChildFormDrawer
        key={formTarget === 'new' || formTarget === null ? 'new' : formTarget.id}
        target={formTarget}
        groups={data.groups}
        onSubmit={submitChildForm}
        onClose={() => setFormTarget(null)}
      />
    </>
  );
}

function ChildProfileView({
  childId,
  month,
  onBack,
  onNavigate,
}: {
  childId: string;
  month: string;
  onBack: () => void;
  onNavigate: (view: ViewKey) => void;
}) {
  const data = useChildProfile(childId, month);
  const session = useAppSession();
  const toast = useToast();
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [paymentDrawerOpen, setPaymentDrawerOpen] = useState(false);

  if (data.status === 'loading') return <p className={styles.notice}>Se încarcă datele…</p>;
  if (data.status === 'failed')
    return <p className={styles.notice}>{data.failureMessage || 'Datele nu au putut fi încărcate.'}</p>;
  if (data.status === 'not-found' || !data.child) {
    return (
      <>
        <button type="button" className={styles.backLink} onClick={onBack}>
          ← Copii
        </button>
        <p className={styles.notice}>Fișa nu a putut fi găsită.</p>
      </>
    );
  }

  const { child, obligation: childObligation } = data;

  async function changeGroup(groupId: string) {
    try {
      await session.mutate('/api/record', {
        type: 'children',
        mode: 'update',
        record: { ...child, groupId: groupId || null },
      });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  async function submitChildEdit(values: ChildFormValues) {
    try {
      const record = buildChildRecord(child, child.id, values);
      await session.mutate('/api/record', { type: 'children', mode: 'update', record });
      setEditDrawerOpen(false);
      toast.show({ message: 'Fișă actualizată.' });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  return (
    <>
      <p className={styles.breadcrumb}>
        <button type="button" onClick={onBack}>
          Copii
        </button>{' '}
        / {child.name}
      </p>

      <Card tone="orange" decorative className={styles.profileHeader}>
        <span className={styles.profileAvatar}>{initials(child.name)}</span>
        <div className={styles.profileHeadInfo}>
          <h2 className={styles.profileName}>{child.name}</h2>
          <p className={styles.profileMeta}>
            {child.birthDate ? formatDate(child.birthDate) : 'dată necunoscută'} · {data.age} · Contract{' '}
            {data.contractLabel}
            <span className={styles.profileBadgeMint}>{child.status}</span>
            <span className={styles.profileBadgeOrange}>{data.groupName}</span>
          </p>
        </div>
        <div className={styles.profileActions}>
          <button type="button" className={styles.btnWhite} onClick={() => setEditDrawerOpen(true)}>
            Editează fișa
          </button>
          <button type="button" className={styles.btnPrimary} onClick={() => setPaymentDrawerOpen(true)}>
            + Plată
          </button>
        </div>
      </Card>

      <div className={styles.profileGrid}>
        <div className={styles.profileLeft}>
          <Card className={styles.profileSection}>
            <p className={styles.sectionTitle}>Părinți</p>
            <ParentRow name={child.parent} phone={child.phone} />
            {(child.parent2 || child.phone2) && <ParentRow name={child.parent2 || ''} phone={child.phone2 || ''} />}
          </Card>

          <Card className={styles.profileSection}>
            <p className={styles.sectionTitle}>Grupă și educator</p>
            <div className={styles.groupRow}>
              <span className={styles.groupSquare}>{data.groupName.charAt(0).toUpperCase() || '—'}</span>
              <select
                className={styles.select}
                value={child.groupId ?? ''}
                onChange={event => void changeGroup(event.target.value)}
                aria-label="Schimbă grupa"
              >
                <option value="">Nealocată</option>
                {data.groups.map(group => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>
          </Card>

          {child.notes && (
            <Card tone="yellow" className={styles.profileSection}>
              <p className={styles.sectionTitle}>Note</p>
              <p>{child.notes}</p>
            </Card>
          )}
        </div>

        <div className={styles.profileRight}>
          <div className={styles.miniCards}>
            <Card tone="mint" className={styles.miniCard}>
              <span>Sold</span>
              <strong>{formatMoney(childObligation?.rest ?? null)}</strong>
            </Card>
            <Card tone="yellow" className={styles.miniCard}>
              <span>Taxă lunară</span>
              <strong>{formatMoney(child.fee)}</strong>
            </Card>
            <Card className={styles.miniCard}>
              <span>Contract</span>
              <strong>{data.contractLabel}</strong>
              <small>{child.contractDate ? formatDate(child.contractDate) : '—'}</small>
            </Card>
          </div>

          <Card className={styles.profileSection}>
            <div className={styles.sectionHead}>
              <p className={styles.sectionTitle}>Istoric plăți</p>
              <button type="button" className={styles.sectionLink} onClick={() => onNavigate('payments')}>
                Toate achitările →
              </button>
            </div>
            <PaymentHistoryTable payments={data.payments} />
          </Card>
        </div>
      </div>

      <ChildFormDrawer
        key={editDrawerOpen ? child.id : 'closed'}
        target={editDrawerOpen ? child : null}
        groups={data.groups}
        onSubmit={submitChildEdit}
        onClose={() => setEditDrawerOpen(false)}
      />
      <Drawer open={paymentDrawerOpen} title="Plată nouă" onClose={() => setPaymentDrawerOpen(false)}>
        <p>Formular complet — pasul următor din plan.</p>
      </Drawer>
    </>
  );
}

function ParentRow({ name, phone }: { name: string; phone: string }) {
  return (
    <div className={styles.parentContactRow}>
      <strong>{name || 'Necunoscut'}</strong>
      {phone ? <span>{phone}</span> : <button type="button">+ adaugă telefon</button>}
    </div>
  );
}

function PaymentHistoryTable({ payments }: { payments: Payment[] }) {
  if (payments.length === 0) return <p className={styles.notice}>Fără achitări.</p>;

  const columns: DataTableColumn<Payment>[] = [
    {
      key: 'month',
      header: 'Lună',
      render: payment =>
        allocations(payment)
          .map((allocation: PaymentAllocation) => allocation.month)
          .join(', ') || 'Avans nerepartizat',
    },
    { key: 'date', header: 'Dată', render: payment => formatDate(payment.date), sortValue: payment => payment.date },
    { key: 'method', header: 'Metodă', render: payment => payment.method },
    {
      key: 'amount',
      header: 'Sumă',
      align: 'end',
      render: payment => formatMoney(payment.amount),
      sortValue: payment => payment.amount,
    },
    {
      key: 'status',
      header: '',
      render: payment => (
        <Badge tone={payment.archived ? 'neutral' : 'mint'}>{payment.archived ? 'Arhivată' : 'Achitat'}</Badge>
      ),
    },
  ];

  return <DataTable columns={columns} rows={payments} rowKey={payment => payment.id} pageSize={6} />;
}
