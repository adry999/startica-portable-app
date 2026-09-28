import { useCallback, useEffect, useState } from 'react';
import { requestJson, useAppSession } from '@shared/api/session';

export interface ConflictField {
  field: string;
  local: unknown;
  remote: unknown;
  differs: boolean;
}

export interface ConflictSummary {
  id: string;
  kind: string;
  recordId: string;
  title: string;
  subtitle: string;
  localUpdatedAt: string;
  remoteUpdatedAt: string;
  remoteDeviceName: string;
  fields: ConflictField[];
}

export interface UseConflictsResult {
  conflicts: ConflictSummary[];
  loading: boolean;
  activeId: string | null;
  setActiveId: (id: string) => void;
  resolve: (id: string, choice: 'local' | 'remote') => Promise<void>;
}

/** Lista de conflicte (14c) — reîncarcă după fiecare rezolvare, ca următorul conflict să devină activ. */
export function useConflicts(): UseConflictsResult {
  const session = useAppSession();
  const [conflicts, setConflicts] = useState<ConflictSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveIdState] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = (await requestJson('/api/sync/conflicts')) as { conflicts: ConflictSummary[] };
      setConflicts(result.conflicts);
      setActiveIdState(current =>
        current && result.conflicts.some(c => c.id === current) ? current : (result.conflicts[0]?.id ?? null),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const resolve = useCallback(
    async (id: string, choice: 'local' | 'remote') => {
      await session.mutate('/api/sync/conflicts/resolve', { id, choice });
      await load();
    },
    [session, load],
  );

  return { conflicts, loading, activeId, setActiveId: setActiveIdState, resolve };
}
