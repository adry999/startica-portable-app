# Decizii luate — 29.09.2026

Toate deciziile de produs din sesiunile de design. **Au prioritate** față de orice spec mai vechi din `screens/` sau din `README.md` vechi. Nu le mai întreba; dacă o decizie contrazice codul, codul se schimbă.

## Comune
1. **Eyebrow-ul antetului = grupa din meniul lateral**: Evidență (Copii, Grupe, Prezența, Bazin, Vizite, Personal) · Contabilitate (Achitări, Cheltuieli, Situația plăților, De notificat, Raport contabil) · De rezolvat · Administrare. Dashboard: „Privire de ansamblu”.
2. **Filiala apare doar în butonul-dropdown din meniul lateral.** Nu în eyebrow, nu în titlurile modulelor sau ale cardurilor. Excepții: documente tipărite (bon, confirmare, pontaj) și mesajele despre o altă filială (dialogul „formular nesalvat”, lista calculatoarelor).
3. **Curs BNM, niciodată „BNR”.** Pastila de curs de pe Dashboard e link spre https://www.bnm.md/ (tab nou).
4. **Ștergere definitivă doar din „Arhivate”**, cu selecție multiplă și „Scrie ȘTERGE” (15h, B2). În „Active” există doar Arhivează.
5. **Butoane din antet**: un singur stil primar (Baloo 15/700, `8px 18px`, portocaliu, umbră de antet) și un singur stil secundar (Nunito 14/800, `8px 16px`, alb, border 1.5px `--border`).

## Dashboard
6. Pastila curs € stă între căutare și selectorul de lună.
7. „Evoluția încasărilor” are **două coloane pe lună** (încasări portocaliu, cheltuieli verde), max. 13px fiecare, aceeași scală; comutatorul Încasări/Cheltuieli dispare; tooltip cu diferența.

## Copii
8. Coloana „Părinte · telefon” arată **contactul principal**; al doilea părinte = insignă „+1” cu tooltip. Căutarea găsește și după al doilea.
9. **Copil nou = 4 secțiuni** (Copil · Părinți · Contract și taxă · Grupă). Automat: Statut „Activ”, Data contractului = „Începe la”. Alergii, persoane care pot ridica copilul, istoricul taxei, retragerea, notele și documentele se completează **din fișa copilului**. La editare, în plus doar „Alte date” (IDNP, adresă, data contractului).
10. **Nr. contract** = câmp nou `contractNumber`, opțional.
11. Părinții au **relație** (Mamă/Tată/Bunică/Bunic/Tutore/Altul), max. 2 părinți; „Pot ridica copilul” = listă separată, nelimitată (nume, relație, zile, telefon).
12. Notele sunt listă cu autor și oră, se pot edita (marcate „editată”) și șterge (cu toast Anulează).

## Grupe
13. La tragerea unei grupe: sursa devine loc gol punctat, imaginea trasă e o copie rotită −2° cu border portocaliu și umbră, ținta are inel portocaliu. Mânerul ⋮⋮ stă lângă nume.

## Prezența
14. **Fără marcare în masă.** Nu există „Nemarcații → prezenți” (nici în antet, nici pe grupă). Fiecare copil se marchează manual: Prezent → Absent → Motivat → Nemarcat. Cine nu e atins rămâne **nemarcat**.
15. „↶ Anulează | N ▾” + Ctrl+Z + „Modificări azi” cu „Anulează până aici” / „Anulează tot” — în Ziua și în Luna.
16. Sus: o bandă compactă cu 4 contoare + bară segmentată, nu 4 carduri mari. Fiecare grupă e un **chenar în culoarea ei**.

## Personal
17. Pontaj: zilele viitoare acceptă doar CO/CM (concediu planificat); A doar până azi. CO = `#e0b400`.
18. Concediile se desenează **pe zile**, nu pe luni întregi.
19. Salarii: stepper de lună (doar lunile încheiate se plătesc), „Blochează”, metoda aleasă în dialogul de confirmare.

## Achitări
20. **Nu există „Altele”.** Orice leu e Cash, Card sau Transfer; plățile mixte vechi se împart pe metode (B1).
21. **Serviciu** pe fiecare achitare: Grădiniță (implicit), Bazin, plus oricâte servicii noi adăugate din Backup și setări → Servicii (10d). Grădiniță și Bazin sunt fixe; celelalte au sumă liberă sau preț fix și nu creează datorie. **O achitare = un serviciu** (plătește ambele → două achitări). Coloană separată „Serviciu” în tabel + filtru.
22. Cheltuielile care erau de fapt încasări de bazin se mută la **Achitări fără copil**, serviciul Bazin, și apar în **Asociere achitări**. Întâi lista de diagnostic, migrarea după confirmare (B3).
23. Achitare nouă: „Plătitor” (numele din extras) și „+ Adaugă observație” (pliat); bifa „Trimite confirmare părintelui” în subsol (Telegram).

## Deschise (de întrebat utilizatorul dacă apar)
- Dacă backend-ul poate trimite confirmarea pe Telegram (altfel bifa se ascunde).
- Ce anume „nu e în logică” la salarii — cele 5 verificări din A3f dau răspunsul.
