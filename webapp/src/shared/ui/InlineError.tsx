import styles from './InlineError.module.css';

export interface InlineErrorProps {
  message: string;
  className?: string;
}

/** Eroare lângă un câmp sau o piesă mică de UI — nu o secțiune întreagă (asta e `ErrorState`).
 * Piesa vizuală standalone din spatele textului de eroare al `Field` (COMPONENTE.md §0d, 29g). */
export function InlineError({ message, className }: InlineErrorProps) {
  const classes = [styles.message, className].filter(Boolean).join(' ');
  return (
    <p role="alert" className={classes}>
      {message}
    </p>
  );
}
