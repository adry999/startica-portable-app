/** @param {any} row */
function toEntry(row) {
  if (!row) return undefined;
  return {
    kind: row.kind,
    id: row.id,
    serverRevision: row.server_revision,
    updatedAt: row.updated_at,
    updatedByDevice: row.updated_by_device,
    updatedByName: row.updated_by_name,
  };
}

/**
 * Ultima revizie confirmată de server pentru fiecare înregistrare (`sync_state`) —
 * distinctă de `meta.revision` (revizia de tab, la nivel de client).
 * @param {import('node:sqlite').DatabaseSync} database
 */
export function createSyncStateRepository(database) {
  const getStatement = database.prepare('SELECT * FROM sync_state WHERE kind=? AND id=?');
  const upsertStatement = database.prepare(
    `INSERT INTO sync_state(kind,id,server_revision,updated_at,updated_by_device,updated_by_name) VALUES(?,?,?,?,?,?)
     ON CONFLICT(kind,id) DO UPDATE SET server_revision=excluded.server_revision,updated_at=excluded.updated_at,
       updated_by_device=excluded.updated_by_device,updated_by_name=excluded.updated_by_name`,
  );

  /** @param {string} kind @param {string} id */
  function get(kind, id) {
    return toEntry(getStatement.get(kind, id));
  }

  /**
   * @param {string} kind @param {string} id
   * @param {{ serverRevision: number, updatedAt: string, updatedByDevice: string, updatedByName?: string }} entry
   */
  function set(kind, id, entry) {
    upsertStatement.run(
      kind,
      id,
      entry.serverRevision,
      entry.updatedAt,
      entry.updatedByDevice,
      entry.updatedByName ?? '',
    );
  }

  /** @param {{ kind: string, id: string, serverRevision: number, updatedAt: string, updatedByDevice: string, updatedByName?: string }[]} entries */
  function setMany(entries) {
    for (const entry of entries) set(entry.kind, entry.id, entry);
  }

  return { get, set, setMany };
}
