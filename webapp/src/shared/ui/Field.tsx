import type { ReactNode } from 'react';
import styles from './Field.module.css';

export interface FieldProps {
  label: string;
  /** Id-ul controlului din `children` — leagă `htmlFor` și `aria-describedby`. */
  htmlFor: string;
  hint?: string;
  /** Înlocuiește `hint` cât timp există. */
  error?: string;
  optional?: boolean;
  children: ReactNode;
}

/** Etichetă + control + ajutor/eroare (25a, `COMPONENTE.md` §0) — controlul din `children` trebuie
 * să primească el însuși `id={htmlFor}`, `aria-describedby={helpId}` și `aria-invalid` de la apelant. */
export function Field({ label, htmlFor, hint, error, optional, children }: FieldProps) {
  const helpText = error || hint;
  const helpId = helpText ? `${htmlFor}-desc` : undefined;

  return (
    <div className={styles.field}>
      <label htmlFor={htmlFor} className={styles.label}>
        {label}
        {optional && <span className={styles.optional}> · opțional</span>}
      </label>
      {children}
      {helpText && (
        <p id={helpId} className={error ? styles.error : styles.hint}>
          {helpText}
        </p>
      )}
    </div>
  );
}
