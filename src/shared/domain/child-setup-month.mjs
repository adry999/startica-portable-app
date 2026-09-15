// Luna din care se aplică taxa și statutul, implicit. Începerea frecventării
// este cea corectă: din ea se calculează și lunile trecute. Contractul și
// luna curentă sunt rezerve pentru fișele incomplete. Folosit de fee-setup
// (completare în masă) și de editorul copilului (adăugare fără istoric).
/**
 * @param {{ attendanceDate?: string, contractDate?: string }} child
 * @param {string} today
 */
export const defaultSetupMonth = (child, today) => (child.attendanceDate || child.contractDate || today).slice(0, 7);
