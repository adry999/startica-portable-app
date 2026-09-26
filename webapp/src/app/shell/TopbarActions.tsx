import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

/** Contexte separate: setter-ul e stabil (nu schimbă referință) — un ecran care doar apelează
 * useTopbarActions nu re-randează pe altcineva ce citește doar SetterContext. */
const SetterContext = createContext<((node: ReactNode) => void) | null>(null);
const ValueContext = createContext<ReactNode>(null);

export interface TopbarTitleOverride {
  title: string;
  eyebrow: string;
}

const TitleSetterContext = createContext<((value: TopbarTitleOverride | null) => void) | null>(null);
const TitleValueContext = createContext<TopbarTitleOverride | null>(null);

/** Ține butoanele de antet ale ecranului curent — Topbar e randat de AppShell, în afara arborelui paginii. */
export function TopbarActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<ReactNode>(null);
  const [title, setTitle] = useState<TopbarTitleOverride | null>(null);
  return (
    <SetterContext.Provider value={setActions}>
      <ValueContext.Provider value={actions}>
        <TitleSetterContext.Provider value={setTitle}>
          <TitleValueContext.Provider value={title}>{children}</TitleValueContext.Provider>
        </TitleSetterContext.Provider>
      </ValueContext.Provider>
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

export function useTopbarTitleSlot(): TopbarTitleOverride | null {
  return useContext(TitleValueContext);
}

/** Un ecran care nu are ViewKey propriu (ex. Zile de naștere, rută imbricată sub Copii) își suprascrie
 * titlul/eyebrow-ul din antet — Topbar folosește VIEW_TITLES[view] dacă nu-i nimic în slot. Se golește la demontare. */
export function useTopbarTitle(value: TopbarTitleOverride | null) {
  const setTitle = useContext(TitleSetterContext);
  useEffect(() => {
    setTitle?.(value);
    return () => setTitle?.(null);
  }, [setTitle, value?.title, value?.eyebrow]);
}
