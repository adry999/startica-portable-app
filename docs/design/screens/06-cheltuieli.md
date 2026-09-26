# 06 — Cheltuieli (Tabel / Pe zile)

**Referință:** `Cheltuieli.dc.html#1k` (Tabel) și `#1l` (Pe zile). **Depinde de:** `00-comun.md` A, B, D, E.

## 1. Fișiere
Se modifică: `expenses/ExpensesPage.tsx`, `.module.css`, `.test.tsx`.

## 2. Antet (identic în ambele moduri)
`Cheltuieli  CONTABILITATE` · `[Tabel | Pe zile]` · `[‹ August 2026 ›]` (MonthStepper, doar pentru luna afișată în pagină) · `[+ Cheltuială nouă]`.

## 3. Mod Tabel (1k)
- **Rândul de sus:** card total lună (mint) + card categorii (bară stivuită de 12px + 5 legende cu sume).
- **Card-tabel:** toolbar (căutare „Caută furnizor sau descriere” + „Nearhivate ▾”) → `FilterPills`:
  - `Categorie`: Toate(neutral) · Salarii(orange) · Alimentație(yellow) · Utilități(mint) · Materiale(pink) · Întreținere(neutral)
  - `Metodă`: Toate · Cash · Card · Transfer (toate neutral)
- **Coloane:** Data · Descriere/furnizor · Categorie (Badge) · Metodă · Sumă · ⋯. Grid `1fr 2.4fr 1.3fr 1fr 1.2fr 48px`.

## 4. Mod Pe zile (1l)
- Blocul „Adaugă rapid” (mint): sumă, descriere, dată, metodă, Adaugă + chip-uri de categorie.
- Listă grupată pe zile, pe toată lățimea. **Coloana de buget nu se face** (funcția e amânată).

## 5. Criterii de acceptare
- [ ] Fără dropdown-ul „Categorie ▾” și fără segmented-ul de metodă din toolbar; în locul lor, FilterPills
- [ ] Antetul Pe zile folosește același header compact ca Tabel (nu H2 de 36px)
- [ ] Fără coloana de buget
