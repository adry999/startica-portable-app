# Audit design system ↔ cod — 30.09.2026, 09:00

`master-v2` @ 40cf9a1 · 36 commituri după 7063a98 · scanare pe `webapp/src/features/**` după regulile R1–R9 din `DS-IMPLEMENTARE.md`.

> Scanarea s-a oprit la bugetul de timp după ~75–85% din fișiere. Cifrele de mai jos sunt **minimum**; Claude Code rulează grep-ul complet local.

## 0. Pachetul de design din repo e vechi
`docs/design/` are pachetul 25–34, dar nu ultimele modificări din `design_final_startica/`:
- **Lipsesc:** `Stari goale.dc.html`, `SMS expeditor.dc.html`, `screens/30-stari-goale.md`, `AUDIT-DS-30-09.md`, `PROMPT-CLAUDE-CODE-4.md`.
- **Vechi:** toate cele 34 de `.dc.html` (butoane pe `--orange-strong`), `DS Incarcare si stari.dc.html` (29h), `TOKENS.md`, `DECIZII.md`, `COMPONENTE.md`, `DS-IMPLEMENTARE.md` (R9), `PROMPT-CLAUDE-CODE-3.md`.
→ Se urcă din nou tot folderul, cu suprascriere.

## 1. Ce s-a construit (verificat)
- **Componente noi în `@shared/ui`:** Field, TextInput, TextField, NumberInput, DateInput, AmountInput, TextArea, Select, PhoneInput, FileInput, Checkbox, ChipSelect, ChoiceCards, IconButton, Popover, PeriodFilter, ActiveFilters, LoadingBar, StepList, SettingsList, LockedContent, PrintHeader/Table/Footer, SignatureLine, ThermalBlock. SaveIndicator și UndoHistory mutate din Prezența în `@shared/ui`, iar `useUndoStack` și `usePinLock` în `shared/state`.
- **SMS:** `SmsNewMessageDialog` (11c/11d) cu test, `SmsConfirmDialog` actualizat, șabloane pe server.
- **Încărcare:** `StartupScreen` modificat, `LoadingBar` există.

