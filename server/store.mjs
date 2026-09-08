import { TYPES, emptyState } from '../domain.mjs';
import { fail, hash } from './util.mjs';

const REQUEST_ID = /^[a-zA-Z0-9-]{10,100}$/;

export function createStore({ db, backups }) {
  function readState() {
    const s = emptyState();
    for (const r of db.prepare('SELECT kind,payload FROM records ORDER BY rowid').all())
      s[r.kind].push(JSON.parse(r.payload));
    return s;
  }
  function envelope() {
    const m = db.prepare('SELECT * FROM meta WHERE id=1').get();
    return { state: readState(), revision: m.revision, updatedAt: m.updated_at };
  }
  // Verificarea reviziei și căutarea unei singure înregistrări nu au nevoie de
  // starea completă. readState() parsează JSON pentru fiecare rând din bază;
  // folosit pentru a compara un întreg, costul crește cu toată evidența.
  const currentRevision = () => db.prepare('SELECT revision FROM meta WHERE id=1').get().revision;
  function readRecord(kind, id) {
    const row = db.prepare('SELECT payload FROM records WHERE kind=? AND id=?').get(kind, id);
    return row ? JSON.parse(row.payload) : undefined;
  }
  const recordExists = (kind, id) => !!db.prepare('SELECT 1 FROM records WHERE kind=? AND id=?').get(kind, id);

  const writeRecord = (kind, record) =>
    db
      .prepare('INSERT INTO records VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET payload=excluded.payload')
      .run(kind, record.id, JSON.stringify(record));

  function audit(action, type, id, before, after) {
    db.prepare(
      'INSERT INTO audit_changes(created_at,action,kind,record_id,before_json,after_json) VALUES(?,?,?,?,?,?)',
    ).run(
      new Date().toISOString(),
      action,
      type,
      id,
      before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null,
    );
  }

  // Orice modificare trece pe aici. Trei garanții:
  //  - idempotență: același requestId întoarce rezultatul anterior, deci o
  //    cerere reluată după o cădere de rețea nu produce o a doua înregistrare;
  //  - revizia cerută de client este verificată și în interiorul tranzacției,
  //    ca o a doua filă să nu suprascrie o modificare pe care nu a văzut-o;
  //  - preBackup pentru operațiunile ireversibile, înainte de a atinge datele.
  function commit(body, action, fn, preBackup = false) {
    if (typeof body.requestId !== 'string' || !REQUEST_ID.test(body.requestId))
      fail('Identificator de operațiune invalid.');
    const digest = hash(JSON.stringify({ action, ...body })),
      prior = db.prepare('SELECT * FROM requests WHERE id=?').get(body.requestId);
    if (prior) {
      if (prior.digest !== digest) fail('Operațiunea a fost deja folosită cu alte date.', 409);
      return { ok: true, replayed: true, ...envelope(), health: backups.health() };
    }
    if (body.revision !== currentRevision())
      fail(
        'Datele au fost schimbate în altă filă. Reîncarcă datele și verifică formularul înainte să salvezi din nou.',
        409,
      );
    if (preBackup) backups.backup('inainte-' + action);
    db.exec('BEGIN IMMEDIATE');
    try {
      if (body.revision !== currentRevision()) fail('Date modificate în altă filă.', 409);
      fn();
      db.prepare('UPDATE meta SET revision=revision+1,updated_at=? WHERE id=1').run(new Date().toISOString());
      db.prepare('INSERT INTO requests VALUES(?,?,?)').run(body.requestId, digest, body.revision + 1);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    const b = backups.autoBackup();
    return { ok: true, ...envelope(), warning: b.warning || '', health: backups.health() };
  }

  // Înlocuiește toată evidența (import sau restaurare), consemnând în jurnal
  // fiecare înregistrare care chiar diferă.
  function replace(s, action) {
    const before = readState();
    db.exec('DELETE FROM records');
    for (const type of TYPES) {
      for (const r of s[type]) db.prepare('INSERT INTO records VALUES(?,?,?)').run(type, r.id, JSON.stringify(r));
      const old = new Map(before[type].map(r => [r.id, r])),
        fresh = new Map(s[type].map(r => [r.id, r]));
      for (const id of new Set([...old.keys(), ...fresh.keys()]))
        if (JSON.stringify(old.get(id)) !== JSON.stringify(fresh.get(id)))
          audit(action, type, id, old.get(id), fresh.get(id));
    }
  }

  const auditPage = offset => db.prepare('SELECT * FROM audit_changes ORDER BY id DESC LIMIT 100 OFFSET ?').all(offset);

  return {
    readState,
    envelope,
    currentRevision,
    readRecord,
    recordExists,
    writeRecord,
    audit,
    auditPage,
    commit,
    replace,
  };
}
