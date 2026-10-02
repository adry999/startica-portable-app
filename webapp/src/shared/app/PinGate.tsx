import type { ReactNode } from 'react';
import { LockedContent } from '@shared/ui';
import { usePinStatus } from '@shared/personal/usePinStatus';

export interface PinGateProps {
  /** Eticheta modulului protejat, ex. „Achitările”, „Cheltuielile”, „Raportul” (36h). */
  label: string;
  /** Suprascrie titlul implicit — Salarii (23d) își păstrează formularea originală. */
  title?: string;
  /** Suprascrie subtitlul implicit. */
  subtitle?: string;
  children: ReactNode;
}

/**
 * Curtea PIN-ului administrator (§7, 36h) — generalizarea `PinGate`-ului construit pentru
 * Salarii (23d, `features/personal/PinGate.tsx`, acum o înfășurare subțire peste acesta): nu e
 * securitate, doar oprește o privire din mers (decizia 8) — adevărata gardă e server-side
 * (`assertPinUnlocked`, route-dispatcher.mjs), care respinge cu 403 oricum, PIN introdus sau nu.
 * Orice ecran al cărui `moduleId` apare în `profile.pinModules` se înfășoară cu acesta — PIN-ul
 * e UNUL SINGUR (adminPin, din Backup și setări), partajat de toate modulele, de-aceea
 * `usePinStatus` rămâne neschimbat (aceleași `/api/personal/pin*`), doar textul variază pe ecran.
 */
// PROMPT-11 §4.1: numărătoarea locală trebuie să reflecte blocajul real al serverului
// (pin.service.mjs LOCKOUT_DURATION_MS), nu implicitul de 60s din usePinLock (păstrat acolo
// doar pentru alte folosiri ale hook-ului).
const SERVER_LOCKOUT_MS = 15 * 60 * 1000;

export function PinGate({ label, title, subtitle, children }: PinGateProps) {
  const pin = usePinStatus();
  return (
    <LockedContent
      loading={pin.status === 'loading'}
      unlocked={pin.unlocked}
      onUnlock={pin.unlock}
      onLock={() => void pin.lock()}
      title={title ?? 'Acces protejat cu PIN'}
      subtitle={subtitle ?? `${label}: introdu PIN-ul administrator (4–6 cifre).`}
      inputAriaLabel="PIN administrator"
      hint="Se blochează singur după 10 minute de inactivitate."
      lockoutMs={SERVER_LOCKOUT_MS}
    >
      {children}
    </LockedContent>
  );
}
