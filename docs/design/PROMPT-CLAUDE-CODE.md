Citește `docs/design/ALINIERE-DESIGN.md` de la cap la coadă și lucrează punctele în ordinea din secțiunea „Ordinea de lucru”. Regulile din fișier se aplică (commit per punct, `npm run check` + `cd webapp && npm run typecheck && npm test` verzi, notează în `COADA-DE-LUCRU.md`, întrebările de business în `INTREBARI.md`, nu te opri).

Context important:
1. După b84d7df au intrat 14 commituri care au atins deja o parte din A1–A7. La fiecare punct, compară ÎNTÂI cu codul actual și scrie în `COADA-DE-LUCRU.md` ce era deja făcut, ce lipsește, apoi lucrează doar ce lipsește.
2. Referința vizuală e mereu `.dc.html`-ul numit la punct, din `docs/design/`. Deschide-l în browser și compară la 1440px. Nu te baza pe descriere când artboard-ul arată altceva.
3. Prioritare, raportate de utilizator:
   - **B1** — plățile mixte cad la „Altele”; Cash + Card + Transfer trebuie să dea totalul, „Altele” dispare. Rulează întâi scriptul de diagnostic (doar citire) și pune rezultatul în `INTREBARI.md` înainte de orice migrare.
   - **A3c** — Prezența: „↶ Anulează | N ▾” cu istoricul zilei + Ctrl+Z lipsesc complet; cele 4 carduri mari devin o bandă compactă; fiecare grupă într-un chenar în culoarea ei.
   - **A3e** — Prezența · Luna nu seamănă cu 18b.
   - **A3** — Fișa copilului nu seamănă cu 2b (grila, cardul Date personale cu alergii + părinți cu relație + „Pot ridica copilul”, notele cu autor/editare/ștergere).
   - **A3f** — Personal: Pontaj (celule-pastilă, CO `#e0b400`, coloana CM, zile viitoare CO/CM), Concedii (bare pe zile, nu pe luni; editare), Salarii (stepper lună, Blochează, confirmare cu metodă, pastile Fix/Pe zile/Bazin) + cele 5 verificări de logică de la 23c — rezultatul lor în `INTREBARI.md`.
   - **A2** — Copil nou rămâne la 4 secțiuni; statut „Activ” și data contractului se pun automat; alergiile, persoanele care pot ridica copilul, istoricul și retragerea se editează din fișă.
4. Decizii deja luate (nu le mai întreba):
   - Copii 2a: contactul principal + insigna „+1” pentru al doilea părinte, cu tooltip.
   - Filiala apare doar în butonul-dropdown din meniu, nu în eyebrow-ul modulelor.
   - Dashboard: pastila curs € între căutare și lună; graficul are două coloane pe lună (încasări / cheltuieli), fără comutator.
   - Grupe: la tragere, copie rotită −2° cu border portocaliu, sursa rămâne loc gol punctat, ținta are inel portocaliu.
   - Pontaj: zilele viitoare acceptă doar CO/CM.
5. La final: rezumat în `COADA-DE-LUCRU.md` cu ce s-a închis, ce a rămas și de ce, apoi push pe `master-v2`.
