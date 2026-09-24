import { useEffect, useState } from 'react';
import { total } from '@domain/money.mjs';
import { Badge, Card, DataTable, Drawer, SegmentedControl, useToast, type DataTableColumn } from '@shared/ui';
import { usePersistedState } from '@shared/state/usePersistedState';
import { useAppSession } from '@shared/api/session';
import { AppShell } from './shell/AppShell';
import { today } from '@domain/calendar-month.mjs';
import type { ViewKey } from './shell/nav-items';
import { DashboardPage } from '@features/dashboard';
import { ChildrenPage } from '@features/children';
import { GroupsPage } from '@features/groups';
import { PaymentsPage } from '@features/payments';
import { ExpensesPage } from '@features/expenses';
import { StatusPage } from '@features/status';

interface Child {
  id: string;
  name: string;
  status: 'Achitat' | 'Parțial' | 'Neachitat';
  fee: number;
}

const children: Child[] = [
  { id: 'c1', name: 'Andrei Popescu', status: 'Achitat', fee: 1500 },
  { id: 'c2', name: 'Maria Ionescu', status: 'Parțial', fee: 2000 },
];

const columns: DataTableColumn<Child>[] = [
  { key: 'name', header: 'Copil', render: c => c.name, sortValue: c => c.name },
  {
    key: 'status',
    header: 'Plată',
    render: c => <Badge tone={c.status === 'Achitat' ? 'mint' : 'yellow'}>{c.status}</Badge>,
  },
  { key: 'fee', header: 'Taxă', render: c => `${c.fee} lei`, sortValue: c => c.fee, align: 'end' },
];

// Placeholder de conținut: dovedește shared/ui în interiorul shell-ului real (AppShell).
// Ecranele propriu-zise (Dashboard etc.) vin la pasul 5 din spec și înlocuiesc acest bloc.
function ScaffoldContent() {
  const [tableView, setTableView] = usePersistedState<'table' | 'monthly'>('scaffold.view', 'table');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const toast = useToast();
  const sample = total([{ amount: 10 }, { amount: 5.5 }]);

  return (
    <>
      <p>@domain/money.mjs total([10, 5.5]) = {sample}</p>

      <Card tone="orange" decorative>
        <p>Încasări</p>
        <strong style={{ fontFamily: 'var(--font-heading)', fontSize: 36 }}>12 450 lei</strong>
      </Card>

      <SegmentedControl
        ariaLabel="Vizualizare"
        value={tableView}
        onChange={setTableView}
        options={[
          { value: 'table', label: 'Tabel' },
          { value: 'monthly', label: 'Pe luni' },
        ]}
      />

      <DataTable columns={columns} rows={children} rowKey={c => c.id} />

      <button type="button" onClick={() => setDrawerOpen(true)}>
        + Adaugă copil
      </button>
      <Drawer open={drawerOpen} title="Copil nou" onClose={() => setDrawerOpen(false)}>
        <p>Formular (pasul 5 din plan).</p>
      </Drawer>

      <button
        type="button"
        onClick={() => toast.show({ message: '2 achitări arhivate', actionLabel: 'Anulează', onAction: () => {} })}
      >
        Arhivează selectate
      </button>
    </>
  );
}

export function App() {
  const session = useAppSession();
  const [view, setView] = usePersistedState<ViewKey>('nav.view', 'dashboard');
  const [month, setMonth] = useState(() => today().slice(0, 7));

  useEffect(() => {
    // Încărcare o singură dată la montare — sesiunea e un singleton la nivel de modul, nu per componentă.
    session.load().catch(() => {
      // Eroarea e deja în session.state.saveError — SaveStatusCard din sidebar o citește direct.
    });
  }, []);

  return (
    <AppShell view={view} onNavigate={setView} month={month} onMonthChange={setMonth}>
      {renderView(view, month, setView)}
    </AppShell>
  );
}

// Switch, nu un ternar înlănțuit: fiecare ecran are propria formă de props
// (unele au nevoie de month/onNavigate, altele nu), plus e mai ușor de citit
// pe măsură ce se adaugă ecrane noi (pasul 5 continuă).
function renderView(view: ViewKey, month: string, onNavigate: (view: ViewKey) => void) {
  switch (view) {
    case 'dashboard':
      return <DashboardPage month={month} onNavigate={onNavigate} />;
    case 'children':
      return <ChildrenPage month={month} onNavigate={onNavigate} />;
    case 'groups':
      return <GroupsPage />;
    case 'payments':
      return <PaymentsPage />;
    case 'expenses':
      return <ExpensesPage month={month} />;
    case 'status':
      return <StatusPage month={month} />;
    default:
      return <ScaffoldContent />;
  }
}
