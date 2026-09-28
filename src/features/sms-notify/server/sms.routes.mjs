import { fail } from '#core/server/errors/domain-error.mjs';
import { dateOK, isoDateOf, shiftDays } from '#shared/domain/calendar-month.mjs';
import { findUnknownSmsVariables, SMS_TEMPLATE_MAX_LENGTH } from '#shared/domain/sms-template.mjs';
import { readSmsConfig, writeSmsConfig, removeSmsConfig, maskSmsToken } from './sms-config.repository.mjs';
import { createSmsLogRepository } from './sms-log.repository.mjs';
import { createSmsTemplateRepository } from './sms-template.repository.mjs';
import { createSmsSendService } from './sms-send.service.mjs';

/** @typedef {import('../sms-notify.types.mjs').SmsRoutesDependencies} SmsRoutesDependencies */
/** @typedef {import('../sms-notify.types.mjs').SmsTemplateInput} SmsTemplateInput */
/** @typedef {import('../sms-notify.types.mjs').SmsSendRequest} SmsSendRequest */

const CONFIG_AUDIT_ACTION = 'configurare sms';
const TEMPLATE_AUDIT_ACTION = 'șablon sms';
const TEMPLATE_NAME_MAX_LENGTH = 60;
const MONTHLY_LIMIT_MAX = 5000;

const MISSING_TOKEN_MESSAGE = 'Lipsește tokenul sms.md. Lipește-l din contul sms.md.';
const TOKEN_WHITESPACE_MESSAGE = 'Tokenul sms.md nu poate conține spații.';
const INVALID_SENDER_MESSAGE = 'Expeditorul trebuie să aibă între 1 și 15 caractere.';
const INVALID_MONTHLY_LIMIT_MESSAGE = 'Limita lunară trebuie să fie un număr întreg între 1 și 5000, sau necompletată.';
const DEFAULT_TEMPLATE_DELETE_MESSAGE = 'Șablonul implicit nu se poate șterge. Alege alt implicit mai întâi.';
const DEFAULT_TEMPLATE_UNSET_MESSAGE = 'Alege alt șablon implicit mai întâi.';
const INVALID_AFTER_MESSAGE = 'Data „după” trebuie să fie în formatul AAAA-LL-ZZ.';
const LOG_DEFAULT_PERIOD_DAYS = 30;

/** @param {string} name */
const senderActiveMessage = (name, activeSenders) =>
  `Expeditorul „${name}” nu e activ la sms.md. Expeditori activi: ${activeSenders.join(', ')}.`;

/** @param {number | null | undefined} monthlyLimit */
function isValidMonthlyLimit(monthlyLimit) {
  return (
    monthlyLimit == null || (Number.isInteger(monthlyLimit) && monthlyLimit >= 1 && monthlyLimit <= MONTHLY_LIMIT_MAX)
  );
}

