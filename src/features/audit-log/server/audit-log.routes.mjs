import { fail } from '#core/server/errors/domain-error.mjs';

/** @param {{ auditLogRepository: ReturnType<typeof import('./audit-log.repository.mjs').createAuditLogRepository> }} dependencies */
export function createAuditLogRoutes({ auditLogRepository }) {
  return [
    {
      method: 'GET',
      path: '/api/audit',
      /** @param {{ url: URL }} request */
      handle: ({ url }) => {
        const beforeEntryId = url.searchParams.get('beforeEntryId');
        return auditLogRepository.readPage({ beforeEntryId: beforeEntryId === null ? null : Number(beforeEntryId) });
      },
    },
    {
      // 45a (PROMPT-8 §14): istoricul unei singure înregistrări — fișa unui copil, cu achitările
      // lui. `scope` e JSON encodat în query string: [{recordType,recordId}, ...].
      method: 'GET',
      path: '/api/audit/scope',
      /** @param {{ url: URL }} request */
      handle: ({ url }) => {
        const raw = url.searchParams.get('scope');
        if (!raw) fail('Scope-ul istoricului lipsește.');
        let scope;
        try {
          scope = JSON.parse(raw);
        } catch {
          fail('Scope-ul istoricului este invalid.');
        }
        const beforeEntryId = url.searchParams.get('beforeEntryId');
        return auditLogRepository.readForScope({
          scope,
          beforeEntryId: beforeEntryId === null ? null : Number(beforeEntryId),
        });
      },
    },
  ];
}
