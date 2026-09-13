// vendor/xlsx.full.min.js are ~950 KB; se încarcă abia la primul import/export
// Excel, nu pe calea de pornire a aplicației.
let xlsxLoading;

// SheetJS se atașează pe window ca variabilă globală, nu ca export de modul.
const globalScope = /** @type {any} */ (window);

/** @returns {Promise<any>} */
export function loadXLSX() {
  if (globalScope.XLSX) return Promise.resolve(globalScope.XLSX);
  // O eroare de rețea nu trebuie să rămână cache-uită: o cerere reluată
  // trebuie să reîncerce, nu să eșueze mereu cu promisiunea veche.
  xlsxLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/vendor/xlsx.full.min.js';
    script.onload = () => resolve(globalScope.XLSX);
    script.onerror = () => reject(Error('Nu s-a putut încărca modulul Excel.'));
    document.head.append(script);
  }).catch(error => {
    xlsxLoading = undefined;
    throw error;
  });
  return xlsxLoading;
}
