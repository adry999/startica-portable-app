# Următorul pas pentru Claude Code

Stadiu la 28.09.2026, 11:06 (fără commituri noi de la 10:25): prioritate pe **7 module**. Le închidem pe rând, unul câte unul; fiecare se termină cu „sync” și verificarea mea, ecran cu ecran. Prezența, Vizite, Bazin, foaia săptămânii și Prima pornire rămân pe după.

Lipește în Claude Code:

```
Lucrăm pe module, în ordinea de mai jos. Un modul e ÎNCHIS când:
  (a) arată ca .dc.html-ul lui din docs/design (compară ecran cu ecran),
  (b) toate criteriile din screens/NN-*.md sunt bifate,
  (c) toate punctele lui din AUDIT-UI-2026-09-28.md sunt rezolvate,
  (d) npm run check + webapp typecheck + test sunt verzi.
Nu începe modulul următor până nu e închis cel curent. După fiecare modul: commit, trece-l în COADA-DE-LUCRU.md și oprește-te (eu scriu „sync”).

ETAPA 0 — baza comună (o singură dată, afectează toate modulele)
0.1 Shell: .sidebar { z-index: var(--z-sticky) } + scara --z-* în tokens.css; Drawer/Toast/RowMenu/dialoguri pe variabile (FEEDBACK 2a).
0.2 ScrollArea în shared/ui, pusă în .nav din meniul lateral (FEEDBACK 2b, Formulare.dc.html#15g).
0.3 Antetul comun: AUDIT-UI T-1…T-6.
0.4 Bug de date în Prezența: markGroupPresent doar pe nemarcați (FEEDBACK 1). E o funcție; o facem acum ca să nu stricăm date.

MODULUL 1 — Dashboard      · Dashboard.dc.html · 08-dashboard.md
MODULUL 2 — Copii          · Copii.dc.html (listă, fișă, Zile de naștere) · 01, 02, 09
MODULUL 3 — Grupe v2       · Grupe.dc.html#4b/#4a/#4c · 03-grupe.md (rescris) — înlocuiește G-1…G-16 din audit
MODULUL 4 — Personal       · Personal.dc.html · 24-personal.md · verifică și legătura cu echipa pe grupă (GroupTeamCard)
MODULUL 5 — Achitări       · Achitari.dc.html, Tiparire.dc.html#16g · 05, 15
MODULUL 6 — Cheltuieli     · Cheltuieli.dc.html · 06-cheltuieli.md
MODULUL 7 — Situația plăților · Situatia.dc.html, Tiparire.dc.html#16c · 07, 15 · + 12c (sume în €)

Pentru fiecare modul, la început scrie o listă scurtă: ce lipsește față de (a)–(c). Apoi lucrează pe ea.
```

După Etapa 0, scrie „sync”. Apoi „sync” după fiecare modul.
