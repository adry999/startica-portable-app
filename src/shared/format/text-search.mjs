// Normalizare text comună serverului și browserului. O singură definiție, ca
// potrivirea automată a plăților și căutarea din interfață să găsească aceleași lucruri.
export const stripDiacritics = v =>
  String(v || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

export const normalizeSearchText = value => stripDiacritics(value).toLocaleLowerCase('ro-RO');
