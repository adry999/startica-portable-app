import { useEffect, useState } from 'react';
import { requestJson } from '@shared/api/session';
import type { Candidate } from '@shared/personal/personal.types';
import { toUserError } from '@shared/api/to-user-error';

export interface CandidateFormInput {
  id?: string;
  name: string;
  position: string;
  age: number | null;
  experience: string;
  city: string;
  phone: string;
  notes: string;
}

export interface CandidatesData {
  status: 'loading' | 'ready' | 'failed';
  failureMessage: string;
  candidates: Candidate[];
  reload: () => Promise<void>;
  saveCandidate: (input: CandidateFormInput) => Promise<Candidate>;
  deleteCandidate: (id: string) => Promise<void>;
}

/** Candidați (23l) — listă simplă, comună ambelor filiale, fără PIN. */
export function useCandidates(): CandidatesData {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [failureMessage, setFailureMessage] = useState('');

  async function load() {
    setStatus('loading');
    try {
      const response = (await requestJson('/api/personal/candidates')) as { candidates: Candidate[] };
      setCandidates(response.candidates);
      setStatus('ready');
    } catch (error) {
      setFailureMessage(toUserError(error));
      setStatus('failed');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveCandidate(input: CandidateFormInput): Promise<Candidate> {
    const mode = input.id ? 'update' : 'create';
    const candidate = { ...input, id: input.id ?? `CAN-${crypto.randomUUID()}` };
    const response = (await requestJson('/api/personal/candidates', { mode, candidate })) as {
      candidate: Candidate;
    };
    await load();
    return response.candidate;
  }

  async function deleteCandidate(id: string): Promise<void> {
    await requestJson('/api/personal/candidates-delete', { id });
    await load();
  }

  return { status, failureMessage, candidates, reload: load, saveCandidate, deleteCandidate };
}
