import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { applySchema } from '#core/server/database/schema.mjs';
import { migration as groupsEntityMigration } from '#core/server/database/migrations/002-groups-entity.mjs';
import { upgradeSnapshot } from '#shared/domain/record-snapshot-upgrade.mjs';

// Verifică faptul că record-snapshot-upgrade.mjs reproduce exact regula de
// conversie a migrării 002 (schema SQLite), nu doar o interpretare similară —
// cele două nu au voie să diverge, altfel un backup restaurat și o bază
// migrată la pornire ar ajunge cu grupe diferite pentru aceleași date.

/** @param {{ id: string, name: string, group?: string }[]} children */
function childrenByGroupName(children, groups) {
  const nameById = new Map(groups.map(group => [group.id, group.name]));
  return Object.fromEntries(children.map(child => [child.id, child.groupId ? nameById.get(child.groupId) : null]));
}

test('upgradeSnapshot() creează exact aceleași grupe și asocieri ca migrația 002', () => {
  const fixture = [
    { id: 'C1', name: 'Ana', group: 'Fluturași' },
    { id: 'C2', name: 'Ion', group: ' Fluturași ' },
    { id: 'C3', name: 'Maria', group: 'Albinuțe' },
    { id: 'C4', name: 'Vlad', group: '' },
    { id: 'C5', name: 'Radu' },
  ];

  const dir = mkdtempSync(join(tmpdir(), 'startica-migration-002-parity-'));
  let migrated;
  try {
    const database = new DatabaseSync(join(dir, 'startica.db'));
    try {
      applySchema(database);
      for (const child of fixture)
        database.prepare('INSERT INTO records VALUES(?,?,?)').run('children', child.id, JSON.stringify(child));
      groupsEntityMigration.run(database);
      const children = database
        .prepare("SELECT payload FROM records WHERE kind='children'")
        .all()
        .map(row => JSON.parse(/** @type {string} */ (row.payload)));
      const groups = database
        .prepare("SELECT payload FROM records WHERE kind='groups'")
        .all()
        .map(row => JSON.parse(/** @type {string} */ (row.payload)));
      migrated = { children, groups };
    } finally {
      database.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  const upgraded = upgradeSnapshot({ children: fixture, payments: [], expenses: [], groups: [], categories: [] });

  assert.deepEqual(
    new Set(migrated.groups.map(group => group.name)),
    new Set(upgraded.snapshot.groups.map(group => group.name)),
  );
  assert.deepEqual(
    childrenByGroupName(migrated.children, migrated.groups),
    childrenByGroupName(upgraded.snapshot.children, upgraded.snapshot.groups),
  );
});
