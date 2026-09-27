import { clampKindergartenSettings, parseKindergartenSettings } from '#shared/domain/kindergarten-settings.mjs';

/**
 * @param {{ readSetting: (key: string) => string, writeSetting: (key: string, value: string) => void }} dependencies
 */
export function createKindergartenSettingsRoutes({ readSetting, writeSetting }) {
  const readKindergarten = () => parseKindergartenSettings(readSetting('kindergarten'));

  return [
    { method: 'GET', path: '/api/kindergarten', handle: () => readKindergarten() },
    {
      method: 'POST',
      path: '/api/kindergarten',
      /** @param {{ body: unknown }} request */
      handle: ({ body }) => {
        const settings = clampKindergartenSettings(/** @type {any} */ (body));
        writeSetting('kindergarten', JSON.stringify(settings));
        return settings;
      },
    },
  ];
}
