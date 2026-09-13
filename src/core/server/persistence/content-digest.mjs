import { createHash } from 'node:crypto';

/** @param {string} value */
export const sha256Hex = value => createHash('sha256').update(value).digest('hex');
