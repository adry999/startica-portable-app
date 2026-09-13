/** @param {HTMLElement} element */
export function createNoticeBanner(element) {
  /**
   * @param {string} text
   * @param {boolean} [isError]
   */
  function show(text, isError = false) {
    element.className = 'notice' + (isError ? ' error' : '');
    element.textContent = text;
  }
  return { show };
}
