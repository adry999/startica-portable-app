import type { ReactNode } from 'react';
import { PinGate as SharedPinGate } from '@shared/app/PinGate';

export interface PinGateProps {
  children: ReactNode;
}

/**
 * Curtea PIN-ului administrator pentru Salarii (23d) — nu e securitate, doar oprește o privire
 * din mers (decizia 8). §7 (36h): generalizată în `@shared/app/PinGate` pentru orice alt modul
 * din `profile.pinModules` — acesta rămâne doar o înfășurare cu textul original al Salariilor,
 * ca ecranul și testele existente (PinGate.test.tsx) să nu se schimbe.
 */
export function PinGate({ children }: PinGateProps) {
  return (
    <SharedPinGate
      label="Salariile"
      title="Salariile sunt protejate"
      subtitle="Introdu PIN-ul administrator (4–6 cifre)."
    >
      {children}
    </SharedPinGate>
  );
}
