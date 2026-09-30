# Pentru Claude Code — după sync 29.09, 19:56 (HEAD 40826c2)

**Harta completă design ↔ cod, pe ecrane: `docs/design/AUDIT-DESIGN-COD.md`.** Lucrează în ordinea din secțiunea 2 a acelui fișier (A → B → C). Detaliile pentru fiecare punct sunt mai jos.

Bună treabă pe coada A3c-fix → A8. Mai sunt 4 lucruri de reparat și câteva decizii de aplicat. Lucrează în ordinea de mai jos. După fiecare punct: `npm run check` + webapp typecheck/test, commit, treci mai departe.

## 0. Pachetul de design nu e în repo
`docs/design/` are încă versiunile vechi: `Prezenta.dc.html` (46,9 KB, finalul are 47,7 KB), `Formulare.dc.html` (31 KB, finalul are 42 KB), `Dashboard.dc.html` (16,7 KB, finalul are 18,4 KB) și `Copii.dc.html`. Lipsesc și `TOKENS.md`, `ECRANE.md`, `DECIZII.md` și `COMPONENTE.md`.
- Copiază tot `design_final_startica/` peste `docs/design/`. Păstrează `COADA-DE-LUCRU.md`, `INTREBARI.md`, `RASPUNSURI.md` și `AUDIT-UI-2026-09-28.md`.
- Adaugă `CLAUDE-md-snippet.md` în `CLAUDE.md` din rădăcină.
- Fă un commit separat: `docs(design): pachet final`.
- A2, A3c, A3e și A3b au fost construite din text, fără artboard-urile finale. După ce fișierele noi sunt în repo, compară-le cu `Formulare.dc.html#15a/#15b` și `Prezenta.dc.html#18a/#18b` și corectează ce diferă.

## 1. COADA-DE-LUCRU.md se contrazice la B3
Secțiunea de închidere spune „A1–A8 și B1–B3 sunt DONE”. De fapt, la B3 s-a făcut doar diagnosticul: `Payment.service`, kind-ul `services`, fila Servicii și migrarea nu există. Corectează textul în „B3 — doar diagnostic, așteaptă răspunsurile de mai jos”.

## 2. Prezența · Luna — weekendul nu acoperă tot rândul
În `MonthView.module.css`, `.dataRow` are `padding: 7px 16px`, iar `.offCell` își colorează doar celula. Rămân 7 px necolorați sus și jos la fiecare rând, așa că coloana de weekend iese întreruptă, nu continuă (18b cere „fundal `--off-day` pe toată înălțimea rândului”).
Fix: mută padding-ul vertical din rând în celule (`.dataRow { padding: 0 16px }`, iar celulele, numele și coloana Zile primesc `padding: 7px 0`). Același lucru pentru `.headRow` (10px) și `.footRow` (9px), ca weekendul să fie o bandă continuă de sus până jos.

