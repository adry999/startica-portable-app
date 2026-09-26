# De copiat în `CLAUDE.md` (rădăcina repo-ului)

Lipește secțiunea de mai jos în `CLAUDE.md` din rădăcina repo-ului (branch `master-v2`). Claude Code citește fișierul automat la fiecare sesiune.

```markdown
## Design
Specificațiile de design sunt în docs/design/.
Înainte de orice modificare de UI într-un ecran din webapp/src/features/<modul> sau webapp/src/app/shell:
1. Citește docs/design/screens/README.md și găsește spec-ul ecranului în tabelul Index.
2. Citește docs/design/screens/00-comun.md și spec-ul ecranului.
3. Dacă ecranul nu are spec, caută secțiunea lui în docs/design/README.md.
4. Referința vizuală e fișierul .dc.html din spec (id-ul artboard-ului). Se deschide cu `npx serve docs/design`.
5. Spec-ul are prioritate față de .dc.html. Nu adăuga elemente care nu apar în spec.
6. Folosește componentele din @shared/ui și variabilele din tokens.css; nu scrie culori hex noi.
7. Un ecran per sesiune. La final: npm run typecheck && npm test în webapp/, apoi bifează
   criteriile de acceptare din spec și raportează ce a rămas nebifat.
```

## Prompturi scurte după asta
- `Refă pagina Zile de naștere după design.`
- `Aliniază ecranul Achitări la design.`
- `Implementează componentele comune din design.`

Dacă nu găsește spec-ul singur:
`Caută în docs/design/screens/ spec-ul pentru <ecran> și urmează-l punct cu punct.`
