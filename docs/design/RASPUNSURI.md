# Răspunsuri la INTREBARI.md și spec-ul SMS — 26.09.2026, 20:20

Citit de pe `master-v2` după punctele 1–6 și 9. Se pune în `docs/design/`, lângă `INTREBARI.md`. Ce e marcat **[utilizator]** așteaptă o decizie a grădiniței; restul e decis.

## INTREBARI.md

**Achitări — Tipărește confirmarea.** Corect amânat. Se reia împreună cu ecranul 16b (`screens/15-tiparire.md`).

**Cheltuieli — filtrul Metodă.** Se adaugă câmpul `method?: 'cash' | 'card' | 'transfer'` pe `Expense` (schemă + normalizare + select în formularul 15c, implicit Cash la cheltuieli noi). Cheltuielile vechi rămân fără metodă: apar doar la „Toate”, iar în tabel coloana Metodă arată „—”. Nu se adaugă o pastilă „Nespecificat”.

**Situația plăților — comentariul din `useStatus.ts:29-33`.** Comentariul e depășit; designul 7a are intenționat pastilele Grupa. Intenția lui se păstrează altfel: filtrul restrânge **doar tabelul**, iar cardurile de sus (Așteptat / Încasat / Rest / Achitat complet) rămân mereu pe toată luna, la fel ca la Achitări. Rescrie comentariul în acest sens și fă punctul 7.

**Situația plăților — ecranul complet.** De acord: ecran separat, cu plan înainte de cod. Ordinea: (1) pastilele Grupa (punctul 7), (2) cele 4 carduri + modul An școlar + harta, (3) SMS, după P1 din spec-ul SMS.

## Monedă — cele două modele (punctul 8, blocant)

Decizia utilizatorului, deja luată: **taxa copilului e în EUR, achitarea se introduce în lei și se convertește în EUR la cursul BNM din ziua plății; plățile parțiale se scad în EUR.** Niciuna dintre cele două variante nu se ia întocmai. Varianta aleasă e (b) redusă, construită peste backend-ul existent, fără să-l înlocuiască:

- Păstrează `currency: 'MDL'|'EUR'` pe `feeHistory` așa cum e în cod. Copiii cu taxa în EUR au `currency: 'EUR'`; copiii vechi rămân în MDL până îi mută operatorul. **Fără migrare automată.**
- Pe `Payment` adaugă `fxRate` și `amountEur`, pe lângă `amount` (lei) și `currency`. La salvare, dacă taxa copilului e în EUR: `fxRate` = cursul BNM din ziua plății (din `exchange-rates`), `amountEur = round2(amount / fxRate)`. Ambele se **îngheață**: o schimbare de curs ulterioară nu modifică plățile vechi.
- Obligația unui copil cu taxa în EUR se calculează în EUR din `amountEur`. Agregatele pe mai mulți copii (Dashboard, carduri) rămân cum sunt deja în cod, cu conversie la curs.
- Avansul rămâne în lei.
- **Planurile** (12a) sunt doar presetări, fără tabel `plan_id` obligatoriu: o listă în Setări (`nume`, `preț EUR`, per filială) din care formularul copilului completează taxa. Taxa rămâne editabilă. `plan_price_history` nu se face în v1.
- `16-planuri-eur.md` se actualizează după regulile de mai sus: câmpurile `plan_id`/`monthly_fee_eur`/`amount_mdl` devin `feeHistory.currency` + `Payment.fxRate`/`amountEur`. Ecranele 12a–12g rămân valabile ca aspect.

Ordinea UI: fila Curs (12a, partea de curs) → `fxRate`/`amountEur` pe Payment + formularul 12b → sume în € în fișă/Situația/De notificat → presetările de plan.

## Spec SMS (`2026-09-26-sms-notify-design.md`, §10)

Spec-ul e aprobat, cu răspunsurile de mai jos.

1. **[utilizator]** Numele de expeditor. Propunere: „Startica”. Cererea în dashboard-ul sms.md se face acum, în paralel.
2. **[utilizator]** Contul sms.md (persoană juridică, depozit 500 MDL): îl deschide grădinița.
3. „Fără diacritice la trimitere”: **pornit implicit**.
4. Pornim doar cu „Reamintire restanță”. Fila „Plată parțială” din 7c se scoate până există un al doilea șablon.
5. Un SMS per copil, părintele 1 cu cădere pe părintele 2. Fără opțiunea „și părintelui 2” în v1.
6. Limita lunară: **opțională, implicit dezactivată** (decizia anterioară: fără limită fixă). Contorul lunar rămâne vizibil, numărat **per filială**. Când operatorul setează o limită, se aplică gardul din §5.2 pasul 2; maximul editabil 5000.
7. „Necunoscut”: a patra insignă, neutră (gri). Se adaugă la 11a.
8. Retenție: jurnalul rămâne; după 12 luni se golesc `text` și `phone`, ca la `healthNotes`.
9. „Copiază” rămâne lângă „Trimite SMS” în De notificat, ca buton secundar.
10. Limita de rată se află la primul lot real (un 429 oprește lotul fără cost).
11. Fără coadă automată după alimentare. „Reîncearcă” rămâne manual.
12. Ordinea P1 → P2 → P3 e bună. P2 așteaptă ecranul complet Situația plăților.

