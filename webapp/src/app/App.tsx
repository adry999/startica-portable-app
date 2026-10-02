import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAppSession } from '@shared/api/session';
import { UnsavedChangesDialog, useToast, useUndoToast } from '@shared/ui';
import { AppShell } from './shell/AppShell';
import { ModuleGuard } from './shell/ModuleGuard';
import { performBranchSwitch, readBranchSwitchNote } from './shell/useBranchSwitch';
import { useNavigationGuard } from './shell/useNavigationGuard';
import { today } from '@domain/calendar-month.mjs';
import type { ViewKey } from './shell/nav-items';
import { VIEW_PATHS, viewForPathname } from './shell/routes';
import { DashboardPage, useDashboard } from '@features/dashboard';
import { ChildrenPage, BirthdaysPage } from '@features/children';
import { GroupsPage } from '@features/groups';
import { AttendancePage, WeeklySheetPrintPage } from '@features/attendance';
import { PoolPage, PoolReceiptPage } from '@features/pool';
import { VisitsPage } from '@features/visits';
import { PersonalPage, StaffProfilePage } from '@features/personal';
import {
  PaymentsPage,
  PaymentReceipt,
  PaymentReceiptThermal,
  DayClosingReceipt,
  PaymentFormDrawer,
  usePayments,
  createPaymentUndo,
  paymentUndoDetail,
  type PaymentFormValues,
} from '@features/payments';
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
  // 40c (PROMPT-8 §8.1): un formular nesalvat cere confirmare înainte de a schimba modulul din
  // Sidebar — `onNavigate` brut rămâne disponibil mai sus pentru rutele interne (ex. „+ Plată”
  // din fișa copilului), care nu schimbă de modul.
  const navGuard = useNavigationGuard(view, onNavigate);

  // Contoarele din sidebar reutilizează exact numerele deja afișate pe Dashboard
  // (attentionItems) și pe Taxe și grupe (missingCount) — nicio logică nouă.
  const dashboard = useDashboard(month);
  const feeSetup = useFeeSetup();
  const syncStatus = useSyncStatus();
  const counts: Partial<Record<ViewKey, number>> = {
    fees: feeSetup.missingCount,
    review: Number(dashboard.attentionItems.find(item => item.view === 'review')?.count ?? 0),
    assign: Number(dashboard.attentionItems.find(item => item.view === 'assign')?.count ?? 0),
    notify: Number(dashboard.attentionItems.find(item => item.view === 'notify')?.count ?? 0),
    visits: Number(dashboard.attentionItems.find(item => item.view === 'visits')?.count ?? 0),
    conflicts: syncStatus.conflicts,
  };

  return (
    <AppShell view={view} onNavigate={navGuard.guardedNavigate} month={month} onMonthChange={setMonth} counts={counts}>
      {/* R12 (architecture.test.ts): fiecare <Route> de mai jos are un `element` care începe cu
          <ModuleGuard moduleId="…">, exact modulul din view-modules.ts (VIEW_MODULE) — singura
          excepție admisă e catch-all-ul `*`, care nu randează conținut, doar redirecționează. */}
      <Routes>
        <Route
          path="/"
          element={
            <ModuleGuard moduleId="dashboard">
              <DashboardPage month={month} onNavigate={onNavigate} />
            </ModuleGuard>
          }
        />
        <Route
          path="/copii"
          element={
            <ModuleGuard moduleId="children">
              <ChildrenRoute month={month} onNavigate={onNavigate} />
            </ModuleGuard>
          }
        />
        <Route
          path="/copii/zile-de-nastere"
          element={
            <ModuleGuard moduleId="children">
              <BirthdaysPage />
            </ModuleGuard>
          }
        />
        <Route
          path="/copii/:childId"
          element={
            <ModuleGuard moduleId="children">
              <ChildrenRoute month={month} onNavigate={onNavigate} />
            </ModuleGuard>
          }
        />
        <Route
          path="/grupe"
          element={
            <ModuleGuard moduleId="groups">
              <GroupsPage onOpenGroupStickers={id => navigate(`/tiparire/stickere?grupa=${id}`)} />
            </ModuleGuard>
          }
        />
        <Route
          path="/prezenta"
          element={
            <ModuleGuard moduleId="attendance">
              <AttendancePage month={month} />
            </ModuleGuard>
          }
        />
        <Route
          path="/prezenta/foi"
          element={
            <ModuleGuard moduleId="attendance">
              <WeeklySheetPrintPage />
            </ModuleGuard>
          }
        />
        <Route
          path="/bazin"
          element={
            <ModuleGuard moduleId="pool">
              <PoolPage month={month} />
            </ModuleGuard>
          }
        />
        <Route
          path="/bazin/bon/:childId"
          element={
            <ModuleGuard moduleId="pool">
              <PoolReceiptPage />
            </ModuleGuard>
          }
        />
        <Route
          path="/vizite"
          element={
            <ModuleGuard moduleId="visits">
              <VisitsRoute />
            </ModuleGuard>
          }
        />
        <Route
          path="/personal"
          element={
            <ModuleGuard moduleId="personal">
              <PersonalPage month={month} />
            </ModuleGuard>
          }
        />
        <Route
          path="/personal/:id"
          element={
            <ModuleGuard moduleId="personal">
              <StaffProfilePage />
            </ModuleGuard>
          }
        />
        <Route
          path="/achitari"
          element={
            <ModuleGuard moduleId="payments">
              <PaymentsRoute />
            </ModuleGuard>
          }
        />
        <Route
          path="/achitari/:id/confirmare"
          element={
            <ModuleGuard moduleId="payments">
              <PaymentReceipt />
            </ModuleGuard>
          }
        />
        <Route
          path="/achitari/:id/bon-58mm"
          element={
            <ModuleGuard moduleId="payments">
              <PaymentReceiptThermal />
            </ModuleGuard>
          }
        />
        <Route
          path="/achitari/bon-zi"
          element={
            <ModuleGuard moduleId="payments">
              <DayClosingReceipt />
            </ModuleGuard>
          }
        />
        <Route
          path="/achitari/:paymentId"
          element={
            <ModuleGuard moduleId="payments">
              <PaymentsRoute />
            </ModuleGuard>
          }
        />
        <Route
          path="/cheltuieli"
          element={
            <ModuleGuard moduleId="expenses">
              <ExpensesPage month={month} />
            </ModuleGuard>
          }
        />
        <Route
          path="/situatia-platilor"
          element={
            <ModuleGuard moduleId="status">
              <StatusRoute
                month={month}
                onMonthChange={setMonth}
                onNavigate={onNavigate}
                onOpenChild={id => navigate(`/copii/${id}`)}
              />
            </ModuleGuard>
          }
        />
        <Route
          path="/de-notificat"
          element={
            <ModuleGuard moduleId="notify">
              <NotifyPage month={month} onNavigate={onNavigate} />
            </ModuleGuard>
          }
        />
        <Route
          path="/raport"
          element={
            <ModuleGuard moduleId="report">
              <ReportPage
                month={month}
                onMonthChange={setMonth}
                onOpenPayments={() => navigate('/achitari')}
                onOpenAssign={() => navigate('/asociere-achitari')}
              />
            </ModuleGuard>
          }
        />
        <Route
          path="/taxe-si-grupe"
          element={
            <ModuleGuard moduleId="resolve">
              <FeeSetupPage />
            </ModuleGuard>
          }
        />
        <Route
          path="/asociere-achitari"
          element={
            <ModuleGuard moduleId="resolve">
              <AssignPage month={month} />
            </ModuleGuard>
          }
        />
        <Route
          path="/de-verificat"
          element={
            <ModuleGuard moduleId="resolve">
              <ReviewPage onNavigate={onNavigate} />
            </ModuleGuard>
          }
        />
        <Route
          path="/conflicte"
          element={
            <ModuleGuard moduleId="resolve">
              <ConflictsPage />
            </ModuleGuard>
          }
        />
        <Route
          path="/istoric"
          element={
            <ModuleGuard moduleId="admin">
              <AuditLogPage />
            </ModuleGuard>
          }
        />
        <Route
          path="/notificari"
          element={
            <ModuleGuard moduleId="admin">
              <NotificationsPage />
            </ModuleGuard>
          }
        />
        <Route
          path="/backup-si-setari"
          element={
            <ModuleGuard moduleId="admin">
              <BackupPage />
            </ModuleGuard>
          }
        />
        <Route
          path="/tiparire/stickere"
          element={
            <ModuleGuard moduleId="groups">
              <StickerPrintPage />
            </ModuleGuard>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {navGuard.pending && (
        <UnsavedChangesDialog
          open
          formName={navGuard.formName}
          changedFields={navGuard.pending.form.changedFields}
          onDiscard={navGuard.discardAndNavigate}
          onStay={navGuard.stay}
          onSaveAndContinue={navGuard.saveAndNavigate}
          saving={navGuard.saving}
        />
      )}
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

/** 40a: PaymentFormDrawer randat aici, nu în StatusPage — features/status nu are voie să
 * importe direct din features/payments (granițele dintre module). Copilul salvează direct în
 * sesiunea comună, deci rândul din Situația plăților se reîmprospătează singur (useStatus
 * citește din aceeași sesiune), fără reîncărcarea tabelului sau navigare în altă pagină. */
function StatusRoute({
  month,
  onMonthChange,
  onNavigate,
  onOpenChild,
}: {
  month: string;
  onMonthChange: (month: string) => void;
  onNavigate: (view: ViewKey) => void;
  onOpenChild: (id: string) => void;
}) {
  const toast = useToast();
  const undoToast = useUndoToast();
  const session = useAppSession();
  const paymentsForRow = usePayments();
  const [quickPaymentChildId, setQuickPaymentChildId] = useState<string | null>(null);

  async function submitQuickPayment(values: PaymentFormValues): Promise<boolean> {
    try {
      const { saved, auditIds } = await paymentsForRow.createPayment(values, () =>
        window.confirm(
          'Există o plată cu același copil, aceeași dată, sumă și metodă. Confirmi că este o plată distinctă?',
        ),
      );
      if (saved) {
        setQuickPaymentChildId(null);
        toast.show({ message: 'Achitare adăugată.' });
        // 40b (tiparul de la cheltuială): un UndoToast separat, cu toate auditId-urile (principal +
        // frați, 44b) — ca în PaymentsPage.
        if (auditIds.length > 0) {
          undoToast.show({
            title: 'Achitare adăugată',
            detail: paymentUndoDetail(values, paymentsForRow.records),
            onUndo: createPaymentUndo(auditIds, session.mutate),
          });
        }
      }
      return saved;
    } catch (error) {
      toast.show({ message: (error as Error).message });
      return false;
    }
  }

  return (
    <>
      <StatusPage
        month={month}
        onMonthChange={onMonthChange}
        onNavigate={onNavigate}
        onOpenChild={onOpenChild}
        onOpenPayment={setQuickPaymentChildId}
      />
      <PaymentFormDrawer
        key={quickPaymentChildId ?? 'closed'}
        target={quickPaymentChildId ? 'new' : null}
        records={paymentsForRow.records}
        defaultChildId={quickPaymentChildId ?? undefined}
        defaultCheckArrears
        onSubmit={submitQuickPayment}
        onClose={() => setQuickPaymentChildId(null)}
      />
    </>
  );
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
