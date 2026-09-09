// Normalizare text comună serverului și browserului (vezi server/http.mjs
// pentru cum ajunge shared/ în ambele). O singură definiție, ca potrivirea
// automată a plăților și căutarea din interfață să găsească aceleași lucruri.
export const stripDiacritics = v =>
  String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
