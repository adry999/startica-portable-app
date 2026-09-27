import { fail } from '#core/server/errors/domain-error.mjs';
import { monthOK } from '#shared/domain/calendar-month.mjs';
import { createPinService } from './pin.service.mjs';
import { createSalariesService } from './salaries.service.mjs';

const YEAR_OK = /^\d{4}$/;

/**
 * Salariile, avansurile și PIN-ul (decizia 8 din plan): fiecare rută sub `/api/personal/salaries*`
 * și `/api/personal/advances*` cere `pinService.assertUnlocked()` — o cortină, nu securitate.
 * @param {{
 *   common: { readSetting: (key: string) => string, writeSetting: (key: string, value: string) => void, pinSession: { unlockedUntil: number, failedAttempts: number, lockedUntil: number } },
 *   branchId: string,
 *   personalRepository: import('./personal.repository.mjs').PersonalRepository,
 *   recordRepository: import('#shared/contracts/persistence.mjs').RecordRepository,
 *   runRevisionTransaction: import('#shared/contracts/persistence.mjs').RunRevisionTransaction,
 *   auditTrail: import('#shared/contracts/audit-trail.mjs').AuditTrail,
 *   readCoachPayForMonth?: (staffId: string, month: string) => unknown,
 * }} dependencies
 */
export function createSalariesRoutes({
  common,
  branchId,
  personalRepository,
  recordRepository,
  runRevisionTransaction,
  auditTrail,
  readCoachPayForMonth,
}) {
  const pinService = createPinService({
    readSetting: common.readSetting,
    writeSetting: common.writeSetting,
    pinSession: common.pinSession,
  });
  const salariesService = createSalariesService({
    personalRepository,
    branchId,
    recordRepository,
    runRevisionTransaction,
    auditTrail,
    readCoachPayForMonth,
  });

  return [
    { method: 'GET', path: '/api/personal/pin', handle: () => pinService.status() },
    {
      method: 'POST',
      path: '/api/personal/pin',
      /** @param {{ body: { pin?: string, currentPin?: string } }} request */
      handle: ({ body }) => pinService.set({ pin: /** @type {string} */ (body?.pin), currentPin: body?.currentPin }),
    },
    {
      method: 'POST',
      path: '/api/personal/pin/unlock',
      /** @param {{ body: { pin?: string } }} request */
      handle: ({ body }) => pinService.unlock(/** @type {string} */ (body?.pin)),
    },
    { method: 'POST', path: '/api/personal/pin/lock', handle: () => pinService.lock() },
    {
      method: 'GET',
      path: '/api/personal/salaries',
      /** @param {{ url: URL }} request */
      handle: ({ url }) => {
        pinService.assertUnlocked();
        const month = url.searchParams.get('month');
        if (!month || !monthOK(month)) fail('Lună invalidă.');
        return salariesService.listMonth(month);
      },
    },
    {
      method: 'POST',
      path: '/api/personal/salaries',
      /** @param {{ body: unknown }} request */
      handle: ({ body }) => {
        pinService.assertUnlocked();
        return { salary: personalRepository.saveSalary(body) };
      },
    },
    {
      method: 'POST',
      path: '/api/personal/salaries/pay',
      /** @param {{ body: any }} request */
      handle: ({ body }) => {
        pinService.assertUnlocked();
        return salariesService.pay(body);
      },
    },
    {
      method: 'GET',
      path: '/api/personal/advances',
      /** @param {{ url: URL }} request */
      handle: ({ url }) => {
        pinService.assertUnlocked();
        const year = url.searchParams.get('year');
        if (!year || !YEAR_OK.test(year)) fail('An invalid.');
        return { advances: personalRepository.advancesForYear(year) };
      },
    },
    {
      method: 'POST',
      path: '/api/personal/advances',
      /** @param {{ body: { advance?: any, id?: string, remove?: boolean, revision?: number, requestId?: string } }} request */
      handle: ({ body }) => {
        pinService.assertUnlocked();
        if (body?.remove)
          return salariesService.removeAdvance({
            id: /** @type {string} */ (body.id),
            revision: /** @type {number} */ (body.revision),
            requestId: /** @type {string} */ (body.requestId),
          });
        return salariesService.giveAdvance({ ...body?.advance, revision: body?.revision, requestId: body?.requestId });
      },
    },
    {
      method: 'GET',
      path: '/api/personal/salaries/history',
      /** @param {{ url: URL }} request */
      handle: ({ url }) => {
        pinService.assertUnlocked();
        const staffId = url.searchParams.get('staffId');
        if (!staffId) fail('Angajat invalid.');
        return salariesService.history(staffId);
      },
    },
  ];
}
