import { monthOK } from '#shared/domain/calendar-month.mjs';
import { requireThat, requireAmount, normalizeRecord, STATUS_HISTORY_VALUES } from '#shared/domain/record-schema.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').Child} Child */
/** @typedef {{ from: string, groupId?: string | null, fee?: number | null, status?: string }} ChildFeeSetup */

// O intrare de istoric pe lună: rescrie luna dacă există deja.
const upsertMonth = (rows, from, key, value) => [
  ...(rows || []).filter(row => row.from !== from),
  { from, [key]: value },
];

/**
 * Completarea în masă a taxei, grupei și statutului. Fără taxă ȘI statut,
 * obligation() nu poate calcula nimic, deci ambele se scriu în istoric din
 * aceeași lună — de regulă luna începerii frecventării, ca și lunile trecute
 * să fie evaluate corect.
 * @param {Child} child
 * @param {ChildFeeSetup} setup
 */
export function applyChildFeeSetup(child, setup) {
  requireThat(setup && typeof setup === 'object', 'Completare invalidă.');
  requireThat(monthOK(setup.from), `${child.id}: luna de aplicare este invalidă.`);
  const updated = structuredClone(child);
  if (setup.groupId !== undefined) {
    if (setup.groupId !== null)
      requireThat(typeof setup.groupId === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(setup.groupId), 'Grupă invalidă.');
    updated.groupId = setup.groupId;
  }
  if (setup.fee !== undefined && setup.fee !== null) {
    requireAmount(setup.fee, `${child.name}: taxa`, true);
    updated.fee = setup.fee;
    updated.feeHistory = upsertMonth(updated.feeHistory, setup.from, 'amount', setup.fee);
  }
  if (setup.status !== undefined && setup.status !== '') {
    requireThat(STATUS_HISTORY_VALUES.includes(setup.status), `${child.name}: statut invalid.`);
    updated.status = /** @type {import('#shared/contracts/record-types.mjs').ChildStatus} */ (setup.status);
    updated.statusHistory = upsertMonth(updated.statusHistory, setup.from, 'status', setup.status);
  }
  return normalizeRecord('children', updated);
}

/** @param {Child} child */
export const hasMissingFee = child => !child.feeHistory?.length;

// Luna din care se aplică taxa și statutul. Începerea frecventării este cea
// corectă: din ea se calculează și lunile trecute. Contractul și luna curentă
// sunt rezerve pentru fișele incomplete.
/**
 * @param {Child} child
 * @param {string} today
 */
export const defaultSetupMonth = (child, today) => (child.attendanceDate || child.contractDate || today).slice(0, 7);
