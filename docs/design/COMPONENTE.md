# Componente reutilizabile și design system — 29.09.2026

Designul final folosește un set mic de piese care se repetă pe toate ecranele. Codul are deja `webapp/src/shared/ui` (exportate din `@shared/ui`) și Storybook (din 30.09 înlocuiește pagina `/design-system`). Acest fișier leagă fiecare tipar din design de componenta din cod, spune ce trebuie extins și ce componente noi trebuie extrase.

**Reguli**
1. Un tipar care apare în **≥ 2 module** devine componentă în `@shared/ui` (sau `@shared/<domeniu>`). Un tipar folosit într-un singur loc rămâne local modulului.
2. Componentele primesc **tonuri** (`PillTone`/`CardTone`/`BadgeTone`, 8 tonuri + neutral), nu culori. Hex-ul stă doar în `tokens.css` (vezi `TOKENS.md`).
3. Fiecare componentă nouă sau variantă nouă: test în `*.test.tsx` și o poveste în Storybook cu toate stările (implicit, hover, activ, dezactivat, gol, eroare).
4. Nu dubla o componentă existentă cu CSS local; extinde-o cu o prop.

---

## 0. Câmpuri de formular — `Componente formular.dc.html` (25a–25f), prioritar

**Stare în cod (29.09):** ~200 de `<input>/<select>/<textarea>` brute în ~40 de fișiere din `features/`. Fiecare modul are propriul CSS `.field` (`PaymentFormDrawer`, `ChildFormDrawer`, `NotificationsPage`, `SmsMessagesPanel .select`, `allocationField`…), cu padding, font și radius diferite. În `@shared/ui` există doar `SearchInput`, `SearchSelect`, `SegmentedControl`, `Toggle`. Nu există `Field`, `TextInput`, `Select`, `TextArea` sau `Checkbox`.

| Componentă nouă | Id | Valori |
|---|---|---|
| `Field` (label, hint, error, optional, children) | 25a | Etichetă 13/700, gap 8. „· opțional” 13/600 `--subtle`. Ajutor 12px `--muted`, iar eroarea (12/700 `--pink-ink`) îl înlocuiește. Leagă `htmlFor` + `aria-describedby` + `aria-invalid`. |
| `TextInput` | 25a | `11px 14px`, radius 12, 1px `--input-border`, 15/600, placeholder `--subtle`. Hover border `--subtle`. Focus 1.5px `--orange` + inel `0 0 0 3px var(--orange-soft)` (padding scade cu 0,5px, ca înălțimea să nu sară). Eroare 1.5px `--raspberry`, fundal `#fffafb`, eticheta `--pink-ink`. Dezactivat: fundal `--neutral-soft`, border `--border`, text `--subtle`. Props `prefix`/`suffix` (text 14/700 `--subtle`). |
| `Select` | 25b | Aceeași cutie + ▾ 12px `--muted`, `appearance:none`. 2–8 opțiuni. Peste 8 → `SearchSelect`. |
| `NumberInput` | 25b | TextInput + `inputMode="numeric"`, fără săgeți native, `tabular-nums`, `suffix` („copii”, „zile”, „lei”). |
| `DateInput` / `MonthInput` | 25b | Afișare zz.ll.aaaa. `trailing` opțional (ex. „4 ani”). `MonthInput` deschide popover-ul `MonthPicker`. |
| `PhoneInput` | 25b, §10 | Salvează E.164 (`+373XXXXXXXX`), afișează „069 123 456” (`formatMoldovanPhone`). Sub câmp: „✓ 069 123 456” 12/800 `--mint-ink`, „Număr incomplet: 8 cifre după 0.” pentru un număr prea scurt, mesajul generic pentru restul; „alt număr” (prefix „+” nemoldovenesc) e acceptat ca atare, tot cu ✓. Câmp opțional, nu blochează salvarea. |
| `TextArea` | 25b | Min 96px, auto-grow până la 240, line-height 1.5, contor opțional `N / max`. |
| `FileInput` | 25b | Zonă punctată 1.5px `--dashed-border-empty`, fundal `--cream`, radius 12, drag & drop. |
| `PinInput` | 25b | Căsuțe 44×50 radius 12 border 1.5px (activ = `--orange` + inel). |
| `Checkbox` | 25c | 18px radius 5, 1.5px `--input-border`. Bifat = `--orange` plin + ✓ alb. Dezactivat = `--neutral-soft`. |
| `Radio` / `RadioGroup` | 25c | 18px. Bifat = border 5px `--orange`. Doar în dialoguri de tipar și export. |
| `SegmentedControl size="field"` | 25c | Radius 12, opțiune `8px 0` flex:1, 13/700. |
| `ChipSelect`, `ChoiceCards` | 25c | Vezi tabelul 2. |
| `AmountInput` | 25d | Vezi tabelul 2. |
| `size="sm"` pe TextInput, Select, NumberInput | 25e | `8px 12px` (numeric `7px 0`, lățime fixă), radius 10, 13/700. Pentru bare de filtre (border `--border`) și rânduri de setări (border `--input-border`). Eticheta stă în linie. |
| `FormSection` + `FormGrid` | 25f | Secțiune numerotată (pătrat 24 radius 8 slate + titlu Baloo 17), gap 14. `FormGrid cols={2}` gap 12. Între secțiuni gap 22. |

**Migrare:** după ce piesele există în `@shared/ui` + Storybook (toate stările din 25a), înlocuiește toate câmpurile brute, modul cu modul (un commit pe modul). Șterge CSS-ul local `.field` / `.select` rămas. La final nu mai rămâne niciun `<input>/<select>/<textarea>` brut în `features/`, în afară de `type="file"` ascuns din `FileInput`. Test de arhitectură nou în `architecture.test.ts` care interzice câmpurile brute în `features/**`.

