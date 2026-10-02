import { Badge, ScrollArea } from '@shared/ui';
import { completProfile, isModuleAllowed } from '#shared/domain/computer-profile.mjs';
import { NAV_GROUPS, type ViewKey } from './nav-items';
import { SaveStatusCard, type SaveStatusCardProps } from './SaveStatusCard';
import { SyncStatusCard, type SyncStatusCardProps } from './SyncStatusCard';
import { BranchSelector, type BranchSelectorBranch } from './BranchSelector';
import { VIEW_MODULE } from './view-modules';
import styles from './Sidebar.module.css';

export interface SidebarProps {
  activeView: ViewKey;
  onNavigate: (view: ViewKey) => void;
  /** Contor per ecran (taxe, verificat, asociere, notificat, vizite) — 0 nu se afișează. */
  counts: Partial<Record<ViewKey, number>>;
  version: string;
  saveStatus: SaveStatusCardProps;
  /** Prezent doar când sincronizarea e configurată și nicio eroare locală nu are întâietate (18-sincronizare.md §14a) — înlocuiește saveStatus. */
  syncStatus?: SyncStatusCardProps;
  /** Filiala curentă — null înainte ca sesiunea să răspundă; selectorul nu se randează atunci. */
  branch?: BranchSelectorBranch | null;
  branches?: BranchSelectorBranch[];
  onSwitchBranch?: (branchId: string) => void;
  onManageBranches?: () => void;
  /** Bazin (23, decizia 10): rândul dispare cât timp filiala activă nu l-a configurat. */
  poolEnabled?: boolean;
  /** §5.3 (36d): profilul calculatorului — rândurile fără acces de citire dispar, la fel și
   * grupele de meniu rămase fără niciun rând vizibil. Implicit Complet (nicio restricție). */
  profile?: import('#shared/domain/computer-profile.mjs').ComputerProfile;
}

/** Meniul lateral, varianta „a" (albă) — vezi README-ul redesign-ului, secțiunea Sidebar. */
export function Sidebar({
  activeView,
  onNavigate,
  counts,
  version,
  saveStatus,
  syncStatus,
  branch,
  branches,
  onSwitchBranch,
  onManageBranches,
  poolEnabled = false,
  profile = completProfile(),
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

      <ScrollArea className={styles.nav}>
        <nav className={styles.navList}>
          {NAV_GROUPS.map(group => {
            // §5.3 (36d): un rând fără acces de citire pe profilul curent dispare din meniu —
            // o grupă rămasă fără niciun rând vizibil dispare cu tot cu titlu (ex. Educator nu
            // are niciun rând din „Contabilitate”).
            const visibleItems = group.items.filter(item => isModuleAllowed(profile, VIEW_MODULE[item.view]));
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.title ?? 'primary'} className={styles.navGroup}>
                {group.title && <p className={styles.navGroupTitle}>{group.title}</p>}
                {visibleItems.map(item => {
                  const count = counts[item.view];
                  // „Conflicte” e singurul rând care dispare la 0, nu doar fără insignă
                  // (18-sincronizare.md §14c) — restul rândurilor din De rezolvat rămân vizibile.
                  if (item.view === 'conflicts' && !count) return null;
                  if (item.view === 'pool' && !poolEnabled) return null;
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
            );
          })}
        </nav>
      </ScrollArea>

      {syncStatus ? <SyncStatusCard {...syncStatus} /> : <SaveStatusCard {...saveStatus} />}
    </aside>
  );
}
