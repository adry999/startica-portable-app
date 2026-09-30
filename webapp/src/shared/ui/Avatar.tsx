import type { PillTone } from './FilterPills';
import styles from './Avatar.module.css';

export interface AvatarProps {
  /** Numele complet — sursa inițialelor (fallback) și a tonului determinist. */
  name: string;
  size?: 26 | 32 | 38 | 64 | 84;
  /** URL imagine, opțional — dacă lipsește, se arată inițialele. */
  src?: string;
  className?: string;
}

const TONES: PillTone[] = ['yellow', 'pink', 'teal', 'mint', 'blue', 'orange', 'purple', 'coral'];

function initialsOf(name: string): string {
  const words = name.split(' ').filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) return words[0][0]?.toUpperCase() ?? '';
  return `${words[0][0]?.toUpperCase() ?? ''}${words[words.length - 1][0]?.toUpperCase() ?? ''}`;
}

function toneOf(name: string): PillTone {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return TONES[Math.abs(hash) % TONES.length];
}

/** Cerc cu inițiale (sau imagine, dacă `src` e furnizat) — 26/32/38/64/84 (COMPONENTE.md §0e/28e). */
export function Avatar({ name, size = 32, src, className }: AvatarProps) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) };
  const classes = className
    ? `${styles.avatar} ${styles[toneOf(name)]} ${className}`
    : `${styles.avatar} ${styles[toneOf(name)]}`;

  if (src) {
    return (
      <span className={classes} style={style}>
        <img className={styles.image} src={src} alt="" />
      </span>
    );
  }

  return (
    <span className={classes} style={style}>
      {initialsOf(name)}
    </span>
  );
}
