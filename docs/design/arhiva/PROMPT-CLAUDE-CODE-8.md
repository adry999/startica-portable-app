# Prompt pentru Claude Code — 8 (01.10.2026, seara)

Înlocuiește `PROMPT-CLAUDE-CODE-7.md` (mutat în `arhiva/`). Din PROMPT-7 sunt închise §0 și §1 (bug-urile din 2.1.0: `a2a80e8`, `b93224a`). **§2–§4 din PROMPT-7 nu sunt începute** și intră aici după corecțiile utilizatorului (§2 de mai jos). O singură sesiune, în ordinea de la final.

Surse: `FEEDBACK-01-10.md` (F1–F14, decizii) și `Feedback 01-10.dc.html#38a…38g` (design). Au prioritate față de specurile mai vechi.

## 0. Pachetul de design
Copiază `design_final_startica/` peste `docs/design/`. **Înainte de copiere, fă diff pe fiecare `.md` existent** (lecția de la §0 din PROMPT-7): dacă pachetul ar șterge ceva adăugat de o sesiune de cod, păstrează-l și notează în INTREBARI.md. Nu atinge `verificare/`, `INTREBARI.md`, `COADA-DE-LUCRU.md`, `RASPUNSURI*.md`, `AUDIT-UI-*.md`. Mută PROMPT-7 în `arhiva/`.
Commit: `docs(design): pachet 01.10 c`.

## 1. Bug-uri cu risc de date (primele)

### 1.1 F5 · Grupe: editorul păstrează datele primei grupe
`webapp/src/features/groups/GroupsPage.tsx:270–271`: editorul face `useState(group.name)` / `useState(group.capacity…)`, inițializate o singură dată. La schimbarea grupei selectate se schimbă copiii, dar numele și capacitatea rămân de la prima. Fix: `key={group.id}` pe componenta editorului (resetare completă la schimbarea grupei). Aceeași problemă la `GroupTeamPicker` (echipa grupei), unde starea internă nu se resetează: tot `key={group.id}`.
Test în `GroupsPage.test.tsx`: selectează A → selectează B → numele, capacitatea și echipa sunt ale lui B; o modificare nesalvată pe A cere confirmare (`useDirtyForm`) înainte de schimbare.
Commit: `fix(groups): editorul se resetează la schimbarea grupei`.

### 1.2 F6 · Backup complet
Azi `src/features/backup/server/backup.service.mjs` face `VACUUM INTO` pe **o singură bază** (cea a filialei active). Nu intră: `Comun/Startica_Date/startica.db` (personal, salarii, avansuri, pontaj, setările Personal), celelalte filiale, registrul de filiale, setările globale.
Construiește:
1. Backup = un fișier `.startica-backup` (zip) cu: fiecare `startica.db` de filială + `Comun` + registrul de filiale + `manifest.json` `{ version, createdAt, databases: [{ id, name, kind:'branch'|'common', file, sha256, counts: { <tip>: n } }] }`. Fiecare bază, prin `VACUUM INTO` + `readBackupSnapshot` ca acum (copie verificată înainte de redenumire). `sync.json` și tokenul **nu** intră.
2. Retenția, copia externă (hash) și `inainte-`/`migrare` rămân neschimbate, aplicate pe arhivă.
3. Restaurare: previzualizare cu numerele din manifest, pe fiecare bază (38g), apoi backup de siguranță complet, apoi înlocuire bază cu bază, într-o ordine sigură (Comun, apoi filialele). Se citesc și backup-urile vechi `.db` (o singură filială), cu un avertisment că lipsesc Comun și celelalte filiale.
4. Test de arhitectură: lista bazelor și tipurilor din backup e **derivată** din `record-schema.mjs` + registrul de filiale + schema bazei comune, nu scrisă de mână. Un tip nou care nu intră în backup pică testul.
5. Test de integrare „calculator nou”: aplicația A (2 filiale + Comun cu personal) → backup → aplicația B goală → restaurare → aceleași `counts` pe fiecare bază.
6. UI: cardul Backup din `webapp/src/features/backup/BackupPage.tsx` după `Feedback 01-10.dc.html#38g`.
Plan scurt în `docs/superpowers/plans/` înainte de cod. Commit pe pas.

