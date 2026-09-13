/** @typedef {import('#shared/contracts/record-types.mjs').Payment} Payment */
/** @typedef {import('#shared/contracts/record-types.mjs').Child} Child */
/** @typedef {import('#shared/contracts/record-types.mjs').Group} Group */

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