## 0b. Tabel, filtre, sortare — `DS Tabel si filtre.dc.html` (27a–27h)

Un singur `DataTable` + o singură bară de filtre (`ListToolbar`) pe toate listele: Copii, Achitări, Cheltuieli, Vizite, Personal, Candidați, Mesaje SMS, Istoric, Asociere.

| Componentă / prop | Id | Ce face |
|---|---|---|
| `DataTable` · anatomie | 27a | Bara de sus → rândul de filtre active → antet → rânduri → subsol cu totaluri → paginare. Antet sticky la derulare. |
| `SortableHeader` (`sortValue`, `defaultSort`) | 27b | Clic: ▲ → ▼ → implicit. Hover = fundal `--neutral-soft` + ⇅. Activ = etichetă slate, săgeată `--orange`. Coloanele numerice sunt aliniate la dreapta (și antetul). Sortarea se ține minte per tabel (`usePersistedState`). |
| `column.type` | 27c | `text` · `truncate` (ellipsis + `title`) · `person` (PersonCell) · `money` (dreapta, `tabular-nums`, 800) · `moneyEur` (lei + „= X €” dedesubt) · `date`/`datetime` · `status` (Badge) · `empty` („—” `--input-border`) · `actions` (link + RowMenu 32×32). |
| `rowState` | 27d | `hover` `#faf7f1` + apare ⋯ · `selected` bifă portocalie + `--cream` · `active` (deschis în panou) bara inset 3px `--orange` + `--orange-soft` · `archived` opacity .6 · `error` bara `--raspberry` + `#fff7f9`. |
| Selecție | 27a, 27d | Bifă 16px radius 5. Antetul are și stare parțială („–”). Shift+clic selectează un interval. |
| `FilterPills` | 27e | Alegere unică, până la 8 valori, selectat = slate. Fără limită de grupuri (Achitări are 3). |
| `SegmentedControl` cu contoare | 27e | Pentru stări exclusive. Contorul ignoră celelalte filtre. |
| `SearchInput` | 27e | 260–360px, pill, fără diacritice, fără spații în telefon, debounce 150 ms, × golește, Esc golește. |
| `FilterMenu` **nou** | 27e | Buton sm (`8px 12px` radius 10). Activ = `--orange-soft` + border 1.5px `--orange` + valoarea sau numărul. Popover 260px: căutare, opțiuni cu bifă și contor, „Golește” / „Doar X”. Înlocuiește `<select>`-urile din bare (Achitări, Mesaje SMS, Cheltuieli). |
| `PeriodFilter` | 27e · 41e | Implementat §5.1: presetări (luna curentă, luna trecută, 30 zile, an școlar, tot) + „Interval personalizat” cu 2 DateInput, peste `Button`+`Popover`. Model pe zi (`YYYY-MM-DD`). An școlar = 1 sep – 31 aug. În Achitări și Cheltuieli. |
| `ActiveFilters` **nou** | 27a | Rând de chip-uri „Cheie: valoare ×” + „Șterge filtrele”. Apare doar dacă e activ cel puțin un filtru. |
| Contor rezultate | 27a | „**24** din 146” în dreapta barei. |
| `TableFooter` (`totals`) **nou** | 27a | Rând `--cream` cu „Total pe filtru · N” + sumele pe coloanele `money`. |
| `Pagination` | 27a · 38a | „Pe pagină 25 ▾” · „26–50 din 312” · ‹ 1 2 3 4 … 13 › (32×32 radius 10, pagina activă slate). Maximum 7 poziții, prima și ultima mereu vizibile, „…” 13/800 `--subtle`, săgețile dezactivate la capete. Ascunsă la o singură pagină. Logica în `pageWindow(page, total)`, funcție pură. Se resetează la schimbarea filtrelor. **01.10:** în cod e încă v1 („Pagina X din Y”). |
| `groupBy` + restrângere | 27f | Antet de grup `#faf7f1`, Baloo 15, contor, sumă pe grup, ▼/▶. |
| Gol / fără rezultate / încărcare | 27f · 29h | Automat din `state` + `empty="<cheie>"` (29h). `EmptyState` cu CTA. „Nimic pentru X” (chenar punctat) + „Șterge filtrele”. Rânduri schelet cu aceleași coloane, după 300 ms. |
| `SelectionBar` | 27g | În linie (Copii, Cheltuieli) sau `floating` (Achitări). „Selectează toate N”. Slot danger. Esc = Anulează. |
| `ColumnMenu` + `density` **nou** | 27h | ⚙ în bară: coloane vizibile (tragere pentru ordine, cele obligatorii blocate) + Normal/Compact. Se ține minte local, per tabel. |
| Export | 27h | „Exportă” deschide panoul comun (ca 19b): Excel/CSV/PDF, filtrate / toate / selecția. |

## 0c. Alte componente — `DS Componente.dc.html` (28a–28g), `DS Fundamente.dc.html` (26a–26e)

