import type { SmsRecipientView } from '@shared/ui';
import type { SmsSendResultView, SmsStatusView } from '@shared/sms';

/** Date fixe de exemplu — pagina rulează fără backend, deci nu vin din `/api/*`. */

export interface DemoPaymentRow {
  id: string;
  child: string;
  group: string;
  amount: number;
  method: string;
  status: 'achitat' | 'partial' | 'neachitat';
}

export const DEMO_PAYMENT_ROWS: DemoPaymentRow[] = [
  { id: 'p1', child: 'Andrei Popescu', group: 'Fluturași', amount: 1500, method: 'Card', status: 'achitat' },
  { id: 'p2', child: 'Maria Ionescu', group: 'Ursuleți', amount: 1200, method: 'Numerar', status: 'partial' },
  { id: 'p3', child: 'Ioana Rusu', group: 'Fluturași', amount: 0, method: 'Transfer', status: 'neachitat' },
  { id: 'p4', child: 'Victor Ceban', group: 'Iepurași', amount: 1800, method: 'Card', status: 'achitat' },
];

export const DEMO_GROUPS = [
  { id: 'g1', name: 'Fluturași' },
  { id: 'g2', name: 'Ursuleți' },
  { id: 'g3', name: 'Iepurași' },
];

export const DEMO_SEARCH_SELECT_OPTIONS = [
  { value: 'g1', label: 'Andrei Popescu' },
  { value: 'g2', label: 'Maria Ionescu' },
  { value: 'g3', label: 'Ioana Rusu' },
];

export const DEMO_SMS_RECIPIENTS: SmsRecipientView[] = [
  {
    id: 'r1',
    name: 'Andrei Popescu',
    phone: '+373 691 11 111',
    text: 'Bună ziua! Vă reamintim că taxa lunii septembrie este scadentă. Vă mulțumim!',
    rest: 1500,
  },
  {
    id: 'r2',
    name: 'Maria Ionescu',
    phone: '+373 691 22 222',
    text: 'Bună ziua! Vă reamintim că taxa lunii septembrie este scadentă. Vă mulțumim!',
    rest: 600,
  },
  {
    id: 'r3',
    name: 'Ioana Rusu',
    phone: null,
    text: 'Bună ziua! Vă reamintim că taxa lunii septembrie este scadentă. Vă mulțumim!',
    rest: 1200,
    excludeReason: 'Fără telefon valid',
  },
];

/** Lună/zi fixe (nu `today()`) — pagina de design trebuie să fie identică la fiecare randare. */
export const DEMO_MONTH = '2026-09';
export const DEMO_DAY = '2026-09-24';
export const DEMO_MAX_DAY = '2026-09-27';

const DEMO_SMS_STATUS: SmsStatusView = {
  configured: true,
  sender: 'Startica',
  tokenMasked: '••••1234',
  monthlyLimit: 500,
  sentThisMonth: 42,
  failedThisMonth: 1,
  segmentsThisMonth: 50,
  balance: '120.00',
  balanceCheckedAt: '2026-09-27T08:00:00.000Z',
  unitCost: 0.3,
  lastError: '',
};

/** Simulează rezultatul unei trimiteri SMS, fără nicio cerere de rețea — pentru `onSend`/`onRetry` din demo. */
export function createDemoSmsResult(recipientIds: readonly string[]): SmsSendResultView {
  const results = recipientIds.map((childId, index) => {
    const recipient = DEMO_SMS_RECIPIENTS.find(row => row.id === childId);
    const eligible = recipient?.phone != null;
    return {
      childId,
      outcome: eligible ? ('sent' as const) : ('skipped' as const),
      logId: eligible ? 1000 + index : null,
      segments: eligible ? 1 : 0,
      cost: eligible ? '0.30' : null,
      error: eligible ? '' : 'Fără telefon valid',
    };
  });
  return { ok: true, results, stopped: null, status: DEMO_SMS_STATUS };
}
