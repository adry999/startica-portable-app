/** @param {{ receiptNumberingService: ReturnType<typeof import('./receipt-numbering.service.mjs').createReceiptNumberingService> }} dependencies */
export function createReceiptNumberingRoutes({ receiptNumberingService }) {
  return [
    {
      method: 'POST',
      path: '/api/payments-receipt-number',
      /** @param {{ body: import('../receipts.types.d.mts').AssignReceiptNumberRequest }} request */
      handle: ({ body }) => receiptNumberingService.assignReceiptNumber(body),
    },
  ];
}
