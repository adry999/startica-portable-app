import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(new URL('../scripts/import-v5-history.mjs', import.meta.url));

// Importurile statice se rezolvă înaintea verificării fișierului sursă: un modul șters apare aici, nu la client.
test('scriptul de import V5 își încarcă modulele și cere un fișier sursă existent', () => {
  const result = spawnSync(process.execPath, [scriptPath, 'fisier-care-nu-exista.xlsx'], { encoding: 'utf8' });

  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.stderr, /ERR_MODULE_NOT_FOUND/);
  assert.match(result.stderr, /Fișierul sursă lipsește/);
});
