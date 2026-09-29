import { fail } from '#core/server/errors/domain-error.mjs';
import { normalizeMoldovanPhone } from '#shared/domain/phone-number.mjs';
import { countSmsSegments } from '#shared/domain/sms-segments.mjs';
import { SMS_TEMPLATE_MAX_LENGTH } from '#shared/domain/sms-template.mjs';
import { estimateSmsCost } from '../domain/sms-batch.mjs';

/** @typedef {import('../sms-notify.types.mjs').SmsSendRequest} SmsSendRequest */
/** @typedef {import('../sms-notify.types.mjs').SmsSendMessage} SmsSendMessage */
/** @typedef {import('../sms-notify.types.mjs').SmsBatchResult} SmsBatchResult */
/** @typedef {import('../sms-notify.types.mjs').SmsLogEntry} SmsLogEntry */
/** @typedef {import('../sms-notify.types.mjs').SmsSendServiceDependencies} SmsSendServiceDependencies */

export const SEND_PAUSE_MS = 1000;
export const DELIVERY_UNKNOWN_AFTER_MS = 48 * 60 * 60 * 1000;
export const TEST_MESSAGE_TEXT = 'Startica: SMS-urile functioneaza. Acesta e un mesaj de test.';
export const NOT_CONNECTED_MESSAGE = 'Conectează întâi sms.md din Notificări.';

const AUDIT_ACTION = 'trimitere sms';
const TERMINAL_STATUS_BY_NAME = { Undelivered: 'failed', Failed: 'failed' };
// Ca la `requestId`-ul revizuit din core (revision-transaction.mjs), dar validat aici: sms_log
// nu trece prin `runRevisionTransaction` (nu are revizie), deci lotul își ține propria idempotență.
const BATCH_REQUEST_ID = /^[a-zA-Z0-9-]{8,100}$/;
export const INVALID_REQUEST_ID_MESSAGE = 'Identificator de lot invalid.';

/** @param {SmsSendMessage} message @param {import('../sms-notify.types.mjs').SmsSource} source */
function assertValidSendMessage(message, source) {
  // 'manual' (11c/11d): destinatarul poate fi „Alt număr" sau un angajat, fără childId din aplicație.
  if (source !== 'manual' && !message.childId) fail('Mesaj SMS invalid: copil necunoscut.');
  if (!normalizeMoldovanPhone(message.phone)) fail(`Mesaj SMS invalid: telefonul „${message.phone}” nu e valid.`);
  if (!message.text || message.text.length > SMS_TEMPLATE_MAX_LENGTH)
    fail('Mesaj SMS invalid: text gol sau prea lung.');
}

/** @param {NewSmsLogEntryBase} entry @returns {import('../sms-notify.types.mjs').NewSmsLogEntry} */
function pendingLogEntry(entry) {
  return {
    ...entry,
    cost: null,
    status: 'failed',
    providerId: null,
    providerStatus: '',
    providerError: '',
    statusCheckedAt: '',
  };
}

/**
 * @typedef {{
 *   createdAt: string, childId: string | null, recipientName: string, childName: string, phone: string,
 *   text: string, templateId: string | null, templateName: string, month: string | null,
 *   source: import('../sms-notify.types.mjs').SmsSource, characters: number, segments: number,
 *   encoding: import('../sms-notify.types.mjs').SmsEncoding, batchId: string | null,
 * }} NewSmsLogEntryBase
 */

// `providerError` ține „COD: mesaj” (vezi catch-ul din sendBatch); reconstrucția unei reluări
// citește ambele înapoi din jurnal, fără să mai țină un rezultat separat pentru lot.
/** @param {string} providerError @returns {{ code: string, message: string }} */
function parseStoredFailure(providerError) {
  const separatorIndex = providerError.indexOf(': ');
  if (separatorIndex === -1) return { code: '', message: providerError };
  return { code: providerError.slice(0, separatorIndex), message: providerError.slice(separatorIndex + 2) };
}

/** @param {import('../sms-notify.types.mjs').SmsLogEntry} row @returns {import('../sms-notify.types.mjs').SmsSendOutcome} */
function outcomeFromRow(row) {
  // `providerId` se scrie o singură dată, la trimiterea inițială reușită — indiferent ce a pățit
  // livrarea mai târziu (status poate deveni 'delivered'/'unknown'/'failed' prin refreshDeliveryStatuses).
  const sentSuccessfully = row.providerId != null;
  return {
    // null pentru sendTest (fără lot) și pentru un lot manual către „Alt număr”/angajat.
    childId: row.childId,
    outcome: sentSuccessfully ? 'sent' : 'failed',
    logId: row.id,
    // Un rând failed ține segmentele/costul estimate înainte de trimitere (pentru diagnostic),
    // dar rezultatul original nu le-a contorizat (mesajul n-a ajuns la operator) — la fel aici.
    segments: sentSuccessfully ? row.segments : 0,
    cost: sentSuccessfully ? row.cost : null,
    error: sentSuccessfully ? '' : parseStoredFailure(row.providerError).message,
  };
}

