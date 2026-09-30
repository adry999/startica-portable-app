import type { ReactNode } from 'react';
import { LockedContent } from '@shared/ui';
import { usePinStatus } from '@shared/personal/usePinStatus';

export interface PinGateProps {
  children: ReactNode;
}

/** Curtea PIN-ului administrator (23d) — nu e securitate, doar oprește o privire din mers (decizia 8). */
export function PinGate({ children }: PinGateProps) {
  const pin = usePinStatus();
  return (
    <LockedContent
      loading={pin.status === 'loading'}
      unlocked={pin.unlocked}
      onUnlock={pin.unlock}
      onLock={() => void pin.lock()}
      title="Salariile sunt protejate"
      subtitle="Introdu PIN-ul administrator (4–6 cifre)."
      inputAriaLabel="PIN administrator"
      hint="Se blochează singur după 10 minute de inactivitate."
    >
      {children}
    </LockedContent>
  );
}
