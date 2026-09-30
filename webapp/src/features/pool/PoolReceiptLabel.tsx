import { ThermalRule } from '@shared/ui';
import styles from './PoolReceiptLabel.module.css';

export interface PoolSessionCell {
  /** Ziua din lună, ex. „6". */
  day: string;
  /** Luna scurtă, ex. „oct". */
  monthLabel: string;
  /** O ședință marcată punctat e ziua liberă a copilului — nu se taxează. */
  dashed?: boolean;
}

export interface PoolReceiptLabelProps {
  childName: string;
  groupName: string;
  coachName: string;
  /** Titlul benzii de sus, ex. „BAZIN · OCTOMBRIE". */
  monthTitle: string;
  /** Ziua și ora fixă săptămânală, ex. „Marți · 10:30". */
  weekdayTime: string;
  sessions: PoolSessionCell[];
  pricePerSession: number;
  /** Ce trebuie să aducă copilul, ex. „Costum de baie, cască, prosop, papuci.". */
  itemsNote: string;
  logoDataUrl?: string;
}

/**
 * Biletul de bazin al copilului (24c, Bazin spec 23) — componentă de tip layout, pură, cu rută/hook
 * de date reale de la `f0d40af`. Totalul se calculează AICI din `sessions`/`pricePerSession`, nu se
 * primește gata calculat (A-2): ședințele punctate (anulate) nu se taxează, restul da — înmulțirea
 * tipărită pe bon e mereu adevărată, indiferent câte ședințe sunt deja marcate.
 */
export function PoolReceiptLabel({
  childName,
  groupName,
  coachName,
  monthTitle,
  weekdayTime,
  sessions,
  pricePerSession,
  itemsNote,
  logoDataUrl,
}: PoolReceiptLabelProps) {
  const chargeableSessions = sessions.filter(session => !session.dashed).length;
  const monthlyTotal = Math.round(chargeableSessions * pricePerSession * 100) / 100;
  return (
    <>
      {logoDataUrl && <img src={logoDataUrl} alt="" className={styles.logo} />}
      <ThermalRule />
      <div className={styles.titleBlock}>
        <span className={styles.eyebrow}>{monthTitle}</span>
        <span className={styles.childName}>{childName}</span>
        <span className={styles.meta}>
          Grupa {groupName} · antrenor {coachName}
        </span>
      </div>
      <div className={styles.scheduleBox}>
        <span className={styles.scheduleLabel}>ÎN FIECARE</span>
        <span className={styles.scheduleValue}>{weekdayTime}</span>
      </div>
      <div className={styles.sessionGrid}>
        {sessions.map((session, index) => (
          <div
            key={`${session.day}-${index}`}
            className={`${styles.sessionCell} ${session.dashed ? styles.dashed : ''}`}
          >
            <strong>{session.day}</strong>
            <span>{session.monthLabel}</span>
          </div>
        ))}
      </div>
      <span className={styles.note}>
        {chargeableSessions} ședințe × {pricePerSession} lei = {monthlyTotal} lei, cu taxa lunii.
        <br />
        Linie punctată = ziua liberă, nu se taxează.
      </span>
      <ThermalRule variant="dashed" />
      <span className={styles.note}>{itemsNote}</span>
    </>
  );
}