/**
 * Reconstruiește rezultatul unui lot deja trimis, din rândurile lui din jurnal — pentru o reluare
 * cu același `requestId` (M10). Mesajele fără rând (după stop) redevin `skipped`, cu același motiv.
 * @param {import('../sms-notify.types.mjs').SmsLogEntry[]} rows
 * @param {SmsSendMessage[]} messages
 * @returns {SmsBatchResult}
 */
function reconstructBatchResult(rows, messages) {
  const results = rows.map(outcomeFromRow);
  let stopped = null;
  if (rows.length < messages.length) {
    const lastRow = rows[rows.length - 1];
    const { code, message } = parseStoredFailure(lastRow.providerError);
    stopped = { code, message };
    for (let index = rows.length; index < messages.length; index += 1)
      results.push({
        childId: messages[index].childId,
        outcome: 'skipped',
        logId: null,
        segments: 0,
        cost: null,
        error: message,
      });
  }
  const failedCount = results.filter(result => result.outcome === 'failed').length;
  const skippedCount = results.filter(result => result.outcome === 'skipped').length;
  return { ok: failedCount === 0 && skippedCount === 0, results, stopped };
}

/**
 * @param {SmsSendServiceDependencies} dependencies
 */
export function createSmsSendService({
  smsService,
  smsLogRepository,
  smsTemplateRepository,
  readConfig,
  auditTrail,
  now = () => new Date(),
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
}) {
  /** @param {import('../sms-notify.types.mjs').SmsConfig} config @param {string} to @param {string} text */
  async function sendOne(config, to, text) {
    return smsService.sendMessage({ token: config.token, from: config.sender, to, text });
  }

  /** @param {SmsSendRequest} request @returns {Promise<SmsBatchResult>} */
  async function sendBatch({ source, month, templateId, messages, requestId }) {
    if (typeof requestId !== 'string' || !BATCH_REQUEST_ID.test(requestId)) fail(INVALID_REQUEST_ID_MESSAGE);
    // Reluare (M10): un lot de zeci de mesaje durează minute (pauză între cereri), deci un timeout
    // HTTP al clientului nu înseamnă că serverul n-a trimis nimic — un al doilea POST cu același
    // `requestId` întoarce rezultatul memorat în jurnal, fără să mai cheme sms.md sau să audieze din nou.
    const alreadySent = smsLogRepository.listByBatch(requestId);
    if (alreadySent.length > 0) return reconstructBatchResult(alreadySent, messages);

    const config = readConfig();
    if (!config) fail(NOT_CONNECTED_MESSAGE);
    for (const message of messages) assertValidSendMessage(message, source);

    const { sentThisMonth } = smsLogRepository.monthlyStats(now());
    if (config.monthlyLimit != null && sentThisMonth + messages.length > config.monthlyLimit)
      fail(
        `Limita lunară de ${config.monthlyLimit} SMS ar fi depășită (trimise: ${sentThisMonth}). ` +
          'Mărește limita în Notificări sau trimite mai puține.',
      );

    // Sold necunoscut (interogare picată) nu blochează lotul: 402 la trimitere oprește oricum, fără cost.
    const balance = await smsService.getBalance({ token: config.token }).catch(() => null);
    if (balance) {
      const unitCost = smsLogRepository.lastUnitCost();
      const estimatedSegments = messages.reduce((sum, message) => sum + countSmsSegments(message.text).segments, 0);
      const estimatedCost = estimateSmsCost(estimatedSegments, unitCost);
      if (Number(balance.balance) < estimatedCost)
        fail(`Sold sms.md insuficient: ${balance.balance} lei disponibili, ≈ ${estimatedCost} lei necesari.`);
    }

    const templateName = (templateId && smsTemplateRepository.find(templateId)?.name) || 'Personalizat';
    /** @type {import('../sms-notify.types.mjs').SmsSendOutcome[]} */
    const results = [];
    /** @type {{ code: string, message: string } | null} */
    let stopped = null;
    let totalCost = 0;

    for (const [index, message] of messages.entries()) {
      if (stopped) {
        results.push({
          childId: message.childId,
          outcome: 'skipped',
          logId: null,
          segments: 0,
          cost: null,
          error: stopped.message,
        });
        continue;
      }
      const local = countSmsSegments(message.text);
      const logId = smsLogRepository.insert(
        pendingLogEntry({
          createdAt: now().toISOString(),
          childId: message.childId,
          recipientName: message.recipientName,
          childName: message.childName,
          phone: message.phone,
          text: message.text,
          templateId,
          templateName,
          month,
          source,
          batchId: requestId,
          characters: local.characters,
          segments: local.segments,
          encoding: local.encoding,
        }),
      );
      try {
        const sendResult = await sendOne(config, message.phone, message.text);
        smsLogRepository.update(logId, {
          status: 'sent',
          providerId: sendResult.id,
          providerStatus: 'Queued',
          characters: sendResult.characters,
          segments: sendResult.segments,
          encoding: sendResult.encoding,
          cost: sendResult.cost,
        });
        results.push({
          childId: message.childId,
          outcome: 'sent',
          logId,
          segments: sendResult.segments,
          cost: sendResult.cost,
          error: '',
        });
        totalCost += Number(sendResult.cost);
      } catch (error) {
        const failure = smsService.classifySmsFailure(error);
        smsLogRepository.update(logId, { providerError: `${failure.code}: ${failure.message}` });
        results.push({
          childId: message.childId,
          outcome: 'failed',
          logId,
          segments: 0,
          cost: null,
          error: failure.message,
        });
        if (failure.scope === 'account') stopped = { code: failure.code, message: failure.message };
      }
      if (!stopped && index < messages.length - 1) await sleep(SEND_PAUSE_MS);
    }

    const sentCount = results.filter(result => result.outcome === 'sent').length;
    const failedCount = results.filter(result => result.outcome === 'failed').length;
    const skippedCount = results.filter(result => result.outcome === 'skipped').length;
    auditTrail.recordChange({
      action: AUDIT_ACTION,
      recordType: null,
      recordId: null,
      before: null,
      after: {
        source,
        month,
        templateName,
        requested: messages.length,
        sent: sentCount,
        failed: failedCount,
        skipped: skippedCount,
        cost: totalCost.toFixed(2),
      },
    });

    return { ok: failedCount === 0 && skippedCount === 0, results, stopped };
  }

  /** @param {string} phone @returns {Promise<SmsLogEntry>} */
  async function sendTest(phone) {
    const config = readConfig();
    if (!config) fail(NOT_CONNECTED_MESSAGE);
    const normalizedPhone = normalizeMoldovanPhone(phone);
    if (!normalizedPhone) fail(`Telefonul „${phone}” nu e valid.`);
    const local = countSmsSegments(TEST_MESSAGE_TEXT);
    const logId = smsLogRepository.insert(
      pendingLogEntry({
        createdAt: now().toISOString(),
        childId: null,
        recipientName: 'Test',
        childName: '',
        phone: normalizedPhone,
        text: TEST_MESSAGE_TEXT,
        templateId: null,
        templateName: '',
        month: null,
        source: 'test',
        batchId: null,
        characters: local.characters,
        segments: local.segments,
        encoding: local.encoding,
      }),
    );
    try {
      const sendResult = await sendOne(config, normalizedPhone, TEST_MESSAGE_TEXT);
      smsLogRepository.update(logId, {
        status: 'sent',
        providerId: sendResult.id,
        providerStatus: 'Queued',
        characters: sendResult.characters,
        segments: sendResult.segments,
        encoding: sendResult.encoding,
        cost: sendResult.cost,
      });
    } catch (error) {
      const failure = smsService.classifySmsFailure(error);
      smsLogRepository.update(logId, { providerError: `${failure.code}: ${failure.message}` });
      fail(failure.message);
    }
    return /** @type {SmsLogEntry} */ (smsLogRepository.find(logId));
  }

  /** @returns {Promise<{ updated: number, entries: SmsLogEntry[] }>} */
  async function refreshDeliveryStatuses() {
    const config = readConfig();
    if (!config) fail(NOT_CONNECTED_MESSAGE);
    smsLogRepository.markUnknownOlderThan(new Date(now().getTime() - DELIVERY_UNKNOWN_AFTER_MS).toISOString());

    const entries = [];
    for (const entry of smsLogRepository.pendingDelivery(50)) {
      let messageStatus;
      try {
        messageStatus = await smsService.getMessage({
          token: config.token,
          id: /** @type {string} */ (entry.providerId),
        });
      } catch (error) {
        const failure = smsService.classifySmsFailure(error);
        if (failure.kind === 'transient') break;
        continue;
      }
      const statusName = messageStatus.status.name;
      const statusCheckedAt = now().toISOString();
      const terminalStatus = statusName === 'Delivered' ? 'delivered' : TERMINAL_STATUS_BY_NAME[statusName];
      smsLogRepository.update(entry.id, {
        ...(terminalStatus ? { status: terminalStatus } : {}),
        providerStatus: statusName,
        providerError: terminalStatus === 'failed' ? statusName : '',
        statusCheckedAt,
      });
      entries.push(/** @type {SmsLogEntry} */ (smsLogRepository.find(entry.id)));
    }
    return { updated: entries.length, entries };
  }

  return { sendBatch, sendTest, refreshDeliveryStatuses };
}
