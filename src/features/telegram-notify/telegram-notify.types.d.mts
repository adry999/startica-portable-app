import type { AuditTrail } from '#shared/contracts/audit-trail.mjs';

// Contractele domeniului rezumatului zilnic (§5 din specificație), ale
// fișierelor de configurare/stare și ale rutelor (§4, §6). Restul (web/) se
// adaugă odată cu T4.

/** Conținutul `telegram.json`, scris doar de server. */
export interface TelegramConfig {
  token: string;
  chatId: number | string;
  chatName: string;
  botUsername: string;
}

/** Conținutul `telegram-stare.json`, scris doar de procesul `--telegram`. */
export interface TelegramState {
  lastRun: string;
  lastSuccess: string;
  lastError: string;
  /** Cheie ('zi:<dată>' sau 'plata:<childId>:<lună>') → data ISO la care a fost scrisă. */
  sentKeys: Record<string, string>;
}

/** Răspunsul GET /api/telegram-status (și forma `status` din celelalte rute). */
export interface TelegramStatus {
  configured: boolean;
  connected: boolean;
  chatName: string;
  botUsername: string;
  lastRun: string;
  lastSuccess: string;
  lastError: string;
  stale: boolean;
}

/** Rezultatul classifyTelegramFailure (§6). */
export interface TelegramFailure {
  kind: 'transient' | 'permanent';
  message: string;
}

export interface TelegramService {
  getMe(token: string): Promise<string>;
  findPrivateChat(token: string): Promise<{ chatId: number | string; chatName: string }>;
  sendMessage(options: { token: string; chatId: number | string; text: string }): Promise<void>;
  classifyTelegramFailure(error: unknown): TelegramFailure;
}

export interface TelegramRoutesDependencies {
  dataDirectory: string;
  telegramService: TelegramService;
  auditTrail: AuditTrail;
}

/** Un rând din listUpcomingBirthdays (#features/children/domain/birthdays.mjs). */
export interface DigestBirthdayEntry {
  child: { name: string };
  daysUntil: number;
  turningAge: number;
}

/** O vizită de azi sau de mâine (formă parțială din contractul Vizite, §3.1). */
export interface DigestVisit {
  name: string;
  date: string;
  time: string;
  phone?: string;
  parent?: string;
}

/** Un rând din evaluateChildrenForMonth (#features/billing/domain/month-evaluation.mjs), filtrat pe obligation.notify. */
export interface DigestOverdueEntry {
  child: { id: string; name: string };
  obligation: { rest: number | null; due: string };
}

export interface DigestInputs {
  todayStr: string;
  birthdays: DigestBirthdayEntry[];
  visits: DigestVisit[];
  overdue: DigestOverdueEntry[];
  /** Cheie ('zi:<dată>' sau 'plata:<childId>:<lună>') → data ISO la care a fost scrisă. */
  sentKeys: Record<string, string>;
}

export interface DailyDigest {
  text: string;
  keys: string[];
}
