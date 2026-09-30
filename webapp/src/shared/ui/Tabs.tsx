import { useRef } from 'react';
import styles from './Tabs.module.css';

export interface TabsOption {
  value: string;
  label: string;
}

export interface TabsProps {
  options: TabsOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
}

/** Navigare între subpagini ale aceluiași ecran (underline static, fără panouri) — vezi SegmentedControl pentru comutator pill. */
export function Tabs({ options, value, onChange, ariaLabel, className }: TabsProps) {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  function focusOption(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    tabRefs.current[option.value]?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusOption((index + 1) % options.length);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusOption((index - 1 + options.length) % options.length);
    }
  }

  return (
    <div
      className={className ? `${styles.tablist} ${className}` : styles.tablist}
      role="tablist"
      aria-label={ariaLabel}
    >
      {options.map((option, index) => (
        <button
          key={option.value}
          ref={element => {
            tabRefs.current[option.value] = element;
          }}
          type="button"
          role="tab"
          id={`tab-${option.value}`}
          aria-selected={option.value === value}
          tabIndex={option.value === value ? 0 : -1}
          className={option.value === value ? `${styles.tab} ${styles.active}` : styles.tab}
          onClick={() => onChange(option.value)}
          onKeyDown={event => handleKeyDown(event, index)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
