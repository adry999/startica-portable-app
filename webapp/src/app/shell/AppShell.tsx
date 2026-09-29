import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSession } from '@shared/api/session';
import { useSyncStatus } from '@shared/api/useSyncStatus';
import { TopbarActionsProvider } from '@shared/ui';
import { Sidebar } from './Sidebar';
import { StartupScreen } from './StartupScreen';
import { Topbar } from './Topbar';
import { BranchSwitchOverlay } from './BranchSwitchOverlay';
import { BranchSwitchDialog } from './BranchSwitchDialog';
import { useBranchSwitch } from './useBranchSwitch';
import { deriveSaveStatus } from './save-status';
import { deriveSyncStatus } from './sync-status';
import { VIEW_PATHS } from './routes';
import type { ViewKey } from './nav-items';
import styles from './AppShell.module.css';

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
  // Hook-urile rulează necondiționat, înainte de întoarcerea din ecranul de pornire de mai jos.
  const branchSwitch = useBranchSwitch();
  const syncStatusData = useSyncStatus();
  // Cât timp sesiunea nu are încă snapshot-ul (ready), nu are rost meniul sau antetul —
  // ecranul de pornire (21a) ia locul întregului shell, nu doar al conținutului.
  if (!session.state.ready) return <StartupScreen />;
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

  return (
    <TopbarActionsProvider>
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
            <Topbar view={view} month={month} onMonthChange={onMonthChange} />
            <main className={styles.content}>{children}</main>
          </div>
          {branchSwitch.switching && <BranchSwitchOverlay toName={branchSwitch.switching.toName} />}
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
