# 13 — Formulare și stări (3a–3f)

**Referință:** `Formulare.dc.html#3a`–`#3f`. **Depinde de:** `Drawer`, `Toast` din `@shared/ui`.

## Panou lateral (Drawer) — comun pentru 3a și 3b
- Fix în dreapta, lățime 620px (copil) / 560px (achitare), fundal alb, `box-shadow:var(--shadow-panel)`, overlay `rgba(58,71,80,.35)`, slide-in 200ms.
- **Header:** titlu Baloo 26 + × rotund de 36px (`--neutral-soft`). Corpul se derulează; footerul e fix, cu acțiunile.
- Esc și click pe overlay închid panoul. Dacă există modificări, cere confirmare.

## 3a — Copil nou (`children/ChildFormDrawer.tsx`)
Secțiuni numerotate cu titluri 12px/800 uppercase `--orange-ink`:
1. **Copil:** Nume, Prenume, Data nașterii; sub câmp: vârsta calculată + grupele compatibile.
2. **Părinți:** nume, telefon, relație ▾; „+ Adaugă încă un părinte”.
3. **Contract și taxă:** nr., început, scadență + 3 carduri de program selectabile (selectat: `--orange-soft`, border 2px `--orange`).
4. **Grupă (opțional):** chip-uri cu locurile libere.

Footer: hint · Anulează · „Salvează copilul”.

## 3b — Achitare nouă (`payments/PaymentFormDrawer.tsx`)
- **Copil:** card selectat cu taxa și luna neachitată + „Schimbă”.
- **Sumă:** Baloo 40, cu scurtăturile „1 lună / 2 luni / 3 luni” calculate din taxă.
- **Data** + **Metodă** (SegmentedControl).
- „Se repartizează automat” (lista lunilor cu statut) + „Repartizează manual”.
- Footer: „Salvează · suma”. **Fără** checkbox-ul de confirmare către părinte.

## 3c — Cheltuială nouă (dialog de 520px)
Sumă mare, chip-uri de categorie (selectat: border 2px în culoarea categoriei), descriere, dată, metodă. Butoane: „Salvează și adaugă alta” + „Salvează”. **Fără** „+ Atașează bon”.

## 3d — Confirmări
- **Arhivare:** fără dialog. Toast slate, radius 16: „N … arhivate · **Anulează**” (`--yellow`), 6s.
- **Ștergere definitivă:** `ConfirmDeleteDialog` (icon „!” `--pink-soft`/`--pink-ink`, titlu Baloo 24, explicație, câmpul „Scrie ȘTERGE”, buton `--raspberry` activ doar când textul e corect).

## 3e — Liste goale
Trei variante:
- **Fără rezultate:** filtrele active listate + „Șterge filtrele”.
- **Coadă rezolvată:** mint, „Totul e rezolvat”.
- **Primul pas:** dashed + CTA primar.

## 3f — Cardul de salvare din sidebar
| Stare | Aspect |
|---|---|
| Normal | punct `--success-dot` |
| Se salvează | punct `--yellow` |
| Nesalvat | fundal `--yellow-soft`, border `--yellow`, CTA „Salvează acum” |
| Eroare | fundal `--pink-soft`, border `--pink`, text `--pink-ink`, CTA „Încearcă din nou” |

Starea vine din `data-state` existent în `SaveStatusCard`.
