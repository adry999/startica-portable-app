import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MODULE_IDS,
  ACCESS_NONE,
  ACCESS_READ,
  ACCESS_WRITE,
  completProfile,
  presetModules,
  clampModules,
  normalizeProfile,
  isModuleAllowed,
  requiresPin,
  firstAllowedModule,
  KIND_MODULE,
} from './computer-profile.mjs';

test('completProfile are toate modulele la Modifică și nu e blocat', () => {
  const profile = completProfile();
  assert.equal(profile.preset, 'complet');
  assert.equal(profile.blocked, false);
  for (const moduleId of MODULE_IDS) assert.equal(profile.modules[moduleId], ACCESS_WRITE);
});

test('presetModules(educator) dă Prezența Modifică, Copii/Grupe Vede, restul Nu vede', () => {
  const modules = presetModules('educator');
  assert.equal(modules.attendance, ACCESS_WRITE);
  assert.equal(modules.children, ACCESS_READ);
  assert.equal(modules.groups, ACCESS_READ);
  assert.equal(modules.payments, ACCESS_NONE);
  assert.equal(modules.admin, ACCESS_NONE);
});

test('presetModules(receptie) dă Vizite și Prezența Modifică, Copii/Grupe Vede', () => {
  const modules = presetModules('receptie');
  assert.equal(modules.visits, ACCESS_WRITE);
  assert.equal(modules.attendance, ACCESS_WRITE);
  assert.equal(modules.children, ACCESS_READ);
  assert.equal(modules.expenses, ACCESS_NONE);
});

test('presetModules(bazin) dă Bazin Modifică, Copii Vede, restul Nu vede', () => {
  const modules = presetModules('bazin');
  assert.equal(modules.pool, ACCESS_WRITE);
  assert.equal(modules.children, ACCESS_READ);
  assert.equal(modules.attendance, ACCESS_NONE);
});

test('presetModules(personalizat) pornește de la Nu vede pe tot', () => {
  const modules = presetModules('personalizat');
  for (const moduleId of MODULE_IDS) assert.equal(modules[moduleId], ACCESS_NONE);
});

test('clampModules forțează admin la 0 pentru orice preset în afară de complet', () => {
  const clamped = clampModules('personalizat', { admin: ACCESS_WRITE, payments: ACCESS_WRITE });
  assert.equal(clamped.admin, ACCESS_NONE);
  assert.equal(clamped.payments, ACCESS_WRITE);
});

test('clampModules lasă admin neatins pe profilul complet', () => {
  const clamped = clampModules('complet', { admin: ACCESS_WRITE });
  assert.equal(clamped.admin, ACCESS_WRITE);
});

test('clampModules înlocuiește orice valoare în afara 0/1/2 cu 0', () => {
  const clamped = clampModules('personalizat', { payments: 7, children: -1 });
  assert.equal(clamped.payments, ACCESS_NONE);
  assert.equal(clamped.children, ACCESS_NONE);
});

test('normalizeProfile respinge un preset necunoscut și cade pe personalizat cu modulele date', () => {
  const profile = normalizeProfile({ preset: 'altceva', modules: { children: ACCESS_WRITE } });
  assert.equal(profile.preset, 'personalizat');
  assert.equal(profile.modules.children, ACCESS_WRITE);
});

test('normalizeProfile recalculează modulele unui preset fix din tabelul canonic, ignorând orice modules trimis', () => {
  const profile = normalizeProfile({ preset: 'bazin', modules: { admin: ACCESS_WRITE, payments: ACCESS_WRITE } });
  assert.equal(profile.modules.admin, ACCESS_NONE);
  assert.equal(profile.modules.payments, ACCESS_NONE);
  assert.equal(profile.modules.pool, ACCESS_WRITE);
});

test('normalizeProfile elimină un modul necunoscut din pinModules și scoate duplicate', () => {
  const profile = normalizeProfile({ preset: 'complet', pinModules: ['payments', 'payments', 'nu-exista'] });
  assert.deepEqual(profile.pinModules, ['payments']);
});

test('isModuleAllowed tratează profilul absent (null) ca Complet', () => {
  assert.equal(isModuleAllowed(null, 'admin', ACCESS_WRITE), true);
  assert.equal(isModuleAllowed(undefined, 'payments'), true);
});

test('isModuleAllowed respectă nivelul minim cerut', () => {
  const profile = normalizeProfile({ preset: 'educator' });
  assert.equal(isModuleAllowed(profile, 'children', ACCESS_READ), true);
  assert.equal(isModuleAllowed(profile, 'children', ACCESS_WRITE), false);
  assert.equal(isModuleAllowed(profile, 'payments', ACCESS_READ), false);
});

test('isModuleAllowed întoarce false pe orice modul când profilul e blocat', () => {
  const profile = normalizeProfile({ preset: 'complet', blocked: true });
  assert.equal(isModuleAllowed(profile, 'children'), false);
  assert.equal(isModuleAllowed(profile, 'admin'), false);
});

test('requiresPin urmează lista pinModules a profilului și e falsă când e blocat', () => {
  const profile = normalizeProfile({
    preset: 'personalizat',
    modules: { payments: ACCESS_WRITE },
    pinModules: ['payments'],
  });
  assert.equal(requiresPin(profile, 'payments'), true);
  assert.equal(requiresPin(profile, 'children'), false);
  assert.equal(requiresPin({ ...profile, blocked: true }, 'payments'), false);
});

test('firstAllowedModule alege primul modul cu acces de citire din ordinea canonică, fără admin', () => {
  const profile = normalizeProfile({ preset: 'bazin' });
  assert.equal(firstAllowedModule(profile), 'children');
});

test('firstAllowedModule întoarce null când niciun modul nu e permis', () => {
  const profile = normalizeProfile({ preset: 'personalizat' });
  assert.equal(firstAllowedModule(profile), null);
});

test('KIND_MODULE acoperă toate tipurile de înregistrare sincronizate, fără audit_log', () => {
  for (const moduleId of Object.values(KIND_MODULE)) assert.ok(MODULE_IDS.includes(moduleId));
  assert.equal(KIND_MODULE.audit_log, undefined);
});
