/**
 * Eroare cu status HTTP. Rutele o lasă să urce; handlerul o transformă în răspuns.
 * @param {string} message
 * @param {number} [status]
 * @returns {never}
 */
export function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}
