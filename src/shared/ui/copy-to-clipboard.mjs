// Eșecul (permisiune refuzată) e afișat în română, nu cu mesajul browserului.
/**
 * @param {string} text
 * @param {string} successMessage
 * @param {(text: string, isError?: boolean) => void} showNotice
 */
export async function copyToClipboard(text, successMessage, showNotice) {
  try {
    await navigator.clipboard.writeText(text);
    showNotice(successMessage);
  } catch {
    showNotice('Copierea în clipboard a eșuat. Selectează și copiază manual.', true);
  }
}
