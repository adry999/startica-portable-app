import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRotatingLogFile } from './rotating-log-file.mjs';

test('scrie linia cu prefix ISO și nivel', () => {
  const dir = mkdtempSync(join(tmpdir(), 'startica-log-'));
  const file = join(dir, 'startica.log');
  createRotatingLogFile({ file }).write('INFO', 'Startica: http://127.0.0.1:8765');
  const [line] = readFileSync(file, 'utf8').trim().split('\n');
  assert.match(line, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z INFO Startica: http:\/\/127\.0\.0\.1:8765$/);
  rmSync(dir, { recursive: true, force: true });
});

test('rotește într-o singură generație când fișierul depășește pragul', () => {
  const dir = mkdtempSync(join(tmpdir(), 'startica-log-'));
  const file = join(dir, 'startica.log');
  const rotated = join(dir, 'startica.1.log');
  writeFileSync(file, 'continut vechi');
  createRotatingLogFile({ file, maxBytes: 10 }).write('INFO', 'linia care declanșează rotația');
  assert.equal(readFileSync(rotated, 'utf8'), 'continut vechi');
  assert.match(readFileSync(file, 'utf8'), /linia care declanșează rotația/);
  rmSync(dir, { recursive: true, force: true });
});
