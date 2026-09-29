# De copiat în `CLAUDE.md` (rădăcina repo-ului)

```markdown
## Design
Designul final e în docs/design/. Ordinea de citire, înainte de orice modificare de UI:
1. docs/design/DECIZII.md — deciziile de produs; au prioritate față de orice altceva.
2. docs/design/ALINIERE-DESIGN.md — coada de lucru cu valorile exacte pe ecran (A1…B3).
3. docs/design/TOKENS.md — culori, tipografie, raze, umbre → tokenii din tokens.css.
3b. docs/design/COMPONENTE.md — ce componentă din @shared/ui se folosește pentru fiecare tipar; componentele noi se extrag la prima folosire.
4. docs/design/ECRANE.md — inventarul artboard-urilor; referința vizuală e <Fișier>.dc.html#<id>.
5. docs/design/screens/<NN>.md — spec-ul detaliat al ecranului (unde ALINIERE nu spune altfel).
Se deschide cu `npx serve docs/design` și se compară la 1440px.
Reguli: folosește @shared/ui și tokens.css, nu hex nou; nu adăuga elemente care nu apar în design;
un punct = un commit; npm run check + cd webapp && npm run typecheck && npm test verzi;
întrebările de business în INTREBARI.md, apoi treci mai departe.
Prioritate la conflict: DECIZII > ALINIERE > artboard .dc.html > screens/*.md > README vechi.
```