| Componentă | Id | De făcut în cod |
|---|---|---|
| `Button` | 28a | 7 variante × 5 stări (implicit, hover, apăsat, dezactivat, se încarcă). **Nou:** `danger`, `danger-ghost`, prop `loading`, focus ring comun. |
| `IconButton` **nou** | 28a | × 36 rotund, ⋯ 32 radius 10, ‹ › 32. |
| `Badge` | 28b | `size sm/md`, `dot`, `solid`, `CountBadge` (roșu = acțiune, neutru = informativ). |
| `Card` / `Kpi` / `Notice` | 28c | `Kpi` cu `tone`, `size`, `emphasis`, `decorative`. **Nou:** `Notice` cu `tone` (info/notă/eroare/gata), radius 14. |
| `PageHeader` + `Tabs` **nou** + `Breadcrumb` **nou** | 28d | Ordinea din antet: mod → stepper → secundare → o primară. `Tabs` pentru subpagini (Personal, Backup și setări), cu indicator 2.5px `--orange`. |
| `Avatar` 26/32/38/64/84, `PersonCell`, `AttendanceDot` 10/14/22, `ProgressBar` (simplă, segmentată, capacitate), `Legend` | 28e | Mărimile lipsă și `ProgressBar` sunt noi. |
| `Toast`, `SaveIndicator`, `UndoHistory`, `Skeleton`, `LoadingBar` **nou** | 28f | `LoadingBar` = 21b. |
| `RowMenu`, `Tooltip` **nou**, `Popover` **nou**, `ConfirmDialog`, `Drawer` | 28g | Separator și item danger în `RowMenu`. Un singur `Popover` de bază peste care se fac FilterMenu, PeriodFilter, SearchSelect, motivul absenței. |
| Tokeni | 26a–26e | Adaugă în `tokens.css` ce lipsește: `--text-secondary`, `--on-slate-muted`, `--yellow-frame`, `--radius-5`, `--shadow-popover`, `--shadow-dialog`, `--shadow-drag`, scara `--space-*`. |

## 0d. Încărcare și stări — `DS Incarcare si stari.dc.html` (29a–29g)

**Regula:** fiecare componentă din §0–§0c are, pe lângă stările vizuale, **`loading`**, **`error`** și, unde are sens, **`offline`**. Toate apar în Storybook.

| Ce | Id | Comportament |
|---|---|---|
| Praguri de timp | 29a | < 300 ms: nimic. 300 ms–1 s: schelet (conținut) sau spinner (acțiune). > 1 s: text („Salvez…”). > 2 s pe lot: toast de progres. > 10 s: eroare locală + „Încearcă din nou”. Minimum 400 ms pe ecran. Hook comun `useDelayedLoading(active, 300, { minVisible: 400 })`. |
| `Spinner` **nou** | 29a | 12/16/24/40, `currentColor`, pistă 20%, 0,8 s, `role="status"`. Cu `reduced-motion`: 1 rotație/s. |
| `Button loading` | 29b | Spinner 14 + text la gerunziu, lățimea păstrată, `aria-busy`, clicuri ignorate. La fel pentru `IconButton` și itemii din `RowMenu` (meniul rămâne deschis). |
| Comenzi optimiste | 29b | `Toggle`, `Checkbox`, `SegmentedControl`, `ChipSelect`: starea nouă apare imediat, atenuată, cu spinner în buton. La eroare revine + toast. |
| Câmpuri | 29c | `TextInput validating` (spinner 16 dreapta + ajutor „Verific…”). Câmp calculat (curs BNM): blocat + „Aduc…”, iar după 5 s „Introdu manual”. `Select loading`. `SearchSelect`: spinner în câmp + 3 rânduri schelet. `FilterMenu`: opțiunile imediat, contoarele cu schelet. Salvarea automată pe câmp folosește `SaveIndicator` lângă etichetă. |
| `DataTable` | 29d | `loading` = antet + filtre reale, 8 rânduri schelet. `refreshing` = rândurile vechi la .55 + `LoadingBar` de 3px deasupra antetului. `rowSaving` = spinner 12 în locul lui ⋯. Pagina următoare = „Pagina 2 se încarcă…” în subsol. |
| `Kpi` / `Card` | 29e | Prima încărcare = schelet. Reîmprospătare = valoarea veche la .5 + spinner 12. Eroare = chenar punctat roz, „—” și „Reîncearcă”. |
| `Drawer` / `Dialog` | 29e | La deschidere: antet real + schelet de câmpuri. La salvare: câmpurile read-only, Anulează, Esc și clicul în afară blocate, butonul primar cu loading. |
| Progres | 29f | `FileInput` cu bară + MB + „Oprește”. `ProgressToast` (lot SMS, arhivări multiple) cu „N din M” + „Oprește” + rezumat final. `StepList` (import, backup, sincronizare), ca 21a. Indicator de sincronizare cu puls. Pregătire de tipar. Spinner inline cu text. |
| `ErrorState` + `InlineError` **nou** | 29g | Eroarea stă unde a apărut. Datele afișate nu dispar la eroarea unei reîmprospătări. Reîncercare automată doar la citiri (2/5/10 s). Scrierile se reîncearcă doar la clic. Codul tehnic apare mic, dedesubt. |

## 0e. Date și grafice — `DS Date si grafice.dc.html` (30a–30h)

| Componentă | Id | Detalii |
|---|---|---|
| `DatePicker` (`mode: single \| range`, `isDisabled`, `markers`) | 30a | Popover 300px, zi 34px radius 10. Azi = inel `--orange`. Ales = plin. Interval cu mijlocul `--orange-soft`. Blocat = tăiat. Marcaj = punct 4px. `loading` = marcajele vin după, cu spinner în subsol. Tastatură completă. Se poate și tasta direct. |
| `MonthPicker` / `YearPicker` / `SchoolYearStepper` | 30b | Grilă 3×4. Punct de stare pe lună. `maxMonth`. Deschis din titlul `MonthStepper`. |
| `TimePicker` + `TimeSlots` | 30c | Listă din 15/30 min, cu tastare. Sloturile au capacitate (plin, puține locuri, `loading` pe slot). |
| `BarChart` | 30d | 2 serii, bare de 13px. Luna curentă intensă. Tooltip slate. Fără axă Y. `loading` = bare schelet + spinner. `empty`. |
| `Heatmap` | 30e | Celulă 26 radius 6 gap 4. Stări: achitat, parțial, restanță, viitor, fără contract. Luna curentă = inel slate. Tooltip. |
| `DayGrid` (`cell: dot \| code \| bar`) | 30f | O singură componentă pentru Prezența Luna, Pontaj și Concedii. Weekendul pe coloană întreagă. Azi. Subsol cu totaluri. Celula `saving` = spinner 10. Rândul `loading`. Tastatură: săgeți + Space. |
| `WeekGrid` | 30g | Zile × ore. Blocul evenimentului cu bară ink 3px. „+ Liber”. Clic pe gol = creare precompletată. Schelet la încărcare. |
| `MonthCalendar` | 30h | Evenimente ca pastile, maximum 3 + „+N” (popover). Zile din alte luni .45. Schelet. |

