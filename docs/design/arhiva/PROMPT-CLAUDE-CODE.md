Pachetul de design din `docs/design/` a fost înlocuit acum cu versiunea finală (până acum erau în repo versiunile vechi ale `Prezenta.dc.html`, `Formulare.dc.html`, `Dashboard.dc.html`). Citește întâi `docs/design/README.md` și `docs/design/DECIZII.md`, apoi `docs/design/ALINIERE-DESIGN.md`, începând cu secțiunea „Stadiu la sync 29.09 17:13”. Culorile și tipografia le mapezi pe tokeni cu `docs/design/TOKENS.md`; pentru fiecare tipar folosește sau extrage componenta din `docs/design/COMPONENTE.md` și adaug-o în `/design-system`.

Lucrează punctele în ordinea din „Ordinea de lucru”. Regulile rămân: commit per punct, `npm run check` + `cd webapp && npm run typecheck && npm test` verzi, notezi în `COADA-DE-LUCRU.md`, întrebările de business în `INTREBARI.md`, nu te oprești.

1. **Re-verificare vizuală (întâi).** Deschide `Formulare.dc.html#15a`, `Prezenta.dc.html#18a` și `#18b` în browser, la 1440px, lângă aplicație. Notează diferențele pentru A2, A3c, A3e și corectează-le. Artboard-ul are prioritate față de text.
2. **A3c-fix — scoate complet marcarea în masă** din Prezența: `markAllUnmarkedPresent`, `markGroupPresent`, `changesToMarkUnmarkedPresent` (dacă nu mai are alt consumator), butonul din antet, acțiunea de pe grupă, toastul de grup și testele lor. Fiecare copil se marchează manual; cine nu e atins rămâne nemarcat. Undo/istoricul rămân.
3. **A3e-undo** — Anulează / „Modificări azi” / Ctrl+Z și în Prezența · Luna. Intrarea din istoric poartă `date` + `childId`; anularea trece prin aceeași mutație (sync + Istoric).
4. **B1-rest** — pentru cele 7 plăți din `INTREBARI.md` răspunsul e **(a)**: rămân în De rezolvat până se împart manual. Scoate fallback-ul „Altele” și din `cash-summary.mjs` și `accounting-report.mjs`. Criteriu: Cash + Card + Transfer = total pe Dashboard, Achitări, bon și Raport contabil, pentru orice lună fără plăți nerezolvate.
5. **A3b** — Achitare nouă după `Formulare.dc.html#15b` și `Planuri si curs.dc.html#12b` (păstrează „Împarte pe metode” din B1).
6. **B3** — câmp „Serviciu” pe achitare, kind `services`, fila „Servicii” în Backup și setări (`Administrare.dc.html#10d`), coloana Serviciu în Achitări (`Achitari.dc.html#5a`), `obligation()` filtrat pe serviciu. **Întâi** scriptul de diagnostic (doar citire) cu cheltuielile care sunt încasări de bazin, lista în `INTREBARI.md`; migrarea lor la Achitări fără copil doar după confirmare. Migrarea `service: 'gradinita'` pe achitările existente se poate face direct (backup + Istoric).
7. **B2** — „Șterge definitiv” pe selecția din filtrul „Arhivate” (`Formulare.dc.html#15h`), cu „Scrie ȘTERGE”, un lot într-o tranzacție, 409 pe orice id nearhivat.
8. **A6 → A7 → A8 → A9**, cum sunt descrise în fișier. A9 cere plan tehnic în `docs/superpowers/plans/` înainte de cod.

Decizii deja luate (lista completă în `DECIZII.md`, nu le mai întreba):
- Prezența: fără marcare în masă.
- O achitare = un serviciu; Grădiniță și Bazin sunt servicii de sistem; lista se editează din Setări.
- Nu există „Altele” la metode: doar Cash, Card, Transfer.
- Filiala apare doar în dropdown-ul din meniu, nu în eyebrow.
- Dashboard: pastila „Curs BNM” (niciodată BNR) e link spre https://www.bnm.md/ (tab nou); graficul are două coloane pe lună.
- Pontaj: zilele viitoare acceptă doar CO/CM.

Rămân deschise până răspunde utilizatorul (nu schimba codul la ele): numele angajatului în descrierea cheltuielii de salariu, salariul inline pe fișa angajatului, formatul „Antrenor:” cu mai mulți antrenori, SMS vs Telegram în De notificat și în bifa din 15b.

La final: rezumat în `COADA-DE-LUCRU.md` (ce s-a închis, ce a rămas și de ce), apoi push pe `master-v2`.
