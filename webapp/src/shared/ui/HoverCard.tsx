import { cloneElement, useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { Card } from './Card';
import styles from './HoverCard.module.css';

export interface HoverCardProps {
  /** Conținutul cardului bogat (nu doar text, ca la Tooltip) — poate fi randat lene (dat ca funcție) dacă apelantul vrea. */
  content: ReactNode;
  children: ReactElement<any>;
  /** Cât timp `content` se pregătește (ex. un fetch) — arată un schelet mic în locul conținutului. */
  loading?: boolean;
}

const SHOW_DELAY_MS = 400;
const HIDE_DELAY_MS = 200;

/**
 * Card plutitor cu conținut bogat la hover/focus pe declanșator, cu întârziere la apariție/dispariție
 * (COMPONENTE.md §0i, 34i) — versiune mai bogată a `Tooltip` (text simplu, fără întârziere).
 * Simplificări v1: nu detectează tactilul ("nu apare pe tactil" din spec) și nu cache-uiește
 * conținutul — ambele cer context suplimentar (o detecție reală de input/un strat de cache)
 * față de o primă versiune.
 */
export function HoverCard({ content, children, loading = false }: HoverCardProps) {
  const [visible, setVisible] = useState(false);
  const showTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const id = useId();

  useEffect(
    () => () => {
      clearTimeout(showTimer.current);
      clearTimeout(hideTimer.current);
    },
    [],
  );

  function show() {
    clearTimeout(hideTimer.current);
    showTimer.current = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
  }

  function hide() {
    clearTimeout(showTimer.current);
    hideTimer.current = setTimeout(() => setVisible(false), HIDE_DELAY_MS);
  }

  function cancelHide() {
    clearTimeout(hideTimer.current);
  }

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
        <div className={styles.panelWrapper} onMouseEnter={cancelHide} onMouseLeave={hide}>
          <Card className={styles.card}>
            <div id={id} className={styles.content}>
              {loading ? <span className={styles.shimmer} /> : content}
            </div>
          </Card>
        </div>
      )}
    </span>
  );
}
