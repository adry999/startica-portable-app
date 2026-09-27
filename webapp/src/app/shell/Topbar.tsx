import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BnmRateLink, MonthPicker, useTopbarActionsSlot, useTopbarTitleSlot } from '@shared/ui';
import { useAppSession } from '@shared/api/session';
import { useExchangeRates } from '@shared/api/useExchangeRates';
import { latestKnownRate, latestKnownRateDate } from '#shared/domain/exchange-rates.mjs';
import { formatRate } from '#shared/format/rate-format.mjs';
import { VIEW_TITLES, type ViewKey } from './nav-items';
import { searchRecords, type SearchResult } from './search-records';
import { pathForSearchResult, VIEW_PATHS } from './routes';
import type { RecordsSnapshot } from '@contracts/record-types.mjs';
import styles from './Topbar.module.css';

export interface TopbarProps {
  view: ViewKey;
  month: string;
  onMonthChange: (month: string) => void;
}

/** Antetul paginii — eyebrow+titlu la stânga, acțiuni la dreapta (căutare globală doar pe Dashboard + selector lună). */
export function Topbar({ view, month, onMonthChange }: TopbarProps) {
  const titleOverride = useTopbarTitleSlot();
  const { eyebrow: baseEyebrow, title } = titleOverride ?? VIEW_TITLES[view];
  const pageActions = useTopbarActionsSlot();
  const session = useAppSession();
  // O singură filială (orice instalare imediat după migrare) n-ar trebui să citească
  // „Filiala principală” pe fiecare ecran — eyebrow-ul arată filiala doar cu mai multe (17-filiale.md).
  const eyebrow =
    session.state.branches.length > 1 && session.state.branch
      ? `${baseEyebrow} · Filiala ${session.state.branch.name}`
      : baseEyebrow;
  const navigate = useNavigate();
  const { rates } = useExchangeRates();
  const todaysRate = latestKnownRate(rates);
  const todaysRateDate = latestKnownRateDate(rates);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(
    () => searchRecords(session.state.state as RecordsSnapshot, query),
    [session.state.state, query],
  );
  const childResults = results.filter(r => r.type === 'children');
  const paymentResults = results.filter(r => r.type === 'payments');

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  function select(result: SearchResult) {
    setQuery('');
    setOpen(false);
    navigate(pathForSearchResult(result));
  }

  function goToCursValutar() {
    try {
      localStorage.setItem('view.backup', 'curs');
    } catch {
      // Fila implicită se deschide oricum din Backup și setări.
    }
    navigate(VIEW_PATHS.settings);
  }

  return (
    <header className={styles.topbar}>
      <div>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 className={styles.title}>{title}</h1>
      </div>
      <div className={styles.actions}>
        {view === 'dashboard' && (
          <div className={styles.searchWrap}>
            <label className={styles.search}>
              <input
                ref={inputRef}
                type="search"
                placeholder="Caută copil, părinte, achitare…"
                value={query}
                onChange={event => {
                  setQuery(event.target.value);
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
              />
              <kbd>Ctrl K</kbd>
            </label>
            {open && query.trim() && (
              <div className={styles.searchResults}>
                {results.length === 0 ? (
                  <p className={styles.searchEmpty}>Niciun rezultat.</p>
                ) : (
                  <>
                    {childResults.length > 0 && (
                      <div className={styles.searchGroup}>
                        <p className={styles.searchGroupTitle}>Copii</p>
                        {childResults.map(result => (
                          <button
                            key={result.id}
                            type="button"
                            className={styles.searchResult}
                            onMouseDown={() => select(result)}
                          >
                            <strong>{result.label}</strong>
                            <small>{result.detail}</small>
                          </button>
                        ))}
                      </div>
                    )}
                    {paymentResults.length > 0 && (
                      <div className={styles.searchGroup}>
                        <p className={styles.searchGroupTitle}>Achitări</p>
                        {paymentResults.map(result => (
                          <button
                            key={result.id}
                            type="button"
                            className={styles.searchResult}
                            onMouseDown={() => select(result)}
                          >
                            <strong>{result.label}</strong>
                            <small>{result.detail}</small>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
        {pageActions}
        {view === 'dashboard' && todaysRate != null && (
          <span className={styles.ratePill}>
            <button type="button" className={styles.ratePillMain} onClick={goToCursValutar}>
              <span className={styles.ratePillDot} />1 € = {formatRate(todaysRate)} lei
            </button>
            {todaysRateDate && <BnmRateLink date={todaysRateDate} className={styles.ratePillLink} />}
          </span>
        )}
        {view === 'dashboard' && <MonthPicker value={month} onChange={onMonthChange} />}
      </div>
    </header>
  );
}
