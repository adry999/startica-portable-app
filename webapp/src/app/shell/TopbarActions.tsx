import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

/** Contexte separate: setter-ul e stabil (nu schimbă referință) — un ecran care doar apelează
 * useTopbarActions nu re-randează pe altcineva ce citește doar SetterContext. */
const SetterContext = createContext<((node: ReactNode) => void) | null>(null);
const ValueContext = createContext<ReactNode>(null);

/** Ține butoanele de antet ale ecranului curent — Topbar e randat de AppShell, în afara arborelui paginii. */
export function TopbarActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<ReactNode>(null);
  return (
    <SetterContext.Provider value={setActions}>
      <ValueContext.Provider value={actions}>{children}</ValueContext.Provider>
    </SetterContext.Provider>
  );
}

export function useTopbarActionsSlot(): ReactNode {
  return useContext(ValueContext);
}

/** Un ecran apelează cu butoanele proprii de antet (ex. „+ Adaugă copil") — se golește la demontare.
 * Reia la fiecare schimbare a nodului (ex. un toggle cu stare vie afișat lângă buton), nu doar la montare. */
export function useTopbarActions(node: ReactNode) {
  const setActions = useContext(SetterContext);
  useEffect(() => {
    setActions?.(node);
    return () => setActions?.(null);
  }, [setActions, node]);
}
