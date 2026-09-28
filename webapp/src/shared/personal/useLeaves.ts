import { useEffect, useState } from 'react';
import { requestJson } from '@shared/api/session';
import type { Leave, OverlappingLeaveWarning } from '@shared/personal/personal.types';

export interface LeavesData {
  status: 'loading' | 'ready' | 'failed';
  failureMessage: string;
  leaves: Leave[];
  warnings: OverlappingLeaveWarning[];
  saveLeave: (leave: Leave) => Promise<void>;
  removeLeave: (id: string) => Promise<void>;
  reload: () => Promise<void>;
}

/** Concediile unui an (23f) — scrise/șterse și în pontaj, pe server (decizia 2). */
export function useLeaves(year: string): LeavesData {
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [warnings, setWarnings] = useState<OverlappingLeaveWarning[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [failureMessage, setFailureMessage] = useState('');

  async function load() {
    setStatus('loading');
    try {
      const response = (await requestJson(`/api/personal/leaves?year=${year}`)) as {
        leaves: Leave[];
        warnings: OverlappingLeaveWarning[];
      };
      setLeaves(response.leaves);
      setWarnings(response.warnings);
      setStatus('ready');
    } catch (error) {
      setFailureMessage((error as Error).message);
      setStatus('failed');
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  async function saveLeave(leave: Leave) {
    await requestJson('/api/personal/leaves', { leave });
    await load();
  }

  async function removeLeave(id: string) {
    await requestJson('/api/personal/leaves', { id, remove: true });
    await load();
  }

  return { status, failureMessage, leaves, warnings, saveLeave, removeLeave, reload: load };
}
