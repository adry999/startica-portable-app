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
  ];
}
