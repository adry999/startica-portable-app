// §5.3 (36h): „Serverul local: fiecare cerere /api verifică profilul și răspunde 403, deci
// un modul nu se poate deschide nici ocolind interfața.” Acest fișier e singura hartă
// cale → modul pentru `route-dispatcher.mjs` — testul de arhitectură
// (tests/architecture/route-modules-coverage.test.mjs) verifică, prin scanarea codului sursă
// al rutelor, că orice cale `/api/*` înregistrată apare fie aici, fie în `OPEN_PATHS`.
//
// GET cere acces de citire (Vede, nivel 1), POST cere Modifică (nivel 2) — convenția
// existentă deja separă citirea de scriere pe metodă (vezi route-dispatcher.mjs:
// `assertAuthorizedWrite` se aplică doar POST-urilor).
import { ACCESS_READ, ACCESS_WRITE, KIND_MODULE } from '#shared/domain/computer-profile.mjs';

/**
 * O cale poate avea un singur modul, sau o listă (oricare dintre ele e suficient — ex.
 * cursul BNM îl citesc atât Administrare cât și un profil Personalizat cu acces la Achitări).
 * @type {Record<string, string | string[]>}
 */
export const STATIC_PATH_MODULE = {
  '/api/children-csv-preview': 'children',
  '/api/children-csv': 'children',
  // fee-setup (Taxe și grupe) — parte din „De rezolvat” (resolve), ca restul ecranului.
  '/api/children-setup': 'resolve',
  '/api/category-delete': 'expenses',
  '/api/category-rename': 'expenses',
  '/api/group-delete': 'groups',
  '/api/payer-alias-delete': 'payments',
  '/api/payments-assign': 'resolve',
  '/api/payments-receipt-number': 'payments',
  '/api/visits-enrol': 'visits',
  '/api/attendance': 'attendance',

  '/api/personal/state': 'personal',
  '/api/personal/staff': 'personal',
  '/api/personal/staff-archive': 'personal',
  '/api/personal/roles': 'personal',
  '/api/personal/timesheet': 'personal',
  '/api/personal/timesheet-fill': 'personal',
  '/api/personal/leaves': 'personal',
  '/api/personal/candidates': 'personal',
  '/api/personal/candidates-delete': 'personal',
  '/api/personal/settings': 'personal',
  // PIN-ul salariilor (pin.service.mjs) rămâne propria gardă, pe lângă modulul `personal` —
  // vezi PinGate.tsx/usePinStatus; gărzile se adună, nu se înlocuiesc una pe alta.
  '/api/personal/pin': 'personal',
  '/api/personal/pin/unlock': 'personal',
  '/api/personal/pin/lock': 'personal',
  '/api/personal/salaries': 'personal',
  '/api/personal/salaries/pay': 'personal',
  '/api/personal/advances': 'personal',
  '/api/personal/salaries/history': 'personal',

  '/api/pool/settings': 'pool',
  '/api/pool/week': 'pool',
  '/api/pool/bookings': 'pool',
  '/api/pool/sessions': 'pool',
  '/api/pool/month': 'pool',
  '/api/pool/close-month': 'pool',

  // De notificat (SMS către părinți cu restanțe) — consumatorul operațional al sms-notify/.
  '/api/sms-status': 'notify',
  '/api/sms-send': 'notify',
  '/api/sms-last-notified': 'notify',
  '/api/sms-refresh-statuses': 'notify',
  '/api/sms-log': 'notify',
  '/api/sms-templates': 'notify',
  // Conectarea furnizorului SMS și gestiunea șabloanelor rămân administrative.
  '/api/sms-connect': 'admin',
  '/api/sms-disconnect': 'admin',
  '/api/sms-test': 'admin',
  '/api/sms-template-save': 'admin',
  '/api/sms-template-delete': 'admin',

  '/api/telegram-status': 'admin',
  '/api/telegram-connect': 'admin',
  '/api/telegram-disconnect': 'admin',
  '/api/telegram-test': 'admin',

  '/api/sync/connect': 'admin',
  '/api/sync/disconnect': 'admin',
  '/api/sync/pairing-codes': 'admin',
  '/api/sync/devices': 'admin',
  '/api/sync/devices/revoke': 'admin',
  '/api/sync/devices/profile': 'admin',
  '/api/sync/conflicts': 'admin',
  '/api/sync/conflicts/resolve': 'admin',

  '/api/update/download': 'admin',
  '/api/update/pending': 'admin',

  '/api/health': 'admin',
  '/api/backups': 'admin',
  '/api/external-backups': 'admin',
  '/api/backup-preview': 'admin',
  '/api/backup': 'admin',
  '/api/restore': 'admin',
  '/api/settings': 'admin',
  '/api/kindergarten': 'admin',
  '/api/notification-settings': 'admin',
  '/api/plan-presets': 'admin',
  '/api/exchange-rates/refresh': 'admin',
  '/api/exchange-rates/backfill': 'admin',
  // Folosit doar de scripts/migrate/ (PROMPT-9 §8) — mutarea cursului în baza comună.
  '/api/exchange-rates/import': 'admin',
  '/api/diagnostic': 'admin',
  // Cursul BNM e citit și folosit de orice ecran care precompletează o plată — gardat generic,
  // nu doar pe Administrare.
  '/api/exchange-rates': ['admin', 'payments'],

  '/api/branches': 'admin', // doar POST (creare); GET e în OPEN_GET_PATHS
  '/api/branches/update': 'admin',
  // Raportul contabil „ambele filiale” (report) citește read-only datele celeilalte filiale.
  '/api/branches/records': 'report',

  '/api/audit': 'admin',
  '/api/audit/access': 'admin',
  '/api/audit/scope': 'admin',

  '/api/import-preview': 'admin',
  '/api/financial-preview': 'admin',
  '/api/financial-import': 'admin',
  '/api/import': 'admin',
};

