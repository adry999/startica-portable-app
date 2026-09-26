/**
 * Fără diacritice: NFD desface ă/â/î/ș/ț (și ş/ţ cu sedilă) în litera de bază
 * plus semnul combinat, pe care îl eliminăm.
 * @param {string} text
 */
export const stripDiacritics = text => text.normalize('NFD').replace(/[̀-ͯ]/g, '');
