/** @typedef {{ activate: () => void, deactivate?: () => void }} NavigableScreen */

/** @param {{ byId: (id: string) => HTMLElement | null }} dependencies */
export function createNavigation({ byId }) {
  /** @type {Map<string, NavigableScreen>} */
  const screens = new Map();

  /**
   * @param {string} viewId
   * @param {NavigableScreen} screen
   */
  function registerScreen(viewId, screen) {
    screens.set(viewId, screen);
  }

  /** @param {string} viewId */
  function go(viewId) {
    document.querySelectorAll('.view').forEach(view => view.classList.toggle('active', view.id === viewId));
    /** @type {HTMLElement | undefined} */
    let currentNav;
    document.querySelectorAll('.nav').forEach(element => {
      const nav = /** @type {HTMLElement} */ (element);
      const current = nav.dataset.view === viewId;
      nav.classList.toggle('active', current);
      if (current) nav.setAttribute('aria-current', 'page');
      else nav.removeAttribute('aria-current');
      if (current) currentNav = nav;
    });
    if (currentNav) {
      const label = Array.from(currentNav.childNodes)
        .filter(node => node.nodeType === Node.TEXT_NODE)
        .map(node => (node.textContent ?? '').trim())
        .filter(Boolean)
        .join(' ');
      /** @type {HTMLElement} */ (byId('currentViewLabel')).textContent = label;
    }
    // În varianta compactă, alegerea unei secțiuni închide lista; pe desktop navigația rămâne afișată prin CSS.
    document.querySelector('.sidebar')?.classList.remove('is-nav-open');
    byId('navToggle')?.setAttribute('aria-expanded', 'false');
    for (const [screenViewId, screen] of screens)
      if (screenViewId === viewId) screen.activate();
      else screen.deactivate?.();
    window.scrollTo(0, 0);
  }

  return { go, registerScreen };
}
