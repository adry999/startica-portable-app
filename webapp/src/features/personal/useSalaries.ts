import { useEffect, useState } from 'react';
import { requestJson, useAppSession } from '@shared/api/session';
import { today } from '#shared/domain/calendar-month.mjs';
import type { Salary, SalaryMode, SalaryRow } from '@shared/personal/personal.types';

export interface SalariesTotals {
  gross: number;
  advances: number;
  net: number;
  /** Suma netă a lunilor deja plătite — pentru cardul „Plătit”. */
  paid: number;
}

export interface SalariesData {
  status: 'loading' | 'ready' | 'failed' | 'locked';
  failureMessage: string;
  rows: SalaryRow[];
  totals: SalariesTotals | null;
  reload: () => Promise<void>;
  pay: (staffIds: string[], method: string) => Promise<{ paid: string[]; skipped: string[] }>;
  saveSalary: (salary: Omit<Salary, 'id'> & { staffId: string; mode: SalaryMode }) => Promise<void>;
}

function isForbidden(error: unknown): boolean {
  return (error as { status?: number } | undefined)?.status === 403;
}

/** Salariile lunii (23c) — orice apel cu 403 (PIN neconfigurat/blocat) trece ecranul pe „locked”. */
export function useSalaries(month: string): SalariesData {
  const session = useAppSession();
  const [rows, setRows] = useState<SalaryRow[]>([]);
  const [totals, setTotals] = useState<SalariesTotals | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed' | 'locked'>('loading');
  const [failureMessage, setFailureMessage] = useState('');

  async function load() {
    setStatus('loading');
    try {
      const response = (await requestJson(`/api/personal/salaries?month=${month}`)) as {
        rows: SalaryRow[];
        totals: SalariesTotals;
      };
      setRows(response.rows);
      setTotals(response.totals);
      setStatus('ready');
    } catch (error) {
      if (isForbidden(error)) {
        setStatus('locked');
      } else {
        setFailureMessage((error as Error).message);
        setStatus('failed');
      }
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  // Plata scrie o cheltuială în filiala activă (`runRevisionTransaction`) — trece prin
  // session.mutate ca orice altă scriere pe branch, nu prin requestJson direct: altfel
  // reușește o dată și apoi 409 „date modificate în altă filă” la orice mutație normală.
  async function pay(staffIds: string[], method: string): Promise<{ paid: string[]; skipped: string[] }> {
    const response = (await session.mutate('/api/personal/salaries/pay', {
      staffIds,
      month,
      method,
      date: today(),
    })) as { paid: string[]; skipped: string[] };
    await load();
    return response;
  }

  async function saveSalary(salary: Omit<Salary, 'id'> & { staffId: string; mode: SalaryMode }) {
    await requestJson('/api/personal/salaries', { id: `SAL-${crypto.randomUUID()}`, ...salary });
    await load();
  }

  return { status, failureMessage, rows, totals, reload: load, pay, saveSalary };
}
