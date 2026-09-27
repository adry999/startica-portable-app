import { useEffect, useRef, useState } from 'react';
import { EXCUSE_SUGGESTIONS, REASON_MAX_LENGTH } from '#features/attendance/index.web.mjs';
import styles from './ExcuseReasonPopover.module.css';

export interface ExcuseReasonPopoverProps {
  childName: string;
  reason: string;
  onSave: (reason: string) => void;
  onClose: () => void;
}

/** Popover mic sub placă, deschis când starea devine „Motivat” (18a) — Esc sau clic în afară închide fără să salveze. */
export function ExcuseReasonPopover({ childName, reason, onSave, onClose }: ExcuseReasonPopoverProps) {
  const [value, setValue] = useState(reason);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) onClose();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div ref={rootRef} className={styles.popover} role="dialog" aria-label={`Motivul absenței lui ${childName}`}>
      <input
        className={styles.input}
        value={value}
        maxLength={REASON_MAX_LENGTH}
        placeholder="Motivul absenței…"
        onChange={event => setValue(event.target.value)}
        autoFocus
      />
      <div className={styles.suggestions}>
        {EXCUSE_SUGGESTIONS.map(suggestion => (
          <button key={suggestion} type="button" className={styles.suggestion} onClick={() => setValue(suggestion)}>
            {suggestion}
          </button>
        ))}
      </div>
      <button type="button" className={styles.save} onClick={() => onSave(value)}>
        Salvează
      </button>
    </div>
  );
}