## 2. Lipsesc din `@shared/ui` (față de DS-IMPLEMENTARE §2)
| Pas | Lipsesc |
|---|---|
| 1 Fundamente | **`Icon` + `lucide-react` (nu e instalat)**, token **`--orange-strong`**, `--text-secondary` (#5b666e), `--code-co` (#e0b400), `--white`, `--overlay`, `--shadow-drag`, `--mint-bar-current` (#5fb58a), `--row-divider-warm` (#f1e8d6), tokeni de tipar (`--print-ink`, `--print-rule`) |
| 2 Primitive | `Spinner`, `CountBadge`, `Kpi`, `Notice`, `Tooltip`, `Kbd` |
| 3 Formular | `MonthInput`, `TimeInput`, `PinInput`, `RadioGroup`, `MultiSelect`, `TagInput`, `NumberStepper`, `Slider`, `CopyField`, `FormSection`/`FormGrid` |
| 4 Date | `DatePicker`, `TimePicker`/`TimeSlots`, `BarChart`, `Heatmap`, `ProgressBar`, `Legend`, `AttendanceDot`, `Avatar`/`AvatarGroup` |
| 5 Liste | `TableFooter`, `Pagination`, `ColumnMenu`, `FilterMenu`, `InlineEdit`, `DiffTable`, `ErrorState`/`InlineError`, **`empty-states.ts` + selecție automată (29h)** |
| 6 Grile | `DayGrid`, `WeekGrid`, `MonthCalendar`, `Board` + `@shared/dnd` |
| 7 Straturi | `Dialog`/`ConfirmDialog`, `UnsavedChangesDialog`, `SplitButton`, `HoverCard`, `ProgressToast`, `AppBanner`; `PrintOptionsDialog` stă încă în `features/status` |
| 8 Shell | `PageHeader`, `Tabs`, `Breadcrumb` |

## 3. Încălcări în `features/`

### R1 — elemente HTML brute (≥ 60)
- `report/ReportExportDrawer.tsx` — 7 `<button>` + 6 `<input>` → `ChoiceCards`, `Checkbox`, `DateInput`/`MonthInput`
- `payments/PaymentFormDrawer.tsx` — 10 `<button>` + 1 `<input>` → `Button variant="link"`, `IconButton`, `AmountInput`
- `children/ChildFormDrawer.tsx` — 8 `<button>` + 2 `<input>` → `Button link`, `ChoiceCards`, `IconButton`, `TextInput`
- `dashboard/DashboardPage.tsx` — 4 `<button>` → `Button link`, `Kpi` cu acțiune
- `groups/GroupTile.tsx` (4), `GroupTeamPicker.tsx` (2) → `Button link`, `IconButton`, `RowMenu`
- `report/PeriodStepper.tsx` — stepper local cu `‹ ›` → `MonthStepper` / `PeriodFilter`
- `personal/TimesheetPrint.tsx` — `<table>` → **`PrintTable` (există deja)**
- `personal/SalaryFormDrawer.tsx` — `<input type="month">` → `MonthInput`
- `backup/PoolSettings.tsx` (2), `backup/ExcelImportDialog.tsx` → `NumberInput`, **`FileInput` (există)**
- `notifications/NotificationsPage.tsx`, `notify/NotifyPage.tsx`, `conflicts/ConflictsPage.tsx`, `assign/AssignPage.tsx`, `attendance/ChildTile.tsx`, `expenses/DailyExpensesView.tsx`, `expenses/ExpenseFormDrawer.tsx`, `personal/RolesDrawer.tsx` (2), `personal/StaffFormDrawer.tsx`, `pool/WeekView.tsx`
- `expenses/ExpensesFilters.tsx` — dropdown din `<details><summary>… ▾` → `FilterMenu` peste `Popover`

### R2 — culori și umbre literale (≥ 45)
- `#5b666e` → `--text-secondary`: `attendance/DayView`, `personal/TimesheetView`; comentariile din `SalariesView` și `TeamView` spun că au pus `--muted` în loc, iar după token se revine la valoarea corectă
- `#e0b400` → `--code-co`: `personal/TimesheetView` (2)
- `#fff` → `--white`: DayView (4), MonthView, BirthdaysPage (2), DashboardPage, ExpensesPage, GroupTeamPicker (3), SmsTemplatesPanel, StaffFormDrawer (2), StaffProfilePage (2)
- `rgba(58,71,80,.35/.4)` (overlay scris de mână) → `Dialog` comun: `WeeklySheetDialog`, `SalariesView` (dialog propriu), `TimesheetPrintDialog`
- `rgba(255,255,255,.55–.75)` → `--white-a60` sau `Card tone="glass"`: `GroupTile` (5), `GroupCardCompact`
- `#5fb58a` → `--mint-bar-current`: `DashboardPage` (2) → de fapt `BarChart`
- `#f1e8d6` → `--row-divider-warm`: `GroupsPage`
- `#f3eee5` → `--row-divider` (există): `attendance/MonthView`
- `dragTypes.ts` `boxShadow` inline → `--shadow-drag` în `@shared/dnd`
- Tipar (`#000`, `#333`, `#ccc`): `DayClosingReceipt`, `PaymentReceiptThermal` (8), `TimesheetPrint` (7), `PoolReceiptLabel` (2) → tokeni `--print-*` sau `ThermalBlock`/`PrintTable`

### R3 — caractere-iconiță (≥ 25), cauza: lipsește `Icon`
`⌕` AssignPage · `✓ × M` ChildTile · `‹ ›` WeeklySheetDialog, PoolPage, PeriodStepper · `✓ +` WeeklySheetDialog · `×` ChildFormDrawer, ChildProfileView, ExpensesCategoryManager, GroupTeamPicker, GroupsPage, PaymentDetailPanel, PaymentFormDrawer · `▾` ExpensesFilters · `⋯` ExpensesPage · `✓ ↗` useDashboard · `✓` PaymentReceipt · `↶` în eticheta „↶ Anulează” (Prezența). `IconButton icon="×"` primește încă text, nu `name`.
Nu intră: `×` ca semn de înmulțire în text („3 × 150 lei”).

### R5 — piese refăcute local (le rezolvă componentele din §2)
- **KPI** (Card + `kpiValue`/`statValue` local): Dashboard, ExpensesSummaryCards, ChildrenStatsRow, SmsMessagesPanel, SalariesView → `Kpi`
- **File** (`tabsRow`): BackupPage → `Tabs`
- **Pastile** locale: PaymentsByMonth, WeeklySheetDialog `pillRow`, SmsTemplatesPanel (Button + `styles.pill`) → `FilterPills` / `ChipSelect`
- **Chip-uri editabile**: ExpensesCategoryManager → `SettingsList` (există deja, 10d)
- **Tabel din div-uri**: ConflictDetail → `DiffTable`
- **Punct de stare**: NotifyPage `statusDot` → `Badge dot`
- **Butoane din bara de selecție** cu `className` propriu (`selectionArchive`, `selectionDeleteForever`): ChildrenSelectionBar, ExpensesPage, PaymentsTable → sloturile `actions` / `danger` din `SelectionBar`
- **`Button className=…` pentru alt aspect** (`statusCta`, `linkButton`, `hintLink`, `noticeLink`, `assignLink`, `archiveLink`, `save`, `suggestion`): se înlocuiesc cu variante sau props pe `Button`, fără CSS local

### R8 — încărcare locală
- `children/BirthdaysPage.tsx` — `<p>Se încarcă…</p>` → `LoadingState` / schelet

### R9 — stări goale făcute pe ecran
- Import direct `EmptyState`: `backup/SyncSettings`, `conflicts/ConflictsPage`, `personal/CandidatesTab`
- Text gol local: `GroupsPage` („Niciun copil în grupă…”), `NotifyPage` (`emptyMessage`, „Alege un părinte…”), `BirthdaysPage`, `SmsMessagesPanel` (`emptyDetail`)
→ Toate trec pe `empty="<cheie>"` + `empty-states.ts`.

### Contrast (decis 30.09)
`--orange-strong` nu există. `Button` primar, pastila „azi”, insignele pline și pasul activ sunt încă alb pe `--orange` (2,4:1).

## 4. Rezumat
- Construit bine: formularul de bază (pasul 3, ~60%), tiparul, SMS 11c/11d.
- Blocant pentru tot restul: **`Icon`**, tokenii lipsă, `Kpi`, `Dialog`, `Tabs`, `FilterMenu`, `empty-states.ts`. Fără ele, ecranele nu se pot migra fără să încalce regulile.
- Regulile R1–R9 nu sunt încă active ca test (altfel build-ul ar fi roșu). Se pornesc ca warning acum și devin error după migrare.
