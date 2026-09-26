# Specificații pe ecrane — pentru Claude Code

Câte un fișier pentru fiecare ecran. Fiecare are aceeași structură, ca să nu fie nevoie de interpretare:

1. **Referință:** fișierul `.dc.html` și id-ul artboard-ului.
2. **Rută și fișiere:** ce se creează și ce se modifică, cu calea completă.
3. **Date:** ce hook sau funcție existentă se folosește; funcțiile noi au semnătură și tipuri.
4. **Arbore de componente:** scheletul JSX cu numele claselor CSS.
5. **CSS:** valorile exacte pe clasă, cu tokenii din `tokens.css`.
6. **Stări:** gol, încărcare, eroare, azi, trecut, filtrat.
7. **Interacțiuni:** click, tastatură, navigare.
8. **Teste:** ce trebuie să verifice testele.
9. **Criterii de acceptare:** lista pe care o bifezi înainte de commit.

## Cum lucrezi cu un ecran
```
Citește docs/design/screens/00-comun.md și docs/design/screens/<NN-ecran>.md.
Deschide docs/design/<Fișier>.dc.html#<id> ca referință vizuală.
Implementează exact arborele de componente și CSS-ul din spec. Nu inventa elemente care nu apar acolo.
Rulează npm run typecheck && npm test în webapp/.
Bifează fiecare criteriu de acceptare din spec și raportează-le pe cele nebifate.
```
**Un ecran per sesiune.** Dacă spec-ul și `.dc.html` nu se potrivesc, spec-ul are prioritate. Notează diferența în mesajul de commit.

## Index
| # | Ecran | Referință | Spec |
|---|---|---|---|
| 00 | Componente comune (antet compact, bara de filtre, comutator) | toate | `00-comun.md` |
| 01 | Copii → Zile de naștere | Copii.dc.html#2a | `01-copii-zile-de-nastere.md` |
| 02 | Copii → listă | Copii.dc.html#1c | `02-copii-lista.md` |
| 03 | Grupe (Carduri / Tablă) | Grupe.dc.html#1g, #1h | `03-grupe.md` |
| 04 | Vizite | Vizite.dc.html#2a | `04-vizite.md` |
| 05 | Achitări (Tabel / Pe luni) | Achitari.dc.html#1i, #1j | `05-achitari.md` |
| 06 | Cheltuieli (Tabel / Pe zile) | Cheltuieli.dc.html#1k, #1l | `06-cheltuieli.md` |
| 07 | Situația plăților (Lună / An școlar) | Situatia.dc.html#1m, #1n | `07-situatia.md` |
| 08 | Dashboard | Dashboard.dc.html#1a | `08-dashboard.md` |
| 09 | Copii → fișa copilului | Copii.dc.html#1e | `09-copii-fisa.md` |
| 10 | De notificat | De notificat.dc.html#2b | `10-de-notificat.md` |
| 11 | De rezolvat (Taxe, De verificat, Asociere) | De rezolvat.dc.html#2c, #2d, #2e | `11-de-rezolvat.md` |
| 12 | Administrare (Istoric, Notificări, Backup, Grădinița) | Administrare.dc.html#2f–#2h, Tiparire.dc.html#6a | `12-administrare.md` |
| 13 | Formulare și stări | Formulare.dc.html#3a–#3f | `13-formulare.md` |
| 14 | SMS (mesaje, șabloane) | Sms.dc.html#4a, #4b | `14-sms.md` |
| 15 | Tipărire (A5, A4) | Tiparire.dc.html#6b, #6c | `15-tiparire.md` |
| 16 | Planuri în EUR, plată în lei (curs BNM) | Planuri si curs.dc.html#7a–#7g | `16-planuri-eur.md` |

Pentru ca Claude Code să găsească singur spec-urile, copiază `CLAUDE-md-snippet.md` în `CLAUDE.md` din repo.