## 2. Formulare și tabele

### 2.1 F4 · Fără autocompletare de browser
`autoComplete="off"` implicit în `@shared/ui`: `TextInput`, `NumberInput`, `PhoneInput`, `AmountInput`, `DateInput`, `TimeInput`, `TextArea`, `GlobalSearch`, plus `<form autoComplete="off">` în componentele de formular (`Drawer`, `Dialog` cu formular). Chrome ignoră `off` la nume/telefon/adresă: pentru acestea folosește `autoComplete="new-password"` doar dacă testul manual arată că `off` nu ajunge (notează rezultatul în INTREBARI.md). Regulă nouă în `architecture.test.ts` (R11): niciun `<input>`, `<textarea>` sau `<form>` brut în `features/**`; componentele din `@shared/ui` au `autoComplete` implicit, verificat într-un test.
Commit: `fix(ui): fără autocompletare de browser`.

### 2.2 F1 · Paginare cu numere și săgeți
`webapp/src/shared/ui/Pagination.tsx` e azi v1 („Pagina X din Y” + ‹ ›). Rescrie după `#38a` și `COMPONENTE.md` (rândul `Pagination`): „Pe pagină 25 ▾” · „26–50 din 312” · „‹ 1 2 3 4 … 13 ›”, butoane 32×32 radius 10, curenta slate, max. 7 poziții, prima și ultima pagină mereu vizibile, săgeți dezactivate la capete, ascunsă la o singură pagină. Funcția pură `pageWindow(page, total)` în fișier separat, cu teste (1, 2, 7, 13, 31 de pagini; curenta la început, la mijloc, la sfârșit). `DataTable` paginează implicit la peste 25 de rânduri și revine la pagina 1 când se schimbă filtrul sau căutarea. Verifică Copii, Achitări, Cheltuieli, Vizite, Personal, Istoric. Povești Storybook: 1, 7, 31 de pagini.
Commit: `feat(ui): paginare cu numere`.

### 2.3 F2 + F3 · Copil nou (15a)
`webapp/src/features/children/ChildFormDrawer.tsx`:
- linia ~334: eticheta pastilei devine `${group.name} · ${occupied}/${capacity}` (sau `${group.name} · ${occupied}` fără capacitate); `hint` = `${occupied} din ${capacity} locuri ocupate`. Grupă plină: text `--pink-ink` și nota din 38b sub pastile; rămâne selectabilă. Copilul editat nu se numără de două ori (testul de la linia 167 rămâne, cu textul nou).
- „5 · Alte date” apare și la Copil nou, pliat (`<details>` închis); la editare e deschis dacă are ceva completat. Actualizează testul de la `ChildFormDrawer.test.tsx:40`.
Commit: `fix(children): ocupare grupă și Alte date la Copil nou`.

## 3. Bani

### 3.1 F7 · Lunile acoperite pornesc de la luna curentă
În `PaymentFormDrawer.tsx` și în serviciul de alocare de pe server: o achitare acoperă luna plății, iar surplusul trece pe lunile următoare (avans). Lunile trecute neachitate **nu** se bifează automat. Apar ca rând separat „Are restanță: Sep 2026 · 500 €” cu „Bifează ca s-o acoperi” (38c). Plățile deja salvate nu se recalculează. Teste pe alocare: plată exactă, plată dublă (trece în luna următoare), plată cu restanță bifată sau nebifată, plată parțială.

### 3.2 F9 · MDL/EUR — verificare
Modelul e deja decis (INTREBARI.md „Monedă — modelul ales”): `Payment.amount` în lei + `fxRate` + `amountEur`, fixate la salvare. Verifică în cod și scrie rezultatul în INTREBARI.md:
- fiecare plată pentru o taxă în EUR are `fxRate` și `amountEur`;
- Dashboard, Raport contabil, Situația plăților și Cheltuieli afișează **doar MDL**;
- EUR apare doar în plan, în fișa copilului (obligația) și în fereastra de plată.
Plățile vechi fără `fxRate`: script `scripts/migrate/` cu `--dry-run` care completează din istoricul BNM (§3.3) cursul **datei plății**. Rulare reală doar după backup complet (§1.2).

