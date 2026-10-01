import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './SelectableTile.module.css';

export interface SelectableTileProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  selected?: boolean;
  children: ReactNode;
}

/**
 * Hit-area pe toată suprafața unei plăci custom (ChildTile, GroupTile, pool/WeekView…) —
 * COMPONENTE.md §0i. Reset neutru peste `<button>` (fără stil vizual impus); forma exactă
 * (avatar, text, mark, nuanță dinamică pe `currentColor`) rămâne la CSS modulul apelantului,
 * dat prin `className`.
 */
export function SelectableTile({ selected, className, children, ...rest }: SelectableTileProps) {
  const classes = [styles.root, selected ? styles.selected : '', className].filter(Boolean).join(' ');
  return (
    <button type="button" className={classes} {...rest}>
      {children}
    </button>
  );
}
