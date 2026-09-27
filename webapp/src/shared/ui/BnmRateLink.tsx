import { bnmRatesPageUrl } from '#shared/domain/exchange-rates.mjs';
import { formatDate } from '#shared/format/date-format.mjs';
import styles from './BnmRateLink.module.css';

export interface BnmRateLinkProps {
  /** Ziua cursului, YYYY-MM-DD. */
  date: string;
  className?: string;
}

/** Iconiță lângă un curs afișat: deschide pagina oficială BNM a zilei, pentru verificare. */
export function BnmRateLink({ date, className }: BnmRateLinkProps) {
  const label = `Verifică pe bnm.md cursul din ${formatDate(date)}`;
  return (
    <a
      className={className ? `${styles.link} ${className}` : styles.link}
      href={bnmRatesPageUrl(date)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      onClick={event => event.stopPropagation()}
    >
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
        <path
          d="M9 2h5v5M14 2 7.5 8.5M12 9.5V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </a>
  );
}
