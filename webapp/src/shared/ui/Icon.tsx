import {
  ArrowUpDown,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  GripVertical,
  Menu,
  MoreHorizontal,
  Search,
  Undo2,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { CSSProperties } from 'react';

const ICONS = {
  search: Search,
  'more-horizontal': MoreHorizontal,
  'chevron-down': ChevronDown,
  'chevron-up': ChevronUp,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  close: X,
  check: Check,
  menu: Menu,
  'grip-vertical': GripVertical,
  undo: Undo2,
  'external-link': ArrowUpRight,
  'sort-toggle': ArrowUpDown,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export interface IconProps {
  name: IconName;
  /** 14/16/18/20/24 (33b, COMPONENTE.md §0h). Implicit 16. */
  size?: 14 | 16 | 18 | 20 | 24;
  className?: string;
  style?: CSSProperties;
  /** Dacă e setat, iconița devine accesibilă de sine stătător (`aria-label` + `role="img"`), fără `aria-hidden`. */
  ariaLabel?: string;
}

/**
 * Set unic de iconițe peste `lucide-react` (33a — linie 2, colțuri rotunjite, `currentColor`,
 * `absoluteStrokeWidth`). Singurul fișier care importă `lucide-react` (R4, ESLint
 * `no-restricted-imports` în altă parte) — orice iconiță nouă se adaugă aici, nu la locul de folosire.
 * Implicit decorativă (`aria-hidden`) — numele accesibil vine din elementul care o conține
 * (`aria-label` pe buton, text vizibil alăturat etc.); cu `ariaLabel` iconița devine ea însăși accesibilă.
 */
export function Icon({ name, size = 16, className, style, ariaLabel }: IconProps) {
  const LucideIcon = ICONS[name];
  if (ariaLabel) {
    return (
      <LucideIcon
        size={size}
        strokeWidth={2}
        absoluteStrokeWidth
        aria-label={ariaLabel}
        role="img"
        className={className}
        style={style}
      />
    );
  }
  return (
    <LucideIcon
      size={size}
      strokeWidth={2}
      absoluteStrokeWidth
      aria-hidden="true"
      className={className}
      style={style}
    />
  );
}
