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
| 01 | Copii → Zile de naștere | Copii.dc.html#2c | `01-copii-zile-de-nastere.md` |
| 02 | Copii → listă | Copii.dc.html#2a | `02-copii-lista.md` |
| 03 | Grupe (Tablă / Carduri) · v2 | Grupe.dc.html#4b, #4a | `03-grupe.md` |
| 04 | Vizite | Vizite.dc.html#4a | `04-vizite.md` |
| 05 | Achitări (Tabel / Pe luni) | Achitari.dc.html#5a, #5b | `05-achitari.md` |
| 06 | Cheltuieli (Tabel / Pe zile) | Cheltuieli.dc.html#6a, #6b | `06-cheltuieli.md` |
| 07 | Situația plăților (Lună / An școlar) | Situatia.dc.html#7a, #7b | `07-situatia.md` |
| 08 | Dashboard | Dashboard.dc.html#1a | `08-dashboard.md` |
| 09 | Copii → fișa copilului | Copii.dc.html#2b | `09-copii-fisa.md` |
| 10 | De notificat | De notificat.dc.html#8a | `10-de-notificat.md` |
| 11 | De rezolvat (Taxe, De verificat, Asociere) | De rezolvat.dc.html#9a, #9b, #9c | `11-de-rezolvat.md` |
| 12 | Administrare (Istoric, Notificări, Backup, Grădinița) | Administrare.dc.html#10a–10c, Tiparire.dc.html#16a | `12-administrare.md` |
| 13 | Formulare și stări | Formulare.dc.html#15a–15f | `13-formulare.md` |
| 14 | SMS (mesaje, șabloane) | Sms.dc.html#11a, #11b | `14-sms.md` |
| 15 | Tipărire (A5, A4) | Tiparire.dc.html#16b, #16c | `15-tiparire.md` |
| 16 | Planuri în EUR, plată în lei (curs BNM) | Planuri si curs.dc.html#12a–12g | `16-planuri-eur.md` |
| 17 | Două filiale (selector în meniu) | Filiale.dc.html#13a–13c | `17-filiale.md` |
| 18 | Sincronizare între calculatoare | Sincronizare.dc.html#14a–14c | `18-sincronizare.md` |

Pentru ca Claude Code să găsească singur spec-urile, copiază `CLAUDE-md-snippet.md` în `CLAUDE.md` din repo.

## Adăugate 27.09.2026
- `19-prezenta.md` — Prezența (18a, 18b)
- `20-raport-contabil.md` — Raport pentru contabil (19a, 19b)
- `21-incarcare.md` — Încărcare (21a–21c)
- `22-prima-pornire.md` — Prima pornire (20a–20c), opțional
- `15-tiparire.md` — secțiune nouă 16d–16g, confirmarea pe A4 în două părți

## Adăugate 27.09.2026 (2)
- `23-bazin.md` — Bazin (22a–22d)
- `24-personal.md` — Personal (23a–23k)
- `25-bon-stickere.md` — Bon 58 mm și stickere (24a–24d)

## Adăugate 28.09.2026
- `03-grupe.md` — **rescris (v2)** pentru 7+ grupe: Tabla implicită, „+ Grupă nouă” în antet (4a, 4b). Varianta 3a/3b a fost scoasă.
- `26-foaie-saptamana.md` — foaia de prezență pe săptămână, A4 orizontal, câte una pe grupă (18c, 18d)
