# 15 — Tipărire (confirmare de plată A5 · situația A4)

**Referință:** `Tiparire.dc.html#6b`, `#6c`. **Depinde de:** datele `kindergarten` din spec 12 (6a).

## 6b — Confirmare de plată (A5 portret)
- **Rută:** `/achitari/:id/confirmare` → `payments/PaymentReceipt.tsx`. Se declară **înainte** de `/achitari/:paymentId`.
- **Intrări:** Achitări ⋯ → „Tipărește chitanța”; panoul din 1j; istoricul plăților din fișa copilului.
- **Print:** `@page { size: A5 portrait; margin: 12mm }`; butonul „Tipărește” apelează `window.print()`; shell-ul e ascuns în `@media print`.
- **Structură, de sus în jos:**
  1. Antet: logo 34px + datele grădiniței aliniate dreapta; linie 2px `--orange`.
  2. „Confirmare de plată” + Nr. (Baloo 28) + dată.
  3. Copil + contract, plătitor, metodă.
  4. Tabelul „Se repartizează pe” (lunile din alocare) + Total achitat (Baloo 22).
  5. Suma în litere (funcție nouă `amountInWordsRo(n)`, cu test).
  6. Caseta yellow cu restul și scadența, **doar dacă** există rest.
  7. Două linii de semnătură (Administrator / Plătitor).
  8. Subsolul: „Document intern de confirmare a plății. Nu ține locul bonului fiscal. · Generat din Startica v2.0.0”.
- **Numerotare:** `kindergarten.nextReceiptNumber` crește la prima tipărire și nu se reutilizează. Numărul se salvează pe achitare.

## 6c — Situația plăților tipărită (A4 orizontal)
- „Tipărește” din Situația (1m) deschide un dialog mic: Ce tipăresc? (filtrul curent / toți copiii) · Coloane (cu/fără telefon) · Orientare.
- **Componentă:** `status/StatusPrint.tsx` + `@media print` în `StatusPage.module.css`.
- **Structură:**
  1. Antet: logo, „Situația plăților · Luna”, data + filtrul aplicat; în dreapta, denumirea + IDNO.
  2. Banda de 4 totaluri.
  3. Tabel 11px: Nr. · Copil · Părinte · Telefon · Scad. · Taxă · Achitat · Rest · Statut; linie de total.
- **Alb-negru lizibil:** statutul e scris, nu doar colorat; rândurile neachitate au fundal `#f6f4f0`; `thead { display: table-header-group }`; subsol „Pagina N din M · tipărit la …”.

## Criterii de acceptare
- [ ] Ruta confirmării nu intră în conflict cu `/achitari/:paymentId`
- [ ] Mențiunea „Nu ține locul bonului fiscal” e prezentă
- [ ] Situația tipărită se citește corect în alb-negru
