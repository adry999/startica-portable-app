import { Badge, type BadgeTone } from '@shared/ui';
import type { SmsLogStatus } from './sms-types';

const BADGE_BY_STATUS: Record<SmsLogStatus, { tone: BadgeTone; label: string }> = {
  sent: { tone: 'yellow', label: 'În curs' },
  delivered: { tone: 'mint', label: 'Livrat' },
  failed: { tone: 'pink', label: 'Eșuat' },
  unknown: { tone: 'neutral', label: 'Necunoscut' },
};

/** Tonul și eticheta pentru starea unui SMS (RASPUNSURI 7). */
export function smsStatusBadge(status: SmsLogStatus): { tone: BadgeTone; label: string } {
  return BADGE_BY_STATUS[status];
}

export function SmsStatusBadge({ status }: { status: SmsLogStatus }) {
  const { tone, label } = smsStatusBadge(status);
  return <Badge tone={tone}>{label}</Badge>;
}
