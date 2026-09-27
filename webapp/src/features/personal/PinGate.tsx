import { useState, type ReactNode } from 'react';
import { LoadingState } from '@shared/ui';
import { usePinStatus } from '@shared/personal/usePinStatus';
import styles from './PinGate.module.css';

const PIN_LENGTH = 6;

export interface PinGateProps {
  children: ReactNode;
}

/** Curtea PIN-ului administrator (23d) — nu e securitate, doar oprește o privire din mers (decizia 8). */
export function PinGate({ children }: PinGateProps) {
  const pin = usePinStatus();
  const [digits, setDigits] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (pin.status === 'loading') return <LoadingState />;

  if (pin.unlocked) {
    return (
      <>
        <div className={styles.lockBar}>
          <button type="button" className={styles.lockButton} onClick={() => void pin.lock()}>
            Blochează
          </button>
        </div>
        {children}
      </>
    );
  }

  async function submit(value: string) {
    if (submitting) return;
    setSubmitting(true);
    const result = await pin.unlock(value);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message || 'PIN greșit.');
      setDigits('');
    }
  }

  function handleChange(value: string) {
    const cleaned = value.replace(/\D/g, '').slice(0, PIN_LENGTH);
    setDigits(cleaned);
    setError('');
    if (cleaned.length >= 4 && cleaned.length === PIN_LENGTH) void submit(cleaned);
  }

  function handleSubmitClick() {
    if (digits.length >= 4) void submit(digits);
  }

  return (
    <div className={styles.root}>
      <p className={styles.title}>Salariile sunt protejate</p>
      <p className={styles.subtitle}>Introdu PIN-ul administrator (4–6 cifre).</p>
      <input
        className={error ? `${styles.pinInput} ${styles.pinInputError}` : styles.pinInput}
        type="password"
        inputMode="numeric"
        autoFocus
        aria-label="PIN administrator"
        value={digits}
        onChange={event => handleChange(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter') handleSubmitClick();
        }}
      />
      {error && <p className={styles.error}>{error}</p>}
      <p className={styles.hint}>Se blochează singur după 10 minute de inactivitate.</p>
    </div>
  );
}
