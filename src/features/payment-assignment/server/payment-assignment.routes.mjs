/** @param {{ paymentAssignmentService: ReturnType<typeof import('./payment-assignment.service.mjs').createPaymentAssignmentService> }} dependencies */
export function createPaymentAssignmentRoutes({ paymentAssignmentService }) {
  return [
    {
      method: 'POST',
      path: '/api/payments-assign',
      /** @param {{ body: import('../payment-assignment.types.mjs').AssignPaymentsRequest }} request */
      handle: ({ body }) => paymentAssignmentService.assignPaymentsToChildren(body),
    },
  ];
}
