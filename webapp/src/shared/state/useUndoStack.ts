import { useRef, useState } from 'react';

export interface UndoHistoryEntry {
  id: string;
  label: string;
  time: string;
}

interface UndoStackEntry<TValue> extends UndoHistoryEntry {
  prev: Map<string, TValue>;
}

export interface UndoStack<TValue> {
  /** Cel mai recent primul, ca în popover-ul „Modificări azi”. */
  history: UndoHistoryEntry[];
  canUndo: boolean;
  push: (label: string, prev: Map<string, TValue>) => void;
  undoLast: () => void;
  undoUntil: (id: string) => void;
  undoAll: () => void;
}

function timeLabel(): string {
  return new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Stivă de acțiuni anulabile per cheie (`UndoHistory` din `@shared/ui`, COMPONENTE.md §0f) —
 * `push` ține starea de dinainte per cheie atinsă; anularea cheamă `onRestore` cu harta agregată,
 * ca „Anulează” să treacă prin mutația reală a apelantului (sync + Istoric), nu o ștergere locală.
 * `resetKey` golește istoricul când se schimbă (ex. ziua sau luna afișată).
 */
export function useUndoStack<TValue>(
  resetKey: unknown,
  onRestore: (restore: Map<string, TValue>) => void,
): UndoStack<TValue> {
  const [history, setHistory] = useState<UndoStackEntry<TValue>[]>([]);
  const resetRef = useRef(resetKey);
  if (resetRef.current !== resetKey) {
    resetRef.current = resetKey;
    if (history.length > 0) setHistory([]);
  }

  function push(label: string, prev: Map<string, TValue>) {
    setHistory(current => [...current, { id: crypto.randomUUID(), label, time: timeLabel(), prev }]);
  }

  function restore(entries: UndoStackEntry<TValue>[]) {
    // Din cel mai vechi spre cel mai nou: prima atingere a unei chei e starea de dinainte de
    // TOATE intrările anulate — o intrare mai nouă care nu a atins-o nu trebuie să o suprascrie.
    const merged = new Map<string, TValue>();
    for (const entry of entries) for (const [key, value] of entry.prev) if (!merged.has(key)) merged.set(key, value);
    onRestore(merged);
  }

  function undoLast() {
    if (history.length === 0) return;
    restore([history[history.length - 1]]);
    setHistory(current => current.slice(0, -1));
  }

  function undoUntil(id: string) {
    const index = history.findIndex(entry => entry.id === id);
    if (index === -1) return;
    restore(history.slice(index));
    setHistory(current => current.slice(0, index));
  }

  function undoAll() {
    if (history.length === 0) return;
    restore(history);
    setHistory([]);
  }

  return {
    history: [...history].reverse().map(({ id, label, time }) => ({ id, label, time })),
    canUndo: history.length > 0,
    push,
    undoLast,
    undoUntil,
    undoAll,
  };
}
