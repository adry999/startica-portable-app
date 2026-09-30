import { useState } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';
import { Popover } from './Popover';
import { Spinner } from './Spinner';
import styles from './SplitButton.module.css';

export interface SplitButtonOption {
  value: string;
  label: string;
  onClick: () => void;
}

export interface SplitButtonProps {
  options: SplitButtonOption[];
  /** Cheia opțiunii implicite/ținute minte (apelantul persistă alegerea dacă vrea — SplitButton nu ține minte singur între randări). */
  selectedValue: string;
  onSelectedValueChange: (value: string) => void;
  loading?: boolean;
  className?: string;
}

/** Buton principal cu variante alternative (COMPONENTE.md §0i, 34c) — ▾ deschide lista, ultima variantă e ținută minte. */
export function SplitButton({ options, selectedValue, onSelectedValueChange, loading, className }: SplitButtonProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find(option => option.value === selectedValue) ?? options[0];

  function selectOption(option: SplitButtonOption) {
    onSelectedValueChange(option.value);
    option.onClick();
    setOpen(false);
  }

  const classes = className ? `${styles.root} ${className}` : styles.root;

  return (
    <div className={classes}>
      <Button variant="primary" className={styles.main} loading={loading} onClick={() => selected?.onClick()}>
        {selected?.label}
      </Button>
      <Button
        variant="primary"
        className={styles.toggle}
        disabled={loading}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Alte variante"
        onClick={() => setOpen(current => !current)}
      >
        {loading ? <Spinner size={12} /> : <Icon name="chevron-down" size={16} />}
      </Button>

      {open && !loading && (
        <Popover onClose={() => setOpen(false)} ariaLabel="Alte variante">
          <div className={styles.list}>
            {options.map(option => (
              <button key={option.value} type="button" className={styles.option} onClick={() => selectOption(option)}>
                {option.label}
              </button>
            ))}
          </div>
        </Popover>
      )}
    </div>
  );
}