### 3.3 F12 · Curs BNM: istoric, mâine, calendar
Azi `useExchangeRates.ts` are `rates: Record<date, number>` și arată „Ultimele zile” (5). Extinde:
- server: preluare automată la pornire și o dată pe oră, de la 13:00 la 18:00, până apare cursul de mâine (ora exactă de publicare BNM se verifică pe site, nu se presupune); completează golurile din ultimele 30 de zile; endpoint `POST /api/exchange-rates/backfill { days: 10 }` pentru „Vezi încă 10 zile”;
- ratele stau în baza comună și intră în backup (§1.2);
- UI după `#38e`: cardul de azi cu rândul „Mâine” (doar după publicare), calendar pe lună cu cursul fiecărei zile, weekendul cu cursul de vineri (gri), corectat manual (galben), „Vezi încă 10 zile”;
- achitarea folosește cursul **datei plății** (nu „ultimul cunoscut”), cu retragere la ultima zi lucrătoare dinainte.

### 3.4 F11 · Plată + din fișa copilului
`ChildProfileView` → „Plată +” deschide `PaymentFormDrawer` cu `childId` fixat (rândul copilului cu „Schimbă”), planul copilului din `feeHistory` curent, cursul datei plății, suma precompletată = plan € × curs pentru lunile bifate, plus restanța dacă e bifată (38c). Suma rămâne editabilă. Test: deschis din fișă → copil, plan și sumă precompletate.

### 3.5 F13 · Planuri: vizualizare, apoi editare
`webapp/src/features/backup/ExchangeRateSettings.tsx`: azi lista e mereu în editare, cu „Șterge” pe fiecare plan, iar „Renunță/Salvează” sunt mereu active. După `#38d`: mod `view` implicit (doar citire, cu „+ Adaugă plan” și „Editează planuri”). În modul `edit`: câmpuri editabile, ștergere doar pentru planurile nefolosite (tooltip „Folosit de N copii”), „Salvează” dezactivat cât `presetsDirty` e fals, „Anulează” revine la `view`. „+ Adaugă plan” trece direct în `edit` cu un rând nou.

## 4. F8 · Funcții personalizate la Personal
Funcțiile devin înregistrări în baza comună (`staffRoles`: `{ id, name, departmentId, order, archivedAt? }`), cu valorile din spec ca semințe; `Staff.roleId` rămâne și se leagă de ele (verifică `roleName()` din `GroupFormDrawer`/`RolesDrawer`). `RolesDrawer.tsx` după `#38f`: adaugă (nume + departament), redenumește, șterge doar dacă nu are angajați. Se sincronizează ca restul setului comun și intră în backup.

## 5. Din PROMPT-7, neîncepute
1. **PeriodFilter cu presetări** (PROMPT-7 §2, neschimbat).
2. **Versiuni și actualizare automată** (PROMPT-7 §3, neschimbat): GitHub Releases, `releases/latest/download/latest.json`, `scripts/release.mjs`. Repo-ul de release: întreabă în INTREBARI.md dacă nu există.
3. **Profiluri de calculator** (PROMPT-7 §4, neschimbat).

