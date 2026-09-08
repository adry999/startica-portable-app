import { existsSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';

// Eroare cu status HTTP. Rutele o lasă să urce; handlerul o transformă în răspuns.
export const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
export const hash = value => createHash('sha256').update(value).digest('hex');
// SQLite nu acceptă parametri legați în VACUUM INTO, deci calea se citează manual.
export const sqlString = value => `'${String(value).replaceAll("'", "''")}'`;
export const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');
// Ștergere best-effort a unui fișier intermediar; nu are voie să ascundă eroarea originală.
export const discard = file => {
  try {
    if (existsSync(file)) unlinkSync(file);
  } catch {}
};
