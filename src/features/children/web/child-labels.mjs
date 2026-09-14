// Reutilizează culorile deja definite pentru achitări (verde/galben/roz).
const STATUS_BADGE_CLASS = { Activ: 'active', Suspendat: 'partial', Retras: 'late' };
/** @param {string} status */
export function statusBadgeClass(status) {
  return STATUS_BADGE_CLASS[status] || 'partial';
}
