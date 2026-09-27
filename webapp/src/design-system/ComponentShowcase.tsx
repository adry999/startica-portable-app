import type { ReactNode } from 'react';
import styles from './ComponentShowcase.module.css';

export interface ComponentShowcaseProps {
  /** Exact numele exportului din `@shared/ui` — testul de acoperire îl caută în DOM prin `data-export`. */
  name: string;
  /** Linia de import afișată ca text, ex. `import { Button } from '@shared/ui';`. */
  importLine: string;
  /** Fișierul (și ancora) din `docs/design/*.dc.html` unde apare vizual componenta. */
  reference: string;
  children: ReactNode;
}

/**
 * Cartelă standard pentru un export din `@shared/ui`: nume, linia de import și referința
 * vizuală din pachetul de design, urmate de demo-ul propriu-zis. `data-export` e ancora
 * pe care se sprijină testul de acoperire a barrel-ului (design-system.test.tsx).
 */
export function ComponentShowcase({ name, importLine, reference, children }: ComponentShowcaseProps) {
  return (
    <section className={styles.showcase} data-export={name} aria-labelledby={`showcase-${name}`}>
      <header className={styles.head}>
        <h3 id={`showcase-${name}`} className={styles.name}>
          {name}
        </h3>
        <code className={styles.importLine}>{importLine}</code>
        <p className={styles.reference}>Referință design: {reference}</p>
      </header>
      <div className={styles.body}>{children}</div>
    </section>
  );
}
