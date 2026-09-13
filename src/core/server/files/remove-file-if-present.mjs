import { existsSync, unlinkSync } from 'node:fs';

// Ștergere best-effort a unui fișier intermediar; nu are voie să ascundă eroarea originală.
/** @param {string} file */
export const removeFileIfPresent = file => {
  try {
    if (existsSync(file)) unlinkSync(file);
  } catch {}
};
