import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import styles from './Disclosure.module.css';

export interface DisclosureProps {
  title: string;
  /** Necontrolat implicit (își ține singur starea) — dați `open`+`onOpenChange` dacă vreți control din exterior. */
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
  className?: string;
}

/** Secțiune pliabilă — ▸/▾, rezumat în antet (COMPONENTE.md §0f, 31f). O „Accordion" e doar mai
 * multe `Disclosure` randate una sub alta de către apelant — nu forțează un singur panou deschis
 * deodată, lucru pe care spec-ul nu-l cere explicit. */
export function Disclosure({ title, defaultOpen = false, open, onOpenChange, children, className }: DisclosureProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [isOpen, setIsOpen] = useState(open ?? defaultOpen);
  const isControlled = open !== undefined;

  useEffect(() => {
    if (isControlled) setIsOpen(open);
  }, [isControlled, open]);

  function handleToggle() {
    const nowOpen = detailsRef.current?.open ?? false;
    if (!isControlled) setIsOpen(nowOpen);
    onOpenChange?.(nowOpen);
  }

  const classes = [styles.disclosure, className].filter(Boolean).join(' ');
  // `open` rămâne aceeași valoare (constantă) la re-randări cât timp e necontrolat, deci React
  // n-o resetează la native toggle — `<details>` își ține singur atributul după montare.
  const openAttribute = isControlled ? open : defaultOpen;

  return (
    <details ref={detailsRef} className={classes} open={openAttribute} onToggle={handleToggle}>
      <summary className={styles.summary}>
        <span>{title}</span>
        <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} />
      </summary>
      <div className={styles.content}>{children}</div>
    </details>
  );
}
