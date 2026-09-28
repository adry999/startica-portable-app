import { randomUUID } from 'node:crypto';
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
 * Scrie direct pe `recordRepository`, fără `runRevisionTransaction`: rulează sincron la
 * construcția rutelor, înainte ca vreun client să citească starea filialei, deci nu are
 * cine să vadă o revizie „în urmă”; iar semințele implicite au id fix, ca două calculatoare
 * care le seamănă independent să scrie exact aceeași înregistrare.
 * @param {import('#shared/contracts/persistence.mjs').RecordRepository} recordRepository
 */
export function seedExpenseCategories(recordRepository) {
  for (const seed of missingDefaultCategorySeeds(recordRepository.readSnapshot()))
    recordRepository.save('categories', seed);
  for (const seed of missingExpenseOnlyCategorySeeds(recordRepository.readSnapshot(), () => `CAT-${randomUUID()}`))
    recordRepository.save('categories', seed);
}
