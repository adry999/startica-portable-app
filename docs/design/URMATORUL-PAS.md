# Următorul pas pentru Claude Code

Stadiu la 27.09.2026, 14:56 (commit 7b1b753): punctele 8–15 din coadă sunt făcute (EUR, SMS P1, Situația, curățenie, Încărcare, Prezența, Raport contabil, Confirmarea de plată).

Lipește în Claude Code:

```
1. Aplică docs/design/FEEDBACK.md (Prezența și Raport contabil, corecturi mici).
2. Faza 6: filialele după docs/design/screens/17-filiale.md (plan în docs/superpowers/plans/ întâi), apoi sincronizarea după 18-sincronizare.md.
3. Apoi, pe rând: 23-bazin.md, 24-personal.md, 25-bon-stickere.md.
După fiecare: npm run check, webapp typecheck + test, bifează criteriile din spec, commit.
```

După push, scrie „sync”.
