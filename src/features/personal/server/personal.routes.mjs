import { fail } from '#core/server/errors/domain-error.mjs';
import { dateOK, monthOK } from '#shared/domain/calendar-month.mjs';
import { createPersonalRepository } from './personal.repository.mjs';
import { createLeavesService } from './leaves.service.mjs';
import { createSalariesRoutes } from './salaries.routes.mjs';
import { weekStartOf, computePresentWeekFill, computeCopyPreviousWeekFill } from '../domain/timesheet-week-fill.mjs';

const AUDIT_STAFF = 'personal: angajat';
const AUDIT_ROLES = 'personal: funcții și departamente';
const AUDIT_LEAVE = 'personal: concediu';
const AUDIT_SETTINGS = 'personal: setări';
const AUDIT_CANDIDATE = 'personal: candidat';
const AUDIT_TIMESHEET_FILL = 'personal: pontaj — completare săptămână';
const MAX_TIMESHEET_CHANGES = 500;
const TIMESHEET_FILL_MODES = ['present', 'copy-previous-week'];
const YEAR_OK = /^\d{4}$/;

/**
 * Rutele Personal 24 (Faza 1–2, backend): echipa, funcțiile, pontajul și concediile ale
 * filialei active, pe baza comună `common`. Auditul intră în `audit_changes` al filialei
 * active, cu `recordType: null` (precedentul „filiale”) — operatorul era acolo, Istoricul
 * rămâne un singur ecran, chiar dacă datele trăiesc în altă bază.
 * @param {{
 *   common: import('./personal.repository.mjs').CommonContextPort & { pinSession: { unlockedUntil: number, failedAttempts: number, lockedUntil: number } },
 *   branchId: string,
 *   listBranches: () => { id: string }[],
 *   auditTrail: import('#shared/contracts/audit-trail.mjs').AuditTrail,
 *   recordRepository: import('#shared/contracts/persistence.mjs').RecordRepository,
 *   runRevisionTransaction: import('#shared/contracts/persistence.mjs').RunRevisionTransaction,
 *   readCoachPayForMonth?: (staffId: string, month: string) => unknown,
 *   pinService?: ReturnType<typeof import('./pin.service.mjs').createPinService>,
 * }} dependencies
 */
