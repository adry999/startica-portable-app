import type { ReactNode } from 'react';
import { usePinLock, type PinLockResult } from '@shared/state/usePinLock';
import { LoadingState } from './LoadingState';
import styles from './LockedContent.module.css';

export interface LockedContentProps {
  loading?: boolean;
  unlocked: boolean;
  /** Verifică PIN-ul — ex. `usePinStatus().unlock`. */
  onUnlock: (pin: string) => Promise<PinLockResult>;
  /** Omis dacă blocarea manuală nu are sens pentru acest conținut. */
  onLock?: () => void;
  title: string;
  subtitle: string;
  hint?: string;
  /** Eticheta accesibilă a câmpului de PIN — separată de `title`, ca să rămână stabilă. */
  inputAriaLabel: string;
  lockButtonLabel?: string;
  minLength?: number;
  maxLength?: number;
  maxAttempts?: number;
  lockoutMs?: number;
  children: ReactNode;
}

/**
 * `LockedContent` + `usePinLock` (34f, COMPONENTE.md §0i) — conținutul din `children` nu e în DOM
 * cât timp e blocat (doar formularul de PIN se randează). La greșeală: mesaj + încercări rămase;
 * după `maxAttempts` greșeli, blocaj local cu numărătoare inversă (server-ul are propriul blocaj,
 * ăsta e doar reflectarea lui în UI — vezi `usePinLock`).
 */
export function LockedContent({
  loading,
  unlocked,
  onUnlock,
  onLock,
  title,
  subtitle,
  hint,
  inputAriaLabel,
  lockButtonLabel = 'Blochează',
  minLength,
  maxLength,
  maxAttempts = 5,
  lockoutMs,
  children,
}: LockedContentProps) {
  const lock = usePinLock({ verify: onUnlock, minLength, maxLength, maxAttempts, lockoutMs });

  if (loading) return <LoadingState />;

  if (unlocked) {
    return (
      <>
        {onLock && (
          <div className={styles.lockBar}>
            <button type="button" className={styles.lockButton} onClick={onLock}>
              {lockButtonLabel}
            </button>
          </div>
        )}
        {children}
      </>
    );
  }

  const isLocked = lock.lockedSecondsLeft > 0;

  return (
    <div className={styles.root}>
      <p className={styles.title}>{title}</p>
      <p className={styles.subtitle}>{subtitle}</p>
      <input
        className={lock.error ? `${styles.pinInput} ${styles.pinInputError}` : styles.pinInput}
        type="password"
        inputMode="numeric"
        autoFocus
        aria-label={inputAriaLabel}
        value={lock.digits}
        disabled={isLocked || lock.submitting}
        onChange={event => lock.handleChange(event.target.value)}
        onKeyDown={lock.handleKeyDown}
      />
      {isLocked ? (
        <p className={styles.error}>Blocat {lock.lockedSecondsLeft}s — prea multe încercări greșite.</p>
      ) : (
        lock.error && <p className={styles.error}>{lock.error}</p>
      )}
      {!isLocked && lock.error && lock.attemptsLeft < maxAttempts && (
        <p className={styles.attemptsHint}>Mai ai {lock.attemptsLeft} încercări.</p>
      )}
      {hint && <p className={styles.hint}>{hint}</p>}
    </div>
  );
}
