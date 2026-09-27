# Feedback după sync — 27.09.2026, 14:56

Verificat pe `master-v2` (7b1b753) față de design. Punctele 8–15 din coadă sunt în cod. Corecturile de mai jos sunt mici.

## Prezența (19 · 18a/18b) — ok, trei corecturi
- Cardurile Absenți și Motivați: cifra în culoarea stării (`--raspberry` / `--yellow-ink`), ca în 18a. Acum toate sunt `--slate`.
- Luna (18b): popover-ul „Motivat” primește mereu `reason=""`. Trebuie să primească motivul salvat pentru acea zi, ca în Ziua.
- „Tipărește” și „Exportă” stau în antet, lângă `MonthStepper` (ca 18b), nu în `trailing` al `FilterPills`.

## Raport contabil (20 · 19a/19b) — ok
- Totalurile, lista EUR cu curs salvat și portocaliul pentru `fxRateSource: 'manual'` sunt corecte.
- Rândul de total: „Total lună” pe Lună, „Total trimestru” / „Total an” pe celelalte. Acum e mereu „Total perioadă”.
- Selectorul de filială din export rămâne pentru Faza 6. Ok.

## Lipsesc din `docs/design/`
Încarcă din pachet: `Bazin.dc.html` (actualizat), `Personal.dc.html`, `Tiparire.dc.html` (actualizat), `Bon 58mm.dc.html`, `Set final.dc.html`, `screens/23-bazin.md`, `screens/24-personal.md`, `screens/25-bon-stickere.md`, `screens/README.md`.

## De făcut în continuare
1. Corecturile de mai sus.
2. Faza 6 (filiale, `17-filiale.md`), apoi sincronizarea (`18-sincronizare.md`), cum e confirmat în `COADA-DE-LUCRU.md`.
3. Apoi, pe rând: `23-bazin.md`, `24-personal.md`, `25-bon-stickere.md`. `npm run check` + typecheck + test după fiecare.
