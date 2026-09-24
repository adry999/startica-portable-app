import type { ViewKey } from './nav-items';
import type { SearchResult } from './search-records';

/** Calea din URL pentru fiecare modul — sursa unică pentru navigare și pentru derivarea modulului activ din locație. */
export const VIEW_PATHS: Record<ViewKey, string> = {
  dashboard: '/',
  children: '/copii',
  groups: '/grupe',
  visits: '/vizite',
  payments: '/achitari',
  expenses: '/cheltuieli',
  status: '/situatia-platilor',
  notify: '/de-notificat',
  fees: '/taxe-si-grupe',
  review: '/de-verificat',
  assign: '/asociere-achitari',
  audit: '/istoric',
  notifications: '/notificari',
  settings: '/backup-si-setari',
};

const SEGMENT_TO_VIEW: Record<string, ViewKey> = Object.fromEntries(
  (Object.entries(VIEW_PATHS) as [ViewKey, string][]).map(([view, path]) => [path.replace(/^\//, ''), view]),
);

/** Modulul activ, derivat din primul segment al căii — funcționează și pentru rutele imbricate (/copii/:id). */
export function viewForPathname(pathname: string): ViewKey {
  const segment = pathname.split('/')[1] ?? '';
  return SEGMENT_TO_VIEW[segment] ?? 'dashboard';
}

/** Ținta de navigare pentru un rezultat din căutarea globală — deschide direct fișa/formularul. */
export function pathForSearchResult(result: SearchResult): string {
  return `${VIEW_PATHS[result.type]}/${result.id}`;
}
