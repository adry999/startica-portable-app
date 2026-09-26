# 15 — Tipărire (confirmare de plată A5 · situația A4)

**Referință:** `Tiparire.dc.html#16b`, `#16c`. **Depinde de:** datele `kindergarten` din spec 12 (16a).

## 16b — Confirmare de plată (A5 portret)
- **Rută:** `/achitari/:id/confirmare` → `payments/PaymentReceipt.tsx`. Se declară **înainte** de `/achitari/:paymentId`.
- **Intrări:** Achitări ⋯ → „Tipărește confirmarea”; panoul din 5b; istoricul plăților din fișa copilului.
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

## 16d–16g — Confirmare de plată pe A4 orizontal, în două părți
- **Setare:** `kindergarten.receiptFormat` = 'a5' | 'a4-half' (16d) | 'a4-third' (16e/16f/16g). **Decis 27.09.2026: partea părintelui se face după 16g.** 16d–16f rămân ca referință de format.
- `@page { size: A4 landscape; margin: 0 }`. Coloane: 1/2 + 1/2 sau 374 px + restul. Între ele, linie punctată cu „Tăiați aici”.
- **Exemplarul grădiniței (stânga):** fără culoare. Eticheta „Exemplar grădiniță”, Nr., data și ora, copil, grupa, plătitor, metodă, repartizarea pe luni, total, două semnături. Bonul fiscal sau chitanța bancară se prinde în colțul din stânga sus, deci colțul rămâne liber.
- **Ștampila:** cerc punctat de 128 px cu „L.Ș.”, centrat pe linia de tăiere, la ~70 px de jos, ca ștampila să cadă pe ambele părți. În partea părintelui, primii ~80 px de jos lângă linie rămân liberi (fără text).
- **Exemplarul părintelui (16g):** antet galben cu cercuri decorative, „Mulțumim pentru plată!”, copilul cu avatar și eticheta grupei în `groupTone`, suma mare, **banda cu cele 12 luni ale anului** (✓ achitat, Parțial, — viitor), tabelul Luna · Din această plată · Rămas, IBAN-ul pentru transfer, semnătura, subsolul cu contactele și „Nu ține locul bonului fiscal”.
- Ambele părți au același număr.

## 16c — Situația plăților tipărită (A4 orizontal)
- „Tipărește” din Situația (7a) deschide un dialog mic: Ce tipăresc? (filtrul curent / toți copiii) · Coloane (cu/fără telefon) · Orientare.
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
