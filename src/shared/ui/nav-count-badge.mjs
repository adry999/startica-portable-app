import { byId } from './element-lookup.mjs';

// Contorul unui buton din nav („De rezolvat”): la 0, butonul se estompează
// (rămâne clicabil) — coada e goală, nu dezactivată.
export const setNavCount = (id, count) => {
  const badge = /** @type {HTMLElement} */ (byId(id));
  badge.textContent = count;
  badge.closest('.nav')?.classList.toggle('is-empty', count === 0);
};
