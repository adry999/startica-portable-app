import { fail } from './router.mjs';
import { createToken, hashToken } from './auth.mjs';

const DEVICE_NAME_MAX_LENGTH = 80;
const OS_MAX_LENGTH = 80;

/** @param {unknown} value @param {number} maxLength */
function readRequiredText(value, maxLength) {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) return undefined;
  return value.trim();
}

/**
 * @param {{
 *   devices: ReturnType<typeof import('./devices.repository.mjs').createDevicesRepository>,
 *   pairing: ReturnType<typeof import('./pairing.service.mjs').createPairingService>,
 *   config: import('./config.mjs').SyncServerConfig,
 *   pairingRateLimiter: { consume: (key: string) => boolean },
 *   createId: () => string,
 *   now: () => Date,
 * }} dependencies
 */
export function createDevicesRoutes({ devices, pairing, config, pairingRateLimiter, createId, now }) {
  /** @param {{ code?: string, setupKey?: string, name?: string, os?: string, clientIp: string }} body */
  function pair({ code, setupKey, name, os, clientIp }) {
    if (!pairingRateLimiter.consume(clientIp)) fail('Prea multe încercări. Așteaptă câteva minute.', 429);
    const deviceName = readRequiredText(name, DEVICE_NAME_MAX_LENGTH);
    const deviceOs = readRequiredText(os, OS_MAX_LENGTH);
    if (!deviceName || !deviceOs) fail('Numele calculatorului și sistemul de operare sunt obligatorii.', 400);

    let createdBy = null;
    if (setupKey !== undefined) {
      const noDevicesYet = devices.countActive() === 0;
      if (!config.setupKey || setupKey !== config.setupKey || !(noDevicesYet || config.setupKeyAlways))
        fail('Cheia de instalare nu este acceptată.', 403);
    } else if (code !== undefined) {
      const result = pairing.consumeCode({ code, now: now() });
      if (!result.ok) fail('Cod greșit, folosit sau expirat.', 400);
      createdBy = result.createdBy;
    } else {
      fail('Cererea trebuie să conțină un cod de conectare sau cheia de instalare.', 400);
    }

    const token = createToken();
    const device = devices.insert({
      id: createId(),
      name: deviceName,
      os: deviceOs,
      tokenHash: hashToken(token),
      now: now().toISOString(),
    });
    return { deviceId: device.id, token, createdBy };
  }

  /** @param {{ id: string, name: string, os: string, lastSeenAt: string, lastBranchId: string | null, revokedAt: string | null }} record @param {string} meId */
  function toDeviceView(record, meId) {
    return {
      id: record.id,
      name: record.name,
      os: record.os,
      lastSeenAt: record.lastSeenAt,
      lastBranchId: record.lastBranchId,
      revokedAt: record.revokedAt,
      me: record.id === meId,
    };
  }

  /** @param {{ device: { id: string } }} context */
  function list({ device }) {
    return { devices: devices.list().map(record => toDeviceView(record, device.id)) };
  }

  /** @param {{ device: { id: string } }} context */
  function createPairingCode({ device }) {
    return pairing.createCode({ createdBy: device.id, now: now() });
  }

  /** @param {{ device: { id: string }, params: Record<string, string> }} context */
  function revokeDevice({ device, params }) {
    if (params.id === device.id) fail('Nu te poți deconecta pe tine însuți din listă.', 400);
    if (!devices.findById(params.id)) fail('Calculator inexistent.', 404);
    devices.revoke(params.id, now().toISOString());
    return { ok: true };
  }

  /** @type {import('./router.mjs').RouteDefinition[]} */
  const routes = [
    {
      method: 'POST',
      pattern: /^\/v1\/devices\/pair$/,
      auth: false,
      handle: ({ body, clientIp }) => pair({ ...(body ?? {}), clientIp }),
    },
    {
      method: 'POST',
      pattern: /^\/v1\/pairing-codes$/,
      auth: true,
      handle: ({ device }) => createPairingCode({ device: /** @type {{ id: string }} */ (device) }),
    },
    {
      method: 'GET',
      pattern: /^\/v1\/devices$/,
      auth: true,
      handle: ({ device }) => list({ device: /** @type {{ id: string }} */ (device) }),
    },
    {
      method: 'POST',
      pattern: /^\/v1\/devices\/(?<id>[^/]+)\/revoke$/,
      auth: true,
      handle: ({ device, params }) => revokeDevice({ device: /** @type {{ id: string }} */ (device), params }),
    },
  ];
  return { routes };
}
