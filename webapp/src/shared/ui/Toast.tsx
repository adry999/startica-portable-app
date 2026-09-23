import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import styles from './Toast.module.css';

interface ToastRequest {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastEntry extends ToastRequest {
  id: number;
}

interface ToastContextValue {
  show: (toast: ToastRequest) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 6000;

/** Coadă de toast-uri nedistructive (ex. "N achitări arhivate · Anulează"), montată o dată la rădăcina aplicației. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const nextId = useRef(0);

  function dismiss(id: number) {
    setToasts(current => current.filter(toast => toast.id !== id));
  }

  function show(toast: ToastRequest) {
    const id = nextId.current++;
    setToasts(current => [...current, { ...toast, id }]);
    setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
  }

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className={styles.stack} aria-live="polite">
        {toasts.map(toast => (
          <div key={toast.id} className={styles.toast} role="status">
            <span>{toast.message}</span>
            {toast.actionLabel && toast.onAction && (
              <button
                type="button"
                className={styles.action}
                onClick={() => {
                  toast.onAction?.();
                  dismiss(toast.id);
                }}
              >
                {toast.actionLabel}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast trebuie folosit în interiorul ToastProvider');
  return context;
}
