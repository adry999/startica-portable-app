# Audit cod vs. design · 01.10.2026

Sync la `master-v2` (c3f150d), 36 commituri după 40ad469. Surse: `docs/design/verificare/*.md`, `INTREBARI.md`, `tokens.css`, `package.json`, `architecture.test.ts`.

## Ce e gata
- **Val 2, toate cele 15 module**, câte un commit și câte un document în `docs/design/verificare/`. `npm run check` e verde.
- §1 din PROMPT-5: `EmptyState size="compact"`, catalogul `empty-states.ts` cu `text`, R9 mai precis, Documente scoase, CF-2 fără IBAN.
- Componente noi în `@shared/ui`: AppBanner, Avatar, AvatarGroup, BarChart, Board, Breadcrumb, ColumnMenu, ConfirmDialog, CopyField, DatePicker, DayGrid, Dialog, DiffTable, Disclosure, ErrorState, FilterMenu, FormGrid, FormSection, GlobalSearch, Heatmap, HoverCard, InlineEdit, Kpi, Legend, MasterDetail, MonthCalendar, MonthInput…
- `jest-axe` e în teste.
- Tokeni: `--orange-strong` (#b85a00), `--orange-ink` (#a34f00), `--code-co`, `--text-secondary`, `--print-*`, scara `--radius-*`.

## 1. Pachetul de la 30.09, 12:30 nu e în repo (blocant)
`docs/design/PROMPT-CLAUDE-CODE-5.md` are 5,7 KB, iar cel din pachet are 9,0 KB. Lipsesc:
- §1b **Storybook**. Nu e instalat, iar `/design-system` a crescut (secțiunile Grile și Aplicație, plus `build:design-system`).
- Contrastul din `AUDIT-DESIGN-30-09-final.md` (A, B) nu e aplicat. Lipsește `--orange-strong-pressed`, iar hover/apăsat pe `Button primary` sunt încă din scara veche. Sidebar-ul activ, pasul curent din Wizard, pastila „azi” și butoanele care devin active n-au fost verificate.
- `arhiva/` nu există. Prompturile 1–4 și `AUDIT-DS-30-09.md` sunt încă în rădăcina `docs/design/`.
- Nu există nici `AUDIT-DESIGN-30-09-final.md`, nici cheia `chart.nodata`.

## 2. Nicio captură design lângă cod (blocant pentru „gata”)
Toate cele 15 documente spun „neefectuată”. Motivul: serverul ar rula peste baza de producție. Val 2 a schimbat layouturi (EmptyState, Legend, Dialog, FilterPills, Kpi), deci fără capturi nu știm dacă ecranele arată ca în design. Soluția e să ruleze pe o **copie** a bazei (§3 din PROMPT-6).

## 3. Excepțiile „permanente” din `architecture.test.ts`
PROMPT-5 §3 cerea allowlist-uri goale. Au rămas 15 fișiere în R1, 21 în R2, câte unul în R3 și R7. Majoritatea sunt **goluri de API** în componente, nu decizii de arhitectură:

| Excepție | Cauză reală | Decizie design |
|---|---|---|
| Vizite, celula de calendar | `MonthCalendar` n-are `selected`, `cellHeight`, `renderCell`, iar zilele sunt `div role=button` | Se extinde `MonthCalendar`: `<button>` real, `selected`, `cellHeight`, `renderCell` |
| Achitări „Pe luni” | `MasterDetail` are panoul fix doar în stânga | Prop `detailSide="end"` + `detailWidth` |
| Prezența, luna | `DayGrid` n-are stări proprii | `DayGrid` primește `renderCell`, iar Prezența pune `AttendanceDot` în el |
| Dashboard, graficul | `BarChart` n-are o țintă pe grup | `BarChart grouped` = un buton pe lună, `aria-label` combinat, `tooltip(group)` |
| Dashboard, „Vezi lista →” | `Button link` n-are ton | `Button variant="link" tone="inherit"` |
| Salarii, titlul dialogului | `Dialog` folosește `title` și ca `aria-label` | Prop `ariaLabel` separat; titlul revine la „Plătește N salarii” |
| Foi pe săptămână | modal propriu | se trece pe `Dialog` |
| Tile-uri pe tot rândul (ChildTile, GroupTile, Notify, Review, Assign, Conflicts, TeamPicker, Leaves) | lipsește o primitivă | `SelectableRow` / `SelectableTile` în `@shared/ui` (`<button>` pe toată suprafața, stările hover/selectat/focus) |
| Grupa din ChildFormDrawer (tooltip de capacitate, ton) | `ChipSelect` n-are ton și hint | `ChipSelect` primește `tone` și `hint` pe opțiune |
| R2: `inset 4px 0 0 var(--orange)` (rând activ, 4 fișiere) | lipsește tokenul | `--shadow-row-active` |
| R2: `monospace` | lipsește tokenul | `--font-mono: ui-monospace, "Cascadia Mono", Consolas, monospace` |
| R2: raze în afara scării | valori ca 6/7/9/11 px | se rotunjesc la cea mai apropiată `--radius-*`, fără token nou |
| R2: `#e0b400`, `#5b666e` „fără token” | tokenii **există deja** (`--code-co`, `--text-secondary`) | se înlocuiesc |
| Tipăriri (TimesheetPrint, ReportPrintSummary, Pool WeekView) | tabel de print | `PrintTable` (există în DS Tipare) |
| R3 ✓ pe foaia tipărită | legendă | rămâne singura excepție, pe `WeeklySheet.tsx` |
| R7 `.toFixed(2)` într-un input | valoare de câmp | rămâne excepție, sau `formatMoneyInput()` în `@shared/format` |

Țintă: rămân cel mult 2 excepții (R3 WeeklySheet și eventual R7).

## 4. Rămase din catalogul de stări goale
- `derezolvat.done` nu e folosită. E corect, o păstrăm pentru un hub viitor.
- De notificat folosește un text dinamic, iar asta e acceptat. Varianta cu „N fișe nu pot fi evaluate” devine `EmptyState` cu `title` din catalog (`denotificat.done`), iar nota dinamică merge în `text`.
- Dashboard a pierdut nuanța „nu sunt copii încă”. Se adaugă cheia `dashboard.attention.first`: „Adaugă primii copii”.

## 5. Proces
- Mai multe sesiuni Claude Code au lucrat **în paralel** pe `architecture.test.ts`, cu teste roșii tranzitoriu și un Prettier care a reformatat tot fișierul. De acum lucrează o singură sesiune.
- `docs/design/verificare/` există doar în repo. Suprascrierea din pachet **nu** trebuie să-l șteargă. La fel `INTREBARI.md`, `COADA-DE-LUCRU.md` și `RASPUNSURI.md`.

## 6. Design (pachet), rămase de la 30.09
C (culori fără token), D (font sub 10px), H (glife ca iconițe) rămân pentru după capturi. Au prioritate mică.
