import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import styles from './UndoToast.module.css';

const DURATION_MS = 10_000;

export interface UndoToastRequest {
  /** Titlu 14/800, ex. "Cheltuială adăugată". */
  title: string;
  /** Detaliu 12px, opțional (ex. "150 lei · Alimentație"). */
  detail?: string;
  /**
   * Cheamă `POST /api/undo` (prin `session.mutate`) — apelantul decide cum, UndoToast nu
   * cunoaște sesiunea, la fel ca `Toast`/`onAction`. O respingere arată mesajul ei (ex.
   * „S-a modificat între timp.”) direct în toast, nu printr-un alt canal.
   */
  onUndo: () => Promise<void>;
}

interface UndoToastEntry extends UndoToastRequest {
  id: number;
}

interface UndoToastContextValue {
  show: (request: UndoToastRequest) => void;
}

const UndoToastContext = createContext<UndoToastContextValue | null>(null);

type Phase = 'active' | 'undoing' | 'error';

/**
 * 40b (PROMPT-8 §8.2) — toast dedicat „Anulează după salvare”, distinct de `ToastProvider`
 * (coadă, fără termen) și de `UndoHistory`/`useUndoStack` (anulare pe celulă, grilă prezență/
 * pontaj — neatins). Un singur toast, jos-centru, 10s; „Anulează” cere serverul (fereastră 15s,
 * același calculator, înregistrarea neschimbată între timp — vezi undo-eligibility.mjs) — nu
 * repetă optimist o inversare locală, ca `ToastProvider`'s `onAction` din alte fluxuri.
 */
export function UndoToastProvider({ children }: { children: ReactNode }) {
  const [entry, setEntry] = useState<UndoToastEntry | null>(null);
  const [phase, setPhase] = useState<Phase>('active');
  const [secondsLeft, setSecondsLeft] = useState(DURATION_MS / 1000);
  const [errorMessage, setErrorMessage] = useState('');
  const nextId = useRef(0);

  function dismiss() {
    setEntry(null);
  }

  function show(request: UndoToastRequest) {
    setEntry({ ...request, id: nextId.current++ });
    setPhase('active');
    setErrorMessage('');
    setSecondsLeft(DURATION_MS / 1000);
  }

  // Un singur `setInterval`, nu un lanț de `setTimeout` reprogramat la fiecare scădere a
  // `secondsLeft` — reprogramarea depinde de un re-render finalizat între „ticks”, ceea ce
  // cu fake timers (`vi.advanceTimersByTime`) dintr-un singur `act()` nu se întâmplă de
  // fiecare dată, deci numărătoarea „sare” peste valori în teste (deși ar merge în producție).
  useEffect(() => {
    if (!entry || phase !== 'active') return undefined;
    const interval = setInterval(() => setSecondsLeft(current => Math.max(0, current - 1)), 1000);
    return () => clearInterval(interval);
  }, [entry, phase]);

  useEffect(() => {
    if (entry && phase === 'active' && secondsLeft <= 0) dismiss();
  }, [entry, phase, secondsLeft]);

  useEffect(() => {
    if (phase !== 'error') return undefined;
    const timer = setTimeout(dismiss, 4000);
    return () => clearTimeout(timer);
  }, [phase]);

  async function handleUndo() {
    if (!entry || phase !== 'active') return;
    setPhase('undoing');
    try {
      await entry.onUndo();
      dismiss();
    } catch (error) {
      setErrorMessage((error as Error).message);
      setPhase('error');
    }
  }

  return (
    <UndoToastContext.Provider value={{ show }}>
      {children}
      {entry && (
        <div className={styles.toast} role="status" aria-live="polite">
          <span className={styles.checkmark}>
            <Icon name="check" size={14} />
          </span>
          <div className={styles.text}>
            <span className={styles.title}>{entry.title}</span>
            {phase === 'error' ? (
              <span className={styles.detail}>{errorMessage}</span>
            ) : (
              entry.detail && <span className={styles.detail}>{entry.detail}</span>
            )}
          </div>
          {phase !== 'error' && (
            <button
              type="button"
              className={styles.action}
              onClick={() => void handleUndo()}
              disabled={phase === 'undoing'}
            >
              Anulează · {secondsLeft}
            </button>
          )}
        </div>
      )}
    </UndoToastContext.Provider>
  );
}

export function useUndoToast(): UndoToastContextValue {
  const context = useContext(UndoToastContext);
  if (!context) throw new Error('useUndoToast trebuie folosit în interiorul UndoToastProvider');
  return context;
}
