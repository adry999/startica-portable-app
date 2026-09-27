import { useEffect, useState } from 'react';

/**
 * Ține starea de „se arată” în urma unui prag, ca ecranele scurte să nu clipească.
 * `active` pornește cronometrul; când devine `false`, starea revine imediat la ascuns.
 */
export function useDelayedLoading(active: boolean, delayMs: number): boolean {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!active) {
      setShow(false);
      return;
    }
    const timer = setTimeout(() => setShow(true), delayMs);
    return () => clearTimeout(timer);
  }, [active, delayMs]);

  return show;
}
