import { fail } from '#core/server/errors/domain-error.mjs';

/** @typedef {import('../groups.types.mjs').GroupsRoutesDependencies} GroupsRoutesDependencies */
/** @typedef {import('../groups.types.mjs').GroupDeleteRequest} GroupDeleteRequest */

const TRANSACTION_ACTION = 'ștergere grupă';
const AUDIT_ACTION = 'ștergere';

/** @param {GroupsRoutesDependencies} dependencies */
export function createGroupsRoutes({ recordRepository, auditTrail, runRevisionTransaction }) {
  return [
    {
      method: 'POST',
      path: '/api/group-delete',
      /** @param {{ body: GroupDeleteRequest }} request */
      handle: ({ body }) =>
        runRevisionTransaction(body, { action: TRANSACTION_ACTION, backupBefore: false }, () => {
          const group = recordRepository.find('groups', body.id);
          if (!group) fail('Grupa nu mai există.', 409);
          // Grupele nu se arhivează, se șterg direct — dar numai când nimeni nu mai e atribuit ei,
          // altfel copiii ar rămâne cu o referință către nimic.
          const children = recordRepository.readSnapshot().children.filter(child => child.groupId === body.id);
          if (children.length) {
            const archivedCount = children.filter(child => child.archived).length;
            fail(
              archivedCount
                ? 'Mută mai întâi copiii din grupă, inclusiv copiii arhivați. Ei păstrează grupa pentru restaurare.'
                : 'Mută mai întâi copiii din grupă.',
            );
          }
          recordRepository.remove('groups', body.id);
          auditTrail.recordChange({
            action: AUDIT_ACTION,
            recordType: 'groups',
            recordId: body.id,
            before: group,
            after: null,
          });
        }),
    },
  ];
}
