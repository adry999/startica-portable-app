import { Button } from './Button';
import styles from './MissingFieldsBanner.module.css';

export interface MissingFieldsBannerField {
  key: string;
  label: string;
  required: boolean;
}

export interface MissingFieldsBannerProps {
  fields: MissingFieldsBannerField[];
  /** Clic pe pastilă sau pe „Completează” — deschide formularul de editare (41a: pe câmpul
   * respectiv dacă e fezabil, altfel formularul întreg — vezi ChildProfileView). */
  onFieldClick: (field: MissingFieldsBannerField) => void;
  className?: string;
}

/**
 * Bandă sub antetul fișei (41a, COMPONENTE.md) — listează ce lipsește dintr-o fișă de copil.
 * Roz dacă lipsește cel puțin un câmp obligatoriu, galben dacă lipsesc doar recomandate.
 * Ascunsă complet când `fields` e gol — logica vine din `missingChildFields(child)`.
 */
export function MissingFieldsBanner({ fields, onFieldClick, className }: MissingFieldsBannerProps) {
  if (fields.length === 0) return null;

  const hasRequiredMissing = fields.some(field => field.required);
  const classes = [styles.banner, hasRequiredMissing ? styles.pink : styles.yellow, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} role="status">
      <div className={styles.text}>
        <strong className={styles.title}>
          {fields.length === 1 ? `Lipsește 1 dată` : `Lipsesc ${fields.length} date`}
        </strong>
        <div className={styles.pills}>
          {fields.map(field => (
            <button key={field.key} type="button" className={styles.pill} onClick={() => onFieldClick(field)}>
              {field.label}
            </button>
          ))}
        </div>
      </div>
      <Button variant="white" size="md" onClick={() => onFieldClick(fields[0])}>
        Completează
      </Button>
    </div>
  );
}