## 6. Storybook (în același commit cu componenta)
Fiecare componentă nouă sau schimbată primește poveste în `webapp/src/shared/ui/*.stories.tsx`, în commitul în care se schimbă (nu la final). Lista e în `COMPONENTE.md` §3b:
- `Pagination`: 1, 7, 13 (curenta 1 / 7 / 13), 31 de pagini; plus `DataTable` cu 312 rânduri.
- `ChipSelect`: grupe cu ocupare „8/12”, plină „12/12”, fără capacitate.
- `TextInput` (și celelalte câmpuri): poveste care arată `autoComplete="off"` în DOM (test de interacțiune).
- `RateCalendar` (nou): lună cu weekend, o zi corectată manual, zile lipsă; `RateCard` cu și fără „Mâine”.
- `EditableList` (nou): `view`, `edit` curat (Salvează inactiv), `edit` modificat, element folosit (× inactiv).
- `ChildLockedRow`, `ArrearsRow`, `BackupContents` (nou): starea de bază + cazul limită (fără grupă; restanță pe 3 luni; backup vechi `.db` cu avertisment).
- 40–45: `UndoToast`, `UnsavedChangesDialog`, `MissingFieldsBanner`, `ErrorNotice` (roz/galben), `WeekFillBar`, `RoundingRow` (4 stări), `PeriodFilter` (fiecare presetare + Interval), `AppBanner` (oprită / actualizare), `SetupWizard` (3 pași + backup vechi + nepotrivire), `QuickPaySearch` (cu frați, fără rezultate), `SiblingPaymentRows`, `CashSummaryCard`, `HistoryRow`, `RecentChanges`, `AttentionList` (5 surse + gol), `Drawer` cu `play` pentru regulile 44d.
Criteriu: `npm run storybook:build` verde; fiecare componentă din §3b are cel puțin o poveste. Testul de arhitectură existent (dacă verifică povești) acoperă și componentele noi.

## 6b. Povești Storybook care reproduc bug-urile
Fiecare poveste are un test de interacțiune (`play`), ca bug-ul să pice în `npm run storybook:test` dacă revine:
- `Drawer` 620px cu formularul complet „Copil nou” (5 coloane la persoane autorizate, 2 părinți): `body.scrollWidth <= body.clientWidth`.
- Editor grupă: selectează A → B, numele, capacitatea și echipa sunt ale lui B.
- `DataTable` 312 rânduri: pagina 3 → schimbă filtrul → pagina 1.
- Grafic „Evoluția încasărilor”: date reale, an gol, o singură lună. Barele sunt vizibile (înălțime > 0) și tooltip-ul apare la hover.
- `ChildFormDrawer` și `PaymentFormDrawer`: niciun input fără `autocomplete="off"`.

## 8. Îmbunătățiri zilnice (după §4, înainte de §5)
Artboard: `Feedback 01-10.dc.html#40a…40c`.
1. **40c · Modificări nesalvate.** Extinde `useDirtyForm` existent: confirmarea apare la ×, Esc, clic pe fundal, schimbarea selecției (editorul de grupă, §1.1) și navigarea în alt modul (`useBlocker` din router). Dialogul numește câmpurile schimbate (max. 3 + „și încă N”). Se aplică în toate `Drawer`/`Dialog` cu formular. Test pe fiecare cale de închidere. Poveste Storybook.
2. **40b · Anulează după salvare.** `UndoToast` în `@shared/ui` (10 s, numărătoare). Serverul: `POST /api/undo/:auditId`, acceptat doar 15 s după acțiune, doar de pe același calculator, doar dacă înregistrarea n-a mai fost modificată între timp (altfel 409, „S-a modificat între timp”). Pentru: achitare, cheltuială, avans, copil nou, mutare în grupă, arhivare. Anularea scrie în `audit_log`. Cu sincronizare: anularea e o revizie nouă, nu ștergerea reviziei.
3. **40a · Situația plăților.** Acțiuni pe rând (hover + focus): „Plată +” → `PaymentFormDrawer` ca la §3.4, cu restanța bifată; „SMS” → `SmsConfirmDialog mode="single"` cu șablonul implicit. După salvare, rândul se reîmprospătează fără reîncărcarea tabelului.

