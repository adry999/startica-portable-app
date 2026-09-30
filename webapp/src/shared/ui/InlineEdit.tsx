import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import styles from './InlineEdit.module.css';

export interface InlineEditProps {
  value: string;
  onSave: (value: string) => void;
  ariaLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/** Text editabil pe clic — vizualizare → editare la clic/Enter/Space, commit la blur/Enter, revenire la Escape (COMPONENTE.md §0i). */
export function InlineEdit({ value, onSave, ariaLabel, placeholder, disabled, className }: InlineEditProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function startEditing() {
    if (disabled) return;
    setDraft(value);
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed !== value) {
      onSave(trimmed);
    }
  }

  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancel();
    }
  }

  if (disabled) {
    return (
      <span className={className ? `${styles.text} ${className}` : styles.text}>
        {value || <span className={styles.placeholder}>{placeholder}</span>}
      </span>
    );
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={event => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        aria-label={ariaLabel}
        placeholder={placeholder}
        className={className ? `${styles.input} ${className}` : styles.input}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      aria-label={value ? undefined : ariaLabel}
      className={className ? `${styles.trigger} ${className}` : styles.trigger}
    >
      {value || <span className={styles.placeholder}>{placeholder}</span>}
    </button>
  );
}
