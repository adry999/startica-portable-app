import type { AppSession } from './session';

export type SessionScreenStatus = 'loading' | 'ready' | 'failed';

export interface SessionStatus {
  status: SessionScreenStatus;
  failureMessage: string;
}

/**
 * Starea comună a ecranelor derivate direct din `session.state` (m16, dedup): 'ready' odată ce
 * primul /api/state a reușit, altfel 'loading' cât timp e în curs sau nu există încă o eroare,
 * 'failed' cu mesajul serverului dacă a eșuat fără date anterioare. Repetată identic în hook-uri
 * ca useNotify/useChildren/useChildProfile/usePayments — nu e hook (nu are stare proprie sau efect),
 * doar o funcție derivată, apelată cu `session.state` din hook-ul apelant.
 */
export function useSessionStatus(state: AppSession['state']): SessionStatus {
  if (state.ready) return { status: 'ready', failureMessage: '' };
  return { status: state.loading || !state.saveError ? 'loading' : 'failed', failureMessage: state.saveError };
}
