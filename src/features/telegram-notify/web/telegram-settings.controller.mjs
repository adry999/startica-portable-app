import { renderTelegramStatus } from './telegram-settings.view.mjs';

/**
 * @typedef {{
 *   elements: {
 *     status: HTMLElement,
 *     form: HTMLFormElement,
 *     tokenInput: HTMLInputElement,
 *     testButton: HTMLButtonElement,
 *     disconnectButton: HTMLButtonElement,
 *   },
 *   requestJson: (path: string, body?: unknown) => Promise<any>,
 *   showNotice: (text: string, isError?: boolean) => void,
 * }} TelegramSettingsControllerDependencies
 */

/** @param {TelegramSettingsControllerDependencies} dependencies */
export function createTelegramSettingsController({
  elements: { status, form, tokenInput, testButton, disconnectButton },
  requestJson,
  showNotice,
}) {
  /** @param {import('../telegram-notify.types.mjs').TelegramStatus} current */
  function renderStatus(current) {
    status.innerHTML = renderTelegramStatus(current);
    testButton.hidden = !current.configured;
    disconnectButton.hidden = !current.configured;
    // Botul conectat e deja numit în starea de mai sus; formularul de token nu are
    // ce căuta gol lângă el — reconectarea la alt bot trece prin Deconectează.
    form.hidden = current.configured;
  }

  async function refreshStatus() {
    renderStatus(await requestJson('/api/telegram-status'));
  }

  form.onsubmit = async event => {
    event.preventDefault();
    const submitButton = /** @type {HTMLButtonElement} */ (form.querySelector('button'));
    submitButton.disabled = true;
    try {
      await requestJson('/api/telegram-connect', { token: tokenInput.value });
      tokenInput.value = '';
      showNotice('Bot conectat. Ai primit un mesaj de probă în Telegram.');
      await refreshStatus();
    } catch (error) {
      showNotice(/** @type {Error} */ (error).message, true);
    } finally {
      submitButton.disabled = false;
    }
  };

  testButton.onclick = async () => {
    testButton.disabled = true;
    try {
      await requestJson('/api/telegram-test', {});
      showNotice('Mesaj de probă trimis.');
      await refreshStatus();
    } catch (error) {
      showNotice(/** @type {Error} */ (error).message, true);
    } finally {
      testButton.disabled = false;
    }
  };

  disconnectButton.onclick = async () => {
    disconnectButton.disabled = true;
    try {
      await requestJson('/api/telegram-disconnect', {});
      showNotice('Telegram deconectat.');
      await refreshStatus();
    } catch (error) {
      showNotice(/** @type {Error} */ (error).message, true);
    } finally {
      disconnectButton.disabled = false;
    }
  };

  return {
    activate: () => void refreshStatus().catch(error => showNotice(/** @type {Error} */ (error).message, true)),
  };
}
