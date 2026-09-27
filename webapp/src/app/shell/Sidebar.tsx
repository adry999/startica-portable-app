import { Badge } from '@shared/ui';
import { NAV_GROUPS, type ViewKey } from './nav-items';
import { SaveStatusCard, type SaveStatusCardProps } from './SaveStatusCard';
import { BranchSelector, type BranchSelectorBranch } from './BranchSelector';
import styles from './Sidebar.module.css';

export interface SidebarProps {
  activeView: ViewKey;
  onNavigate: (view: ViewKey) => void;
  /** Contor per ecran (taxe, verificat, asociere, notificat, vizite) — 0 nu se afișează. */
  counts: Partial<Record<ViewKey, number>>;
  version: string;
  saveStatus: SaveStatusCardProps;
  /** Filiala curentă — null înainte ca sesiunea să răspundă; selectorul nu se randează atunci. */
  branch?: BranchSelectorBranch | null;
  branches?: BranchSelectorBranch[];
  onSwitchBranch?: (branchId: string) => void;
  onManageBranches?: () => void;
}

/** Meniul lateral, varianta „a" (albă) — vezi README-ul redesign-ului, secțiunea Sidebar. */
export function Sidebar({
  activeView,
  onNavigate,
  counts,
  version,
  saveStatus,
  branch,
  branches,
  onSwitchBranch,
  onManageBranches,
}: SidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <img src="/assets/startica-logo.svg" alt="Startica" className={styles.logo} />
      </div>

      {branch && (
        <div className={styles.branchSlot}>
          <BranchSelector
            branch={branch}
            branches={branches?.length ? branches : [branch]}
            onSwitch={onSwitchBranch ?? (() => {})}
            onManage={onManageBranches ?? (() => {})}
          />
        </div>
      )}

      <nav className={styles.nav}>
        {NAV_GROUPS.map(group => (
          <div key={group.title ?? 'primary'} className={styles.navGroup}>
            {group.title && <p className={styles.navGroupTitle}>{group.title}</p>}
            {group.items.map(item => {
              const count = counts[item.view];
              const active = item.view === activeView;
              return (
                <button
                  key={item.view}
                  type="button"
                  className={active ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => onNavigate(item.view)}
                >
                  <span className={`${styles.marker} ${styles[group.marker]}`} aria-hidden="true" />
                  <span className={styles.navLabel}>{item.label}</span>
                  {!!count && <Badge tone="pink">{count}</Badge>}
                  {/* Versiunea nu mai stă lângă logo (17-filiale.md 13a) — apare doar aici. */}
                  {item.view === 'settings' && <small className={styles.navVersion}>{version}</small>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <SaveStatusCard {...saveStatus} />
    </aside>
  );
}
