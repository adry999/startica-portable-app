# 25 — Bon 58 mm și stickere (imprimanta termică SK58)

**Referință:** `Bon 58mm.dc.html#24a`–`#24d`.

## Bon (24a–24c)
- Lățime utilă 48 mm (384 px la 203 dpi), alb-negru, logo în negru. `@page { size: 58mm auto; margin: 0 }`.
- 24a chitanță plată, 24b plăți pe zi, 24c bazin. Butonul „Bon 58 mm” lângă „Tipărește” în Achitări.

## Stickere (24d)
- Ruta `/tiparire/stickere`. Template-uri: Nume copil, Alergie, Anunț, Obiect, Text liber — fiecare precompletează 3 rânduri, toate editabile.
- Mărimi etichetă: 58×30, 58×40, 58×60 mm. Decor: cercuri / chenar / simplu. La 58×30 fără pictogramă.
- Textul mare își micșorează fontul după lungime (≤12 caractere 30 px, ≤18 24 px, altfel 20 px; ±6/−4 după mărime).
- Copii: nr. exemplare. Grupe → ⋯ → „Stickere pentru grupă” = câte un sticker „Nume copil” per copil activ.

## Criterii de acceptare
- [x] Previzualizarea = ce iese pe hârtie — bonul (24a/24b) folosește aceeași lățime `48mm` (CSS, nu px) atât pe ecran cât și la tipar, ca px-ul CSS fiind mereu 1/96" indiferent de dpi-ul imprimantei, un px fix ar fi rupt rândurile diferit; `@media print` doar ascunde bara de acțiuni și scoate umbra. Stickerele (24d) folosesc `mm` peste tot în `StickerLabel`, fără nicio dimensiune specifică tipăririi.
- [x] Textul nu iese din etichetă la nicio mărime — `bigTextFitsLabel` (sticker-text-fit.test.ts) verifică, pentru fiecare mărime de etichetă și un interval realist de lungimi, că fontul calculat de `bigTextFontSizePx` încape pe lățimea de tipar (48 mm), cu un factor conservator de lățime per caracter.
