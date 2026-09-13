// Fațadă păstrată pentru compatibilitate; codul a fost mutat în src/core/server (pasul 4 din plan).
export { fail } from '#core/server/errors/domain-error.mjs';
export { sha256Hex as hash } from '#core/server/persistence/content-digest.mjs';
export { sqlStringLiteral as sqlString } from '#core/server/database/sql-string-literal.mjs';
export { fileTimestamp as stamp } from '#core/server/files/file-timestamp.mjs';
export { removeFileIfPresent as discard } from '#core/server/files/remove-file-if-present.mjs';