## 0f. Tipare de pagină — `DS Tipare de pagina.dc.html` (31a–31g)

| Tipar | Id | Detalii |
|---|---|---|
| `Board` + `@shared/dnd` | 31a | Sursa .45 cu loc punctat. Ținta = inel 3px `--orange` + linie de inserare. Copia trasă −2°. Țintă plină = motiv. Plasare optimistă cu spinner. Tastatură (Space/săgeți). |
| `MasterDetail` | 31b | `1fr 380px`, panou sticky, rândul activ cu bara 3px, ↑/↓. Detaliu `loading` (schelet) și `empty`. Sub 1280 → Drawer. |
| `ProfileLayout` | 31c | Hero în tonul grupei, avatar 84, Baloo 36, acțiuni. Grilă `columns`. Secțiunile se încarcă independent. `ProfileNotFound`. |
| `Wizard` | 31d | Indicator de pași (făcut, curent, următor), subsol Înapoi / Sari peste / Continuă. Salvare pe pas cu loading. Progresul se reia. |
| `Timeline` + `NoteList` | 31e | Antete de zi, oră, autor, pastila acțiunii, „vechi → nou”. Încărcare automată la derulare. Note inline cu autor, „editată”, ⋯. |
| `Disclosure` / `Accordion` | 31f | ▸/▾, rezumat în antet, 160 ms, stare ținută minte. |
| Responsive | 31g | ≤ 1280: `NavRail` 72px + meniu în Drawer (☰), acțiunile secundare în ⋯, KPI 4→2. ≤ 768: `DataTable` → carduri (`primary`/`status`/`secondary`), filtrele în Drawer. |

## 0g. Diverse — `DS Diverse.dc.html` (32a–32g)

| Componentă | Id | Detalii |
|---|---|---|
| `GlobalSearch` (Ctrl+K) | 32a | Rezultate grupate pe tip, maximum 4 + „Vezi toate”, navigare cu tastatura, spinner fără să dispară rezultatele, gol cu sugestie. |
| `BranchSelector`, `SyncStatusCard` | 32b | Schimbarea filialei cu spinner pe rând (+ 13b). Sincronizare în 5 stări: sincronizat, în curs (puls), fără internet, conflict, deconectat. |
| `TonePicker` | 32c | 8 × 32px, ales = border ink + ✓, previzualizare live. |
| `SmsPreview` + `SegmentCounter` | 32d | Bulă cu variabilele evidențiate. Contor cu bară (verde, galben, raspberry). Avertisment UCS-2 + „Scoate diacriticele”. |
| `Kbd` + `ShortcutsDialog` (?) | 32e | Ctrl+K, Ctrl+Z, Esc, Ctrl+Enter, S, ↑/↓. Scurtătura apare în tooltip. |
| `PrintHeader`, `PrintTable`, `SignatureLine`, `PrintFooter`, `ThermalBlock` | 32f | Alb-negru, folosite de toate tipăriturile (16x, 19, 23k, 24x). |
| `TagInput`, `NumberStepper`, `Slider`, `CopyField` | 32g | Alergii, locuri pe oră, mărimea interfeței, cod de asociere cu expirare. |

## 0h. Fundamente 2 — `DS Fundamente 2.dc.html` (33a–33f)

| Ce | Id | Decizie / de făcut |
|---|---|---|
| **Iconițe: Lucide** (`lucide-react`, pinned) | 33a | Set ales: linie 2, colțuri rotunjite. Lista de ~80 de iconițe pe categorii (meniu, acțiuni, interfață, stări, date) = singurele permise. Componenta `Icon` (`name`, `size`) peste `lucide-react`. **Înlocuiește toate caracterele** ⌕ ⋯ ▾ × ‹ › ✓ ☰ ⋮⋮ din cod. |
| Mărimi și culori | 33b | 14 / 16 / 20 / 24, `absoluteStrokeWidth`, `currentColor`. Butonul doar cu iconiță are obligatoriu `aria-label` + tooltip. |
| Mișcare | 33c | Tokeni noi `--motion-instant/fast/base/panel/slow` (80/120/160/220/300 ms) + curbe. Se animă doar opacity/transform/max-height. `reduced-motion` → 0 (cu excepția spinnerului și a progresului). |
| Brand | 33d | Logo complet (minimum 28px), iconiță (minimum 24), versiunea pe fundal închis, reguli pentru cercurile decorative. |
| Texte și formate | 33e | Ghid de ton (verbe pe butoane, gerunziu cu „…”, întrebare la confirmare, „tu”). `@shared/format` completat cu `formatRelative`, `plural`, `formatPhone`, minus real. |
| Accesibilitate | 33f | Perechile de contrast validate (`--subtle` doar pentru etichete upper 11/800). **Alb pe `--orange` = 2,4: sub prag la orice mărime (buton primar, pastila „azi”, insigna filialei). Decizie deschisă: `--orange-strong` (≥ 4,5 cu alb) pentru fundalurile cu text alb / text slate / excepție de brand. Până atunci, fără texte albe noi pe `--orange`.** `:focus-visible` comun. Zonă de clic 40×40. Focus prins în panouri și dialoguri. `aria-sort` / `aria-live` / `aria-invalid`. Text până la 120% fără suprapuneri. |

