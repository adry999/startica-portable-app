# Implementarea design system-ului în cod — plan și reguli

**Scop:** toate ecranele se construiesc **doar** din componente reutilizabile din `@shared/ui` (și `@shared/<domeniu>`). În `features/**` nu mai există HTML brut pentru controale, culori literale sau stiluri care dublează o componentă.

Referințe: `COMPONENTE.md` §0–§0i (specul fiecărei componente), paginile `DS *.dc.html` și `Componente formular.dc.html` (25–34), `TOKENS.md`.

---

## 1. Reguli (se verifică automat)

| # | Regulă | Cum se verifică |
|---|---|---|
| R1 | În `features/**` nu există `<input>`, `<select>`, `<textarea>`, `<button>`, `<table>`, `<dialog>` brute. | ESLint `no-restricted-syntax` pe JSXOpeningElement + test în `architecture.test.ts`. |
| R2 | În `features/**/*.module.css` nu există hex, `rgb()`, `box-shadow` literal, `font-family`, `border-radius` în px, `z-index` numeric. Doar `var(--…)`. | Stylelint (`color-no-hex`, `declaration-property-value-disallowed-list`) + test. |
| R3 | Caracterele-iconiță (⌕ ⋯ ▾ × ‹ › ✓ ☰ ⋮⋮ ↶ ↗ ▲ ▼ ⇅) nu mai apar în JSX. Se folosește `<Icon name>` (Lucide). | Test grep în `architecture.test.ts`. |
| R4 | `lucide-react` se importă doar în `@shared/ui/Icon`. | ESLint `no-restricted-imports`. |
| R5 | Nicio componentă din `features/` nu reimplementează o piesă din §0–§0i (card, pastilă, KPI, bară de filtre, tabel, stepper, toast…). Dacă lipsește o variantă, se adaugă ca prop în `@shared/ui`, nu ca CSS local. | Review + lista din §3 (fiecare ecran bifat). |
| R6 | Fiecare componentă din `@shared/ui` are: test și `*.stories.tsx` în **Storybook** (din 30.09 înlocuiește `/design-system`) cu **toate stările** (implicit, hover, focus, activ, dezactivat, **loading**, **error**, gol), plus a11y fără încălcări. | Test `design-system.coverage.test.ts`: fiecare export din `@shared/ui/index.ts` are un fișier de povești. Poveștile rulează ca teste, cu axe. Vezi `PROMPT-CLAUDE-CODE-5.md` §1b. |
| R7 | Formatele (bani, dată, telefon, plural, relativ) vin doar din `@shared/format`. Nicio `toLocaleString` sau concatenare „ lei” în `features/`. | ESLint + grep. |
| R8 | Încărcarea trece prin `useDelayedLoading(active, 300, { minVisible: 400 })` și componentele din §0d. Nu există spinnere sau schelete scrise local. | Review + grep după `animation:` în `features/`. |
| R9 | Starea goală e automată (29h): `DataTable`, `Board`, `MonthCalendar`, `DayGrid` și `Kpi` primesc `empty="<cheie>"` și aleg singure varianta (`first` / `done` / `period` / `noResults`) din `state`. Textele stau doar în `@shared/ui/empty-states.ts` (35b). `features/` nu importă `EmptyState` direct și nu are texte „Niciun…/Nicio…”. | Test în `architecture.test.ts`: import direct `EmptyState` în `features/` = eroare; fiecare listă are cheie existentă în `empty-states.ts`; grep „Nicio\|Niciun” în `features/`. |

Regulile R1–R4 și R7 se activează **ca warning** la începutul fazei. Devin **error** la finalul fazei, după ce toate modulele sunt migrate.

## 2. Ordinea de lucru

