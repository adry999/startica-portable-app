import { fail } from '#core/server/errors/domain-error.mjs';
import { sendResponse } from '#core/server/http/json-response.mjs';
import { RESPONSE_SENT } from '#core/server/http/route-dispatcher.mjs';

/**
 * @param {{
 *   sessionToken: string,
 *   readEnvelope: () => unknown,
 *   backupService: { cancelScheduledBackup: () => void, safeBackup: (reason: string) => { warning?: string } },
 *   allowShutdown: boolean,
 *   shutdown: () => void,
 * }} dependencies
 */
export function createSessionRoutes({ sessionToken, readEnvelope, backupService, allowShutdown, shutdown }) {
  return [
    { method: 'GET', path: '/api/session', handle: () => ({ token: sessionToken }) },
    { method: 'GET', path: '/api/state', handle: () => readEnvelope() },
    {
      method: 'POST',
      path: '/api/shutdown',
      /** @param {{ response: import('node:http').ServerResponse }} request */
      handle: ({ response }) => {
        if (!allowShutdown) fail('Operațiune inexistentă.', 404);
        backupService.cancelScheduledBackup();
        const result = backupService.safeBackup('inchidere');
        sendResponse(response, { ok: true, warning: result.warning || '' });
        shutdown();
        return RESPONSE_SENT;
      },
    },
    // Ruta de scriere a versiunii vechi. Un mesaj explicit este mai util decât 404.
    { method: 'POST', path: '/api/state', handle: () => fail('Această versiune este veche. Reîncarcă pagina.', 409) },
  ];
}
