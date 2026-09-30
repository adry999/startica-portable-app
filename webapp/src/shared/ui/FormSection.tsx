import type { ReactNode } from 'react';
import styles from './FormSection.module.css';

export interface FormSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

/** Grupare de câmpuri într-un formular — titlu + descriere opțională, apoi câmpurile (DS-IMPLEMENTARE.md §3). */
export function FormSection({ title, description, children, className }: FormSectionProps) {
  return (
    <section className={className ? `${styles.section} ${className}` : styles.section}>
      <h3 className={styles.title}>{title}</h3>
      {description && <p className={styles.description}>{description}</p>}
      <div className={styles.content}>{children}</div>
    </section>
  );
}
