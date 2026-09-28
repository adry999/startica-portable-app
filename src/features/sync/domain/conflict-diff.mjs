import { redactSensitiveFields } from '#shared/domain/record-schema.mjs';

/**
 * Compară cele două variante ale unei înregistrări aflate în conflict (14c),
 * câmp cu câmp, ca ecranul să evidențieze doar ce diferă. Notele medicale
 * (`SENSITIVE_FIELDS`) sunt redactate pe ambele părți înainte de comparație —
 * aceeași regulă ca în Istoric (`redactSensitiveFields`), ca ecranul de
 * conflicte să nu scurgă date medicale în clar.
 * @param {string} kind
 * @param {Record<string, unknown> | null} local
 * @param {Record<string, unknown> | null} remote
 * @returns {{ field: string, local: unknown, remote: unknown, differs: boolean }[]}
 */
export function diffFields(kind, local, remote) {
  const redactedLocal = local ? redactSensitiveFields(kind, local) : null;
  const redactedRemote = remote ? redactSensitiveFields(kind, remote) : null;
  const fields = [];
  const seen = new Set();
  for (const source of [redactedLocal, redactedRemote]) {
    if (!source) continue;
    for (const field of Object.keys(source)) {
      if (field === 'id' || seen.has(field)) continue;
      seen.add(field);
      fields.push(field);
    }
  }
  return fields.map(field => {
    const localValue = redactedLocal ? redactedLocal[field] : undefined;
    const remoteValue = redactedRemote ? redactedRemote[field] : undefined;
    return { field, local: localValue, remote: remoteValue, differs: JSON.stringify(localValue) !== JSON.stringify(remoteValue) };
  });
}
