import { useState } from 'react';
import { Icon } from './Icon';
import { Popover } from './Popover';
import styles from './BranchSelector.module.css';

export interface BranchOption {
  key: string;
  name: string;
}

export interface BranchSelectorProps {
  branches: BranchOption[];
  selectedKey: string;
  onChange: (key: string) => void;
  className?: string;
}

/** Comutator de filială din antet (32b) — buton declanșator + listă în `Popover`. */
export function BranchSelector({ branches, selectedKey, onChange, className }: BranchSelectorProps) {
  const [open, setOpen] = useState(false);
  const selected = branches.find(branch => branch.key === selectedKey) ?? null;

  const classes = className ? `${styles.root} ${className}` : styles.root;

  return (
    <div className={classes}>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(current => !current)}
      >
        {selected ? selected.name : 'Alege filiala'}
        <Icon name="chevron-down" size={14} />
      </button>

      {open && (
        <Popover onClose={() => setOpen(false)} ariaLabel="Filiale">
          <ul className={styles.list}>
            {branches.map(branch => (
              <li key={branch.key}>
                <button
                  type="button"
                  className={branch.key === selectedKey ? `${styles.option} ${styles.selected}` : styles.option}
                  aria-current={branch.key === selectedKey ? 'true' : undefined}
                  onClick={() => {
                    onChange(branch.key);
                    setOpen(false);
                  }}
                >
                  {branch.name}
                </button>
              </li>
            ))}
          </ul>
        </Popover>
      )}
    </div>
  );
}
