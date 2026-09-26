import type { AuditTrail } from '#shared/contracts/audit-trail.mjs';
import type { SmsSegmentCount } from '#shared/domain/sms-segments.mjs';

/** Conținutul `Startica_Date\sms.json`, scris doar de server. Tokenul nu iese niciodată din server. */
export interface SmsConfig {
  token: string;
  /** Numele de expeditor aprobat în dashboard-ul sms.md, max 15 caractere. */
  sender: string;
  /** null = fără limită (implicit); altfel 1..5000. Contor global pe instalare, nu per filială. */
  monthlyLimit: number | null;
}

export interface SmsTemplate {
  id: string;
  name: string;
  body: string;
  stripDiacritics: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SmsTemplateInput {
  id?: string;
  name: string;
  body: string;
  stripDiacritics: boolean;
  isDefault: boolean;
}

export type SmsLogStatus = 'sent' | 'delivered' | 'failed' | 'unknown';
export type SmsSource = 'status-row' | 'status-bulk' | 'notify' | 'resend' | 'test';
export type SmsEncoding = 'gsm-7' | 'ucs-2';

export interface SmsLogEntry {
  id: number;
  createdAt: string;
  childId: string | null;
  recipientName: string;
  childName: string;
  phone: string;
  text: string;
  templateId: string | null;
  templateName: string;
  month: string | null;
  source: SmsSource;
  characters: number;
  segments: number;
  encoding: SmsEncoding;
  cost: string | null;
  status: SmsLogStatus;
  providerId: string | null;
  providerStatus: string;
  providerError: string;
  statusCheckedAt: string;
}

export type NewSmsLogEntry = Omit<SmsLogEntry, 'id'>;

export interface SmsMonthlyStats {
  sentThisMonth: number;
  failedThisMonth: number;
  segmentsThisMonth: number;
}

export interface SmsLastNotified {
  at: string;
  status: SmsLogStatus;
  month: string | null;
  templateName: string;
}

export interface SmsFailure {
  kind: 'transient' | 'permanent';
  scope: 'recipient' | 'account';
  /** Codul sms.md sau 'NETWORK' / 'TIMEOUT'. */
  code: string;
  message: string;
}

/** `data` din răspunsul 200 al POST /v3/messages. */
export interface SmsSendData {
  id: string;
  to: string;
  text: string;
  characters: number;
  segments: number;
  encoding: SmsEncoding;
  cost: string;
  currency: string;
}

export interface SmsService {
  sendMessage(options: { token: string; from: string; to: string; text: string }): Promise<SmsSendData>;
  getMessage(options: { token: string; id: string }): Promise<{ id: string; status: { id: number; name: string } }>;
  getBalance(options: { token: string }): Promise<{ balance: string; currency: string }>;
  listActiveSenders(options: { token: string }): Promise<string[]>;
  classifySmsFailure(error: unknown): SmsFailure;
}

export interface SmsStatus {
  configured: boolean;
  sender: string;
  tokenMasked: string;
  monthlyLimit: number | null;
  sentThisMonth: number;
  failedThisMonth: number;
  segmentsThisMonth: number;
  balance: string | null;
  balanceCheckedAt: string;
  /** Ultimul cost/segment observat în jurnal (MDL), sau 0.30 dacă jurnalul e gol — pentru estimarea din dialog. */
  unitCost: number;
  lastError: string;
}

export interface SmsSendMessage {
  childId: string;
  childName: string;
  recipientName: string;
  phone: string;
  text: string;
}

export interface SmsSendRequest {
  source: Exclude<SmsSource, 'test'>;
  month: string | null;
  templateId: string | null;
  messages: SmsSendMessage[];
}

export interface SmsSendOutcome {
  childId: string;
  outcome: 'sent' | 'failed' | 'skipped';
  logId: number | null;
  segments: number;
  cost: string | null;
  error: string;
}

export interface SmsBatchResult {
  ok: boolean;
  results: SmsSendOutcome[];
  stopped: { code: string; message: string } | null;
}

export type SmsSendResult = SmsBatchResult & { status: SmsStatus };

export interface SmsSendServiceDependencies {
  smsService: SmsService;
  // TODO(Task 9): restore once sms-log.repository.mjs exists.
  // smsLogRepository: import('./server/sms-log.repository.mjs').SmsLogRepository;
  // TODO(Task 8): restore once sms-template.repository.mjs exists.
  // smsTemplateRepository: import('./server/sms-template.repository.mjs').SmsTemplateRepository;
  readConfig: () => SmsConfig | null;
  auditTrail: AuditTrail;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
}

export interface SmsRoutesDependencies {
  database: import('node:sqlite').DatabaseSync;
  dataDirectory: string;
  smsService: SmsService;
  auditTrail: AuditTrail;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
}

/** Un rând pregătit de ecranul apelant: copilul și obligația lui pe luna selectată. */
export interface SmsRecipientRow {
  child: import('#shared/contracts/record-types.mjs').Child;
  obligation: import('#shared/domain/sms-template.mjs').SmsObligation;
}

export interface PlannedSmsMessage extends SmsSendMessage, SmsSegmentCount {
  parentLabel: string;
}

export interface SmsBatchPlan {
  messages: PlannedSmsMessage[];
  excluded: { childId: string; childName: string; reason: string }[];
  totalSegments: number;
}
