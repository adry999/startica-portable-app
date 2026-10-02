import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSession } from '@shared/api/session';
import { useSyncStatus } from '@shared/api/useSyncStatus';
import { AppBanner, TopbarActionsProvider, useToast } from '@shared/ui';
import { usePersistedState } from '@shared/state/usePersistedState';
import { readRestoreDoneNote } from '@features/backup';
import { formatDateTime } from '#shared/format/date-format.mjs';
import { Sidebar } from './Sidebar';
import { StartupScreen } from './StartupScreen';
import { StartSourceFlow } from './StartSourceFlow';
import { Topbar } from './Topbar';
import { BranchSwitchOverlay } from './BranchSwitchOverlay';
import { BranchSwitchDialog } from './BranchSwitchDialog';
import { useBranchSwitch } from './useBranchSwitch';
import { deriveSaveStatus } from './save-status';
import { deriveSyncStatus } from './sync-status';
import { deriveSyncBanner } from './sync-banner';
import { UPDATE_DISMISS_KEY, dismissUpdateValue, shouldShowUpdateBanner } from './update-banner';
import { VIEW_PATHS } from './routes';
import type { ViewKey } from './nav-items';
import styles from './AppShell.module.css';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// 46a: cheia de persistență a alegerii de pe StartSourceFlow — setată o dată, niciodată ștearsă
// automat (un calculator rămâne „pornit” chiar dacă filiala activă nu capătă date imediat).
// usePersistedState e doar pentru valori string; aici valoarea e un bool, deci citire/scriere
// directă, la fel ca readLastView/writeLastView din App.tsx.
const FIRST_RUN_DISMISSED_KEY = 'firstRun.dismissed';

