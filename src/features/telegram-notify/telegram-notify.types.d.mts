// Contractele domeniului rezumatului zilnic (§5 din specificație). Restul
// tipurilor feature-ului (TelegramConfig, TelegramState, TelegramStatus,
// TelegramFailure) se adaugă odată cu server/ și web/.

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
