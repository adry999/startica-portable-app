import type { ReactNode } from 'react';
import { useAppSession } from '@shared/api/session';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { deriveSaveStatus } from './save-status';
import type { ViewKey } from './nav-items';
import type { SearchResult } from './search-records';
import styles from './AppShell.module.css';

export interface AppShellProps {
  view: ViewKey;
  onNavigate: (view: ViewKey) => void;
  month: string;
  onMonthChange: (month: string) => void;
  onSelectSearchResult: (result: SearchResult) => void;
  /** Contoarele din sidebar (taxe, verificat, asociere, notificat, vizite) — vin din ecranele reale, pasul 5. */
  counts?: Partial<Record<ViewKey, number>>;
  children: ReactNode;
}

/** Compune Sidebar + Topbar + zona de conținut. Citește sesiunea o dată, aici — ecranele (pasul 5) o citesc separat. */
export function AppShell({
  view,
  onNavigate,
  month,
  onMonthChange,
  onSelectSearchResult,
  counts = {},
  children,
}: AppShellProps) {
  const session = useAppSession();
  const saveStatus = deriveSaveStatus(session.state);

  return (
    <div className={styles.shell}>
      <Sidebar
        activeView={view}
        onNavigate={onNavigate}
        counts={counts}
        version={session.state.version}
        saveStatus={{ ...saveStatus, onRetry: () => void session.load() }}
      />
      <div className={styles.workspace}>
        <Topbar view={view} month={month} onMonthChange={onMonthChange} onSelectResult={onSelectSearchResult} />
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
