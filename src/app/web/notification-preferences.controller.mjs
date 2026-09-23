/** @typedef {import('#shared/domain/notification-preferences.mjs').NotificationPreferences} NotificationPreferences */

/**
 * @typedef {{
 *   form: HTMLFormElement,
 *   birthdaysEnabled: HTMLInputElement,
 *   birthdaysDaysBefore: HTMLInputElement,
 *   visitsEnabled: HTMLInputElement,
 *   visitsHorizonDays: HTMLInputElement,
 *   overdueEnabled: HTMLInputElement,
 *   overdueCadence: HTMLSelectElement,
 *   nothingToReportEnabled: HTMLInputElement,
 *   digestTime: HTMLInputElement,
 *   windowsVisitsTodayEnabled: HTMLInputElement,
 *   windowsVisitSoonEnabled: HTMLInputElement,
 *   windowsVisitSoonMinutes: HTMLInputElement,
 *   saveBar: HTMLElement,
 * }} NotificationPreferencesFields
 */

/**
 * @param {NotificationPreferences} preferences
 * @param {NotificationPreferencesFields} fields
 */
function fillForm(preferences, fields) {
  fields.birthdaysEnabled.checked = preferences.birthdaysEnabled;
  fields.birthdaysDaysBefore.value = String(preferences.birthdaysDaysBefore);
  fields.visitsEnabled.checked = preferences.visitsEnabled;
  fields.visitsHorizonDays.value = String(preferences.visitsHorizonDays);
  fields.overdueEnabled.checked = preferences.overdueEnabled;
  fields.overdueCadence.value = preferences.overdueCadence;
  fields.nothingToReportEnabled.checked = preferences.nothingToReportEnabled;
  fields.digestTime.value = preferences.digestTime;
  fields.windowsVisitsTodayEnabled.checked = preferences.windowsVisitsTodayEnabled;
  fields.windowsVisitSoonEnabled.checked = preferences.windowsVisitSoonEnabled;
  fields.windowsVisitSoonMinutes.value = String(preferences.windowsVisitSoonMinutes);
}

/**
 * @param {NotificationPreferencesFields} fields
 * @returns {Partial<NotificationPreferences>}
 */
function readForm(fields) {
  return {
    birthdaysEnabled: fields.birthdaysEnabled.checked,
    birthdaysDaysBefore: Number(fields.birthdaysDaysBefore.value),
    visitsEnabled: fields.visitsEnabled.checked,
    visitsHorizonDays: Number(fields.visitsHorizonDays.value),
    overdueEnabled: fields.overdueEnabled.checked,
    overdueCadence: /** @type {import('#shared/domain/notification-preferences.mjs').OverdueCadence} */ (
      fields.overdueCadence.value
    ),
    nothingToReportEnabled: fields.nothingToReportEnabled.checked,
    digestTime: fields.digestTime.value,
    windowsVisitsTodayEnabled: fields.windowsVisitsTodayEnabled.checked,
    windowsVisitSoonEnabled: fields.windowsVisitSoonEnabled.checked,
    windowsVisitSoonMinutes: Number(fields.windowsVisitSoonMinutes.value),
  };
}

/**
 * Formularul „Notificări”: încarcă preferințele o dată la activarea ecranului
 * (prin `store`, care rămâne la zi și pentru memento-urile Windows ale vizitelor)
 * și le salvează integral la fiecare trimitere — nu există salvare parțială pe câmp.
 * @param {{
 *   elements: NotificationPreferencesFields,
 *   store: { load(): Promise<NotificationPreferences>, save(patch: Partial<NotificationPreferences>): Promise<NotificationPreferences> },
 *   showNotice: (text: string, isError?: boolean) => void,
 * }} dependencies
 */
export function createNotificationPreferencesController({ elements, store, showNotice }) {
  /** @type {NotificationPreferences | null} */
  let loaded = null;

  // Comparat cu ultima stare cunoscută ca sigură (încărcată sau salvată), nu doar „s-a atins ceva”:
  // revenirea manuală la valorile inițiale trebuie să ascundă bara la loc, nu s-o lase agățată.
  function isDirty() {
    return loaded !== null && JSON.stringify(readForm(elements)) !== JSON.stringify(loaded);
  }

  async function refresh() {
    loaded = await store.load();
    fillForm(loaded, elements);
    elements.saveBar.hidden = true;
  }

  elements.form.addEventListener('input', () => {
    elements.saveBar.hidden = !isDirty();
  });

  elements.form.onsubmit = async event => {
    event.preventDefault();
    const submitButton = /** @type {HTMLButtonElement} */ (elements.form.querySelector('button'));
    submitButton.disabled = true;
    try {
      loaded = await store.save(readForm(elements));
      fillForm(loaded, elements);
      elements.saveBar.hidden = true;
      showNotice('Preferințele de notificare au fost salvate.');
    } catch (error) {
      showNotice(/** @type {Error} */ (error).message, true);
    } finally {
      submitButton.disabled = false;
    }
  };

  return {
    activate: () => void refresh().catch(error => showNotice(/** @type {Error} */ (error).message, true)),
  };
}
