# Pentru Claude Code — audit DS 30.09, 09:00 (master-v2 @40cf9a1)

Citește întâi `docs/design/AUDIT-DS-30-09.md`. Regula de bază: **ecranele se construiesc doar din `@shared/ui`**. Dacă o piesă lipsește, o adaugi în `@shared/ui` (cu test, secțiune în `/design-system` cu toate stările, `axe`) și abia apoi o folosești. Nu scrii CSS, culori, iconițe, texte goale sau formate în `features/`.

## 0. Pachetul de design
Suprascrie `docs/design/` cu tot conținutul din `design_final_startica/` (inclusiv `Stari goale.dc.html`, `SMS expeditor.dc.html`, `screens/30-stari-goale.md`, `AUDIT-DS-30-09.md`, acest fișier). Commit: `docs(design): audit DS 30.09 + stări goale + orange-strong`.

## 1. Regulile ca test, acum
În `architecture.test.ts` adaugă R1, R2, R3, R4, R7, R8 și R9 (vezi `DS-IMPLEMENTARE.md` §1), **ca warning** cu listă de excepții = fișierele din audit §3. Lista doar scade. Un fișier nou în listă = test roșu. Când lista e goală, regula devine error.

## 2. Fundamente (blocant pentru tot restul)
- `lucide-react` + `@shared/ui/Icon` (`name`, `size` 14/16/18/20/24, `aria-label` sau `aria-hidden`). `IconButton` primește `icon: IconName`, nu text.
- `tokens.css`: `--orange-strong: #b85a00`, `--shadow-button-header: 0 4px 10px rgba(184,90,0,.28)`, `--text-secondary: #5b666e`, `--code-co: #e0b400`, `--white`, `--overlay: rgba(58,71,80,.4)`, `--white-a60`, `--shadow-drag`, `--mint-bar-current: #5fb58a`, `--row-divider-warm: #f1e8d6`, `--print-ink: #000`, `--print-muted: #333`, `--print-rule: #ccc`.
- **Contrast:** `Button` primar, pastila „azi”, `Badge` plin portocaliu, pasul activ din `StepList` → fundal `--orange-strong`. `--orange` rămâne doar pentru accente fără text alb. Test: nicio regulă cu `color: var(--white)` pe `background: var(--orange)` în `@shared/ui`.

## 3. Componentele care lipsesc, în ordinea în care deblochează ecrane
1. `Kpi`, `Tabs`, `Dialog`/`ConfirmDialog` (peste el `WeeklySheetDialog`, `TimesheetPrintDialog`, dialogul de plată din `SalariesView`), `FilterMenu` (peste `Popover`), `MonthInput`, `DiffTable`, `Badge dot`
2. `EmptyState` automat (29h): `@shared/ui/empty-states.ts` cu toate cheile din `screens/30-stari-goale.md`. `DataTable`, `Board`, `MonthCalendar`, `DayGrid` și `Kpi` primesc `empty="<cheie>"` și `state` și aleg singure varianta `first` / `done` / `period` / `noResults`. `EmptyState` nu se mai exportă spre `features/`.
3. `ErrorState`/`InlineError`, `Spinner`, `Tooltip`, `ProgressBar`, `Legend`, `BarChart` (Dashboard), `Avatar`
4. `SelectionBar`: sloturi `actions` + `danger`. `Button`: variantele necesare ca să dispară toate `className`-urile de aspect din audit §3 R5.
5. Restul din audit §2, pe măsură ce le cere un ecran.

## 4. Migrarea, pe module, câte un commit fiecare
Ordinea: Rapoarte (`ReportExportDrawer`, `PeriodStepper`) → Achitări (`PaymentFormDrawer`, `PaymentsByMonth`, `PaymentsTable`, `PaymentDetailPanel`, bonuri) → Copii (`ChildFormDrawer`, `ChildProfileView`, `ChildrenStatsRow`, `BirthdaysPage`) → Dashboard → Grupe → Personal (`TimesheetView`, `TimesheetPrint`, `SalariesView`, `StaffFormDrawer`, `RolesDrawer`, `SalaryFormDrawer`) → Prezența → Cheltuieli → Notificări/SMS → De notificat → Backup (`BackupPage` Tabs, `PoolSettings`, `ExcelImportDialog`) → Conflicte → Bazin → Asociere.
Pentru fiecare modul:
- zero intrări în lista de excepții R1–R9 pentru fișierele lui;
- captură la 1440px lângă artboard-ul din `docs/design` (evidența din `DS-IMPLEMENTARE.md` §3);
- `npm run check` + webapp typecheck/test verzi.

## 5. Nu se face
Ce e în `DECIZII.md` la „Nu se face”. Fără schimbări de logică sau de date în pasul 4: e doar migrare vizuală.
