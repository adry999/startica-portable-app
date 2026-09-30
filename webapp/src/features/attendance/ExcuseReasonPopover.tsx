import { useState } from 'react';
import { Button, Popover, TextInput } from '@shared/ui';
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

  return (
    <Popover onClose={onClose} ariaLabel={`Motivul absenței lui ${childName}`}>
      <TextInput
        value={value}
        onChange={setValue}
        maxLength={REASON_MAX_LENGTH}
        placeholder="Motivul absenței…"
        ariaLabel={`Motivul absenței lui ${childName}`}
        autoFocus
      />
      <div className={styles.suggestions}>
        {EXCUSE_SUGGESTIONS.map(suggestion => (
          <Button key={suggestion} className={styles.suggestion} onClick={() => setValue(suggestion)}>
            {suggestion}
          </Button>
        ))}
      </div>
      <Button className={styles.save} onClick={() => onSave(value)}>
        Salvează
      </Button>
    </Popover>
  );
}
