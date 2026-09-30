import { useState, type KeyboardEvent } from 'react';
import { Checkbox } from './Checkbox';
import { Icon } from './Icon';
import { Popover } from './Popover';
import styles from './MultiSelect.module.css';

export interface MultiSelectOption {
  value: string;
  label: string;
}

export interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  ariaLabel?: string;
  /** Peste acest număr de chip-uri vizibile, restul se comprimă în "+N" (fără popover la clic pe
   * "+N" în v1). Implicit 3. */
  maxVisibleChips?: number;
  className?: string;
}

/**
 * Selecție multiplă cu chip-uri, peste `Popover` (ca `FilterMenu`) — declanșatorul e o casetă cu
 * chip-urile alese, iar restul opțiunilor apar ca bife într-un panou plutitor. V1 simplificat: fără
 * căutare/spinner și fără acțiune de grup în subsol (COMPONENTE.md §0i/34j le descrie pentru o
 * versiune ulterioară).
 */
export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder,
  ariaLabel,
  maxVisibleChips = 3,
  className,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);

  const selectedOptions = selected
    .map(value => options.find(option => option.value === value))
    .filter((option): option is MultiSelectOption => option !== undefined);
  const visibleChips = selectedOptions.slice(0, maxVisibleChips);
  const hiddenCount = selectedOptions.length - visibleChips.length;
  const remainingOptions = options.filter(option => !selected.includes(option.value));

  function removeChip(value: string) {
    onChange(selected.filter(item => item !== value));
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && selectedOptions.length > 0) {
      event.preventDefault();
      removeChip(selectedOptions[selectedOptions.length - 1].value);
    }
  }

  const classes = className ? `${styles.root} ${className}` : styles.root;

  return (
    <div className={classes}>
      <div className={styles.trigger} onClick={() => setOpen(true)}>
        {visibleChips.map(option => (
          <span key={option.value} className={styles.chip}>
            {option.label}
            <button
              type="button"
              className={styles.chipRemove}
              aria-label={`Elimină ${option.label}`}
              onClick={event => {
                event.stopPropagation();
                removeChip(option.value);
              }}
            >
              <Icon name="close" size={14} />
            </button>
          </span>
        ))}
        {hiddenCount > 0 && <span className={styles.more}>+{hiddenCount}</span>}
        <input
          type="text"
          readOnly
          value=""
          className={styles.input}
          placeholder={selectedOptions.length === 0 ? placeholder : undefined}
          aria-label={ariaLabel}
          onFocus={() => setOpen(true)}
          onKeyDown={handleInputKeyDown}
        />
        <Icon name="chevron-down" size={16} className={styles.chevron} />
      </div>

      {open && (
        <Popover onClose={() => setOpen(false)} ariaLabel={ariaLabel}>
          <div className={styles.list}>
            {remainingOptions.length === 0 && <span className={styles.empty}>Nimic de adăugat</span>}
            {remainingOptions.map(option => (
              <label key={option.value} className={styles.option}>
                <Checkbox
                  checked={false}
                  onChange={() => onChange([...selected, option.value])}
                  ariaLabel={option.label}
                />
                <span className={styles.optionLabel}>{option.label}</span>
              </label>
            ))}
          </div>
        </Popover>
      )}
    </div>
  );
}
