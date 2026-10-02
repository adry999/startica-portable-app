import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Kbd, SelectableRow, TextInput } from '@shared/ui';
import { quickPaySearchResults } from './quick-pay-search';
import type { RecordsSnapshot } from '@contracts/record-types.mjs';
import styles from './QuickPaySearch.module.css';

export interface QuickPaySearchProps {
  records: RecordsSnapshot;
  /** Enter pe rândul activ → `PaymentFormDrawer` precompletat cu acest copil (F11, §3.4). */
  onSelect: (childId: string) => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

/**
 * 44a: încasare rapidă din antetul Achitări. Tasta „N" focusează căutarea din orice loc al
 * paginii (ignorată cât timp focusul e deja într-un câmp editabil, ca să nu blocheze scrisul
 * literei „n" în alt formular deschis simultan, ex. un Drawer). Caută după nume, telefon
 * părinte (sufix, §10) sau nr. contract; frații (același telefon de părinte) apar sub copil.
 */
export function QuickPaySearch({ records, onSelect }: QuickPaySearchProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = quickPaySearchResults(records, query);
  const open = query.trim().length > 0;

  useEffect(() => {
    function onWindowKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== 'n' && event.key !== 'N') return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      inputRef.current?.focus();
    }
    window.addEventListener('keydown', onWindowKeyDown);
    return () => window.removeEventListener('keydown', onWindowKeyDown);
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function selectRow(childId: string | undefined) {
    if (!childId) return;
    onSelect(childId);
    setQuery('');
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex(index => Math.min(index + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(index => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      selectRow(results[activeIndex]?.childId);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setQuery('');
    }
  }

  return (
    <div className={styles.root}>
      <TextInput
        value={query}
        onChange={setQuery}
        onKeyDown={onInputKeyDown}
        placeholder="nume, telefon părinte sau nr. contract"
        ariaLabel="Încasare rapidă"
        suffix={<Kbd>N</Kbd>}
        inputRef={inputRef}
      />

      {open && (
        <div className={styles.menu} role="listbox" aria-label="Rezultate încasare rapidă">
          {results.length === 0 ? (
            <p className={styles.empty}>Fără rezultate</p>
          ) : (
            results.map((row, index) => (
              <SelectableRow
                key={row.childId}
                role="option"
                aria-selected={index === activeIndex}
                className={[styles.row, row.isSibling ? styles.siblingRow : ''].filter(Boolean).join(' ')}
                selected={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectRow(row.childId)}
              >
                <span className={styles.nameCell}>
                  <strong>{row.name}</strong>
                  <small className={styles.subtitle}>{row.subtitle}</small>
                </span>
                <span className={row.statusTone === 'overdue' ? styles.statusOverdue : styles.statusOk}>
                  {row.statusLabel}
                </span>
                <span className={styles.currentMonth}>{row.currentMonthLabel}</span>
                <span className={styles.enterSlot}>{index === activeIndex && <Kbd>Enter</Kbd>}</span>
              </SelectableRow>
            ))
          )}
        </div>
      )}
    </div>
  );
}
