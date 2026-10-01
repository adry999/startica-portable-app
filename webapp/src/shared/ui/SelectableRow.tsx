import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './SelectableRow.module.css';

export interface SelectableRowProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  selected?: boolean;
  children: ReactNode;
}

/**
 * Hit-area pe tot rândul dintr-o listă custom (AssignPage, NotifyPage, ReviewPage,
 * ConflictsPage, GroupTeamPicker…) — COMPONENTE.md §0i. Reset neutru peste `<button>`
 * (fără stil vizual impus); forma exactă a rândului rămâne la CSS modulul apelantului,
 * dat prin `className`.
 */
export function SelectableRow({ selected, className, children, ...rest }: SelectableRowProps) {
  const classes = [styles.root, selected ? styles.selected : '', className].filter(Boolean).join(' ');
  return (
    <button type="button" className={classes} {...rest}>
      {children}
    </button>
  );
}
