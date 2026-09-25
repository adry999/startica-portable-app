import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

/** Contexte separate: setter-ul e stabil (nu schimbă referință), valoarea variază — un ecran
 * care doar apelează useTopbarActions nu trebuie să re-randeze la fiecare schimbare de valoare. */
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
 * Nu subscrie apelantul la valoarea curentă (doar Topbar o citește), deci nu re-randează ecranul. */
export function useTopbarActions(node: ReactNode) {
  const setActions = useContext(SetterContext);
  const nodeRef = useRef(node);
  nodeRef.current = node;
  useEffect(() => {
    setActions?.(nodeRef.current);
    return () => setActions?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
