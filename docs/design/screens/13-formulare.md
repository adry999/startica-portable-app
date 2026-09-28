# 13 — Formulare și stări (15a–15f)

**Referință:** `Formulare.dc.html#15a`–`#15f`. **Depinde de:** `Drawer`, `Toast` din `@shared/ui`.

## Panou lateral (Drawer) — comun pentru 15a și 15b
- Fix în dreapta, lățime 620px (copil) / 560px (achitare), fundal alb, `box-shadow:var(--shadow-panel)`, overlay `rgba(58,71,80,.35)`, slide-in 200ms.
- **Header:** titlu Baloo 26 + × rotund de 36px (`--neutral-soft`). Corpul se derulează; footerul e fix, cu acțiunile.
- Esc și click pe overlay închid panoul. Dacă există modificări, cere confirmare.

## 15a — Copil nou (`children/ChildFormDrawer.tsx`)
Secțiuni numerotate cu titluri 12px/800 uppercase `--orange-ink`:
1. **Copil:** Nume, Prenume, Data nașterii; sub câmp: vârsta calculată + grupele compatibile.
2. **Părinți:** nume, telefon, relație ▾; „+ Adaugă încă un părinte”.
3. **Contract și taxă:** nr., început, scadență + 3 carduri de program selectabile (selectat: `--orange-soft`, border 2px `--orange`).
4. **Grupă (opțional):** chip-uri cu locurile libere.

Footer: hint · Anulează · „Salvează copilul”.

## 15b — Achitare nouă (`payments/PaymentFormDrawer.tsx`)
- **Copil:** card selectat cu taxa și luna neachitată + „Schimbă”.
- **Sumă:** Baloo 40, cu scurtăturile „1 lună / 2 luni / 3 luni” calculate din taxă.
- **Data** + **Metodă** (SegmentedControl).
- „Se repartizează automat” (lista lunilor cu statut) + „Repartizează manual”.
- Footer: „Salvează · suma”. **Fără** checkbox-ul de confirmare către părinte.

## 15c — Cheltuială nouă (dialog de 520px)
Sumă mare, chip-uri de categorie (selectat: border 2px în culoarea categoriei), descriere, dată, metodă. Butoane: „Salvează și adaugă alta” + „Salvează”. **Fără** „+ Atașează bon”.

## 15d — Confirmări
- **Arhivare:** fără dialog. Toast slate, radius 16: „N … arhivate · **Anulează**” (`--yellow`), 6s.
- **Ștergere definitivă:** `ConfirmDeleteDialog` (icon „!” `--pink-soft`/`--pink-ink`, titlu Baloo 24, explicație, câmpul „Scrie ȘTERGE”, buton `--raspberry` activ doar când textul e corect).

## 15e — Liste goale
Trei variante:
- **Fără rezultate:** filtrele active listate + „Șterge filtrele”.
- **Coadă rezolvată:** mint, „Totul e rezolvat”.
- **Primul pas:** dashed + CTA primar.

## 15f — Cardul de salvare din sidebar
| Stare | Aspect |
|---|---|
| Normal | punct `--success-dot` |
| Se salvează | punct `--yellow` |
| Nesalvat | fundal `--yellow-soft`, border `--yellow`, CTA „Salvează acum” |
| Eroare | fundal `--pink-soft`, border `--pink`, text `--pink-ink`, CTA „Încearcă din nou” |

Starea vine din `data-state` existent în `SaveStatusCard`.

## 15g — Scroll subțire (`ScrollArea`)
Referință: `Formulare.dc.html#15g`. Implementarea completă (CSS + logică) e în `FEEDBACK.md` → „Meniul lateral” → 2.
| Stare | Thumb | Pistă |
|---|---|---|
| Repaus | invizibil (opacity 0, dispare după 800 ms) | — |
| Hover / focus pe zonă | 3 px, `#e0d5c2` | transparentă |
| Hover pe bară | 5 px, `#c9c4ba` | `rgba(58,71,80,.04)` |
| Tragere | 5 px, `#9aa3a9` | `rgba(58,71,80,.06)` |
Bara se desenează peste conținut, la 2 px de margine, cu 6 px sus și jos, capete rotunde și lungime minimă de 32 px. Cât timp mai e conținut dedesubt, jos apare o umbră albă de 48 px.

- [ ] Grosimea vizibilă e 3 px (5 px la hover), identică în Chrome și Firefox
- [ ] Conținutul nu se mișcă când apare bara
- [ ] Fără overflow, bara nu apare deloc
