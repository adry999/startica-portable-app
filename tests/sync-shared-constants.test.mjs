import test from 'node:test';
import assert from 'node:assert/strict';
import { SENSITIVE_FIELDS, TYPES } from '#shared/domain/record-schema.mjs';
import { BRANCH_COLORS } from '#shared/domain/branch.mjs';
import { compareVersions } from '#shared/domain/version-compare.mjs';
import { compareVersions as syncCompareVersions } from '#sync-server/version-compare.mjs';
import {
  BRANCH_COLORS as SYNC_BRANCH_COLORS,
  RECORD_KINDS,
  SENSITIVE_FIELDS as SYNC_SENSITIVE_FIELDS,
} from '#sync-server/change-policy.mjs';
import {
  MODULE_IDS,
  PRESET_IDS,
  KIND_MODULE,
  AUDIT_LOG_KIND,
  CHILDREN_FIELDS_HIDDEN_WITHOUT_PAYMENTS,
  presetModules,
} from '#shared/domain/computer-profile.mjs';
import {
  MODULE_IDS as SYNC_MODULE_IDS,
  PRESET_IDS as SYNC_PRESET_IDS,
  KIND_MODULE as SYNC_KIND_MODULE,
  AUDIT_LOG_KIND as SYNC_AUDIT_LOG_KIND,
  CHILDREN_FIELDS_HIDDEN_WITHOUT_PAYMENTS as SYNC_CHILDREN_FIELDS_HIDDEN_WITHOUT_PAYMENTS,
  presetModules as syncPresetModules,
} from '#sync-server/profile-policy.mjs';

// sync-server/ nu importă nimic din src/ (decizia 1 din plan), deci cele trei constante
// sensibile sunt copii; acest test la rădăcină e singurul loc care le ține sincronizate.
test('constantele copiate în sync-server/change-policy.mjs rămân identice cu #shared/domain/', () => {
  assert.deepEqual(RECORD_KINDS, TYPES);
  assert.deepEqual(SYNC_SENSITIVE_FIELDS, SENSITIVE_FIELDS);
  // D-1: paleta de culori a filialei — serverul trebuia să accepte hex, aplicația
  // trimite doar aceste nume; egalitatea aici previne regresia.
  assert.deepEqual(SYNC_BRANCH_COLORS, BRANCH_COLORS);
});

// §5.3: profilul de calculator e copiat în sync-server/src/profile-policy.mjs — filtrarea
// de pull/push trebuie să folosească exact aceeași listă de module și aceeași hartă
// tip→modul ca gărzile locale (`route-modules.mjs`), altfel un tip ar fi permis pe un capăt
// și tăiat pe celălalt.
test('constantele copiate în sync-server/profile-policy.mjs rămân identice cu #shared/domain/computer-profile.mjs', () => {
  assert.deepEqual(SYNC_MODULE_IDS, MODULE_IDS);
  assert.deepEqual(SYNC_PRESET_IDS, PRESET_IDS);
  assert.deepEqual(SYNC_KIND_MODULE, KIND_MODULE);
  assert.equal(SYNC_AUDIT_LOG_KIND, AUDIT_LOG_KIND);
  assert.deepEqual(SYNC_CHILDREN_FIELDS_HIDDEN_WITHOUT_PAYMENTS, CHILDREN_FIELDS_HIDDEN_WITHOUT_PAYMENTS);
  for (const preset of PRESET_IDS) assert.deepEqual(syncPresetModules(preset), presetModules(preset));
});

// §5.2 (SYNC_MIN_CLIENT_VERSION, 32-actualizari.md): aceeași regulă de comparare pe amândouă
// părțile — altfel un client „compatibil” pentru sync-server/ ar putea fi „mai vechi” pentru
// update-check.service.mjs, sau invers.
test('compareVersions copiat în sync-server/version-compare.mjs se comportă identic cu #shared/domain/version-compare.mjs', () => {
  const pairs = [
    ['2.1.0', '2.1.0'],
    ['2.1.0', '2.2.0'],
    ['2.2.0', '2.1.0'],
    ['2.9.0', '2.10.0'],
    ['2.1', '2.2.0'],
    ['abc', '2.2.0'],
  ];
  for (const [a, b] of pairs) assert.equal(syncCompareVersions(a, b), compareVersions(a, b));
});
