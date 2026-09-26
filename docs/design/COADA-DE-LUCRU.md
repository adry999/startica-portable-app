# Coada de lucru pentru Claude Code

Se lucrează pe rând, în ordinea de mai jos. După fiecare punct:
- rulează `npm run check`;
- bifează criteriile de acceptare din spec;
- fă commit cu mesajul `ui(<ecran>): aliniat la docs/design/screens/<NN>`;
- treci la punctul următor fără să aștepți confirmare.

Te oprești doar dacă:
- un spec contrazice codul existent într-un mod pe care nu-l poți rezolva singur;
- ai nevoie de o decizie de business;
- `npm run check` rămâne roșu după 2 încercări.

În aceste cazuri, scrie întrebarea în `docs/design/INTREBARI.md` și treci la următorul punct care nu depinde de ea.

## Coada
1. **Antet compact:** `00-comun.md` A (Topbar 60px, titlu + eyebrow pe un rând, butoane mai mici). Verifică toate ecranele.
2. **Dashboard:** `08-dashboard.md` (KPI fără zecimale, „Necesită atenție” cu 0 gri, „Vezi calendarul →”).
3. **Fișa copilului:** `09-copii-fisa.md` (header în culoarea grupei, „+ Plată” precompletat, plătitori reținuți).
4. **De notificat:** `10-de-notificat.md`.
5. **De rezolvat:** `11-de-rezolvat.md` (Taxe și grupe, De verificat cu tasta S, Asociere achitări cu „Ține minte plătitorul”).
6. **Formulare și stări:** `13-formulare.md` (Drawer comun, ConfirmDeleteDialog „Scrie ȘTERGE” în locul `window.confirm`, liste goale, cardul de salvare).
7. **Administrare:** `12-administrare.md` (Istoric, Notificări, Backup și setări cu filele Import și export + Grădinița; Import CSV doar aici).
8. **Tipărire:** `15-tiparire.md` (confirmare de plată A5, situația A4; ruta confirmării înainte de `/achitari/:paymentId`).
9. **Curățenie R5–R7 din roadmap:** `Button` și `SearchInput` comune, comentarii și nume.
10. **Faza 4, moneda EUR/BNM:** scrie întâi planul după `16-planuri-eur.md` în `docs/superpowers/plans/`, apoi implementează.
11. **Faza 5, SMS:** scrie întâi spec-ul (sms.md, după `14-sms.md` și README „Notificare SMS”), apoi planul, apoi codul.

12. **Faza 6, două filiale:** scrie întâi planul tehnic după `17-filiale.md` (date separate pe filială, selector în Sidebar). 
13. **Faza 16b, sincronizare:** după 12, scrie spec-ul tehnic și planul după `18-sincronizare.md` (server de reconciliere, local-first, conflicte), apoi implementează.
