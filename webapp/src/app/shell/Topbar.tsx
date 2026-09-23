import { MonthPicker } from '@shared/ui';
import { VIEW_TITLES, type ViewKey } from './nav-items';
import styles from './Topbar.module.css';

export interface TopbarProps {
  view: ViewKey;
  month: string;
  onMonthChange: (month: string) => void;
}

/** Antetul paginii — eyebrow+titlu la stânga, acțiuni la dreapta (căutare globală doar pe Dashboard + selector lună). */
export function Topbar({ view, month, onMonthChange }: TopbarProps) {
  const { eyebrow, title } = VIEW_TITLES[view];

  return (
    <header className={styles.topbar}>
      <div>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 className={styles.title}>{title}</h1>
      </div>
      <div className={styles.actions}>
        {view === 'dashboard' && (
          <label className={styles.search}>
            <input type="search" placeholder="Caută copil, părinte, achitare…" />
            <kbd>Ctrl K</kbd>
          </label>
        )}
        <MonthPicker value={month} onChange={onMonthChange} />
      </div>
    </header>
  );
}
