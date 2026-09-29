import { missingDefaultServiceSeeds, normalizeRecord } from '#shared/domain/record-schema.mjs';

/**
 * Rulează la fiecare deschidere a unei filiale (ca `seedExpenseCategories`) — o instalare
 * existentă, fără `services`, primește Grădiniță + Bazin o singură dată; după aceea rămân
 * editabile (nume, ton) ca orice alt serviciu, fără să reapară dacă lipsesc din alt motiv
 * decât „niciodată create”.
 *
 * Scrie prin depozitul BRUT (fără outbox), în aceeași tranzacție ca `seedExpenseCategories`
 * (B-1 din audit): cele 2 servicii de sistem au id fix, identic pe orice calculator — prin
 * outbox ar intra ca modificări proprii și ar da conflicte false la prima sincronizare.
 * @param {{
 *   database: import('node:sqlite').DatabaseSync,
 *   recordRepository: import('#shared/contracts/persistence.mjs').RecordRepository,
 * }} dependencies
 */
export function seedServices({ database, recordRepository }) {
  database.exec('BEGIN IMMEDIATE');
  try {
    for (const seed of missingDefaultServiceSeeds(recordRepository.readSnapshot()))
      recordRepository.save('services', normalizeRecord('services', seed));
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}