## Coada, continuare (după punctele 1–6 și 9)

7. Situația plăților: FilterPills Grupa, cardurile rămân pe toată luna (vezi mai sus).
6b. Cheltuieli: câmpul `method` + FilterPills Metodă.
8. EUR/BNM, UI în `webapp/` după `screens/16-planuri-eur.md`: întâi ecranul „Curs valutar” (fila Planuri și curs din Backup și setări, 12a), apoi selectorul din `PaymentFormDrawer` (12b), apoi afișarea în €, în ordinea din spec.
9b. SMS P1: `#shared` + `sms-notify` server + card Furnizor + Șabloane + „Trimite SMS” din De notificat. Plan de implementare înainte de cod.
10. Situația plăților, ecranul complet (carduri, An școlar, hartă). Plan înainte de cod.
11. Curățenia 10+ din coadă (R6 „Scrie ȘTERGE”, R7, R9, R10, Button/SearchInput comune).

12. Încărcare (`screens/21-incarcare.md`): StartupScreen, Skeleton, bara de sus, ecranul după 15 s.
13. Prezența (`screens/19-prezenta.md`): tabel attendance, pagina, secțiunea din fișă. Plan înainte de cod.
14. Raport contabil (`screens/20-raport-contabil.md`): după punctul 8, fiindcă folosește `Payment.fxRate`/`amountEur`.
15. Confirmarea de plată (`screens/15-tiparire.md`): A5 și A4 în două părți; partea părintelui după 16g (decis).

Prima pornire (`22`) nu se face decât la cerere. Filialele și sincronizarea (Faza 6) rămân excluse până la un mesaj explicit.

## 2026-09-29, 23:19 — al doilea lot de decizii

Răspunsuri la punctele deschise în `INTREBARI.md` la sync-ul de 29.09. Detaliul rămâne acolo, lângă fiecare întrebare (marcate ✅ „Rezolvat 29.09, 23:19”).

**A3f — descrierea cheltuielii de salariu (#2).** Rămâne generică „Salariu <lună>”, fără numele angajatului. Nimic de schimbat.

**A3f — salariul pe fișa angajatului (#4).** Rămâne link „Vezi cu PIN →” către fila Salarii; nu se adaugă dezvăluire inline pe fișă.

**A4 Bazin — „Antrenor:” cu mai mulți antrenori.** Confirmat: separare prin virgulă, cum e deja implementat. Nimic de schimbat.

**Notificări către părinți.** Rămân pe SMS (sms.md); nu se revine la Telegram nicăieri. Confirmă decizia deja luată și aplicată în cod (pivotul din roadmap 2026-09-26, „SMS conectat” în De notificat) — nu e o întrebare deschisă în `INTREBARI.md`, doar o confirmare.

**B1 — cele 7 plăți „Mixtă/De verificat”.** Varianta **(b)**: provizoriu, integral pe Cash, ca să dispară din „De rezolvat” înainte de rezolvarea manuală. Execuția (scriptul de migrare pe baza reală) se face separat, în paralel cu acest răspuns.

**B3 — cele 143 cheltuieli de bazin.** Trei decizii; migrarea propriu-zisă (câmpul `Payment.service`, kind-ul `services`, scrierea celor 143 rânduri, notele de diferență lunară) rămâne un task separat, mai mare, executat ulterior:
1. Toate cele 143 sunt încasări reale de bazin — fără verificare manuală rând cu rând.
2. Metoda la migrare: Cash (niciuna din cele 143 n-are metodă înregistrată).
3. Retroactiv, inclusiv iunie–iulie 2026, nu doar de-acum înainte.

**A6 — pragul „Posibil” ≥ 2.** Confirmat, rămâne așa cum e implementat.

**A7 — „Probleme la backup”.** Scos din design, nu se construiește.

**A7 — „Zonă periculoasă”.** Scoasă din design, nu se adaugă nicio acțiune distructivă.

**A7 — „Importă copii din CSV”.** Rămâne doar Excel, CSV nu se construiește.

**Folder străin la rădăcina proiectului.** `Startica V2.zip` era rest de la dezarhivare, deja extras și aplicat în `docs/design/`. Șters de la rădăcina repo-ului.
