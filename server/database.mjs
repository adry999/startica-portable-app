// Fațadă păstrată pentru compatibilitate; codul a fost mutat în src/core/server (pasul 4 din plan).
export { openDatabase } from '#core/server/database/sqlite-connection.mjs';
export { createSettingsRepository as createSettings } from '#core/server/settings/settings-repository.mjs';
