import test from 'node:test';
import assert from 'node:assert/strict';
import { selectBackupsToKeep } from './backup-retention.mjs';

test('Retenția păstrează zile/luni și copii anterioare restaurării', () => {
  const files = Array.from({ length: 80 }, (_, i) => ({
    name: `startica_new_${i}.db`,
    modified: `2026-09-08T12:${String(i % 60).padStart(2, '0')}:00Z`,
  }));
  files.push(
    { name: 'startica_old.db', modified: '2026-08-01T00:00:00Z' },
    { name: 'startica_inainte-import.db', modified: '2024-01-01T00:00:00Z' },
  );
  const keep = selectBackupsToKeep(files);
  assert.ok(keep.has('startica_old.db'));
  assert.ok(keep.has('startica_inainte-import.db'));
  assert.ok(keep.size < files.length);
});

test('o copie de migrare nu expiră niciodată, indiferent cât de veche', () => {
  const files = [
    { name: 'startica_migrare.db', modified: '2020-01-01T00:00:00Z' },
    { name: 'startica_recent.db', modified: '2026-09-08T00:00:00Z' },
  ];
  assert.ok(selectBackupsToKeep(files).has('startica_migrare.db'));
});

test('păstrează cele mai recente 20 de copii chiar dacă sunt în aceeași zi', () => {
  const files = Array.from({ length: 25 }, (_, i) => ({
    name: `startica_${i}.db`,
    modified: `2026-09-08T00:${String(i).padStart(2, '0')}:00Z`,
  }));
  const keep = selectBackupsToKeep(files);
  const newest20 = files
    .slice()
    .sort((a, b) => b.modified.localeCompare(a.modified))
    .slice(0, 20)
    .map(file => file.name);
  for (const name of newest20) assert.ok(keep.has(name));
  // Restul celor 5 mai vechi sunt totuși păstrate prin regula „o zi cu backup”, nu prin cele 20.
  assert.equal(keep.size, 20);
});
