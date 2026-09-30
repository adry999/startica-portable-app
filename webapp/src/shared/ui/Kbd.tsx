import type { ReactNode } from 'react';
import styles from './Kbd.module.css';

export interface KbdProps {
  /** Un singur `<kbd>` cu tot textul, ex. "Ctrl+K" — fără despărțire pe taste separate în v1. */
  children: ReactNode;
  className?: string;
}

/** Etichetă pentru o scurtătură de tastatură, inline în tooltip-uri/text de ajutor (COMPONENTE.md §32e). */
export function Kbd({ children, className }: KbdProps) {
  return <kbd className={className ? `${styles.kbd} ${className}` : styles.kbd}>{children}</kbd>;
}
