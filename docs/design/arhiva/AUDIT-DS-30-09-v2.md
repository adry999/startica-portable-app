# Audit design system ↔ cod — 30.09.2026, 12:24

`master-v2` @ 7aace22 · 13 commituri după 40ad469 (285 fișiere). Înlocuiește versiunile de la 09:00 și 11:25.

## 1. Închis
- **Pachetul de design** e în `docs/design/` (Stari goale, SMS expeditor, screens/30, PROMPT-4, AUDIT-DS-30-09). Lipsesc doar modificările făcute după: 33f, mărimile Icon în PROMPT-4, 35c–35e, documentele scoase, răspunsurile de la 12:30.
- **Tokeni:** `--orange-strong`, `--overlay`, `--row-divider-warm`, `--code-co`, `--mint-bar-current`, `--print-ink/muted/rule`, `--white`, `--text-secondary`, `--shadow-drag`. `Button.primary` și bifa din `Checkbox` sunt pe `--orange-strong`.
- **Componente:** toate din DS-IMPLEMENTARE §2 există (~60 noi: Kpi, Dialog, ConfirmDialog, Tabs, FilterMenu, MonthInput, PinInput, RadioGroup, MultiSelect, TagInput, NumberStepper, Slider, CopyField, FormSection, FormGrid, DatePicker, TimePicker, BarChart, Heatmap, ProgressBar, Legend, Avatar, AvatarGroup, TableFooter, Pagination, ColumnMenu, InlineEdit, DiffTable, ErrorState, InlineError, DayGrid, WeekGrid, MonthCalendar, Board, UnsavedChangesDialog, SplitButton, HoverCard, ProgressToast, AppBanner, PageHeader, Breadcrumb, Spinner, CountBadge, Notice, Tooltip, Kbd, MasterDetail, Wizard, NavRail, GlobalSearch, PrintOptionsDialog în shared…), fiecare cu test; `jest-axe` instalat.
- **`empty-states.ts`** cu cele 10 chei din 35b.
- **Regulile ca test** în `architecture.test.ts`: R1, R2, R3, R4, R7, R9, cu listă de excepții (testul pică la orice încălcare nouă).

## 2. Deschis
| Regulă | Fișiere încă pe listă de excepții |
|---|---|
| R1 HTML brut | 25 |
| R2 CSS literal | 46 |
| R3 iconițe-text | 1 (`WeeklySheet.tsx`, legenda tipărită) |
| R7 formate locale | 8 |
| R9 text gol local | 39 (dintre care ~12 nu sunt stări goale, vezi 35e) |
| R9 import direct EmptyState | 8 |

- **Primul val de migrare** s-a făcut înainte de componentele noi. Exemplu Achitări: lipsesc ListToolbar, FilterMenu, ActiveFilters, Kpi, MasterDetail, AmountInput, ChoiceCards, SplitButton, PrintOptionsDialog.
- **`empty-states.ts`** nu are câmpul `text` și nici cheile din 35a, 35c, 35d.
- **`Spinner`** nu are mărimea 14 (butonul folosește 12).
- **`EmptyState`** nu are varianta compactă (35d).
- **Fișa copilului:** placeholder Documente (scos din design), Plătitori reținuți lipsă (CF-2).
- **21c** fără „Lucrez fără legătură” (lipsește `lastSyncedAt` persistat).

## 3. Următorul pas
`PROMPT-CLAUDE-CODE-5.md`: §0 pachet → §1 șase lucruri mici → §2 al doilea val pe 15 module, cu captură după fiecare → allowlist-uri goale.
