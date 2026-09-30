import { useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import styles from './CopyField.module.css';

export interface CopyFieldProps {
  value: string;
  ariaLabel?: string;
  /** Text opțional sub câmp, ex. "Expiră în 4:32" — countdown-ul propriu-zis e treaba apelantului, CopyField doar arată textul dat. */
  hint?: string;
  className?: string;
}

/**
 * Câmp readonly + buton „Copiază” (nu icon-only — niciun icon de copiere în registrul `Icon`,
 * COMPONENTE.md §0g/32g — „cod de asociere cu expirare”).
 */
export function CopyField({ value, ariaLabel, hint, className }: CopyFieldProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => clearTimeout(timeoutRef.current);
  }, []);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className={className ? `${styles.field} ${className}` : styles.field}>
      <div className={styles.row}>
        <input type="text" readOnly value={value} aria-label={ariaLabel} className={styles.input} />
        <Button variant="outline" onClick={handleCopy}>
          {copied ? 'Copiat!' : 'Copiază'}
        </Button>
      </div>
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}
