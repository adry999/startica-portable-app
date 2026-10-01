// PROMPT-CLAUDE-CODE-8.md §1.2 punctul 4: lista bazelor și tipurilor din backup trebuie
// derivată din record-schema.mjs + schema bazei comune, nu scrisă de mână — un kind nou
// adăugat la oricare din cele două trebuie să apară automat în manifestul backup-ului
// complet. Testul trăiește aici (nu în src/features/backup/server/) pentru că trebuie să
// citească atât #features/backup cât și #features/personal — o combinație pe care regula
// feature-imports-feature o interzice unei feature obișnuite, dar tests/ o poate face.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { applySchema } from '#core/server/database/schema.mjs';
import { TYPES } from '#shared/domain/record-schema.mjs';
import { PERSONAL_KINDS } from '#features/personal/index.server.mjs';
import { summarizeDatabaseContents } from '#features/backup/index.server.mjs';

test('summarizeDatabaseContents acoperă fiecare kind din TYPES (filială) și PERSONAL_KINDS (comun), fără listă scrisă de mână', t => {
  const dir = mkdtempSync(join(tmpdir(), 'startica-backup-manifest-coverage-'));
  const file = join(dir, 'startica.db');
  const db = new DatabaseSync(file);
  applySchema(db);
  t.after(() => db.close());
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  // O singură bază de test, cu ambele seturi de kind-uri populate: azi nu există o bază
  // reală care să le amestece (filială vs. comun), dar testul verifică doar că NICIUN kind
  // din niciuna din cele două liste nu poate rămâne, tăcut, în afara counts.
  const insert = db.prepare('INSERT INTO records (kind, id, payload) VALUES (?, ?, ?)');
  for (const kind of [...TYPES, ...PERSONAL_KINDS]) insert.run(kind, `${kind}-1`, '{}');

  const counts = summarizeDatabaseContents(file);

  for (const kind of TYPES) assert.equal(counts[kind], 1, `TYPES: kind lipsă din manifest: ${kind}`);
  for (const kind of PERSONAL_KINDS) assert.equal(counts[kind], 1, `PERSONAL_KINDS: kind lipsă din manifest: ${kind}`);
});