## 0i. Componente 2 — `DS Componente 2.dc.html` (34a–34l)

| Componentă | Id | Detalii |
|---|---|---|
| `AppBanner` | 34a | Eroare / offline / avertizare / info. Unul singur vizibil, după prioritate. Eroarea și offline-ul nu se pot închide. Acțiune cu loading. |
| `AvatarGroup` | 34b | −8px, contur alb 2px, `max`, „+N” deschide lista, schelet. |
| `SplitButton` | 34c | Ultima variantă e ținută minte, ▾ deschide variantele, loading pe tot butonul. |
| `InlineEdit` | 34d | view → hover (creion) → edit → saving → error. Enter / Esc / Tab. Optimist. |
| `DiffTable` | 34e | Câmp / al meu / al lor, rândurile diferite pe galben, alegere pe câmp + „tot al meu / al lor”, rezolvare cu loading. |
| `LockedContent` + `usePinLock` | 34f | Blocat (suma nu e în DOM), verificare, deschis cu numărătoare inversă. Greșeli: tremurat + încercări, blocare după 5. |
| `UnsavedChangesDialog` + `useUnsavedGuard` | 34g | Renunță / Rămân / Salvez și continui. Numește formularul și câmpurile. Apare la panou, navigare, filială, închiderea aplicației. |
| ~~`DocumentCard` + `DocumentGrid`~~ | 34h | **Scos 30.09** odată cu documentele copilului. Nu e folosit de niciun ecran; se șterge din `@shared/ui`, fără poveste în Storybook. |
| `HoverCard` | 34i | 400 ms intrare, 200 ms ieșire, nu apare pe tactil, schelet, cache. |
| `MultiSelect` | 34j | Chip-uri cu avatar, Backspace, „și încă N”, acțiune de grup în subsol, spinner la căutare. |
| `TodoCard` + `TaskRow` | 34k | Contoare pe categorii, reîmprospătare în fundal. Rândul rezolvat se estompează, apoi dispare. |
| `PrintOptionsDialog` | 34l | Același pentru toate tipăriturile: ce / format (ChoiceCards) / opțiuni / nr. pagini live, „Pregătesc…”, opțiuni ținute minte. |

---

## 1. Componente existente → unde apar în design → ce lipsește

| Componentă | Tipar în design | Unde | De făcut |
|---|---|---|---|
| `Button` (primary/ghost/white/outline · md/lg/header) | Buton primar antet Baloo 15/700 `8px 18px`; secundar Nunito 14/800 `8px 16px` alb, border 1.5px | toate antetele | Varianta secundară de antet = `outline` + `size="header"` trebuie să dea exact `8px 16px` 14/800 (acum outline are alt padding). Variantă nouă `danger` (`--pink-ink` plin, alb) pentru „Șterge N copii” (15h). |
| `SegmentedControl` | Comutator mod (Tabel/Pe luni, Ziua/Luna), Metodă, Serviciu, Suma liberă/fixă | antete, 15b, 10d | Variantă `size="field"` (radius 12, opțiune `8px 0`, flex:1 — în formulare) vs. `pill` (antet, radius 999). |
| `FilterPills` | „Grupa · Toate · Mars…”, „Metodă”, „Serviciu” | Copii, Achitări, Cheltuieli, Prezența, Pontaj, Situația | ✅ Fără limită de grupuri (§0); Achitări are 3 (Metodă · Grupa · Serviciu), aceeași trecere pe al doilea rând ca în artboard. |
| `Badge` | Pastile de stare, serviciu, cod pontaj | peste tot | Adaugă `size="sm"` (11px, `2px 8px`) pentru insigna „+1”, „implicit”, „editată”. |
| `Card` (tone, decorative) | Carduri albe radius 22 border; KPI soft radius 20 cu cerc | peste tot | Radius: design folosește **22** pentru cardurile mari de conținut și **20** pentru KPI — verifică `Card.module.css`. |
| `PersonCell` (md/lg) | Avatar + nume + sub | Copii, Personal, Candidați, Achitări (Pe luni), De notificat, fișe | Avatar 36–38 în listă (acum 30). Adaugă `size="sm"` 26 (Prezența Luna, Bazin Luna) și `size="md"` = 38. |
| `DataTable` (+groupBy) | Tabele cu antet 11/800 uppercase, rânduri `11–12px 20px` | Copii, Achitări, Cheltuieli, Personal, Vizite, Candidați | Selecție cu bifă stilizată (16px radius 5, portocaliu), sortare pe coloană (Serviciu), stare `archived` a rândului (opacity .75). |
| `ListToolbar` + `SearchInput` | Căutare pill 260–360px + acțiuni + contor | Copii, Personal, Candidați | Pe același rând cu FilterPills la Echipa (23a). |
| `SelectionBar` | Bara slate „N selectați · acțiuni · Anulează ×” | Copii, Achitări, Cheltuieli, Vizite | Slot `danger` (pastilă `--raspberry` plină) pentru „Șterge definitiv” (B2). Textul acțiunilor secundare `#b9c1c6` → token `--on-slate-muted`. |
| `ConfirmDeleteDialog` | „Scrie ȘTERGE” | peste tot | Props noi: `items: string[]` (max 5 + „și încă N”), `consequences: ReactNode`, `confirmLabel` (ex. „Șterge 3 copii”). |
| `Drawer` | Panou 480–560 | toate formularele | Aliniat (A1). Subsol cu text stânga (`footerHint`) + butoane dreapta. |
| `RowMenu` | Meniu ⋯ 32×32 radius 10 | tabele | Aliniat. |
| `Toast` (+action) | Toast slate cu „↶ Anulează” | arhivări, note | Opțiune `persistent` (fără auto-închidere) — rămâne pentru cazuri viitoare; momentan nefolosită (marcarea în masă a fost scoasă). |
| `MonthStepper` / `DayStepper` | „‹ Septembrie 2026 ›” | Dashboard, Situația, Salarii, Pontaj, Prezența | Salarii: blochează lunile neîncheiate (`max`). |
| `ProfileLayout` / `ProfileSection` / `StatCard` | Fișa copilului, fișa angajatului | 2b, 23j | Grila `minmax(0,1fr) minmax(0,1.35fr)` (A3); prop `columns` ca 23j să-și păstreze proporția. |
| `EmptyState` | 4 variante (`first` · `done` · `period` · `noResults`) | toate listele, grilele, Dashboard | **Automat** (29h): `DataTable`/`Board`/`MonthCalendar`/`DayGrid` primesc `empty="<cheie>"` și aleg varianta din `state`. Textele doar în `@shared/ui/empty-states.ts` (35b). Ecranele nu randează stare goală proprie. |
| `ScrollArea` | Bara subțire 15g | meniu, panouri, popover-e | Aliniat. |
| `BnmRateLink` | ↗ spre bnm.md | curs în 12a/12b | Folosit și de pastila nouă de curs (vezi 2). |
| `groupTone()` | Tonul grupei | peste tot | Să citească `group.tone` ales manual, nu doar poziția (inconsistență semnalată în COADA). |
| `AttendanceDot` (`@shared/attendance`) | Punct de stare 10/14/22 | Prezența, Bazin, fișa | Mărimi `sm` 10, `md` 14, `lg` 22; nemarcat = cerc gol. |

