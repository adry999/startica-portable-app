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
          // desiredGroupId e o preferință, nu o apartenență reală (spre diferență de
          // children.groupId, blocat mai sus) — o golim în loc să blocăm ștergerea grupei,
          // altfel referința rămâne moartă: mutații ulterioare pe vizită pică
          // (assertRecordReferencesExist), iar orice backup luat după ștergere devine
          // nerestaurabil (validateState respinge grupa inexistentă la import/restore).
          const visits = recordRepository.readSnapshot().visits.filter(visit => visit.desiredGroupId === body.id);
          for (const visit of visits) {
            recordRepository.save('visits', { ...visit, desiredGroupId: null });
          }
        }),
    },
  ];
}
