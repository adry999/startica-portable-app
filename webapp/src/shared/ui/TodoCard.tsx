import { Card } from './Card';
import styles from './TodoCard.module.css';

export interface TodoCardProps {
  title: string;
  /** Ex. "3 copii" sau "Scadent azi" — un detaliu scurt, formatat de apelant. */
  detail?: string;
  onClick?: () => void;
  className?: string;
}

/** Element de rezolvat, pe dashboard (COMPONENTE.md §0i, 34k) — peste `Card`, apăsabil când are `onClick`. */
export function TodoCard({ title, detail, onClick, className }: TodoCardProps) {
  return (
    <Card tone="white" onClick={onClick} className={className}>
      <span className={styles.title}>{title}</span>
      {detail != null && detail !== '' && <span className={styles.detail}>{detail}</span>}
    </Card>
  );
}
