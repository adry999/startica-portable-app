/** @typedef {import('#shared/contracts/record-types.mjs').Child} Child */
/** @typedef {import('#shared/contracts/record-types.mjs').Payment} Payment */
/** @typedef {import('#shared/contracts/record-types.mjs').RecordsSnapshot} RecordsSnapshot */

export const SEPTEMBER = '2026-09';
export const ASSIGNMENT_DAY = '2026-09-15';

/** @returns {Child} */
function child(id, name) {
  return {
    id,
    name,
    parent: '',
    phone: '',
    groupId: null,
    status: 'Activ',
    statusHistory: [],
    fee: null,
    feeHistory: [],
    dueDay: 10,
  };
}

/** @returns {Payment} */
function unassignedPayment(id, sourceName) {
  return {
    id,
    date: '2026-09-02',
    childId: '',
    sourceName,
    method: 'Cash',
    amount: 1500,
    allocations: [{ month: SEPTEMBER, amount: 1500 }],
    month: SEPTEMBER,
  };
}

// „Mihai” indică un singur copil; „Pop” se potrivește la doi; textul gol nu indică pe nimeni.
/** @returns {RecordsSnapshot} */
export function createAssignmentRecords() {
  return {
    children: [child('CHILD-ANA', 'Ana Pop'), child('CHILD-IOANA', 'Ioana Pop'), child('CHILD-MIHAI', 'Mihai Ionescu')],
    payments: [
      unassignedPayment('PAY-MIHAI', 'Mihai'),
      unassignedPayment('PAY-POP', 'Pop'),
      unassignedPayment('PAY-BLANK', ''),
      { ...unassignedPayment('PAY-ASSIGNED', 'Ana'), childId: 'CHILD-ANA' },
    ],
    expenses: [],
    groups: [],
    categories: [],
    visits: [],
  };
}
