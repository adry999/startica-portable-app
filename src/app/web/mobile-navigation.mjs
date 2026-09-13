/** @returns {HTMLElement} */
function sidebarElement() {
  return /** @type {HTMLElement} */ (document.querySelector('.sidebar'));
}

/**
 * @param {{ byId: (id: string) => HTMLElement }} dependencies
 */
export function bindMobileNavigation({ byId }) {
  // Pe ecrane înguste navigația devine un panou explicit; pe desktop CSS o
  // afișează permanent, așa că nu folosim niciodată `hidden` pentru aceasta.
  const mobileNavQuery = window.matchMedia('(max-width: 720px)');

  /** @param {boolean} open */
  function setMobileNav(open) {
    const isOpen = mobileNavQuery.matches && open;
    sidebarElement().classList.toggle('is-nav-open', isOpen);
    byId('navToggle').setAttribute('aria-expanded', String(isOpen));
  }
  function resetMobileNav() {
    setMobileNav(false);
  }

  byId('navToggle').onclick = () => {
    setMobileNav(!sidebarElement().classList.contains('is-nav-open'));
  };
  if (mobileNavQuery.addEventListener) mobileNavQuery.addEventListener('change', resetMobileNav);
  else mobileNavQuery.addListener(resetMobileNav);
  resetMobileNav();

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (sidebarElement().classList.contains('is-nav-open')) {
      setMobileNav(false);
      byId('navToggle').focus();
    }
  });

  return { setMobileNav };
}
