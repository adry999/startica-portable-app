import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAppSession } from '@shared/api/session';
import { useToast } from '@shared/ui';
import { AppShell } from './shell/AppShell';
import { performBranchSwitch, readBranchSwitchNote } from './shell/useBranchSwitch';
import { today } from '@domain/calendar-month.mjs';
import type { ViewKey } from './shell/nav-items';
import { VIEW_PATHS, viewForPathname } from './shell/routes';
import { DashboardPage, useDashboard } from '@features/dashboard';
import { ChildrenPage, BirthdaysPage } from '@features/children';
import { GroupsPage } from '@features/groups';
import { AttendancePage, WeeklySheetPrintPage } from '@features/attendance';
import { VisitsPage } from '@features/visits';
import { PersonalPage, StaffProfilePage } from '@features/personal';
import { PaymentsPage, PaymentReceipt, PaymentReceiptThermal, DayClosingReceipt } from '@features/payments';
import { ExpensesPage } from '@features/expenses';
import { StatusPage } from '@features/status';
import { NotifyPage } from '@features/notify';
import { ReportPage } from '@features/report';
import { FeeSetupPage, useFeeSetup } from '@features/fee-setup';
import { AssignPage } from '@features/assign';
import { ReviewPage } from '@features/review';
import { ConflictsPage } from '@features/conflicts';
import { useSyncStatus } from '@shared/api/useSyncStatus';
import { AuditLogPage } from '@features/audit-log';
import { NotificationsPage } from '@features/notifications';
import { BackupPage } from '@features/backup';
import { StickerPrintPage } from '@features/stickers';

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
  const toast = useToast();
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const view = viewForPathname(location.pathname);

  useEffect(() => {
    // Încărcare o singură dată la montare — sesiunea e un singleton la nivel de modul, nu per componentă.
    session.load().catch(() => {
      // Eroarea e deja în session.state.saveError — SaveStatusCard din sidebar o citește direct.
    });
  }, []);

  useEffect(() => {
    // Biletul e lăsat de performBranchSwitch chiar înainte de reîncărcare (17-filiale.md 13a) —
    // citit o singură dată, aici, ca toast-ul „Acum lucrezi în…” să apară după ce ecranul s-a redeschis.
    const note = readBranchSwitchNote();
    if (!note) return;
    toast.show({
      message: `Acum lucrezi în ${note.to}`,
      actionLabel: note.from ? `Înapoi la ${note.from}` : undefined,
      onAction: note.fromId
        ? () =>
            void performBranchSwitch({ id: note.fromId, name: note.from }, { id: '', name: note.to }, location.pathname)
        : undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const onNavigate = (nextView: ViewKey, params?: Record<string, string>) => {
    const path = VIEW_PATHS[nextView];
    navigate(params ? `${path}?${new URLSearchParams(params).toString()}` : path);
  };

  // Contoarele din sidebar reutilizează exact numerele deja afișate pe Dashboard
  // (attentionItems) și pe Taxe și grupe (missingCount) — nicio logică nouă.
  const dashboard = useDashboard(month);
  const feeSetup = useFeeSetup();
  const syncStatus = useSyncStatus();
  const counts: Partial<Record<ViewKey, number>> = {
    fees: feeSetup.missingCount,
    review: dashboard.attentionItems.find(item => item.view === 'review')?.count ?? 0,
    assign: dashboard.attentionItems.find(item => item.view === 'assign')?.count ?? 0,
    notify: dashboard.attentionItems.find(item => item.view === 'notify')?.count ?? 0,
    visits: dashboard.attentionItems.find(item => item.view === 'visits')?.count ?? 0,
    conflicts: syncStatus.conflicts,
  };

  return (
    <AppShell view={view} onNavigate={onNavigate} month={month} onMonthChange={setMonth} counts={counts}>
      <Routes>
        <Route path="/" element={<DashboardPage month={month} onNavigate={onNavigate} />} />
        <Route path="/copii" element={<ChildrenRoute month={month} onNavigate={onNavigate} />} />
        <Route path="/copii/zile-de-nastere" element={<BirthdaysPage />} />
        <Route path="/copii/:childId" element={<ChildrenRoute month={month} onNavigate={onNavigate} />} />
        <Route
          path="/grupe"
          element={<GroupsPage onOpenGroupStickers={id => navigate(`/tiparire/stickere?grupa=${id}`)} />}
        />
        <Route path="/prezenta" element={<AttendancePage month={month} />} />
        <Route path="/prezenta/foi" element={<WeeklySheetPrintPage />} />
        <Route path="/vizite" element={<VisitsRoute />} />
        <Route path="/personal" element={<PersonalPage month={month} />} />
        <Route path="/personal/:id" element={<StaffProfilePage />} />
        <Route path="/achitari" element={<PaymentsRoute />} />
        <Route path="/achitari/:id/confirmare" element={<PaymentReceipt />} />
        <Route path="/achitari/:id/bon-58mm" element={<PaymentReceiptThermal />} />
        <Route path="/achitari/bon-zi" element={<DayClosingReceipt />} />
        <Route path="/achitari/:paymentId" element={<PaymentsRoute />} />
        <Route path="/cheltuieli" element={<ExpensesPage month={month} />} />
        <Route
          path="/situatia-platilor"
          element={
            <StatusPage
              month={month}
              onMonthChange={setMonth}
              onNavigate={onNavigate}
              onOpenChild={id => navigate(`/copii/${id}`)}
            />
          }
        />
        <Route path="/de-notificat" element={<NotifyPage month={month} onNavigate={onNavigate} />} />
        <Route
          path="/raport"
          element={
            <ReportPage
              month={month}
              onMonthChange={setMonth}
              onOpenPayments={() => navigate('/achitari')}
              onOpenAssign={() => navigate('/asociere-achitari')}
            />
          }
        />
        <Route path="/taxe-si-grupe" element={<FeeSetupPage />} />
        <Route path="/asociere-achitari" element={<AssignPage month={month} />} />
        <Route path="/de-verificat" element={<ReviewPage onNavigate={onNavigate} />} />
        <Route path="/conflicte" element={<ConflictsPage />} />
        <Route path="/istoric" element={<AuditLogPage />} />
        <Route path="/notificari" element={<NotificationsPage />} />
        <Route path="/backup-si-setari" element={<BackupPage />} />
        <Route path="/tiparire/stickere" element={<StickerPrintPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
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

function VisitsRoute() {
  const [searchParams] = useSearchParams();
  return <VisitsPage initialDate={searchParams.get('zi') ?? undefined} />;
}

function PaymentsRoute() {
  const { paymentId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  return (
    <PaymentsPage
      formTargetId={paymentId ?? null}
      initialChildId={searchParams.get('copil') ?? undefined}
      onOpenCreate={() => navigate('/achitari/nou')}
      onOpenEdit={id => navigate(`/achitari/${id}`)}
      onCloseForm={() => navigate('/achitari')}
      onOpenChild={id => navigate(`/copii/${id}`)}
    />
  );
}