export function createPersonalRoutes({
  common,
  branchId,
  listBranches,
  auditTrail,
  recordRepository,
  runRevisionTransaction,
  readCoachPayForMonth,
  pinService,
}) {
  const repository = createPersonalRepository(common);
  const listGroups = () => /** @type {any} */ (recordRepository.readSnapshot()).groups;
  const leavesService = createLeavesService({ repository, listGroups });
  const salariesRoutes = createSalariesRoutes({
    common,
    branchId,
    personalRepository: repository,
    recordRepository,
    runRevisionTransaction,
    auditTrail,
    readCoachPayForMonth,
    ...(pinService ? { pinService } : {}),
  });

  const branchStaffIds = () => repository.staffForBranch(branchId).map(staff => staff.id);

  function handleState() {
    return {
      departments: repository.departments(),
      roles: repository.roles(),
      staff: repository.staffForBranch(branchId),
      settings: repository.readSettings(),
    };
  }

  /** @param {{ body: { mode?: string, staff?: any } }} request */
  function handleSaveStaff({ body }) {
    const mode = body?.mode;
    if (mode !== 'create' && mode !== 'update') fail('Mod de salvare invalid.');
    const input = body?.staff;
    const registryIds = new Set(listBranches().map(branch => branch.id));
    if (!Array.isArray(input?.branchIds) || !input.branchIds.every(id => registryIds.has(id)))
      fail('Filiala aleasă nu există.');
    const before = mode === 'update' ? repository.kinds.find('staff', input.id) : null;
    const staff = repository.saveStaff(input, mode);
    auditTrail.recordChange({ action: AUDIT_STAFF, recordType: null, recordId: staff.id, before, after: staff });
    return { staff };
  }

  // O acțiune de arhivare cere explicit o dată validă: fără ea, `normalizePersonalRecord`
  // pune `archivedAt ??= null` și angajatul se dez-arhivează în tăcere (m4). Dez-arhivarea
  // e o acțiune separată, prin `POST /api/personal/staff` cu `archivedAt: null` explicit.
  /** @param {{ body: { id?: string, archivedAt?: string } }} request */
  function handleArchiveStaff({ body }) {
    const id = body?.id;
    if (typeof id !== 'string') fail('Angajat invalid.');
    const archivedAt = body?.archivedAt;
    if (typeof archivedAt !== 'string' || !dateOK(archivedAt)) fail('Data încetării este invalidă.');
    const before = repository.kinds.find('staff', id);
    if (before && archivedAt < before.since) fail('Data încetării nu poate fi înainte de angajare.');
    const staff = repository.archiveStaff(id, archivedAt);
    auditTrail.recordChange({ action: AUDIT_STAFF, recordType: null, recordId: id, before, after: staff });
    return { staff };
  }

  /** @param {{ body: { departments?: unknown[], roles?: unknown[] } }} request */
  function handleSaveRoles({ body }) {
    const result = repository.replaceDepartmentsAndRoles(
      /** @type {any} */ (body?.departments),
      /** @type {any} */ (body?.roles),
    );
    auditTrail.recordChange({ action: AUDIT_ROLES, recordType: null, recordId: null, before: null, after: result });
    return result;
  }

  /** @param {{ url: URL }} request */
  function handleGetTimesheet({ url }) {
    const month = url.searchParams.get('month');
    if (!month || !monthOK(month)) fail('Lună invalidă.');
    return { rows: repository.timesheetForMonth(month, branchStaffIds()) };
  }

  /** @param {{ body: { changes?: unknown } }} request */
  function handlePostTimesheet({ body }) {
    const changes = /** @type {any[]} */ (body?.changes);
    if (!Array.isArray(changes) || changes.length === 0) fail('Lista de schimbări este goală.');
    if (changes.length > MAX_TIMESHEET_CHANGES) fail('Prea multe schimbări într-o singură cerere.');
    const allowed = new Set(branchStaffIds());
    for (const change of changes) if (!allowed.has(change?.staffId)) fail('Angajat inexistent în filiala activă.');
    const { saved } = repository.applyTimesheetChanges(changes);
    return { ok: true, rows: saved };
  }

  /**
   * Completare rapidă pe săptămână (§9.2/41b, WeekFillBar + „Prezent toată săptămâna” pe rând):
   * un singur `recordChange` pentru tot lotul, ca să poată fi anulată ca o singură acțiune (§8.2) —
   * spre deosebire de `handlePostTimesheet`, care nu scrie în istoric (editare celulă cu celulă,
   * prea frecventă ca să merite un rând de audit fiecare).
   * @param {{ body: { mode?: string, weekStart?: string, staffIds?: string[] } }} request
   */
  function handlePostTimesheetFill({ body }) {
    const mode = body?.mode;
    if (typeof mode !== 'string' || !TIMESHEET_FILL_MODES.includes(mode)) fail('Mod de completare invalid.');
    const rawWeekStart = body?.weekStart;
    if (typeof rawWeekStart !== 'string' || !dateOK(rawWeekStart)) fail('Săptămâna este invalidă.');
    const weekStart = weekStartOf(rawWeekStart);

    const allowed = new Set(branchStaffIds());
    const staffIds = Array.isArray(body?.staffIds) && body.staffIds.length > 0 ? body.staffIds : [...allowed];
    if (staffIds.length === 0) fail('Niciun angajat de completat.');
    for (const staffId of staffIds) if (!allowed.has(staffId)) fail('Angajat inexistent în filiala activă.');

    const existing = repository.timesheetForWeeksAround(weekStart);
    const hasRow = (staffId, date) => existing.has(repository.timesheetRowId(staffId, date));
    const readCode = (staffId, date) => existing.get(repository.timesheetRowId(staffId, date))?.code ?? null;

    const changes =
      mode === 'present'
        ? computePresentWeekFill({ staffIds, weekStart, hasRow })
        : computeCopyPreviousWeekFill({ staffIds, weekStart, hasRow, readCode });

    if (changes.length === 0) return { ok: true, rows: [], filled: 0 };

    const { saved } = repository.applyTimesheetChanges(changes);
    auditTrail.recordChange({
      action: AUDIT_TIMESHEET_FILL,
      recordType: null,
      recordId: null,
      before: changes.map(({ staffId, date }) => ({ staffId, date, code: null })),
      after: changes,
    });
    return { ok: true, rows: saved, filled: changes.length };
  }

  /** @param {{ url: URL }} request */
  function handleGetLeaves({ url }) {
    const year = url.searchParams.get('year');
    if (!year || !YEAR_OK.test(year)) fail('An invalid.');
    return leavesService.leavesForYear(year, branchStaffIds());
  }

  /** @param {{ body: { leave?: unknown, id?: string, remove?: boolean } }} request */
  function handlePostLeaves({ body }) {
    if (body?.remove) {
      const id = /** @type {string} */ (body.id);
      const before = repository.kinds.find('leaves', id);
      const removed = leavesService.removeLeave(id);
      auditTrail.recordChange({ action: AUDIT_LEAVE, recordType: null, recordId: id, before, after: null });
      return { leave: removed };
    }
    const input = /** @type {{ id?: string, staffId?: string }} */ (body?.leave);
    // La fel ca pontajul (:109): fără verificare, un staffId inexistent sau al celeilalte
    // filiale scria rânduri de pontaj orfane (m10).
    if (typeof input?.staffId !== 'string' || !branchStaffIds().includes(input.staffId))
      fail('Angajat inexistent în filiala activă.');
    const before = input?.id ? repository.kinds.find('leaves', input.id) : null;
    const leave = leavesService.saveLeave(input);
    auditTrail.recordChange({ action: AUDIT_LEAVE, recordType: null, recordId: leave.id, before, after: leave });
    return { leave };
  }

  function handleGetCandidates() {
    return { candidates: repository.candidates() };
  }

  /** @param {{ body: { mode?: string, candidate?: any } }} request */
  function handleSaveCandidate({ body }) {
    const mode = body?.mode;
    if (mode !== 'create' && mode !== 'update') fail('Mod de salvare invalid.');
    const input = body?.candidate;
    const before = mode === 'update' ? repository.kinds.find('candidates', input?.id) : null;
    const candidate = repository.saveCandidate(input, mode);
    auditTrail.recordChange({
      action: AUDIT_CANDIDATE,
      recordType: null,
      recordId: candidate.id,
      before,
      after: candidate,
    });
    return { candidate };
  }

  /** @param {{ body: { id?: string } }} request */
  function handleDeleteCandidate({ body }) {
    const id = body?.id;
    if (typeof id !== 'string') fail('Candidat invalid.');
    const before = repository.deleteCandidate(id);
    auditTrail.recordChange({ action: AUDIT_CANDIDATE, recordType: null, recordId: id, before, after: null });
    return { ok: true };
  }

  /** @param {{ body: { annualLeaveDays?: unknown, deductOnlyUnexcused?: unknown } }} request */
  function handleSaveSettings({ body }) {
    const settings = repository.writeSettings(body || {});
    auditTrail.recordChange({
      action: AUDIT_SETTINGS,
      recordType: null,
      recordId: null,
      before: null,
      after: settings,
    });
    return { settings };
  }

  return [
    { method: 'GET', path: '/api/personal/state', handle: handleState },
    { method: 'POST', path: '/api/personal/staff', handle: handleSaveStaff },
    { method: 'POST', path: '/api/personal/staff-archive', handle: handleArchiveStaff },
    { method: 'POST', path: '/api/personal/roles', handle: handleSaveRoles },
    { method: 'GET', path: '/api/personal/timesheet', handle: handleGetTimesheet },
    { method: 'POST', path: '/api/personal/timesheet', handle: handlePostTimesheet },
    { method: 'POST', path: '/api/personal/timesheet-fill', handle: handlePostTimesheetFill },
    { method: 'GET', path: '/api/personal/leaves', handle: handleGetLeaves },
    { method: 'POST', path: '/api/personal/leaves', handle: handlePostLeaves },
    { method: 'GET', path: '/api/personal/candidates', handle: handleGetCandidates },
    { method: 'POST', path: '/api/personal/candidates', handle: handleSaveCandidate },
    { method: 'POST', path: '/api/personal/candidates-delete', handle: handleDeleteCandidate },
    { method: 'POST', path: '/api/personal/settings', handle: handleSaveSettings },
    ...salariesRoutes,
  ];
}
