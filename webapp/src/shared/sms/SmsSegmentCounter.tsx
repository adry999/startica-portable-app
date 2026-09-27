import { countSmsSegments } from '@domain/sms-segments.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import styles from './SmsSegmentCounter.module.css';

export interface SmsSegmentCounterProps {
  text: string;
  unitCost: number;
  /** Numărul de destinatari — segmentele și costul se înmulțesc cu el (implicit 1, un singur mesaj). */
  count?: number;
}

/** „N caractere · N SMS · ≈ X lei" — GSM-7 sau UCS-2 (docs/design/screens/14-sms.md §11b). */
export function SmsSegmentCounter({ text, unitCost, count = 1 }: SmsSegmentCounterProps) {
  const { characters, segments, encoding } = countSmsSegments(text);
  const totalSegments = segments * count;
  const cost = Math.round(totalSegments * unitCost * 100) / 100;
  const className = encoding === 'ucs-2' ? `${styles.counter} ${styles.ucs2}` : styles.counter;

  return (
    <span className={className} data-testid="sms-segment-counter">
      {characters} caractere · {totalSegments} SMS · ≈ {formatMoney(cost)}
    </span>
  );
}