1. **Fundamente:** tokeni (culori lipsă, `--motion-*`, `--shadow-popover/dialog/drag`, `--space-*`, `-frame` pe toate cele 8 tonuri). Pachetul `lucide-react` și `Icon`. `@shared/format` completat.
2. **Primitive:** `Button` (toate variantele + `loading`), `IconButton`, `Spinner`, `Skeleton`, `Badge`, `CountBadge`, `Card`/`Kpi`/`Notice`, `Tooltip`, `Popover` de bază, `Kbd`.
3. **Formular:** `Field`, `TextInput`, `Select`, `NumberInput`, `DateInput`/`MonthInput`/`TimeInput`, `PhoneInput`, `TextArea`, `FileInput`, `PinInput`, `Checkbox`, `RadioGroup`, `Toggle`, `SegmentedControl field`, `ChipSelect`, `ChoiceCards`, `AmountInput`, `SearchSelect`, `MultiSelect`, `TagInput`, `NumberStepper`, `Slider`, `CopyField`, `FormSection`/`FormGrid`.
4. **Date:** `DatePicker`, `MonthPicker`, `TimePicker`/`TimeSlots`, `BarChart`, `Heatmap`, `ProgressBar`, `Legend`, `AttendanceDot`, `Avatar`/`AvatarGroup`/`PersonCell`.
5. **Liste:** `DataTable` complet (sortare, tipuri de celulă, stări de rând, `TableFooter`, `Pagination`, `groupBy`, `ColumnMenu`/densitate, carduri sub 768), `ListToolbar`, `SearchInput`, `FilterPills`, `FilterMenu`, `PeriodFilter`, `ActiveFilters`, `SelectionBar`, `InlineEdit`, `DiffTable`, `EmptyState`/`ErrorState` + `empty-states.ts` cu toate cheile din 35b (varianta aleasă automat, 29h).
6. **Grile:** `DayGrid` (dot/code/bar), `WeekGrid`, `MonthCalendar`, `Board` + `@shared/dnd`.
7. **Straturi și răspuns:** `Drawer`, `Dialog`/`ConfirmDialog`, `UnsavedChangesDialog` + `useUnsavedGuard` (40c), `UndoToast` (40b), `ErrorNotice` (41d), `MissingFieldsBanner` (41a), `PrintOptionsDialog`, `RowMenu`, `SplitButton`, `HoverCard`, `Toast`/`ProgressToast`, `AppBanner`, `LoadingBar`, `SaveIndicator`, `UndoHistory`, `InlineError`.
8. **Tipare:** `PageHeader`, `Tabs`, `Breadcrumb`, `MonthStepper`/`DayStepper`, `ProfileLayout`, `MasterDetail`, `Wizard`, `Timeline`/`NoteList`, `Disclosure`/`Accordion`, `NavRail` + meniul responsive, `GlobalSearch`, `BranchSelector`, `SyncStatusCard`, `TodoCard`/`TaskRow`, `LockedContent` + `usePinLock`, `DocumentCard`, `TonePicker`, `SmsPreview`/`SegmentCounter`, piesele de tipar.
9. **Migrarea ecranelor, câte un commit pe modul**, în ordinea: Achitări → Copii → Prezența → Cheltuieli → Situația → Personal → Grupe → Bazin → Vizite → De rezolvat → De notificat → Administrare → Raport → Tipăriri → Pornire. Bifează rândul modulului din §3 abia după ce trec R1–R8 pe fișierele lui.
10. **Închidere:** R1–R4 + R7 → error. Șterge CSS-ul local rămas fără folos. `npm run check` verde, captură la 1440px pentru fiecare ecran, comparată cu artboard-ul.

Pașii 2–8 se pot face în paralel pe fișiere disjuncte. Pasul 9 începe pe un modul abia după ce există toate componentele de care are nevoie modulul.

## 3. Evidență (se completează în commit-uri)

| Modul | Componente folosite (de bifat) | R1–R8 | Captură = artboard |
|---|---|---|---|
| Achitări 5a/5b/15b | DataTable, ListToolbar, FilterMenu, PeriodFilter, ActiveFilters, SelectionBar, Kpi, MasterDetail, AmountInput, ChoiceCards, SegmentedControl, SplitButton, PrintOptionsDialog | ☐ | ☐ |
| Copii 2a/2b/2c/15a | DataTable, FilterPills, ProfileLayout, NoteList, DocumentCard, MultiSelect, FormSection, PhoneInput, DateInput, HoverCard | ☐ | ☐ |
| Prezența 18a–18d | DayGrid(dot), GroupSection, UndoHistory, SaveIndicator, Popover (motiv), Notice | ☐ | ☐ |
| Cheltuieli 6a/6b/15c | DataTable, ChipSelect, AmountInput, InlineEdit, Kpi | ☐ | ☐ |
| Situația 7a–7e | Heatmap, DataTable, SmsPreview, SegmentCounter, ProgressToast | ☐ | ☐ |
| Personal 23a–23m | DataTable(groupBy), DayGrid(code/bar), LockedContent, Tabs, ProfileLayout, Timeline | ☐ | ☐ |
| Grupe 4a–4c | Board, TonePicker, AvatarGroup, ProgressBar(capacitate) | ☐ | ☐ |
| Bazin 22a–22d | WeekGrid, TimeSlots, DayGrid, Kpi | ☐ | ☐ |
| Vizite | MonthCalendar, WeekGrid, DataTable | ☐ | ☐ |
| De rezolvat 9a–9c, 14c | TaskRow, InlineEdit, MasterDetail, DiffTable, Kbd | ☐ | ☐ |
| De notificat 8a | MasterDetail, SmsPreview | ☐ | ☐ |
| Administrare 10a–10e, 11a–11d, 12a, 13c, 14b, 16a | Timeline, Tabs, Toggle, Disclosure, DataTable, SmsPreview, CopyField, Slider | ☐ | ☐ |
| Raport 19a/19b | Kpi, DataTable, PrintOptionsDialog | ☐ | ☐ |
| Tipăriri 16x, 23k, 24x | PrintHeader, PrintTable, SignatureLine, PrintFooter, ThermalBlock | ☐ | ☐ |
| Pornire 20a–20c, 21a–21c | Wizard, StepList, LoadingBar | ☐ | ☐ |
| Shell | NavRail, BranchSelector, SyncStatusCard, TodoCard, GlobalSearch, AppBanner, PageHeader | ☐ | ☐ |

## 4. Definiția lui „gata” pentru faza DS

- Fiecare componentă din §2 există în `@shared/ui`, cu test, `axe` și poveste în Storybook (inclusiv loading și error); `npm run build-storybook` verde.
- Toate cele 16 rânduri din §3 sunt bifate.
- R1–R8 sunt pe **error**, iar `npm run check` e verde.
- În `features/**` nu mai rămâne niciun `*.module.css` care să conțină doar layout duplicat dintr-o componentă.
