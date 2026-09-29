import { timingSafeEqual } from 'node:crypto';
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
  /**
   * Comparație în timp constant (D-7): `!==` pe două șiruri scurge, prin timpul de
   * execuție, câte caractere de la început se potrivesc — util unui atacator care
   * încearcă să ghicească cheia de instalare, chiar dacă limitatorul de rată reduce riscul.
   * @param {unknown} candidate
   */
  function setupKeyMatches(candidate) {
    if (!config.setupKey || typeof candidate !== 'string') return false;
    // sha256 hex are lungime fixă (64), deci timingSafeEqual nu aruncă din cauza lungimii.
    return timingSafeEqual(Buffer.from(hashToken(config.setupKey)), Buffer.from(hashToken(candidate)));
  }

  /** @param {{ code?: string, setupKey?: string, name?: string, os?: string, clientIp: string }} body */
  function pair({ code, setupKey, name, os, clientIp }) {
    if (!pairingRateLimiter.consume(clientIp)) fail('Prea multe încercări. Așteaptă câteva minute.', 429);
    const deviceName = readRequiredText(name, DEVICE_NAME_MAX_LENGTH);
    const deviceOs = readRequiredText(os, OS_MAX_LENGTH);
    if (!deviceName || !deviceOs) fail('Numele calculatorului și sistemul de operare sunt obligatorii.', 400);

    let createdBy = null;
    if (setupKey !== undefined) {
      const noDevicesYet = devices.countActive() === 0;
      if (!setupKeyMatches(setupKey) || !(noDevicesYet || config.setupKeyAlways))
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

  /**
   * B-9 (audit 2026-09-29): un calculator care tocmai s-a înregistrat (`pair()` reușit) dar
   * a eșuat la un pas de-după (reconciliere de filiale, urcare/descărcare de instantanee) are
   * nevoie să-și revoce PROPRIA înregistrare — altfel codul de asociere e ars degeaba și
   * rândul fantomă rămâne în „Calculatoare conectate”, fără nicio cale locală de reluare.
   * Restricția de-a nu te revoca pe tine „din listă” rămâne doar în interfață (DevicesList.tsx
   * ascunde butonul pe rândul propriu) — aici era doar o gardă suplimentară, fără niciun
   * apelant legitim care s-ar fi bazat pe ea, și bloca exact acest caz.
   * @param {{ params: Record<string, string> }} context
   */
  function revokeDevice({ params }) {
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
      handle: ({ params }) => revokeDevice({ params }),
    },
  ];
  return { routes };
}
