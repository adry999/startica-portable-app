import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import styles from './SearchSelect.module.css';

export interface SearchSelectOption {
  value: string;
  label: string;
}

export interface SearchSelectProps {
  options: readonly SearchSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyLabel?: string;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}

interface MenuRect {
  top: number;
  left: number;
  width: number;
}

/**
 * Select cu căutare (combobox) — pentru liste lungi, ex. „Alege un copil" din Grupe.
 * Meniul e portat în document.body și poziționat cu position:fixed, ca să nu fie tăiat
 * de overflow:hidden al Card-ului (vezi Card.module.css) în care e de obicei folosit.
 */
export function SearchSelect({
  options,
  value,
  onChange,
  placeholder = 'Caută…',
  emptyLabel = 'Niciun rezultat',
  ariaLabel,
  disabled,
  className,
}: SearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuRect, setMenuRect] = useState<MenuRect | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find(option => option.value === value) ?? null;

  function updateMenuRect() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setMenuRect({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  }

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    updateMenuRect();
    function onScrollOrResize() {
      updateMenuRect();
    }
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDocumentClick(event: MouseEvent) {
      if (!(event.target instanceof Node)) return;
      if (rootRef.current?.contains(event.target)) return;
      if (menuRef.current?.contains(event.target)) return;
      setOpen(false);
    }
    function onDocumentKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('click', onDocumentClick);
    document.addEventListener('keydown', onDocumentKeyDown);
    return () => {
      document.removeEventListener('click', onDocumentClick);
      document.removeEventListener('keydown', onDocumentKeyDown);
    };
  }, [open]);

  const normalizedQuery = query.trim().toLocaleLowerCase('ro-RO');
  const filtered = normalizedQuery
    ? options.filter(option => option.label.toLocaleLowerCase('ro-RO').includes(normalizedQuery))
    : options;

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  function pick(optionValue: string) {
    onChange(optionValue);
    setOpen(false);
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex(index => Math.min(index + 1, filtered.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(index => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = filtered[activeIndex];
      if (option) pick(option.value);
    }
  }

  return (
    <div className={className ? `${styles.root} ${className}` : styles.root} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => {
          setOpen(current => !current);
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
      >
        {selected ? selected.label : <span className={styles.placeholder}>{placeholder}</span>}
        <span className={styles.caret} aria-hidden="true">
          ▾
        </span>
      </button>

      {open &&
        menuRect &&
        createPortal(
          <div
            ref={menuRef}
            className={styles.menu}
            role="dialog"
            aria-label={ariaLabel}
            style={{ top: menuRect.top, left: menuRect.left, width: menuRect.width }}
          >
            <input
              ref={inputRef}
              className={styles.search}
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Caută…"
              aria-label={`Caută în ${ariaLabel}`}
              autoFocus
            />
            <div className={styles.options} role="listbox" aria-label={ariaLabel}>
              {filtered.length === 0 && <p className={styles.empty}>{emptyLabel}</p>}
              {filtered.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  className={index === activeIndex ? `${styles.option} ${styles.optionActive}` : styles.option}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => pick(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
