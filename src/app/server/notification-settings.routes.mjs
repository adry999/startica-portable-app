import { writeJsonFileAtomically } from '#core/server/files/json-file.mjs';
import {
  clampNotificationPreferences,
  parseNotificationPreferences,
} from '#shared/domain/notification-preferences.mjs';

const AUDIT_ACTION = 'configurare notificări';
// Numele fișierului-oglindă citit de lansator (C#) la (re)înregistrarea sarcinii programate.
export const SCHEDULE_FILE_NAME = 'notify-schedule.json';

/**
 * @param {{ scheduleFile: string, readSetting: (key: string) => string, writeSetting: (key: string, value: string) => void, auditTrail: import('#shared/contracts/audit-trail.mjs').AuditTrail }} dependencies
 */
export function createNotificationSettingsRoutes({ scheduleFile, readSetting, writeSetting, auditTrail }) {
  const readPreferences = () => parseNotificationPreferences(readSetting('notificationPreferences'));

  return [
    { method: 'GET', path: '/api/notification-settings', handle: () => readPreferences() },
    {
      method: 'POST',
      path: '/api/notification-settings',
      /** @param {{ body: any }} request */
      handle: ({ body }) => {
        const before = readPreferences();
        const after = clampNotificationPreferences(body);
        writeSetting('notificationPreferences', JSON.stringify(after));
        // Oglindă pentru lansator (C#, fără driver SQLite): la fiecare (re)înregistrare a
        // sarcinii programate citește doar ora, dintr-un fișier mic, separat de
        // `telegram.json` (acela înseamnă „conectat”, nu doar „are o oră configurată”).
        // Calea e fixă, la instalare (decizia 8 din planul Filiale) — apelantul dă
        // mereu folderul filialei migrate, indiferent ce filială e activă la salvare.
        writeJsonFileAtomically(scheduleFile, { digestTime: after.digestTime });
        auditTrail.recordChange({
          action: AUDIT_ACTION,
          recordType: null,
          recordId: null,
          before,
          after,
        });
        return { ok: true, ...after };
      },
    },
  ];
}
