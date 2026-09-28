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
  monthlyTotal: number;
  /** Ce trebuie să aducă copilul, ex. „Costum de baie, cască, prosop, papuci.". */
  itemsNote: string;
  logoDataUrl?: string;
}

/**
 * Biletul de bazin al copilului (24c, Bazin spec 23) — componentă de tip layout, pură. Nu are încă
 * rută/hook de date (Bazin nu e implementat) — pregătită pentru când modulul Bazin va exista.
 */
export function PoolReceiptLabel({
  childName,
  groupName,
  coachName,
  monthTitle,
  weekdayTime,
  sessions,
  pricePerSession,
  monthlyTotal,
  itemsNote,
  logoDataUrl,
}: PoolReceiptLabelProps) {
  return (
    <div className={styles.bon}>
      {logoDataUrl && <img src={logoDataUrl} alt="" className={styles.logo} />}
      <div className={styles.ruleSolid} />
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
        {sessions.length} ședințe × {pricePerSession} lei = {monthlyTotal} lei, cu taxa lunii.
        <br />
        Linie punctată = ziua liberă, nu se taxează.
      </span>
      <div className={styles.ruleDashed} />
      <span className={styles.note}>{itemsNote}</span>
    </div>
  );
}
