import { cents } from '#shared/domain/money.mjs';
import { paymentTenders, allocations } from '#shared/domain/payment-allocations.mjs';
import { childNameOf, serviceNameOf } from '#shared/domain/record-labels.mjs';
import { stripDiacritics } from '#shared/format/text-search.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').RecordsSnapshot} RecordsSnapshot */
/** @typedef {import('#shared/contracts/record-types.mjs').Payment} Payment */
/** @typedef {import('#shared/contracts/record-types.mjs').Expense} Expense */
/** @typedef {'month' | 'quarter' | 'year'} ReportPeriodKind */
/** @typedef {{ from: string, to: string, label: string }} ReportPeriod */

const QUARTER_LABELS = ['I', 'II', 'III', 'IV'];

// Ultima zi calculată din ziua 0 a lunii următoare, ca să meargă și pentru februarie.
function lastDayOfMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/**
 * Granițele perioadei (interval de zile, inclusiv) pentru un anumit mod de
 * afișare, ancorat pe luna curent selectată în ecran — aceleași granițe le
 * folosește și exportul, ca cele două să rămână mereu în acord.
 * @param {ReportPeriodKind} kind
 * @param {string} anchorMonth YYYY-MM
 * @returns {ReportPeriod}
 */
export function reportPeriodBounds(kind, anchorMonth) {
  const [year, month] = anchorMonth.split('-').map(Number);
  if (kind === 'year') {
    return { from: `${year}-01-01`, to: `${year}-12-31`, label: `Anul ${year}` };
  }
  if (kind === 'quarter') {
    const quarterIndex = Math.floor((month - 1) / 3);
    const firstMonth = quarterIndex * 3 + 1;
    const lastMonth = firstMonth + 2;
    return {
      from: `${year}-${String(firstMonth).padStart(2, '0')}-01`,
      to: `${year}-${String(lastMonth).padStart(2, '0')}-${String(lastDayOfMonth(year, lastMonth)).padStart(2, '0')}`,
      label: `Trimestrul ${QUARTER_LABELS[quarterIndex]} ${year}`,
    };
  }
  const MONTH_NAMES = [
    'Ianuarie',
    'Februarie',
    'Martie',
    'Aprilie',
    'Mai',
    'Iunie',
    'Iulie',
    'August',
    'Septembrie',
    'Octombrie',
    'Noiembrie',
    'Decembrie',
  ];
  return {
    from: `${year}-${String(month).padStart(2, '0')}-01`,
    to: `${year}-${String(month).padStart(2, '0')}-${String(lastDayOfMonth(year, month)).padStart(2, '0')}`,
    label: `${MONTH_NAMES[month - 1]} ${year}`,
  };
}

// Aceleași 5 categorii uzuale ca `webapp/src/features/expenses/useExpenses.ts`
// (`categoryStyleFor`) — duplicat aici (nu importat) fiindcă acel fișier trăiește
// într-un alt feature de webapp, iar granița de importuri interzice feature→feature;
// bucketing-ul e o regulă de business, nu doar culoare, deci intră în domeniu.
const CATEGORY_BUCKETS = [
  { category: 'Salarii', test: name => name.includes('salari') },
  { category: 'Alimentație', test: name => name.includes('aliment') },
  { category: 'Utilități', test: name => name.includes('utilit') },
  { category: 'Materiale', test: name => name.includes('material') },
  { category: 'Întreținere', test: name => name.includes('intretinere') || name.includes('reparatii') },
];
const OTHER_CATEGORY = 'Altele';

function comparable(name) {
  return stripDiacritics(name).toLocaleLowerCase('ro-RO');
}

function categoryBucketOf(categoryName) {
  const key = comparable(categoryName);
  return CATEGORY_BUCKETS.find(bucket => bucket.test(key))?.category ?? OTHER_CATEGORY;
}

function inPeriod(dateKey, period) {
  return dateKey >= period.from && dateKey <= period.to;
}

/**
 * Metodele unei achitări, ca listă de nume distincte, în ordinea în care apar
 * pe achitare — pentru coloana „Metodă” din Excel și pentru gruparea pe metodă.
 * @param {Payment} payment
 */
function paymentMethodNames(payment) {
  return [...new Set(paymentTenders(payment).map(tender => tender.method))];
}

/**
 * @param {Payment} payment
 * @param {RecordsSnapshot} records
 */
function buildPaymentRow(payment, records) {
  return {
    id: payment.id,
    date: payment.date,
    childId: payment.childId,
    childLabel: childNameOf(payment, records.children),
    payerLabel: payment.sourceName || childNameOf(payment, records.children),
    unassigned: !payment.childId,
    methods: paymentMethodNames(payment),
    service: serviceNameOf(payment, records.services ?? []),
    amount: payment.amount,
    fxRate: payment.fxRate ?? null,
    fxRateSource: payment.fxRateSource ?? null,
    amountEur: payment.amountEur ?? null,
    months: allocations(payment).map(allocation => allocation.month),
    archived: Boolean(payment.archived),
  };
}

/** @param {Expense} expense */
function buildExpenseRow(expense) {
  return {
    id: expense.id,
    date: expense.date,
    category: expense.category,
    categoryBucket: categoryBucketOf(expense.category),
    description: expense.description || '',
    method: expense.method ?? null,
    amount: expense.amount,
    archived: Boolean(expense.archived),
  };
}

function sumAmounts(rows) {
  return rows.reduce((sum, row) => sum + cents(row.amount), 0) / 100;
}

/**
 * Repartizarea încasărilor pe metodă (Cash / Card / Transfer — fără „Altele”, B1),
 * calculată din tenders (o achitare poate avea mai multe metode) — aceeași
 * regulă ca `summarizePaymentsByMethod`: o metodă necunoscută (date vechi
 * nerezolvate) nu intră în niciun total, rămâne doar în De rezolvat.
 * @param {Payment[]} payments
 * @param {number} incomeTotal
 */
