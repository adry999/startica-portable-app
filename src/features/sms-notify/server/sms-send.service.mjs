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

/** @param {SmsSendMessage} message */
function assertValidSendMessage(message) {
  if (!message.childId) fail('Mesaj SMS invalid: copil necunoscut.');
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
 *   encoding: import('../sms-notify.types.mjs').SmsEncoding,
 * }} NewSmsLogEntryBase
 */

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
  async function sendBatch({ source, month, templateId, messages }) {
    const config = readConfig();
    if (!config) fail(NOT_CONNECTED_MESSAGE);
    for (const message of messages) assertValidSendMessage(message);

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
          characters: local.characters,
          segments: local.segments,
          encoding: local.encoding,
        }),
      );
      try {
        const data = await sendOne(config, message.phone, message.text);
        smsLogRepository.update(logId, {
          status: 'sent',
          providerId: data.id,
          providerStatus: 'Queued',
          characters: data.characters,
          segments: data.segments,
          encoding: data.encoding,
          cost: data.cost,
        });
        results.push({
          childId: message.childId,
          outcome: 'sent',
          logId,
          segments: data.segments,
          cost: data.cost,
          error: '',
        });
        totalCost += Number(data.cost);
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
        characters: local.characters,
        segments: local.segments,
        encoding: local.encoding,
      }),
    );
    try {
      const data = await sendOne(config, normalizedPhone, TEST_MESSAGE_TEXT);
      smsLogRepository.update(logId, {
        status: 'sent',
        providerId: data.id,
        providerStatus: 'Queued',
        characters: data.characters,
        segments: data.segments,
        encoding: data.encoding,
        cost: data.cost,
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
      let data;
      try {
        data = await smsService.getMessage({ token: config.token, id: /** @type {string} */ (entry.providerId) });
      } catch (error) {
        const failure = smsService.classifySmsFailure(error);
        if (failure.kind === 'transient') break;
        continue;
      }
      const statusName = data.status.name;
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
