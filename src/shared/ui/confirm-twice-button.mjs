export const CONFIRMATION_WINDOW_MS = 4000;

/** @type {WeakMap<HTMLElement, ReturnType<typeof setTimeout>>} */
const pendingTimers = new WeakMap();

// Fără fereastră de confirmare: primul click cere confirmarea chiar pe buton, al doilea, în 4 secunde, execută.
/**
 * @param {HTMLElement} button
 * @param {string} pendingText
 * @returns {boolean} true când apăsarea confirmă acțiunea
 */
export function confirmOnSecondClick(button, pendingText) {
  if (button.classList.contains('confirm-pending')) {
    cancelPendingConfirmation(button);
    return true;
  }
  button.classList.add('confirm-pending');
  button.dataset.label = button.textContent ?? '';
  button.textContent = pendingText;
  pendingTimers.set(
    button,
    setTimeout(() => {
      pendingTimers.delete(button);
      button.classList.remove('confirm-pending');
      button.textContent = button.dataset.label ?? '';
    }, CONFIRMATION_WINDOW_MS),
  );
  return false;
}

/** @param {HTMLElement} button */
export function cancelPendingConfirmation(button) {
  clearTimeout(pendingTimers.get(button));
  pendingTimers.delete(button);
  button.classList.remove('confirm-pending');
}
