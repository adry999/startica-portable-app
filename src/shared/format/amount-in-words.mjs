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
 * Atașează substantivul la un număr (1-999): decide articolul „un”/„o” pentru
 * cazul special „…01” (rest 1, inclusiv 1 însuși), altfel decide „de” + plural.
 * `pluralGender` diferă de `gender` doar la neutru („milion”): articolul de
 * la singular e masculin („un milion”), dar cifra de la plural se comportă
 * ca la feminin („două milioane”).
 * @param {number} n
 * @param {{ singular: string, plural: string, gender: 'm' | 'f', pluralGender?: 'm' | 'f' }} noun
 */
function countedNoun(n, { singular, plural, gender, pluralGender = gender }) {
  if (n === 0) return '';
  const remainder = n % 100;
  if (remainder === 1) {
    const prefix = spellHundredsPrefix(Math.floor(n / 100));
    const article = gender === 'f' ? 'o' : 'un';
    return [prefix, `${article} ${singular}`].filter(Boolean).join(' ');
  }
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
  const words = [];
  if (millionsGroup > 0)
    words.push(countedNoun(millionsGroup, { singular: 'milion', plural: 'milioane', gender: 'm', pluralGender: 'f' }));
  if (thousandsGroup > 0) words.push(countedNoun(thousandsGroup, { singular: 'mie', plural: 'mii', gender: 'f' }));
  if (unitsGroup > 0) words.push(countedNoun(unitsGroup, { singular: 'leu', plural: 'lei', gender: 'm' }));
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