/** @param {SmsRoutesDependencies} dependencies */
export function createSmsRoutes({
  database,
  dataDirectory,
  smsService,
  auditTrail,
  now = () => new Date(),
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
}) {
  const smsLogRepository = createSmsLogRepository(database);
  const smsTemplateRepository = createSmsTemplateRepository(database, { now });
  const smsSendService = createSmsSendService({
    smsService,
    smsLogRepository,
    smsTemplateRepository,
    readConfig: () => readSmsConfig(dataDirectory),
    auditTrail,
    now,
    sleep,
  });

  // Afișare-only, cu un singur scriitor (acest proces): balanța și ultima eroare de cont nu
  // merită propriul fișier, ca la Telegram unde un al doilea proces scrie starea.
  let balance = /** @type {string | null} */ (null);
  let balanceCheckedAt = '';
  let lastError = '';

  // Aceeași formă ca `callTelegramOrFail`: singurul loc care traduce o eroare clasificată
  // (cu `.code`, care ar cădea altfel pe 500 în dispatcher) într-un `fail()` de domeniu.
  /**
   * @template T
   * @param {() => Promise<T>} action
   * @returns {Promise<T>}
   */
  async function callSmsOrFail(action) {
    try {
      return await action();
    } catch (error) {
      const failure = smsService.classifySmsFailure(error);
      fail(failure.message);
    }
  }

  function currentStatus() {
    const config = readSmsConfig(dataDirectory);
    const stats = smsLogRepository.monthlyStats(now());
    return {
      configured: !!config,
      sender: config?.sender || '',
      tokenMasked: maskSmsToken(config?.token || ''),
      monthlyLimit: config?.monthlyLimit ?? null,
      sentThisMonth: stats.sentThisMonth,
      failedThisMonth: stats.failedThisMonth,
      segmentsThisMonth: stats.segmentsThisMonth,
      balance,
      balanceCheckedAt,
      unitCost: smsLogRepository.lastUnitCost(),
      lastError,
    };
  }

  async function refreshBalanceIfConfigured() {
    const config = readSmsConfig(dataDirectory);
    if (!config) return;
    try {
      const balanceResult = await smsService.getBalance({ token: config.token });
      balance = balanceResult.balance;
      balanceCheckedAt = now().toISOString();
    } catch {
      balance = null;
    }
  }

  async function buildStatus() {
    await refreshBalanceIfConfigured();
    return currentStatus();
  }

  /**
   * @param {{ token?: string, sender: string, monthlyLimit: number | null }} input
   * @param {boolean} alreadyConfigured
   */
  function assertValidConnectInput({ token, sender, monthlyLimit }, alreadyConfigured) {
    if (token && /\s/.test(token)) fail(TOKEN_WHITESPACE_MESSAGE);
    if (!token && !alreadyConfigured) fail(MISSING_TOKEN_MESSAGE);
    if (!sender || sender.length > 15) fail(INVALID_SENDER_MESSAGE);
    if (!isValidMonthlyLimit(monthlyLimit)) fail(INVALID_MONTHLY_LIMIT_MESSAGE);
  }

  /** @param {{ token?: string, sender: string, monthlyLimit: number | null }} input */
  async function connect({ token, sender, monthlyLimit }) {
    const existing = readSmsConfig(dataDirectory);
    assertValidConnectInput({ token, sender, monthlyLimit }, !!existing);
    // Token gol cu o configurare existentă: se ține tokenul salvat, ca operatorul să
    // poată schimba expeditorul sau limita fără să re-lipească secretul (§ tabel task 14).
    const effectiveToken = token || /** @type {string} */ (existing?.token);

    const balanceData = await callSmsOrFail(() => smsService.getBalance({ token: effectiveToken }));
    const activeSenders = await callSmsOrFail(() => smsService.listActiveSenders({ token: effectiveToken }));
    if (!activeSenders.includes(sender)) fail(senderActiveMessage(sender, activeSenders));

    writeSmsConfig(dataDirectory, { token: effectiveToken, sender, monthlyLimit: monthlyLimit ?? null });
    balance = balanceData.balance;
    balanceCheckedAt = now().toISOString();
    lastError = '';

    auditTrail.recordChange({
      action: CONFIG_AUDIT_ACTION,
      recordType: null,
      recordId: null,
      before: { sender: existing?.sender || '', monthlyLimit: existing?.monthlyLimit ?? null },
      after: { sender, monthlyLimit: monthlyLimit ?? null },
    });
    return { ok: true, status: currentStatus() };
  }

  function disconnect() {
    const existing = readSmsConfig(dataDirectory);
    removeSmsConfig(dataDirectory);
    balance = null;
    balanceCheckedAt = '';
    lastError = '';
    auditTrail.recordChange({
      action: CONFIG_AUDIT_ACTION,
      recordType: null,
      recordId: null,
      before: { sender: existing?.sender || '', monthlyLimit: existing?.monthlyLimit ?? null },
      after: { sender: '', monthlyLimit: null },
    });
    return { ok: true, status: currentStatus() };
  }

  /** @param {string} phone */
  async function sendTest(phone) {
    const entry = await smsSendService.sendTest(phone);
    lastError = '';
    return { ok: true, status: currentStatus(), entry };
  }

  /** @param {SmsSendRequest} request */
  async function send(request) {
    const result = await smsSendService.sendBatch(request);
    lastError = result.stopped ? result.stopped.message : '';
    return { ...result, status: currentStatus() };
  }

  /** @param {{ name?: string, body?: string }} input */
  function assertValidTemplateInput({ name, body }) {
    if (!name || name.length > TEMPLATE_NAME_MAX_LENGTH)
      fail('Numele șablonului trebuie să aibă între 1 și 60 de caractere.');
    if (!body || body.length > SMS_TEMPLATE_MAX_LENGTH)
      fail('Textul șablonului trebuie să aibă între 1 și 800 de caractere.');
    const unknownVariables = findUnknownSmsVariables(body);
    if (unknownVariables.length > 0) fail(`Variabilă necunoscută în șablon: {${unknownVariables[0]}}.`);
  }

  /** Fila „Mesaje SMS" (11a): lot din perioadă (implicit 30 de zile) + statistici + defalcarea pe luni. */
  /** @param {string | null} afterParam */
  function readSmsLog(afterParam) {
    const afterDate = afterParam ?? shiftDays(isoDateOf(now()), -LOG_DEFAULT_PERIOD_DAYS);
    if (!dateOK(afterDate)) fail(INVALID_AFTER_MESSAGE);
    const stats = smsLogRepository.monthlyStats(now());
    const config = readSmsConfig(dataDirectory);
    // Miezul nopții local (Europe/Chisinau), nu UTC: un literal fără „Z" e citit de Date ca oră
    // locală, deci .toISOString() dă instantul UTC corect — altfel cutoff-ul era decalat 2-3h.
    return {
      entries: smsLogRepository.listSince(new Date(`${afterDate}T00:00:00`).toISOString()),
      stats: { ...stats, monthlyLimit: config?.monthlyLimit ?? null },
      monthly: smsLogRepository.monthlyBreakdown(),
    };
  }

  /** @param {SmsTemplateInput} input */
  function saveTemplate({ id, name, body, stripDiacritics, isDefault }) {
    assertValidTemplateInput({ name, body });
    const before = id ? smsTemplateRepository.find(id) : null;
    if (id && !before) fail(`Șablon inexistent: ${id}.`, 409);
    // Simetric cu garda de la ștergere: fără el, „de-bifarea” implicitului lasă tabelul fără
    // niciun șablon implicit (M9) — webapp cade pe `defaultTemplate: null`.
    if (before?.isDefault && !isDefault) fail(DEFAULT_TEMPLATE_UNSET_MESSAGE);
    const template = smsTemplateRepository.save({
      id,
      name,
      body,
      stripDiacritics: stripDiacritics ?? true,
      isDefault: !!isDefault,
    });
    auditTrail.recordChange({
      action: TEMPLATE_AUDIT_ACTION,
      recordType: null,
      recordId: template.id,
      before,
      after: template,
    });
    return { ok: true, template };
  }

  /** @param {string} id */
  function deleteTemplate(id) {
    const template = smsTemplateRepository.find(id);
    if (!template) fail(`Șablon inexistent: ${id}.`, 409);
    if (template.isDefault) fail(DEFAULT_TEMPLATE_DELETE_MESSAGE);
    smsTemplateRepository.remove(id);
    auditTrail.recordChange({
      action: TEMPLATE_AUDIT_ACTION,
      recordType: null,
      recordId: id,
      before: template,
      after: null,
    });
    return { ok: true };
  }

  return [
    { method: 'GET', path: '/api/sms-status', handle: () => buildStatus() },
    {
      method: 'POST',
      path: '/api/sms-connect',
      /** @param {{ body: any }} request */ handle: ({ body }) => connect(body || {}),
    },
    { method: 'POST', path: '/api/sms-disconnect', handle: () => disconnect() },
    {
      method: 'POST',
      path: '/api/sms-test',
      /** @param {{ body: any }} request */ handle: ({ body }) => sendTest(body?.phone),
    },
    {
      method: 'POST',
      path: '/api/sms-send',
      /** @param {{ body: any }} request */ handle: ({ body }) => send(body),
    },
    { method: 'GET', path: '/api/sms-last-notified', handle: () => smsLogRepository.lastNotifiedByChild() },
    { method: 'POST', path: '/api/sms-refresh-statuses', handle: () => smsSendService.refreshDeliveryStatuses() },
    {
      method: 'GET',
      path: '/api/sms-log',
      /** @param {{ url: URL }} request */ handle: ({ url }) => readSmsLog(url.searchParams.get('after')),
    },
    {
      method: 'GET',
      path: '/api/sms-templates',
      handle: () => ({
        templates: smsTemplateRepository.list(),
        usageCountById: smsLogRepository.usageCountByTemplate(),
      }),
    },
    {
      method: 'POST',
      path: '/api/sms-template-save',
      /** @param {{ body: any }} request */ handle: ({ body }) => saveTemplate(body || {}),
    },
    {
      method: 'POST',
      path: '/api/sms-template-delete',
      /** @param {{ body: any }} request */ handle: ({ body }) => deleteTemplate(body?.id),
    },
  ];
}
