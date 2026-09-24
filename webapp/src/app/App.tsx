import { useEffect, useState } from 'react';
import { Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { total } from '@domain/money.mjs';
import { Badge, Card, DataTable, Drawer, SegmentedControl, useToast, type DataTableColumn } from '@shared/ui';
import { usePersistedState } from '@shared/state/usePersistedState';
import { useAppSession } from '@shared/api/session';
import { AppShell } from './shell/AppShell';
import { today } from '@domain/calendar-month.mjs';
import type { ViewKey } from './shell/nav-items';
import { VIEW_PATHS, viewForPathname } from './shell/routes';
import { DashboardPage } from '@features/dashboard';
import { ChildrenPage } from '@features/children';
import { GroupsPage } from '@features/groups';
import { PaymentsPage } from '@features/payments';
import { ExpensesPage } from '@features/expenses';
import { StatusPage } from '@features/status';
import { NotifyPage } from '@features/notify';
import { FeeSetupPage } from '@features/fee-setup';
import { AssignPage } from '@features/assign';
import { ReviewPage } from '@features/review';
import { AuditLogPage } from '@features/audit-log';
import { NotificationsPage } from '@features/notifications';
import { BackupPage } from '@features/backup';

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

const LAST_VIEW_KEY = 'nav.view';

function readLastView(): ViewKey | null {
  try {
    return localStorage.getItem(LAST_VIEW_KEY) as ViewKey | null;
  } catch {
    return null;
  }
}

function writeLastView(view: ViewKey) {
  try {
    localStorage.setItem(LAST_VIEW_KEY, view);
  } catch {
    // Stocare indisponibilă — se pierde doar comoditatea de a reveni la ultimul modul.
  }
}

export function App() {
  const session = useAppSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const view = viewForPathname(location.pathname);

  useEffect(() => {
    // Încărcare o singură dată la montare — sesiunea e un singleton la nivel de modul, nu per componentă.
    session.load().catch(() => {
      // Eroarea e deja în session.state.saveError — SaveStatusCard din sidebar o citește direct.
    });
  }, []);

  useEffect(() => {
    // Lansarea aplicației deschide mereu '/' — redirecționăm o singură dată spre ultimul modul vizitat,
    // ca să păstrăm comoditatea din varianta cu stare persistată, fără să reținem și o fișă/formular anume.
    if (location.pathname !== '/') return;
    const lastView = readLastView();
    if (lastView && lastView !== 'dashboard' && VIEW_PATHS[lastView]) navigate(VIEW_PATHS[lastView], { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => writeLastView(view), [view]);

  const onNavigate = (nextView: ViewKey) => navigate(VIEW_PATHS[nextView]);

  return (
    <AppShell view={view} onNavigate={onNavigate} month={month} onMonthChange={setMonth}>
      <Routes>
        <Route path="/" element={<DashboardPage month={month} onNavigate={onNavigate} />} />
        <Route path="/copii" element={<ChildrenRoute month={month} onNavigate={onNavigate} />} />
        <Route path="/copii/:childId" element={<ChildrenRoute month={month} onNavigate={onNavigate} />} />
        <Route path="/grupe" element={<GroupsPage />} />
        <Route path="/achitari" element={<PaymentsRoute />} />
        <Route path="/achitari/:paymentId" element={<PaymentsRoute />} />
        <Route path="/cheltuieli" element={<ExpensesPage month={month} />} />
        <Route path="/situatia-platilor" element={<StatusPage month={month} />} />
        <Route path="/de-notificat" element={<NotifyPage month={month} onNavigate={onNavigate} />} />
        <Route path="/taxe-si-grupe" element={<FeeSetupPage />} />
        <Route path="/asociere-achitari" element={<AssignPage month={month} />} />
        <Route path="/de-verificat" element={<ReviewPage onNavigate={onNavigate} />} />
        <Route path="/istoric" element={<AuditLogPage />} />
        <Route path="/notificari" element={<NotificationsPage />} />
        <Route path="/backup-si-setari" element={<BackupPage />} />
        <Route path="*" element={<ScaffoldContent />} />
      </Routes>
    </AppShell>
  );
}

function ChildrenRoute({ month, onNavigate }: { month: string; onNavigate: (view: ViewKey) => void }) {
  const { childId } = useParams();
  const navigate = useNavigate();
  return (
    <ChildrenPage
      month={month}
      onNavigate={onNavigate}
      childId={childId ?? null}
      onOpenChild={id => navigate(`/copii/${id}`)}
      onCloseChild={() => navigate('/copii')}
    />
  );
}

function PaymentsRoute() {
  const { paymentId } = useParams();
  const navigate = useNavigate();
  return (
    <PaymentsPage
      formTargetId={paymentId ?? null}
      onOpenCreate={() => navigate('/achitari/nou')}
      onOpenEdit={id => navigate(`/achitari/${id}`)}
      onCloseForm={() => navigate('/achitari')}
      onOpenChild={id => navigate(`/copii/${id}`)}
    />
  );
}