## 3. Prezența · Ziua — 3 detalii față de 18a
- `.counter:last-of-type` pune bordura după tipul elementului, nu după clasă. Dacă `.presentRate` are același tag ca un contor, al 4-lea contor păstrează linia din dreapta. Verifică. Dacă e cazul, folosește `:nth-last-child` sau scoate bordura cu o clasă.
- Contorul Absent și starea „Absent” de pe placă sunt `--raspberry`. Spec-ul cere `-ink`-ul stării, adică `--pink-ink` (#b0284f). Punctul rămâne `--raspberry`.
- `.sectionMeta` e `--muted`. Spec-ul cere `#5b666e` (același text secundar pe care l-ai corectat la Pontaj în A8).

## 4. Achitare nouă — repartizarea manuală a rămas pe stilul vechi
În `PaymentFormDrawer.module.css`, `.allocationField input` are încă `padding 6/8` și 13px. Aliniază-l la celelalte câmpuri: `11px 14px`, 15px/600, radius 12.

## 4b. Încărcare 21a/21b/21c — `app/shell/StartupScreen.tsx` + `.module.css`
Referință: `Incarcare.dc.html#21a`, `#21b`, `#21c`.
- **21a, cercuri:** lipsesc 2 din cele 4. Adaugă `--pink` 60px (`right:260px; top:90px`) și `--mint` 40px (`left:220px; bottom:120px`).
- **21a, rândul de sub bară:** pasul curent se termină cu „…” („Citesc baza de date…”). La 100% scrie „Gata”, nu numele ultimului pas.
- **21a, bara:** acum sare în trepte (0/25/50/75/100 sau 0/33/67/100 fără sincronizare). Fă-o să avanseze lent în interiorul pasului curent, până aproape de pragul următor (de ex. cu maximum 90% din intervalul pasului), și să sară la prag când pasul s-a terminat. Procentul afișat urmează bara.
- **21a, subsol:** „Filiala Buiucani · v2.0.0”. Acum lipsește „v”.
- **21a, raze:** bara are 4px, cardul cu pași are 16px. Verifică dacă `--radius-xs` și `--radius-md-lg` dau exact aceste valori.
- **21b, între pagini:** lipsește bara de sus de 3px (fundal `--orange-soft`, segment `--orange` de 40% lățime, animat stânga→dreapta în 1,1 s). Apare doar dacă noile date întârzie peste 300 ms. Meniul și antetul rămân pe loc, iar conținutul arată scheletul gri (Skeleton-ul există deja).
- **21c, textul:** decizia provizorie din `INTREBARI.md` („fără server comun, fără «Lucrez fără legătură»”) nu mai e valabilă, pentru că sincronizarea există acum. Când sincronizarea e configurată și serverul nu răspunde: textul din 21c („Serverul de sincronizare nu răspunde. Puteți lucra cu datele salvate pe acest calculator; modificările se trimit când revine legătura.”), butonul principal „Lucrez fără legătură” (deschide aplicația în modul offline), apoi „Încearcă din nou” (outline) și dedesubt „Ultima sincronizare: <când>” 12px `--subtle`. Fără sincronizare configurată, rămâne textul actual despre baza locală.
- Actualizează `INTREBARI.md` la punctul „Încărcare (punctul 12)”.

## 4c. SMS — mesaj personalizat și SMS nou
Referință: `Situatia.dc.html#7c`/`#7e` (Notifică, text editabil), `Sms.dc.html#11c`/`#11d` (SMS nou, NOU).
- **Notifică (7c/7e):** `SmsConfirmDialog` în modul `single` arată acum textul doar ca bulă, fără editare. Adaugă segmented „Șablon” (șabloanele din `useSmsTemplates` + „Personalizat”) și un `textarea` editabil (132px, border 1.5px `--orange`, radius 16). Sub el: toggle „Fără diacritice” și `SmsSegmentCounter`. Dacă textul diferă de șablonul redat, se trimite cu `templateId: null`, deci apare în istoric ca „Personalizat”. Modul `bulk` rămâne needitabil.
- **SMS nou (11c/11d):** buton primar „+ SMS nou” în antetul Notificări → Mesaje SMS. Deschide un dialog de 560px cu segmented „Către: Din aplicație | Alt număr”.
  - *Din aplicație:* `SearchSelect` peste părinți (ambii, din `children`) și angajați (`staff`). Cardul destinatarului arată avatar, nume, telefon, „părintele lui X” sau funcția și „Schimbă”. Chip-urile „Pornește de la” conțin: Text liber + toate șabloanele. Variabilele se completează pentru copilul ales.
  - *Alt număr:* câmp telefon validat cu `normalizeMoldovanPhone` (sub el apare „✓ +373 …” sau eroarea) și câmp „Nume · opțional” (doar pentru istoric). Aici apar doar șabloanele fără {copil}/{rest}/{achitat}, cu nota din 11d.
  - Bifa „Salvează textul ca șablon nou” apare doar la Text liber și creează șablonul prin `/api/sms-template-save`.
  - Backend: `/api/sms-send` acceptă deja `{phone, text}`. Adaugă `SmsSource = 'manual'`, acceptă `childId: null` + `recipientName`, iar în istoric coloana „pentru” arată „—”. Se aplică aceleași limite (limită lunară, sold) și același `requestId`.
- Teste: textul editat se trimite ca „Personalizat”; număr invalid → buton dezactivat; „Alt număr” ascunde șabloanele cu variabile de copil; mesajul apare în 11a.

## 4d. Fișa angajatului: salariul după PIN (23m, NOU)
Referință: `Personal.dc.html#23m` (+ `#23j`, `#23d`).
- „Vezi cu PIN →” de pe cardul Salariu nu mai navighează la `/personal?tab=salarii`. Deschide dialogul PIN 23d peste fișă. După PIN, fișa rămâne pe loc.
- Deblocarea e comună cu fila Salarii: aceeași stare, același timeout de 10 minute. Dacă salariile sunt deja deschise, fișa le arată direct.
- Deschis: bandă mint „Salariile sunt deschise · se blochează singure după 10 minute fără activitate” + „Blochează”. Cardul Salariu devine `--pink-soft`, cu suma (Baloo 26) și sub ea „<fix lunar/pe oră/bazin> · rămas X lei”. Sub pontaj apare cardul „Salariu · ultimele luni” (3 luni: Salariu, Avansuri, Plătit, Stare) + „Toate salariile →”.
- „Blochează” ascunde suma și pe fișă, și pe fila Salarii.
- Test: fără PIN nu apare nicio sumă în DOM; după PIN apare; după „Blochează” dispare iar.

## 4e. Design system complet (prioritar, înainte de funcțiile noi)
**Planul, regulile verificate automat (R1–R8) și evidența pe module sunt în `docs/design/DS-IMPLEMENTARE.md`. Regula de bază: ecranele se construiesc DOAR din componente reutilizabile din `@shared/ui`. Fără controale HTML brute, culori literale sau CSS care dublează o componentă.**

Zece pagini de referință: `DS Fundamente 2` (33), `DS Componente 2` (34), `DS Fundamente` (26), `Componente formular` (25), `DS Tabel si filtre` (27), `DS Componente` (28), `DS Incarcare si stari` (29), `DS Date si grafice` (30), `DS Tipare de pagina` (31), `DS Diverse` (32). Specul e în `COMPONENTE.md` §0–§0i. Ordinea de lucru:
1. **Tokeni** lipsă (26, §0c) + **tokeni de mișcare** și **Lucide** (`lucide-react`, componenta `Icon`, 33, §0h). Înlocuiește toate caracterele-iconiță din cod. Formatele noi din `@shared/format`.
2. **Câmpuri de formular** (25, §0), apoi migrarea celor ~200 de câmpuri brute.
3. **Tabel și filtre** (27, §0b): `FilterMenu`, `PeriodFilter`, `ActiveFilters`, `TableFooter`, `ColumnMenu`/densitate, tipuri de celulă, stări de rând, Shift+clic. Migrează fiecare listă pe ele. Nu mai rămâne niciun `<select>` în bare.
4. **Restul** (28, §0c): `Button danger/loading`, `IconButton`, `Notice`, `Tabs`, `Breadcrumb`, `Tooltip`, `Popover` de bază, `ProgressBar`, `LoadingBar`.
5. **Încărcare și stări** (29, §0d): `Spinner`, `useDelayedLoading` cu `minVisible`, `loading`/`error` pe fiecare componentă, `ProgressToast`, `StepList`, `ErrorState`/`InlineError`, comenzi optimiste cu revenire la eroare. Se face împreună cu fiecare componentă de la pașii 2–4, nu la final.
6. **Date și grafice, tipare de pagină, diverse** (30–32, §0e–§0g): `DatePicker`/`MonthPicker`/`TimePicker`, `BarChart`, `Heatmap`, `DayGrid` (unește Prezența Luna, Pontaj și Concedii), `WeekGrid`, `MonthCalendar`, `Board` + `@shared/dnd`, `MasterDetail`, `Wizard`, `Timeline`/`NoteList`, `Disclosure`, `NavRail` + responsive, `GlobalSearch`, `SyncStatusCard` în 5 stări, `TonePicker`, `SmsPreview`, `Kbd`, piesele de tipar, `TagInput`/`NumberStepper`/`Slider`/`CopyField`. Fiecare vine cu stările de încărcare și eroare de la §0d.
7. **Componente 2** (34, §0i): `AppBanner`, `AvatarGroup`, `SplitButton`, `InlineEdit`, `DiffTable`, `LockedContent`/`usePinLock`, `UnsavedChangesDialog`/`useUnsavedGuard`, `DocumentCard`, `HoverCard`, `MultiSelect`, `TodoCard`/`TaskRow`, `PrintOptionsDialog`. Accesibilitatea din 33f se verifică la fiecare componentă (test cu `axe` în vitest).
8. Toate apar în `/design-system` cu stările lor (inclusiv loading/error). Fiecare pas are testul lui.

### Detaliu câmpuri de formular
Referință: `Componente formular.dc.html#25a–25f`, specul complet în `COMPONENTE.md` §0.
- Construiește `Field`, `TextInput`, `Select`, `NumberInput`, `DateInput`, `MonthInput`, `PhoneInput`, `TextArea`, `FileInput`, `PinInput`, `Checkbox`, `RadioGroup`, `FormSection`, `FormGrid`, plus `size="sm"` și `SegmentedControl size="field"`, în `@shared/ui`. Fiecare are test și secțiune în `/design-system` cu toate cele 6 stări.
- Migrează cele ~200 de câmpuri brute din `features/`, câte un commit pe modul. Șterge CSS-ul local `.field`.
- Adaugă un test de arhitectură care interzice `<input>/<select>/<textarea>` brute în `features/**`.
- Funcțiile noi (4c, 4d, 11c/11d, 23m) se construiesc direct cu aceste piese.

## 5. Decizii (trece-le în RASPUNSURI.md și aplică-le)
Completează răspunsurile înainte să trimiți:
- **Salariul în Cheltuieli:** descrierea rămâne `Salariu <lună>`, fără nume. ☐ da ☐ vreau numele
- **Salariul pe fișa angajatului:** ☑ suma apare pe fișă după PIN (vezi 4d)
- **„Antrenor:” cu mai mulți antrenori:** ☐ virgulă (cum e acum) ☐ primul + „și încă N”
- **Notificări:** ☐ Telegram peste tot (atunci bifa „Trimite confirmare părintelui” din 15b se construiește pe coada din De notificat) ☐ rămâne SMS
- **B1, cele 7 plăți „Mixtă/De verificat”:** ☐ (a) rămân în De rezolvat până le împart manual ☐ (b) provizoriu integral pe Cash
- **B3, cele 143 de „cheltuieli” Bazin (113.250 lei):**
  - Sunt toate încasări? ☐ da ☐ nu (le verific eu)
  - Metoda la migrare: ☐ Cash ☐ necompletat, rezolv manual
  - Perioada: ☐ și iunie–iulie retroactiv (notează diferența pe fiecare lună) ☐ doar de acum înainte
- **Contrast buton primar (alb pe `--orange` = 2,4, sub WCAG):** ☐ `--orange-strong` mai închis pentru fundaluri cu text alb ☐ text slate pe portocaliu ☐ excepție de brand asumată
- **A6, pragul „Posibil” ≥ 2:** ☐ ok ☐ altul: ___
- **A7, funcții noi:**
  - „Probleme la backup”: ☐ construiește ☐ scoate din design
  - „Zonă periculoasă”: ☑ scoasă din design, nu se construiește
  - Import copii din CSV: ☐ construiește ☐ rămâne doar Excel
- **Folderul `Startica V2/` + `Startica V2.zip` din rădăcina repo-ului:** sunt resturi, șterge-le.

## 6. Rămâne pentru mai târziu
- **A9 (Documente pe fișă):** amânat. Planul tehnic se scrie întâi.
- **Plătitori reținuți cu IBAN (spec 28 §5):** amânat odată cu A9.
- **`groupTone()` vs `boardTone()`:** o grupă cu ton ales manual arată altfel în Tablă decât în Copii, Achitări și Prezența. Unifică: `groupTone()` citește întâi `group.tone`.
