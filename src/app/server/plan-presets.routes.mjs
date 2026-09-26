import { fail } from '#core/server/errors/domain-error.mjs';

/** @typedef {{ id: string, name: string, priceEur: number }} PlanPreset */

const ID_OK = /^[A-Za-z0-9_-]{1,100}$/;
const MAX_PRESETS = 50;
const MAX_NAME_LENGTH = 100;

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
    if (!Number.isFinite(priceEur) || priceEur <= 0) fail('Prețul în euro trebuie să fie un număr pozitiv.');
    return { id, name, priceEur };
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