## 2. Componente noi de extras

| Componentă nouă | Ce face | Unde se folosește (≥2) | Detalii din design |
|---|---|---|---|
| `Kpi` (în `Card`) | Etichetă 12/800 uppercase în `-ink` + valoare Baloo + rând mic | Dashboard, Achitări, Cheltuieli, Situația, Salarii, Bazin, Set final | `size`: `xl` 36 (Încasări Dashboard), `lg` 30, `md` 28, `sm` 22–24; `sub` 13px `#5b666e`; `emphasis` = border 2px slate (Rămas de plătit). |
| `CurrencyRatePill` | Pastila „€ 19,92 lei · Curs BNM · azi ↗”, link spre bnm.md | Dashboard (1a), Planuri și curs (12f), Achitare nouă cu taxă € (12b) | Cerc 30 `--mint-soft` „€”, Baloo 15/800, sub 11/700 `--subtle`, padding `6px 12px 6px 6px`, pill, border `--border`, hover border `--border-hover`. Construită peste `BnmRateLink`. |
| `AmountInput` | Suma mare: Baloo 40 (36 în dialog) + monedă 18/700 `--subtle`, caset `14px 18px` radius 16 border 1.5px `--orange` fundal `--cream` | 15b, 15c, Avans (23g), Programare bazin | + slot `shortcuts` (pastile „1 lună · 9.600”). |
| `ChoiceCards` | Carduri selectabile (radius 12–14, border 1.5px; selectat 2px `--orange` + `--orange-soft`), titlu 14/800 + sub 12px | 15a (programe), 22b (ore cu locuri), 10d (tonuri, ca swatch) | `disabled` pentru ora plină; `columns`. |
| `ChipSelect` | Pastile de alegere unică/multiplă, `7–9px 14–16px` 13/800, selectat = ton plin sau slate. **38b:** la grupă, `count` = „8/12” (ocupare/capacitate) sau „8” fără capacitate; plină = text `--pink-ink` + notă sub pastile | 15a (grupă cu „8/12”), 15c (categorie), 22b (zile), Pontaj tipărit | `tone` per opțiune, `sub` opțional. |
| `TonePicker` | 8 pătrate 32×32 radius 10, selectat border 2px `-ink` | 4c (Grupă nouă), 10d (Serviciu nou) | Valoare = `PillTone`. |
| `DragHandle` + `setDragGhost()` | Mânerul ⋮⋮ (opacity .55, hover fundal alb) și imaginea de tragere: copie rotită −2°, border 2px `--orange`, umbră `0 18px 36px rgba(58,71,80,.22)`; sursa = loc gol punctat, ținta = inel `0 0 0 3px var(--orange)` | Grupe (grupe + copii), 10d Servicii, categorii cheltuieli | Utilitar în `@shared/dnd`; tranziție 120ms. |
| `UndoHistory` + `useUndoStack()` | „↶ Anulează | N ▾” + popover „Modificări azi” (oră, etichetă, „Anulează” / „Anulează până aici”, „Anulează tot”), Ctrl+Z | Prezența Ziua, Prezența Luna, Pontaj | Stiva per zi și filială, persistată; anularea = mutație normală (sync + Istoric). |
| `SaveIndicator` (mutat în `@shared/ui`) | „● Salvat · 08:12 / Se salvează… / Nesalvat · 3 modificări + Încearcă din nou” | Prezența, Pontaj, Bazin (marcaj) | Există în `attendance/`; mută-l în shared. |
| `NoteList` | Note cu dată, oră, autor, „editată”, ⋯ Editează/Șterge, formular inline | fișa copilului (2b), fișa angajatului (23j) | Cea mai recentă pe `--yellow-soft`, restul `--neutral-softer`; radius 14, padding `12px 14px`, 14px/1.45. |
| `ServiceBadge` + `serviceTone()` | Pastila serviciului (Grădiniță, Bazin, …) | Achitări, fișa (istoric plăți), Raport contabil, bon de zi, Asociere | Peste `Badge`, tonul vine din `services[].tone`. |
| `SettingsList` | Lista editabilă cu mâner, pastilă, contor, stare Activ/Ascuns, „Editează” + „+ Element” în antet | 10d Servicii, categorii cheltuieli, Funcții (23e), Planuri (12a) | Grid `24px 1fr 150px 120px 90px`, rând `12px 20px`, nota de jos 12px. |
| `GroupSection` | Chenar în tonul grupei (fundal soft, border `-border`, radius 22) cu antet nume Baloo 19 + sumar | Prezența Ziua; candidat și pentru Bazin Săptămâna | Necesită tokenii `--<ton>-border` și `--<ton>-avatar` pentru toate 8 tonurile. |

