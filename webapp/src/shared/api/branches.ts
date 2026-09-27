import { requestJson } from './session';
import type { RecordsSnapshot } from '@contracts/record-types.mjs';

/** O filială din registru (`filiale.json`), fără contoare — vezi `#shared/domain/branch.mjs`. */
export interface BranchEntry {
  id: string;
  name: string;
  color: string;
  address: string;
  createdAt: string;
  folder: string | null;
}

/** O filială cu contoarele citite read-only din baza ei — răspunsul `GET /api/branches`. */
export interface BranchSummary extends BranchEntry {
  children: number;
  groups: number;
  lastLocal: string;
}

export interface BranchesList {
  activeBranchId: string;
  branches: BranchSummary[];
}

/** Lista filialelor cu contoare, folosită de fila „Filiale” (13c) și de exportul „Ambele” (20). */
export function fetchBranches(): Promise<BranchesList> {
  return requestJson('/api/branches') as Promise<BranchesList>;
}

export async function createBranch(input: { name: string; color?: string; address?: string }): Promise<BranchEntry> {
  const response = (await requestJson('/api/branches', input)) as { branch: BranchEntry };
  return response.branch;
}

export async function updateBranch(input: {
  id: string;
  name?: string;
  color?: string;
  address?: string;
}): Promise<BranchEntry> {
  const response = (await requestJson('/api/branches/update', input)) as { branch: BranchEntry };
  return response.branch;
}

/** Citire read-only a datelor altei filiale (nu a celei deschise) — vezi `20-raport-contabil.md`, „Ambele”. */
export async function fetchBranchRecords(id: string): Promise<RecordsSnapshot> {
  const response = (await requestJson(`/api/branches/records?id=${encodeURIComponent(id)}`)) as {
    state: RecordsSnapshot;
  };
  return response.state;
}
