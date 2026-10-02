/** Cheia din localStorage pentru „revine a doua zi” (§11, 42b). Valoarea stocată e
 * `<data ISO>|<versiune>` — ziua în care s-a închis bara + versiunea respinsă atunci. */
export const UPDATE_DISMISS_KEY = 'appBanner.update.dismissedUntil';

/**
 * Bara mint „Actualizare gata” (42b) se închide cu × și revine a doua zi — dar revine și mai
 * devreme dacă apare o versiune și mai nouă decât cea respinsă (nu are rost să rămână ascunsă
 * pentru o versiune diferită de cea pe care utilizatorul chiar a respins-o).
 * @param dismissed valoarea stocată (`''` dacă bara n-a fost niciodată închisă)
 * @param latestVersion versiunea curentă disponibilă (`session.state.update.latestVersion`)
 * @param today data de azi, format `YYYY-MM-DD` (izolat ca parametru, ca funcția să rămână pură/testabilă)
 */
export function shouldShowUpdateBanner(dismissed: string, latestVersion: string, today: string): boolean {
  if (!dismissed) return true;
  const separatorIndex = dismissed.indexOf('|');
  if (separatorIndex === -1) return true;
  const dismissedDate = dismissed.slice(0, separatorIndex);
  const dismissedVersion = dismissed.slice(separatorIndex + 1);
  if (dismissedVersion !== latestVersion) return true;
  return dismissedDate !== today;
}

/** Valoarea de scris în localStorage la clic pe ×. */
export function dismissUpdateValue(latestVersion: string, today: string): string {
  return `${today}|${latestVersion}`;
}
