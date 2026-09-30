import { cloneElement, useId, useState, type ReactElement } from 'react';
import styles from './Tooltip.module.css';

export interface TooltipProps {
  /** Textul afișat în balon. */
  content: string;
  /** Elementul care declanșează balonul la hover/focus — primește aria-describedby automat. */
  children: ReactElement<any>;
  /** Unde apare balonul față de declanșator. Implicit 'top'. */
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

/** Balon plutitor cu text, la hover/focus pe declanșator — fără click-outside, dispare la mouse-leave/blur (COMPONENTE.md §0c, 28g). */
export function Tooltip({ content, children, placement = 'top' }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const id = useId();

  const show = () => setVisible(true);
  const hide = () => setVisible(false);

  const trigger = cloneElement(children, {
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: show,
    onBlur: hide,
    'aria-describedby': id,
  });

  return (
    <span className={styles.wrapper}>
      {trigger}
      {visible && (
        <span role="tooltip" id={id} className={`${styles.bubble} ${styles[placement]}`}>
          {content}
        </span>
      )}
    </span>
  );
}
