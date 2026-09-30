import { useEffect, useRef, type ReactNode } from 'react';
import styles from './Popover.module.css';

export interface PopoverProps {
  onClose: () => void;
  ariaLabel?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Panou plutitor de bază (`COMPONENTE.md` §0c/28g) — poziționat `absolute` sub elementul-părinte
 * (care trebuie să fie `position: relative`), închis la clic în afară sau Escape. Nu are propriul
 * declanșator: apelantul decide când e montat (vezi `ExcuseReasonPopover`). Pentru liste lungi cu
 * poziționare portată în `document.body`, vezi `SearchSelect`, care rezolvă un caz mai complex.
 */
export function Popover({ onClose, ariaLabel, className, children }: PopoverProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) onClose();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const classes = className ? `${styles.popover} ${className}` : styles.popover;
  return (
    <div ref={rootRef} className={classes} role="dialog" aria-label={ariaLabel}>
      {children}
    </div>
  );
}