## 3. Storybook (fostă pagina `/design-system`)
Adaugă (sau actualizează) câte o secțiune pentru fiecare rând din tabelul 2 și pentru variantele noi din tabelul 1: `Button danger`, `SegmentedControl field`, `Badge sm`, `PersonCell sm/md`, `SelectionBar` cu danger, `ConfirmDeleteDialog` cu listă, `AttendanceDot` pe 3 mărimi. Fiecare secțiune arată toate stările. Scara de tokeni (culori, tipografie pe roluri, raze, umbre) din `TOKENS.md` apare sus pe pagină.

## 3b. Noi după feedback 01.10 (artboard-urile 38–45, acum în paginile de modul)

| Componentă | Id | Valori |
|---|---|---|
| `autoComplete` implicit | F4 | Toate câmpurile din `@shared/ui` (`TextInput`, `NumberInput`, `PhoneInput`, `AmountInput`, `DateInput`, `TimeInput`, `TextArea`, `Select`, `GlobalSearch`) și `<form>` din `Drawer`/`Dialog` au `autoComplete="off"`. Se poate suprascrie doar explicit. |
| `RateCalendar` **nou** | 38e | Grilă lună 7 coloane, celulă 46px radius 10: ziua 11/800 `--subtle` + cursul 11/700. Weekend/sărbătoare = `--neutral-soft`, cursul zilei lucrătoare dinainte, `--subtle`. Corectat manual = `--yellow-soft`. Antet cu `MonthStepper`. Subsol: ora ultimei preluări + „Vezi încă 10 zile” (link). |
| `RateCard` (cardul de curs) | 38e | Cardul existent din 12a + rândul „Mâine, zz.ll: X lei ▲/▼ diferența” pe alb, radius 12, doar după ce BNM a publicat. |
| `EditableList` (mod `view` / `edit`) | 38d · 38f | Lista de planuri și lista de funcții: în `view` doar citire + „+ Adaugă” (primar) și „Editează” (secundar). În `edit`: câmpuri, `×` doar pe elementele nefolosite (altfel inactiv, tooltip „Folosit de N”), „Salvează” inactiv până la prima modificare, „Anulează” revine la `view`. |
| `ChildLockedRow` | 38c | Rândul copilului fixat în Achitare nouă: avatar cu tonul grupei, nume 15/800, „grupă · contract · scadență” 12px, „Schimbă” 13/800 `--orange-ink`. Fundal `--cream`, border `--border`, radius 16. |
| `ArrearsRow` | 38c | „Are restanță: Lună · sumă” pe `--pink-soft`, radius 12, text `--pink-ink`; acțiune „Bifează ca s-o acoperi”. |
| `MissingFieldsBanner` **nou** | 41a | Bandă sub antetul fișei, radius 16: „Lipsesc N date” Baloo 16 + pastile albe 13/800 + „Completează”. Galben (`--yellow-soft` / `--yellow-ink`) pentru recomandate, roz dacă lipsește un obligatoriu. Ascunsă când totul e completat. Logica: `missingChildFields(child)`. |
| `ErrorNotice` (peste `Notice`) | 41d | Cerc 26px cu „!”, titlu 14/800 = ce s-a întâmplat, text 13px = ce s-a păstrat și ce urmează, 1–2 acțiuni link 13/800 `--orange-ink`. Roz = blocant, galben = degradat (merge mai departe). Fără coduri HTTP. Text din `toUserError(err)`. |
| `WeekFillBar` | 41b | În antetul pontajului: interval Baloo 18 + „Toți prezenți L–V” (`Button variant="mint"`) + „Copiază săpt. trecută” (secundar). Completează doar celulele goale, pe săptămâna curentă. Pe rând, aceeași acțiune scopată la un angajat, dintr-un `RowMenu` existent, nu o componentă nouă. Scrie codul nou `'P'` (prezent confirmat) în pontaj — numărat identic cu lipsa rândului; apare acum distinct în grilă/tipărire (vezi `TimesheetCell` §3c, PROMPT-9 §1.2), ca să poată fi anulat ca o acțiune (§8.2). |
| `RoundingRow` | 41f | Sub suma încasată, radius 12: mint „Luna achitată · rotunjire ±X lei” (în toleranță), roz „Rămân X lei” (parțial), portocaliu-soft „+X lei avans pentru Lună” (surplus). Dreapta: „≈ N €”. Calculul „plan € × curs = X lei” 13px `--muted` deasupra câmpului. |
| `GlobalSearch` (grupuri noi) | 41c | Logica de potrivire trăiește în `search-records.ts` (Topbar-ul din `app/shell` are propriul input, nu componenta `GlobalSearch` din `@shared/ui`, încă nefolosită acolo). Implementat: telefonul (părinte 1/2, persoană autorizată) se caută pe sufix, în același grup „Copii”, fără subtitlu sau bold pe sufix (V1 simplificat, ca în `GlobalSearch.tsx`); textul numeric adaugă grup nou „Cheltuieli” lângă „Achitări”, max. 5 rezultate combinate, cele mai noi primele. |
| `AppBanner` **nou** | 42a · 42b | Bandă full-width deasupra antetului: roz (blocant, fără ×) sau mint (informativ, cu ×). Cerc „!” 26px sau text simplu, titlu 14/800, text 13px, acțiune primară sau link-uri. Un singur banner odată; prioritate: sincronizare oprită > actualizare gata. |
| `SetupWizard` | 42d | 3 pași în card 420–440px: Alege (ChoiceCards radio) → Verifică (rânduri din manifest + notă galbenă) → Gata (bife + link-uri). Eticheta „Pasul N din 3” 12/800 uppercase. |
| `QuickPaySearch` | 44a | **Implementat** (`54b5ee3`) cu `TextInput` + `SelectableRow` din `@shared/ui`, nu `SearchSelect` — `SearchSelect` presupune o listă de opțiuni fixă, nu rezultate calculate la fiecare literă tastată cu subrânduri de frați; `architecture.test.ts` R1 interzice oricum `<input>`/`<button>` brute în `features/**`, iar `SelectableRow` e exact varianta sancționată acolo pentru rânduri de listă custom. Restul (border orange, `Kbd` „N”/„Enter”, frații sub copil) ca mai jos. |
| `SiblingPaymentRows` | 44b | **Implementat** (`0f6e0a6`) — rânduri bifă + nume + lună (informativ) + sumă editabilă, în `PaymentFormDrawer`, „+ Adaugă fratele” per frate disponibil. „Total” e un `AmountInput` reutilizat (40/36px, nu 24px literal) — editabil, cum cere `PROMPT-CLAUDE-CODE-8.md` §13, cu diferența alocată automat prin pipeline-ul existent de repartizare (restanța cea mai veche bifată întâi). Anularea de grup (40b) — vezi PROMPT-9 §5. |
| `CashSummaryCard` | 44c | **Implementat** (`7c9028b`) — ziua Baloo 20 + nr. achitări, 3 mini-carduri (`Kpi` reutilizat, cu `onClick` nou) pe ton (numerar orange, card albastru, transfer mint), total + „Tipărește raportul zilei” (pagină A4 nouă, `PrintTable`, distinctă de bonul termic al §11). Eticheta/suma mini-cardului urmează mărimile proprii ale `Kpi`, nu literal 11/800+Baloo 20 — reutilizare peste o componentă nouă doar pentru atât. Clic pe mini-card filtrează lista de dedesubt (metodă + ziua aleasă). |
| `Drawer` / `Dialog` (comportament) | 44d | `initialFocus`, Ctrl+Enter = submit, Esc → `UnsavedChangesDialog`, subsol fix, focus pe prima eroare + „N erori” în subsol, `loading` pe principal, fără drawer în drawer. Lățimi: `--drawer-form: 620px`, `--drawer-detail: 480px`, `--dialog: 440px`. |
| `HistoryRow` + `RecordFilter` | 45a | Rând: dată 14/800 + oră 12px, `Badge` modul, acțiune 14/800 + „înainte → după” 13px, cine + calculator aliniat dreapta. Filtru: pastilă slate cu × pentru înregistrarea aleasă. |
| `RecentChanges` | 45b | Card fișă: titlu 12/800 uppercase, max. 3 rânduri cu punct 8px pe tonul modulului, „Tot istoricul”. Doar profil Complet. |
| `AttentionList` | 45c | Rânduri radius 16 pe ton (roz bani, galben date/prezență, neutru sistem): număr Baloo 16 pe alb 34px, titlu 14/800 + detaliu 12px, buton pill alb 12/800. Max. 5. |
| `UndoToast` **nou** | 40b | Slate `#3a4750`, radius 16, bifă pe `--mint`, titlu 14/800 + detaliu 12px `#b9c1c6`, „Anulează · N” pe alb 14%. Jos-centru, 10 s. |
| `UnsavedChangesDialog` | 40c | Dialog 440px: „Închizi fără să salvezi?”, câmpurile schimbate în bold, „Renunță la modificări” (text `--pink-ink`) + „Salvează” primar, implicit pe Enter. |
| `BackupContents` | 38g | Rezumat (Baloo 22) + rânduri tip · sursă · număr, din `manifest.json`. Același bloc în previzualizarea restaurării. |

