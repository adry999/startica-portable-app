import { randomUUID } from 'node:crypto';

export const migration = {
  version: 3,
  description: 'Copil: notes text liber → listă de note cu dată (fișa copilului, 09-copii-fisa.md CF-4)',
  run(database) {
    const children = database.prepare("SELECT id,payload FROM records WHERE kind='children'").all();
    const today = new Date().toISOString().slice(0, 10);
    for (const row of children) {
      const child = JSON.parse(row.payload);
      if (typeof child.notes !== 'string') continue;
      const text = child.notes.trim();
      child.notes = text ? [{ id: `NOTE-${randomUUID()}`, text, date: today }] : [];
      database
        .prepare('UPDATE records SET payload=? WHERE kind=? AND id=?')
        .run(JSON.stringify(child), 'children', row.id);
    }
  },
};
