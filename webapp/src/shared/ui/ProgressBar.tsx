import styles from './ProgressBar.module.css';

export type ProgressBarTone = 'orange' | 'mint' | 'yellow' | 'teal' | 'pink' | 'neutral';

export interface ProgressBarSegment {
  /** 0-100, cota din lățimea totală. */
  value: number;
  tone: ProgressBarTone;
}

export type ProgressBarProps =
  | { variant?: 'simple'; value: number; tone?: ProgressBarTone; label?: string; className?: string }
  | { variant: 'segmented'; segments: ProgressBarSegment[]; className?: string }
  | { variant: 'capacity'; filled: number; total: number; tone?: ProgressBarTone; label?: string; className?: string };

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

/** Bară de progres orizontală — simplă, segmentată sau capacitate (COMPONENTE.md §0e/28e). */
export function ProgressBar(props: ProgressBarProps) {
  const classes = props.className ? `${styles.track} ${props.className}` : styles.track;

  if (props.variant === 'segmented') {
    const summary = props.segments.map(segment => `${Math.round(clampPercent(segment.value))}%`).join(', ');
    return (
      <div className={classes}>
        <div className={styles.segmented} aria-hidden="true">
          {props.segments.map((segment, index) => (
            <span
              key={index}
              className={`${styles.segment} ${styles[segment.tone]}`}
              style={{ width: `${clampPercent(segment.value)}%` }}
            />
          ))}
        </div>
        <span className={styles.srOnly}>Segmente: {summary}.</span>
      </div>
    );
  }

  if (props.variant === 'capacity') {
    const total = Math.max(0, props.total);
    const percent = total > 0 ? clampPercent((props.filled / total) * 100) : 0;
    const tone = percent > 80 ? 'yellow' : (props.tone ?? 'mint');
    return (
      <div
        className={classes}
        role="progressbar"
        aria-valuenow={props.filled}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuetext={`${props.filled} din ${total}`}
        aria-label={props.label}
      >
        <span className={`${styles.fill} ${styles[tone]}`} style={{ width: `${percent}%` }} />
      </div>
    );
  }

  const percent = clampPercent(props.value);
  return (
    <div
      className={classes}
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={props.label}
    >
      <span className={`${styles.fill} ${styles[props.tone ?? 'orange']}`} style={{ width: `${percent}%` }} />
    </div>
  );
}
