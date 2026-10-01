import { formatDate } from '#shared/format/date-format.mjs';
import { formatRate } from '#shared/format/rate-format.mjs';
import { Badge } from './Badge';
import { BnmRateLink } from './BnmRateLink';
import { Button } from './Button';
import { Card } from './Card';
import styles from './RateCard.module.css';

const SOURCE_LABEL: Record<'bnm' | 'manual', string> = { bnm: 'BNM · automat', manual: 'corectat manual' };

export interface RateCardTomorrow {
  date: string;
  rate: number;
  /** Diferența față de cursul de azi — poate fi negativă. */
  diff: number;
}

export interface RateCardProps {
  /** Cursul care se arată mare — poate fi al unei zile anterioare (weekend/sărbătoare) dacă azi încă n-are unul propriu. */
  rate: number | undefined;
  /** Ziua căreia îi corespunde `rate`. */
  rateDate: string | undefined;
  /** Dacă `rateDate` chiar e azi — altfel nota explică de ce se arată alt curs. */
  rateIsToday: boolean;
  tone: 'mint' | 'yellow' | null;
  /** F12 (FEEDBACK-01-10.md): apare doar după ce BNM a publicat cursul zilei următoare. */
  tomorrow?: RateCardTomorrow | null;
  primaryAction: { label: string; onClick: () => void };
}

/** Cardul „Curs EUR” de azi + mâine (38e, COMPONENTE.md §Pagination…§F12) — extras din `ExchangeRateSettings`. */
export function RateCard({ rate, rateDate, rateIsToday, tone, tomorrow, primaryAction }: RateCardProps) {
  const cardTone = rate === undefined ? 'white' : (tone ?? 'mint');

  return (
    <Card tone={cardTone} decorative>
      <div className={styles.header}>
        <span className={styles.eyebrow}>
          Curs EUR{rateDate ? ` · ${rateIsToday ? 'azi' : ''} ${formatDate(rateDate)}` : ''}
        </span>
        {rate !== undefined && tone && <Badge tone={tone}>{SOURCE_LABEL[tone === 'yellow' ? 'manual' : 'bnm']}</Badge>}
      </div>
      {rate === undefined ? (
        <>
          <span className={styles.value}>Fără curs cunoscut</span>
          <Button type="button" variant="ghost" onClick={primaryAction.onClick}>
            {primaryAction.label}
          </Button>
        </>
      ) : (
        <>
          <span className={styles.value}>1 € = {formatRate(rate)} lei</span>
          {tomorrow && (
            <div className={styles.tomorrowRow}>
              <b>Mâine, {formatDate(tomorrow.date)}:</b>
              <span>{formatRate(tomorrow.rate)} lei</span>
              <span className={tomorrow.diff >= 0 ? styles.diffUp : styles.diffDown}>
                {tomorrow.diff >= 0 ? '▲' : '▼'} {formatRate(Math.abs(tomorrow.diff))}
              </span>
              <span className={styles.tomorrowSource}>publicat de BNM</span>
            </div>
          )}
          <span className={styles.note}>
            {rateIsToday
              ? tone === 'yellow'
                ? 'Corectat manual pentru azi. Se folosește la toate achitările cu data de azi.'
                : 'Cursul BNM de azi. Se folosește la toate achitările cu data de azi.'
              : 'Cel mai recent curs cunoscut — nu s-a publicat încă un curs pentru azi.'}
          </span>
          <div className={styles.actions}>
            {rateDate && <BnmRateLink date={rateDate} />}
            <Button type="button" variant="ghost" onClick={primaryAction.onClick}>
              {primaryAction.label}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
