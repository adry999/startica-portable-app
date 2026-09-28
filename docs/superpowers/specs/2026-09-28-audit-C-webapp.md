# Audit C — webapp (cod scris în ultimele ~2 zile) — 28 septembrie 2026

Branch `master-v2` @ `314a879`, arbore curat. Audit doar-citire, pe corectitudinea codului (nu conformitate vizuală — aceea e în `docs/design/AUDIT-UI-2026-09-28.md`). Nu se suprapune cu auditurile A (backend core/filiale/sync) și B (backend features): singurul fișier backend citit e `src/core/web/app-session-store.mjs`, pentru că webapp-ul îl rulează direct.

**Scop citit integral (linie cu linie):** `webapp/src/app/` (App.tsx, shell/*), `webapp/src/shared/{api,sms,personal,attendance,ui,state}/`, `webapp/src/features/{personal,attendance,report,status,notify,notifications,payments,expenses,backup,groups,children,stickers,sync}/` — toate fișierele sursă (~33 000 linii), plus `webapp/src/design-system/`. Teste: citite integral `useBranchSwitch`, `SmsProviderCard`, `useSyncStatus`, `TimesheetView`, `SalariesView`, `useExcelTransfer`, `App`, `StartupScreen`, `dirty-forms`, `Drawer`, `design-system`; pe fragmente `PaymentsPage`, `ExpensesPage`, `StatusPage`, `AttendancePage`, `StaffFormDrawer`; restul doar prin `grep`.

## 1. Baseline și metodă de verificare

| Verificare | Rezultat |
|---|---|
| `cd webapp && npx tsc --noEmit` | verde |
| `cd webapp && npx vitest run` (135 fișiere, 672 teste) | **1 eșuat, instabil**: `AttendancePage.test.tsx › „Motivat” … același POST` (2 POST-uri în loc de 1) a picat în rularea completă (82 s), dar trece 3/3 rulat izolat — vezi M14 |
| Reproducere empirică C2 | un test temporar (scris în `webapp/src/features/expenses/`, rulat, **șters imediat**, `git status` curat) a confirmat: a doua „Cheltuială nouă” vine precompletată cu prima (`Suma=250`, `Descriere=Detergenți`, `readDirtyForms().length === 1` înainte de orice tastă); la fel a doua „Achitare nouă” după navigarea `/achitari/nou → /achitari → /achitari/nou` (`Cash=600`, plătitorul anterior). Tot acolo am exclus un fals-pozitiv: drawer-ul de achitare pare deschis imediat după toast, dar se închide în <3 s — e `startTransition` din react-router v7, nu un bug |

Legendă severitate: **critic** = pierdere/corupere de date sau bani; **major** = comportament greșit vizibil sau blocaj; **minor** = risc mic, datorie tehnică, a11y. „(neverificat)” = dedus din cod, fără reproducere.

## 2. Constatări

### Critic

**C1 — „Salvează și schimbă” schimbă filiala deși salvarea a eșuat sau n-a avut loc.**
`useBranchSwitch.ts:123-131` comută filiala dacă `form.save()` întoarce `true`. Dar:
- `PaymentFormDrawer.tsx:121-139` întoarce `true` după `await onSubmit(...)`, iar `PaymentsPage.tsx:103-124` (`submitPaymentForm`) prinde orice eroare a lui `session.mutate` și o arată doar ca toast → `handleSubmit` întoarce `true`. Același lucru când `createPayment` întoarce `false` (duplicat refuzat la `window.confirm`).
- `ChildFormDrawer.tsx:30-39` + `ChildrenPage.tsx:190-204` — identic (eroare înghițită → `true`).
- `ExpenseFormDrawer.tsx:33-36` — `submitForm` apelează `onSubmit` fire-and-forget și întoarce `Promise.resolve(true)` **înainte** ca mutația să înceapă măcar; `ExpensesPage.test.tsx:254` codifică exact acest comportament (`await expect(dirtyForm.save()).resolves.toBe(true)`).
Scenariu: operatorul are o achitare completată, serverul răspunde 409/400, alege „Salvează și schimbă” → toast de eroare + `window.location.replace(...)` în aceeași secundă → formularul e pierdut, iar utilizatorul a văzut un buton care spunea că salvează.
Fix (o linie pe fișier): `onSubmit` să întoarcă `Promise<boolean>` (true doar după `mutate` reușit) sau să re-arunce; drawer-ele să întoarcă rezultatul, `ExpenseFormDrawer.submitForm` să facă `await`. Testul din `ExpensesPage.test.tsx:240-255` trebuie inversat (save() false când mutația pică).

**C2 — Starea drawer-ului „nou” supraviețuiește între deschideri: a doua achitare/cheltuială/fișă vine precompletată cu prima (verificat empiric).**
`PaymentsPage.tsx:168`, `ExpensesPage.tsx:249`, `ChildrenPage.tsx:283` folosesc `key={target === 'new' || target === null ? 'new' : id}` → aceeași instanță React pentru „închis” și „nou”, deci `useState` inițial nu se mai rulează. După ce salvezi o achitare de 600 lei și apeși din nou „+ Achitare nouă”, formularul are 600 lei, același plătitor, aceleași alocări, și e deja `dirty` (13b se declanșează pe un formular pe care operatorul nu l-a atins). Risc direct de achitare dublată la un clic grăbit pe Salvează.
Aceeași clasă, fără niciun `key`:
- `StaffProfilePage.tsx:210` — `StaffFormDrawer` e montat cu `target=null`, deci `defaultValues(null)` se calculează o singură dată; „Editează fișa” deschide un formular **gol** (`since` = azi, `branchIds=[]`), iar la salvare `id = editing.id` și `mode='update'` → fișa angajatului e suprascrisă cu ce a retastat operatorul (data angajării devine azi). `StaffFormDrawer.test.tsx` testează doar `target="new"`.
- `SalariesView.tsx:187-198` — `SalaryFormDrawer`/`AdvanceFormDrawer` fără `key` → suma/modul de la angajatul anterior rămân în formular când îl deschizi pentru altul (bani).
- `LeavesView.tsx:99-104`, `TeamView.tsx:208` (`StaffFormDrawer` „nou” după „nou”).
Fix: `key={formTarget === null ? 'closed' : formTarget === 'new' ? \`new-${openCount}\` : formTarget.id}` (sau montează drawer-ul doar când `target !== null`, cum face deja `ChildProfileView.tsx:193-199` cu `key={editDrawerOpen ? child.id : 'closed'}`); pentru SalaryForm/AdvanceForm/LeaveForm `key={staff?.id ?? 'closed'}`.

### Major

**M1 — „Anulează” din toast-ul de arhivare rulează `session.mutate` în paralel → doar prima anulare reușește, restul aruncă nefolosit.**
`PaymentsPage.tsx:280`, `ExpensesPage.tsx:142`, `ChildrenPage.tsx:101-109`: `Promise.all(targets.map(... mutate ...))`. `app-session-store.mjs:176` aruncă „Verifică operațiunea anterioară” dacă `pending || busy` → din 3 achitări arhivate, 1 se dezarhivează, 2 rămân arhivate, fără toast (promisiunea e `void`). Fix: buclă `for … await` cu try/catch + toast (ca `archiveMany`), sau un endpoint batch.

**M2 — Butonul „Rezolvă” din cardul de sincronizare duce pe o rută inexistentă.**
`AppShell.tsx:47` → `navigate('/conflicte')`; `App.tsx:157` are `<Route path="*" element={<Navigate to="/" />}>` → utilizatorul cu conflicte ajunge pe Dashboard. Fix: până există ecranul, `goToSyncTab` (ca la `revoked`) sau fără `onAction`.

**M3 — `load()` și `mutate()` nu se exclud reciproc pe `loading` → o citire veche poate suprascrie o revizie nouă (neverificat, dedus).**
`app-session-store.mjs:126-131` (`load` refuză doar `busy/settingsBusy`) și `:174-178` (`mutate` refuză doar `pending/busy`). Scenariu: `records-changed` prin SSE pornește `reloadRecords()` (`session.ts:89-92`) → `/api/state` e lent; operatorul salvează o achitare → `mutate` reușește, `revision=N+1`; răspunsul întârziat al lui `/api/state` (revizia N) ajunge și `accept()` rescrie `state.state`/`revision` cu snapshot-ul vechi → achitarea „dispare” din listă și următoarea mutație pleacă cu baza N → 409. Fix: `mutate` aruncă și când `state.loading`; `load` ignoră răspunsul dacă `state.revision` a crescut între timp (token de secvență).

**M4 — Tipărirea pornește înainte ca antetul grădiniței să fie încărcat.**
`StatusPage.tsx:248-257` face `setTimeout(window.print, 0)` în momentul în care montează `StatusPrint`, iar `StatusPrint.tsx:19` abia atunci apelează `useKindergarten()` (fetch `/api/kindergarten`) → foaia tipărită iese cu „Startica” în loc de denumirea/IDNO-ul grădiniței. Identic `TimesheetView.tsx:27-36` + `TimesheetPrint.tsx:27`. Fix: `useKindergarten()` în pagină (e deja montată) și tipărește doar când `kindergarten.ready`; sau `StatusPrint`/`TimesheetPrint` primesc `kindergarten` ca prop.

**M5 — „Tipărește” din Personal › Pontaj tipărește imediat, peste dialogul de opțiuni.**
`PersonalPage.tsx:59` setează `printOptions={scope:'all'}`; în `TimesheetView.tsx:27-36` orice `printOptions` non-null declanșează `window.print()`, iar `:149-155` deschide `TimesheetPrintDialog` cu `open={printOptions !== null}` → dialogul de tipărire al browserului și dialogul „Ce tipăresc?” apar simultan; după `afterprint` dialogul se închide, iar confirmarea lui ar tipări a doua oară. Fix: stare separată `printDialogOpen` (ca în `StatusPage.tsx:156-157`).

**M6 — Hook-uri de citire fără `catch` → „Se încarcă…” la nesfârșit + unhandled rejection.**
- `features/backup/useExchangeRates.ts:52-63` — `Promise.all` fără try/catch; dacă `/api/plan-presets` pică, fila „Planuri și curs” rămâne pe „Se încarcă cursul valutar…”.
- `features/backup/useKindergarten.ts:35-40` — fila „Grădinița” rămâne pe `LoadingState`.
- `features/backup/useBranches.ts:20-29` — fila „Filiale” la fel.
- `features/backup/useExcelTransfer.ts:58-82` (`pickFile`) — orice eroare de parsare/`/api/import-preview` e aruncată; `ExcelImportDialog.tsx:17` o cheamă cu `void` → operatorul vede doar că „Se previzualizează…” dispare, fără mesaj.
Fix: try/catch → `status: 'failed'` + `failureMessage`, randat ca la celelalte ecrane.

**M7 — Salvări fără try/catch: eroarea nu ajunge la utilizator.**
`SmsTemplatesPanel.tsx:73-84` (`save`, `confirmDelete`), `SmsProviderCard.tsx:36-49` (`save`, `confirmTest`) și `:149` (`sms.disconnect()`): un 400 de la `/api/sms-template-save` sau `/api/sms-connect` (cheie invalidă) lasă butonul re-activat și nimic pe ecran; `sms.data.lastError` nu se actualizează pentru că `refresh()` nu mai rulează. Fix: try/catch + `toast.show`, ca în `NotificationsPage.tsx:41-67`.

**M8 — Salarii: după un avans lista rămâne veche; starea `locked` nu e tratată.**
`AdvanceFormDrawer.tsx:31` scrie prin `session.mutate`, dar `SalariesView.tsx:194-198` nu apelează `salaries.reload()` → coloanele „Avansuri”/„Net” și cardurile arată sume vechi până la remontare; operatorul poate plăti salariul brut fără avansul scăzut vizibil. `useSalaries.ts:15` produce `status: 'locked'` la 403 (PIN expirat după 10 min), dar `SalariesView.tsx:40-41` nu-l tratează → ecranul rămâne cu rândurile vechi, iar „Plătește” cade cu toast 403. Fix: `onSaved` → `reload()`; `locked` → afișează din nou `PinGate` (`pin.reload()`).

**M9 — Zile de naștere: eșecul sesiunii e afișat ca „Nicio zi de naștere în luna aceasta”.**
`BirthdaysPage.tsx:94-135` tratează doar `status === 'loading'`; `useBirthdays` întoarce `failed` cu `weeks: []`, `list: []`. Fix: ramură `failed` cu `failureMessage`, ca în celelalte ecrane.

**M10 — `obligation()` chemată fără `rates` în unele ecrane și cu `rates` în altele → copiii cu taxă EUR arată diferit de la un ecran la altul (neverificat pe date reale).**
`useStatus.ts:130`, `useSchoolYearStatus.ts:122`, `usePaymentReceipt.ts:110` trec `rates`; `useNotify.ts:111`, `useChildren.ts:95`, `useChildProfile.ts:62`, `SmsTemplatesPanel.tsx:91` nu. `tuition-obligation.mjs:68-69`: `paid = sumEntriesInCurrency(entries, feeCurrency, rates)`; `paid === null` → `unknown` → „De verificat”. Scenariu: un copil EUR cu plăți în lei apare „Restanță” în Situația plăților și „De verificat” (deci nenotificabil) în De notificat / lista Copii. Fix: `useExchangeRates()` + `rates` în cele 4 locuri (sau un `useObligations(month)` comun în `@shared`).

**M11 — Cereri în zbor nesincronizate la schimbarea interogării: răspunsul vechi îl poate suprascrie pe cel nou.**
`useAttendance.ts:47-68` (pași rapizi cu `DayStepper`: ziua afișată ≠ datele afișate), `useTimesheet.ts:36-56`, `useSmsLog.ts:81-109` (în plus, `refresh-statuses` de la montare reîncarcă `period`-ul capturat la montare peste perioada aleasă între timp), `useSmsStatus/useTelegramStatus/useSmsTemplates/useSmsLastNotified` (`cancelled` protejează doar `catch`, nu `setData`). Fix: token de cerere (`const id = ++requestSeq; … if (id !== requestSeq) return;`) sau `AbortController` în cleanup.

**M12 — `Salvează` din drawer-ul de cheltuială fără gardă de dublu-clic.**
`ExpenseFormDrawer.tsx:33-53` nu are `submitting`; două clicuri rapide → a doua `mutate` aruncă „Verifică operațiunea anterioară” → toast de eroare deși prima salvare a reușit. Fix: `submitting` ca în `PaymentFormDrawer`/`ChildFormDrawer`. (Butonul din footer nu e `type="submit"` → sare validarea HTML `required`; nu produce înregistrări goale pentru că `normalizeRecord` aruncă — verificat — dar mesajul e cel tehnic, nu cel de formular.)

**M13 — Toast-ul „Înapoi la <filială>” ocolește toate gardele de comutare.**
`App.tsx:70-73` apelează direct `performBranchSwitch(...)` cu `location.pathname` capturat la montare: nu verifică `busy/pending`, nu verifică formulare nesalvate (13b) și, dacă operatorul a navigat în cele 6 s cât trăiește toast-ul, îl întoarce pe modulul de la montare. Fix: expune `requestSwitch` din `useBranchSwitch` (montat în `AppShell`) și folosește-l aici.

**M14 — `AttendancePage.test.tsx:128-147` e instabil** (a picat în suita completă, trece izolat): debounce real de 400 ms + `userEvent` fără timere false; al doilea POST vine dintr-un `flush` la 400 ms de la primul clic, înainte de „Salvează” din popover. Fix: `vi.useFakeTimers()` + `advanceTimersByTimeAsync` ca în `TimesheetView.test.tsx:84-92`.

### Minor

- **m1 (a11y)** — `Drawer.tsx`, `ConfirmDeleteDialog.tsx`, `BranchSwitchDialog.tsx`, `SmsConfirmDialog.tsx`, `PrintOptionsDialog.tsx`, `TimesheetPrintDialog.tsx`: `aria-modal="true"` fără mutarea focusului în dialog, fără trap, fără restaurarea focusului la închidere; `PrintOptionsDialog`/`TimesheetPrintDialog` nu se închid la Escape; `BranchSelector.tsx:89` dropdown `role="dialog"` fără focus. Fix: un `useDialogFocus(ref, open)` în `@shared/ui` folosit de toate.
- **m2** — `Toast.tsx:34` `setTimeout` neanulat la demontare; `:38` valoarea contextului e un obiect nou la fiecare randare → toți consumatorii `useToast` se re-randează la fiecare toast, iar `useBranchSwitch.ts:92,111` recreează callback-urile. Fix: `useMemo`/`useCallback` pentru `show`, `useRef` pentru timere.
- **m3** — `useTopbarActions(<JSX/>)` primește un nod nou la fiecare randare → `setActions` + re-randarea `Topbar` la fiecare tastă în căutarea din Achitări/Cheltuieli/Situația. Nu e greșit, dar `TopbarActions.tsx:42` ar putea accepta `deps`.
- **m4 (perf)** — `StatusPage.tsx:176-201` (`planSmsBatch` pe toți restanțierii, plus varianta An școlar) și `SmsTemplatesPanel.tsx:89-104` (`evaluateChildrenForMonth` pe toți copiii) rulează la fiecare tastă. `ReportExportDrawer.tsx:81` construiește tot raportul la fiecare randare a `ReportPage`, chiar cu panoul închis; `useAccountingReport.ts:144` fără memo. Fix: `useMemo`.
- **m5** — `PaymentReceipt.tsx:160-161` versiune hard-codată „v2.0.0” (există `session.state.version`).
- **m6** — `PaymentReceiptThermal.tsx:99` arată `dueLabel` brut (`2026-09-10`), A5 îl formatează; `ChildProfileView.tsx:234-237` lunile alocărilor brute (`2026-09`).
- **m7** — `sync-status.ts:63-68`: `pushing && pending === 0` → „Se trimit 0 modificări…”.
- **m8** — `usePayments.ts:125-143` citește `records` din closure-ul randării în care s-a apăsat: „Anulează” după arhivare rescrie achitarea cu snapshot-ul de dinainte (pierde un `receiptNumber` atribuit între timp). Fix: citește `session.state.state` la momentul apelului.
- **m9** — `SmsProviderCard.tsx:25-30`: efectul resetează `sender`/limita la orice schimbare a `sms.data` (după „Trimite SMS de test” se pierde expeditorul tastat); `tokenRevealed` nu revine pe `false` după salvare.
- **m10 (13b)** — formulare cu date nesalvate fără `useDirtyForm`: `RolesDrawer`, `StaffFormDrawer`, `LeaveFormDrawer`, `SalaryFormDrawer`, `AdvanceFormDrawer` (drawer-e), plus `GroupEditor`/`GroupTeamCard` (`GroupsPage.tsx:222-339`, `GroupTeamCard.tsx`), `KindergartenSettings`, `ExchangeRateSettings` (planurile), `SmsTemplatesPanel`. Registrul e folosit doar de Payment/Expense/Child/Group/Visit/Enroll (`grep useDirtyForm(`).
- **m11** — `usePersonal.ts:99-102` pornește `load()` (cu `notify()` sincron) în timpul randării; un eșec nu se mai reîncearcă (`bootstrapped` rămâne `true`) — toate ecranele Personal rămân pe eroare până la reload complet.
- **m12** — `StartupScreen`: „Încearcă din nou” nu resetează `startupTimings.startedAt` → duratele pașilor se măsoară de la prima încercare. `AttendancePage.tsx:22` `CURRENT_MONTH` e constantă de modul (se învechește după miezul nopții); `useAttendanceDay` și `useAttendanceMonth` fac ambele fetch indiferent de mod.
- **m13** — `LeavesView.tsx:13-19` `monthsTouched` compară doar lunile → un concediu dec→ian nu apare deloc pe linie.
- **m14** — `PaymentsPage.tsx:338` `onRowClick` e setat și pentru rândurile neasociate (tabIndex/cursor fără efect); `useBranchSwitch.saveAndSwitch` nu prinde un `save()` care aruncă (dialogul rămâne deschis, fără mesaj).
- **m15** — `app-session-store.mjs:114-117`: dacă reîmprospătarea token-ului la 403 pică, eroarea ei o înlocuiește pe cea originală; `useSyncStatus.ts:100` `EventSource` singleton niciodată închis (acceptabil, dar `reloadRecords` sare reîncărcarea când `busy/loading` și nimeni nu o reprogramează).
- **m16 (duplicate — candidate pentru `@shared`)** — `initials()` ×6 (`shared/personal/staff-labels.ts`, `groups/useGroups.ts:81`, `children/childrenColumns.tsx:14`, `dashboard/DashboardPage.tsx:302`, `payments/PaymentReceipt.tsx:12`, `attendance/useAttendanceDay.ts:47`); `shiftMonth()` ×5 (`AttendancePage.tsx:16`, `useVisits.ts:51`, `useBirthdays.ts:57`, `PersonalPage.tsx:44`, `design-system/ButoaneInputSection.tsx:203`); `MONTH_NAMES` ×3 (`MonthPicker`, `MonthStepper`, `DashboardPage`); paleta de categorii ×2 (`useExpenses.ts:55-67`, `report-category-style.ts:14-21`, cu potriviri diferite: substring vs. egalitate); `status: loading || !saveError ? 'loading' : 'failed'` ×15 hook-uri → `useSessionStatus()`; efectul print-then-afterprint ×2; modelul arhivare+undo ×3; două hook-uri `useKindergarten`/`useExchangeRates` cu același nume în `shared/api` și `features/backup`.
- **m17 (teste)** — `ExpensesPage.test.tsx:254` codifică bug-ul C1; `SalariesView.test.tsx:117` promite „și reîncarcă” dar nu verifică nicio reîncărcare; `SmsProviderCard.test.tsx:78-123` pune `expect` în mock-ul de fetch (o valoare greșită apare doar ca unhandled rejection, nu ca eșec al aserțiunii); `useBranchSwitch.test.tsx:152-176` nu verifică `replace` după rezolvare; `StaffFormDrawer.test.tsx` fără caz de editare (ar fi prins C2); `TimesheetView.test.tsx` fără caz de tipărire (ar fi prins M5).

### Verificat și în regulă (ca să nu fie recăutat)

- `useTopbarActions` e apelat o singură dată per ecran (`PersonalPage` consolidează filele; `StaffProfilePage` folosește doar `useTopbarTitle`).
- Niciun hook condițional/după `return` timpuriu (`SalariesContent`, `TeamView`, `StatusPage` — toate hook-urile preced ramurile de loading/failed).
- Date: `formatDate`/`formatMonthName`/`formatDayLabel` folosesc `T12:00:00`, `today()` e local, `useSmsLastNotified` compară ziua locală — niciun `toISOString().slice(0,10)` în scop.
- Rutele din `App.tsx` acoperă toate `VIEW_PATHS`; `/achitari/bon-zi` (static) câștigă corect în fața lui `/achitari/:paymentId`; singura rută lipsă e `/conflicte` (M2).
- `LoadingState`/`failed` sunt tratate consistent în toate paginile care consumă sesiunea, cu excepția `BirthdaysPage` (M9) și a hook-urilor din M6.
- `DataTable`, `SearchSelect`, `MonthPicker`, `SegmentedControl`, `FilterPills`, `useDelayedLoading`, `dirty-forms`: fără probleme de corectitudine.

## 3. Lista de reparat, pe loturi cu fișiere disjuncte

**Lot A — drawer-e de formular (C1, C2, M1, M8, M12):** `payments/PaymentFormDrawer.tsx`, `payments/PaymentsPage.tsx`, `expenses/ExpenseFormDrawer.tsx`, `expenses/ExpensesPage.tsx` (+ `ExpensesPage.test.tsx:240-255`), `children/ChildFormDrawer.tsx`, `children/ChildrenPage.tsx`, `personal/StaffFormDrawer.tsx`, `personal/StaffProfilePage.tsx`, `personal/TeamView.tsx`, `personal/SalariesView.tsx`, `personal/SalaryFormDrawer.tsx`, `personal/AdvanceFormDrawer.tsx`, `personal/LeaveFormDrawer.tsx`, `personal/LeavesView.tsx`, `personal/useSalaries.ts`. Ordine: C1 → C2 → M1 → M8 → M12. Test de regresie: „a doua deschidere a formularului nou e goală” și „save() întoarce false când mutate pică”.

**Lot B — shell și sesiune (M2, M3, M13, m2, m7, m15, m1 parțial):** `app/shell/AppShell.tsx`, `app/App.tsx`, `app/shell/useBranchSwitch.ts`, `src/core/web/app-session-store.mjs` (+ testul lui), `shared/api/session.ts`, `app/shell/sync-status.ts`, `shared/ui/Toast.tsx`, `shared/ui/Drawer.tsx`, `shared/ui/ConfirmDeleteDialog.tsx`, `app/shell/BranchSwitchDialog.tsx`, `app/shell/BranchSelector.tsx`.

**Lot C — tipărire (M4, M5, m5, m6, m1 parțial):** `status/StatusPage.tsx`, `status/StatusPrint.tsx`, `status/PrintOptionsDialog.tsx`, `personal/PersonalPage.tsx`, `personal/TimesheetView.tsx`, `personal/TimesheetPrint.tsx`, `personal/TimesheetPrintDialog.tsx`, `payments/PaymentReceipt.tsx`, `payments/PaymentReceiptThermal.tsx`, `shared/api/useKindergarten.ts` (expune `ready` deja; eventual `failed`).

**Lot D — erori înghițite în hook-uri și panouri (M6, M7, M9, m9):** `backup/useExchangeRates.ts`, `backup/useKindergarten.ts`, `backup/useBranches.ts`, `backup/useExcelTransfer.ts`, `backup/ExcelImportDialog.tsx`, `backup/ExchangeRateSettings.tsx`, `backup/KindergartenSettings.tsx`, `backup/BranchesSettings.tsx`, `notifications/SmsTemplatesPanel.tsx`, `notifications/SmsProviderCard.tsx`, `children/BirthdaysPage.tsx`.

**Lot E — cursuri și curse de date (M10, M11, m8, m11):** `notify/useNotify.ts`, `children/useChildren.ts`, `children/useChildProfile.ts`, `children/ChildProfileView.tsx`, `shared/attendance/useAttendance.ts`, `personal/useTimesheet.ts`, `shared/sms/useSmsLog.ts`, `shared/sms/useSmsStatus.ts`, `shared/sms/useSmsTemplates.ts`, `notifications/useTelegramStatus.ts`, `payments/usePayments.ts`, `shared/personal/usePersonal.ts`.

**Lot F — dedup, 13b pe restul formularelor, teste (m10, m14, m16, m17, M14):** `@shared/format/{initials,month-shift}.ts` noi + consumatorii lor, `expenses/useExpenses.ts` ↔ `report/report-category-style.ts`, `shared/api/useSessionStatus.ts` nou, `groups/GroupsPage.tsx`, `groups/GroupTeamCard.tsx`, `personal/RolesDrawer.tsx`, `attendance/AttendancePage.test.tsx`, `personal/SalariesView.test.tsx`, `notifications/SmsProviderCard.test.tsx`, `app/shell/useBranchSwitch.test.tsx`, `personal/StaffFormDrawer.test.tsx`, `personal/TimesheetView.test.tsx`.

Loturile A–E nu ating aceleași fișiere; F atinge `GroupsPage`/`RolesDrawer` (neatinse de A) și teste ale căror surse sunt în A (`ExpensesPage.test` e listat în A tocmai ca să nu se suprapună). După fiecare lot: `cd webapp && npm run typecheck && npm test`.
