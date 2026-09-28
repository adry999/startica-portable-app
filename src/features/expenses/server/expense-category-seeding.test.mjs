import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { applySchema } from '#core/server/database/schema.mjs';
import { createRecordRepository } from '#core/server/persistence/record-repository.mjs';
import { seedExpenseCategories } from './expense-category-seeding.mjs';
import { DEFAULT_EXPENSE_CATEGORY_SEEDS, GENERAL_CATEGORY_ID } from '#shared/domain/expense-categories.mjs';

function createRepository(t) {
  const database = new DatabaseSync(':memory:');
  applySchema(database);
  t.after(() => database.close());
  return createRecordRepository(database);
}

test('pe o filială nouă, seamănă toate categoriile implicite, inclusiv General', t => {
  const recordRepository = createRepository(t);

  seedExpenseCategories(recordRepository);

  const categories = recordRepository.readSnapshot().categories;
  assert.equal(categories.length, DEFAULT_EXPENSE_CATEGORY_SEEDS.length);
  assert.ok(categories.some(category => category.id === GENERAL_CATEGORY_ID && category.name === 'General'));
});

test('rulată a doua oară, nu duplică semințele și nu rescrie o categorie redenumită de operator', t => {
  const recordRepository = createRepository(t);
  seedExpenseCategories(recordRepository);
  recordRepository.save('categories', { id: 'CAT-altele', name: 'Diverse' });

  seedExpenseCategories(recordRepository);

  const categories = recordRepository.readSnapshot().categories;
  assert.equal(categories.length, DEFAULT_EXPENSE_CATEGORY_SEEDS.length);
  assert.equal(categories.find(category => category.id === 'CAT-altele')?.name, 'Diverse');
});

test('nu recreează o categorie implicită ștearsă deliberat de operator', t => {
  const recordRepository = createRepository(t);
  seedExpenseCategories(recordRepository);
  recordRepository.remove('categories', 'CAT-alimente');

  seedExpenseCategories(recordRepository);

  const categories = recordRepository.readSnapshot().categories;
  assert.ok(!categories.some(category => category.id === 'CAT-alimente'));
});

test('un install existent, cu o categorie proprie deja creată, primește totuși semințele implicite', t => {
  const recordRepository = createRepository(t);
  recordRepository.save('categories', { id: 'CAT-custom', name: 'Excursii' });

  seedExpenseCategories(recordRepository);

  const categories = recordRepository.readSnapshot().categories;
  assert.ok(categories.some(category => category.id === GENERAL_CATEGORY_ID));
  assert.equal(categories.length, DEFAULT_EXPENSE_CATEGORY_SEEDS.length + 1);
});

test('creează o categorie pentru numele folosit doar de o cheltuială veche, ca nimic să nu rămână fără categorie', t => {
  const recordRepository = createRepository(t);
  recordRepository.save('expenses', {
    id: 'EXP-1',
    date: '2026-01-01',
    category: 'Rechizite școlare',
    description: '',
    amount: 10,
  });

  seedExpenseCategories(recordRepository);

  const categories = recordRepository.readSnapshot().categories;
  assert.ok(categories.some(category => category.name === 'Rechizite școlare'));
});

test('migrarea numelor doar-pe-cheltuieli rulează la fiecare deschidere, nu doar prima', t => {
  const recordRepository = createRepository(t);
  seedExpenseCategories(recordRepository);
  recordRepository.save('expenses', {
    id: 'EXP-1',
    date: '2026-01-01',
    category: 'Excursie tabără',
    description: '',
    amount: 10,
  });

  seedExpenseCategories(recordRepository);

  const categories = recordRepository.readSnapshot().categories;
  assert.ok(categories.some(category => category.name === 'Excursie tabără'));
});
