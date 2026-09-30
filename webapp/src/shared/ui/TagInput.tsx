import { useState, type KeyboardEvent } from 'react';
import { Icon } from './Icon';
import styles from './TagInput.module.css';

export interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}

/**
 * Taguri libere introduse de utilizator (COMPONENTE.md §0g/32g, ex. lista de alergii) — spre
 * deosebire de `MultiSelect`, care alege dintr-o listă fixă, `TagInput` creează șiruri noi.
 * Enter sau virgulă confirmă tag-ul curent; Backspace pe câmpul gol elimină ultimul tag.
 */
export function TagInput({ tags, onChange, placeholder, ariaLabel, className }: TagInputProps) {
  const [draft, setDraft] = useState('');

  function commitDraft() {
    const trimmed = draft.trim();
    if (trimmed && !tags.includes(trimmed)) onChange([...tags, trimmed]);
    setDraft('');
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commitDraft();
      return;
    }
    if (event.key === 'Backspace' && draft === '' && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  const classes = className ? `${styles.box} ${className}` : styles.box;

  return (
    <div className={classes}>
      {tags.map(tag => (
        <span key={tag} className={styles.tag}>
          {tag}
          <button
            type="button"
            className={styles.remove}
            aria-label={`Elimină ${tag}`}
            onClick={() => onChange(tags.filter(item => item !== tag))}
          >
            <Icon name="close" size={14} />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={event => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? placeholder : undefined}
        aria-label={ariaLabel}
        className={styles.input}
      />
    </div>
  );
}
