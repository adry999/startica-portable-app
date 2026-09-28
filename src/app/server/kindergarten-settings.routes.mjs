import { clampKindergartenSettings, parseKindergartenSettings } from '#shared/domain/kindergarten-settings.mjs';

const AUDIT_ACTION = 'grădiniță: date și numerotare';

/**
 * @param {{
 *   readSetting: (key: string) => string,
 *   writeSetting: (key: string, value: string) => void,
 *   recordRepository: import('#shared/contracts/persistence.mjs').RecordRepository,
 *   auditTrail: import('#shared/contracts/audit-trail.mjs').AuditTrail,
 * }} dependencies
 */
export function createKindergartenSettingsRoutes({ readSetting, writeSetting, recordRepository, auditTrail }) {
  const readKindergarten = () => parseKindergartenSettings(readSetting('kindergarten'));

  // Cel mai mare receiptNumber deja emis (achitările arhivate/anulate nu mai
  // blochează reutilizarea numărului lor). Numerele se dau doar crescător —
  // nicio salvare a filei „Grădinița” nu are voie să dea înapoi contorul sub
  // ce s-a tipărit deja, altfel două confirmări ajung cu același număr (M6).
  const maxIssuedReceiptNumber = () =>
    recordRepository
      .readSnapshot()
      .payments.filter(payment => !payment.archived && Number.isInteger(payment.receiptNumber))
      .reduce((max, payment) => Math.max(max, /** @type {number} */ (payment.receiptNumber)), 0);

  return [
    { method: 'GET', path: '/api/kindergarten', handle: () => readKindergarten() },
    {
      method: 'POST',
      path: '/api/kindergarten',
      /** @param {{ body: unknown }} request */
      handle: ({ body }) => {
        const before = readKindergarten();
        const candidate = clampKindergartenSettings(/** @type {any} */ (body));
        const nextReceiptNumber = Math.max(
          candidate.nextReceiptNumber,
          before.nextReceiptNumber,
          maxIssuedReceiptNumber() + 1,
        );
        const settings = { ...candidate, nextReceiptNumber };
        writeSetting('kindergarten', JSON.stringify(settings));
        auditTrail.recordChange({ action: AUDIT_ACTION, recordType: null, recordId: null, before, after: settings });
        return settings;
      },
    },
  ];
}
