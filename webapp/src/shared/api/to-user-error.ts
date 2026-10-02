import { ApiError } from '@core/web/api-error.mjs';

const CONFLICT_MESSAGE = 'Altcineva a modificat între timp. Reîncarcă și încearcă din nou.';
const UNEXPECTED_RESPONSE_MESSAGE = 'Serverul a răspuns neașteptat. Reîncarcă pagina și verifică jurnalele.';
const NETWORK_FAILURE_MESSAGE = 'Conexiune întreruptă. Verifică rețeaua și încearcă din nou.';
const GENERIC_MESSAGE = 'A apărut o eroare neașteptată. Încearcă din nou.';

// `fetch` aruncă un TypeError fără `.cause`/cod — browserele îl formulează diferit
// (Chrome „Failed to fetch”, Firefox „NetworkError…”, Safari „Load failed”).
const RAW_NETWORK_FAILURE_PATTERN = /failed to fetch|networkerror|load failed|network request failed/i;

/**
 * Traduce orice valoare prinsă într-un `catch` (eroare de rețea, `ApiError` de la server, eroare
 * JS oarecare) într-un text de arătat utilizatorului — fără cod HTTP, fără mesaj tehnic nefiltrat.
 * Un 409 are mereu textul ăsta fix, indiferent ce a trimis serverul: utilizatorul oricum trebuie
 * doar să reîncarce, nu să înțeleagă care anume revizie a expirat. Restul erorilor de domeniu
 * (400/403/404/413, din `fail()` — vezi `#core/server/errors/domain-error.mjs`) au deja text uman,
 * scris în română pentru operator; acelea trec neschimbate, ca să nu-l mascăm cu un mesaj generic
 * mai sărac.
 *
 * Aceeași distincție ca pe server (`route-dispatcher.mjs`): un `Error` simplu, aruncat deliberat
 * cu un mesaj scris de om (asta fac și mock-urile de teste când simulează un eșec de server), e
 * sigur de arătat; un `TypeError`/`RangeError`/`ReferenceError`/`SyntaxError` e o eroare de
 * programare — mesajul lui ("Cannot read properties of undefined…") n-are ce căuta pe ecran.
 */
export function toUserError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 409) return CONFLICT_MESSAGE;
    if (err.kind === 'network') return err.message;
    if (err.kind === 'rejected') return err.message || GENERIC_MESSAGE;
    return UNEXPECTED_RESPONSE_MESSAGE; // 'unexpected-response': mesajul conține codul HTTP, nu se arată direct.
  }
  if (err instanceof TypeError && RAW_NETWORK_FAILURE_PATTERN.test(err.message)) return NETWORK_FAILURE_MESSAGE;
  if (
    err instanceof TypeError ||
    err instanceof RangeError ||
    err instanceof ReferenceError ||
    err instanceof SyntaxError
  ) {
    return GENERIC_MESSAGE;
  }
  if (err instanceof Error && err.message) return err.message;
  return GENERIC_MESSAGE;
}
