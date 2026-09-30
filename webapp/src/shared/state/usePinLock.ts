import { useEffect, useState } from 'react';

export interface PinLockResult {
  ok: boolean;
  message: string;
}

export interface UsePinLockOptions {
  /** Verifică PIN-ul (de obicei la server) — `ok: false` cu mesaj dacă e greșit. */
  verify: (pin: string) => Promise<PinLockResult>;
  /** Lungime minimă la care Enter poate trimite. */
  minLength?: number;
  /** Lungime la care se trimite automat, fără Enter. */
  maxLength?: number;
  /** Greșeli consecutive înainte de blocajul local (implicit 5, ca server-ul din pin.service.mjs). */
  maxAttempts?: number;
  /** Durata blocajului local, ms (implicit 60s, ca server-ul). */
  lockoutMs?: number;
}

export interface PinLockState {
  digits: string;
  error: string;
  submitting: boolean;
  /** Rămase din `maxAttempts` — sub `maxAttempts` doar după cel puțin o greșeală. */
  attemptsLeft: number;
  /** > 0 cât timp blocajul local e activ (numărătoarea inversă din 34f). */
  lockedSecondsLeft: number;
  handleChange: (value: string) => void;
  handleKeyDown: (event: { key: string }) => void;
}

/**
 * `usePinLock` (34f, COMPONENTE.md §0i) — starea unui ecran cu PIN: cifre, verificare, greșeli
 * (mesaj + încercări rămase) și un blocaj local de `lockoutMs` după `maxAttempts` greșeli, cu
 * numărătoare inversă. Oglindește blocajul real impus de server (ex. pin.service.mjs), nu-l
 * înlocuiește — dacă serverul respinge oricum, mesajul lui apare ca orice altă greșeală.
 */
export function usePinLock({
  verify,
  minLength = 4,
  maxLength = 6,
  maxAttempts = 5,
  lockoutMs = 60_000,
}: UsePinLockOptions): PinLockState {
  const [digits, setDigits] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [lockedSecondsLeft, setLockedSecondsLeft] = useState(0);

  useEffect(() => {
    if (!lockedUntil) return;
    const tick = () => {
      const secondsLeft = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      setLockedSecondsLeft(secondsLeft);
      if (secondsLeft === 0) setLockedUntil(0);
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [lockedUntil]);

  async function submit(value: string) {
    if (submitting || lockedUntil) return;
    setSubmitting(true);
    const result = await verify(value);
    setSubmitting(false);
    setDigits('');
    if (result.ok) {
      setError('');
      setFailedAttempts(0);
      return;
    }
    setError(result.message || 'PIN greșit.');
    const nextFailed = failedAttempts + 1;
    if (nextFailed >= maxAttempts) {
      setFailedAttempts(0);
      setLockedUntil(Date.now() + lockoutMs);
    } else {
      setFailedAttempts(nextFailed);
    }
  }

  function handleChange(value: string) {
    if (lockedUntil) return;
    const cleaned = value.replace(/\D/g, '').slice(0, maxLength);
    setDigits(cleaned);
    setError('');
    if (cleaned.length >= minLength && cleaned.length === maxLength) void submit(cleaned);
  }

  function handleKeyDown(event: { key: string }) {
    if (event.key === 'Enter' && digits.length >= minLength) void submit(digits);
  }

  return {
    digits,
    error,
    submitting,
    attemptsLeft: Math.max(0, maxAttempts - failedAttempts),
    lockedSecondsLeft,
    handleChange,
    handleKeyDown,
  };
}