## 9. Îmbunătățiri 2, perioadă, rotunjire
Artboard: `Feedback 01-10.dc.html#41a…41f`.
1. **41f · Rotunjire la achitare** (face parte din §3.1/§3.4; fă-o odată cu ele). Setare pe filială `paymentRounding: { step: 1 | 10 | 0, tolerance: 5 }` (implicit: la leu, toleranță 5 lei). Suma precompletată = `roundTo(planEur × fxRate, step)`. La salvare: `amount` = suma încasată real; `amountEur = amount / fxRate`; dacă `|amount − datorat| ≤ tolerance`, luna e achitată și diferența se salvează în `roundingDiff` (nu e restanță, nu e avans); peste toleranță: lipsă = plată parțială, surplus = avans (F7). Raportul contabil arată suma încasată real; `roundingDiff` apare doar în fișa plății. Teste: +0,17, −1,83, −21,83, +78,17.
2. **41e · PeriodFilter** = PROMPT-7 §2 (§5.1 aici), după artboard: presetări Luna asta / Luna trecută / Ultimele 30 de zile / An școlar / Tot; datele De la–Până la; o dată schimbată → „Interval”. Închis: „Presetare  dd.mm – dd.mm ▾”. Poveste Storybook.
3. **41a · Ce lipsește în fișă.** `missingChildFields(child)` pură în `@shared/domain` (obligatorii: telefon părinte 1, plan, grupă, data nașterii; recomandate: părinte 2, IDNP, persoană autorizată). Bandă în `ChildProfileView` (galben, roz dacă lipsește un obligatoriu); clic pe pastilă → `ChildFormDrawer` cu focus pe câmp. Filtru „Date incomplete” în Copii.
4. **41b · Pontaj pe săptămână.** „Toți prezenți L–V” + „Copiază săpt. trecută” + pe rând „Prezent toată săptămâna”. Completează doar celulele goale, sare peste zile libere și concedii. O singură acțiune în `audit_log`, cu Anulează (§8.2).
5. **41c · Căutare globală.** Telefon: normalizat cu `normalizeMoldovanPhone`, potrivire pe sufix, pe părinte 1/2 și persoane autorizate. Sumă: dacă textul e numeric, achitări și cheltuieli cu suma exactă, max. 5, cele mai noi primele. Teste.
6. **41d · Mesaje de eroare.** `toUserError(err)` în `@shared/errors`: mapează codurile serverului (409 conflict de revizie, 426 versiune, rețea, BNM, sms.md, disc plin, backup) în `{ title, body, actions[] }`. Fără coduri HTTP pe ecran; codul tehnic în `audit_log`. Formularul nu se golește la eroare. Test de arhitectură: niciun `toast.error(err.message)` brut în `features/**`.

## 10. Telefoane: un singur format salvat
Decizie 02.10: în bază se salvează **E.164, `+373XXXXXXXX`**. Pe ecran se afișează **`069 123 456`**. Azi numerele sunt salvate fără 0 (`69123456`), iar `normalizeMoldovanPhone` (`src/shared/domain/phone-number.mjs`) le transformă doar la trimiterea SMS.
1. `formatMoldovanPhone(e164)` în `#shared/format` → `069 123 456`; numerele străine (`+40…`, `+7…`) rămân cu prefixul lor, grupate.
2. `PhoneInput` din `@shared/ui`: acceptă orice formă (`69123456`, `069123456`, `+373 69…`, `00373…`), afișează `069 123 456` pe măsură ce scrii, salvează `+373…`. Număr invalid: mesaj sub câmp „Număr incomplet: 8 cifre după 0”, fără blocarea salvării (fixul rămâne permis). Opțional, „Alt număr” pentru numere străine (cu prefix `+`).
3. Validare pe server: telefonul trece prin `normalizeMoldovanPhone` la salvare. Dacă e null și nu începe cu `+`, se salvează așa cum e, cu `phoneInvalid: true`, ca să apară în banda 41a.
4. Migrare `scripts/migrate/normalize-phones.mjs` cu `--dry-run`: părinți, persoane autorizate, personal. Raport: câte s-au transformat, câte au rămas invalide (cu copilul). Rulare reală doar după backup complet (§1.2). Sincronizarea primește reviziile ca pe orice editare.
5. Căutarea (41c) și SMS-ul folosesc forma salvată. Teste pe toate formele de intrare de mai sus.

