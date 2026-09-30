import { useState } from 'react';
import { Badge } from './Badge';
import { Button } from './Button';
import { Checkbox } from './Checkbox';
import { Popover } from './Popover';
import styles from './FilterMenu.module.css';

export interface FilterMenuOption {
  value: string;
  label: string;
  /** Contor opțional lângă etichetă (ex. „Achitat (12)”); `undefined` = fără contor. */
  count?: number;
}

export interface FilterMenuProps {
  label: string;
  options: FilterMenuOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  /** Contoarele nu au sosit încă — arată schelet în locul lor, opțiunile rămân clicabile. */
  countsLoading?: boolean;
  ariaLabel?: string;
  className?: string;
}

/**
 * Meniu de filtrare peste `Popover` (DS Tabel si filtre.dc.html §27e) — declanșator cu eticheta +
 * numărul de opțiuni selectate, listă de bife cu actualizare imediată (ca `ChipSelect`/`Toggle`,
 * fără buton „Aplică”) și „Șterge filtrele” cât timp e activă cel puțin o selecție.
 */
export function FilterMenu({
  label,
  options,
  selected,
  onChange,
  countsLoading,
  ariaLabel,
  className,
}: FilterMenuProps) {
  const [open, setOpen] = useState(false);

  function toggleValue(value: string) {
    const next = selected.includes(value) ? selected.filter(item => item !== value) : [...selected, value];
    onChange(next);
  }

  const classes = className ? `${styles.root} ${className}` : styles.root;

  return (
    <div className={classes}>
      <Button
        variant="outline"
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(current => !current)}
      >
        {label}
        {selected.length > 0 && <Badge tone="orange">{selected.length}</Badge>}
      </Button>

      {open && (
        <Popover onClose={() => setOpen(false)} ariaLabel={ariaLabel ?? label}>
          <div className={styles.list}>
            {options.map(option => (
              <label key={option.value} className={styles.option}>
                <Checkbox
                  checked={selected.includes(option.value)}
                  onChange={() => toggleValue(option.value)}
                  ariaLabel={option.label}
                />
                <span className={styles.optionLabel}>{option.label}</span>
                {countsLoading ? (
                  <span className={styles.countSkeleton} aria-hidden="true" />
                ) : (
                  option.count !== undefined && <span className={styles.count}>{option.count}</span>
                )}
              </label>
            ))}
          </div>
          {selected.length > 0 && (
            <button type="button" className={styles.reset} onClick={() => onChange([])}>
              Șterge filtrele
            </button>
          )}
        </Popover>
      )}
    </div>
  );
}
