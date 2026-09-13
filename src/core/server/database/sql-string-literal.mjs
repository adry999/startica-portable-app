// SQLite nu acceptă parametri legați în VACUUM INTO, deci calea se citează manual.
/** @param {unknown} value */
export const sqlStringLiteral = value => `'${String(value).replaceAll("'", "''")}'`;
