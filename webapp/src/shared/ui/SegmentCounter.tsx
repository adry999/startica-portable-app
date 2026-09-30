import { countSmsSegments } from '@domain/sms-segments.mjs';
import styles from './SegmentCounter.module.css';

export interface SegmentCounterProps {
  text: string;
  className?: string;
}

/** „142/160 · 1 SMS" — contor caractere/segmente la compunere, GSM-7/UCS-2 (COMPONENTE.md §0g).
 * Refolosește regula exactă din `@domain/sms-segments.mjs` (aceeași folosită de `SmsSegmentCounter`
 * din `@shared/sms`, pentru dialogul de trimitere) — nu o reimplementare aproximativă. */
export function SegmentCounter({ text, className }: SegmentCounterProps) {
  const { characters, segments, encoding } = countSmsSegments(text);
  const limit = encoding === 'ucs-2' ? (segments <= 1 ? 70 : segments * 67) : segments <= 1 ? 160 : segments * 153;
  const classes = className ? `${styles.counter} ${className}` : styles.counter;

  return (
    <span className={classes}>
      {characters}/{limit} · {segments} {segments === 1 ? 'SMS' : 'SMS-uri'}
    </span>
  );
}
