// Normalizare text comună serverului și browserului. O singură definiție, ca
// potrivirea automată a plăților și căutarea din interfață să găsească aceleași lucruri.
export const stripDiacritics = v =>
  String(v || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

export const normalizeSearchText = value => stripDiacritics(value).toLocaleLowerCase('ro-RO');

// Comparație de plătitor reținut (payerAliases): diacritice/majuscule/spații multiple/punctuație
// finală nu trebuie să conteze — un extras bancar exportat de la o bancă alta sau un import CSV
// cu spații duble n-ar mai trebui să rupă singurul indiciu de potrivire 100% sigur (audit P-1/P-2:
// aceeași normalizare, folosită atât la potrivire cât și la deduplicarea alias-urilor).
export const normalizePayerAlias = value =>
  normalizeSearchText(value)
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?]+$/, '');
