import { fail } from '#core/server/errors/domain-error.mjs';
import { requireAmount } from '#shared/domain/record-schema.mjs';

/** @typedef {{ id: string, name: string, priceEur: number, hours?: string, description?: string }} PlanPreset */

const ID_OK = /^[A-Za-z0-9_-]{1,100}$/;
const MAX_PRESETS = 50;
const MAX_NAME_LENGTH = 100;
const MAX_HOURS_LENGTH = 40;
const MAX_DESCRIPTION_LENGTH = 300;

/**
 * Citire tolerantă: o listă stricată în settings (JSON invalid sau altă
 * formă) nu blochează ecranul, doar apare goală — presetările sunt o
 * comoditate de completare, nu sursă de adevăr pentru taxa copilului.
 * @param {string | undefined | null} json
 * @returns {PlanPreset[]}
 */
function readPresets(json) {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Câmp text opțional (orar, descriere): absent sau gol → omis din rezultat,
 * ca presetările vechi (fără aceste câmpuri) să rămână identice la reserializare.
 * @param {unknown} value
 * @param {number} maxLength
 * @param {string} label
 * @returns {string | undefined}
 */
function readOptionalText(value, maxLength, label) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') fail(`${label} trebuie să fie text.`);
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > maxLength) fail(`${label} este prea lung.`);
  return trimmed;
}

/**
 * Validare strictă a listei trimise de operator: orice abatere respinge
 * întreaga listă (400), fără salvare parțială.
 * @param {unknown} input
 * @returns {PlanPreset[]}
 */
function validatePresets(input) {
  if (!Array.isArray(input)) fail('Lista de presetări trebuie să fie un array.');
  if (input.length > MAX_PRESETS) fail(`Cel mult ${MAX_PRESETS} presetări.`);
  const seenIds = new Set();
  return input.map(preset => {
    if (!preset || typeof preset !== 'object') fail('Presetare invalidă.');
    const id = preset.id;
    if (typeof id !== 'string' || !ID_OK.test(id)) fail('ID de presetare invalid.');
    if (seenIds.has(id)) fail(`ID de presetare repetat: ${id}`);
    seenIds.add(id);
    const name = typeof preset.name === 'string' ? preset.name.trim() : '';
    if (!name || name.length > MAX_NAME_LENGTH) fail('Numele presetării este invalid sau prea lung.');
    const priceEur = Number(preset.priceEur);
    // m24: fără plafon și fără rotunjire la ban, un preț uriaș sau cu reziduu binar trecea nefiltrat.
    requireAmount(priceEur, 'Prețul în euro');
    const hours = readOptionalText(preset.hours, MAX_HOURS_LENGTH, 'Orarul');
    const description = readOptionalText(preset.description, MAX_DESCRIPTION_LENGTH, 'Descrierea');
    return {
      id,
      name,
      priceEur,
      ...(hours !== undefined ? { hours } : {}),
      ...(description !== undefined ? { description } : {}),
    };
  });
}

/**
 * @param {{ readSetting: (key: string) => string, writeSetting: (key: string, value: string) => void }} dependencies
 */
export function createPlanPresetsRoutes({ readSetting, writeSetting }) {
  return [
    { method: 'GET', path: '/api/plan-presets', handle: () => readPresets(readSetting('planPresets')) },
    {
      method: 'POST',
      path: '/api/plan-presets',
      /** @param {{ body: unknown }} request */
      handle: ({ body }) => {
        const presets = validatePresets(body);
        writeSetting('planPresets', JSON.stringify(presets));
        return presets;
      },
    },
  ];
}
