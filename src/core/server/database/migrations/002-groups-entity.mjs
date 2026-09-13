import { randomUUID } from 'node:crypto';

export const migration = {
  version: 2,
  description: 'Grupă: câmp text liber pe copil → entitate proprie (groups), copil ține groupId',
  run(database) {
    const children = database.prepare("SELECT id,payload FROM records WHERE kind='children'").all();
    const nameToId = new Map();
    for (const row of children) {
      const child = JSON.parse(row.payload);
      const name = String(child.group || '').trim();
      if (name && !nameToId.has(name)) nameToId.set(name, `GRP-${randomUUID()}`);
    }
    for (const [name, id] of nameToId)
      database
        .prepare('INSERT INTO records VALUES(?,?,?)')
        .run('groups', id, JSON.stringify({ id, name, capacity: null }));
    for (const row of children) {
      const child = JSON.parse(row.payload);
      const name = String(child.group || '').trim();
      delete child.group;
      child.groupId = name ? nameToId.get(name) : null;
      database
        .prepare('UPDATE records SET payload=? WHERE kind=? AND id=?')
        .run(JSON.stringify(child), 'children', row.id);
    }
  },
};
