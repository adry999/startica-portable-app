# Următorul pas pentru Claude Code

Stadiu la 28.09.2026, 09:45 (master-v2 după 129 de commituri de la 7b1b753): în cod sunt filialele, sincronizarea, Personal, stickerele, bonul de 58 mm și auditul UI. Designul de azi (Grupe v2, Prezența cu anulare și foi, scroll subțire) nu e încă în repo.

1. Copiază pachetul peste `docs/design/`. Păstrează `COADA-DE-LUCRU.md`, `INTREBARI.md`, `RASPUNSURI.md` și `AUDIT-UI-2026-09-28.md` din repo. Commit + push.
2. Lipește în Claude Code:

```
Citește docs/design/FEEDBACK.md (28.09) și lucrează în ordinea de acolo:
1. Bug: „Toată grupa prezentă” — doar nemarcații (useAttendanceDay.markGroupPresent).
2. Meniul lateral: dropdown filială prin portal + scara z-index; ScrollArea (Formulare.dc.html#15g).
3. Grupe v2 după screens/03-grupe.md (Tablă implicit, 4c Grupă nouă, reordonare cu order).
4. Prezența: anulare + istoric, indicator de salvare (19-prezenta.md), foaia săptămânii (26-foaie-saptamana.md).
5. Bazin după 23-bazin.md.
Apoi batch-urile din AUDIT-UI-2026-09-28.md, începând cu T-1…T-6.
După fiecare: npm run check, webapp typecheck + test, bifează criteriile din spec, commit. Adaugă punctele în COADA-DE-LUCRU.md.
```

După push, scrie „sync”.
