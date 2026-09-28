export type CoachPayMode = 'per_child' | 'per_session';

export interface PoolSettings {
  enabled: boolean;
  pricePerSession: number;
  /** Minute. */
  durationMin: number;
  /** HH:MM */
  hoursFrom: string;
  /** HH:MM */
  hoursTo: string;
  /** null = fără limită. */
  seatsPerSlot: number | null;
  chargeUnexcusedAbsence: boolean;
  coachPayMode: CoachPayMode;
  coachRate: number;
}

export interface PoolBooking {
  id: string;
  childId: string;
  coachId: string;
  /** 1=luni…5=vineri */
  weekday: number;
  /** HH:MM */
  time: string;
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD, opțional */
  endDate: string | null;
  archivedAt: string | null;
  updatedAt: string;
}

export type PoolSessionStatus = 'present' | 'absent' | 'excused' | 'cancelled';

export interface PoolSession {
  bookingId: string;
  /** YYYY-MM-DD */
  date: string;
  status: PoolSessionStatus;
  updatedAt: string;
}

export interface PoolClosing {
  /** YYYY-MM */
  month: string;
  closedAt: string;
}

export interface CoachPay {
  sessionsHeld: number;
  childrenPresent: number;
  rate: number;
  mode: CoachPayMode;
  amount: number;
}
