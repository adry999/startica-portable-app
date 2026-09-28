// Scrierea unei sume în litere, pentru confirmarea de plată (16b). Genul
// substantivului contează în română: „mie” e feminin, „leu”/„ban”/„milion”
// sunt masculine — cifrele 1 și 2 au forme diferite după gen, restul nu.
// Regula pentru prepoziția „de”: sub 20 nu se pune niciodată (1 ia forma de
// articol nehotărât + substantiv la singular: „un leu”, nu „unu leu”); de la
// 20 în sus se pune mereu, iar compusul care se termină în cifra 1 folosește
// forma invariabilă „unu”/„una”, nu articolul „un”/„o” ([ex] „douăzeci și
// unu de lei”, nu „douăzeci și un leu”).

const UNITS_MASC = ['', 'unu', 'doi', 'trei', 'patru', 'cinci', 'șase', 'șapte', 'opt', 'nouă'];
const UNITS_FEM = ['', 'una', 'două', 'trei', 'patru', 'cinci', 'șase', 'șapte', 'opt', 'nouă'];
const TEENS_MASC = [
  'zece',
  'unsprezece',
  'doisprezece',
  'treisprezece',
  'paisprezece',
  'cincisprezece',
  'șaisprezece',
  'șaptesprezece',
  'optsprezece',
  'nouăsprezece',
];
const TEENS_FEM = [...TEENS_MASC];
TEENS_FEM[2] = 'douăsprezece';
const TENS_WORDS = [
  '',
  '',
  'douăzeci',
  'treizeci',
  'patruzeci',
  'cincizeci',
  'șaizeci',
  'șaptezeci',
  'optzeci',
  'nouăzeci',
];

/** @param {number} hundredsDigit cifra sutelor, 0-9 */
function spellHundredsPrefix(hundredsDigit) {
  if (hundredsDigit === 0) return '';
  if (hundredsDigit === 1) return 'o sută';
  return `${UNITS_FEM[hundredsDigit]} sute`;
}

/**
 * Cifrele 1-99, cu forma pe gen doar pentru unitatea finală (10-19 și 1-9);
 * zecile nu au formă de gen.
 * @param {number} n 0-99
 * @param {'m' | 'f'} gender
 */
function spellUnder100(n, gender) {
  const units = gender === 'f' ? UNITS_FEM : UNITS_MASC;
  const teens = gender === 'f' ? TEENS_FEM : TEENS_MASC;
  if (n === 0) return '';
  if (n < 10) return units[n];
  if (n < 20) return teens[n - 10];
  const tensDigit = Math.floor(n / 10);
  const unitsDigit = n % 10;
  return unitsDigit === 0 ? TENS_WORDS[tensDigit] : `${TENS_WORDS[tensDigit]} și ${units[unitsDigit]}`;
}

/** Cifrele 1-999, folosind forma invariabilă/compusă (fără articol) — pentru orice n>1 sau pentru compusul dintr-un „de”. */
function spellChunkCompound(n, gender) {
  const hundredsDigit = Math.floor(n / 100);
  const remainder = n % 100;
  return [spellHundredsPrefix(hundredsDigit), spellUnder100(remainder, gender)].filter(Boolean).join(' ');
}

/**
 * Atașează substantivul la un număr (1-999): articolul „un”/„o” e corect doar
 * când numărul e chiar 1 (izolat) — „un leu”, „o mie”. Orice alt compus care
 * se termină în 1 (101, 21, sau grupul unităților dintr-un total mai mare,
 * ca 1001) foloseşte forma invariabilă „unu”/„una” + pluralul, fără „de” sub
 * 20 (cf. „o sută unu dalmațieni”, nu „o sută un dalmațian”).
 * `pluralGender` diferă de `gender` doar la neutru („milion”): articolul de
 * la singular e masculin („un milion”), dar cifra de la plural se comportă
 * ca la feminin („două milioane”).
 * `standalone` e fals doar pentru grupul unităţilor (leu/ban) când există un
 * grup de mii/milioane înaintea lui — acolo „1” nu mai e numărul întreg, ci
 * doar cifra finală a unui compus, deci nu poate lua articolul de singular.
 * @param {number} n
 * @param {{ singular: string, plural: string, gender: 'm' | 'f', pluralGender?: 'm' | 'f', standalone?: boolean }} noun
 */
function countedNoun(n, { singular, plural, gender, pluralGender = gender, standalone = true }) {
  if (n === 0) return '';
  if (n === 1 && standalone) {
    const article = gender === 'f' ? 'o' : 'un';
    return `${article} ${singular}`;
  }
  const remainder = n % 100;
  const words = spellChunkCompound(n, pluralGender);
  const needsDe = remainder === 0 || remainder >= 20;
  return needsDe ? `${words} de ${plural}` : `${words} ${plural}`;
}

/** @param {number} lei întreg ≥0 */
function spellLei(lei) {
  if (lei === 0) return 'zero lei';
  const millionsGroup = Math.floor(lei / 1_000_000);
  const thousandsGroup = Math.floor((lei % 1_000_000) / 1000);
  const unitsGroup = lei % 1000;
  // Grupul unităţilor nu e „standalone” dacă mii/milioane sunt nenule: 1001 e „o mie unu
  // lei”, nu „o mie un leu” — cifra 1 e doar finalul compusului, nu tot numărul.
  const unitsIsStandalone = millionsGroup === 0 && thousandsGroup === 0;
  const words = [];
  if (millionsGroup > 0)
    words.push(countedNoun(millionsGroup, { singular: 'milion', plural: 'milioane', gender: 'm', pluralGender: 'f' }));
  if (thousandsGroup > 0) words.push(countedNoun(thousandsGroup, { singular: 'mie', plural: 'mii', gender: 'f' }));
  if (unitsGroup > 0)
    words.push(countedNoun(unitsGroup, { singular: 'leu', plural: 'lei', gender: 'm', standalone: unitsIsStandalone }));
  // Multiplu exact de 1000 (sau de un milion): substantivul „lei” cade direct
  // pe ultimul cuvânt spus („mii”/„milioane”), care cere mereu „de”.
  else words.push('de lei');
  return words.join(' ');
}

/** @param {number} bani întreg 0-99 */
function spellBani(bani) {
  return countedNoun(bani, { singular: 'ban', plural: 'bani', gender: 'm' });
}

/**
 * Suma (lei, cu până la 2 zecimale) scrisă în litere, pentru confirmarea de
 * plată — ex. `amountInWordsRo(1200.5)` → „o mie două sute de lei și cincizeci de bani”.
 * @param {number} amount
 * @returns {string}
 */
export function amountInWordsRo(amount) {
  const totalCents = Math.round(Number(amount) * 100);
  const lei = Math.floor(totalCents / 100);
  const bani = totalCents % 100;
  const leiWords = spellLei(lei);
  return bani === 0 ? leiWords : `${leiWords} și ${spellBani(bani)}`;
}
