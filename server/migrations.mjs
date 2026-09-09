import { randomUUID } from 'node:crypto';
import { TYPES } from '../shared/domain.mjs';

const hasTable = (db, name) => !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name);

// Lista de migrări ale schemei. Fiecare rulează o singură dată, în ordine, cu
// backup automat înainte și într-o tranzacție proprie. Adaugă una nouă la
// finalul listei, cu numărul următor — nu modifica niciodată una deja lansată,
// altfel o bază reală care a trecut deja prin ea ar rula-o din nou greșit.
export const MIGRATIONS = [
  {
    version: 1,
    description: 'app_state (JSON unic) → records (un rând per fișă)',
    run(db) {
      if (!hasTable(db, 'app_state')) return;
      const row = db.prepare('SELECT payload FROM app_state WHERE id=1').get();
      if (!row) return;
      const legacy = JSON.parse(row.payload);
      for (const type of TYPES)
        for (const r of legacy[type] || [])
          db.prepare('INSERT INTO records VALUES(?,?,?)').run(type, r.id, JSON.stringify(r));
    },
  },
  {
    version: 2,
    description: 'Grupă: câmp text liber pe copil → entitate proprie (groups), copil ține groupId',
    run(db) {
      const children = db.prepare("SELECT id,payload FROM records WHERE kind='children'").all();
      const nameToId = new Map();
      for (const row of children) {
        const c = JSON.parse(row.payload);
        const name = String(c.group || '').trim();
        if (name && !nameToId.has(name)) nameToId.set(name, `GRP-${randomUUID()}`);
      }
      for (const [name, id] of nameToId)
        db.prepare('INSERT INTO records VALUES(?,?,?)').run('groups', id, JSON.stringify({ id, name, capacity: null }));
      for (const row of children) {
        const c = JSON.parse(row.payload);
        const name = String(c.group || '').trim();
        delete c.group;
        c.groupId = name ? nameToId.get(name) : null;
        db.prepare('UPDATE records SET payload=? WHERE kind=? AND id=?').run(JSON.stringify(c), 'children', row.id);
      }
    },
  },
];
