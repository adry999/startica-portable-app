export { PaymentsPage } from './PaymentsPage';
export { PaymentReceipt } from './PaymentReceipt';
export { PaymentReceiptThermal } from './PaymentReceiptThermal';
export { DayClosingReceipt } from './DayClosingReceipt';
// 40a: App.tsx (singurul loc din afara featurii care are voie să importe un feature) compune
// PaymentFormDrawer lângă StatusPage, ca „Plată +” din Situația plăților să deschidă formularul
// fără ca features/status să importe direct din features/payments.
export { PaymentFormDrawer, type PaymentFormDrawerProps } from './PaymentFormDrawer';
export { usePayments, type PaymentsData } from './usePayments';
export type { PaymentFormValues } from './payment-form';