## 11. Sincronizare pe ecrane, bon, restaurare
Artboard: `Feedback 01-10.dc.html#42a…42d`.
1. **42a/42b** fac parte din §5.2 (actualizări). `AppBanner` în shell, deasupra antetului, pe toate rutele: roz „Sincronizare oprită” (nu se închide, cu numărul de modificări în așteptare) și mint „Actualizare gata” (se închide până a doua zi). Pastila de sincronizare din antet arată aceeași stare. Pe profil Educator: „Cere actualizarea”.
2. **42c · Bon 58 mm.** Actualizează șablonul de bon (`PrintReceipt` / bon termic existent): 32 caractere/rând; rând plan „€ × curs = lei”, rând „Rotunjire” doar dacă `roundingDiff ≠ 0`, total ACHITAT în lei, metodă, echivalent €, curs BNM cu data, restanță rămasă, avans pe luna următoare. Test snapshot pe 4 cazuri: exact, rotunjit, parțial, cu avans.
3. **42d · Restaurare pe calculator nou** (după §1.2). La prima pornire fără date: alegere Backup / Sincronizare / De la zero; previzualizare din `manifest.json`; după restaurare, numără din nou și compară cu manifestul; diferență → nu deschide aplicația, păstrează fișierul, eroare 41d. Backup de versiune mai nouă: blocat. Backup vechi `.db`: avertisment. Ultimul pas: link-uri spre sincronizare, SMS, profil. Test de integrare pe calculator gol.

## 12. Pagina de start pe profil (face parte din §5.3)
Artboard: `Feedback 01-10.dc.html#43a…43b`. Ruta `/` pe profil Bazin = `TodayPage` (nu `DashboardPage`); `/dashboard` rămâne doar pe Complet (`ModuleGuard`).
- **Educator/Recepție (43a): în pauză (02.10).** Pe aceste profiluri, `/` deschide Prezența (primul modul permis), ca acum.
- **Bazin (43b):** ședințele de azi, ședința în curs evidențiată, „Marchează” → prezența la bazin pe ședință.
Poveste Storybook pentru 43b, cu date fictive.

## 6c. Acoperire Storybook (audit 02.10)
Toate componentele din `webapp/src/shared/ui/` au `.stories.tsx`. Lipsesc:
- `shared/attendance/AttendanceDot.tsx` (toate tipurile × 3 mărimi);
- `shared/sms/SmsSegmentCounter.tsx` (GSM-7, UCS-2 cu diacritice, 2+ segmente);
- `shared/sms/sms-status-badge.tsx` → `SmsStatusBadge` (toate stările).
Mută-le în `@shared/ui` dacă nu au logică de domeniu, altfel povestea stă lângă ele.
Test de arhitectură nou (R12): orice `export function [A-Z]…` dintr-un `.tsx` din `webapp/src/shared/**` are un `.stories.tsx` cu același nume. Componentele noi din acest prompt (§6) intră automat sub regulă.

## 13. Achitări mai rapide, liste, formulare
Artboard: `Feedback 01-10.dc.html#44a…44d`.
1. **Liste: cele mai noi primele.** Sortarea implicită în toate tabelele cu dată (Achitări, Cheltuieli, Vizite, Istoric, SMS, Avansuri, Salarii, Backup-uri) = data descrescător. Listele fără dată (Copii, Personal, Grupe) rămân alfabetic. Sortarea aleasă de utilizator se păstrează pe pagină (`usePersistedState`). Test pe fiecare listă: primul rând = cea mai nouă înregistrare.
2. **Copii: filtrele și căutarea rămân** la întoarcerea din fișă (stare în URL: `?q=&grupa=&pagina=`). Același lucru în Achitări și Cheltuieli.
3. **44a · Încasare rapidă.** `SearchSelect` în antetul Achitări, tasta N îl focusează. Caută după nume, telefon părinte (§10), nr. contract. Fiecare rezultat arată restanța și suma lunii curente. Frații apar sub copil (același telefon de părinte). Enter → `PaymentFormDrawer` precompletat (§3.4).
4. **44b · Frați într-o plată.** În `PaymentFormDrawer`, „+ Adaugă fratele” dacă există frați. Se salvează o achitare pe copil, cu `receiptGroupId` comun, și un singur bon (§11.2, rând pe copil). Total editabil; diferența se alocă de la cea mai veche lună bifată. Anularea (40b) anulează tot grupul.
5. **44c · Casa de azi.** Card deasupra listei de Achitări: totaluri pe metodă pentru ziua aleasă, clic = filtru, „Tipărește raportul zilei” (A4, `PrintTable`).
6. **44d · Reguli pentru formulare** în `Drawer`/`Dialog`, aplicate o dată în componentele de bază, nu pe fiecare formular: focus inițial (`initialFocus` sau primul câmp gol), Ctrl+Enter = submit, Esc → 40c, subsol fix, focus pe primul câmp cu eroare + număr de erori în subsol, `loading` pe butonul principal, fără drawer în drawer (test de arhitectură), lățimi 620/480/440 ca tokeni. Povești Storybook cu `play` pentru focus, Ctrl+Enter, Esc, eroare.

