// Fără dispariție automată, un mesaj rămânea agățat sus la nesfârșit, chiar
// și pe un ecran fără nicio legătură cu acțiunea care l-a produs.
export const AUTO_HIDE_MS = 5000;

/** @param {HTMLElement} element */
export function createNoticeBanner(element) {
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let pendingHide;

  function hide() {
    clearTimeout(pendingHide);
    pendingHide = undefined;
    element.className = '';
    element.textContent = '';
  }

  /**
   * @param {string} text
   * @param {boolean} [isError]
   */
  function show(text, isError = false) {
    clearTimeout(pendingHide);
    element.className = 'notice' + (isError ? ' error' : '');
    element.textContent = text;
    pendingHide = setTimeout(hide, AUTO_HIDE_MS);
  }

  return { show, hide };
}
