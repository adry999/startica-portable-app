# 20 — Raport pentru contabil

> **Actualizat 29.09.2026:** Rândurile de încasări primesc coloana Serviciu (B3). Unde textul de mai jos contrazice `DECIZII.md` sau `ALINIERE-DESIGN.md`, acelea au prioritate.

**Referință:** `Raport contabil.dc.html#19a`, `#19b`. **Nou.** Doar citire; nu creează date.

## Meniu
- `nav-items.ts`: `{ view: 'report', label: 'Raport contabil' }` ultimul în Contabilitate. Ruta `/raport`.

## 19a — Pe ecran
- Antet: comutator Lună | Trimestru | An, `MonthStepper`, buton principal „Exportă pentru contabil” (deschide 19b).
- 3 carduri: Încasări (mint), Cheltuieli (pink), Sold (contur închis, cu semn + / −).
- Două panouri: **Încasări pe metode** (Cash / Transfer / Card, bară de proporție) și **Cheltuieli pe categorii** (cele 5 din `categoryStyleFor`, cu culoarea categoriei).
- **Pentru taxe în EUR**, sub încasări: lista achitărilor copiilor cu taxă în EUR, cu coloanele Data · Copil · Lei · Curs · EUR. Lei și EUR vin din achitare (`amount`, `amountEur`), cursul din `Payment.fxRate`, salvat la achitare (vezi RASPUNSURI.md, Monedă). **Nu se recalculează** cu cursul de azi. Un curs corectat manual (`fxRateSource: 'manual'`) apare în `--orange-ink`. Textul de sub listă trimite la Backup și setări → Planuri și curs (12a) și la achitare (12b).
- Tabel „Pe zile”: doar zilele cu mișcări; Cash · Card + transfer · Cheltuieli · Sold zi; rândul Total lună.
- Achitările arhivate nu intră. Cele neasociate intră (sunt bani încasați).

## 19b — Export
- Panou lateral (`Drawer`). Perioada (lună / trimestru / an / interval), Filiala (Ambele pe foi separate / una), Format (Excel / PDF).
- Bife: numele plătitorilor · sumele EUR cu cursul și echivalentul în lei · achitările arhivate (implicit oprit).
- Avertizare yellow dacă există achitări neasociate în perioadă, cu link la De rezolvat.
- **Excel** (`xlsx` deja folosit la import): foile Rezumat, Încasări (Data, Copil, Plătitor, Metodă, Lei, Curs, EUR, Luni acoperite), Cheltuieli (Data, Categorie, Descriere, Metodă, Lei). Numele fișierului: `startica-raport-AAAA-LL.xlsx`.
- **PDF**: rezumatul pe o pagină A4, cu antetul grădiniței (16a), prin `@media print`.

## Criterii de acceptare
- [ ] Totalurile din 19a = suma rândurilor din Excel
- [ ] Suma în lei a unei achitări EUR e cea salvată, chiar dacă între timp s-a schimbat cursul zilei
- [ ] Filtrul de filială funcționează și pe „Ambele” (o foaie pe filială + Rezumat comun)
