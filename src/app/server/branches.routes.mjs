import { fail } from '#core/server/errors/domain-error.mjs';
import { openDatabase, openDatabaseReadOnly } from '#core/server/database/sqlite-connection.mjs';
import { createRecordRepository } from '#core/server/persistence/record-repository.mjs';
import { branchDirectories, countBranchRecords } from '#core/server/branches/branch-layout.mjs';
import { emptyState } from '#shared/domain/record-schema.mjs';

const AUDIT_ACTION = 'filiale';

/** @typedef {import('#core/server/branches/branch-registry.mjs').BranchEntry} BranchEntry */

/**
 * Rutele filialelor (17-filiale.md, Faza 6): listă cu contoare, creare, redenumire/culoare/adresă,
 * comutare și citirea read-only a datelor altei filiale (pentru raportul „Ambele”, Faza 4).
 * Nu țin de o filială anume — de aceea sunt construite o singură dată în create-application.mjs
 * și adăugate la rutele fiecărei filiale deschise.
 * @param {{
 *   registry: import('#core/server/branches/branch-registry.mjs').BranchRegistryStore,
 *   home: string,
 *   legacy: { dataDir: string, backupDir: string },
 *   activeBranch: () => BranchEntry,
 *   selectBranch: (id: string) => BranchEntry,
 *   auditTrail: () => { recordChange: (change: import('#shared/contracts/audit-trail.mjs').AuditChange) => void },
 * }} dependencies
 */
export function createBranchRoutes({ registry, home, legacy, activeBranch, selectBranch, auditTrail }) {
  /** @param {BranchEntry} branch */
  const dataDirOf = branch => branchDirectories({ home, legacy, branch }).dataDir;

  return [
    {
      method: 'GET',
      path: '/api/branches',
      handle: () => ({
        activeBranchId: activeBranch().id,
        branches: registry.list().map(branch => ({ ...branch, ...countBranchRecords(dataDirOf(branch)) })),
      }),
    },
    {
      method: 'POST',
      path: '/api/branches',
      /** @param {{ body: { name?: string, color?: string, address?: string } }} request */
      handle: ({ body }) => {
        const created = registry.add({
          name: /** @type {string} */ (body?.name),
          color: body?.color,
          address: body?.address,
        });
        // Baza se creează imediat, cu schema aplicată (decizia 5 din plan) — ca „N copii · N
        // grupe” din listă și folderul de pe disc să existe de la crearea filialei, nu doar
        // la prima ei deschidere.
        const dirs = branchDirectories({ home, legacy, branch: created });
        openDatabase({ dataDir: dirs.dataDir, backupDir: dirs.backupDir }).db.close();
        auditTrail().recordChange({ action: AUDIT_ACTION, recordType: null, recordId: created.id, after: created });
        return { branch: created };
      },
    },
    {
      method: 'POST',
      path: '/api/branches/update',
      /** @param {{ body: { id?: string, name?: string, color?: string, address?: string } }} request */
      handle: ({ body }) => {
        const id = /** @type {string} */ (body?.id);
        const before = registry.find(id);
        const updated = registry.update(id, { name: body?.name, color: body?.color, address: body?.address });
        auditTrail().recordChange({ action: AUDIT_ACTION, recordType: null, recordId: id, before, after: updated });
        return { branch: updated };
      },
    },
    {
      method: 'POST',
      path: '/api/branches/select',
      /** @param {{ body: { id?: string } }} request */
      handle: ({ body }) => ({ branch: selectBranch(/** @type {string} */ (body?.id)) }),
    },
    {
      method: 'GET',
      path: '/api/branches/records',
      /** @param {{ url: URL }} request */
      handle: ({ url }) => {
        const id = url.searchParams.get('id');
        if (!id) fail('Trebuie specificat id.');
        if (id === activeBranch().id) fail('Folosește /api/state pentru filiala deschisă.');
        const target = registry.find(id);
        if (!target) fail('Filială inexistentă.', 404);
        const opened = openDatabaseReadOnly({ dataDir: dataDirOf(target) });
        if (!opened) return { state: emptyState() };
        try {
          return { state: createRecordRepository(opened.db).readSnapshot() };
        } finally {
          opened.db.close();
        }
      },
    },
  ];
}
