import { randomUUID } from 'node:crypto';
import { DEFAULT_SMS_TEMPLATE_BODY } from '#shared/domain/sms-template.mjs';

/** @typedef {import('../sms-notify.types.mjs').SmsTemplate} SmsTemplate */
/** @typedef {import('../sms-notify.types.mjs').SmsTemplateInput} SmsTemplateInput */

export const DEFAULT_SMS_TEMPLATE_ID = 'TPL-restanta';
const COLUMNS = 'id,name,body,strip_diacritics,is_default,created_at,updated_at';

/** @returns {SmsTemplate} */
const toTemplate = row => ({
  id: row.id,
  name: row.name,
  body: row.body,
  stripDiacritics: row.strip_diacritics === 1,
  isDefault: row.is_default === 1,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * @param {import('node:sqlite').DatabaseSync} database
 * @param {{ now?: () => Date }} [options]
 */
export function createSmsTemplateRepository(database, { now = () => new Date() } = {}) {
  const seededAt = now().toISOString();
  // Seed la prima deschidere; a doua deschidere nu dublează (INSERT OR IGNORE pe cheia primară).
  database
    .prepare(`INSERT OR IGNORE INTO sms_templates(${COLUMNS}) VALUES(?,?,?,1,1,?,?)`)
    .run(DEFAULT_SMS_TEMPLATE_ID, 'Reamintire restanță', DEFAULT_SMS_TEMPLATE_BODY, seededAt, seededAt);

  // sms_templates e TEXT PRIMARY KEY (nu WITHOUT ROWID), deci are rowid implicit crescător cu ordinea reală de inserare;
  // id e un UUID text, deci ordonarea după id ar da tie-break aleatoriu, nelegat de ordinea creării.
  const selectAll = database.prepare(`SELECT ${COLUMNS} FROM sms_templates ORDER BY created_at, rowid`);
  const selectOne = database.prepare(`SELECT ${COLUMNS} FROM sms_templates WHERE id=?`);
  const selectDefault = database.prepare(`SELECT ${COLUMNS} FROM sms_templates WHERE is_default=1 LIMIT 1`);
  const insert = database.prepare(`INSERT INTO sms_templates(${COLUMNS}) VALUES(?,?,?,?,?,?,?)`);
  const update = database.prepare(
    'UPDATE sms_templates SET name=?,body=?,strip_diacritics=?,is_default=?,updated_at=? WHERE id=?',
  );
  // O singură instrucțiune: nu există moment în care zero sau două șabloane să fie implicite.
  const moveDefault = database.prepare('UPDATE sms_templates SET is_default=(id=?)');
  const remove = database.prepare('DELETE FROM sms_templates WHERE id=?');

  const list = () => selectAll.all().map(toTemplate);
  const find = id => {
    const row = selectOne.get(id);
    return row ? toTemplate(row) : null;
  };
  const findDefault = () => toTemplate(selectDefault.get());

  /** @param {SmsTemplateInput} input @returns {SmsTemplate} */
  function save({ id, name, body, stripDiacritics, isDefault }) {
    const timestamp = now().toISOString();
    const existing = id ? selectOne.get(id) : null;
    // `existing && id` (nu doar `existing`) ca tsc să lege narrowing-ul lui id la ramura truthy.
    const templateId = existing && id ? id : `TPL-${randomUUID()}`;
    if (existing) update.run(name, body, stripDiacritics ? 1 : 0, isDefault ? 1 : 0, timestamp, templateId);
    else insert.run(templateId, name, body, stripDiacritics ? 1 : 0, isDefault ? 1 : 0, timestamp, timestamp);
    if (isDefault) moveDefault.run(templateId);
    return /** @type {SmsTemplate} */ (find(templateId));
  }

  return {
    list,
    find,
    findDefault,
    save,
    /** @param {string} id */ setDefault: id => void moveDefault.run(id),
    /** @param {string} id */ remove: id => remove.run(id).changes > 0,
  };
}

/** @typedef {ReturnType<typeof createSmsTemplateRepository>} SmsTemplateRepository */
