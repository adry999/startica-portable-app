import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon, MonthPicker, ScrollArea, useTopbarActionsSlot, useTopbarTitleSlot } from '@shared/ui';
import { useAppSession } from '@shared/api/session';
import { useExchangeRates } from '@shared/api/useExchangeRates';
import { BNM_HOME_URL, latestKnownRate, latestKnownRateDate } from '#shared/domain/exchange-rates.mjs';
import { formatRate } from '#shared/format/rate-format.mjs';
import { formatDate } from '#shared/format/date-format.mjs';
import { VIEW_TITLES, type ViewKey } from './nav-items';
import { searchRecords, type SearchResult } from './search-records';
import { pathForSearchResult } from './routes';
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
  const eyebrow = baseEyebrow;
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
  const expenseResults = results.filter(r => r.type === 'expenses');

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

  const isRateFromToday = todaysRateDate === new Date().toISOString().slice(0, 10);
  const ratePillCaption = `Curs BNM · ${isRateFromToday ? 'azi' : formatDate(todaysRateDate)}`;

  return (
    <header className={styles.topbar}>
      <div className={styles.heading}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.eyebrow}>{eyebrow}</p>
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
              <ScrollArea className={styles.searchResults}>
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
                    {expenseResults.length > 0 && (
                      <div className={styles.searchGroup}>
                        <p className={styles.searchGroupTitle}>Cheltuieli</p>
                        {expenseResults.map(result => (
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
              </ScrollArea>
            )}
          </div>
        )}
        {pageActions}
        {view === 'dashboard' && todaysRate != null && (
          <a
            className={styles.ratePill}
            href={BNM_HOME_URL}
            target="_blank"
            rel="noopener noreferrer"
            title={`Verifică pe bnm.md — ${ratePillCaption}`}
          >
            <span className={styles.ratePillDot} aria-hidden="true">
              €
            </span>
            <span className={styles.ratePillText}>
              <strong className={styles.ratePillRate}>{formatRate(todaysRate)} lei</strong>
              <small className={styles.ratePillCaption}>{ratePillCaption}</small>
            </span>
            <span className={styles.ratePillArrow}>
              <Icon name="external-link" size={14} />
            </span>
          </a>
        )}
        {view === 'dashboard' && <MonthPicker value={month} onChange={onMonthChange} />}
      </div>
    </header>
  );
}