## 14. Istoric pe înregistrare, „Necesită atenție”
Artboard: `Feedback 01-10.dc.html#45a…45c`. Peste `audit_log` din §5.3 (36g); dacă §5.3 nu e gata, folosește istoricul local existent și adaugă câmpurile când vine `audit_log`.
1. **45a · Istoric după înregistrare.** `SearchSelect` în Istoric: copii, angajați, grupe, achitări (după sumă). Filtrul = `recordId` + înregistrările legate (achitările copilului, mutările lui de grupă), plus filtrele existente modul / calculator / perioadă. Rândul: dată, modul, acțiune, „înainte → după” doar pentru câmpurile schimbate, cine + calculator. Notele medicale: doar „notă medicală modificată”, fără conținut (test). Doar profil Complet.
2. **45b · Fișa → „Ultimele modificări”.** Ultimele 3 intrări pentru copil, în `ChildProfileView`, doar pe Complet; „Tot istoricul” → 45a cu copilul ales.
3. **45c · Necesită atenție.** `DashboardPage`: fiecare element are un buton care duce la ruta exactă, deja filtrată (`/situatia?filtru=restanta`, `/prezenta?data=…&grupa=…`, `/copii?filtru=incomplete`, `/copii?filtru=telefon-invalid`, `/administrare/backup`). Doar elementele cu acțiune; ordinea: bani, date, prezență, sistem; max. 5. Fără elemente → EmptyState `dashboard.attention.done`. Surse: restanțe (Situația), `missingChildFields` (§9.3), `phoneInvalid` (§10), prezență nemarcată (zile lucrătoare trecute), vârsta ultimei copii externe de backup (> 7 zile). Test pe fiecare sursă și pe link-ul ei.

## Notă: Personal
Personal (salarii, avansuri, stat de plată) nu e complet în cod. Nu se proiectează mai departe până nu e decis ce intră. Doar §4 (funcții) rămâne în acest prompt.

SMS automat (C9): **în pauză**, nu se construiește. SMS-ul rămâne manual, ca acum (De notificat → mesaj pregătit → operatorul decide).

## Ordinea
§0 → 1.1 → 1.2 → 2.1 → 2.2 → 2.3 → 3.1 → 3.2 → 3.3 → 3.4 → 3.5 → 10 → 4 → 8 → 9 → 11 → 13 → 14 → 5.1 → 5.2 → 5.3. §6 și §6b se fac odată cu fiecare componentă sau bug. §6 se face odată cu fiecare componentă.
După fiecare commit: `npm run check` și `cd webapp && npm run typecheck && npm test` verzi. Capturile doar pe copie (`npm run dev:copy`), cu build proaspăt. Orice migrare pe date reale: întâi backup complet (§1.2), apoi `--dry-run`, apoi rulare.
La fiecare punct închis, bifează în `FEEDBACK-01-10.md` (coloana „Stare”) cu hash-ul commitului.

## Te oprești doar dacă
Aceleași condiții ca în PROMPT-6. Întrebarea merge în `INTREBARI.md`, apoi treci mai departe.