## 3c. Noi pentru PROMPT-9 (02.10) — `Prima pornire.dc.html#46a–46d`

| Componentă | Id | Valori |
|---|---|---|
| `StartSourceScreen` | 46a | 3 carduri `ChoiceCards` (radius 20, padding 24, ales = contur 2px `--orange`), cerc numerotat 44px pe ton soft; Enter = Continuă. |
| `BackupPreviewTable` | 46b | Refolosește `BackupContents`: rând per bază + Total (border-top 2px); notă mint despre renumărare. |
| `RestoreRejected` | 46c | Card roz = blocat (versiune mai nouă, numărătoare greșită); card galben = avertisment .db vechi, se poate continua. |
| `RestoreDoneDialog` | 46d | `Dialog` 560px fără × și fără Esc, numărătoare 5 s, „Reîncarcă acum”; după reload toast. |
| `TimesheetCell` cod „P” | 41b | Literă „P” `--mint-ink` pe `--mint-soft`, în grilă și la tipărire; legendă „P = prezent confirmat”. |
| `EmptyState` `profil.blocked` | 36f | Cheie nouă în catalog; poveste + test + axe. |

Toate: poveste Storybook cu toate stările + test + axe (§0–§0i).

## 4. Ordine
Extrage componentele **în punctul din ALINIERE care le folosește prima dată**, nu într-un pas separat înainte: `AmountInput` + `ChipSelect` + `ChoiceCards` în A2/A3b, `NoteList` în A3, `UndoHistory` + `SaveIndicator` + `GroupSection` în A3c, `DragHandle` în A8 (Grupe), `SelectionBar danger` + `ConfirmDeleteDialog items` în B2, `ServiceBadge` + `SettingsList` + `TonePicker` în B3, `Kpi` + `CurrencyRatePill` în A8 (Dashboard). La al doilea ecran care o folosește, doar o reutilizezi.
