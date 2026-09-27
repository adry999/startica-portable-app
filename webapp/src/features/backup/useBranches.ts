import { useCallback, useEffect, useState } from 'react';
import { createBranch, fetchBranches, updateBranch, type BranchSummary } from '@shared/api/branches';

export interface BranchesData {
  ready: boolean;
  activeBranchId: string;
  branches: BranchSummary[];
  reload: () => Promise<void>;
  create: (input: { name: string; address?: string }) => Promise<void>;
  rename: (id: string, name: string) => Promise<void>;
  setColor: (id: string, color: string) => Promise<void>;
}

/** Fila „Filiale” din Backup și setări (13c) — listă cu contoare, redenumire, culoare, adăugare. Fără ștergere. */
export function useBranches(): BranchesData {
  const [ready, setReady] = useState(false);
  const [activeBranchId, setActiveBranchId] = useState('');
  const [branches, setBranches] = useState<BranchSummary[]>([]);

  const load = useCallback(async () => {
    const response = await fetchBranches();
    setActiveBranchId(response.activeBranchId);
    setBranches(response.branches);
    setReady(true);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(input: { name: string; address?: string }) {
    await createBranch(input);
    await load();
  }

  async function rename(id: string, name: string) {
    await updateBranch({ id, name });
    await load();
  }

  async function setColor(id: string, color: string) {
    await updateBranch({ id, color });
    await load();
  }

  return { ready, activeBranchId, branches, reload: load, create, rename, setColor };
}
