# Decizii luate — 29.09.2026

Toate deciziile de produs din sesiunile de design. **Au prioritate** față de orice spec mai vechi din `screens/` sau din `README.md` vechi. Nu le mai întreba; dacă o decizie contrazice codul, codul se schimbă.

## Comune
1. **Eyebrow-ul antetului = grupa din meniul lateral**: Evidență (Copii, Grupe, Prezența, Bazin, Vizite, Personal) · Contabilitate (Achitări, Cheltuieli, Situația plăților, De notificat, Raport contabil) · De rezolvat · Administrare. Dashboard: „Privire de ansamblu”.
2. **Filiala apare doar în butonul-dropdown din meniul lateral.** Nu în eyebrow, nu în titlurile modulelor sau ale cardurilor. Excepții: documente tipărite (bon, confirmare, pontaj) și mesajele despre o altă filială (dialogul „formular nesalvat”, lista calculatoarelor).
3. **Curs BNM, niciodată „BNR”.** Pastila de curs de pe Dashboard e link spre https://www.bnm.md/ (tab nou).
4. **Ștergere definitivă doar din „Arhivate”**, cu selecție multiplă și „Scrie ȘTERGE” (15h, B2). În „Active” există doar Arhivează.
5. **Butoane din antet**: un singur stil primar (Baloo 15/700, `8px 18px`, portocaliu, umbră de antet) și un singur stil secundar (Nunito 14/800, `8px 16px`, alb, border 1.5px `--border`).

## Actualizări (01.10)
- **Versiunile noi se descarcă din GitHub Releases**, nu de pe VPS. Repo public de release, `latest.json` + instaler ca asset-uri; VPS-ul rămâne doar server de sincronizare. Detalii în `screens/32-actualizari.md`.

- **C6–C13 în pauză (02.10):** teme pe grădiniță, conturi cu roluri, prezență pe telefon, SMS automat, contracte, ajutor în aplicație, burse, verificare backup. Nu se construiesc până la o decizie nouă.

- **Rotunjire la achitare (02.10):** se încasează suma reală. Precompletat rotunjit la leu. Diferență ≤ 5 lei = luna achitată, diferența salvată ca rotunjire. Peste = parțial / avans. Pasul și toleranța se setează pe filială.

- **Telefon (02.10):** salvat ca `+373XXXXXXXX`, afișat ca `069 123 456`. Intrarea acceptă orice formă. Numerele existente fără 0 se migrează după backup.

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


## 30.09 — Contrast buton primar
Varianta (a): `--orange-strong` #b85a00 pentru orice fundal cu text alb (4,7:1). `--orange` #ef8a1d rămâne pentru accente fără text. Aplicat în toate fișierele de design.

## 30.09, 12:30 — Răspunsuri înainte de pasul 4
- **Al doilea val de migrare:** da, toate cele 15 module, modul cu modul, cu captură design lângă cod după fiecare. Ordinea: Dashboard, Copii, Achitări, Prezența, apoi restul.
- **Plătitori reținuți (CF-2):** cardul se face acum din `payerAliases` existent (nume, din data, N achitări, ștergere). IBAN mascat mai târziu, cu plan tehnic (`iban`, `nameKey`, `extractPayer`). Până atunci rândul arată „fără IBAN, doar numele”.
- **Documentele copilului:** scoase din design. Fără `child_documents`, fără `DocumentCard`.
- **Notele ca tabel separat (`child_notes`):** amânat până la sincronizare reală pe mai multe calculatoare în aceeași filială.
- **21c „Lucrez fără legătură” + „Ultima sincronizare”:** task separat după migrare; întâi se salvează `lastSyncedAt` în motorul de sincronizare.
- **Stări goale pentru restul listelor:** textele sunt în design (`Stari goale.dc.html` 35c, 35d, 35e). Se copiază exact în `empty-states.ts`.
- **Spinner în buton:** se adaugă mărimea 14 în `Spinner` (spec 29b).

## Telefon (02.10)
- **Un singur format salvat (§10):** baza ține telefonul ca E.164 (`+373XXXXXXXX`), ecranul arată „069 123 456”. `PhoneInput` acceptă orice formă (`69123456`, `069123456`, `+373 69…`, `00373…`) și salvează E.164 odată numărul complet/valid.
- Opțional, „Alt număr” pentru numere străine (cu prefix „+”): acceptat ca atare, fără normalizare, fără eroare.
- Un număr incomplet nu blochează salvarea (câmpul rămâne opțional); mesajul e „Număr incomplet: 8 cifre după 0”, nu mesajul generic.
- Dacă nu e nici un mobil moldovenesc valid, nici „alt număr” cu „+”, se salvează așa cum e, cu `phoneInvalid: true` (pentru bannerul „de verificat”, §9.3/§14 — construit între timp, vezi `MissingFieldsBanner`).

## 02.10 — răspunsuri la INTREBARI PROMPT-8 (detaliu: RASPUNSURI-02-10.md)
- Release-uri pe repo public separat `adry999/startica-releases`; codul rămâne privat.
- Raport contabil păstrează secțiunea „Pentru taxe în EUR”; agregatele rămân doar MDL.
- Curs valutar + planuri se mută în baza comună (migrare separată, dry-run întâi).
- „+ Plată” din fișă precompletează doar taxa lunii; restanța rămâne bifă manuală (F7).
- Pontaj: codul „P” (prezent confirmat) apare distinct, literă pe mint, în grilă și la tipărire.
- La restrângerea profilului nu se șterg date locale; doar se ascund (ModuleGuard).
- Prima pornire începe cu alegerea Backup / Alt calculator / De la zero (46a–46d).


## 02.10 — Scrii doar în filiala deschisă
O acțiune făcută într-o filială nu adaugă și nu modifică date ale altei filiale. Angajatul nou intră în filiala deschisă; ca să lucreze și în alta, se adaugă din acea filială („Angajat existent”). Datele din Comun se citesc de oriunde; setările Comun se etichetează „pentru toate filialele”. Excepții: registrul de filiale (nume, culoare, adresă) și rapoartele „Ambele”, doar citire.
