import type { DayCellKind } from '#features/attendance/attendance.types.d.mts';
import { STATUS_LABEL } from './attendance-labels';
import styles from './AttendanceDot.module.css';

export interface AttendanceDotProps {
  kind: DayCellKind;
  /** 14px implicit (grila), 10px în fișa copilului. */
  size?: 'sm' | 'md';
  title?: string;
}

const NEUTRAL_LABEL: Record<'future' | 'off' | 'none', string> = {
  future: 'Zi viitoare',
  off: 'Zi liberă',
  none: '',
};

/** Punctul de stare din grila lunii și din linia de puncte a fișei copilului (18b, fișa copilului). */
export function AttendanceDot({ kind, size = 'md', title }: AttendanceDotProps) {
  const label = kind === 'future' || kind === 'off' || kind === 'none' ? NEUTRAL_LABEL[kind] : STATUS_LABEL[kind];
  return (
    <span
      role="img"
      aria-label={label}
      title={title ?? label}
      className={`${styles.dot} ${styles[kind]} ${size === 'sm' ? styles.sm : ''}`}
    />
  );
}