function buildMethodBreakdown(payments, incomeTotal) {
  const byMethod = {
    Cash: { amount: 0, count: 0 },
    Card: { amount: 0, count: 0 },
    Transfer: { amount: 0, count: 0 },
  };
  for (const payment of payments)
    for (const tender of paymentTenders(payment)) {
      if (!Object.hasOwn(byMethod, tender.method)) continue;
      byMethod[tender.method].amount += cents(tender.amount);
      byMethod[tender.method].count += 1;
    }
  return Object.entries(byMethod)
    .map(([method, bucket]) => ({
      method,
      amount: bucket.amount / 100,
      count: bucket.count,
      percent: incomeTotal > 0 ? (bucket.amount / 100 / incomeTotal) * 100 : 0,
    }))
    .filter(entry => entry.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Repartizarea cheltuielilor pe categorie (cele 5 uzuale + Altele), în ordinea
 * fixă din `CATEGORY_BUCKETS`, cu „Altele” la final — aceeași ordine ca
 * `useExpenses.ts` (`buildCategorySummary`).
 * @param {{ category: string, categoryBucket: string, amount: number }[]} expenseRows
 * @param {number} expenseTotal
 */
function buildCategoryBreakdown(expenseRows, expenseTotal) {
  const orderedBuckets = [...CATEGORY_BUCKETS.map(bucket => bucket.category), OTHER_CATEGORY];
  return orderedBuckets
    .map(category => {
      const rows = expenseRows.filter(row => row.categoryBucket === category);
      const amount = sumAmounts(rows);
      return { category, amount, count: rows.length, percent: expenseTotal > 0 ? (amount / expenseTotal) * 100 : 0 };
    })
    .filter(entry => entry.amount > 0);
}

/**
 * Zilele cu mișcări (încasare sau cheltuială), sortate crescător — tabelul
 * „Pe zile” al ecranului. „Card + transfer” adună cele două metode, ca
 * distincția Cash / restul de metode cu extras bancar să rămână vizibilă.
 * Suma pe zi vine din tenders (nu din `amount` total), ca o achitare
 * Cash+Card să se repartizeze corect pe cele două coloane.
 * @param {{ date: string, tenders: { method: string, amount: number }[] }[]} paymentRowsWithTenders
 * @param {{ date: string, amount: number }[]} expenseRows
 */
function buildDailyBreakdown(paymentRowsWithTenders, expenseRows) {
  const days = new Map();
  const dayOf = date => {
    if (!days.has(date)) days.set(date, { date, cash: 0, cardTransfer: 0, expense: 0 });
    return days.get(date);
  };
  for (const row of paymentRowsWithTenders) {
    const day = dayOf(row.date);
    for (const tender of row.tenders) {
      if (tender.method === 'Cash') day.cash += cents(tender.amount);
      else day.cardTransfer += cents(tender.amount);
    }
  }
  for (const row of expenseRows) dayOf(row.date).expense += cents(row.amount);
  return [...days.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(day => ({
      date: day.date,
      cash: day.cash / 100,
      cardTransfer: day.cardTransfer / 100,
      expense: day.expense / 100,
      balance: (day.cash + day.cardTransfer - day.expense) / 100,
    }));
}

/**
 * Toate agregările ecranului „Raport contabil” (19a) și ale exportului (19b),
 * calculate o singură dată din același `paymentRows`/`expenseRows` — ca
 * totalurile de pe ecran să fie mereu suma rândurilor din Excel (vezi testul
 * dedicat). Achitările arhivate nu intră; cele neasociate (fără copil) intră.
 * @param {RecordsSnapshot} records
 * @param {ReportPeriod} period
 * @param {{ includeArchived?: boolean }} [options] `includeArchived` e doar pentru
 * export (19b, bifa „Include achitările arhivate”, implicit oprită) — ecranul (19a)
 * nu o folosește niciodată, ca totalurile lui să rămână mereu suma rândurilor din
 * exportul implicit (vezi testul dedicat).
 */
export function buildAccountingReport(records, period, options = {}) {
  const includeArchived = options.includeArchived ?? false;
  const paymentsInPeriod = records.payments.filter(
    payment => (includeArchived || !payment.archived) && inPeriod(payment.date, period),
  );
  const expensesInPeriod = records.expenses.filter(
    expense => (includeArchived || !expense.archived) && inPeriod(expense.date, period),
  );

  const paymentRows = paymentsInPeriod.map(payment => buildPaymentRow(payment, records));
  const expenseRows = expensesInPeriod.map(buildExpenseRow);
  const paymentRowsWithTenders = paymentsInPeriod.map((payment, index) => ({
    ...paymentRows[index],
    tenders: paymentTenders(payment),
  }));

  const income = sumAmounts(paymentRows);
  const expense = sumAmounts(expenseRows);
  const eurRows = paymentRows.filter(row => row.fxRate != null).sort((a, b) => a.date.localeCompare(b.date));

  return {
    period,
    income,
    incomeCount: paymentRows.length,
    expense,
    expenseCount: expenseRows.length,
    balance: income - expense,
    unassignedCount: paymentRows.filter(row => row.unassigned).length,
    byMethod: buildMethodBreakdown(paymentsInPeriod, income),
    byCategory: buildCategoryBreakdown(expenseRows, expense),
    eurRows,
    eurTotalLei: sumAmounts(eurRows),
    eurTotalEur: eurRows.reduce((sum, row) => sum + cents(row.amountEur ?? 0), 0) / 100,
    days: buildDailyBreakdown(paymentRowsWithTenders, expenseRows),
    paymentRows,
    expenseRows,
  };
}
