/** @typedef {import('../payment-assignment.types.mjs').PaymentAssignmentWire} PaymentAssignmentWire */

/** @param {{ submitMutation: (path: string, body: object) => Promise<unknown> }} dependencies */
export function createPaymentAssignmentApi({ submitMutation }) {
  return {
    /** @param {PaymentAssignmentWire[]} assignments */
    submitAssignments: assignments => submitMutation('/api/payments-assign', { assignments }),
  };
}
