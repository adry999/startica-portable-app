/**
 * Împachetează depozitul brut de înregistrări cu capturarea coadei de sincronizare
 * (decizia 4 din plan): fiecare `save`/`remove` scrie mai întâi în `records` (ca
 * astăzi), apoi, doar dacă sincronizarea e configurată, pune schimbarea în
 * `sync_outbox` — în aceeași tranzacție, pentru că apelantul (runRevisionTransaction)
 * o rulează deja în interiorul unui `BEGIN IMMEDIATE`. Restul modulelor primesc
 * exact interfața lui createRecordRepository, deci nu știu că sincronizarea există.
 * @param {ReturnType<typeof import('#core/server/persistence/record-repository.mjs').createRecordRepository>} raw
 * @param {ReturnType<typeof import('./sync-outbox.repository.mjs').createSyncOutboxRepository>} outbox
 * @param {() => boolean} isEnabled
 */
export function createOutboxRecordingRepository(raw, outbox, isEnabled) {
  // Fără adnotare de tip pe „type”/„record”: la fel ca createRecordRepository, care
  // primește orice RecordType prin același argument generic — o adnotare explicită
  // aici ar restrânge inferența lui TS și ar cere un Child/Payment/... complet unde
  // apelantul (deja validat de normalizeRecord) trimite orice înregistrare normalizată.
  // save/remove întorc exact ce întoarce raw.save/raw.remove (nu void): altfel tipul
  // structural al obiectului împachetat nu s-ar mai potrivi cu ReturnType<typeof
  // createRecordRepository>, folosit ca atare de createRevisionTransaction.
  function save(type, record) {
    const before = raw.find(type, record.id);
    const result = raw.save(type, record);
    if (isEnabled() && JSON.stringify(before) !== JSON.stringify(record))
      outbox.enqueue({ kind: type, recordId: record.id, payload: record });
    return result;
  }

  function remove(type, id) {
    const result = raw.remove(type, id);
    if (isEnabled()) outbox.enqueue({ kind: type, recordId: id, payload: null });
    return result;
  }

  return { ...raw, save, remove };
}

/**
 * Aceeași verificare de activare, pentru modulele cu propriul depozit (prezența,
 * șabloanele SMS) și pentru `replaceAllRecords` — un singur loc care decide dacă
 * sincronizarea e configurată, nu unul per apelant.
 * @param {{
 *   outbox: ReturnType<typeof import('./sync-outbox.repository.mjs').createSyncOutboxRepository>,
 *   isEnabled: () => boolean,
 * }} dependencies
 * @returns {import('#shared/contracts/change-sink.d.mts').ChangeSink}
 */
export function createChangeSink({ outbox, isEnabled }) {
  return {
    record(kind, id, payload) {
      if (!isEnabled()) return;
      outbox.enqueue({ kind, recordId: id, payload });
    },
  };
}