function readFirstRunDismissed(): boolean {
  try {
    return localStorage.getItem(FIRST_RUN_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeFirstRunDismissed() {
  try {
    localStorage.setItem(FIRST_RUN_DISMISSED_KEY, '1');
  } catch {
    // Ecranul ar putea reapărea la următoarea pornire — nu blochează alegerea curentă.
  }
}

export interface AppShellProps {
  view: ViewKey;
  onNavigate: (view: ViewKey) => void;
  month: string;
  onMonthChange: (month: string) => void;
  /** Contoarele din sidebar (taxe, verificat, asociere, notificat, vizite) — vin din ecranele reale. */
  counts?: Partial<Record<ViewKey, number>>;
  children: ReactNode;
}

/** Compune Sidebar + Topbar + zona de conținut. Citește sesiunea o dată, aici — ecranele o citesc separat. */
export function AppShell({ view, onNavigate, month, onMonthChange, counts = {}, children }: AppShellProps) {
  const session = useAppSession();
  const navigate = useNavigate();
  const toast = useToast();
  // Hook-urile rulează necondiționat, înainte de întoarcerea din ecranul de pornire de mai jos.
  const branchSwitch = useBranchSwitch();
  const syncStatusData = useSyncStatus();
  // §11, 42b: „revine a doua zi” — valoarea persistă cât bara mint a fost închisă ultima dată
  // (dată + versiune respinsă), citită înainte de orice return condiționat (regula hook-urilor).
  const [updateDismissedUntil, setUpdateDismissedUntil] = usePersistedState<string>(UPDATE_DISMISS_KEY, '');
  // 46a: odată aleasă „De la zero” sau „Am Startica pe alt calculator”, ecranul nu mai revine
  // pe acest calculator, chiar dacă filiala activă rămâne fără nicio evidență reală încă
  // (nu s-a importat nimic, sau sincronizarea n-a adus încă prima bază).
  const [firstRunDismissed, setFirstRunDismissedState] = useState(readFirstRunDismissed);
  function setFirstRunDismissed(value: boolean) {
    setFirstRunDismissedState(value);
    if (value) writeFirstRunDismissed();
  }
  useEffect(() => {
    // 46d: biletul e lăsat chiar înainte de reîncărcarea completă de după o restaurare —
    // citit o singură dată, aici, ca toast-ul de confirmare să apară după ce ecranul s-a redeschis.
    const note = readRestoreDoneNote();
    if (!note) return;
    toast.show({
      message: note.createdAt
        ? `Date restaurate din arhiva din ${formatDateTime(note.createdAt)}.`
        : 'Date restaurate.',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Cât timp sesiunea nu are încă snapshot-ul (ready), nu are rost meniul sau antetul —
  // ecranul de pornire (21a) ia locul întregului shell, nu doar al conținutului.
  // `forceReady` (21c, „Lucrez fără legătură”) lasă utilizatorul să treacă mai departe cât
  // timp load() continuă în fundal — ecranele își au deja propriul gol pentru „fără date încă”.
  if (!session.state.ready && !session.state.forceReady) return <StartupScreen />;
  // 46a: un calculator genuin gol (nicio evidență reală pe filiala activă) vede alegerea
  // Backup/Sincronizare/De la zero în loc de restul aplicației, până una dintre cele trei e aleasă.
  if (!session.state.hasAnyData && !firstRunDismissed)
    return <StartSourceFlow onDismiss={() => setFirstRunDismissed(true)} onConnectElsewhere={goToSyncTabFirstRun} />;
  const saveStatus = deriveSaveStatus(session.state);
  // Cardul de sincronizare (14a) înlocuiește „Salvat · ora” doar când e configurat și
  // fără eroare locală (deriveSyncStatus întoarce null în acel caz — Sidebar arată saveStatus).
  const syncCard = session.state.sync?.configured ? deriveSyncStatus(syncStatusData, session.state) : null;
  const syncStatus = syncCard
    ? {
        ...syncCard,
        // „Click pe card deschide 14b” (spec §14a) — valabil indiferent de stare; acțiunea
        // specifică (Rezolvă / Reconectează) rămâne un target separat, mai precis.
        onCardClick: goToSyncTab,
        onAction:
          syncCard.mode === 'conflict'
            ? () => navigate('/conflicte')
            : syncCard.mode === 'revoked'
              ? goToSyncTab
              : undefined,
      }
    : undefined;
  // Pastila din antet (§11, 42a/42b) — același mod+etichetă ca syncCard de mai sus (sidebar),
  // doar randată compact; click deschide fila Sincronizare, ca și cardul.
  const syncPill = syncCard ? { mode: syncCard.mode, label: syncCard.label, onClick: goToSyncTab } : undefined;

  // §11, 42a — bandă roz, deasupra antetului, pe toate rutele, fără ×: apare doar cât
  // sincronizarea e configurată și chiar nu merge (offline/revoked), nu la conflict/syncing
  // (vezi `deriveSyncBanner`). Întâietate asupra benzii mint de mai jos (o singură bandă deodată).
  const syncBanner = session.state.sync?.configured ? deriveSyncBanner(syncStatusData) : null;

  // §11, 42b — bandă mint, se închide cu × și revine a doua zi (sau mai devreme, dacă apare o
  // versiune și mai nouă — vezi `shouldShowUpdateBanner`). Nu se arată deodată cu banda roz.
  const update = session.state.update;
  const today = todayIso();
  const showUpdateBanner =
    !syncBanner && update.updateAvailable && shouldShowUpdateBanner(updateDismissedUntil, update.latestVersion, today);
  const updateLink = update.releaseUrl ?? update.downloadUrl;

  // Fila implicită se alege din localStorage, citită de BackupPage la montare
  // (usePersistedState('view.backup', …)).
  function goToBranchesTab() {
    try {
      localStorage.setItem('view.backup', 'branches');
    } catch {
      // Fila implicită se deschide oricum din Backup și setări.
    }
    navigate(VIEW_PATHS.settings);
  }

  // Aceeași idee ca goToBranchesTab — fila Sincronizare (14b, Task 12) citește tot din
  // localStorage la montare; până e construită, deschide oricum Backup și setări.
  function goToSyncTab() {
    try {
      localStorage.setItem('view.backup', 'sync');
    } catch {
      // Fila implicită se deschide oricum din Backup și setări.
    }
    navigate(VIEW_PATHS.settings);
  }

  // 46a: „Am Startica pe alt calculator” de pe StartSourceFlow — dismisul e obligatoriu
  // (altfel ecranul de prima pornire ar acoperi fila Sincronizare la care tocmai a navigat).
  function goToSyncTabFirstRun() {
    setFirstRunDismissed(true);
    goToSyncTab();
  }

  return (
    <TopbarActionsProvider>
      <div className={styles.root}>
        {syncBanner && (
          <div className={styles.banners}>
            <AppBanner
              tone="error"
              message={syncBanner.message}
              action={syncBanner.actionLabel ? { label: syncBanner.actionLabel, onClick: goToSyncTab } : undefined}
            />
          </div>
        )}
        {showUpdateBanner && (
          <div className={styles.banners}>
            <AppBanner
              tone="update"
              message={`Startica ${update.latestVersion} e gata de descărcat.`}
              action={
                updateLink
                  ? { label: 'Ce e nou', onClick: () => window.open(updateLink, '_blank', 'noopener') }
                  : undefined
              }
              onDismiss={() => setUpdateDismissedUntil(dismissUpdateValue(update.latestVersion, today))}
            />
          </div>
        )}
        <div className={styles.shell}>
          <Sidebar
            activeView={view}
            onNavigate={onNavigate}
            counts={counts}
            version={session.state.version}
            saveStatus={{ ...saveStatus, onRetry: () => void session.load() }}
            syncStatus={syncStatus}
            branch={session.state.branch}
            branches={session.state.branches}
            onSwitchBranch={branchSwitch.requestSwitch}
            onManageBranches={goToBranchesTab}
            poolEnabled={!!session.state.pool?.enabled}
          />
          <div className={styles.workspace}>
            <div
              className={
                branchSwitch.switching ? `${styles.workspaceInner} ${styles.workspaceDimmed}` : styles.workspaceInner
              }
            >
              <Topbar view={view} month={month} onMonthChange={onMonthChange} syncStatus={syncPill} />
              <main className={styles.content}>{children}</main>
            </div>
            {branchSwitch.switching && <BranchSwitchOverlay toName={branchSwitch.switching.toName} />}
          </div>
        </div>
      </div>
      {branchSwitch.dialog && (
        <BranchSwitchDialog
          form={branchSwitch.dialog.form}
          fromName={branchSwitch.dialog.fromName}
          toName={branchSwitch.dialog.toName}
          onStay={branchSwitch.stay}
          onDiscard={branchSwitch.discardAndSwitch}
          onSave={branchSwitch.saveAndSwitch}
        />
      )}
    </TopbarActionsProvider>
  );
}
