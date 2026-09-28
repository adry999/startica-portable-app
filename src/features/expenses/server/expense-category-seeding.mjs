import { missingDefaultCategorySeeds, missingExpenseOnlyCategorySeeds } from '#shared/domain/expense-categories.mjs';

/**
 * Rulează la fiecare deschidere a unei filiale (apelată din `createExpenseCategoriesRoutes`,
 * la construcție — la fel ca semințele Personal 24 din `createPersonalRepository`). Două
 * semințe diferite, cu politici diferite:
 *  - categoriile implicite (inclusiv „General”) se scriu o singură dată — după aceea rămân
 *    editabile/ștergibile ca oricare altă categorie, fără să reapară (vezi missingDefaultCategorySeeds);
 *  - o categorie pentru un nume folosit doar de o cheltuială fără înregistrare corespunzătoare
 *    (perioada în care categoria era doar text) se completează de fiecare dată, ca nimic să
 *    nu rămână „în aer”, chiar dacă apare mai târziu (import, restaurare).
 *
 * Scrie prin depozitul BRUT (fără outbox), într-o singură tranzacție (B-1 din audit): rulează
 * sincron la construcția rutelor, înainte ca vreun client să citească starea filialei sau ca
 * snapshot-ul serverului să fi ajuns pe acest calculator (Faza 5) — trecerea prin depozitul cu
 * outbox ar pune cele 8 categorii implicite (id fix, identice pe orice calculator) în outbox ca
 * modificări proprii, deci conflicte false la prima sincronizare a unui calculator nou.
 * @param {{
 *   database: import('node:sqlite').DatabaseSync,
 *   recordRepository: import('#shared/contracts/persistence.mjs').RecordRepository,
 * }} dependencies
 */
export function seedExpenseCategories({ database, recordRepository }) {
  database.exec('BEGIN IMMEDIATE');
  try {
    for (const seed of missingDefaultCategorySeeds(recordRepository.readSnapshot()))
      recordRepository.save('categories', seed);
    for (const seed of missingExpenseOnlyCategorySeeds(recordRepository.readSnapshot()))
      recordRepository.save('categories', seed);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}
