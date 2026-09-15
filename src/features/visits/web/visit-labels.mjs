import { stripDiacritics } from '#shared/format/text-search.mjs';

// Culorile refolosesc `.badge`-urile existente (verde/galben/roz); Înscris și
// Renunțat sunt singurele două noi (portocaliu, gri).
const STATUS_BADGE_CLASS = {
  Programată: 'partial',
  Efectuată: 'active',
  Înscris: 'enrolled',
  Neprezentată: 'late',
  Renunțat: 'withdrawn',
};

/** @param {string} status */
export function visitStatusBadgeClass(status) {
  return STATUS_BADGE_CLASS[status] || 'partial';
}

// Clasa cipului din calendar urmează statutul, fără diacritice: `Programată` → `cal-chip-programata`.
/** @param {string} status */
export function visitStatusChipClass(status) {
  return `cal-chip-${stripDiacritics(status).toLowerCase()}`;
}
