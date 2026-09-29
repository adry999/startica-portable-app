import { DEFAULT_SERVICE_ID, DEFAULT_SERVICE_SEEDS } from './record-schema.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').Payment} Payment */
/** @typedef {import('#shared/contracts/record-types.mjs').Child} Child */
/** @typedef {import('#shared/contracts/record-types.mjs').Group} Group */
/** @typedef {import('#shared/contracts/record-types.mjs').Service} Service */

// O achitare importată poate să nu aibă copil asociat; atunci se arată numele
// din sursă, ca rândul să rămână identificabil.
/**
 * @param {Payment} payment
 * @param {Child[]} children
 */
export function childNameOf(payment, children) {
  return (
    children.find(child => child.id === payment.childId)?.name ||
    payment.childName ||
    payment.sourceName ||
    'Copil neasociat'
  );
}

// Numărul de contract este identificatorul folosit în discuția cu părintele.
/** @param {Pick<Child, 'id' | 'contractNumber'>} child */
export const contractNumberOf = child => child.contractNumber || child.id;

/**
 * @param {string | null} groupId
 * @param {Group[]} groups
 */
export function groupNameOf(groupId, groups) {
  return groups.find(group => group.id === groupId)?.name || '';
}

// Serviciul unei achitări (B3, ALINIERE-DESIGN.md §B3) — implicit Grădiniță dacă lipsește
// `payment.service` sau instalarea/fixtura nu declară `services` (instalare veche fără seed
// încă rulat, fixtură de test) — cade pe DEFAULT_SERVICE_SEEDS, ca childNameOf pe „Copil neasociat”.
/**
 * @param {Pick<Payment, 'service'>} payment
 * @param {Service[]} services
 */
export function serviceOf(payment, services) {
  const id = payment.service || DEFAULT_SERVICE_ID;
  return (
    services.find(service => service.id === id) ??
    DEFAULT_SERVICE_SEEDS.find(seed => seed.id === id) ??
    DEFAULT_SERVICE_SEEDS[0]
  );
}

/**
 * @param {Pick<Payment, 'service'>} payment
 * @param {Service[]} services
 */
export function serviceNameOf(payment, services) {
  return serviceOf(payment, services).name;
}