/**
 * Căi mereu deschise, fără gardă de modul PRIN resolveRouteModule — infrastructură (sesiune,
 * filiale, sincronizare de bază) necesară oricărui profil, inclusiv unuia blocat (ca să poată
 * arăta ecranul `profil.blocked`), plus `/api/record`/`/api/record-delete`, rezolvate dinamic
 * mai jos (nu lipsesc din acoperire — vezi testul de arhitectură).
 *
 * `/api/undo`: modulul nu se poate ști din corpul cererii (doar `auditId`) — depinde de
 * `recordType`-ul intrării, cunoscut abia după căutarea ei în audit log. De-aia e în lista de
 * mai jos (resolveRouteModule nu-l poate gărda dinainte de dispatch), dar NU e nepăzit: garda
 * reală rulează chiar în handler (`undo.routes.mjs`, `assertModuleAccess`/`assertPinUnlocked`
 * pe modulul calculat din `KIND_MODULE[entry.recordType]`), fiindcă `checkUndoEligibility`
 * (15s, aceeași sesiune) nu garantează că profilul mai are acces ACUM — poate fi restrâns
 * de pe alt calculator conectat chiar în acea fereastră (AUDIT-COD-02-10.md #5).
 */
export const OPEN_PATHS = new Set([
  '/api/session',
  '/api/state',
  '/api/shutdown',
  '/api/branches/select',
  '/api/sync/status',
  '/api/sync/events',
  '/api/sync/now',
  '/api/sync/server',
  '/api/record',
  '/api/record-delete',
  '/api/undo',
]);

/**
 * Căi deschise doar pe GET — POST pe aceeași cale trece prin STATIC_PATH_MODULE.
 * `/api/branches`: lista de filiale (GET) e necesară înainte ca sesiunea să existe
 * (ecranul de pornire); crearea unei filiale noi (POST) rămâne gardată la `admin`.
 */
export const OPEN_GET_PATHS = new Set(['/api/branches']);

/** Tipul din corp al cererii, pentru rutele generice (/api/record, /api/record-delete). */
export const DYNAMIC_RECORD_PATHS = new Set(['/api/record', '/api/record-delete']);

/**
 * §7 (36h): rutele PIN-ului însuși (stare, setare, deblocare, blocare) nu trec prin
 * `assertPinUnlocked` — altfel un profil care adaugă `personal` la `pinModules` (toate căile
 * `/api/personal/*`, inclusiv acestea trei, au modulul `personal`) nu s-ar mai putea debloca
 * niciodată: cere PIN-ul ca să poți citi dacă PIN-ul e configurat. Gărzile `assertModuleAccess`
 * (modul) și cele interne din `salaries.routes.mjs` (`pinService.assertUnlocked()` pe
 * salarii/avansuri) rămân neschimbate — doar hook-ul generic de mai jos le ocolește pe acestea trei.
 */
export const PIN_GATE_EXEMPT_PATHS = new Set([
  '/api/personal/pin',
  '/api/personal/pin/unlock',
  '/api/personal/pin/lock',
]);

/**
 * @param {{ method: 'GET' | 'POST', path: string, body?: unknown }} request
 * @returns {{ moduleId: string | string[], write: boolean, pinExempt: boolean } | null}
 */
export function resolveRouteModule({ method, path, body }) {
  if (DYNAMIC_RECORD_PATHS.has(path)) {
    const type = /** @type {{ type?: string } | undefined} */ (body)?.type;
    const moduleId = type ? KIND_MODULE[type] : undefined;
    // Un tip necunoscut/lipsă nu e o gaură de securitate: ruta însăși respinge cererea
    // (record-editing.routes.mjs validează `type`) înainte să ajungă la vreo scriere reală.
    return moduleId ? { moduleId, write: true, pinExempt: false } : null;
  }
  if (method === 'GET' && OPEN_GET_PATHS.has(path)) return null;
  if (OPEN_PATHS.has(path)) return null;
  const moduleId = STATIC_PATH_MODULE[path];
  if (!moduleId) return null;
  return { moduleId, write: method === 'POST', pinExempt: PIN_GATE_EXEMPT_PATHS.has(path) };
}

/** Pentru `assertModuleAccess` din create-branch-context.mjs: nivelul minim cerut. */
export function accessLevelFor(write) {
  return write ? ACCESS_WRITE : ACCESS_READ;
}
