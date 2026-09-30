/**
 * Catalogul textelor pentru stările goale (docs/design/screens/30-stari-goale.md §35b) — ecranele
 * dau doar `empty="<cheie>"` (prin `DataTable`/`EmptyState`), textul stă aici, nu în `features/`
 * (R9, DS-IMPLEMENTARE.md §1). „Fără rezultate" (căutare/filtre active) NU e în acest catalog —
 * are prioritate peste orice cheie și textul ei e generic, generat direct de consumator.
 */

export type EmptyStateKey =
  | 'achitari.period'
  | 'prezenta.weekend'
  | 'grupe.first'
  | 'personal.first'
  | 'vizite.first'
  | 'bazin.first'
  | 'situatia.done'
  | 'denotificat.done'
  | 'sms.first'
  | 'cheltuieli.period';

export interface EmptyStateCatalogEntry {
  variant: 'first' | 'done' | 'period';
  /** Text fix, sau funcție când titlul depinde de parametri (ex. `{luna}`, `{Zi}`, `{data}`). */
  title: string | ((params: Record<string, string>) => string);
  actionLabel?: string;
}

export const EMPTY_STATES: Record<EmptyStateKey, EmptyStateCatalogEntry> = {
  'achitari.period': {
    variant: 'period',
    title: params => `Nicio achitare în ${params.luna ?? 'luna aleasă'}`,
    actionLabel: '+ Achitare nouă',
  },
  'prezenta.weekend': {
    variant: 'period',
    title: params => `${params.zi ?? 'Zi liberă'}, ${params.data ?? ''}`.trim(),
  },
  'grupe.first': {
    variant: 'first',
    title: 'Nicio grupă încă',
    actionLabel: '+ Grupă nouă',
  },
  'personal.first': {
    variant: 'first',
    title: 'Niciun angajat adăugat',
    actionLabel: '+ Angajat nou',
  },
  'vizite.first': {
    variant: 'first',
    title: 'Nicio vizită programată',
    actionLabel: '+ Programează vizită',
  },
  'bazin.first': {
    variant: 'first',
    title: 'Niciun copil la bazin',
    actionLabel: '+ Înscrie la bazin',
  },
  'situatia.done': {
    variant: 'done',
    title: params => `Toți au achitat ${params.luna ?? 'luna aleasă'}`,
  },
  'denotificat.done': {
    variant: 'done',
    title: 'Nimeni de notificat',
  },
  'sms.first': {
    variant: 'first',
    title: 'Niciun SMS trimis',
    actionLabel: '+ SMS nou',
  },
  'cheltuieli.period': {
    variant: 'period',
    title: params => `Nicio cheltuială în ${params.luna ?? 'luna aleasă'}`,
    actionLabel: '+ Cheltuială nouă',
  },
};

export function resolveEmptyStateTitle(entry: EmptyStateCatalogEntry, params?: Record<string, string>): string {
  return typeof entry.title === 'function' ? entry.title(params ?? {}) : entry.title;
}
