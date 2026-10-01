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
Criteriu: `npm run storybook:build` verde; fiecare componentă din §3b are cel puțin o poveste. Testul de arhitectură existent (dacă verifică povești) acoperă și componentele noi.

## Ordinea
§0 → 1.1 → 1.2 → 2.1 → 2.2 → 2.3 → 3.1 → 3.2 → 3.3 → 3.4 → 3.5 → 4 → 5.1 → 5.2 → 5.3. §6 se face odată cu fiecare componentă.
După fiecare commit: `npm run check` și `cd webapp && npm run typecheck && npm test` verzi. Capturile doar pe copie (`npm run dev:copy`), cu build proaspăt. Orice migrare pe date reale: întâi backup complet (§1.2), apoi `--dry-run`, apoi rulare.
La fiecare punct închis, bifează în `FEEDBACK-01-10.md` (coloana „Stare”) cu hash-ul commitului.

## Te oprești doar dacă
Aceleași condiții ca în PROMPT-6. Întrebarea merge în `INTREBARI.md`, apoi treci mai departe.
