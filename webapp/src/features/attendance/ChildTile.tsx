import type { ReactNode } from 'react';
import { Icon, type PillTone } from '@shared/ui';
import { STATUS_LABEL } from '@shared/attendance';
import type { AttendanceStatus } from '#features/attendance/attendance.types.d.mts';
import styles from './DayView.module.css';

export interface ChildTileProps {
  name: string;
  initials: string;
  status: AttendanceStatus | null;
  tone: PillTone;
  onClick: () => void;
}

const STATUS_CLASS: Record<'present' | 'absent' | 'excused' | 'unmarked', string> = {
  present: styles.tilePresent,
  absent: styles.tileAbsent,
  excused: styles.tileExcused,
  unmarked: styles.tileUnmarked,
};

const MARK_CLASS: Record<'present' | 'absent' | 'excused' | 'unmarked', string> = {
  present: styles.markPresent,
  absent: styles.markAbsent,
  excused: styles.markExcused,
  unmarked: styles.markUnmarked,
};

const MARK_SYMBOL: Record<'present' | 'absent' | 'excused', ReactNode> = {
  present: <Icon name="check" size={14} />,
  absent: <Icon name="close" size={14} />,
  excused: 'M',
};

const STATUS_TEXT_CLASS: Record<'present' | 'absent' | 'excused' | 'unmarked', string> = {
  present: styles.tileStatusPresent,
  absent: styles.tileStatusAbsent,
  excused: styles.tileStatusExcused,
  unmarked: styles.tileStatusUnmarked,
};

/** Placa de copil din grila zilei (18a) — clic pe orice punct al plăcii ciclează starea. */
export function ChildTile({ name, initials, status, tone, onClick }: ChildTileProps) {
  const kind = status ?? 'unmarked';
  const label = STATUS_LABEL[kind];
  const dimmed = status === 'absent' || status === 'excused';

  return (
    <button
      type="button"
      aria-pressed={status !== null}
      aria-label={`${name}: ${label}`}
      className={`${styles.tile} ${STATUS_CLASS[kind]}`}
      onClick={onClick}
    >
      <span className={`${styles.avatar} ${styles[tone]}`} style={dimmed ? { opacity: 0.55 } : undefined}>
        {initials}
      </span>
      <span className={styles.tileText}>
        <span className={styles.tileName}>{name}</span>
        <span className={`${styles.tileStatus} ${STATUS_TEXT_CLASS[kind]}`}>{label}</span>
      </span>
      <span className={`${styles.mark} ${MARK_CLASS[kind]}`}>{status ? MARK_SYMBOL[status] : ''}</span>
    </button>
  );
}
