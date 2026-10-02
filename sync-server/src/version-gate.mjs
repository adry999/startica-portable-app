import { fail } from './router.mjs';
import { compareVersions } from './version-compare.mjs';

// docs/design/screens/32-actualizari.md („Compatibilitate”): „Fiecare cerere /v1/* trimite
// X-Startica-Version. Serverul are SYNC_MIN_CLIENT_VERSION (env) și răspunde 426 … pentru
// versiuni mai mici”. Același nume de antet pe amândouă părțile (sync-http-client.mjs).
export const CLIENT_VERSION_HEADER = 'x-startica-version';

/** @param {import('node:http').IncomingMessage} request */
export function clientVersionHeader(request) {
  const header = request.headers[CLIENT_VERSION_HEADER];
  return Array.isArray(header) ? header[0] : header;
}

/**
 * 426 Upgrade Required (contractul din 32-actualizari.md) când clientul e mai vechi decât
 * `SYNC_MIN_CLIENT_VERSION` — corpul poartă `minVersion`, ca sync-http-client.mjs să poată
 * arăta ținta exactă (`SyncIncompatibleError`), fără să ghicească dintr-un mesaj text.
 * Un client fără antet (instalare dinaintea acestui antet, sau un test/unealtă manuală)
 * trece — gardarea nu are cum să decidă „prea vechi” fără o versiune de comparat, iar
 * blocarea oarbă ar opri și cereri care n-au nicio legătură cu un client real.
 * @param {{ minClientVersion?: string }} config
 */
export function createVersionGate({ minClientVersion }) {
  /** @param {import('node:http').IncomingMessage} request */
  return function checkClientVersion(request) {
    if (!minClientVersion) return;
    const clientVersion = clientVersionHeader(request);
    if (!clientVersion) return;
    if (compareVersions(clientVersion, minClientVersion) === -1)
      fail(
        `Versiunea ${clientVersion} este prea veche. Actualizează la ${minClientVersion} sau mai nouă.`,
        426,
        { minVersion: minClientVersion },
      );
  };
}
