import { useRef, useState, type ReactNode } from 'react';
import { Button } from './Button';
import styles from './FileInput.module.css';

export interface FileInputProps {
  /** URL sau data URL al previzualizării curente (ex. logo salvat). */
  value?: string;
  onSelect: (file: File) => void;
  onClear?: () => void;
  accept?: string;
  ariaLabel: string;
  /** Conținutul din cutie cât timp nu există `value` (ex. inițiala grădiniței). */
  placeholder?: ReactNode;
  changeLabel?: string;
  clearLabel?: string;
  /** Latura cutiei pătrate, în px. */
  size?: number;
  disabled?: boolean;
}

/** Zonă punctată de încărcare fișier (25b, `COMPONENTE.md` §0) — click sau drag & drop, previzualizare pătrată + acțiuni. */
export function FileInput({
  value,
  onSelect,
  onClear,
  accept,
  ariaLabel,
  placeholder,
  changeLabel = 'Schimbă',
  clearLabel = 'Șterge',
  size = 96,
  disabled = false,
}: FileInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function openPicker() {
    if (!disabled) inputRef.current?.click();
  }

  function pick(files: FileList | null) {
    const file = files?.[0];
    if (file) onSelect(file);
  }

  return (
    <div className={styles.row}>
      <button
        type="button"
        className={dragOver ? `${styles.box} ${styles.dragOver}` : styles.box}
        style={{ width: size, height: size }}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={openPicker}
        onDragOver={event => {
          if (disabled) return;
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={event => {
          event.preventDefault();
          setDragOver(false);
          if (!disabled) pick(event.dataTransfer.files);
        }}
      >
        {value ? <img src={value} alt="" /> : placeholder}
      </button>
      <div className={styles.actions}>
        <Button type="button" variant="outline" onClick={openPicker} disabled={disabled}>
          {changeLabel}
        </Button>
        {value && onClear && (
          <Button type="button" variant="danger" onClick={onClear} disabled={disabled}>
            {clearLabel}
          </Button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          hidden
          disabled={disabled}
          onChange={event => {
            pick(event.target.files);
            event.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
