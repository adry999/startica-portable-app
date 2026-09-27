// Modulul SheetJS (~950KB) nu trebuie să încarce la pornirea aplicației — orice
// ecran care are nevoie de el (import/export din Backup, Raport contabil,
// Prezența) îl cere o singură dată, cu acest loader partajat, ca promisiunea
// să fie memoizată la nivel de modul, nu reluată per feature.
let xlsxModule: Promise<typeof import('xlsx')> | null = null;

export function loadXlsx(): Promise<typeof import('xlsx')> {
  if (!xlsxModule) xlsxModule = import('xlsx').catch(error => ((xlsxModule = null), Promise.reject(error)));
  return xlsxModule;
}
